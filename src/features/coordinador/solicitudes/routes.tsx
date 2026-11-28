/*
 * routes.tsx — Rutas del módulo de solicitudes de visita (visitantes externos), compartido por el área del
 * COORDINADOR y la del ADMINISTRADOR. Ambas rutas exigen el permiso visitas:autorizar con <RequirePermiso>
 * (Administrador, o Coordinador en una cuenta Familia); la capa de servicios vuelve a comprobarlo al decidir.
 * Rutas relativas a la base del rol (los enlaces internos se construyen con `useShell().base`):
 *   solicitudes ................. Lista (pendientes primero, filtro por estado)      [visitas:autorizar]
 *   solicitudes/:solicitudId .... Detalle: datos del visitante, autorizar o rechazar [visitas:autorizar]
 * Módulo: coordinador · solicitudes de visita.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { RouteObject } from 'react-router-dom'
import { RequirePermiso } from '@/app/guards'
import { SolicitudDetallePage } from './SolicitudDetallePage'
import { SolicitudesPage } from './SolicitudesPage'

export function solicitudesRoutes(): RouteObject[] {
  return [
    {
      path: 'solicitudes',
      element: (
        <RequirePermiso accion="visitas:autorizar">
          <SolicitudesPage />
        </RequirePermiso>
      ),
    },
    {
      path: 'solicitudes/:solicitudId',
      element: (
        <RequirePermiso accion="visitas:autorizar">
          <SolicitudDetallePage />
        </RequirePermiso>
      ),
    },
  ]
}
