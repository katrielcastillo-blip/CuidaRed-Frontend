/*
 * router.tsx — Mapa de rutas de la aplicación.
 * Módulo: app.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Cada área es dueña de su archivo routes.tsx (un área por rol, Reglas de Negocio V2):
 *   públicas (auth) ........ features/auth/routes.tsx         → "/", "/inicio", "/registro", …
 *   /cuidador/* ............ features/cuidador/routes.tsx     (Cuidador: trabajo de campo completo)
 *   /voluntario/* .......... features/voluntario/routes.tsx   (Voluntario: vista mínima, solo visita + observación)
 *   /familiar/* ............ features/familiar/routes.tsx
 *   /admin/* ............... features/admin/routes.tsx        (alias /administrador)
 *   /coordinador/* ......... features/coordinador/routes.tsx
 * Módulos compartidos que los roles montan dentro de su área:
 *   perfilRoutes()   (features/perfil)   → perfil, perfil/editar
 *   visitasRoutes()  (features/visitas)  → visitas/nueva, visitas/:visitaId, necesidades/nueva, necesidades/:necesidadId
 *   gestionRoutes()  (features/gestion)  → adultos…, alertas…, resumen, reportes
 *   sistemaRoutes()  (features/sistema)  → sincronizacion, acerca, ayuda, auditoria
 * Cada área está protegida por RequireRole (acceso directo por URL bloqueado, RS-014) y cada pantalla sensible
 * por RequirePermiso. Cualquier error inesperado de una pantalla muestra ErrorRuta (sin detalles técnicos).
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { authRoutes } from '@/features/auth/routes'
import { cuidadorRoutes } from '@/features/cuidador/routes'
import { voluntarioRoutes } from '@/features/voluntario/routes'
import { familiarRoutes } from '@/features/familiar/routes'
import { adminRoutes } from '@/features/admin/routes'
import { coordinadorRoutes } from '@/features/coordinador/routes'
import ErrorRuta from '@/features/sistema/pages/ErrorRuta'

const conError = (r: RouteObject): RouteObject => ({ ...r, errorElement: <ErrorRuta /> })

export const router = createBrowserRouter([
  ...authRoutes.map(conError),
  conError(cuidadorRoutes),
  conError(voluntarioRoutes),
  conError(familiarRoutes),
  conError(adminRoutes),
  conError(coordinadorRoutes),
  // Nombre largo del área de administración usado en la documentación.
  { path: '/administrador/*', element: <Navigate to="/admin" replace /> },
  { path: '*', element: <Navigate to="/" replace /> },
])
