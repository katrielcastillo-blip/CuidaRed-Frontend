/*
 * Dashboard.tsx — Panel del administrador: visión general de la organización (KPIs, alertas por urgencia,
 * seguimiento RF-05, tareas de agenda pendientes (Tarea_agenda), uso del plan (Plan.Limite_Envejecientes /
 * Limite_Usuarios), usuarios por rol, estadísticas) y accesos a resumen, alertas, agenda, reportes, usuarios,
 * plan y auditoría.
 * Módulo: admin (SRS §13.1 "Panel de gestión y supervisión" · §8.2.2.1.18 Operabilidad · RF-04 · RF-05 · RF-09).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BellRing,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  CalendarClock,
  ChartColumn,
  ChevronRight,
  ClipboardList,
  HandHeart,
  KeyRound,
  PersonStanding,
  ScrollText,
  ShieldAlert,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Avatar, Badge, RIESGO_VISUAL } from '@/components/ui'
import { nombreCompleto, ROL_LABEL, useSession, useUser } from '@/domain/auth'
import { fechaCorta, fechaLarga, hhmmA12, todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import type { SeveridadAlerta } from '@/domain/types'
import { cn } from '@/lib/cn'
import { Page, useShell } from '@/layouts/AppShell'
import { BarraUso } from '../components/BarraUso'
import { hace, nombreCorto } from '../lib/datos'
import { ESTADO_SUSCRIPCION, precioPlan } from '../lib/plan'
import { ORDEN_ROLES } from '../lib/permisos'
import { useResumen, type AlertaReciente } from '../lib/resumen'

const SEVERIDAD: Record<SeveridadAlerta, { label: string; chip: string; borde: string; visual: (typeof RIESGO_VISUAL)['alto'] }> = {
  alta: { label: 'Alta', chip: 'bg-danger-100 text-danger', borde: 'border-l-danger', visual: RIESGO_VISUAL.alto },
  media: { label: 'Media', chip: 'bg-warning-100 text-warning-700', borde: 'border-l-warning', visual: RIESGO_VISUAL.medio },
  baja: { label: 'Baja', chip: 'bg-teal-100 text-success-700', borde: 'border-l-success-700', visual: RIESGO_VISUAL.bajo },
}

const TITULO_SECCION = 'text-xl font-bold text-ink'
const VER_TODO = 'inline-flex items-center gap-1 min-h-12 px-1 text-sm font-bold text-navy hover:underline'

export default function Dashboard() {
  const user = useUser()
  const { base } = useShell()
  const r = useResumen()

  const visitasMes = r.visitasPorMes.at(-1)?.total ?? 0

  return (
    <Page title="Panel de administración" wide>
      <header className="flex flex-col gap-0.5">
        <h2 className="text-2xl font-bold text-ink">Hola, {user.nombre}</h2>
        <p className="text-sm text-muted first-letter:uppercase">{fechaLarga()}</p>
      </header>

      {/* ───── KPIs ───── */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-label="Indicadores de la organización">
        <Link
          to={`${base}/alertas`}
          className="col-span-2 md:col-span-3 lg:col-span-1 lg:row-span-2 flex flex-col justify-between gap-4 p-5 rounded-md border border-danger bg-[#f3d3cf] text-ink transition-shadow hover:shadow-2"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="text-xl font-bold">Alertas sin atender</span>
            <BellRing size={24} className="text-danger flex-none" aria-hidden />
          </span>
          <span className="text-5xl font-bold leading-none">{r.alertasSinAtender}</span>
          <span className="flex flex-wrap gap-2" aria-label="Por nivel de urgencia">
            {(Object.keys(SEVERIDAD) as SeveridadAlerta[]).map((s) => {
              const v = SEVERIDAD[s]
              return (
                <span key={s} className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-bold bg-white/80', v.visual.color)}>
                  <v.visual.Icono size={12} strokeWidth={3} aria-hidden />
                  <span className="text-ink">
                    {v.label}: {r.porUrgencia[s]}
                  </span>
                </span>
              )
            })}
          </span>
        </Link>

        <Kpi
          to={`${base}/adultos`}
          icono={PersonStanding}
          label="Adultos activos"
          valor={r.adultosActivos}
          extra={
            r.tendenciaAdultos !== null && (
              <span className="inline-flex items-center gap-0.5 px-2 rounded-pill bg-teal-100 text-success-700 text-[11px] font-bold leading-4" title="Altas de los últimos 30 días">
                <TrendingUp size={12} aria-hidden />+{r.tendenciaAdultos}%
              </span>
            )
          }
        />
        <Kpi
          to={`${base}/alertas`}
          icono={ShieldAlert}
          label="Casos prioritarios abiertos"
          valor={r.prioritariosAbiertos}
          alerta={r.prioritariosAbiertos > 0}
          nota="Riesgo alto o medicamentos pendientes"
        />
        <Kpi
          to={`${base}/resumen`}
          icono={CalendarClock}
          label={`Más de ${r.umbralDias} días sin visita`}
          valor={r.sinVisita.length}
          alerta={r.sinVisita.length > 0}
          nota="Seguimiento familiar (RF-05)"
        />
        <Kpi
          to={`${base}/resumen`}
          icono={HandHeart}
          label="Necesidades pendientes"
          valor={r.necesidadesPendientes}
          nota={`${r.necesidadesEnProceso} en proceso`}
        />
        <Kpi
          to={`${base}/miembros`}
          icono={Users}
          label="Usuarios activos"
          valor={r.usuariosActivos}
          nota={r.invitados > 0 ? `${r.invitados} invitación(es) pendiente(s)` : 'Sin invitaciones pendientes'}
        />
        <Kpi to={`${base}/reportes`} icono={CalendarCheck} label="Visitas este mes" valor={visitasMes} nota="Sin contar canceladas" />
      </section>

      {/* ───── Accesos ───── */}
      <section className="flex flex-col gap-3" aria-labelledby="h-accesos">
        <h2 id="h-accesos" className={TITULO_SECCION}>
          Accesos rápidos
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Acceso to={`${base}/resumen`} icono={ClipboardList} titulo="Resumen de seguimiento" />
          <Acceso to={`${base}/alertas`} icono={BellRing} titulo="Alertas" />
          {puede(user, 'agenda:ver') && <Acceso to={`${base}/agenda`} icono={CalendarDays} titulo="Agenda de tareas" />}
          <Acceso to={`${base}/reportes`} icono={ChartColumn} titulo="Reportes" />
          <Acceso to={`${base}/miembros`} icono={Users} titulo="Usuarios" />
          <Acceso to={`${base}/roles`} icono={KeyRound} titulo="Roles y permisos" />
          {puede(user, 'cuenta:suscripcion') && <Acceso to={`${base}/suscripcion`} icono={CreditCard} titulo="Plan y suscripción" />}
          <Acceso to={`${base}/auditoria`} icono={ScrollText} titulo="Auditoría" />
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8 lg:items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {/* Alertas por atender */}
          <section className="flex flex-col gap-3" aria-labelledby="h-alertas">
            <div className="flex items-center justify-between gap-3">
              <h2 id="h-alertas" className={TITULO_SECCION}>
                Alertas por atender
              </h2>
              <Link to={`${base}/alertas`} className={VER_TODO}>
                Ver todas <ChevronRight size={16} aria-hidden />
              </Link>
            </div>
            {r.alertasRecientes.length === 0 ? (
              <p className="p-4 rounded-md bg-surface shadow-1 text-muted">No hay alertas pendientes. ¡Buen trabajo!</p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                {r.alertasRecientes.map((x) => (
                  <li key={x.alerta.id} className="flex min-w-0">
                    <AlertaCard x={x} to={`${base}/alertas/${x.alerta.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Agenda: tareas pendientes */}
          {puede(user, 'agenda:ver') && <AgendaPendiente r={r} base={base} />}

          {/* Seguimiento RF-05 */}
          <section className="flex flex-col gap-3" aria-labelledby="h-sinvisita">
            <div className="flex items-center justify-between gap-3">
              <h2 id="h-sinvisita" className={TITULO_SECCION}>
                Sin visita hace más de {r.umbralDias} días
              </h2>
              <Link to={`${base}/configuracion`} className={VER_TODO}>
                Cambiar umbral
              </Link>
            </div>
            {r.sinVisita.length === 0 ? (
              <p className="p-4 rounded-md bg-surface shadow-1 text-muted">Todos los adultos activos recibieron visita dentro del período configurado.</p>
            ) : (
              <ul className="flex flex-col rounded-md bg-surface shadow-1 divide-y divide-line-soft">
                {r.sinVisita.slice(0, 6).map(({ adulto, dias }) => (
                  <li key={adulto.id}>
                    <Link to={`${base}/adultos/${adulto.id}`} className="flex items-center gap-3 min-h-14 px-4 py-2 hover:bg-blue-100/60">
                      <Avatar nombre={nombreCompleto(adulto)} src={adulto.foto} size={40} />
                      <span className="flex-1 min-w-0 font-semibold truncate">{nombreCompleto(adulto)}</span>
                      <span className="flex-none px-2.5 py-1 rounded-pill bg-warning-100 text-warning-700 text-xs font-bold">{dias} días</span>
                      <ChevronRight size={18} className="text-blue flex-none" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          {/* Plan y uso de los límites */}
          {puede(user, 'cuenta:suscripcion') && <UsoDelPlan r={r} to={`${base}/suscripcion`} />}

          {/* Usuarios por rol */}
          <section className="flex flex-col gap-3" aria-labelledby="h-roles">
            <div className="flex items-center justify-between gap-3">
              <h2 id="h-roles" className={TITULO_SECCION}>
                Usuarios activos por rol
              </h2>
              <Link to={`${base}/miembros`} className={VER_TODO}>
                Gestionar <ChevronRight size={16} aria-hidden />
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-3">
              {ORDEN_ROLES.map((rol) => (
                <li key={rol}>
                  <Link
                    to={`${base}/miembros?rol=${rol}`}
                    className="flex items-center justify-between gap-2 min-h-14 px-4 py-2 rounded-md bg-surface shadow-1 hover:shadow-2 transition-shadow"
                  >
                    <span className="text-sm font-semibold text-ink-2">{ROL_LABEL[rol]}</span>
                    <span className="text-2xl font-bold text-ink">{r.usuariosPorRol[rol]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Estadísticas */}
          <section className="flex flex-col gap-3" aria-labelledby="h-estadisticas">
            <div className="flex items-center justify-between gap-3">
              <h2 id="h-estadisticas" className={TITULO_SECCION}>
                Estadísticas
              </h2>
              <Link to={`${base}/reportes`} className={VER_TODO}>
                Ver reportes <ChevronRight size={16} aria-hidden />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <VisitasPorMes r={r} />
              <TiposNecesidad r={r} />
            </div>
          </section>
        </div>
      </div>
    </Page>
  )
}

const PRIORIDAD_TAREA = { alta: 'bg-danger-100 text-danger', media: 'bg-warning-100 text-warning-700', baja: 'bg-teal-100 text-success-700' } as const

function AgendaPendiente({ r, base }: { r: ReturnType<typeof useResumen>; base: string }) {
  const hoy = todayISO()
  const n = r.tareasAtrasadas
  return (
    <section className="flex flex-col gap-3" aria-labelledby="h-agenda">
      <div className="flex items-center justify-between gap-3">
        <h2 id="h-agenda" className={TITULO_SECCION}>
          Agenda pendiente <span className="text-base font-semibold text-muted">· {r.tareasPendientes.length}</span>
        </h2>
        <Link to={`${base}/agenda`} className={VER_TODO}>
          Ver agenda <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      {n > 0 && (
        <p className="px-4 py-2 rounded-md bg-warning-100 text-sm font-semibold text-warning-700">
          {n === 1 ? '1 tarea atrasada' : `${n} tareas atrasadas`} (fecha programada vencida).
        </p>
      )}
      {r.tareasPendientes.length === 0 ? (
        <p className="p-4 rounded-md bg-surface shadow-1 text-muted">No hay tareas pendientes en la agenda.</p>
      ) : (
        <ul className="flex flex-col rounded-md bg-surface shadow-1 divide-y divide-line-soft">
          {r.tareasPendientes.slice(0, 5).map(({ tarea, adulto }) => {
            const atrasada = tarea.fechaProgramada < hoy
            return (
              <li key={tarea.id}>
                <Link to={`${base}/agenda/${tarea.id}`} className="flex items-center gap-3 min-h-14 px-4 py-2 hover:bg-blue-100/60">
                  <span className={cn('flex-none w-16 text-center text-xs font-bold leading-tight', atrasada ? 'text-danger' : 'text-navy')}>
                    {tarea.fechaProgramada === hoy ? 'Hoy' : fechaCorta(`${tarea.fechaProgramada}T12:00:00`).slice(0, 5)}
                    <span className="block font-semibold text-muted">{hhmmA12(tarea.horaProgramada)}</span>
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="font-semibold truncate">{tarea.titulo}</span>
                    <span className="text-xs text-muted truncate">
                      {adulto ? nombreCompleto(adulto) : 'Adulto no disponible'}
                      {tarea.estado === 'en_curso' ? ' · en curso' : ''}
                    </span>
                  </span>
                  <span className={cn('flex-none px-2.5 py-1 rounded-pill text-[10px] font-bold uppercase', PRIORIDAD_TAREA[tarea.prioridad])}>{tarea.prioridad}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function UsoDelPlan({ r, to }: { r: ReturnType<typeof useResumen>; to: string }) {
  const { org } = useSession()
  const { plan } = r.uso
  const estado = org ? ESTADO_SUSCRIPCION[org.suscripcionEstado] : null
  return (
    <section className="flex flex-col gap-3" aria-labelledby="h-uso-plan">
      <div className="flex items-center justify-between gap-3">
        <h2 id="h-uso-plan" className={TITULO_SECCION}>
          Uso del plan
        </h2>
        <Link to={to} className={VER_TODO}>
          Ver plan <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      <div className="flex flex-col gap-4 p-4 rounded-md bg-surface shadow-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-col">
            <strong className="text-lg text-ink">{plan ? `Plan ${plan.nombre}` : 'Sin plan'}</strong>
            {plan && <span className="text-sm text-muted">{precioPlan(plan)}</span>}
          </span>
          {estado && <Badge tone={estado.tono}>{estado.texto}</Badge>}
        </div>
        {plan && (
          <>
            <BarraUso etiqueta="Adultos mayores activos" usado={r.uso.envejecientes} limite={plan.limiteEnvejecientes} excede={r.uso.excedeEnvejecientes} />
            <BarraUso etiqueta="Usuarios" usado={r.uso.usuarios} limite={plan.limiteUsuarios} excede={r.uso.excedeUsuarios} />
          </>
        )}
        {(r.uso.excedeEnvejecientes || r.uso.excedeUsuarios) && (
          <p className="text-sm font-semibold text-danger">Se superan los límites del plan: considera cambiar a un plan con más capacidad.</p>
        )}
      </div>
    </section>
  )
}

function Kpi({
  to,
  icono: Icono,
  label,
  valor,
  nota,
  extra,
  alerta,
}: {
  to: string
  icono: LucideIcon
  label: string
  valor: number
  nota?: string
  extra?: ReactNode
  alerta?: boolean
}) {
  return (
    <Link to={to} className="flex flex-col gap-1 min-w-0 p-4 rounded-md bg-surface shadow-1 transition-shadow hover:shadow-2">
      <span className="flex items-center justify-between gap-2 min-h-6">
        <Icono size={24} className={cn('flex-none', alerta ? 'text-danger' : 'text-navy')} aria-hidden />
        {extra}
      </span>
      <span className="mt-1 text-sm text-muted leading-snug">{label}</span>
      <span className={cn('text-[1.75rem] font-bold leading-tight', alerta ? 'text-danger' : 'text-ink')}>{valor}</span>
      {nota && <span className="text-xs text-muted leading-snug">{nota}</span>}
    </Link>
  )
}

function Acceso({ to, icono: Icono, titulo }: { to: string; icono: LucideIcon; titulo: string }) {
  return (
    <li className="flex">
      <Link
        to={to}
        className="flex-1 flex items-center gap-3 min-h-14 px-3 py-2 rounded-md border border-line-soft bg-bg text-ink font-semibold text-sm leading-tight transition hover:border-navy hover:shadow-1 lg:flex-col lg:items-start lg:py-3"
      >
        <span className="grid place-items-center size-10 flex-none rounded-md bg-blue-100 border border-blue text-navy">
          <Icono size={20} aria-hidden />
        </span>
        <span className="min-w-0">{titulo}</span>
      </Link>
    </li>
  )
}

function AlertaCard({ x, to }: { x: AlertaReciente; to: string }) {
  const sev = SEVERIDAD[x.alerta.severidad]
  return (
    <Link to={to} className={cn('flex-1 flex flex-col gap-3 min-w-0 p-4 pl-5 rounded-md border-l-4 bg-surface shadow-1 transition-shadow hover:shadow-2', sev.borde)}>
      <div className="flex items-start gap-3">
        <Avatar nombre={nombreCompleto(x.adulto)} src={x.adulto.foto} size={48} />
        <div className="flex-1 min-w-0 flex flex-col justify-center min-h-12 leading-tight">
          <strong className="text-base font-bold truncate">{nombreCorto(x.adulto)}</strong>
          <span className="text-sm text-muted">{x.alerta.titulo}</span>
        </div>
        <time className="flex-none text-xs text-muted" dateTime={x.alerta.creadaEn}>
          {hace(x.alerta.creadaEn)}
        </time>
      </div>
      <p className="text-base leading-normal text-ink line-clamp-3">{x.alerta.descripcion}</p>
      <div className="flex flex-wrap gap-2">
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-[10px] font-bold uppercase tracking-[0.02em] leading-3', sev.chip)}>
          <sev.visual.Icono size={11} strokeWidth={3} aria-hidden />
          <span>
            <span className="sr-only">Urgencia </span>
            {sev.label}
          </span>
        </span>
        <span className="inline-flex items-center px-2.5 py-1 rounded-pill bg-blue-100 text-navy text-[10px] font-bold uppercase tracking-[0.02em] leading-3">
          {x.alerta.categoria}
        </span>
        {x.alerta.estado === 'en_atencion' && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-pill bg-surface-2 text-ink-2 text-[10px] font-bold uppercase tracking-[0.02em] leading-3">
            En atención
          </span>
        )}
      </div>
    </Link>
  )
}

function VisitasPorMes({ r }: { r: ReturnType<typeof useResumen> }) {
  const max = Math.max(0, ...r.visitasPorMes.map((m) => m.total))
  const total = r.visitasPorMes.reduce((a, m) => a + m.total, 0)
  const iMax = max > 0 ? r.visitasPorMes.findIndex((m) => m.total === max) : -1
  return (
    <div className="flex flex-col gap-3 min-w-0 p-4 rounded-md bg-surface shadow-1 [--chart-h:112px] lg:[--chart-h:148px]">
      <h3 className="text-base font-bold text-ink">Visitas por mes</h3>
      {total === 0 && <p className="text-sm text-muted">Aún no hay visitas registradas en los últimos 6 meses.</p>}
      <div className="grid grid-cols-6 gap-2" role="img" aria-label={`Visitas por mes: ${r.visitasPorMes.map((m) => `${m.etiqueta} ${m.total}`).join(', ')}`}>
        {r.visitasPorMes.map((m, i) => (
          <div key={m.clave} className="flex flex-col gap-1 min-w-0" title={`${m.etiqueta}: ${m.total} visitas`}>
            <span className={cn('h-4 text-center text-xs leading-4', i === iMax ? 'text-navy font-extrabold' : 'text-muted font-semibold')}>{m.total}</span>
            <span className="flex items-end h-[var(--chart-h)]">
              <span
                className={cn('block w-full rounded-t border border-b-0 transition-[height] duration-300', i === iMax ? 'bg-[#0b5fae] border-[#0b5fae]' : 'bg-[#d8e6fb] border-[#b6cdee]')}
                style={{ height: `max(4px, calc(var(--chart-h) * ${max ? m.total / max : 0}))` }}
              />
            </span>
            <span className="text-center text-xs text-muted">{m.etiqueta}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TiposNecesidad({ r }: { r: ReturnType<typeof useResumen> }) {
  return (
    <div className="flex flex-col gap-3 min-w-0 p-4 rounded-md bg-surface shadow-1">
      <h3 className="text-base font-bold text-ink">Tipos de necesidades</h3>
      {r.tiposNecesidad.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay necesidades registradas.</p>
      ) : (
        <>
          <div
            className="flex gap-0.5 h-4 rounded-lg overflow-hidden bg-surface-2"
            role="img"
            aria-label={`Tipos de necesidades: ${r.tiposNecesidad.map((t) => `${t.etiqueta} ${t.pct}%`).join(', ')}`}
          >
            {r.tiposNecesidad.map((t) => (
              <span key={t.tipo} className="basis-0 min-w-1" style={{ flexGrow: t.total, background: t.color }} />
            ))}
          </div>
          <ul className="flex flex-col gap-1">
            {r.tiposNecesidad.map((t) => (
              <li key={t.tipo} className="flex items-center justify-between gap-3 min-h-6 text-sm text-ink">
                <span className="inline-flex items-center gap-2">
                  <i className="inline-block size-3 rounded-[3px] flex-none" style={{ background: t.color }} aria-hidden />
                  {t.etiqueta}
                </span>
                <span className="text-xs font-bold text-muted">
                  {t.total} · {t.pct}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
