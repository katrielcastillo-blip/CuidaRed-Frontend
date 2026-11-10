/*
 * routes.tsx — Área del ADMINISTRADOR (/admin, cuentas Organización). Navegación: Inicio · Adultos · Miembros · Alertas · Más.
 * Los módulos administrativos son solo de este rol (RNF-3.3): el área exige el rol (RequireRole), cada pantalla exige
 * además su permiso (RequirePermiso) y la capa de servicios vuelve a comprobarlo en cada operación (RF-09 · CU-13 ·
 * SRS §8.2.2.3.5 c).
 *   index ................... Inicio: indicadores, alertas activas, uso del plan y accesos a los módulos
 *   mas ..................... Menú «Más opciones» (cada entrada se filtra con puede())
 *   suscripcion ............. Plan y suscripción: plan, prueba gratuita, uso y pagos      [cuenta:suscripcion]
 *   catalogos ............... Catálogos de la BD (solo lectura)                         [catalogos:ver]
 *   + cuentaRoutes() ........ miembros, miembros/nuevo, miembros/:usuarioId, roles y configuracion
 *                             (compartidas con el Coordinador de una cuenta Familia)
 *   + agendaRoutes() (Tarea_agenda y Evidencias), visitasRoutes() (detalle de visitas/necesidades),
 *     gestionRoutes() (adultos, alertas, resumen, reportes), perfilRoutes() y sistemaRoutes() (auditoría,
 *     sincronización, ayuda, acerca).
 * Módulo: admin.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'
import { RequirePermiso, RequireRole } from '@/app/guards'
import type { Accion } from '@/domain/permisos'
import { agendaRoutes } from '@/features/agenda/routes'
import { perfilRoutes } from '@/features/perfil/routes'
import { sistemaRoutes } from '@/features/sistema/routes'
import { gestionRoutes } from '@/features/gestion/routes'
import { visitasRoutes } from '@/features/visitas/routes'
import { AdminShell, BASE_ADMIN } from './components/AdminShell'
import { cuentaRoutes } from './cuentaRoutes'
import { necesidadesOrgRoutes } from './necesidadesOrgRoutes'
import { solicitudesRoutes } from '@/features/coordinador/solicitudes/routes'
import Catalogos from './pages/Catalogos'
import Dashboard from './pages/Dashboard'
import Mas from './pages/Mas'
import Suscripcion from './pages/Suscripcion'

const con = (accion: Accion, el: ReactNode) => <RequirePermiso accion={accion}>{el}</RequirePermiso>

export const adminRoutes: RouteObject = {
  path: BASE_ADMIN,
  element: (
    <RequireRole rol="admin">
      <AdminShell />
    </RequireRole>
  ),
  children: [
    { index: true, element: <Dashboard /> },
    ...cuentaRoutes(),
    // Solicitudes de visita de personas externas (V2: el usuario principal las autoriza) y necesidades institucionales.
    ...solicitudesRoutes(),
    ...necesidadesOrgRoutes(),
    { path: 'suscripcion', element: con('cuenta:suscripcion', <Suscripcion />) },
    { path: 'catalogos', element: con('catalogos:ver', <Catalogos />) },
    { path: 'mas', element: <Mas /> },
    ...agendaRoutes(),
    ...visitasRoutes(),
    ...gestionRoutes(),
    ...perfilRoutes(),
    ...sistemaRoutes(),
  ],
}
