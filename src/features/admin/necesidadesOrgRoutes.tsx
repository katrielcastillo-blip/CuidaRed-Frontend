/*
 * necesidadesOrgRoutes.tsx — Ruta de las necesidades institucionales (Org_Necesidad · CR-186), relativa a la base
 * del rol (admin y coordinador la montan en su área):
 *   necesidades-institucionales ... Lista, registro y cambio de estado · permiso necesidades:ver
 * La pantalla comprueba además la funcionalidad `org_necesidad` del plan (AvisoPlan si no está incluida) y exige el
 * permiso necesidades:registrar y el rol Administrador o Coordinador para escribir.
 * Módulo: admin.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { RouteObject } from 'react-router-dom'
import { RequirePermiso } from '@/app/guards'
import NecesidadesInstitucionales from './pages/NecesidadesInstitucionales'

export function necesidadesOrgRoutes(): RouteObject[] {
  return [
    {
      path: 'necesidades-institucionales',
      element: (
        <RequirePermiso accion="necesidades:ver">
          <NecesidadesInstitucionales />
        </RequirePermiso>
      ),
    },
  ]
}
