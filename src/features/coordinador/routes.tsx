import type { RouteObject } from 'react-router-dom'
import { BriefcaseMedical, Ellipsis, House, PersonStanding } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'
import { gestionRoutes } from '@/features/gestion/routes'
import { visitasRoutes } from '@/features/visitas/routes'
import { DashboardPage } from './DashboardPage'
import { MasPage } from './MasPage'
import { ProgramarVisitaPage } from './ProgramarVisitaPage'
import { VisitasPage } from './VisitasPage'

const BASE = '/coordinador'
/** Bottom-nav del Figma del coordinador: Inicio · Adultos · Visitas · Más. */
const nav: NavItem[] = [
  { to: BASE, label: 'Inicio', icon: House, end: true },
  { to: `${BASE}/adultos`, label: 'Adultos', icon: PersonStanding },
  { to: `${BASE}/visitas`, label: 'Visitas', icon: BriefcaseMedical },
  { to: `${BASE}/mas`, label: 'Más', icon: Ellipsis },
]

/**
 * Área del COORDINADOR (sección Figma "Prototipo Funcional (Coordinador)"). Dueño: agente COORDINADOR.
 *   index ................. Dashboard coordinador (487:439)
 *   visitas ............... Visitas coord (491:2943)
 *   visitas/programar ..... Programar visita (formulario propio; va antes de visitasRoutes() para no chocar con visitas/:visitaId)
 *   mas ................... Más coord (487:1447)
 */
export const coordinadorRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="coordinador">
      <AppShell nav={nav} base={BASE} perfilPath={`${BASE}/perfil`} />
    </RequireRole>
  ),
  children: [
    { index: true, element: <DashboardPage /> },
    { path: 'visitas', element: <VisitasPage /> },
    { path: 'visitas/programar', element: <ProgramarVisitaPage /> },
    { path: 'mas', element: <MasPage /> },
    ...visitasRoutes(),
    ...gestionRoutes(),
    ...perfilRoutes(),
  ],
}
