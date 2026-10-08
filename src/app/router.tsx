import { createBrowserRouter, Navigate } from 'react-router-dom'
import { authRoutes } from '@/features/auth/routes'
import { cuidadorRoutes } from '@/features/cuidador/routes'
import { familiarRoutes } from '@/features/familiar/routes'
import { adminRoutes } from '@/features/admin/routes'
import { coordinadorRoutes } from '@/features/coordinador/routes'

/**
 * Mapa de rutas. Cada área es dueña de su archivo routes.tsx:
 *   públicas (auth) ........ features/auth/routes.tsx         → "/", "/inicio", "/registro", …
 *   /cuidador/* ............ features/cuidador/routes.tsx
 *   /familiar/* ............ features/familiar/routes.tsx
 *   /admin/* ............... features/admin/routes.tsx
 *   /coordinador/* ......... features/coordinador/routes.tsx
 * Módulos compartidos que los roles montan dentro de su área:
 *   perfilRoutes()  (features/perfil)   → perfil, perfil/editar
 *   visitasRoutes() (features/visitas)  → visitas/nueva, visitas/:visitaId, necesidades/nueva, necesidades/:necesidadId
 *   gestionRoutes() (features/gestion)  → adultos…, alertas…, reportes
 */
export const router = createBrowserRouter([
  ...authRoutes,
  cuidadorRoutes,
  familiarRoutes,
  adminRoutes,
  coordinadorRoutes,
  { path: '*', element: <Navigate to="/" replace /> },
])
