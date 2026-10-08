import type { RouteObject } from 'react-router-dom'
import { Ellipsis, House, PersonStanding, Users } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'
import { gestionRoutes } from '@/features/gestion/routes'
import AgregarMiembro from './pages/AgregarMiembro'
import Configuracion from './pages/Configuracion'
import Dashboard from './pages/Dashboard'
import Mas from './pages/Mas'
import Miembros from './pages/Miembros'
import PerfilMiembro from './pages/PerfilMiembro'

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
    { index: true, element: <Dashboard /> },
    { path: 'miembros', element: <Miembros /> },
    { path: 'miembros/nuevo', element: <AgregarMiembro /> },
    { path: 'miembros/:usuarioId', element: <PerfilMiembro /> },
    { path: 'mas', element: <Mas /> },
    { path: 'configuracion', element: <Configuracion /> },
    ...gestionRoutes(),
    ...perfilRoutes(),
  ],
}
