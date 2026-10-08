import type { RouteObject } from 'react-router-dom'
import { BriefcaseMedical, Ellipsis, House, PersonStanding } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { Placeholder } from '@/app/Placeholder'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'
import { gestionRoutes } from '@/features/gestion/routes'
import { visitasRoutes } from '@/features/visitas/routes'

const BASE = '/coordinador'
const nav: NavItem[] = [
  { to: BASE, label: 'Inicio', icon: House, end: true },
  { to: `${BASE}/adultos`, label: 'Adultos', icon: PersonStanding },
  { to: `${BASE}/visitas`, label: 'Visitas', icon: BriefcaseMedical },
  { to: `${BASE}/mas`, label: 'Más', icon: Ellipsis },
]

/** Área del COORDINADOR (sección Figma "Prototipo Funcional (Coordinador)"). Dueño: agente COORDINADOR. */
export const coordinadorRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="coordinador">
      <AppShell nav={nav} base={BASE} perfilPath={`${BASE}/perfil`} />
    </RequireRole>
  ),
  children: [
    { index: true, element: <Placeholder name="Dashboard coordinador" /> },
    { path: 'visitas', element: <Placeholder name="Visitas" /> },
    { path: 'mas', element: <Placeholder name="Más" /> },
    ...visitasRoutes(),
    ...gestionRoutes(),
    ...perfilRoutes(),
  ],
}
