/*
 * reportes-errores.ts — Mensajes en español para los fallos del resumen, los reportes, las exportaciones y el informe
 * médico (fase 7). Distinguen el motivo (plan, permiso, cuenta vencida, conexión) sin mostrar detalles técnicos.
 * Módulo: access-real (ID07).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { ApiError } from '../client'
import { mensajeDeError } from '../errores'

export type AccionReporte = 'consultar' | 'exportar' | 'informe'

/** El servidor responde 403 `FORBIDDEN` tanto por permiso como por plan; la pantalla ya distingue el plan con el contexto. */
const FORBIDDEN: Record<AccionReporte, string> = {
  consultar: 'No tienes permiso para consultar esta información, o el plan de la cuenta no la incluye.',
  exportar: 'No se generó el archivo: tu rol o el plan de la cuenta no permiten esta exportación. No quedó ningún registro.',
  informe: 'No tienes permiso para generar el informe médico de este adulto mayor.',
}
const NOT_FOUND: Record<AccionReporte, string> = {
  consultar: 'No se encontró la información solicitada.',
  exportar: 'No se encontró el reporte que intentas exportar.',
  informe: 'No se encontró el expediente, o ya no está disponible para ti.',
}

export function mensajeReporte(error: unknown, accion: AccionReporte): string {
  if (!(error instanceof ApiError)) return 'No se pudo completar la operación. Revisa tu conexión e intenta de nuevo.'
  if (error.code === 'SUBSCRIPTION_INACTIVE') return mensajeDeError(error)
  if (error.status === 403) return FORBIDDEN[accion]
  if (error.status === 404) return NOT_FOUND[accion]
  if (error.status === 422) return 'Los filtros elegidos no son válidos. Revísalos e intenta de nuevo.'
  if (error.status === 429) return 'Hiciste demasiadas consultas seguidas. Espera un momento e intenta de nuevo.'
  return error.message
}
