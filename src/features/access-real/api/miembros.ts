/*
 * miembros.ts — Cliente tipado de miembros, invitaciones, roles, titularidad y perfiles de Cuidador (fase 2, bloque 2c).
 * Módulo: access-real · API.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Contrato: CuidaRed-Backend/docs/contratos/miembros.md. Los ids de cuenta y membresía viajan como texto. El rol
 * del backend es `administrador`. La cédula nunca se devuelve. Cada operación la vuelve a autorizar el servidor.
 */
import { api, apiPage, type RolCuenta } from '../client'
import type { PaginatedResponse } from '../../../lib/api-contract'

export type EstadoMembresia = 'pendiente' | 'activa' | 'inactiva'

/** Perfil Cuidador vigente de la persona en la cuenta (RF-12). */
export interface PerfilCuidador {
  cuidador_id: string
  tipo_cuidado_id: number
  tipo_cuidado: string | null
  cuidador_independiente: boolean
  usuario_empleador_id: string | null
  fecha_inicio: string | null
}

export interface Miembro {
  membresia_id: string
  rol: RolCuenta
  estado: EstadoMembresia
  fecha_inicio: string | null
  fecha_fin: string | null
  es_titular: boolean
  usuario: { id: string; nombres: string; apellidos: string; correo: string; telefono: string | null }
  cuidador: PerfilCuidador | null
}

/** Miembro creado al invitar: `usuario_existente` indica si la persona ya tenía perfil en CuidaRed. */
export interface MiembroInvitado extends Miembro {
  usuario_existente: boolean
}

export interface DatosInvitacion {
  correo: string
  cedula: string
  nombres: string
  apellidos: string
  rol: RolCuenta
}

export interface FiltroMiembros {
  rol?: RolCuenta
  estado?: EstadoMembresia
  page?: number
  limit?: number
  /** Campos de la lista cerrada del servidor; prefijo `-` para descendente. */
  sort?: string[]
}

export interface MembresiaAceptada {
  membresia_id: string
  cuenta_id: string
  rol: RolCuenta
  estado: 'activa'
}

export interface Titularidad {
  cuenta_id: string
  usuario_titular_id: string
  membresia_id: string
}

const rutaMiembros = (cuentaId: string) => `/cuentas/${encodeURIComponent(cuentaId)}/miembros`
const rutaMiembro = (cuentaId: string, membresiaId: string) => `${rutaMiembros(cuentaId)}/${encodeURIComponent(membresiaId)}`

/** Lista paginada: una fila por persona, con su membresía vigente o la más reciente. */
export function listarMiembros(token: string, cuentaId: string, filtro: FiltroMiembros = {}): Promise<PaginatedResponse<Miembro>> {
  const filters: Record<string, string> = {}
  if (filtro.rol) filters.rol = filtro.rol
  if (filtro.estado) filters.estado = filtro.estado
  return apiPage<Miembro>(rutaMiembros(cuentaId), token, { page: filtro.page, limit: filtro.limit, sort: filtro.sort, filters })
}

export const obtenerMiembro = (token: string, cuentaId: string, membresiaId: string) =>
  api<Miembro>(rutaMiembro(cuentaId, membresiaId), token)

/** Crea una membresía pendiente. Una persona nueva recibe además el código por correo (puede responder 503). */
export const invitarMiembro = (token: string, cuentaId: string, datos: DatosInvitacion) =>
  api<MiembroInvitado>(rutaMiembros(cuentaId), token, 'POST', datos)

/** Cierra la membresía actual y abre otra con el nuevo rol (queda historial); devuelve la nueva. */
export const cambiarRolMiembro = (token: string, cuentaId: string, membresiaId: string, rol: RolCuenta) =>
  api<Miembro>(rutaMiembro(cuentaId, membresiaId), token, 'PATCH', { rol })

/** Quita el acceso de inmediato (también cancela una invitación pendiente). */
export const desactivarMiembro = (token: string, cuentaId: string, membresiaId: string) =>
  api<Miembro>(`${rutaMiembro(cuentaId, membresiaId)}/desactivar`, token, 'POST')

/** Abre una membresía activa nueva con el mismo rol. */
export const reactivarMiembro = (token: string, cuentaId: string, membresiaId: string) =>
  api<Miembro>(`${rutaMiembro(cuentaId, membresiaId)}/reactivar`, token, 'POST')

/** Solo la persona titular actual; el destino debe ser otra persona con rol gestor activo. */
export const transferirTitularidad = (token: string, cuentaId: string, membresiaId: string) =>
  api<Titularidad>(`/cuentas/${encodeURIComponent(cuentaId)}/titularidad`, token, 'POST', { membresia_id: membresiaId })

/** Perfil Cuidador vigente del miembro, o `null` si todavía no tiene. */
export const obtenerCuidador = (token: string, cuentaId: string, membresiaId: string) =>
  api<PerfilCuidador | null>(`${rutaMiembro(cuentaId, membresiaId)}/cuidador`, token)

export const guardarCuidador = (
  token: string,
  cuentaId: string,
  membresiaId: string,
  datos: { tipo_cuidado_id: number; cuidador_independiente: boolean },
) => api<PerfilCuidador>(`${rutaMiembro(cuentaId, membresiaId)}/cuidador`, token, 'POST', datos)

/** Acepta una invitación propia pendiente (vuelve a comprobar el cupo del plan). */
export const aceptarMembresia = (token: string, membresiaId: string) =>
  api<MembresiaAceptada>(`/me/membresias/${encodeURIComponent(membresiaId)}/aceptar`, token, 'POST')

/** Rechaza una invitación propia pendiente (204); se puede volver a invitar. */
export const rechazarMembresia = (token: string, membresiaId: string) =>
  api<void>(`/me/membresias/${encodeURIComponent(membresiaId)}/rechazar`, token, 'POST')
