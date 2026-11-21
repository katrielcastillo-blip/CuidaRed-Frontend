/*
 * cuentaRoutes.tsx — Rutas de gestión de la cuenta, compartidas por quien la administra: el ADMINISTRADOR en una
 * Organización (/admin) y el COORDINADOR en una cuenta Familia (/coordinador). Son rutas RELATIVAS a la base del rol
 * (los enlaces internos usan `useShell().base`, nunca «/admin» fijo) y cada una exige su permiso con <RequirePermiso>:
 * `usuarios:gestionar` (Administrador en Organización · Coordinador en Familia) y `organizacion:configurar`. La capa de
 * servicios (domain/api/usuarios) vuelve a comprobar el permiso y la cuenta en cada operación (CU-13 · RNF-3.3).
 *   miembros ................ Miembros de la cuenta (lista, búsqueda y filtros por rol/estado)       [usuarios:gestionar]
 *   miembros/nuevo .......... Agregar miembro (invitación con código, o contraseña inicial)         [usuarios:gestionar]
 *   miembros/:usuarioId ..... Perfil: cambiar rol, activar/desactivar y adultos que puede ver       [usuarios:gestionar]
 *   configuracion ........... Datos de la cuenta y parámetros                                       [organizacion:configurar]
 *   roles ................... Roles y permisos del tipo de cuenta (matriz)                          [usuarios:gestionar]
 * Módulo: admin (RF-09 · CU-13 · Reglas de Negocio V2 §Cuenta).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'
import { RequirePermiso } from '@/app/guards'
import type { Accion } from '@/domain/permisos'
import AgregarMiembro from './pages/AgregarMiembro'
import Configuracion from './pages/Configuracion'
import Miembros from './pages/Miembros'
import PerfilMiembro from './pages/PerfilMiembro'
import Roles from './pages/Roles'

const con = (accion: Accion, el: ReactNode) => <RequirePermiso accion={accion}>{el}</RequirePermiso>

export function cuentaRoutes(): RouteObject[] {
  return [
    { path: 'miembros', element: con('usuarios:gestionar', <Miembros />) },
    { path: 'miembros/nuevo', element: con('usuarios:gestionar', <AgregarMiembro />) },
    { path: 'miembros/:usuarioId', element: con('usuarios:gestionar', <PerfilMiembro />) },
    { path: 'configuracion', element: con('organizacion:configurar', <Configuracion />) },
    { path: 'roles', element: con('usuarios:gestionar', <Roles />) },
  ]
}
