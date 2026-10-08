import type { RouteObject } from 'react-router-dom'
import EditarPerfil from './pages/EditarPerfil'
import MiPerfil from './pages/MiPerfil'

/**
 * Mi Perfil / Editar Mi Perfil — compartido por los 4 roles (cada rol lo monta dentro de su área).
 * Usa useSession() para el usuario y useShell().base para enlaces. Dueño: agente AUTH.
 */
export function perfilRoutes(): RouteObject[] {
  return [
    { path: 'perfil', element: <MiPerfil /> },
    { path: 'perfil/editar', element: <EditarPerfil /> },
  ]
}
