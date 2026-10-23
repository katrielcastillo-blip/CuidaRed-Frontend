/*
 * routes.tsx — Área del ADMINISTRADOR (/admin). Navegación: Inicio · Adultos · Usuarios · Alertas · Más.
 * Las pantallas de gestión de usuarios y configuración exigen además su permiso (RequirePermiso) y la capa de
 * servicios vuelve a comprobarlo en cada operación (RF-09 · CU-13 · SRS §8.2.2.3.5 c).
 *   index ................... Panel de administración (visión general de la organización)
 *   miembros ................ Usuarios (lista, búsqueda y filtros por rol/estado)        [usuarios:gestionar]
 *   miembros/nuevo .......... Agregar usuario (invitación o contraseña inicial)          [usuarios:gestionar]
 *   miembros/:usuarioId ..... Perfil de usuario (editar rol, desactivar, eliminar)       [usuarios:gestionar]
 *   roles ................... Roles y permisos (matriz generada desde MATRIZ)            [usuarios:gestionar]
 *   configuracion ........... Datos de la cuenta (Cuenta) y parámetros (Configuracion_Cuenta) [organizacion:configurar]
 *   suscripcion ............. Plan y suscripción: plan, prueba gratuita, uso y pagos      [cuenta:suscripcion]
 *   catalogos ............... Catálogos de la BD (solo lectura)                         [catalogos:ver]
 *   mas ..................... Menú «Más»
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
import AgregarMiembro from './pages/AgregarMiembro'
import Catalogos from './pages/Catalogos'
import Configuracion from './pages/Configuracion'
import Dashboard from './pages/Dashboard'
import Mas from './pages/Mas'
import Miembros from './pages/Miembros'
import PerfilMiembro from './pages/PerfilMiembro'
import Roles from './pages/Roles'
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
    { path: 'miembros', element: con('usuarios:gestionar', <Miembros />) },
    { path: 'miembros/nuevo', element: con('usuarios:gestionar', <AgregarMiembro />) },
    { path: 'miembros/:usuarioId', element: con('usuarios:gestionar', <PerfilMiembro />) },
    { path: 'roles', element: con('usuarios:gestionar', <Roles />) },
    { path: 'configuracion', element: con('organizacion:configurar', <Configuracion />) },
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
