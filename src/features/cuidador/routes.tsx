import type { RouteObject } from 'react-router-dom'
import { BriefcaseMedical, House, PersonStanding } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { Placeholder } from '@/app/Placeholder'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'
import { visitasRoutes } from '@/features/visitas/routes'

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
    { index: true, element: <Placeholder name="Dashboard cuidador" /> },
    { path: 'invitacion', element: <Placeholder name="Invitación" /> },
    { path: 'adultos', element: <Placeholder name="Mis Adultos Mayores" /> },
    { path: 'adultos/:adultoId', element: <Placeholder name="Perfil Envejeciente" /> },
    { path: 'visitas', element: <Placeholder name="Mis Visitas" /> },
    ...visitasRoutes(),
    ...perfilRoutes(),
  ],
}
