/*
 * routes.tsx — Mi perfil y Editar perfil, compartidos por los 4 roles (cada rol las monta dentro de su área).
 * Módulo: perfil.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { RouteObject } from 'react-router-dom'
import EditarPerfil from './pages/EditarPerfil'
import MiPerfil from './pages/MiPerfil'

export function perfilRoutes(): RouteObject[] {
  return [
    { path: 'perfil', element: <MiPerfil /> },
    { path: 'perfil/editar', element: <EditarPerfil /> },
  ]
}
