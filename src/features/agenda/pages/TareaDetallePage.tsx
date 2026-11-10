/*
 * TareaDetallePage.tsx — Detalle de una tarea de la agenda (Tarea_agenda) y sus evidencias (Evidencias).
 *  - Todos los campos de la tarea: adulto, cuidador (usuario + tipo de cuidado), indicación relacionada, fecha y
 *    hora programadas, prioridad, estado, requiere evidencia, serie (ocurrencia N de M) y quién la creó (User_creador).
 *  - Acciones de estado con cambiarEstadoTarea: Iniciar y Completar (cuidador asignado o quien gestiona la agenda;
 *    una tarea que requiere evidencia solo se completa con una evidencia validada) y Cancelar (solo agenda:gestionar,
 *    esta o esta y las siguientes de la serie).
 *  - Evidencias: situación (sin adjuntar · por validar · validada · rechazada con su motivo), lista con miniatura
 *    ampliable, "Agregar evidencia" (tomar foto / elegir archivo, RS-013) y Validar / Rechazar con motivo
 *    (permiso evidencias:validar).
 * Si el usuario no alcanza la tarea → "No encontrado o sin permiso".
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Ban, Camera, CircleCheck, CircleX, Clock, Hourglass, Paperclip, Pencil, Pill, Play, Repeat, ShieldCheck, WifiOff } from 'lucide-react'
import { Badge, Button, ButtonLink, ChoicePills, Sheet } from '@/components/ui'
import { EVIDENCIA_MAX_POR_TAREA, motivoSinEvidenciaValidada, ocurrenciasDeSerie, siguientesDeSerie } from '@/domain/api'
import { nombreCompleto } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, fechaHora, todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { Page, useShell } from '@/layouts/AppShell'
import { AdjuntarEvidencia } from '../components/AdjuntarEvidencia'
import { EvidenciaItem } from '../components/EvidenciaItem'
import { NoEncontrado } from '../components/NoEncontrado'
import { useAccionesTarea } from '../lib/acciones'
import { cuandoTarea, ESTADO_TAREA, horaTarea, PRIORIDAD, rechazoVigente, situacionEvidencia, tareaAbierta, useAgenda } from '../lib/agenda'

export default function TareaDetallePage() {
  const { tareaId } = useParams()
  const { hash } = useLocation()
  const { base } = useShell()
  const enLinea = useEnLinea()
  const { user, tareas, evidencias, adultoPorId, cuidadorPorId, indicacionPorId, nombreDe, veIndicacion, vinculos, catalogos } = useAgenda()
  const { cambiar, cancelar, validar, rechazar } = useAccionesTarea()

  const tarea = tareas.find((t) => t.id === tareaId)
  const susEvidencias = useMemo(
    () => evidencias.filter((e) => e.tareaId === tareaId).sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro)),
    [evidencias, tareaId],
  )
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [alcance, setAlcance] = useState<'esta' | 'siguientes'>('esta')

  // Desde las tarjetas de la agenda ("Adjuntar evidencia") se llega directo a la sección de evidencias.
  useEffect(() => {
    if (hash !== '#evidencias' || !tarea) return
    document.getElementById('evidencias')?.scrollIntoView({ block: 'start' })
  }, [hash, tarea])

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
  const situacion = situacionEvidencia(susEvidencias)
  const motivoBloqueo = motivoSinEvidenciaValidada(tarea, susEvidencias)
  const rechazo = tarea.requiereEvidencia && abierta ? rechazoVigente(susEvidencias) : undefined
  const estado = ESTADO_TAREA[tarea.estado]
  const prioridad = PRIORIDAD[tarea.prioridad]
  const vencida = abierta && tarea.fechaProgramada < todayISO()
  const vigentes = susEvidencias.filter((e) => e.estadoValidacion !== 'rechazada').length

  const serie = ocurrenciasDeSerie(tareas, tarea)
  const siguientes = siguientesDeSerie(tareas, tarea)
  const cuantasSiguientes = siguientes.length - 1
  const posicion = serie.findIndex((t) => t.id === tarea.id) + 1

  const confirmar = () => {
    setConfirmarCancelar(false)
    cancelar(tarea, alcance)
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
            <Dato etiqueta="Se repite">
              <span className="inline-flex items-center gap-1.5">
                <Repeat size={18} className="text-navy" aria-hidden />
                {tarea.repetitiva ? (serie.length > 1 ? `Sí · ${posicion} de ${serie.length}` : 'Sí') : 'No'}
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
                  <Button variant="outline" disabled={!enLinea} onClick={() => cambiar(tarea, 'en_curso')} icon={<Play size={20} aria-hidden />} className="sm:flex-1">
                    Iniciar tarea
                  </Button>
                )}
                <Button
                  disabled={!enLinea || !!motivoBloqueo}
                  onClick={() => cambiar(tarea, 'completada')}
                  icon={<CircleCheck size={22} aria-hidden />}
                  className="sm:flex-1"
                  aria-describedby={motivoBloqueo ? 'motivo-completar' : undefined}
                >
                  Completar tarea
                </Button>
              </div>
              {motivoBloqueo && (
                <p id="motivo-completar" className="flex items-start gap-2 text-sm text-warning-700 font-semibold">
                  <Camera size={18} className="flex-none mt-px" aria-hidden />
                  {motivoBloqueo}
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
                    onClick={() => {
                      setAlcance('esta')
                      setConfirmarCancelar(true)
                    }}
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
        <section id="evidencias" className="flex flex-col gap-4 min-w-0 scroll-mt-20" aria-labelledby="tarea-evidencias">
          <div className="flex items-center justify-between gap-3">
            <h2 id="tarea-evidencias" className="text-xl font-bold text-ink">
              Evidencias <span className="text-base font-normal text-muted">({susEvidencias.length})</span>
            </h2>
          </div>

          {tarea.requiereEvidencia && <SituacionEvidenciaTarea situacion={situacion} valida={valida} explicadaArriba={opera && abierta && !!motivoBloqueo} />}
          {rechazo && (
            <p className="flex items-start gap-2 p-3 rounded-sm bg-danger-100 border border-danger text-sm text-ink" role="status">
              <CircleX size={18} className="flex-none mt-0.5 text-danger" aria-hidden />
              <span className="wrap-anywhere">
                <strong>Evidencia rechazada:</strong> {rechazo.motivoRechazo ?? 'adjunta una nueva evidencia.'}
                <span className="block text-xs text-muted">
                  {rechazo.validadaPor ? `Por ${nombreDe(rechazo.validadaPor)} · ` : ''}La tarea volvió a pendiente{situacion === 'pendiente' ? '.' : ': hay que adjuntar una nueva evidencia.'}
                </span>
              </span>
            </p>
          )}

          {susEvidencias.length === 0 ? (
            <div className="flex items-center justify-between gap-3 min-h-12 px-4 py-3 rounded-sm bg-surface-2 border border-line-soft text-muted">
              <span>{tarea.requiereEvidencia ? 'Aún no se ha adjuntado la evidencia requerida.' : 'Sin evidencias.'}</span>
              <Paperclip size={22} aria-hidden />
            </div>
          ) : (
            <ul className="flex flex-col gap-3 m-0 p-0 list-none">
              {susEvidencias.map((e, i) => (
                <EvidenciaItem
                  key={e.id}
                  evidencia={e}
                  titulo={`Evidencia ${susEvidencias.length - i}`}
                  nombreDe={nombreDe}
                  puedeValidar={valida}
                  enLinea={enLinea}
                  onValidar={validar}
                  onRechazar={rechazar}
                />
              ))}
            </ul>
          )}

          {/* ───── Agregar evidencia ───── */}
          {opera && tarea.estado !== 'cancelada' && !(tarea.requiereEvidencia && situacion === 'validada') && (
            <AdjuntarEvidencia tarea={tarea} user={user} enLinea={enLinea} restantes={EVIDENCIA_MAX_POR_TAREA - vigentes} />
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
            <Button variant="danger" size="sm" onClick={confirmar}>
              Sí, cancelar
            </Button>
          </>
        }
      >
        <p className="text-ink-2">
          «{tarea.titulo}» dejará de aparecer como pendiente en la agenda de {cuidador?.nombre ?? 'el cuidador'}, que recibirá un aviso.
        </p>
        {cuantasSiguientes > 0 && (
          <ChoicePills<'esta' | 'siguientes'>
            label="¿Qué tareas cancelar?"
            value={alcance}
            onChange={setAlcance}
            options={[
              { value: 'esta', label: 'Solo esta' },
              { value: 'siguientes', label: `Esta y las ${cuantasSiguientes} siguientes` },
            ]}
            help="Cada repetición es una tarea individual. Puedes cancelar solo esta ocurrencia o también las siguientes de la serie que sigan abiertas."
          />
        )}
      </Sheet>
    </Page>
  )
}

/**
 * Mensaje con la situación de la evidencia de una tarea que la requiere. Si quien la mira puede operar la tarea, el
 * motivo por el que aún no se completa ya se explica bajo el botón "Completar" (`explicadaArriba`) y no se repite.
 */
function SituacionEvidenciaTarea({
  situacion,
  valida,
  explicadaArriba,
}: {
  situacion: ReturnType<typeof situacionEvidencia>
  valida: boolean
  explicadaArriba: boolean
}) {
  if (situacion === 'validada') {
    return (
      <p className="flex items-start gap-2 p-3 rounded-sm bg-success-100 border border-success-700 text-sm text-ink" role="status">
        <ShieldCheck size={18} className="flex-none mt-0.5 text-success-700" aria-hidden />
        Evidencia validada: la tarea requería evidencia y ya la tiene.
      </p>
    )
  }
  if (situacion === 'pendiente') {
    if (explicadaArriba && !valida) return null
    return (
      <p className="flex items-start gap-2 p-3 rounded-sm bg-warning-100 border border-warning text-sm text-ink" role="status">
        <Hourglass size={18} className="flex-none mt-0.5 text-warning-700" aria-hidden />
        {valida ? 'Hay una evidencia por validar. Al validarla, la tarea queda completada.' : 'La evidencia está en revisión. La tarea se completará cuando la coordinación la valide.'}
      </p>
    )
  }
  // Rechazada: la explica el aviso con su motivo (más arriba). Sin evidencia: el motivo bajo "Completar" y la lista vacía.
  return null
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
