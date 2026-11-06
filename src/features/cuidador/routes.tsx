/*
 * routes.tsx — Área del CUIDADOR (Interfaz móvil de campo, SRS §13.1). Navegación: Inicio · Adultos · Visitas · Agenda.
 *   index ................ Inicio: tareas del día, acciones rápidas, personas prioritarias, visitas de hoy y próximas, aviso de conexión
 *   adultos .............. Mis adultos mayores de la cuenta activa (solo los vinculados como «cuidador asignado»), con filtros
 *   adultos/:adultoId .... Perfil del adulto (CU-04): datos, riesgo (solo lectura), indicaciones, agenda, historial y acciones
 *   visitas .............. Mis visitas: hoy, próximas, historial
 *   agenda ............... agendaRoutes(): tareas asignadas a su perfil de cuidador (Tarea_agenda, Evidencias)
 *   alertas, alertas/:id . (por montar) alertas de sus adultos asignados; el cuidador las cierra con la acción tomada
 *   + visitasRoutes() (CU-05 a CU-08), perfil y pantallas de sistema (sincronización, ayuda…).
 * Las asignaciones de adultos las hace el coordinador o el administrador (RBAC): no hay invitaciones.
 * Módulo: cuidador.
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
import { alertasRoutes } from '@/features/gestion/routes'
import { Dashboard } from './pages/Dashboard'
import { MisAdultos } from './pages/MisAdultos'
import { MisVisitas } from './pages/MisVisitas'
import { PerfilEnvejeciente } from './pages/PerfilEnvejeciente'

const BASE = '/cuidador'
const nav: NavItem[] = [
  { to: BASE, label: 'Inicio', icon: House, end: true },
  { to: `${BASE}/adultos`, label: 'Adultos', icon: PersonStanding },
  { to: `${BASE}/visitas`, label: 'Visitas', icon: BriefcaseMedical },
  { to: `${BASE}/agenda`, label: 'Agenda', icon: CalendarCheck },
]

export const cuidadorRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="cuidador">
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
    // Alertas de sus adultos asignados (gestión): el cuidador solo puede cerrarlas con la acción tomada (V2).
    ...alertasRoutes(),
    ...perfilRoutes(),
    ...sistemaRoutes(),
  ],
}
