/*
 * routes.tsx — Rutas de visitas y necesidades, compartidas por voluntario y coordinador (cada uno las monta
 * en su área). Rutas relativas a la base del rol:
 *   visitas/nueva?adulto=:id|?visita=:id   Registrar visita (CU-05)         · permiso visitas:registrar
 *   visitas/:visitaId                      Detalle de visita (CU-06)         · alcance del adulto
 *   necesidades/nueva?adulto=:id&visita=   Registrar necesidad (CU-07)       · permiso necesidades:registrar
 *   necesidades/:necesidadId               Detalle de necesidad (CU-08)      · alcance del adulto
 * Los detalles comprueban el alcance (alcanzaAdulto) y muestran "No encontrado o sin permiso".
 * Módulo: visitas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { RouteObject } from 'react-router-dom'
import { RequirePermiso } from '@/app/guards'
import { DetalleNecesidad } from './pages/DetalleNecesidad'
import { DetalleVisita } from './pages/DetalleVisita'
import { RegistrarNecesidad } from './pages/RegistrarNecesidad'
import { RegistrarVisita } from './pages/RegistrarVisita'

export function visitasRoutes(): RouteObject[] {
  return [
    {
      path: 'visitas/nueva',
      element: (
        <RequirePermiso accion="visitas:registrar">
          <RegistrarVisita />
        </RequirePermiso>
      ),
    },
    { path: 'visitas/:visitaId', element: <DetalleVisita /> },
    {
      path: 'necesidades/nueva',
      element: (
        <RequirePermiso accion="necesidades:registrar">
          <RegistrarNecesidad />
        </RequirePermiso>
      ),
    },
    { path: 'necesidades/:necesidadId', element: <DetalleNecesidad /> },
  ]
}
