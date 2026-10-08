import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Laugh, Paperclip } from 'lucide-react'
import { nombreCompleto, useSession } from '@/domain/auth'
import { fechaCorta, hhmmA12, hora12, todayISO } from '@/domain/dates'
import { mutate, uid, useDB } from '@/domain/store'
import type { Alerta, EstadoAdultoVisita, Visita } from '@/domain/types'
import { Button, ButtonLink, EmptyState, SelectField, SuccessOverlay, TextareaField } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { AdultoHeader } from '../components/AdultoHeader'
import { EvidenciasLista } from '../components/EvidenciasLista'
import { TileSelect } from '../components/TileSelect'
import { ESTADOS_ADULTO, estiloPunto, hhmm, useAdultosElegibles } from '../lib/dominio'
import { MAX_EVIDENCIAS, procesarEvidencias } from '../lib/evidencias'
import comun from './Comun.module.css'
import styles from './RegistrarVisita.module.css'

type Errores = { adulto?: string; estado?: string; obs?: string }

/**
 * Registrar Visita: cuidador (Figma 358:2564) y coordinador (488:2592).
 *   ?visita=:id  completa esa visita (la deja en curso al abrir y completada al finalizar)
 *   ?adulto=:id  crea una visita completada para ese adulto
 *   sin params   igual que ?adulto, pero con selector de adulto
 */
export function RegistrarVisita() {
  const { user } = useSession()
  const { base } = useShell()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const visitaId = params.get('visita')
  const adultoParam = params.get('adulto')

  const visitas = useDB((s) => s.visitas)
  const adultos = useDB((s) => s.adultos)
  const usuarios = useDB((s) => s.usuarios)
  const elegibles = useAdultosElegibles()
  const esCoord = user?.rol === 'coordinador'

  const visita = useMemo(() => (visitaId ? visitas.find((v) => v.id === visitaId) : undefined), [visitas, visitaId])
  const [ahora] = useState(() => new Date())

  const [adultoSel, setAdultoSel] = useState(adultoParam ?? '')
  const [estado, setEstado] = useState<EstadoAdultoVisita | ''>('')
  const [obs, setObs] = useState('')
  const [evidencias, setEvidencias] = useState<string[]>([])
  const [errores, setErrores] = useState<Errores>({})
  const [exito, setExito] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  // Si se llega desde "Iniciar Visita" ya está en curso; si se abre el enlace directo de una pendiente, se inicia aquí.
  useEffect(() => {
    if (!visitaId) return
    mutate((db) => {
      const v = db.visitas.find((x) => x.id === visitaId)
      if (v && v.estado === 'pendiente') {
        v.estado = 'en_curso'
        v.inicio = new Date().toISOString()
      }
    })
  }, [visitaId])

  const adulto = adultos.find((a) => a.id === (visita ? visita.adultoId : adultoSel))
  const responsable = useMemo(() => {
    if (visita) return usuarios.find((u) => u.id === visita.cuidadorId)
    if (esCoord && adulto) return usuarios.find((u) => u.id === adulto.cuidadorIds[0]) ?? user ?? undefined
    return user ?? undefined
  }, [visita, usuarios, esCoord, adulto, user])

  const cerrada = !!visita && (visita.estado === 'completada' || visita.estado === 'cancelada') && !exito
  if (visitaId && !visita) {
    return <Vacio titulo="Visita no encontrada" texto="La visita que intentas registrar no existe." to={`${base}/visitas`} />
  }
  if (cerrada && visita) {
    return <Vacio titulo="Esta visita ya fue cerrada" texto="Ya no se puede registrar de nuevo." to={`${base}/visitas/${visita.id}`} accion="Ver detalle" />
  }

  const fecha = visita ? visita.fecha : todayISO()
  const horaPautada = visita ? hhmmA12(visita.horaPautada) : hora12(ahora)
  const inicioISO = visita?.inicio ?? ahora.toISOString()

  async function adjuntar(files: FileList | null) {
    if (!files || files.length === 0) return
    setSubiendo(true)
    const nuevas = await procesarEvidencias(files)
    setEvidencias((prev) => [...prev, ...nuevas].slice(0, MAX_EVIDENCIAS))
    setSubiendo(false)
  }

  function finalizar(e: FormEvent) {
    e.preventDefault()
    if (!user || subiendo) return
    const errs: Errores = {}
    if (!adulto) errs.adulto = 'Selecciona el adulto mayor visitado.'
    if (!estado) errs.estado = 'Indica el estado del adulto durante la visita.'
    if (!obs.trim()) errs.obs = 'Describe lo observado durante la visita.'
    setErrores(errs)
    if (!adulto || !estado || Object.keys(errs).length > 0) return

    const fin = new Date().toISOString()
    const id = visita?.id ?? uid('v')
    const observaciones = obs.trim()
    mutate((db) => {
      if (visita) {
        const v = db.visitas.find((x) => x.id === visita.id)
        if (v) {
          v.estado = 'completada'
          v.estadoAdulto = estado
          v.observaciones = observaciones
          v.evidencias = evidencias
          v.inicio = v.inicio ?? inicioISO
          v.fin = fin
        }
      } else {
        const nueva: Visita = {
          id,
          adultoId: adulto.id,
          cuidadorId: responsable?.id ?? user.id,
          tipo: 'Visita de Seguimiento',
          fecha,
          horaPautada: hhmm(ahora),
          inicio: inicioISO,
          fin,
          estado: 'completada',
          estadoAdulto: estado,
          observaciones,
          evidencias,
        }
        db.visitas.push(nueva)
      }
      if (estado === 'situacion_critica') {
        const alerta: Alerta = {
          id: uid('al'),
          adultoId: adulto.id,
          severidad: 'alta',
          categoria: 'EMERGENCIA MÉDICA',
          titulo: 'Situación crítica reportada en visita',
          descripcion: `${nombreCompleto(user)} reportó una situación crítica durante la visita: ${observaciones}`,
          creadaEn: fin,
          estado: 'pendiente',
        }
        db.alertas.push(alerta)
      }
    })
    setExito(id)
  }

  return (
    <Page title="Registrar Visita" back>
      <form className={comun.cuerpo} onSubmit={finalizar} noValidate>
        <p className={comun.estado} style={estiloPunto('var(--c-teal)')}>
          <span className={comun.punto} aria-hidden />
          Visita en Curso
        </p>

        {visita || adultoParam ? (
          adulto ? (
            <AdultoHeader adulto={adulto} />
          ) : (
            <EmptyState title="Adulto no encontrado" text="Elige otro adulto desde la lista." />
          )
        ) : (
          <>
            <SelectField
              label="Adulto mayor"
              required
              placeholder="Selecciona un adulto"
              value={adultoSel}
              onChange={(e) => setAdultoSel(e.target.value)}
              error={errores.adulto}
              options={elegibles.map((a) => ({ value: a.id, label: nombreCompleto(a) }))}
            />
            {adulto && <AdultoHeader adulto={adulto} />}
          </>
        )}

        <section className={comun.bloque} aria-label="Datos de la visita">
          <h2 className={comun.titulo}>{visita?.tipo ?? 'Visita de Seguimiento'}</h2>
          <ul className={comun.meta}>
            <li>Fecha: {fechaCorta(fecha)}</li>
            <li>Hora Pautada: {horaPautada}</li>
            <li>Hora Inicio: {hora12(inicioISO)}</li>
            {esCoord && responsable && <li>Responsable: {nombreCompleto(responsable)}</li>}
          </ul>
        </section>

        <TileSelect
          label="Estado en la Visita"
          value={estado}
          onChange={(v) => {
            setEstado(v)
            setErrores((x) => ({ ...x, estado: undefined }))
          }}
          options={ESTADOS_ADULTO}
          columnas={3}
          error={errores.estado}
        />

        <section className={comun.panel} aria-labelledby="obs-label">
          <h3 className={comun.subtitulo} id="obs-label">
            Observaciones
          </h3>
          <TextareaField
            aria-labelledby="obs-label"
            placeholder="Describe lo observado durante la visita"
            value={obs}
            onChange={(e) => {
              setObs(e.target.value)
              if (errores.obs) setErrores((x) => ({ ...x, obs: undefined }))
            }}
            error={errores.obs}
            rows={5}
          />
        </section>

        <div className={comun.bloque}>
          <label className={styles.adjuntar}>
            <span>{subiendo ? 'Procesando archivos…' : 'Adjuntar Evidencias'}</span>
            <Paperclip size={22} aria-hidden />
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="sr-only"
              disabled={evidencias.length >= MAX_EVIDENCIAS}
              onChange={(e) => {
                void adjuntar(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          {evidencias.length >= MAX_EVIDENCIAS && <p className="muted text-sm">Máximo {MAX_EVIDENCIAS} evidencias por visita.</p>}
          <EvidenciasLista items={evidencias} onQuitar={(i) => setEvidencias((x) => x.filter((_, j) => j !== i))} />
        </div>

        <div className={comun.acciones}>
          {esCoord ? (
            <>
              <Button type="submit" fullWidth>
                Registrar visita
              </Button>
              <Button variant="outline" fullWidth onClick={() => navigate(-1)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button type="submit" variant="soft" fullWidth>
              Finalizar Visita
            </Button>
          )}
        </div>
      </form>

      <SuccessOverlay
        open={exito !== null}
        message="Visita registrada correctamente!"
        icon={<Laugh size={72} strokeWidth={1.6} aria-hidden />}
        onDone={() => exito && navigate(`${base}/visitas/${exito}`, { replace: true })}
      />
    </Page>
  )
}

function Vacio({ titulo, texto, to, accion = 'Ir a mis visitas' }: { titulo: string; texto: string; to: string; accion?: string }) {
  return (
    <Page title="Registrar Visita" back>
      <div className={comun.vacio}>
        <EmptyState
          title={titulo}
          text={texto}
          action={
            <ButtonLink variant="outline" size="sm" to={to}>
              {accion}
            </ButtonLink>
          }
        />
      </div>
    </Page>
  )
}
