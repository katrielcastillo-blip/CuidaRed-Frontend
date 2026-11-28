/*
 * resumen-datos.ts — Reglas puras del resumen de casos conectado (fase 7): textos de prioridad, estado de atención y
 * motivos y parámetros de consulta (filtros, orden y búsqueda).
 * Módulo: access-real (ID07, RF-07). Sin React ni red: se prueba de forma aislada.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Los códigos son los del backend (`alerta_en_proceso`, `seguimiento_vencido`, `necesidades_activas`…), no los del
 * simulador del prototipo. El servidor decide prioridad, estado y orden; aquí solo se traducen a texto.
 */
import type { Tone } from '@/components/ui'
import { fechaCorta } from '@/domain/dates'
import type { CasoResumen, EstadoAtencion, MotivoCaso, PrioridadCaso } from '../api/reportes'

export const PRIORIDAD_TEXTO: Record<PrioridadCaso, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }
export const PRIORIDAD_TONO: Record<PrioridadCaso, Tone> = { alta: 'danger', media: 'warning', baja: 'info' }

/** Del más al menos urgente (el orden que usa el servidor al ordenar por estado de atención). */
export const ESTADOS_ATENCION: Array<{ value: EstadoAtencion; label: string; tono: Tone; descripcion: string }> = [
  { value: 'alerta_pendiente', label: 'Alerta pendiente', tono: 'danger', descripcion: 'Tiene al menos una alerta abierta que nadie ha empezado a atender.' },
  { value: 'alerta_en_proceso', label: 'Alerta en atención', tono: 'warning', descripcion: 'Tiene alertas abiertas y todas ya están en atención.' },
  { value: 'seguimiento_vencido', label: 'Seguimiento vencido', tono: 'warning', descripcion: 'Sin alertas abiertas, pero superó el límite de días sin visita.' },
  { value: 'necesidades_activas', label: 'Necesidades activas', tono: 'info', descripcion: 'Sin lo anterior, pero con necesidades pendientes o en proceso.' },
  { value: 'al_dia', label: 'Al día', tono: 'success', descripcion: 'Sin alertas abiertas, necesidades activas ni seguimiento vencido.' },
]
export const ESTADO_ATENCION_TEXTO = Object.fromEntries(ESTADOS_ATENCION.map((e) => [e.value, e.label])) as Record<EstadoAtencion, string>
export const ESTADO_ATENCION_TONO = Object.fromEntries(ESTADOS_ATENCION.map((e) => [e.value, e.tono])) as Record<EstadoAtencion, Tone>

export const MOTIVO_TEXTO: Record<MotivoCaso, string> = {
  alerta_prioritaria_abierta: 'Alerta prioritaria abierta',
  riesgo_alto: 'Riesgo alto',
  alerta_seguimiento_abierta: 'Alerta de seguimiento abierta',
  alerta_abierta: 'Otra alerta abierta',
  seguimiento_vencido: 'Seguimiento vencido',
  necesidades_activas: 'Necesidades activas',
  riesgo_medio: 'Riesgo medio',
  sin_evaluacion_vigente: 'Sin evaluación vigente',
  sin_personal_asignado: 'Sin personal asignado',
}
/** Un código que el cliente no conoce (el servidor pudo añadir uno) se muestra legible en lugar de ocultarse. */
export const textoMotivo = (codigo: string) => MOTIVO_TEXTO[codigo as MotivoCaso] ?? codigo.replaceAll('_', ' ')

export const CRITERIOS_ORDEN = [
  { value: 'prioridad', label: 'Prioridad', sentido: ['alta primero', 'baja primero'] },
  { value: 'estado_atencion', label: 'Estado de atención', sentido: ['más urgente primero', 'menos urgente primero'] },
  { value: 'ultima_visita', label: 'Última visita', sentido: ['sin visitas y más antigua primero', 'más reciente primero'] },
  { value: 'riesgo', label: 'Nivel de riesgo', sentido: ['alto primero', 'sin evaluación primero'] },
  { value: 'nombre', label: 'Nombre', sentido: ['de la A a la Z', 'de la Z a la A'] },
] as const
export type CriterioOrden = (typeof CRITERIOS_ORDEN)[number]['value']

export interface FiltrosResumen {
  estado: string
  prioridad: string
  riesgo: string
  municipio: string
  zona: string
  asignado: string
  busqueda: string
}
export const FILTROS_RESUMEN_INICIALES: FiltrosResumen = { estado: '', prioridad: '', riesgo: '', municipio: '', zona: '', asignado: '', busqueda: '' }
export const hayFiltrosResumen = (f: FiltrosResumen) => Object.values(f).some((valor) => valor.trim() !== '')

export const BUSQUEDA_MIN = 2
export const BUSQUEDA_MAX = 60
/** El servidor acepta de 2 a 60 caracteres; con menos de 2 no se envía la búsqueda en lugar de provocar un 422. */
export function terminoDeBusqueda(texto: string): string | undefined {
  const limpio = texto.trim().replace(/\s+/g, ' ')
  return limpio.length >= BUSQUEDA_MIN ? limpio.slice(0, BUSQUEDA_MAX) : undefined
}

/** `sort` y `filter[...]` del listado; solo viajan los filtros con valor. */
export function consultaResumen(filtros: FiltrosResumen, criterio: CriterioOrden, invertido: boolean) {
  const busqueda = terminoDeBusqueda(filtros.busqueda)
  const valores: Record<string, string | undefined> = {
    estado_atencion: filtros.estado,
    prioridad: filtros.prioridad,
    riesgo: filtros.riesgo,
    municipio_cod: filtros.municipio,
    zona: filtros.zona.trim(),
    asignado: filtros.asignado,
    q: busqueda,
  }
  return {
    sort: [`${invertido ? '-' : ''}${criterio}`],
    filters: Object.fromEntries(Object.entries(valores).filter((par): par is [string, string] => !!par[1])),
  }
}

export const sentidoDeOrden = (criterio: CriterioOrden, invertido: boolean) =>
  CRITERIOS_ORDEN.find((c) => c.value === criterio)?.sentido[invertido ? 1 : 0] ?? ''

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`

/** «Última visita: 01/11/2026 (hace 19 días)» o, si nunca fue visitado, desde cuándo se le da seguimiento. */
export function textoSeguimiento(s: NonNullable<CasoResumen['seguimiento']>): string {
  const hace = s.dias_sin_visita === 0 ? 'hoy' : `hace ${dias(s.dias_sin_visita)}`
  return s.ultima_visita_fecha
    ? `Última visita realizada: ${fechaCorta(s.ultima_visita_fecha)} (${hace})`
    : `Sin visitas realizadas · en seguimiento desde ${fechaCorta(s.fecha_referencia)} (${hace})`
}
