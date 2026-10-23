/*
 * comun.ts — Utilidades de la capa de servicios: resultado tipado, verificación de permisos con
 * auditoría de accesos denegados.
 * Módulo: dominio · servicios (el "backend" local de esta versión solo frontend).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { auditar } from '../auditoria'
import { puede, type Accion } from '../permisos'
import { mutate, MENSAJE_SIN_CONEXION } from '../store'
import { estaEnLinea } from '../conectividad'
import type { Adulto, EntidadAuditada, Usuario } from '../types'

export type Resultado<T = void> =
  | { ok: true; valor: T; /** true si quedó guardado solo en el dispositivo, pendiente de sincronización. */ offline?: boolean }
  | { ok: false; error: string; errores?: Record<string, string | undefined> }

export const exito = <T>(valor: T, offline = false): Resultado<T> => ({ ok: true, valor, offline })
export const fallo = (error: string, errores?: Record<string, string | undefined>): Resultado<never> => ({ ok: false, error, errores })

export const ERROR_VALIDACION = 'Revisa los campos marcados.'
export const ERROR_PERMISO = 'No tienes permiso para realizar esta acción.'
export const ERROR_NO_ENCONTRADO = 'El registro no existe o fue eliminado.'

/**
 * Comprueba rol y alcance. Si falta permiso, registra el intento denegado en auditoría (si hay conexión)
 * y devuelve el error; si todo está bien devuelve null.
 */
export function verificar(actor: Usuario | null | undefined, accion: Accion, entidad: EntidadAuditada, adulto?: Adulto, registroId?: string): Resultado<never> | null {
  if (actor && puede(actor, accion, adulto)) return null
  if (actor && estaEnLinea()) {
    mutate((db) => auditar(db, actor, { accion: 'acceso.denegado', entidad, registroId: registroId ?? adulto?.id, resultado: 'denegado', detalle: `Permiso requerido: ${accion}` }), { silencioso: true })
  }
  return fallo(ERROR_PERMISO)
}

/** Para operaciones que solo existen en línea. */
export const sinConexion = (): Resultado<never> | null => (estaEnLinea() ? null : fallo(MENSAJE_SIN_CONEXION))

/**
 * Deja constancia en auditoría de una exportación o consulta relevante (reportes CSV/PDF, auditoría…).
 * No bloquea la operación si no hay conexión.
 */
export function auditarExportacion(actor: Usuario, que: string, entidad: EntidadAuditada = 'organizacion') {
  if (!estaEnLinea()) return
  mutate((db) => auditar(db, actor, { accion: 'datos.exportar', entidad, detalle: que }), { silencioso: true })
}
