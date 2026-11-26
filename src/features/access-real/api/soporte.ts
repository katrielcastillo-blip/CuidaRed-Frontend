/*
 * soporte.ts — Solicitudes, mensajes y señales de seguimiento de la organización.
 * Módulo: access-real. © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { api, apiResponse, configuration } from '../client'
import type { PaginatedResponse } from '@/lib/api-contract'

export type TipoSoporte = 'eliminar_usuario' | 'acceso' | 'error' | 'consulta'
export type EstadoSoporte = 'abierta' | 'en_revision' | 'esperando_informacion' | 'resuelta' | 'rechazada'
export interface SolicitudSoporte {
  id: string; codigo: string; asunto: string; descripcion: string; tipo: TipoSoporte; estado: EstadoSoporte
  creado_en: string; actualizado_en: string; cuenta: { id: string; nombre: string }
  solicitante: { id: string | null; nombre: string }; asignado: { id: string; nombre: string } | null
  usuario_objetivo: { id: string; nombre: string; correo: string | null; estado: string | null } | null
  mensajes?: Array<{ id: string; origen: 'organizacion' | 'backoffice'; texto: string; autor: string; estado: EstadoSoporte; creado_en: string }>
}
const ruta = (cuenta: string) => `/cuentas/${encodeURIComponent(cuenta)}/soporte`
export async function listarSoporte(token: string, cuenta: string, page: number): Promise<PaginatedResponse<SolicitudSoporte>> {
  return (await apiResponse(ruta(cuenta) + '?page=' + page + '&limit=25', token)).json()
}
export const crearSoporte = (token: string, cuenta: string, datos: { tipo: TipoSoporte; asunto: string; descripcion: string; usuario_objetivo_id: string | null }) =>
  api<SolicitudSoporte>(ruta(cuenta), token, 'POST', datos)
export const responderSoporte = (token: string, cuenta: string, id: string, mensaje: string, version: string) =>
  api<SolicitudSoporte>(ruta(cuenta) + '/' + encodeURIComponent(id) + '/mensajes', token, 'POST', { mensaje, version })
export const eventosSoporte = (token: string, cuenta: string, signal: AbortSignal) =>
  fetch(configuration().api + '/api/v1' + ruta(cuenta) + '/eventos', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', credentials: 'omit', signal })
