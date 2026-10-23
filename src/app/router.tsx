/*
 * router.tsx — Mapa de rutas de la aplicación.
 * Módulo: app.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Cada área es dueña de su archivo routes.tsx:
 *   públicas (auth) ........ features/auth/routes.tsx         → "/", "/inicio", "/registro", …
 *   /voluntario/* .......... features/voluntario/routes.tsx
 *   /familiar/* ............ features/familiar/routes.tsx
 *   /admin/* ............... features/admin/routes.tsx
 *   /coordinador/* ......... features/coordinador/routes.tsx
 * Módulos compartidos que los roles montan dentro de su área:
 *   perfilRoutes()   (features/perfil)   → perfil, perfil/editar
 *   visitasRoutes()  (features/visitas)  → visitas/nueva, visitas/:visitaId, necesidades/nueva, necesidades/:necesidadId
 *   gestionRoutes()  (features/gestion)  → adultos…, alertas…, resumen, reportes
 *   sistemaRoutes()  (features/sistema)  → sincronizacion, acerca, ayuda, auditoria
 * Cualquier error inesperado de una pantalla muestra ErrorRuta (sin detalles técnicos).
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { authRoutes } from '@/features/auth/routes'
import { voluntarioRoutes } from '@/features/voluntario/routes'
import { familiarRoutes } from '@/features/familiar/routes'
import { adminRoutes } from '@/features/admin/routes'
import { coordinadorRoutes } from '@/features/coordinador/routes'
import ErrorRuta from '@/features/sistema/pages/ErrorRuta'

const conError = (r: RouteObject): RouteObject => ({ ...r, errorElement: <ErrorRuta /> })

export const router = createBrowserRouter([
  ...authRoutes.map(conError),
  conError(voluntarioRoutes),
  conError(familiarRoutes),
  conError(adminRoutes),
  conError(coordinadorRoutes),
  // Enlaces antiguos del rol "cuidador" (ahora "voluntario", según el SRS).
  { path: '/cuidador/*', element: <Navigate to="/voluntario" replace /> },
  { path: '*', element: <Navigate to="/" replace /> },
])
