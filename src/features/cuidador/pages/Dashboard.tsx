/*
 * Dashboard.tsx — Inicio del cuidador (Interfaz móvil de campo, SRS §13.1): saludo y fecha, resumen de hoy,
 * acciones rápidas, tareas del día de su agenda (Tarea_agenda del perfil Cuidador), visitas de hoy y próximas,
 * personas prioritarias (riesgo alto, alertas abiertas o demasiados días sin visita, RF-04/RF-05) y aviso de
 * conexión / registros por sincronizar (RF-10 · SRS §11). Solo muestra lo de la cuenta activa y de los adultos
 * que tiene asignados (V2 §Cuidador).
 * Módulo: cuidador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, CircleCheck, ClipboardPlus, CloudOff, HandHeart, RefreshCw, UsersRound } from 'lucide-react'
import { useSession, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaLarga, todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import { usePendientes } from '@/domain/sync'
import { EmptyState } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { VisitaCard } from '@/features/visitas/components/VisitaCard'
import { porFechaAsc } from '@/features/visitas/lib/dominio'
import { AccionRapida } from '../components/AccionRapida'
import { AdultoCard } from '../components/AdultoCard'
import { TareasDeHoy } from '../components/TareasDeHoy'
import { prioritarios, useMisAdultos, useMisTareas, useMisVisitas } from '../lib/resumen'

/** Personas prioritarias que se muestran en el inicio (el resto, en «Mis adultos»). */
const MAX_PRIORITARIAS = 4

export function Dashboard() {
  const user = useUser()
  const { org } = useSession()
  const { base } = useShell()
  const enLinea = useEnLinea()
  const pendientesSync = usePendientes().length
  const adultos = useDB((s) => s.adultos)
  const misAdultos = useMisAdultos()
  const misVisitas = useMisVisitas()
  const misTareas = useMisTareas()
  const verAgenda = puede(user, 'agenda:ver')

  const { deHoy, completadas, proximas } = useMemo(() => {
    const hoy = todayISO()
    const vigentes = misVisitas.filter((v) => v.estado !== 'cancelada')
    const deHoy = vigentes.filter((v) => v.fecha === hoy).sort(porFechaAsc)
    return {
      deHoy,
      completadas: deHoy.filter((v) => v.estado === 'completada').length,
      proximas: vigentes.filter((v) => v.fecha > hoy && v.estado === 'pendiente').sort(porFechaAsc).slice(0, 3),
    }
  }, [misVisitas])

  const tareasHoy = useMemo(() => {
    const hoy = todayISO()
    return misTareas.filter((t) => t.fechaProgramada === hoy && t.estado !== 'cancelada').sort((a, b) => a.horaProgramada.localeCompare(b.horaProgramada))
  }, [misTareas])
  const tareasHechas = tareasHoy.filter((t) => t.estado === 'completada').length

  const prioridad = useMemo(() => prioritarios(misAdultos), [misAdultos])
  const alertasAbiertas = useMemo(() => misAdultos.reduce((n, r) => n + r.alertas, 0), [misAdultos])

  const abiertasHoy = deHoy.filter((v) => v.estado !== 'completada')
  const adultoDe = (id: string) => adultos.find((a) => a.id === id)
  const verAlertas = puede(user, 'alertas:ver')

  return (
    <Page title="Inicio" wide>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-2xl font-bold leading-tight text-ink">Hola, {user.nombre}</h2>
        <p className="text-sm font-semibold text-muted">
          {fechaLarga()}
          {org ? ` · ${org.nombre}` : ''}
        </p>
      </div>

      {!enLinea ? (
        <div className="flex items-start gap-3 p-4 rounded-sm border border-warning bg-warning-100 text-ink" role="status">
          <CloudOff size={24} className="text-warning-700 flex-none" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-bold text-warning-700">Sin conexión. Puedes seguir registrando.</p>
            <p className="text-sm">
              Las visitas y necesidades se guardan en el dispositivo y se envían solas al volver la conexión
              {pendientesSync > 0 && ` (${pendientesSync} pendiente${pendientesSync === 1 ? '' : 's'})`}.
            </p>
          </div>
        </div>
      ) : (
        pendientesSync > 0 && (
          <Link
            to={`${base}/sincronizacion`}
            className="flex items-center gap-3 min-h-12 p-4 rounded-sm border border-blue bg-blue-100 text-navy hover:shadow-1"
            role="status"
          >
            <RefreshCw size={22} className="flex-none" aria-hidden />
            <span className="flex-1 font-semibold">
              {pendientesSync} registro{pendientesSync === 1 ? '' : 's'} pendiente{pendientesSync === 1 ? '' : 's'} de sincronizar
            </span>
            <ArrowRight size={20} aria-hidden />
          </Link>
        )
      )}

      <section className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Resumen de hoy">
        <Resumen etiqueta="Visitas hechas" valor={`${completadas} de ${deHoy.length}`} />
        {verAgenda && <Resumen etiqueta="Tareas hechas" valor={`${tareasHechas} de ${tareasHoy.length}`} />}
        {verAlertas && <Resumen etiqueta="Alertas abiertas" valor={String(alertasAbiertas)} alerta={alertasAbiertas > 0} to={`${base}/alertas`} />}
      </section>

      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-8">
        {/* ───── Columna 1: el día de trabajo ───── */}
        <div className="contents md:flex md:flex-col md:gap-6 min-w-0">
          {verAgenda && (
            <div className="order-3 md:order-none">
              <TareasDeHoy tareas={tareasHoy} adultoDe={adultoDe} base={base} />
            </div>
          )}

          <section className="order-4 md:order-none flex flex-col gap-3" aria-labelledby="hoy-titulo">
            <h2 className="section-title" id="hoy-titulo">
              Visitas de hoy
            </h2>
            {abiertasHoy.length > 0 ? (
              <div className="flex flex-col gap-3">
                {abiertasHoy.map((v) => (
                  <VisitaCard key={v.id} visita={v} adulto={adultoDe(v.adultoId)} to={`${base}/visitas/${v.id}`} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-2">
                {completadas > 0 ? `Terminaste tus ${completadas} visita${completadas === 1 ? '' : 's'} de hoy.` : 'No tienes visitas pendientes para hoy.'}
              </p>
            )}
          </section>

          <section className="order-6 md:order-none flex flex-col gap-3" aria-labelledby="proximas-titulo">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title" id="proximas-titulo">
                Próximas visitas
              </h2>
              <Link to={`${base}/visitas`} className="inline-flex items-center min-h-12 px-2 text-sm font-semibold text-navy underline underline-offset-4">
                Ver todas
              </Link>
            </div>
            {proximas.length > 0 ? (
              <div className="flex flex-col gap-3">
                {proximas.map((v) => (
                  <VisitaCard key={v.id} visita={v} adulto={adultoDe(v.adultoId)} to={`${base}/visitas/${v.id}`} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-2">No hay visitas programadas para los próximos días.</p>
            )}
          </section>
        </div>

        {/* ───── Columna 2: acciones y personas prioritarias ───── */}
        <div className="contents md:flex md:flex-col md:gap-6 min-w-0">
          <section className="order-2 md:order-none flex flex-col gap-3" aria-labelledby="acciones-titulo">
            <h2 className="section-title" id="acciones-titulo">
              Acciones rápidas
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {puede(user, 'visitas:registrar') && (
                <AccionRapida tono="positivo" to={`${base}/visitas/nueva`} icon={<ClipboardPlus size={28} aria-hidden />}>
                  Registrar visita
                </AccionRapida>
              )}
              {puede(user, 'necesidades:registrar') && (
                <AccionRapida tono="positivo" to={`${base}/necesidades/nueva`} icon={<HandHeart size={28} aria-hidden />}>
                  Registrar necesidad
                </AccionRapida>
              )}
              {verAgenda && (
                <AccionRapida to={`${base}/agenda`} icon={<CalendarCheck size={28} aria-hidden />}>
                  Mi agenda
                </AccionRapida>
              )}
              {puede(user, 'adultos:ver') && (
                <AccionRapida to={`${base}/adultos`} icon={<UsersRound size={28} aria-hidden />}>
                  Mis adultos
                </AccionRapida>
              )}
            </div>
          </section>

          <section className="order-5 md:order-none flex flex-col gap-3" aria-labelledby="prioritarias-titulo">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title" id="prioritarias-titulo">
                Personas prioritarias
              </h2>
              {misAdultos.length > 0 && (
                <Link to={`${base}/adultos`} className="inline-flex items-center min-h-12 px-2 text-sm font-semibold text-navy underline underline-offset-4">
                  Ver mis adultos
                </Link>
              )}
            </div>
            {misAdultos.length === 0 ? (
              <EmptyState title="Sin adultos asignados" text="El coordinador te asignará los adultos mayores que debes visitar." />
            ) : prioridad.length > 0 ? (
              <>
                <p className="-mt-1 text-sm text-ink-2">Riesgo alto, alertas abiertas o demasiados días sin visita.</p>
                <div className="grid gap-3 grid-cols-1">
                  {prioridad.slice(0, MAX_PRIORITARIAS).map((r) => (
                    <AdultoCard key={r.adulto.id} resumen={r} motivos />
                  ))}
                </div>
                {prioridad.length > MAX_PRIORITARIAS && (
                  <p className="text-sm text-ink-2">
                    Mostrando {MAX_PRIORITARIAS} de {prioridad.length} personas prioritarias.
                  </p>
                )}
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-ink-2">
                <CircleCheck size={18} className="text-success-700 flex-none" aria-hidden /> Ninguno de tus {misAdultos.length} adultos requiere atención prioritaria ahora.
              </p>
            )}
          </section>
        </div>
      </div>
    </Page>
  )
}

/** Dato del resumen de hoy; con `to` es un enlace (alertas abiertas). */
function Resumen({ etiqueta, valor, alerta, to }: { etiqueta: string; valor: string; alerta?: boolean; to?: string }) {
  const clases = cn(
    'flex flex-col justify-between gap-1 min-h-[72px] px-3 py-2 rounded-sm border',
    alerta ? 'border-danger bg-danger-100' : 'border-blue bg-blue-100',
    to && 'transition-shadow hover:shadow-1',
  )
  const contenido = (
    <>
      <span className="text-xs font-semibold text-ink">{etiqueta}</span>
      <span className={cn('self-end text-2xl font-bold leading-tight', alerta ? 'text-danger' : 'text-ink')}>{valor}</span>
    </>
  )
  return to ? (
    <Link to={to} className={clases}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  )
}
