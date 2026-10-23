/*
 * routes.tsx — Pantallas de sistema que cada rol monta dentro de su área:
 *   sincronizacion  Conexión, registros pendientes y resultado de la sincronización (RF-10 · CU-14)
 *   acerca          Acerca de CuidaRed: versión, equipo, contexto académico, créditos (SRS §18.3)
 *   ayuda           Ayuda en línea / guía rápida por rol (SRS §8.2.2.1.8)
 *   auditoria       Registro de auditoría (solo administrador, SRS §8.2.2.1.3)
 *   *               Página no encontrada dentro del área
 * Módulo: sistema.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { RouteObject } from 'react-router-dom'
import { RequirePermiso } from '@/app/guards'
import AcercaDe from './pages/AcercaDe'
import Auditoria from './pages/Auditoria'
import Ayuda from './pages/Ayuda'
import NoEncontrada from './pages/NoEncontrada'
import Sincronizacion from './pages/Sincronizacion'

export function sistemaRoutes(): RouteObject[] {
  return [
    { path: 'sincronizacion', element: <Sincronizacion /> },
    { path: 'acerca', element: <AcercaDe /> },
    { path: 'ayuda', element: <Ayuda /> },
    {
      path: 'auditoria',
      element: (
        <RequirePermiso accion="auditoria:ver">
          <Auditoria />
        </RequirePermiso>
      ),
    },
    // Cualquier otra ruta del área: "Página no encontrada" (debe ir al final).
    { path: '*', element: <NoEncontrada /> },
  ]
}
