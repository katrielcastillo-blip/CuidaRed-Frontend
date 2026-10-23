/*
 * DetalleNecesidad.tsx — Detalle de una necesidad (CU-08 · RF-03). Muestra todas las columnas de Env_Necesidad:
 * categoría y necesidad del catálogo, descripción, cantidad y unidad, prioridad, recurrente, responsable
 * (User_responsable), indicación médica relacionada, umbral de alerta, fecha y motivo de resolución, más el
 * historial de estados. Quien tiene `necesidades:actualizar` cambia el estado (motivo obligatorio al resolver)
 * y asigna el responsable; funciona sin conexión. Familiar y administrador: solo lectura.
 * Módulo: visitas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { nombreCompleto, ROL_LABEL, useSession } from '@/domain/auth'
import { cambiarEstadoNecesidad } from '@/domain/api'
import { diasCalendario, fechaCorta, fechaHora, hora12 } from '@/domain/dates'
import { alcanzaAdulto, puede } from '@/domain/permisos'
import { configOrg, nombreUsuario } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto, EstadoNecesidad, Necesidad, Usuario } from '@/domain/types'
import { Badge, Button, Datum, RiesgoBadge, SelectField, TextareaField, useToast } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { Caja, EstadoPunto, NoEncontrado, SyncBadge } from '../components/Comun'
import { ACCION_ESTADO_NECESIDAD, ESTADO_NECESIDAD, prioridad, resuelve, TRANSICIONES_NECESIDAD, tipoNecesidad, vistaNecesidad } from '../lib/dominio'

const TITULO = 'Detalle de necesidad'
const MSJ_OFFLINE = 'Guardado en el dispositivo · Pendiente de sincronización'

export function DetalleNecesidad() {
  const { necesidadId } = useParams()
  const { user } = useSession()
  const necesidades = useDB((s) => s.necesidades)
  const adultos = useDB((s) => s.adultos)
  const necesidad = useMemo(() => necesidades.find((n) => n.id === necesidadId), [necesidades, necesidadId])
  const adulto = useMemo(() => adultos.find((a) => a.id === necesidad?.adultoId), [adultos, necesidad])

  if (!user) return null
  if (!necesidad || !adulto || !puede(user, 'necesidades:ver') || !alcanzaAdulto(user, adulto)) return <NoEncontrado titulo={TITULO} />
  return <Contenido necesidad={necesidad} adulto={adulto} user={user} />
}

function Contenido({ necesidad, adulto, user }: { necesidad: Necesidad; adulto: Adulto; user: Usuario }) {
  const { base } = useShell()
  const usuarios = useDB((s) => s.usuarios)
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  const indicaciones = useDB((s) => s.indicaciones)
  const nombreDe = (id: string | undefined) => nombreUsuario(usuarios, id)

  const tipo = tipoNecesidad(necesidad.tipo)
  const estado = vistaNecesidad(necesidad)
  const prio = prioridad(necesidad.prioridad)
  const puedeActualizar = puede(user, 'necesidades:actualizar', adulto)
  const verIndicacion = puede(user, 'indicaciones:ver', adulto)
  const delCatalogo = catalogos.necesidades.find((n) => n.id === necesidad.catalogoId)
  const indicacion = necesidad.indicacionId ? indicaciones.find((i) => i.id === necesidad.indicacionId) : undefined

  // Umbral_alerta: el de la necesidad o, si no se fijó, el de la organización (parámetro DIAS_ESCALAR_NECESIDAD).
  const umbralPropio = necesidad.umbralAlertaDias
  const umbral = umbralPropio ?? configOrg({ catalogos, configuracion }, adulto.orgId).diasEscalarNecesidad
  const abierta = !resuelve(necesidad.estado)
  const diasAbierta = diasCalendario(necesidad.creadaEn)
  const atrasada = abierta && diasAbierta > umbral

  // Historial del más reciente al más antiguo. Los registros antiguos sin historial muestran al menos su creación.
  const historial = useMemo(() => {
    const h = necesidad.historial?.length ? necesidad.historial : [{ estado: 'pendiente' as const, fecha: necesidad.creadaEn, usuarioId: necesidad.registradaPor }]
    return [...h].sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [necesidad])

  return (
    <Page title={TITULO} back wide>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        {/* Tarjeta azul clara con medallón que sobresale por arriba. */}
        <article className="mt-11 flex flex-col gap-4 px-5 pb-6 rounded-sm bg-blue-100 md:px-8">
          <span className="self-center flex-none size-[90px] -mt-11 grid place-items-center rounded-full bg-blue-100 text-blue">
            <tipo.icon size={47} strokeWidth={1.5} aria-hidden />
          </span>
          <div className="-mt-2 pb-4 flex flex-col items-center gap-1 text-center border-b border-blue">
            <h2 className="text-xl font-bold text-blue">{tipo.label}</h2>
            {delCatalogo && <p className="text-base font-semibold text-ink">{delCatalogo.nombre}</p>}
          </div>

          <div className="flex flex-col items-center gap-2 pb-4 text-center border-b border-blue">
            <h3 className="text-2xl font-medium text-ink wrap-anywhere">{nombreCompleto(adulto)}</h3>
            <RiesgoBadge riesgo={adulto.riesgo} />
            <Link
              to={`${base}/adultos/${adulto.id}`}
              className="inline-flex items-center min-h-12 px-2 text-sm font-semibold text-navy underline underline-offset-4 hover:text-blue"
            >
              Ver perfil
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <EstadoPunto dot={estado.dot} className="text-lg">
              {estado.label}
            </EstadoPunto>
            <div className="flex flex-wrap gap-2">
              <Badge tone={estado.tone}>{estado.badge}</Badge>
              {atrasada && <Badge tone="danger">ATRASADA</Badge>}
              <SyncBadge visible={!!necesidad.pendienteSync} />
            </div>
          </div>

          <h3 className="text-lg font-bold text-ink">Descripción</h3>
          <Caja>{necesidad.descripcion}</Caja>

          <div className="grid grid-cols-2 gap-4">
            <Datum label="Fecha" value={fechaCorta(necesidad.creadaEn)} />
            <Datum label="Hora" value={hora12(necesidad.creadaEn)} />
            <Datum label="Prioridad" value={<Badge tone={prio.tone}>{prio.label.toUpperCase()}</Badge>} />
            <Datum label="Recurrente" value={necesidad.recurrente ? 'Sí, se repite' : 'No'} />
            <Datum label="Cantidad" value={necesidad.cantidad ? `${necesidad.cantidad} ${necesidad.unidad ?? ''}`.trim() : 'No indicada'} />
            <Datum label="Umbral de alerta" value={`${umbral} día${umbral === 1 ? '' : 's'}${umbralPropio === undefined ? ' (organización)' : ''}`} />
            <div className="col-span-2">
              <Datum label="Responsable" value={necesidad.responsableId ? nombreDe(necesidad.responsableId) : 'Sin asignar'} />
            </div>
            <div className="col-span-2">
              <Datum label="Registrada por" value={nombreDe(necesidad.registradaPor)} />
            </div>
            {necesidad.indicacionId && (
              <div className="col-span-2">
                <Datum
                  label="Indicación médica relacionada"
                  value={
                    !verIndicacion
                      ? 'Sí (información de salud con acceso restringido)'
                      : indicacion
                        ? `${indicacion.titulo} · ${indicacion.frecuenciaHorario}${indicacion.estado !== 'vigente' ? ` (${indicacion.estado})` : ''}`
                        : 'Indicación no disponible'
                  }
                />
              </div>
            )}
            {abierta && (
              <div className="col-span-2">
                <Datum label="Tiempo sin resolver" value={`${diasAbierta} día${diasAbierta === 1 ? '' : 's'}${atrasada ? ' · supera el umbral' : ''}`} />
              </div>
            )}
            {necesidad.visitaId && (
              <div className="col-span-2">
                <Datum
                  label="Detectada en"
                  value={
                    <Link to={`${base}/visitas/${necesidad.visitaId}`} className="inline-flex items-center min-h-12 -my-3 text-navy underline underline-offset-4">
                      Ver la visita
                    </Link>
                  }
                />
              </div>
            )}
          </div>

          {necesidad.satisfechaEn && !abierta && (
            <section className="flex flex-col gap-3 pt-4 border-t border-blue" aria-labelledby="resolucion-titulo">
              <h3 className="text-lg font-bold text-ink" id="resolucion-titulo">
                Resolución
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Datum label="Fecha de resolución" value={fechaHora(necesidad.satisfechaEn)} />
                <Datum label="Resuelta por" value={nombreDe(necesidad.satisfechaPor)} />
              </div>
              <Caja>{necesidad.motivoResolucion?.trim() || 'Sin motivo registrado.'}</Caja>
            </section>
          )}
        </article>

        <div className="flex flex-col gap-6 min-w-0">
          {puedeActualizar && <CambiarEstado key={`${necesidad.id}-${necesidad.estado}`} necesidad={necesidad} user={user} />}
          {puedeActualizar && <AsignarResponsable key={`${necesidad.id}-${necesidad.responsableId ?? ''}`} necesidad={necesidad} user={user} orgId={adulto.orgId} />}

          <section className="flex flex-col gap-3" aria-labelledby="historial-titulo">
            <h2 className="section-title" id="historial-titulo">
              Historial de estados
            </h2>
            <ol className="relative m-0 p-0 list-none flex flex-col gap-4 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-line-soft">
              {historial.map((c, i) => {
                const v = ESTADO_NECESIDAD[c.estado]
                return (
                  <li key={`${c.fecha}-${i}`} className="relative flex gap-3">
                    <span className={cn('relative z-10 mt-1 size-5 flex-none rounded-full border-[3px] border-bg', v.dot)} aria-hidden />
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="font-semibold text-ink">
                        {i === historial.length - 1 && c.estado === 'pendiente' ? 'Registrada como Pendiente' : `Cambió a ${v.label}`}
                      </span>
                      <span className="text-sm text-ink-2">
                        {nombreDe(c.usuarioId)} · {fechaHora(c.fecha)}
                      </span>
                      {c.nota && <span className="text-sm text-ink-2 italic wrap-anywhere">«{c.nota}»</span>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>
      </div>
    </Page>
  )
}

/** Actualizar el estado (CU-08): pendiente → en proceso → satisfecha / inactiva. Al resolver, el motivo es obligatorio. */
function CambiarEstado({ necesidad, user }: { necesidad: Necesidad; user: Usuario }) {
  const toast = useToast()
  const opciones = TRANSICIONES_NECESIDAD[necesidad.estado]
  const [nuevo, setNuevo] = useState<EstadoNecesidad | ''>('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string>()
  const [guardando, setGuardando] = useState(false)
  const exigeMotivo = resuelve(nuevo)

  async function guardar() {
    if (!nuevo) return setError('Elige el nuevo estado.')
    if (exigeMotivo && nota.trim().length < 3) return setError('Indica el motivo de la resolución.')
    setGuardando(true)
    const res = await cambiarEstadoNecesidad(user, necesidad.id, nuevo, nota)
    setGuardando(false)
    if (!res.ok) {
      setError(res.errores?.nota)
      return toast(res.error, 'error')
    }
    toast(
      res.offline ? `Estado: ${ESTADO_NECESIDAD[nuevo].label}. ${MSJ_OFFLINE}` : `Necesidad marcada como «${ESTADO_NECESIDAD[nuevo].label}»`,
      res.offline ? 'info' : 'ok',
    )
    setNuevo('')
    setNota('')
    setError(undefined)
  }

  return (
    <section className="flex flex-col gap-4 p-4 rounded-sm border border-line-soft bg-bg" aria-labelledby="cambiar-titulo">
      <h2 className="text-lg font-bold text-ink" id="cambiar-titulo">
        Actualizar estado
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="cambiar-titulo">
        {opciones.map((e) => {
          const v = ESTADO_NECESIDAD[e]
          const on = nuevo === e
          return (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={on}
              className={cn(
                'flex items-center justify-center gap-2 min-h-12 px-3 rounded-sm border font-semibold',
                on ? 'bg-navy border-navy text-white' : 'bg-bg border-line text-ink-2 hover:border-navy',
              )}
              onClick={() => {
                setNuevo(e)
                setError(undefined)
              }}
            >
              <span className={cn('size-2.5 rounded-full', v.dot, on && 'ring-2 ring-white')} aria-hidden />
              {ACCION_ESTADO_NECESIDAD[e]}
            </button>
          )
        })}
      </div>
      <TextareaField
        label={exigeMotivo ? 'Motivo de la resolución' : 'Nota (opcional)'}
        required={exigeMotivo}
        rows={2}
        maxLength={300}
        placeholder={exigeMotivo ? 'Ej.: se entregó el medicamento donado por la farmacia' : 'Ej.: se está gestionando con la junta de vecinos'}
        help={exigeMotivo ? 'Al marcarla como satisfecha o inactiva, indica cómo se resolvió o por qué se cierra. Queda en el historial.' : undefined}
        value={nota}
        onChange={(e) => {
          setNota(e.target.value)
          if (error) setError(undefined)
        }}
        error={error}
      />
      <Button fullWidth loading={guardando} disabled={!nuevo} onClick={guardar}>
        Guardar cambio de estado
      </Button>
    </section>
  )
}

/** Asignar o cambiar el responsable de gestionarla (Env_Necesidad.User_responsable). */
function AsignarResponsable({ necesidad, user, orgId }: { necesidad: Necesidad; user: Usuario; orgId: string }) {
  const toast = useToast()
  const usuarios = useDB((s) => s.usuarios)
  const [sel, setSel] = useState(necesidad.responsableId ?? '')
  const [guardando, setGuardando] = useState(false)

  const opciones = useMemo(
    () =>
      usuarios
        .filter((u) => u.orgId === orgId && u.estado === 'activo' && (u.rol === 'coordinador' || u.rol === 'admin' || u.rol === 'voluntario'))
        .sort((a, b) => a.rol.localeCompare(b.rol) || a.nombre.localeCompare(b.nombre))
        .map((u) => ({ value: u.id, label: `${nombreCompleto(u)} · ${ROL_LABEL[u.rol]}${u.id === user.id ? ' (yo)' : ''}` })),
    [usuarios, orgId, user.id],
  )

  async function asignar() {
    setGuardando(true)
    const res = await cambiarEstadoNecesidad(user, necesidad.id, necesidad.estado, '', sel)
    setGuardando(false)
    if (!res.ok) return toast(res.error, 'error')
    toast(res.offline ? `Responsable actualizado. ${MSJ_OFFLINE}` : sel ? 'Responsable asignado' : 'Responsable quitado', res.offline ? 'info' : 'ok')
  }

  return (
    <section className="flex flex-col gap-4 p-4 rounded-sm border border-line-soft bg-bg" aria-labelledby="responsable-titulo">
      <h2 className="text-lg font-bold text-ink" id="responsable-titulo">
        Responsable
      </h2>
      <SelectField
        label="Persona a cargo de gestionarla"
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        help="Quién se encarga de conseguir el apoyo o darle seguimiento. Puede ser un coordinador, un administrador o un voluntario de la organización."
        options={[{ value: '', label: 'Sin asignar' }, ...opciones]}
      />
      <Button variant="outline" fullWidth loading={guardando} disabled={sel === (necesidad.responsableId ?? '')} onClick={asignar}>
        {sel ? 'Asignar responsable' : 'Quitar responsable'}
      </Button>
    </section>
  )
}
