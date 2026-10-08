import { Navigate, type RouteObject } from 'react-router-dom'
import { House } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'
import Dashboard from './pages/Dashboard'
import DetalleNecesidad from './pages/DetalleNecesidad'
import DetalleVisita from './pages/DetalleVisita'
import Invitar from './pages/Invitar'
import PerfilAdulto from './pages/PerfilAdulto'

const BASE = '/familiar'

/** El menú del Figma del familiar tiene un único ítem: "Inicio" (icono home). */
const nav: NavItem[] = [{ to: BASE, label: 'Inicio', icon: House, end: true }]

/**
 * Área del FAMILIAR (sección Figma "Prototipo Funcional (Familiar)", 285:439). Dueño: agente FAMILIAR.
 *   /familiar                    Pantalla Dashboard (285:606) + overlay de invitación recibida (358:3520)
 *   /familiar/invitar            Invitar a la familia (lado emisor de la invitación)
 *   /familiar/adultos/:adultoId  Pantalla Perfil Envejeciente (358:3206 · 358:3354), pestañas Necesidades | Visitas (?tab=)
 *   /familiar/visitas/:visitaId  Pantalla Detalle Visita (322:2073), solo lectura
 *   /familiar/necesidades/:necesidadId  Pantalla Detalle Necesidad (358:1513), solo lectura
 *   /familiar/perfil[/editar]    Mi Perfil / Editar Mi Perfil (agente AUTH)
 */
export const familiarRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="familiar">
      <AppShell nav={nav} base={BASE} perfilPath={`${BASE}/perfil`} />
    </RequireRole>
  ),
  children: [
    { index: true, element: <Dashboard /> },
    { path: 'invitar', element: <Invitar /> },
    { path: 'adultos/:adultoId', element: <PerfilAdulto /> },
    { path: 'visitas/:visitaId', element: <DetalleVisita /> },
    { path: 'necesidades/:necesidadId', element: <DetalleNecesidad /> },
    // Listados sin id: el dashboard ya lista los adultos, así que no quedan URLs muertas.
    { path: 'adultos', element: <Navigate to={BASE} replace /> },
    { path: 'visitas', element: <Navigate to={BASE} replace /> },
    { path: 'necesidades', element: <Navigate to={BASE} replace /> },
    ...perfilRoutes(),
  ],
}
