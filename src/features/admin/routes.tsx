import type { RouteObject } from 'react-router-dom'
import { Ellipsis, House, PersonStanding, Users } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { Placeholder } from '@/app/Placeholder'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'
import { gestionRoutes } from '@/features/gestion/routes'

const BASE = '/admin'
const nav: NavItem[] = [
  { to: BASE, label: 'Inicio', icon: House, end: true },
  { to: `${BASE}/adultos`, label: 'Adultos', icon: PersonStanding },
  { to: `${BASE}/miembros`, label: 'Miembros', icon: Users },
  { to: `${BASE}/mas`, label: 'Más', icon: Ellipsis },
]

/** Área del ADMINISTRADOR (sección Figma "Prototipo Funcional (Administrador)"). Dueño: agente ADMIN. */
export const adminRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="admin">
      <AppShell nav={nav} base={BASE} perfilPath={`${BASE}/perfil`} />
    </RequireRole>
  ),
  children: [
    { index: true, element: <Placeholder name="Dashboard admin" /> },
    { path: 'miembros', element: <Placeholder name="Miembros" /> },
    { path: 'mas', element: <Placeholder name="Más" /> },
    ...gestionRoutes(),
    ...perfilRoutes(),
  ],
}
