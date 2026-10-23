/*
 * routes.tsx — Área del COORDINADOR (panel de gestión y supervisión, SRS §13.1).
 * Navegación: Inicio · Adultos · Visitas · Alertas (contador de alertas sin atender) · Más.
 *   index ................. Panel de gestión (KPIs, urgencias, sin visita reciente, visitas de hoy)
 *   visitas ............... Agenda de visitas (hoy / próximas / historial)
 *   visitas/programar ..... Programar visita (antes de visitasRoutes() para no chocar con visitas/:visitaId)
 *   mas ................... Más opciones (incluye Agenda)
 *   + agendaRoutes() (agenda, agenda/nueva, agenda/:tareaId, agenda/:tareaId/editar: Tarea_agenda y Evidencias)
 *   + visitasRoutes(), gestionRoutes() (adultos, alertas, resumen, reportes), perfilRoutes(), sistemaRoutes()
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import type { RouteObject } from 'react-router-dom'
import { BellRing, BriefcaseMedical, Ellipsis, House, PersonStanding } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { alertasVisibles } from '@/domain/api'
import { useSession } from '@/domain/auth'
import { useDB } from '@/domain/store'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'
import { sistemaRoutes } from '@/features/sistema/routes'
import { gestionRoutes } from '@/features/gestion/routes'
import { visitasRoutes } from '@/features/visitas/routes'
import { agendaRoutes } from '@/features/agenda/routes'
import { DashboardPage } from './DashboardPage'
import { MasPage } from './MasPage'
import { ProgramarVisitaPage } from './ProgramarVisitaPage'
import { VisitasPage } from './VisitasPage'

const BASE = '/coordinador'

/** Shell con la navegación del coordinador; el ítem Alertas muestra las alertas visibles sin atender. */
function CoordinadorShell() {
  const { user } = useSession()
  const alertas = useDB((s) => s.alertas)
  const adultos = useDB((s) => s.adultos)
  const sinAtender = useMemo(() => alertasVisibles({ alertas, adultos }, user).filter((a) => a.estado !== 'atendida').length, [alertas, adultos, user])

  const nav: NavItem[] = useMemo(
    () => [
      { to: BASE, label: 'Inicio', icon: House, end: true },
      { to: `${BASE}/adultos`, label: 'Adultos', icon: PersonStanding },
      { to: `${BASE}/visitas`, label: 'Visitas', icon: BriefcaseMedical },
      { to: `${BASE}/alertas`, label: 'Alertas', icon: BellRing, badge: sinAtender },
      { to: `${BASE}/mas`, label: 'Más', icon: Ellipsis },
    ],
    [sinAtender],
  )
  return <AppShell nav={nav} base={BASE} perfilPath={`${BASE}/perfil`} />
}

export const coordinadorRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="coordinador">
      <CoordinadorShell />
    </RequireRole>
  ),
  children: [
    { index: true, element: <DashboardPage /> },
    { path: 'visitas', element: <VisitasPage /> },
    { path: 'visitas/programar', element: <ProgramarVisitaPage /> },
    { path: 'mas', element: <MasPage /> },
    ...agendaRoutes(),
    ...visitasRoutes(),
    ...gestionRoutes(),
    ...perfilRoutes(),
    ...sistemaRoutes(),
  ],
}
