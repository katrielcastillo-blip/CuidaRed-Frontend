/*
 * routes.tsx — Área del FAMILIAR RESPONSABLE (SRS §13.1 "Módulo de consulta restringida"), solo lectura.
 *   /familiar                           Estado del seguimiento de los adultos de su grupo familiar
 *   /familiar/adultos/:adultoId         Perfil del adulto (pestañas Necesidades | Visitas en ?tab=)
 *   /familiar/visitas/:visitaId         Detalle de visita
 *   /familiar/necesidades/:necesidadId  Detalle de necesidad
 *   /familiar/invitar                   Retirada: las cuentas y accesos los gestiona el administrador → inicio
 *   + perfilRoutes() (Mi perfil) y sistemaRoutes() (ayuda, acerca, sincronización)
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Navigate, type RouteObject } from 'react-router-dom'
import { CircleHelp, House } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'
import { sistemaRoutes } from '@/features/sistema/routes'
import Dashboard from './pages/Dashboard'
import DetalleNecesidad from './pages/DetalleNecesidad'
import DetalleVisita from './pages/DetalleVisita'
import PerfilAdulto from './pages/PerfilAdulto'

const BASE = '/familiar'

const nav: NavItem[] = [
  { to: BASE, label: 'Inicio', icon: House, end: true },
  { to: `${BASE}/ayuda`, label: 'Ayuda', icon: CircleHelp },
]

export const familiarRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="familiar">
      <AppShell nav={nav} base={BASE} perfilPath={`${BASE}/perfil`} />
    </RequireRole>
  ),
  children: [
    { index: true, element: <Dashboard /> },
    { path: 'adultos/:adultoId', element: <PerfilAdulto /> },
    { path: 'visitas/:visitaId', element: <DetalleVisita /> },
    { path: 'necesidades/:necesidadId', element: <DetalleNecesidad /> },
    // Listados sin id y pantallas retiradas: el inicio ya lista a los adultos a cargo.
    { path: 'invitar', element: <Navigate to={BASE} replace /> },
    { path: 'adultos', element: <Navigate to={BASE} replace /> },
    { path: 'visitas', element: <Navigate to={BASE} replace /> },
    { path: 'necesidades', element: <Navigate to={BASE} replace /> },
    ...perfilRoutes(),
    ...sistemaRoutes(),
  ],
}
