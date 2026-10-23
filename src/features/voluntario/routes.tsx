/*
 * routes.tsx — Área del VOLUNTARIO (Interfaz móvil de campo, SRS §13.1). Navegación: Inicio · Adultos · Visitas · Agenda.
 *   index ................ Inicio: visitas y tareas de hoy, próximas visitas, adultos asignados, aviso de conexión
 *   adultos .............. Mis adultos mayores (solo los vinculados como «voluntario asignado»)
 *   adultos/:adultoId .... Perfil del adulto (CU-04) con historial y acciones
 *   visitas .............. Mis visitas: hoy, próximas, historial
 *   agenda ............... agendaRoutes(): tareas asignadas a su perfil de cuidador (Tarea_agenda, Evidencias)
 *   + visitasRoutes() (CU-05 a CU-08), perfil y pantallas de sistema (sincronización, ayuda…).
 * Las asignaciones de adultos las hace el coordinador o el administrador (RBAC): no hay invitaciones.
 * Módulo: voluntario.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { RouteObject } from 'react-router-dom'
import { BriefcaseMedical, CalendarCheck, House, PersonStanding } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { agendaRoutes } from '@/features/agenda/routes'
import { perfilRoutes } from '@/features/perfil/routes'
import { sistemaRoutes } from '@/features/sistema/routes'
import { visitasRoutes } from '@/features/visitas/routes'
import { Dashboard } from './pages/Dashboard'
import { MisAdultos } from './pages/MisAdultos'
import { MisVisitas } from './pages/MisVisitas'
import { PerfilEnvejeciente } from './pages/PerfilEnvejeciente'

const BASE = '/voluntario'
const nav: NavItem[] = [
  { to: BASE, label: 'Inicio', icon: House, end: true },
  { to: `${BASE}/adultos`, label: 'Adultos', icon: PersonStanding },
  { to: `${BASE}/visitas`, label: 'Visitas', icon: BriefcaseMedical },
  { to: `${BASE}/agenda`, label: 'Agenda', icon: CalendarCheck },
]

export const voluntarioRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="voluntario">
      <AppShell nav={nav} base={BASE} perfilPath={`${BASE}/perfil`} />
    </RequireRole>
  ),
  children: [
    { index: true, element: <Dashboard /> },
    { path: 'adultos', element: <MisAdultos /> },
    { path: 'adultos/:adultoId', element: <PerfilEnvejeciente /> },
    { path: 'visitas', element: <MisVisitas /> },
    ...visitasRoutes(),
    ...agendaRoutes(),
    ...perfilRoutes(),
    ...sistemaRoutes(),
  ],
}
