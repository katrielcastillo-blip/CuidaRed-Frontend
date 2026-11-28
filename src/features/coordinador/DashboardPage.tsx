/*
 * DashboardPage.tsx — Inicio del panel del coordinador (HU-08 · SRS §13.1 "Panel de gestión y supervisión"):
 *  - alertas activas (pendientes y en atención) por urgencia, con enlace al detalle (CU-09 · CU-10),
 *  - próximos eventos: visitas programadas y tareas de agenda de hoy y los próximos días,
 *  - monitoreo de visitas: realizadas y pendientes de hoy, adultos con más días sin visita realizada frente al umbral
 *    de la cuenta (RF-05) y adultos sin personal asignado,
 *  - solicitudes de visita por autorizar (V2 · solo quien tiene visitas:autorizar),
 *  - indicadores clave y accesos rápidos a Resumen (RF-07), Reportes (RF-08), Agenda y Visitas.
 * Cada bloque se muestra según puede() (RF-09).
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
  UserPlus,
  UserRoundPlus,
} from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import { fechaLarga } from '@/domain/dates'
import { puede, type Accion } from '@/domain/permisos'
import type { SeveridadAlerta } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { useAgenda } from '@/features/agenda/lib/agenda'
import { AlertaCard } from './components/AlertaCard'
import { MonitoreoVisitas } from './components/MonitoreoVisitas'
import { ProximosEventos } from './components/ProximosEventos'
import { Acceso, Kpi, Seccion } from './components/Seccion'
import { SolicitudesPorAutorizar } from './components/SolicitudesPorAutorizar'
import {
  alertasActivas,
  monitoreoSinVisita,
  proximosEventos,
  resumenVisitasHoy,
  sinPersonalAsignado,
  tareasVencidas,
  useOrgData,
} from './lib/datos'
import { useSolicitudes } from './solicitudes/lib/solicitudes'

const SEVERIDADES: Array<{ value: SeveridadAlerta; label: string; clase: string }> = [
  { value: 'alta', label: 'Alta', clase: 'bg-danger text-white' },
  { value: 'media', label: 'Media', clase: 'bg-warning-700 text-white' },
  { value: 'baja', label: 'Baja', clase: 'bg-success-700 text-white' },
]

/** Alertas que se muestran en el inicio (el resto, en la bandeja de Alertas). */
const MAX_ALERTAS = 4

export function DashboardPage() {
  const { base } = useShell()
  const { user, adultos, adultoPorId, usuarioPorId, nombreDe, visitas, alertas, necesidades, umbral, vinculos } = useOrgData()
  const agenda = useAgenda()
  const { pendientes: solicitudesPendientes } = useSolicitudes()

  const permite = (a: Accion) => puede(user, a)
  const veAgenda = permite('agenda:ver')

  const m = useMemo(() => {
    const activas = alertasActivas(alertas)
    const porSeveridad = { alta: 0, media: 0, baja: 0 }
    for (const a of activas) porSeveridad[a.severidad]++
    const monitoreo = monitoreoSinVisita(adultos, visitas, umbral)
    return {
      activas,
      porSeveridad,
      enAtencion: activas.filter((a) => a.estado === 'en_atencion').length,
      casosActivos: adultos.filter((a) => a.estado === 'activo').length,
      pendientes: necesidades.filter((n) => n.estado === 'pendiente').length,
      enProceso: necesidades.filter((n) => n.estado === 'en_proceso').length,
      monitoreo,
      sinVisita: monitoreo.filter((x) => x.supera).length,
      sinAsignar: sinPersonalAsignado(adultos, vinculos, usuarioPorId),
      hoy: resumenVisitasHoy(visitas),
    }
  }, [adultos, visitas, alertas, necesidades, umbral, vinculos, usuarioPorId])

  const ag = useMemo(() => {
    const tareas = veAgenda ? agenda.tareas : []
    return {
      eventos: proximosEventos(visitas, tareas),
      vencidas: tareasVencidas(tareas).length,
      porValidar: agenda.evidencias.filter((e) => e.estadoValidacion === 'pendiente').length,
    }
  }, [visitas, veAgenda, agenda.tareas, agenda.evidencias])

  const nombres = useMemo(
    () => ({
      adulto: (id: string) => {
        const a = adultoPorId.get(id) ?? agenda.adultoPorId.get(id)
        return a ? nombreCompleto(a) : 'Adulto mayor'
      },
      usuario: nombreDe,
      cuidador: (id: string) => agenda.cuidadorPorId.get(id)?.nombre ?? 'Cuidador',
    }),
    [adultoPorId, agenda.adultoPorId, agenda.cuidadorPorId, nombreDe],
  )

  const puedeAutorizar = permite('visitas:autorizar')
  const visibles = m.activas.slice(0, MAX_ALERTAS)

  return (
    <Page title="Panel de gestión" wide>
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-ink">Hola, {user.nombre}</h2>
        <p className="text-sm font-medium text-muted">{fechaLarga()}</p>
      </header>

      {/* ───── Solicitudes de visita por autorizar (solo usuarios principales) ───── */}
      {puedeAutorizar && <SolicitudesPorAutorizar pendientes={solicitudesPendientes} to={`${base}/solicitudes`} />}

      {/* ───── Indicadores ───── */}
      <section aria-label="Indicadores del seguimiento" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-4">
        <Link
          to={`${base}/alertas`}
          className="col-span-2 md:col-span-4 lg:col-span-1 flex flex-col justify-between gap-3 min-h-[124px] p-4 rounded-md bg-[#f6d7d2] border border-[#dc9a95] transition hover:shadow-1"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="text-base font-bold text-ink">Alertas activas</span>
            <BellRing size={22} className="flex-none text-danger" aria-hidden />
          </span>
          <span className="flex flex-wrap items-end justify-between gap-2">
            <span className="text-[2.5rem] font-bold leading-none text-ink">{m.activas.length}</span>
            <span className="flex flex-wrap gap-1.5" aria-label="Alertas activas por urgencia">
              {SEVERIDADES.map((s) => (
                <span key={s.value} className={cn('px-2 py-0.5 rounded-pill text-[11px] font-bold', s.clase)}>
                  {s.label} {m.porSeveridad[s.value]}
                </span>
              ))}
            </span>
          </span>
        </Link>

        <Kpi to={`${base}/adultos`} icon={PersonStanding} label="Casos activos" valor={m.casosActivos} nota="Adultos mayores en seguimiento" />
        <Kpi icon={HeartHandshake} label="Necesidades pendientes" valor={m.pendientes} nota={`${m.enProceso} en proceso`} />
        <Kpi
          to={`${base}/visitas`}
          icon={ClipboardList}
          label="Visitas de hoy"
          valor={m.hoy.total}
          nota={m.hoy.total ? `${m.hoy.realizadas} realizadas · ${m.hoy.pendientes} pendientes` : 'Sin visitas programadas'}
        />
        <Kpi
          to={permite('resumen:ver') ? `${base}/resumen` : `${base}/adultos`}
          icon={CalendarClock}
          label="Sin visita reciente"
          valor={m.sinVisita}
          nota={`Más de ${umbral} días sin visita realizada`}
          alerta={m.sinVisita > 0}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8 lg:items-start">
        <div className="flex flex-col gap-6 min-w-0 lg:gap-8">
          {/* ───── Alertas activas ───── */}
          {permite('alertas:ver') && (
            <Seccion
              id="dash-alertas"
              titulo="Alertas activas"
              ver={{ to: `${base}/alertas`, label: m.activas.length > visibles.length ? `Ver las ${m.activas.length}` : 'Ver todas' }}
              nota={
                m.activas.length === 0
                  ? undefined
                  : `Pendientes y en atención, de mayor a menor urgencia${m.enAtencion ? ` · ${m.enAtencion} en atención` : ''}.`
              }
            >
              {visibles.length === 0 ? (
                <EmptyState title="Sin alertas activas" text="No hay alertas pendientes ni en atención." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                  {visibles.map((a) => {
                    const adulto = adultoPorId.get(a.adultoId)
                    return adulto ? <AlertaCard key={a.id} alerta={a} adulto={adulto} to={`${base}/alertas/${a.id}`} /> : null
                  })}
                </div>
              )}
            </Seccion>
          )}

          {/* ───── Próximos eventos ───── */}
          <Seccion
            id="dash-eventos"
            titulo="Próximos eventos"
            ver={{ to: `${base}/visitas`, label: 'Ver agenda' }}
            nota={`Visitas programadas${veAgenda ? ' y tareas de la agenda' : ''} de hoy y los próximos 7 días.`}
          >
            {ag.eventos.length === 0 ? (
              <EmptyState title="Sin eventos próximos" text="Programa una visita para que aparezca en la agenda." />
            ) : (
              <ProximosEventos eventos={ag.eventos} base={base} nombres={nombres} puedeVerAgenda={veAgenda} />
            )}

            {(ag.vencidas > 0 || (permite('evidencias:validar') && ag.porValidar > 0)) && (
              <div className="flex flex-col gap-2">
                {ag.vencidas > 0 && (
                  <AvisoAgenda to={`${base}/agenda`} icon={CalendarClock} tono="danger">
                    {ag.vencidas === 1 ? 'Hay 1 tarea vencida' : `Hay ${ag.vencidas} tareas vencidas`} sin completar.
                  </AvisoAgenda>
                )}
                {permite('evidencias:validar') && ag.porValidar > 0 && (
                  <AvisoAgenda to={`${base}/agenda`} icon={Camera} tono="warning">
                    {ag.porValidar === 1 ? 'Hay 1 evidencia por validar' : `Hay ${ag.porValidar} evidencias por validar`}.
                  </AvisoAgenda>
                )}
              </div>
            )}
          </Seccion>
        </div>

        <div className="flex flex-col gap-6 min-w-0 lg:gap-8">
          {/* ───── Monitoreo de visitas ───── */}
          <Seccion id="dash-monitoreo" titulo="Monitoreo de visitas" ver={permite('resumen:ver') ? { to: `${base}/resumen`, label: 'Ver resumen' } : undefined}>
            <MonitoreoVisitas
              hoy={m.hoy}
              monitoreo={m.monitoreo}
              umbral={umbral}
              sinAsignar={m.sinAsignar}
              base={base}
              puedeProgramar={permite('visitas:programar')}
              puedeAsignar={permite('adultos:asignar')}
            />
          </Seccion>

          {/* ───── Accesos ───── */}
          <Seccion id="dash-accesos" titulo="Accesos rápidos">
            <div className="grid grid-cols-2 gap-3">
              {puedeAutorizar && <Acceso to={`${base}/solicitudes`} icon={UserRoundPlus} label="Solicitudes de visita" contador={solicitudesPendientes.length} />}
              {permite('resumen:ver') && <Acceso to={`${base}/resumen`} icon={ListOrdered} label="Resumen de seguimiento" />}
              {permite('alertas:ver') && <Acceso to={`${base}/alertas`} icon={BellRing} label="Alertas" />}
              {permite('reportes:ver') && <Acceso to={`${base}/reportes`} icon={ChartColumn} label="Reportes y estadísticas" />}
              {permite('visitas:programar') && <Acceso to={`${base}/visitas/programar`} icon={CalendarPlus} label="Programar visita" />}
              {veAgenda && <Acceso to={`${base}/agenda`} icon={CalendarCheck} label="Agenda de cuidado" />}
              {permite('agenda:gestionar') && <Acceso to={`${base}/agenda/nueva`} icon={ClipboardPlus} label="Nueva tarea" />}
              {permite('visitas:registrar') && <Acceso to={`${base}/visitas/nueva`} icon={ClipboardPlus} label="Registrar visita" />}
              {permite('adultos:crear') && <Acceso to={`${base}/adultos/nuevo`} icon={UserPlus} label="Agregar adulto" />}
            </div>
          </Seccion>
        </div>
      </div>
    </Page>
  )
}

/** Aviso con enlace a la agenda (tareas vencidas, evidencias por validar). */
function AvisoAgenda({
  to,
  icon: Icon,
  tono,
  children,
}: {
  to: string
  icon: typeof Camera
  tono: 'danger' | 'warning'
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 min-h-14 px-3 py-2 rounded-sm border text-sm font-semibold text-ink hover:brightness-[.98]',
        tono === 'danger' ? 'bg-danger-100 border-danger' : 'bg-warning-100 border-warning',
      )}
    >
      <Icon size={20} className={cn('flex-none', tono === 'danger' ? 'text-danger' : 'text-warning-700')} aria-hidden />
      <span className="flex-1 min-w-0">{children}</span>
      <ChevronRight size={18} className="flex-none text-navy" aria-hidden />
    </Link>
  )
}
