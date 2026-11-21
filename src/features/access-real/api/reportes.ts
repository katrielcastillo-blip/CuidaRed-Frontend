/*
 * reportes.ts — Cliente tipado del resumen de casos, los reportes estadísticos, las exportaciones y el informe médico (fase 7).
 * Módulo: access-real · API (ID07, RF-07, RF-08).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Contrato: CuidaRed-Backend/docs/contratos/reportes.md. Todo cuelga de `/cuentas/:cuentaId`; la cuenta, el actor y el plan
 * los decide el servidor. Aquí solo se tipan las respuestas y se arman las rutas y los parámetros `filter[...]`.
 */
import { api, apiDescarga } from '../client'

/* ───────────── Tipos comunes ───────────── */
export type NivelRiesgo = 'alto' | 'medio' | 'bajo'
/** Filtro de riesgo: `sin_evaluacion` selecciona a quienes no tienen un riesgo vigente. */
export type FiltroRiesgo = NivelRiesgo | 'sin_evaluacion'
export interface MunicipioRef {
  codigo: string
  nombre: string
}

/* ───────────── Resumen de casos (RF-07) ───────────── */
export type PrioridadCaso = 'alta' | 'media' | 'baja'
export type EstadoAtencion = 'alerta_pendiente' | 'alerta_en_proceso' | 'seguimiento_vencido' | 'necesidades_activas' | 'al_dia'
export type MotivoCaso =
  | 'alerta_prioritaria_abierta'
  | 'riesgo_alto'
  | 'alerta_seguimiento_abierta'
  | 'alerta_abierta'
  | 'seguimiento_vencido'
  | 'necesidades_activas'
  | 'riesgo_medio'
  | 'sin_evaluacion_vigente'
  | 'sin_personal_asignado'
export interface PersonaAsignada {
  usuario_id: string
  nombres: string
  apellidos: string
}
export interface CasoResumen {
  envejeciente_id: string
  nombres: string
  apellidos: string
  municipio: MunicipioRef | null
  zona: string | null
  fecha_alta: string
  riesgo_vigente: NivelRiesgo | null
  prioridad: PrioridadCaso
  estado_atencion: EstadoAtencion
  motivos: MotivoCaso[]
  alertas: { abiertas: number; pendientes: number; en_proceso: number; prioritarias_abiertas: number }
  necesidades_activas: number
  seguimiento: {
    ultima_visita_id: string | null
    ultima_visita_fecha: string | null
    fecha_referencia: string
    dias_sin_visita: number
    umbral_dias: number
    vencido: boolean
  }
  asignados: { total: number; cuidadores: PersonaAsignada[]; voluntarios: PersonaAsignada[] }
}
export interface IndicadoresResumen {
  fecha_calculo: string
  umbral_dias_sin_visita: number
  casos_activos: number
  por_prioridad: Record<PrioridadCaso, number>
  por_estado_atencion: Record<EstadoAtencion, number>
  adultos_prioritarios: number
  alertas_prioritarias_abiertas: number
  alertas_abiertas: number
  alertas_pendientes: number
  alertas_en_proceso: number
  seguimiento_vencido: number
  necesidades_activas: number
  adultos_con_necesidades_activas: number
  sin_personal_asignado: number
}

/* ───────────── Reportes estadísticos (RF-08) ───────────── */
export type TipoReporte = 'adultos' | 'visitas' | 'necesidades' | 'casos_prioritarios'
/** La ruta del reporte usa guion; el cuerpo de las exportaciones y la respuesta usan guion bajo. */
export const RUTA_DE_TIPO: Record<TipoReporte, string> = {
  adultos: 'adultos',
  visitas: 'visitas',
  necesidades: 'necesidades',
  casos_prioritarios: 'casos-prioritarios',
}

/** Filtros que el cliente envía (solo las claves con valor). */
export interface FiltrosReporte {
  desde?: string
  hasta?: string
  municipio_cod?: string
  zona?: string
  riesgo?: FiltroRiesgo
  tipo_necesidad_id?: number
}
/** Filtros tal como los devuelve el servidor (`null` = sin filtrar). */
export interface FiltrosAplicados {
  desde: string | null
  hasta: string | null
  municipio_cod: string | null
  zona: string | null
  riesgo: FiltroRiesgo | null
  tipo_necesidad_id: number | null
}
export interface PuntoSerie {
  clave: string
  etiqueta: string
  valor: number
  porcentaje: number
}
export type ValorIndicador = number | null | { tipo_necesidad_id: number; nombre: string; total: number }

export interface DetalleAdulto {
  envejeciente_id: string
  nombres: string
  apellidos: string
  municipio: MunicipioRef | null
  zona: string | null
  edad: number | null
  sexo: string | null
  riesgo_vigente: NivelRiesgo | null
  estado: 'activo' | 'inactivo' | 'fallecido'
  fecha_alta: string
  personal_asignado: number
}
export interface DetalleVisita {
  visita_id: string
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  razon: string | null
  origen: 'interna' | 'solicitud'
  responsables: PersonaAsignada[]
  adultos: Array<{ envejeciente_id: string; nombres: string; apellidos: string; estado_general: string | null }>
}
export interface DetalleNecesidad {
  tipo_necesidad_id: number
  nombre: string
  total: number
  porcentaje: number
  pendientes: number
  en_proceso: number
  resueltas: number
  canceladas: number
  prioridad_alta: number
  recurrentes: number
}
export interface DetalleCasoPrioritario {
  envejeciente_id: string
  nombres: string
  apellidos: string
  municipio: MunicipioRef | null
  zona: string | null
  riesgo_vigente: NivelRiesgo | null
  alertas: number
  alertas_abiertas: number
  tipos: string[]
  estado_actual: 'pendiente' | 'en_proceso' | 'resuelta'
  ultima_alerta: string
}

interface ReporteBase<T extends TipoReporte, D> {
  tipo: T
  campo_fecha: string
  zona_horaria: string
  generado_en: string
  filtros: FiltrosAplicados
  vacio: boolean
  indicadores: Record<string, ValorIndicador>
  series: Record<string, PuntoSerie[]>
  detalle: D[]
  detalle_total: number
  detalle_truncado: boolean
}
export type ReporteApi =
  | ReporteBase<'adultos', DetalleAdulto>
  | ReporteBase<'visitas', DetalleVisita>
  | ReporteBase<'necesidades', DetalleNecesidad>
  | ReporteBase<'casos_prioritarios', DetalleCasoPrioritario>

export interface FilaComparativo {
  zona?: string | null
  municipio: MunicipioRef | null
  adultos_activos: number
  riesgo_alto: number
  /** `null` cuando quien consulta no tiene `visitas:ver` (p. ej. cuentas Familia): no es cero, es un dato que no se publica. */
  visitas_realizadas: number | null
  visitas_por_adulto: number | null
  necesidades_activas: number
  alertas_abiertas: number
  dias_sin_visita_promedio: number | null
  sin_personal_asignado: number
}
export interface FilaTendencia {
  mes: string
  /** `null` sin `visitas:ver`, igual que en los comparativos. */
  visitas_realizadas: number | null
  variacion_visitas: number | null
  necesidades_registradas: number
  alertas_prioritarias: number
  perfiles_nuevos: number
}
export interface AnalisisAvanzadoApi {
  tipo: 'analisis_avanzado'
  zona_horaria: string
  generado_en: string
  filtros: FiltrosAplicados
  vacio: boolean
  comparativo_zonas: FilaComparativo[]
  comparativo_municipios: FilaComparativo[]
  tendencias: FilaTendencia[]
}

/* ───────────── Exportaciones ───────────── */
export type FormatoRegistrado = 'pdf' | 'xlsx'
export interface ExportacionApi {
  exportacion_id: string
  tipo: TipoReporte | 'analisis_avanzado'
  formato: FormatoRegistrado
  filtros: FiltrosAplicados
  fecha: string
  generado_por: { nombres: string; apellidos: string; rol: string }
  cuenta: { nombre: string }
}

/* ───────────── Informe médico ───────────── */
export interface FactorRiesgoInforme {
  envejeciente_riesgo_id: string
  /** El `codigo` puede ser `null` en filas heredadas del catálogo: se muestra siempre el `nombre`. */
  factor: { codigo: string | null; nombre: string }
  nivel: { codigo: string | null; nombre: string }
  motivo: string | null
  observacion?: string | null
  fecha: string
}
export interface HistorialRiesgoInforme {
  envejeciente_riesgo_id: string
  /** El `codigo` puede ser `null` en filas heredadas del catálogo: se muestra siempre el `nombre`. */
  factor: { codigo: string | null; nombre: string }
  nivel: { codigo: string | null; nombre: string }
  estado: 'activo' | 'resuelto' | 'reemplazado'
  motivo: string | null
  fecha: string
  fecha_resolucion: string | null
}
export interface IndicacionInforme {
  indicacion_medica_id: string
  tipo: { tipo_indicacion_id: number; nombre: string }
  titulo: string
  descripcion: string | null
  frecuencia_horario: string | null
  fecha_inicio: string
  fecha_fin: string | null
  registrada_por: { nombres: string; apellidos: string } | null
}
export interface VisitaInforme {
  visita_id: string
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  origen: 'interna' | 'solicitud'
  responsables: Array<{ nombres: string; apellidos: string }>
  estado_general: string | null
  observacion: string | null
}
export type SeccionInforme = 'indicaciones' | 'riesgo' | 'visitas'
export interface InformeMedicoApi {
  informe_id: string
  generado_en: string
  generado_por: { nombres: string; apellidos: string; rol: string }
  cuenta: { nombre: string }
  aviso: string
  secciones_omitidas: SeccionInforme[]
  identificacion: {
    envejeciente_id: string
    nombres: string
    apellidos: string
    cedula: string | null
    fecha_nacimiento: string | null
    edad: number | null
    sexo: string | null
    municipio: MunicipioRef | null
    provincia: MunicipioRef | null
    estado: 'activo' | 'inactivo' | 'fallecido'
  }
  riesgo: {
    nivel_vigente: NivelRiesgo | null
    vigentes: FactorRiesgoInforme[]
    historial: HistorialRiesgoInforme[]
    historial_total: number
  } | null
  indicaciones: { vigentes: IndicacionInforme[]; no_vigentes: number } | null
  visitas: { realizadas_total: number; ultima_fecha: string | null; recientes: VisitaInforme[] } | null
}

/* ───────────── Rutas y parámetros ───────────── */
const CLAVES_FILTRO = ['desde', 'hasta', 'municipio_cod', 'zona', 'riesgo', 'tipo_necesidad_id'] as const

/**
 * Parámetros `filter[...]` de un reporte. Solo viajan las claves con valor (un parámetro vacío o repetido es 422) y
 * `tipo_necesidad_id` solo en el reporte de necesidades (en otro tipo, y en el análisis avanzado, es 422).
 */
export function consultaDeFiltros(filtros: FiltrosReporte, conCategoria: boolean): URLSearchParams {
  const params = new URLSearchParams()
  for (const clave of CLAVES_FILTRO) {
    const valor = filtros[clave]
    if (valor === undefined || valor === '' || (clave === 'tipo_necesidad_id' && !conCategoria)) continue
    params.set(`filter[${clave}]`, String(valor))
  }
  return params
}

/** Pasa los filtros que devolvió el servidor al objeto que aceptan el CSV y el registro de exportaciones (sin `null`). */
export function filtrosDeRespuesta(filtros: FiltrosAplicados): FiltrosReporte {
  const salida: FiltrosReporte = {}
  if (filtros.desde) salida.desde = filtros.desde
  if (filtros.hasta) salida.hasta = filtros.hasta
  if (filtros.municipio_cod) salida.municipio_cod = filtros.municipio_cod
  if (filtros.zona) salida.zona = filtros.zona
  if (filtros.riesgo) salida.riesgo = filtros.riesgo
  if (filtros.tipo_necesidad_id !== null && filtros.tipo_necesidad_id !== undefined) salida.tipo_necesidad_id = filtros.tipo_necesidad_id
  return salida
}

export const rutaReporte = (base: string, tipo: TipoReporte, filtros: FiltrosReporte) => {
  const consulta = consultaDeFiltros(filtros, tipo === 'necesidades').toString()
  return `${base}/reportes/${RUTA_DE_TIPO[tipo]}${consulta ? `?${consulta}` : ''}`
}
export const rutaAnalisisAvanzado = (base: string, filtros: FiltrosReporte) => {
  const consulta = consultaDeFiltros(filtros, false).toString()
  return `${base}/reportes/analisis-avanzado${consulta ? `?${consulta}` : ''}`
}
export const rutaCsv = (base: string, tipo: TipoReporte, filtros: FiltrosReporte) => {
  const params = new URLSearchParams({ formato: 'csv' })
  for (const [clave, valor] of consultaDeFiltros(filtros, tipo === 'necesidades')) params.set(clave, valor)
  return `${base}/reportes/${RUTA_DE_TIPO[tipo]}/exportacion?${params.toString()}`
}
export const rutaInformeMedico = (base: string, envejecienteId: string) => `${base}/envejecientes/${encodeURIComponent(envejecienteId)}/informe-medico`

/** Nombre de archivo de `Content-Disposition`, solo si es un nombre simple y seguro; `null` en cualquier otro caso. */
export function nombreDeDescarga(contentDisposition: string | null): string | null {
  const nombre = /filename\s*=\s*"?([^";]+)"?/i.exec(contentDisposition ?? '')?.[1]?.trim()
  return nombre && /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(nombre) ? nombre : null
}

/** Descarga el CSV auditado del servidor. Devuelve el archivo y el nombre que indicó el servidor (o `null`). */
export async function descargarCsv(token: string, base: string, tipo: TipoReporte, filtros: FiltrosReporte) {
  const { blob, contentDisposition } = await apiDescarga(rutaCsv(base, tipo, filtros), token)
  return { blob, nombre: nombreDeDescarga(contentDisposition) }
}

/** Registra en la auditoría la exportación a PDF o Excel. Debe resolverse antes de generar el archivo. */
export function registrarExportacion(token: string, base: string, tipo: TipoReporte | 'analisis_avanzado', formato: FormatoRegistrado, filtros: FiltrosReporte) {
  return api<ExportacionApi>(`${base}/reportes/exportaciones`, token, 'POST', { tipo, formato, filtros })
}
