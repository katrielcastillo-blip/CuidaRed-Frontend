/*
 * TareaDetallePage.tsx — Detalle de una tarea de la agenda (Tarea_agenda) y sus evidencias (Evidencias).
 *  - Todos los campos de la tarea: adulto, cuidador (usuario + tipo de cuidado), indicación relacionada,
 *    fecha y hora programadas, prioridad, estado, requiere evidencia, repetitiva y quién la creó (User_creador).
 *  - Acciones de estado con cambiarEstadoTarea: Iniciar y Completar (cuidador asignado o quien gestiona la
 *    agenda) y Cancelar (solo agenda:gestionar).
 *  - Evidencias: lista (miniatura o nombre de archivo, fecha de registro, observación, estado de validación,
 *    quién la registró y quién la validó), "Agregar evidencia" (registrarEvidencia) y validar/rechazar
 *    (validarEvidencia, permiso evidencias:validar).
 * Si el usuario no alcanza la tarea → "No encontrado o sin permiso".
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Ban, Camera, CircleCheck, CircleX, Clock, FileText, Paperclip, Pencil, Pill, Play, Repeat, Upload, WifiOff } from 'lucide-react'
import { Badge, Button, ButtonLink, Sheet, Spinner, TextareaField, useToast } from '@/components/ui'
import { cambiarEstadoTarea, registrarEvidencia, validarEvidencia } from '@/domain/api'
import { nombreCompleto } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, fechaHora, todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import type { EstadoTarea, Evidencia } from '@/domain/types'
import { esMiniatura, procesarEvidencias } from '@/features/visitas/lib/evidencias'
import { Page, useShell } from '@/layouts/AppShell'
import { useBorrador } from '@/lib/useBorrador'
import { NoEncontrado } from '../components/NoEncontrado'
import { cuandoTarea, ESTADO_EVIDENCIA, ESTADO_TAREA, evidenciaValida, horaTarea, PRIORIDAD, tareaAbierta, useAgenda } from '../lib/agenda'

const MAX_OBSERVACION = 300

export default function TareaDetallePage() {
  const { tareaId } = useParams()
  const { base } = useShell()
  const toast = useToast()
  const enLinea = useEnLinea()
  const { user, tareas, evidencias, adultoPorId, cuidadorPorId, indicacionPorId, nombreDe, veIndicacion, vinculos, catalogos } = useAgenda()

  const tarea = tareas.find((t) => t.id === tareaId)
  const susEvidencias = useMemo(
    () => evidencias.filter((e) => e.tareaId === tareaId).sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro)),
    [evidencias, tareaId],
  )

  const [nueva, setNueva, descartarNueva] = useBorrador<{ archivo: string; nombre: string; observacion: string }>(`evidencia:${tareaId}:${user.id}`, {
    archivo: '',
    nombre: '',
    observacion: '',
  })
  const [errEv, setErrEv] = useState<{ archivo?: string; observacion?: string }>({})
  const [procesando, setProcesando] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!tarea) return <NoEncontrado titulo="Detalle de tarea" />

  const adulto = adultoPorId.get(tarea.adultoId)
  const cuidador = cuidadorPorId.get(tarea.cuidadorId)
  const indicacion = tarea.indicacionId && veIndicacion(tarea) ? indicacionPorId.get(tarea.indicacionId) : undefined
  const tipoIndicacion = indicacion ? catalogos.tiposIndicacion.find((t) => t.id === indicacion.tipoIndicacionId)?.nombre : undefined

  const gestiona = puede(user, 'agenda:gestionar', adulto, vinculos)
  const esMia = cuidador?.usuarioId === user.id
  const ejecuta = puede(user, 'agenda:ejecutar') && esMia
  const opera = gestiona || ejecuta
  const valida = puede(user, 'evidencias:validar', adulto, vinculos)
  const abierta = tareaAbierta(tarea)
  const faltaEvidencia = tarea.requiereEvidencia && !susEvidencias.some(evidenciaValida)
  const estado = ESTADO_TAREA[tarea.estado]
  const prioridad = PRIORIDAD[tarea.prioridad]
  const vencida = abierta && tarea.fechaProgramada < todayISO()

  const cambiar = (nuevo: EstadoTarea) => {
    const r = cambiarEstadoTarea(user, tarea.id, nuevo)
    if (!r.ok) return toast(r.error, 'error')
    const textos: Record<EstadoTarea, string> = {
      pendiente: 'Tarea reabierta.',
      en_curso: 'Tarea iniciada.',
      completada: tarea.repetitiva ? 'Tarea completada. Se programó la de mañana.' : 'Tarea completada.',
      cancelada: 'Tarea cancelada.',
    }
    toast(textos[nuevo], 'ok')
  }

  const elegirArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 15 * 1024 * 1024) {
      setErrEv((x) => ({ ...x, archivo: 'El archivo es demasiado grande (máximo 15 MB).' }))
      return
    }
    setProcesando(true)
    try {
      const [archivo] = await procesarEvidencias([f])
      setNueva((n) => ({ ...n, archivo: archivo ?? f.name, nombre: f.name }))
      setErrEv((x) => ({ ...x, archivo: undefined }))
    } finally {
      setProcesando(false)
    }
  }

  const guardarEvidencia = () => {
    const r = registrarEvidencia(user, tarea.id, nueva.archivo, nueva.observacion)
    if (!r.ok) {
      setErrEv((r.errores as typeof errEv | undefined) ?? {})
      return toast(r.error, 'error')
    }
    descartarNueva()
    setNueva({ archivo: '', nombre: '', observacion: '' })
    setErrEv({})
    toast(tarea.requiereEvidencia && abierta ? 'Evidencia guardada. Ya puedes completar la tarea.' : 'Evidencia guardada.', 'ok')
  }

  const decidir = (ev: Evidencia, decision: 'validada' | 'rechazada') => {
    const r = validarEvidencia(user, ev.id, decision)
    if (!r.ok) return toast(r.error, 'error')
    toast(decision === 'validada' ? 'Evidencia validada.' : 'Evidencia rechazada. El cuidador deberá adjuntar otra.', decision === 'validada' ? 'ok' : 'info')
  }

  return (
    <Page title="Detalle de tarea" back={`${base}/agenda`} wide>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-8 lg:items-start">
        {/* ───────── Tarea ───────── */}
        <section className="flex flex-col gap-5 min-w-0" aria-labelledby="tarea-titulo">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {vencida ? <Badge tone="danger">Vencida</Badge> : <Badge tone={estado.tono}>{estado.label}</Badge>}
              <Badge tone={prioridad.tono}>{prioridad.label}</Badge>
            </div>
            <h2 id="tarea-titulo" className="text-2xl font-bold leading-tight text-ink wrap-anywhere">
              {tarea.titulo}
            </h2>
            <p className="flex items-center gap-2 text-lg font-semibold text-navy">
              <Clock size={20} aria-hidden /> {cuandoTarea(tarea)}
            </p>
          </header>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-4 p-4 rounded-sm border border-line bg-bg">
            <Dato etiqueta="Adulto mayor">
              {adulto ? (
                <Link
                  to={`${base}/adultos/${adulto.id}`}
                  className="inline-flex items-center min-h-12 -my-3 font-bold text-navy underline-offset-2 hover:underline"
                >
                  {nombreCompleto(adulto)}
                </Link>
              ) : (
                'Adulto mayor'
              )}
            </Dato>
            <Dato etiqueta="Cuidador asignado">
              {cuidador ? (
                <>
                  {cuidador.nombre}
                  {esMia && <span className="font-normal text-muted"> (tú)</span>}
                  <span className="block text-sm font-normal text-muted">{cuidador.tipo}</span>
                </>
              ) : (
                'No disponible'
              )}
            </Dato>
            <Dato etiqueta="Fecha programada">{fechaCorta(tarea.fechaProgramada)}</Dato>
            <Dato etiqueta="Hora programada">{horaTarea(tarea.horaProgramada)}</Dato>
            <Dato etiqueta="Requiere evidencia">
              <span className="inline-flex items-center gap-1.5">
                <Camera size={18} className="text-navy" aria-hidden /> {tarea.requiereEvidencia ? 'Sí' : 'No'}
              </span>
            </Dato>
            <Dato etiqueta="Tarea repetitiva">
              <span className="inline-flex items-center gap-1.5">
                <Repeat size={18} className="text-navy" aria-hidden /> {tarea.repetitiva ? 'Sí, a diario' : 'No'}
              </span>
            </Dato>
            <Dato etiqueta="Creada por">{nombreDe(tarea.creadaPor)}</Dato>
            <Dato etiqueta="Última actualización">{fechaHora(tarea.actualizadoEn)}</Dato>
          </dl>

          {indicacion && (
            <section className="flex flex-col gap-2 p-4 rounded-sm bg-blue-100 border border-blue" aria-labelledby="tarea-indicacion">
              <h3 id="tarea-indicacion" className="flex items-center gap-2 text-base font-bold text-ink">
                <Pill size={20} className="text-navy" aria-hidden /> Indicación médica relacionada
              </h3>
              <p className="text-base font-semibold text-ink wrap-anywhere">
                {indicacion.titulo} {tipoIndicacion && <span className="font-normal text-muted">· {tipoIndicacion}</span>}
              </p>
              <p className="text-sm text-ink-2 wrap-anywhere">{indicacion.descripcion}</p>
              <p className="text-sm text-ink-2">
                <strong>Frecuencia u horario:</strong> {indicacion.frecuenciaHorario}
              </p>
              {indicacion.estado !== 'vigente' && <Badge tone="neutral">Indicación {indicacion.estado}</Badge>}
            </section>
          )}

          {/* ───── Acciones de estado ───── */}
          {opera && abierta && (
            <section className="flex flex-col gap-3" aria-label="Acciones de la tarea">
              {!enLinea && <SinConexion />}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {tarea.estado === 'pendiente' && (
                  <Button variant="outline" disabled={!enLinea} onClick={() => cambiar('en_curso')} icon={<Play size={20} aria-hidden />} className="sm:flex-1">
                    Iniciar tarea
                  </Button>
                )}
                <Button
                  disabled={!enLinea || faltaEvidencia}
                  onClick={() => cambiar('completada')}
                  icon={<CircleCheck size={22} aria-hidden />}
                  className="sm:flex-1"
                >
                  Completar tarea
                </Button>
              </div>
              {faltaEvidencia && (
                <p className="flex items-start gap-2 text-sm text-warning-700 font-semibold">
                  <Camera size={18} className="flex-none mt-px" aria-hidden />
                  Esta tarea requiere evidencia: adjunta una foto o documento antes de completarla.
                </p>
              )}
              {gestiona && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ButtonLink to={`${base}/agenda/${tarea.id}/editar`} variant="light" size="sm" icon={<Pencil size={18} aria-hidden />} className="sm:flex-1">
                    Editar tarea
                  </ButtonLink>
                  <Button
                    variant="danger-soft"
                    size="sm"
                    disabled={!enLinea}
                    onClick={() => setConfirmarCancelar(true)}
                    icon={<Ban size={18} aria-hidden />}
                    className="sm:flex-1"
                  >
                    Cancelar tarea
                  </Button>
                </div>
              )}
            </section>
          )}
          {!abierta && (
            <p className="p-4 rounded-sm bg-surface-2 text-sm text-ink-2">
              {tarea.estado === 'completada' ? 'Tarea completada.' : 'Esta tarea fue cancelada.'} Última actualización: {fechaHora(tarea.actualizadoEn)}
            </p>
          )}
          {!opera && abierta && <p className="text-sm text-muted">Solo el cuidador asignado o la coordinación pueden cambiar el estado de esta tarea.</p>}
        </section>

        {/* ───────── Evidencias ───────── */}
        <section className="flex flex-col gap-4 min-w-0" aria-labelledby="tarea-evidencias">
          <div className="flex items-center justify-between gap-3">
            <h2 id="tarea-evidencias" className="text-xl font-bold text-ink">
              Evidencias <span className="text-base font-normal text-muted">({susEvidencias.length})</span>
            </h2>
          </div>

          {susEvidencias.length === 0 ? (
            <div className="flex items-center justify-between gap-3 min-h-12 px-4 py-3 rounded-sm bg-surface-2 border border-line-soft text-muted">
              <span>{tarea.requiereEvidencia ? 'Aún no se ha adjuntado la evidencia requerida.' : 'Sin evidencias.'}</span>
              <Paperclip size={22} aria-hidden />
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {susEvidencias.map((e, i) => {
                const est = ESTADO_EVIDENCIA[e.estadoValidacion]
                return (
                  <li key={e.id} className="flex flex-col gap-3 p-3 rounded-sm border border-line bg-bg">
                    <div className="flex items-start gap-3">
                      {esMiniatura(e.archivo) ? (
                        <img
                          src={e.archivo}
                          alt={`Evidencia ${susEvidencias.length - i}: ${e.observacion ?? 'foto adjunta'}`}
                          className="size-20 flex-none rounded-sm object-cover border border-line-soft"
                        />
                      ) : (
                        <span className="grid place-items-center size-20 flex-none rounded-sm bg-surface-2 text-navy">
                          <FileText size={32} aria-hidden />
                        </span>
                      )}
                      <div className="flex flex-col flex-1 min-w-0 gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={est.tono}>{est.label}</Badge>
                          <span className="text-xs text-muted">{fechaHora(e.fechaRegistro)}</span>
                        </div>
                        {!esMiniatura(e.archivo) && <span className="text-sm font-semibold text-ink wrap-anywhere">{e.archivo}</span>}
                        <p className="text-sm text-ink-2 wrap-anywhere">{e.observacion || <span className="text-muted">Sin observación.</span>}</p>
                        <p className="text-xs text-muted">
                          Registrada por {nombreDe(e.registradaPor)}
                          {e.validadaPor && ` · ${e.estadoValidacion === 'rechazada' ? 'Rechazada' : 'Validada'} por ${nombreDe(e.validadaPor)}`}
                        </p>
                      </div>
                    </div>
                    {valida && e.estadoValidacion === 'pendiente' && (
                      <div className="flex gap-2">
                        <Button
                          variant="soft"
                          size="sm"
                          className="flex-1 text-base"
                          disabled={!enLinea}
                          onClick={() => decidir(e, 'validada')}
                          icon={<CircleCheck size={18} aria-hidden />}
                        >
                          Validar
                        </Button>
                        <Button
                          variant="danger-soft"
                          size="sm"
                          className="flex-1 text-base"
                          disabled={!enLinea}
                          onClick={() => decidir(e, 'rechazada')}
                          icon={<CircleX size={18} aria-hidden />}
                        >
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {/* ───── Agregar evidencia ───── */}
          {opera && tarea.estado !== 'cancelada' && (
            <div className="flex flex-col gap-4 p-4 rounded-sm bg-blue-100 border border-blue">
              <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                <Upload size={20} className="text-navy" aria-hidden /> Agregar evidencia
              </h3>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                id="evidencia-archivo"
                onChange={elegirArchivo}
                tabIndex={-1}
                aria-hidden
              />
              {nueva.archivo ? (
                <div className="flex items-center gap-3 p-2 rounded-sm bg-bg border border-line-soft">
                  {esMiniatura(nueva.archivo) ? (
                    <img src={nueva.archivo} alt="Vista previa de la evidencia" className="size-16 flex-none rounded-sm object-cover" />
                  ) : (
                    <FileText size={28} className="flex-none text-navy" aria-hidden />
                  )}
                  <span className="flex-1 min-w-0 text-sm font-semibold text-ink wrap-anywhere">{nueva.nombre || nueva.archivo}</span>
                  <Button variant="ghost" size="sm" onClick={() => setNueva((n) => ({ ...n, archivo: '', nombre: '' }))} aria-label="Quitar archivo">
                    Quitar
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                    disabled={procesando}
                    icon={procesando ? <Spinner /> : <Camera size={20} aria-hidden />}
                  >
                    {procesando ? 'Procesando…' : 'Tomar foto o elegir archivo'}
                  </Button>
                  {errEv.archivo ? (
                    <p className="text-sm text-danger" role="alert">
                      {errEv.archivo}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">Foto (se reduce para ahorrar espacio) o documento PDF.</p>
                  )}
                </div>
              )}
              <TextareaField
                label="Observación"
                className="min-h-[96px] bg-bg"
                maxLength={MAX_OBSERVACION}
                placeholder="Ej.: Tomó la tableta a las 8:05 a.m."
                value={nueva.observacion}
                onChange={(e) => {
                  setNueva((n) => ({ ...n, observacion: e.target.value }))
                  setErrEv((x) => ({ ...x, observacion: undefined }))
                }}
                error={errEv.observacion}
                hint={`Opcional · ${nueva.observacion.length}/${MAX_OBSERVACION}`}
                help="Describe brevemente lo que muestra la evidencia. La coordinación la revisará y la marcará como validada o rechazada."
              />
              {!enLinea && <SinConexion />}
              <Button onClick={guardarEvidencia} disabled={!enLinea || !nueva.archivo || procesando} icon={<Upload size={20} aria-hidden />}>
                Guardar evidencia
              </Button>
            </div>
          )}
        </section>
      </div>

      <Sheet
        open={confirmarCancelar}
        onClose={() => setConfirmarCancelar(false)}
        title="¿Cancelar la tarea?"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmarCancelar(false)}>
              Volver
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setConfirmarCancelar(false)
                cambiar('cancelada')
              }}
            >
              Sí, cancelar
            </Button>
          </>
        }
      >
        <p className="text-ink-2">
          «{tarea.titulo}» dejará de aparecer en la agenda de {cuidador?.nombre ?? 'el cuidador'}.
          {tarea.repetitiva && ' Al ser repetitiva, no se programarán más repeticiones.'}
        </p>
      </Sheet>
    </Page>
  )
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</dt>
      <dd className="text-base font-bold text-ink wrap-anywhere">{children}</dd>
    </div>
  )
}

function SinConexion() {
  return (
    <p role="status" className="flex items-start gap-2 p-3 rounded-sm bg-warning-100 border border-warning text-sm text-ink">
      <WifiOff size={18} className="flex-none mt-0.5 text-warning-700" aria-hidden />
      Sin conexión: los cambios de la agenda necesitan internet. Inténtalo al recuperar la conexión.
    </p>
  )
}
