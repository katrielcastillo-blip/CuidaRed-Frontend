/*
 * routes.tsx — Agenda de cuidado (tablas Tarea_agenda y Evidencias), compartida por administrador,
 * coordinador y voluntario. Rutas relativas a la base del rol:
 *   agenda                 Lista de tareas (hoy, próximas, completadas) con filtros
 *   agenda/nueva           Crear tarea (permiso agenda:gestionar)
 *   agenda/:tareaId        Detalle: estado, evidencias (subir / validar)
 *   agenda/:tareaId/editar Editar tarea (permiso agenda:gestionar)
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { RouteObject } from 'react-router-dom'
import { RequirePermiso } from '@/app/guards'
import AgendaPage from './pages/AgendaPage'
import TareaDetallePage from './pages/TareaDetallePage'
import TareaFormPage from './pages/TareaFormPage'

export function agendaRoutes(): RouteObject[] {
  return [
    {
      path: 'agenda',
      element: (
        <RequirePermiso accion="agenda:ver">
          <AgendaPage />
        </RequirePermiso>
      ),
    },
    {
      path: 'agenda/nueva',
      element: (
        <RequirePermiso accion="agenda:gestionar">
          <TareaFormPage />
        </RequirePermiso>
      ),
    },
    {
      path: 'agenda/:tareaId',
      element: (
        <RequirePermiso accion="agenda:ver">
          <TareaDetallePage />
        </RequirePermiso>
      ),
    },
    {
      path: 'agenda/:tareaId/editar',
      element: (
        <RequirePermiso accion="agenda:gestionar">
          <TareaFormPage />
        </RequirePermiso>
      ),
    },
  ]
}
