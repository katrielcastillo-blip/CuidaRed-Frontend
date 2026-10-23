/*
 * RegistrarVisita.tsx — Formulario móvil de registro de visita comunitaria (CU-05 · RF-02 · RF-06 · RF-10).
 * Tablas: Visita (Visit_razon, Visit_Fecha, Visit_HoraInicio/Fin, Visit_Estado) · RegistroVisita (User_Id
 * responsable, Autorizada_por_user_Id) · DetalleVisita (adulto principal + otros adultos del mismo hogar con
 * su observación).
 * Módulo: visitas (voluntario y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *   ?adulto=:id   registra una visita realizada a ese adulto (desde su perfil).
 *   ?visita=:id   completa una visita programada (desde "Iniciar visita"); precarga su motivo.
 *   sin parámetros: lista desplegable obligatoria para elegir el adulto.
 *
 * RF-06: como máximo 5 campos de texto libre (observaciones, motivo «Otra» y hasta 3 observaciones cortas
 * de otros adultos del hogar); fecha, hora, motivo y responsable con listas; estado del adulto con tiles y
 * aspectos verificados con casillas. Los adultos adicionales van plegados para que el formulario quepa en un
 * desplazamiento a 360×640. El borrador se conserva si se cierra la pantalla (useBorrador). Funciona sin conexión.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleCheckBig, Laugh, Paperclip, Plus, UsersRound, X } from 'lucide-react'
import { nombreCompleto, useSession } from '@/domain/auth'
import { registrarVisita, validarVisita, type DatosVisita } from '@/domain/api'
import { ASPECTOS_VISITA } from '@/domain/catalogos'
import { useEnLinea } from '@/domain/conectividad'
import { hhmmA12, todayISO } from '@/domain/dates'
import { alcanzaAdulto, puede } from '@/domain/permisos'
import { voluntariosDe } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto, EstadoAdultoVisita, Usuario, Visita } from '@/domain/types'
import { hayErrores } from '@/domain/validacion'
import { Button, ButtonLink, Card, CheckboxGroup, EmptyState, SelectField, SuccessOverlay, TextareaAbreviado, TextField, useToast } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { useBorrador } from '@/lib/useBorrador'
import { AdultoHeader } from '../components/AdultoHeader'
import { EstadoPunto, NoEncontrado, SyncBadge } from '../components/Comun'
import { EvidenciasLista } from '../components/EvidenciasLista'
import { TileSelect } from '../components/TileSelect'
import { ESTADOS_ADULTO, hhmm, MAX_ADICIONALES, mismoHogar, RAZON_OTRA, RAZON_POR_DEFECTO, RAZONES_VISITA, useAdultosElegibles } from '../lib/dominio'
import { MAX_EVIDENCIAS, procesarEvidencias } from '../lib/evidencias'

const TITULO = 'Registrar visita'
const DETALLE_OFFLINE = 'Guardada en el dispositivo · Pendiente de sincronización'

/** Otro adulto del mismo hogar atendido en la visita (fila adicional de DetalleVisita). */
interface FilaAdicional {
  adultoId: string
  observacion: string
}

interface Borrador {
  adultoId: string
  fecha: string
  hora: string
  responsableId: string
  /** Opción elegida en «Motivo de la visita» (o RAZON_OTRA). */
  razonSel: string
  /** Motivo escrito cuando se elige «Otra». */
  razonOtra: string
  estadoAdulto: EstadoAdultoVisita | ''
  checklist: string[]
  observaciones: string
  evidencias: string[]
  adicionales: FilaAdicional[]
}

type Errores = Partial<Record<keyof Borrador | 'adulto' | 'responsable' | 'razon' | 'detallesAdicionales', string | undefined>>
type ErrorFila = { adulto?: string; observacion?: string }

export function RegistrarVisita() {
  const { user } = useSession()
  const [params] = useSearchParams()
  const location = useLocation()
  const visitaId = params.get('visita') ?? undefined
  const adultoParam = params.get('adulto') ?? undefined
  const visitas = useDB((s) => s.visitas)
  const adultos = useDB((s) => s.adultos)

  const visita = useMemo(() => (visitaId ? visitas.find((v) => v.id === visitaId) : undefined), [visitas, visitaId])
  const adultoFijo = useMemo(() => {
    const id = visita?.adultoId ?? adultoParam
    return id ? adultos.find((a) => a.id === id) : undefined
  }, [adultos, visita, adultoParam])

  // Una vez registrada, la visita pasa a "completada": se recuerda para no mostrar el aviso de "ya cerrada".
  const [registrada, setRegistrada] = useState<{ visita: Visita; offline: boolean; key: string } | null>(null)

  if (!user) return null
  if (registrada && registrada.key === location.key) return <Resultado user={user} visita={registrada.visita} offline={registrada.offline} />
  // Visita o adulto inexistente o fuera del alcance del usuario: mismo mensaje (no revela si existe).
  if ((visitaId && !visita) || ((visitaId || adultoParam) && (!adultoFijo || !alcanzaAdulto(user, adultoFijo)))) return <NoEncontrado titulo={TITULO} />
  if (visita && (visita.estado === 'completada' || visita.estado === 'cancelada')) return <VisitaCerrada visita={visita} />

  const clave = `visita:${user.id}:${visitaId ?? adultoParam ?? 'nueva'}`
  return <Formulario key={clave} clave={clave} user={user} visita={visita} adultoFijo={adultoFijo} onRegistrada={(r) => setRegistrada({ ...r, key: location.key })} />
}

function Formulario({
  clave,
  user,
  visita,
  adultoFijo,
  onRegistrada,
}: {
  clave: string
  user: Usuario
  visita?: Visita
  adultoFijo?: Adulto
  onRegistrada: (r: { visita: Visita; offline: boolean }) => void
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const usuarios = useDB((s) => s.usuarios)
  const vinculos = useDB((s) => s.vinculos)
  const elegibles = useAdultosElegibles('visitas:registrar')
  const eligeResponsable = puede(user, 'visitas:programar')

  // Motivo de una visita programada: se precarga; si no está entre los predefinidos se ofrece como opción propia.
  const razonProgramada = visita?.razon?.trim() || ''
  const razonExtra = razonProgramada && !RAZONES_VISITA.includes(razonProgramada) ? razonProgramada : ''

  const [d, setD, descartar] = useBorrador<Borrador>(clave, {
    adultoId: adultoFijo?.id ?? '',
    fecha: todayISO(),
    hora: hhmm(new Date()),
    responsableId: visita?.cuidadorId ?? user.id,
    razonSel: razonProgramada || RAZON_POR_DEFECTO,
    razonOtra: '',
    estadoAdulto: '',
    checklist: [],
    observaciones: '',
    evidencias: [],
    adicionales: [],
  })
  const [errores, setErrores] = useState<Errores>({})
  const [erroresFilas, setErroresFilas] = useState<ErrorFila[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const adulto = adultoFijo ?? elegibles.find((a) => a.id === d.adultoId)
  const responsable = usuarios.find((u) => u.id === d.responsableId)
  const razon = d.razonSel === RAZON_OTRA ? d.razonOtra : d.razonSel

  const opcionesRazon = useMemo(
    () => [
      ...(razonExtra ? [{ value: razonExtra, label: razonExtra }] : []),
      ...RAZONES_VISITA.map((r) => ({ value: r, label: r })),
      { value: RAZON_OTRA, label: 'Otra…' },
    ],
    [razonExtra],
  )

  // Responsables posibles (coordinador): él mismo y los voluntarios con vínculo «voluntario asignado» con el adulto.
  const responsables = useMemo(() => {
    const ids = new Set([user.id, ...(adulto ? voluntariosDe(vinculos, adulto.id) : []), ...(visita ? [visita.cuidadorId] : [])])
    return usuarios
      .filter((u) => ids.has(u.id) && u.estado === 'activo')
      .map((u) => ({ value: u.id, label: u.id === user.id ? `${nombreCompleto(u)} (yo)` : nombreCompleto(u) }))
  }, [usuarios, vinculos, adulto, visita, user.id])

  // Otros adultos que el usuario puede visitar; primero los que comparten domicilio con el principal (mismo hogar).
  const candidatos = useMemo(() => {
    if (!adulto) return []
    return elegibles
      .filter((a) => a.id !== adulto.id)
      .map((a) => ({ a, hogar: mismoHogar(a, adulto), zona: a.zona === adulto.zona && a.municipioCod === adulto.municipioCod }))
      .sort((x, y) => Number(y.hogar) - Number(x.hogar) || Number(y.zona) - Number(x.zona) || x.a.nombre.localeCompare(y.a.nombre))
  }, [elegibles, adulto])
  // Si cambia el adulto principal, se descartan las filas que ya no son válidas (el propio principal o fuera de alcance).
  const filas = d.adicionales.filter((f) => !f.adultoId || candidatos.some((c) => c.a.id === f.adultoId))

  function set<K extends keyof Borrador>(campo: K, valor: Borrador[K], errorKey: keyof Errores = campo) {
    setD((x) => ({ ...x, [campo]: valor }))
    if (errores[errorKey]) setErrores((x) => ({ ...x, [errorKey]: undefined }))
  }

  function setFila(i: number, cambio: Partial<FilaAdicional>) {
    setD((x) => ({ ...x, adicionales: filas.map((f, j) => (j === i ? { ...f, ...cambio } : f)) }))
    setErroresFilas((x) =>
      x.map((e, j) => (j === i ? { adulto: 'adultoId' in cambio ? undefined : e?.adulto, observacion: 'observacion' in cambio ? undefined : e?.observacion } : e)),
    )
    if (errores.detallesAdicionales) setErrores((x) => ({ ...x, detallesAdicionales: undefined }))
  }
  function agregarFila() {
    // Si hay un adulto en el mismo domicilio que aún no está en la lista, se propone primero.
    const usados = new Set(filas.map((f) => f.adultoId))
    const sugerido = candidatos.find((c) => c.hogar && !usados.has(c.a.id))?.a.id ?? ''
    setD((x) => ({ ...x, adicionales: [...filas, { adultoId: sugerido, observacion: '' }] }))
  }
  function quitarFila(i: number) {
    setD((x) => ({ ...x, adicionales: filas.filter((_, j) => j !== i) }))
    setErroresFilas((x) => x.filter((_, j) => j !== i))
  }

  async function adjuntar(files: FileList | null) {
    if (!files || files.length === 0) return
    setSubiendo(true)
    const nuevas = await procesarEvidencias(files)
    setD((x) => ({ ...x, evidencias: [...x.evidencias, ...nuevas].slice(0, MAX_EVIDENCIAS) }))
    setSubiendo(false)
  }

  function mostrarErrores(errs: Errores, deFilas: ErrorFila[] = []) {
    setErrores(errs)
    setErroresFilas(deFilas)
    requestAnimationFrame(() => document.querySelector('form [role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    if (enviando || subiendo) return
    // Las filas vacías (sin adulto ni observación) se ignoran; las incompletas se señalan junto a su campo.
    const llenas = filas.filter((f) => f.adultoId || f.observacion.trim())
    const datos: DatosVisita = {
      visitaId: visita?.id,
      adultoId: adulto?.id ?? '',
      responsableId: d.responsableId,
      razon,
      detallesAdicionales: llenas,
      fecha: d.fecha,
      hora: d.hora,
      estadoAdulto: d.estadoAdulto,
      observaciones: d.observaciones,
      checklist: d.checklist,
      evidencias: d.evidencias,
    }
    const errFilas: ErrorFila[] = llenas.map((f, i) => ({
      adulto: !f.adultoId ? 'Elige el adulto.' : llenas.findIndex((g) => g.adultoId === f.adultoId) !== i ? 'Este adulto ya está en la lista.' : undefined,
      observacion: f.observacion.trim().length < 3 ? 'Escribe una observación corta.' : undefined,
    }))
    const filasMal = errFilas.some((x) => x.adulto || x.observacion)
    const errs: Errores = {
      ...validarVisita(datos),
      hora: /^\d{2}:\d{2}$/.test(d.hora) ? undefined : 'Indica la hora de la visita.',
    }
    if (filasMal) errs.detallesAdicionales = undefined // ya se indica junto a cada fila
    if (llenas.length !== d.adicionales.length) setD((x) => ({ ...x, adicionales: llenas }))
    if (hayErrores(errs) || filasMal) return mostrarErrores(errs, errFilas)
    setEnviando(true)
    const res = await registrarVisita(user, datos)
    setEnviando(false)
    if (!res.ok) {
      if (res.errores) mostrarErrores(res.errores)
      toast(res.error, 'error')
      return
    }
    descartar()
    onRegistrada({ visita: res.valor, offline: !!res.offline })
  }

  const usadosEn = (i: number) => new Set(filas.filter((_, j) => j !== i).map((f) => f.adultoId))

  return (
    <Page title={TITULO} back>
      <form className="flex flex-col gap-4" onSubmit={registrar} noValidate aria-label="Registro de visita">
        {adultoFijo ? (
          <AdultoHeader adulto={adultoFijo} compacto>
            {visita && (
              <EstadoPunto dot="bg-blue" className="text-sm">
                Visita {visita.estado === 'en_curso' ? 'en curso' : 'programada'} · {hhmmA12(visita.horaPautada)}
              </EstadoPunto>
            )}
          </AdultoHeader>
        ) : (
          <SelectField
            label="Adulto mayor visitado"
            required
            placeholder="Selecciona un adulto"
            value={d.adultoId}
            onChange={(e) => set('adultoId', e.target.value, 'adulto')}
            error={errores.adulto}
            hint={elegibles.length === 0 ? 'No tienes adultos mayores asignados.' : undefined}
            options={elegibles.map((a) => ({ value: a.id, label: nombreCompleto(a) }))}
          />
        )}

        <div className="flex flex-col gap-3">
          <SelectField
            label="Motivo de la visita"
            required
            value={d.razonSel}
            onChange={(e) => set('razonSel', e.target.value, 'razon')}
            error={d.razonSel === RAZON_OTRA ? undefined : errores.razon}
            help={
              razonProgramada
                ? 'Se tomó el motivo con el que se programó la visita. Cámbialo si la visita tuvo otro propósito.'
                : 'Elige el propósito principal de la visita. Si no está en la lista, elige «Otra…» y escríbelo.'
            }
            options={opcionesRazon}
          />
          {d.razonSel === RAZON_OTRA && (
            <TextField
              label="Escribe el motivo"
              required
              maxLength={120}
              placeholder="Ej.: acompañamiento a una diligencia"
              value={d.razonOtra}
              onChange={(e) => set('razonOtra', e.target.value, 'razon')}
              error={errores.razon}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Fecha"
            type="date"
            required
            max={todayISO()}
            value={d.fecha}
            onChange={(e) => set('fecha', e.target.value)}
            error={errores.fecha}
          />
          <TextField label="Hora" type="time" required value={d.hora} onChange={(e) => set('hora', e.target.value)} error={errores.hora} />
        </div>

        {eligeResponsable ? (
          <SelectField
            label="Responsable"
            required
            value={d.responsableId}
            onChange={(e) => set('responsableId', e.target.value, 'responsable')}
            error={errores.responsable}
            help="Por defecto eres tú. Puedes indicar a un voluntario asignado a este adulto si él realizó la visita."
            options={responsables}
          />
        ) : (
          <p className="flex items-center gap-2 -mt-1 text-sm text-ink-2">
            <span className="font-semibold text-ink">Responsable:</span>
            {responsable ? nombreCompleto(responsable) : nombreCompleto(user)} (tú)
          </p>
        )}

        <TileSelect
          label="Estado del adulto"
          required
          value={d.estadoAdulto}
          onChange={(v) => set('estadoAdulto', v)}
          options={ESTADOS_ADULTO}
          error={errores.estadoAdulto}
          help="«Situación crítica» genera una alerta inmediata para el coordinador."
        />

        {/* Dos columnas también en móvil para que el formulario quepa en un desplazamiento (RF-06). */}
        <div className="[&_fieldset>div]:grid-cols-2 [&_legend]:mb-0">
          <CheckboxGroup
            label="Aspectos verificados"
            options={ASPECTOS_VISITA}
            value={d.checklist}
            onChange={(v) => set('checklist', v)}
            error={errores.checklist}
            help="Marca solo lo que comprobaste durante la visita."
          />
        </div>

        {/* Área de texto algo más baja (crece al escribir con el tirador) para caber en un desplazamiento (RF-06). */}
        <div className="[&_textarea]:min-h-[88px]">
          <TextareaAbreviado
            label="Observaciones"
            required
            rows={2}
            maxLength={1000}
            placeholder="Ej.: sn, tomó sus meds, buen ánimo"
            hint="Admite abreviaturas (toca ? para verlas)."
            value={d.observaciones}
            onValueChange={(v) => set('observaciones', v)}
            error={errores.observaciones}
          />
        </div>

        {/* Otros adultos del mismo hogar (DetalleVisita): plegado hasta que se añade el primero. */}
        {adulto && candidatos.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="adicionales-titulo">
            {filas.length === 0 ? (
              <button
                type="button"
                id="adicionales-titulo"
                className="flex items-center justify-between gap-3 min-h-12 px-4 rounded-sm border border-dashed border-blue bg-bg text-left text-navy font-semibold hover:bg-blue-100"
                onClick={agregarFila}
              >
                <span>
                  ¿Visitaste a otro adulto del mismo hogar? <span className="text-muted text-sm font-normal">(opcional)</span>
                </span>
                <UsersRound size={22} className="flex-none" aria-hidden />
              </button>
            ) : (
              <>
                <h3 className="flex items-center gap-2 text-base font-semibold text-ink" id="adicionales-titulo">
                  <UsersRound size={20} className="text-blue" aria-hidden />
                  Otros adultos visitados en el mismo hogar
                </h3>
                {filas.map((f, i) => {
                  const usados = usadosEn(i)
                  const err = erroresFilas[i]
                  return (
                    <div key={i} className="relative flex flex-col gap-3 p-3 pt-1 rounded-sm border border-line-soft bg-surface-2/50" data-testid="fila-adicional">
                      <div className="flex items-center justify-between gap-2 -mr-2">
                        <span className="text-sm font-bold text-ink-2">Adulto adicional {i + 1}</span>
                        <button
                          type="button"
                          className="size-12 grid place-items-center text-muted hover:text-danger"
                          aria-label={`Quitar adulto adicional ${i + 1}`}
                          onClick={() => quitarFila(i)}
                        >
                          <X size={20} aria-hidden />
                        </button>
                      </div>
                      <SelectField
                        label="Adulto mayor"
                        required
                        placeholder="Selecciona un adulto"
                        value={f.adultoId}
                        onChange={(e) => setFila(i, { adultoId: e.target.value })}
                        error={err?.adulto}
                        options={candidatos
                          .filter((c) => !usados.has(c.a.id))
                          .map((c) => ({ value: c.a.id, label: `${nombreCompleto(c.a)}${c.hogar ? ' · mismo domicilio' : ''}` }))}
                      />
                      <TextField
                        label="Observación"
                        required
                        maxLength={300}
                        placeholder="Ej.: buen estado general"
                        value={f.observacion}
                        onChange={(e) => setFila(i, { observacion: e.target.value })}
                        error={err?.observacion}
                      />
                    </div>
                  )
                })}
                {filas.length < Math.min(MAX_ADICIONALES, candidatos.length) && (
                  <Button variant="ghost" size="sm" icon={<Plus size={18} aria-hidden />} onClick={agregarFila}>
                    Añadir otro adulto
                  </Button>
                )}
              </>
            )}
            {errores.detallesAdicionales && (
              <p className="text-danger text-sm" role="alert">
                {errores.detallesAdicionales}
              </p>
            )}
          </section>
        )}

        <div className="flex flex-col gap-3">
          <label
            className={
              'flex items-center justify-between gap-3 min-h-12 px-4 rounded-sm border border-line-soft bg-surface-2 text-ink-2 cursor-pointer ' +
              'hover:border-navy hover:text-navy has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue has-[:disabled]:opacity-55 has-[:disabled]:cursor-not-allowed'
            }
          >
            <span>
              {subiendo ? 'Procesando…' : 'Adjuntar evidencias'} <span className="text-muted text-sm">(opcional · máx. {MAX_EVIDENCIAS})</span>
            </span>
            <Paperclip size={22} aria-hidden />
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="sr-only"
              disabled={d.evidencias.length >= MAX_EVIDENCIAS}
              onChange={(e) => {
                void adjuntar(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          <EvidenciasLista compacta items={d.evidencias} onQuitar={(i) => set('evidencias', d.evidencias.filter((_, j) => j !== i))} />
        </div>

        {!enLinea && (
          <p className="text-sm text-warning-700 font-semibold" role="status">
            Sin conexión: la visita se guardará en el dispositivo y se enviará sola al volver la conexión.
          </p>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:[&>*]:flex-1">
          <Button type="submit" variant={eligeResponsable ? 'primary' : 'soft'} fullWidth loading={enviando} disabled={subiendo}>
            Registrar visita
          </Button>
          {eligeResponsable && (
            <Button variant="outline" fullWidth onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </Page>
  )
}

/** Tras registrar: confirmación (SuccessOverlay), resumen y siguiente paso sugerido (registrar una necesidad detectada en la visita, CU-07). */
function Resultado({ visita, offline, user }: { visita: Visita; offline: boolean; user: Usuario }) {
  const { base } = useShell()
  const adultos = useDB((s) => s.adultos)
  const visitas = useDB((s) => s.visitas)
  const adulto = adultos.find((a) => a.id === visita.adultoId)
  const puedeNecesidad = !!adulto && puede(user, 'necesidades:registrar', adulto)
  const [overlay, setOverlay] = useState(true)
  // Estado actual en la vista: al sincronizarse deja de estar pendiente aunque la pantalla siga abierta.
  const actual = visitas.find((v) => v.id === visita.id)
  const pendiente = offline && (actual ? !!actual.pendienteSync : true)
  return (
    <Page title="Visita registrada" back={adulto ? `${base}/adultos/${adulto.id}` : base}>
      <Card className="flex flex-col items-center gap-3 py-6 text-center">
        <CircleCheckBig size={48} className="text-success-700" aria-hidden />
        <h2 className="text-xl font-bold text-ink">Visita registrada correctamente</h2>
        {adulto && <p className="text-ink-2">{nombreCompleto(adulto)}</p>}
        {visita.detallesAdicionales.length > 0 && (
          <p className="text-sm text-ink-2">
            También se registró a{' '}
            {visita.detallesAdicionales
              .map((x) => {
                const otro = adultos.find((a) => a.id === x.adultoId)
                return otro ? nombreCompleto(otro) : 'otro adulto'
              })
              .join(', ')}
            .
          </p>
        )}
        {pendiente ? (
          <>
            <SyncBadge />
            <p className="text-sm text-ink-2">Se guardó en este dispositivo y se enviará automáticamente cuando vuelva la conexión.</p>
          </>
        ) : (
          <p className="text-sm text-ink-2" data-testid="visita-sincronizada">
            {offline ? 'Ya se sincronizó con el servidor y aparece en el historial de visitas del adulto mayor.' : 'Ya aparece en el historial de visitas del adulto mayor.'}
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-3">
        {puedeNecesidad && (
          <>
            <p className="text-base font-semibold text-ink">¿Detectaste alguna necesidad durante la visita?</p>
            <ButtonLink variant="soft" fullWidth to={`${base}/necesidades/nueva?adulto=${visita.adultoId}&visita=${visita.id}`} replace>
              Registrar necesidad
            </ButtonLink>
          </>
        )}
        <ButtonLink variant="outline" fullWidth to={`${base}/visitas/${visita.id}`} replace>
          Ver la visita
        </ButtonLink>
        {adulto && (
          <ButtonLink variant="ghost" fullWidth to={`${base}/adultos/${adulto.id}`} replace>
            Volver al perfil de {adulto.nombre}
          </ButtonLink>
        )}
      </div>

      <SuccessOverlay
        open={overlay}
        message="Visita registrada correctamente"
        icon={<Laugh size={72} strokeWidth={1.6} aria-hidden />}
        detail={offline ? DETALLE_OFFLINE : undefined}
        duration={offline ? 3000 : 2200}
        onDone={() => setOverlay(false)}
      />
    </Page>
  )
}

function VisitaCerrada({ visita }: { visita: Visita }) {
  const { base } = useShell()
  return (
    <Page title={TITULO} back>
      <div className="min-h-[40vh] grid place-items-center">
        <EmptyState
          title="Esta visita ya fue cerrada"
          text="Ya no se puede registrar de nuevo."
          action={
            <ButtonLink variant="outline" size="sm" to={`${base}/visitas/${visita.id}`} replace>
              Ver detalle
            </ButtonLink>
          }
        />
      </div>
    </Page>
  )
}
