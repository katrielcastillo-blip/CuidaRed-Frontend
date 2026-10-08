import type { RouteObject } from 'react-router-dom'
import { BriefcaseMedical, House, PersonStanding } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'
import { visitasRoutes } from '@/features/visitas/routes'
import { Dashboard, InvitacionRuta } from './pages/Dashboard'
import { MisAdultos } from './pages/MisAdultos'
import { MisVisitas } from './pages/MisVisitas'
import { PerfilEnvejeciente } from './pages/PerfilEnvejeciente'

const BASE = '/cuidador'
const nav: NavItem[] = [
  { to: BASE, label: 'Inicio', icon: House, end: true },
  { to: `${BASE}/adultos`, label: 'Adultos', icon: PersonStanding },
  { to: `${BASE}/visitas`, label: 'Visitas', icon: BriefcaseMedical },
]

/** Área del CUIDADOR (sección Figma "Prototipo Funcional (Cuidador)"). Dueño: agente CUIDADOR. */
export const cuidadorRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="cuidador">
      <AppShell nav={nav} base={BASE} perfilPath={`${BASE}/perfil`} />
    </RequireRole>
  ),
  children: [
    { index: true, element: <Dashboard /> },
    { path: 'invitacion', element: <InvitacionRuta /> },
    { path: 'adultos', element: <MisAdultos /> },
    { path: 'adultos/:adultoId', element: <PerfilEnvejeciente /> },
    { path: 'visitas', element: <MisVisitas /> },
    ...visitasRoutes(),
    ...perfilRoutes(),
  ],
}
