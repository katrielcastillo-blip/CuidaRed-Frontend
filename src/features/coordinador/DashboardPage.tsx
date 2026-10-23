/*
 * DashboardPage.tsx — Inicio del panel de gestión del coordinador (SRS §13.1 "Panel de gestión y
 * supervisión"): indicadores clave, alertas de urgencia alta, adultos sin visita reciente (RF-05),
 * visitas de hoy (con su motivo), tareas de hoy de la agenda (Tarea_agenda) y evidencias por validar
 * (Evidencias), y accesos a Resumen (RF-07), Alertas (CU-09/CU-10), Reportes (RF-08) y Agenda.
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BellRing,
  CalendarCheck,
  CalendarClock,
  Camera,
  CalendarPlus,
  ChartColumn,
  ChevronRight,
  ClipboardList,
  ClipboardPlus,
  HeartHandshake,
  ListOrdered,
  PersonStanding,
  Repeat,
  UserPlus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge, ButtonLink, EmptyState, RiesgoBadge } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import { fechaCorta, fechaLarga, todayISO } from '@/domain/dates'
import { puede, type Accion } from '@/domain/permisos'
import type { SeveridadAlerta } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { claveTarea, ESTADO_TAREA, etiquetaDia, horaTarea, tareaAbierta, useAgenda } from '@/features/agenda/lib/agenda'
import { AlertaCard } from './components/AlertaCard'
import { ESTADO_VISITA, esAlertaAbierta, haceTiempo, horaPautada12, sinVisitaReciente, useOrgData } from './lib/datos'

const SEVERIDADES: Array<{ value: SeveridadAlerta; label: string; clase: string }> = [
  { value: 'alta', label: 'Alta', clase: 'bg-danger text-white' },
  { value: 'media', label: 'Media', clase: 'bg-warning-700 text-white' },
  { value: 'baja', label: 'Baja', clase: 'bg-success-700 text-white' },
]

export function DashboardPage() {
  const { base } = useShell()
  const { user, adultos, adultoPorId, usuarioPorId, visitas, alertas, necesidades, umbral } = useOrgData()

  const m = useMemo(() => {
    const hoy = todayISO()
    const abiertas = alertas.filter(esAlertaAbierta)
    const porSeveridad = { alta: 0, media: 0, baja: 0 }
    for (const a of abiertas) porSeveridad[a.severidad]++
    const urgentes = abiertas.filter((a) => a.severidad === 'alta').sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
    const casosActivos = adultos.filter((a) => a.estado === 'activo').length
    const sinVisita = sinVisitaReciente(adultos, visitas, umbral)
    const pendientes = necesidades.filter((n) => n.estado === 'pendiente').length
    const enProceso = necesidades.filter((n) => n.estado === 'en_proceso').length
    const visitasHoy = visitas
      .filter((v) => v.fecha === hoy && v.estado !== 'cancelada')
      .sort((a, b) => a.horaPautada.localeCompare(b.horaPautada))
    return { abiertas: abiertas.length, porSeveridad, urgentes, casosActivos, sinVisita, pendientes, enProceso, visitasHoy }
  }, [adultos, visitas, alertas, necesidades, umbral])

  const agenda = useAgenda()
  const ag = useMemo(() => {
    const hoy = todayISO()
    const tareasHoy = agenda.tareas
      .filter((t) => (t.fechaProgramada === hoy && t.estado !== 'cancelada') || (t.fechaProgramada < hoy && tareaAbierta(t)))
      .sort((a, b) => claveTarea(a).localeCompare(claveTarea(b)))
    const porValidar = agenda.evidencias.filter((e) => e.estadoValidacion === 'pendiente').sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro))
    return { tareasHoy, abiertasHoy: tareasHoy.filter(tareaAbierta).length, porValidar }
  }, [agenda.tareas, agenda.evidencias])

  const permite = (a: Accion) => puede(user, a)

  return (
    <Page title="Panel de gestión" wide>
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-ink">Hola, {user.nombre}</h2>
        <p className="text-sm font-medium text-muted">{fechaLarga()}</p>
      </header>

      {/* ───── Indicadores ───── */}
      <section aria-label="Indicadores del seguimiento" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-4">
        <Link
          to={`${base}/alertas`}
          className="col-span-2 md:col-span-4 lg:col-span-1 flex flex-col justify-between gap-3 min-h-[124px] p-4 rounded-md bg-[#f6d7d2] border border-[#dc9a95] transition hover:shadow-1"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="text-base font-bold text-ink">Alertas abiertas</span>
            <BellRing size={22} className="flex-none text-danger" aria-hidden />
          </span>
          <span className="flex flex-wrap items-end justify-between gap-2">
            <span className="text-[2.5rem] font-bold leading-none text-ink">{m.abiertas}</span>
            <span className="flex flex-wrap gap-1.5" aria-label="Alertas abiertas por urgencia">
              {SEVERIDADES.map((s) => (
                <span key={s.value} className={cn('px-2 py-0.5 rounded-pill text-[11px] font-bold', s.clase)}>
                  {s.label} {m.porSeveridad[s.value]}
                </span>
              ))}
            </span>
          </span>
        </Link>

        <Kpi to={`${base}/adultos`} icon={PersonStanding} label="Casos activos" valor={m.casosActivos} nota="Adultos mayores en seguimiento" />
        <Kpi
          to={permite('resumen:ver') ? `${base}/resumen` : `${base}/adultos`}
          icon={CalendarClock}
          label="Sin visita reciente"
          valor={m.sinVisita.length}
          nota={`Más de ${umbral} días sin visita`}
          alerta={m.sinVisita.length > 0}
        />
        <Kpi icon={HeartHandshake} label="Necesidades pendientes" valor={m.pendientes} nota={`${m.enProceso} en proceso`} />
        <Kpi to={`${base}/visitas`} icon={ClipboardList} label="Visitas de hoy" valor={m.visitasHoy.length} nota={fechaCorta(todayISO())} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 lg:items-start">
        {/* ───── Alertas de urgencia alta ───── */}
        <Seccion id="dash-urgentes" titulo="Alertas de urgencia alta" ver={{ to: `${base}/alertas`, label: 'Ver todas' }}>
          {m.urgentes.length === 0 ? (
            <EmptyState title="Sin alertas urgentes" text="No hay alertas de urgencia alta pendientes de atender." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
              {m.urgentes.slice(0, 3).map((a) => {
                const adulto = adultoPorId.get(a.adultoId)
                return adulto ? <AlertaCard key={a.id} alerta={a} adulto={adulto} to={`${base}/alertas/${a.id}`} /> : null
              })}
            </div>
          )}
        </Seccion>

        {/* ───── Adultos sin visita reciente (RF-05) ───── */}
        <Seccion
          id="dash-sin-visita"
          titulo="Sin visita reciente"
          ver={permite('resumen:ver') ? { to: `${base}/resumen`, label: 'Ver resumen' } : undefined}
        >
          <p className="-mt-2 text-sm text-muted">Adultos que superan {umbral} días calendario sin visita comunitaria.</p>
          {m.sinVisita.length === 0 ? (
            <EmptyState title="Todo al día" text={`Ningún adulto supera los ${umbral} días sin visita.`} />
          ) : (
            <ul className="flex flex-col rounded-md border border-line-soft bg-surface divide-y divide-line-soft">
              {m.sinVisita.slice(0, 5).map(({ adulto, dias, conVisitas }) => (
                <li key={adulto.id} className="flex items-center gap-2 pr-2">
                  <Link to={`${base}/adultos/${adulto.id}`} className="flex flex-1 min-w-0 items-center gap-3 min-h-16 px-4 py-2 hover:bg-blue-100/50">
                    <span className="flex flex-col flex-1 min-w-0 gap-1">
                      <strong className="text-base text-ink truncate">{nombreCompleto(adulto)}</strong>
                      <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                        <RiesgoBadge riesgo={adulto.riesgo} />
                        <span className="font-semibold text-danger">
                          {dias} días {conVisitas ? 'sin visita' : 'sin ninguna visita'}
                        </span>
                      </span>
                    </span>
                  </Link>
                  {permite('visitas:programar') && (
                    <ButtonLink
                      to={`${base}/visitas/programar?adulto=${adulto.id}`}
                      variant="light"
                      size="sm"
                      icon={<CalendarPlus size={18} aria-hidden />}
                      aria-label={`Programar visita para ${nombreCompleto(adulto)}`}
                    >
                      <span className="hidden sm:inline">Programar</span>
                    </ButtonLink>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Seccion>

        {/* ───── Visitas de hoy ───── */}
        <Seccion id="dash-hoy" titulo="Visitas de hoy" ver={{ to: `${base}/visitas`, label: 'Ver agenda' }}>
          {m.visitasHoy.length === 0 ? (
            <EmptyState title="No hay visitas hoy" text="Programa una visita para que aparezca en la agenda del día." />
          ) : (
            <ul className="flex flex-col rounded-md border border-line-soft bg-surface divide-y divide-line-soft">
              {m.visitasHoy.slice(0, 5).map((v) => {
                const adulto = adultoPorId.get(v.adultoId)
                const resp = usuarioPorId.get(v.cuidadorId)
                const est = ESTADO_VISITA[v.estado]
                return (
                  <li key={v.id}>
                    <Link to={`${base}/visitas/${v.id}`} className="flex items-center gap-3 min-h-16 px-4 py-2 hover:bg-blue-100/50">
                      <span className="flex-none w-[76px] text-sm font-bold text-navy">{horaPautada12(v.horaPautada)}</span>
                      <span className="flex flex-col flex-1 min-w-0">
                        <strong className="text-base text-ink truncate">{adulto ? nombreCompleto(adulto) : 'Adulto mayor'}</strong>
                        <span className="text-sm text-ink-2 truncate">{v.razon || v.tipo}</span>
                        <span className="text-sm text-muted truncate">Responsable: {resp ? nombreCompleto(resp) : 'Sin asignar'}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <Badge tone={est.tono}>{est.label}</Badge>
                        {v.pendienteSync && <Badge tone="warning">Pendiente de sincronización</Badge>}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Seccion>

        {/* ───── Agenda: tareas de hoy y evidencias por validar ───── */}
        {permite('agenda:ver') && (
          <Seccion id="dash-tareas" titulo="Tareas de hoy" ver={{ to: `${base}/agenda`, label: 'Ver agenda' }}>
            <p className="-mt-2 text-sm text-muted">
              {ag.abiertasHoy === 0
                ? 'No quedan tareas abiertas para hoy.'
                : `${ag.abiertasHoy} ${ag.abiertasHoy === 1 ? 'tarea abierta' : 'tareas abiertas'} (incluye las atrasadas).`}
            </p>
            {ag.tareasHoy.length === 0 ? (
              <EmptyState title="Sin tareas para hoy" text="Crea una tarea en la agenda para asignarla a un cuidador." />
            ) : (
              <ul className="flex flex-col rounded-md border border-line-soft bg-surface divide-y divide-line-soft">
                {ag.tareasHoy.slice(0, 5).map((t) => {
                  const adulto = agenda.adultoPorId.get(t.adultoId)
                  const cuid = agenda.cuidadorPorId.get(t.cuidadorId)
                  const est = ESTADO_TAREA[t.estado]
                  const atrasada = t.fechaProgramada < todayISO() && tareaAbierta(t)
                  return (
                    <li key={t.id}>
                      <Link to={`${base}/agenda/${t.id}`} className="flex items-center gap-3 min-h-16 px-4 py-2 hover:bg-blue-100/50">
                        <span className="flex-none w-[76px] text-sm font-bold text-navy">{atrasada ? etiquetaDia(t.fechaProgramada) : horaTarea(t.horaProgramada)}</span>
                        <span className="flex flex-col flex-1 min-w-0">
                          <strong className="text-base text-ink truncate">{t.titulo}</strong>
                          <span className="text-sm text-muted truncate">
                            {adulto ? nombreCompleto(adulto) : 'Adulto mayor'} · {cuid?.nombre ?? 'Cuidador'}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          {atrasada ? <Badge tone="danger">Vencida</Badge> : <Badge tone={est.tono}>{est.label}</Badge>}
                          <span className="flex gap-1 text-navy">
                            {t.requiereEvidencia && <Camera size={16} aria-label="Requiere evidencia" />}
                            {t.repetitiva && <Repeat size={16} aria-label="Repetitiva" />}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}

            {permite('evidencias:validar') && (
              <div className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                  Evidencias por validar
                  <span
                    className={cn(
                      'inline-grid place-items-center min-w-6 h-6 px-2 rounded-pill text-xs font-bold',
                      ag.porValidar.length ? 'bg-warning-700 text-white' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {ag.porValidar.length}
                  </span>
                </h3>
                {ag.porValidar.length === 0 ? (
                  <p className="text-sm text-muted">No hay evidencias pendientes de revisión.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {ag.porValidar.slice(0, 3).map((e) => {
                      const t = agenda.tareas.find((x) => x.id === e.tareaId)
                      return (
                        <li key={e.id}>
                          <Link
                            to={`${base}/agenda/${e.tareaId}`}
                            className="flex items-center gap-3 min-h-14 px-3 py-2 rounded-sm bg-warning-100 border border-warning text-sm hover:brightness-[.98]"
                          >
                            <Camera size={20} className="flex-none text-warning-700" aria-hidden />
                            <span className="flex flex-col flex-1 min-w-0">
                              <strong className="text-ink truncate">{t?.titulo ?? 'Tarea'}</strong>
                              <span className="text-ink-2 truncate">
                                {agenda.nombreDe(e.registradaPor)} · {haceTiempo(e.fechaRegistro)}
                              </span>
                            </span>
                            <ChevronRight size={18} className="flex-none text-navy" aria-hidden />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </Seccion>
        )}

        {/* ───── Accesos ───── */}
        <Seccion id="dash-accesos" titulo="Accesos rápidos">
          <div className="grid grid-cols-2 gap-3">
            {permite('resumen:ver') && <Acceso to={`${base}/resumen`} icon={ListOrdered} label="Resumen de seguimiento" />}
            {permite('alertas:ver') && <Acceso to={`${base}/alertas`} icon={BellRing} label="Alertas" />}
            {permite('reportes:ver') && <Acceso to={`${base}/reportes`} icon={ChartColumn} label="Reportes" />}
            {permite('visitas:programar') && <Acceso to={`${base}/visitas/programar`} icon={CalendarPlus} label="Programar visita" />}
            {permite('agenda:ver') && <Acceso to={`${base}/agenda`} icon={CalendarCheck} label="Agenda de cuidado" />}
            {permite('agenda:gestionar') && <Acceso to={`${base}/agenda/nueva`} icon={ClipboardPlus} label="Nueva tarea" />}
            {permite('visitas:registrar') && <Acceso to={`${base}/visitas/nueva`} icon={ClipboardPlus} label="Registrar visita" />}
            {permite('adultos:crear') && <Acceso to={`${base}/adultos/nuevo`} icon={UserPlus} label="Agregar adulto" />}
          </div>
        </Seccion>
      </div>
    </Page>
  )
}

function Kpi({
  to,
  icon: Icon,
  label,
  valor,
  nota,
  alerta,
}: {
  to?: string
  icon: LucideIcon
  label: string
  valor: number
  nota: string
  alerta?: boolean
}) {
  const contenido = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight text-muted wrap-anywhere">{label}</span>
        <Icon size={22} className={cn('flex-none', alerta ? 'text-danger' : 'text-navy')} aria-hidden />
      </span>
      <span className={cn('mt-auto text-[2rem] font-bold leading-none', alerta ? 'text-danger' : 'text-ink')}>{valor}</span>
      <span className="text-xs text-muted">{nota}</span>
    </>
  )
  const clase = 'flex flex-col gap-1.5 min-h-[124px] min-w-0 p-4 rounded-md bg-surface shadow-1'
  return to ? (
    <Link to={to} className={cn(clase, 'transition hover:shadow-2 active:translate-y-px')}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  )
}

function Seccion({ id, titulo, ver, children }: { id: string; titulo: string; ver?: { to: string; label: string }; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-xl font-bold text-ink">
          {titulo}
        </h2>
        {ver && (
          <Link to={ver.to} className="inline-flex items-center gap-1 min-h-12 px-2 text-sm font-bold text-navy hover:underline">
            {ver.label} <ChevronRight size={16} aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function Acceso({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 min-h-16 p-3 rounded-md bg-surface shadow-1 text-sm font-semibold leading-tight text-ink transition hover:bg-blue-100">
      <span className="grid place-items-center flex-none size-10 rounded-md bg-blue-100 border border-blue text-navy">
        <Icon size={22} aria-hidden />
      </span>
      <span className="min-w-0">{label}</span>
    </Link>
  )
}
