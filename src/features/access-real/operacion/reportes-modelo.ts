/*
 * reportes-modelo.ts — Reglas puras de los reportes conectados (fase 7): rangos de fechas, filtros, textos y paso de la
 * respuesta del servidor al modelo de reporte que ya dibujan, exportan a PDF y a Excel las pantallas del prototipo.
 * Módulo: access-real (ID07, RF-08). Sin React ni red: se prueba de forma aislada.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Los estados son los del backend (visita `completada`, necesidad `resuelta`, alerta `resuelta`…), no los del simulador.
 * Las fechas de calendario (`desde`, `hasta`) son del calendario de República Dominicana, igual que en el servidor.
 */
import { fechaCorta } from '@/domain/dates'
import type { Analisis, AnalisisAvanzado, Barra, Columna, Fila, Grafico, GraficoSeries, Kpi, Reporte, TablaReporte } from '@/features/gestion/lib/reportes-comun'
import type { CuentaMe, RolCuenta, TipoCuenta } from '../client'
import { ROL_TEXTO, TIPO_TEXTO } from '../cuentas-datos'
import type { ContextoExportacion, ImagenGrafico } from '@/features/gestion/components/reportes/tipos'
import type {
  AnalisisAvanzadoApi,
  DetalleAdulto,
  DetalleCasoPrioritario,
  DetalleNecesidad,
  DetalleVisita,
  ExportacionApi,
  FilaComparativo,
  FiltroRiesgo,
  FiltrosAplicados,
  FiltrosReporte,
  NivelRiesgo,
  OpcionesReporte,
  PuntoSerie,
  ReporteApi,
  TipoReporte,
  ValorIndicador,
} from '../api/reportes'

export const ZONA_HORARIA = 'America/Santo_Domingo'
export const SIN_EVALUACION = 'Sin evaluación vigente'
export const SIN_DATOS = 'No existen datos disponibles para este reporte con los filtros seleccionados.'

/* ───────────── Fechas y rangos ───────────── */
/** Fecha de hoy (`YYYY-MM-DD`) en el calendario de República Dominicana, no en el del dispositivo. */
export function hoyRD(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA_HORARIA, dateStyle: 'short' }).format(ahora)
}

export type Rango = 'todo' | 'mes' | '3m' | '6m' | 'anio' | 'personalizado'
export const RANGOS: Array<{ value: Rango; label: string }> = [
  { value: 'todo', label: 'Todo el tiempo' },
  { value: 'mes', label: 'Este mes' },
  { value: '3m', label: 'Últimos 3 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: 'anio', label: 'Este año' },
  { value: 'personalizado', label: 'Personalizado (desde / hasta)' },
]

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Límites inclusivos del período. «Últimos 3 meses» es el mes en curso y los dos anteriores (de su día 1 a hoy), como en
 * el prototipo. El personalizado deja pasar solo las fechas escritas.
 */
export function limitesRango(rango: Rango, hoy: string, desde = '', hasta = ''): { desde?: string; hasta?: string } {
  if (rango === 'todo') return {}
  if (rango === 'personalizado') return { ...(desde && { desde }), ...(hasta && { hasta }) }
  const [anio, mes] = hoy.split('-').map(Number) as [number, number]
  if (rango === 'anio') return { desde: `${anio}-01-01`, hasta: hoy }
  const meses = rango === 'mes' ? 1 : rango === '3m' ? 3 : 6
  const indice = anio * 12 + (mes - 1) - (meses - 1)
  return { desde: `${Math.floor(indice / 12)}-${pad((indice % 12) + 1)}-01`, hasta: hoy }
}

/** Error del rango personalizado (se muestra junto al campo «Hasta»); el servidor lo rechazaría con 422. */
export function errorRango(rango: Rango, desde: string, hasta: string): string | undefined {
  return rango === 'personalizado' && desde && hasta && desde > hasta ? 'La fecha «hasta» debe ser igual o posterior a «desde».' : undefined
}

/* ───────────── Filtros de pantalla → filtros del contrato ───────────── */
export interface SeleccionFiltros {
  rango: Rango
  desde: string
  hasta: string
  municipio: string
  zona: string
  riesgo: '' | FiltroRiesgo
  categoria: string
}
export const SELECCION_INICIAL: SeleccionFiltros = { rango: 'todo', desde: '', hasta: '', municipio: '', zona: '', riesgo: '', categoria: '' }

export const hayFiltros = (s: SeleccionFiltros) => s.rango !== 'todo' || !!(s.municipio || s.zona || s.riesgo || s.categoria)

/** Un rango incoherente suspende la consulta y la exportación. */
export function filtrosDeSeleccion(s: SeleccionFiltros, hoy: string): FiltrosReporte | null {
  if (errorRango(s.rango, s.desde, s.hasta)) return null
  const fechas = limitesRango(s.rango, hoy, s.desde, s.hasta)
  const categoria = Number(s.categoria)
  return {
    ...fechas,
    ...(s.municipio && { municipio_cod: s.municipio }),
    ...(s.zona && { zona: s.zona }),
    ...(s.riesgo && { riesgo: s.riesgo }),
    ...(s.categoria && Number.isSafeInteger(categoria) && categoria > 0 && { tipo_necesidad_id: categoria }),
  }
}

/* ───────────── Textos ───────────── */
export const TIPOS_REPORTE: Array<{ value: TipoReporte; label: string; descripcion: string; detalle: string; unidad: [string, string] }> = [
  { value: 'adultos', label: 'Adultos mayores registrados', descripcion: 'Adultos mayores dados de alta en el período, en cualquier estado del expediente.', detalle: 'Detalle de adultos mayores', unidad: ['adulto', 'adultos'] },
  { value: 'visitas', label: 'Visitas realizadas', descripcion: 'Visitas completadas en el período, incluidas las institucionales. Las atenciones corresponden a adultos con expediente asociado.', detalle: 'Detalle de visitas realizadas', unidad: ['visita', 'visitas'] },
  { value: 'necesidades', label: 'Necesidades frecuentes y atendidas', descripcion: 'Necesidades registradas en el período, agrupadas por categoría y con su estado actual.', detalle: 'Detalle por categoría de necesidad', unidad: ['necesidad', 'necesidades'] },
  { value: 'casos_prioritarios', label: 'Casos prioritarios', descripcion: 'Alertas prioritarias generadas en el período (riesgo alto, medicamentos pendientes y necesidades prioritarias), con su estado actual.', detalle: 'Detalle de casos prioritarios', unidad: ['alerta', 'alertas'] },
]
const definicion = (tipo: TipoReporte) => TIPOS_REPORTE.find((t) => t.value === tipo)!

const CAMPO_FECHA: Record<string, string> = {
  fecha_alta: 'fecha de alta del expediente',
  fecha_visita: 'fecha de la visita',
  fecha_registro: 'fecha de registro de la necesidad',
  fecha_alerta: 'fecha de la alerta',
}
export const TEXTO_RIESGO: Record<FiltroRiesgo, string> = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo', sin_evaluacion: SIN_EVALUACION }
export const textoRiesgo = (nivel: NivelRiesgo | null) => (nivel ? TEXTO_RIESGO[nivel] : SIN_EVALUACION)
const SEXO: Record<string, string> = { F: 'Femenino', M: 'Masculino' }
const ESTADO_ADULTO: Record<string, string> = { activo: 'Activo', inactivo: 'Inactivo', fallecido: 'Fallecido' }
const ORIGEN_VISITA: Record<string, string> = { interna: 'Interna', solicitud: 'Por solicitud' }
export const ESTADO_GENERAL: Record<string, string> = { estable: 'Estable', requiere_atencion: 'Requiere atención', situacion_critica: 'Situación crítica' }
const ESTADO_ALERTA: Record<string, string> = { pendiente: 'Pendiente', en_proceso: 'En atención', resuelta: 'Resuelta' }
const TIPO_ALERTA: Record<string, string> = { riesgo_alto: 'Riesgo alto', medicamento_pendiente: 'Medicamentos pendientes', necesidad_prioritaria: 'Necesidad prioritaria' }

const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
/** `2026-11` → «Nov 2026». Lo que no es un mes se deja tal cual. */
export function etiquetaMes(clave: string): string {
  const coincidencia = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(clave)
  return coincidencia ? `${MES_CORTO[Number(coincidencia[2]) - 1]} ${coincidencia[1]}` : clave
}

const decimales = (valor: number, digitos: number) => valor.toLocaleString('es-DO', { minimumFractionDigits: digitos, maximumFractionDigits: digitos })
const entero = (valor: number) => valor.toLocaleString('es-DO')
const nombre = (persona: { nombres: string; apellidos: string }) => `${persona.nombres} ${persona.apellidos}`.trim()
const fecha = (valor: string | null | undefined) => (valor ? fechaCorta(valor) : '—')

/** Líneas legibles de los filtros aplicados (PDF y Excel). `nombres` traduce códigos que solo conoce la pantalla. */
export function describirFiltros(filtros: FiltrosAplicados, campoFecha: string | null, nombres: { municipio?: string; categoria?: string } = {}): string[] {
  const periodo = !filtros.desde && !filtros.hasta ? 'Todo el tiempo'
    : filtros.desde && filtros.hasta ? `${fechaCorta(filtros.desde)} – ${fechaCorta(filtros.hasta)}`
      : filtros.desde ? `Desde ${fechaCorta(filtros.desde)}` : `Hasta ${fechaCorta(filtros.hasta!)}`
  return [
    `Período: ${periodo}`,
    ...(campoFecha ? [`Fecha que filtra: ${CAMPO_FECHA[campoFecha] ?? campoFecha}`] : []),
    `Municipio: ${filtros.municipio_cod ? (nombres.municipio ?? filtros.municipio_cod) : 'Todos'}`,
    `Sector: ${filtros.zona ?? 'Todos'}`,
    `Riesgo: ${filtros.riesgo ? TEXTO_RIESGO[filtros.riesgo] : 'Todos'}`,
    ...(campoFecha === 'fecha_registro' ? [`Categoría: ${filtros.tipo_necesidad_id !== null ? (nombres.categoria ?? `N.º ${filtros.tipo_necesidad_id}`) : 'Todas'}`] : []),
  ]
}

/* ───────────── Indicadores ───────────── */
type FormatoIndicador = 'entero' | 'decimal1' | 'decimal2' | 'porcentaje' | 'frecuente'
interface DefIndicador { clave: string; etiqueta: string; formato?: FormatoIndicador; peligro?: boolean; nota?: string }

const INDICADORES: Record<TipoReporte, DefIndicador[]> = {
  adultos: [
    { clave: 'registrados', etiqueta: 'Adultos registrados' },
    { clave: 'activos', etiqueta: 'Activos' },
    { clave: 'inactivos', etiqueta: 'Inactivos' },
    { clave: 'fallecidos', etiqueta: 'Fallecidos' },
    { clave: 'riesgo_alto', etiqueta: 'Riesgo alto', peligro: true, nota: 'Entre los activos' },
    { clave: 'riesgo_medio', etiqueta: 'Riesgo medio', nota: 'Entre los activos' },
    { clave: 'riesgo_bajo', etiqueta: 'Riesgo bajo', nota: 'Entre los activos' },
    { clave: 'sin_evaluacion', etiqueta: SIN_EVALUACION, nota: 'Entre los activos' },
    { clave: 'edad_promedio', etiqueta: 'Edad promedio', formato: 'decimal1', nota: 'Años, de los registrados' },
    { clave: 'sin_personal_asignado', etiqueta: 'Sin personal asignado', peligro: true, nota: 'Activos sin cuidador ni voluntario' },
  ],
  visitas: [
    { clave: 'visitas_realizadas', etiqueta: 'Visitas realizadas' },
    { clave: 'visitas_personales', etiqueta: 'Visitas con expediente' },
    { clave: 'visitas_institucionales', etiqueta: 'Visitas institucionales' },
    { clave: 'atenciones', etiqueta: 'Atenciones', nota: 'Adultos atendidos en esas visitas' },
    { clave: 'adultos_visitados', etiqueta: 'Adultos visitados' },
    { clave: 'adultos_activos', etiqueta: 'Adultos activos' },
    { clave: 'promedio_por_adulto', etiqueta: 'Promedio por adulto visitado', formato: 'decimal2' },
    { clave: 'requirieron_atencion', etiqueta: 'Requirieron atención', peligro: true },
    { clave: 'situaciones_criticas', etiqueta: 'Situaciones críticas', peligro: true },
    { clave: 'visitas_compartidas', etiqueta: 'Visitas compartidas', nota: 'Con más de un adulto' },
  ],
  necesidades: [
    { clave: 'registradas', etiqueta: 'Necesidades registradas' },
    { clave: 'activas', etiqueta: 'Activas', nota: 'Pendientes y en proceso' },
    { clave: 'pendientes', etiqueta: 'Pendientes' },
    { clave: 'en_proceso', etiqueta: 'En proceso' },
    { clave: 'resueltas', etiqueta: 'Resueltas' },
    { clave: 'canceladas', etiqueta: 'Canceladas' },
    { clave: 'porcentaje_resueltas', etiqueta: 'Porcentaje resueltas', formato: 'porcentaje' },
    { clave: 'prioridad_alta_activas', etiqueta: 'Activas de prioridad alta', peligro: true },
    { clave: 'recurrentes', etiqueta: 'Recurrentes' },
    { clave: 'adultos_con_necesidades', etiqueta: 'Adultos con necesidades' },
    { clave: 'mas_frecuente', etiqueta: 'Más frecuente', formato: 'frecuente' },
  ],
  casos_prioritarios: [
    { clave: 'alertas_prioritarias', etiqueta: 'Alertas prioritarias', nota: 'Cuenta alertas' },
    { clave: 'adultos_prioritarios', etiqueta: 'Adultos prioritarios', nota: 'Cuenta adultos distintos' },
    { clave: 'casos_abiertos', etiqueta: 'Casos abiertos', peligro: true, nota: 'Adultos con una alerta aún abierta' },
    { clave: 'alertas_pendientes', etiqueta: 'Alertas pendientes', peligro: true },
    { clave: 'alertas_en_proceso', etiqueta: 'Alertas en atención' },
    { clave: 'alertas_resueltas', etiqueta: 'Alertas resueltas' },
    { clave: 'resueltas_automaticamente', etiqueta: 'Resueltas automáticamente' },
    { clave: 'porcentaje_resueltas', etiqueta: 'Porcentaje resueltas', formato: 'porcentaje' },
  ],
}

function valorDeIndicador(valor: ValorIndicador | undefined, formato: FormatoIndicador = 'entero'): { valor: string | number; nota?: string } {
  if (valor === undefined || valor === null) return { valor: '—' }
  if (typeof valor === 'object') return { valor: valor.nombre, nota: `${entero(valor.total)} ${valor.total === 1 ? 'registro' : 'registros'}` }
  if (formato === 'decimal1') return { valor: decimales(valor, 1) }
  if (formato === 'decimal2') return { valor: decimales(valor, 2) }
  if (formato === 'porcentaje') return { valor: `${entero(valor)}%` }
  return { valor }
}

export function indicadoresDeReporte(api: ReporteApi): Kpi[] {
  return INDICADORES[api.tipo].map((def) => {
    const { valor, nota } = valorDeIndicador(api.indicadores[def.clave], def.formato)
    const kpi: Kpi = { etiqueta: def.etiqueta, valor }
    const texto = nota ?? def.nota
    if (texto) kpi.nota = texto
    if (def.peligro && typeof valor === 'number' && valor > 0) kpi.peligro = true
    return kpi
  })
}

/* ───────────── Gráficos ───────────── */
interface DefSerie { clave: string; titulo: string; descripcion?: string; forma: 'h' | 'v'; dona?: boolean; unidad: [string, string] }

const SERIES: Record<TipoReporte, DefSerie[]> = {
  adultos: [
    { clave: 'por_riesgo', titulo: 'Adultos activos por nivel de riesgo', forma: 'h', dona: true, unidad: ['adulto', 'adultos'] },
    { clave: 'por_estado', titulo: 'Adultos por estado del expediente', forma: 'h', dona: true, unidad: ['adulto', 'adultos'] },
    { clave: 'por_municipio', titulo: 'Adultos activos por municipio', forma: 'h', unidad: ['adulto', 'adultos'] },
    { clave: 'por_zona', titulo: 'Adultos activos por sector', forma: 'h', unidad: ['adulto', 'adultos'] },
    { clave: 'por_mes', titulo: 'Altas por mes', descripcion: 'Perfiles dados de alta en cada mes del período (hasta los 24 últimos meses)', forma: 'v', unidad: ['alta', 'altas'] },
  ],
  visitas: [
    { clave: 'por_mes', titulo: 'Visitas realizadas por mes', descripcion: 'Hasta los 24 últimos meses del período', forma: 'v', unidad: ['visita', 'visitas'] },
    { clave: 'por_tipo_visita', titulo: 'Visitas por tipo', descripcion: 'Visitas con expediente e institucionales sin expediente', forma: 'h', dona: true, unidad: ['visita', 'visitas'] },
    { clave: 'por_estado_general', titulo: 'Estado observado en las atenciones', descripcion: 'Un adulto atendido en una visita cuenta una vez', forma: 'h', dona: true, unidad: ['atención', 'atenciones'] },
  ],
  necesidades: [
    { clave: 'por_tipo', titulo: 'Necesidades por categoría', forma: 'h', unidad: ['necesidad', 'necesidades'] },
    { clave: 'por_estado', titulo: 'Necesidades por estado', forma: 'h', dona: true, unidad: ['necesidad', 'necesidades'] },
    { clave: 'por_prioridad', titulo: 'Necesidades por prioridad', forma: 'h', unidad: ['necesidad', 'necesidades'] },
    { clave: 'recurrencia', titulo: 'Necesidades recurrentes y puntuales', forma: 'h', dona: true, unidad: ['necesidad', 'necesidades'] },
    { clave: 'por_mes', titulo: 'Necesidades registradas por mes', descripcion: 'Hasta los 24 últimos meses del período', forma: 'v', unidad: ['necesidad', 'necesidades'] },
  ],
  casos_prioritarios: [
    { clave: 'por_estado', titulo: 'Alertas prioritarias por estado', forma: 'h', dona: true, unidad: ['alerta', 'alertas'] },
    { clave: 'por_tipo', titulo: 'Alertas prioritarias por tipo', forma: 'h', unidad: ['alerta', 'alertas'] },
    { clave: 'por_mes', titulo: 'Alertas prioritarias por mes', descripcion: 'Hasta los 24 últimos meses del período', forma: 'v', unidad: ['alerta', 'alertas'] },
  ],
}

const NIVELES: string[] = ['alto', 'medio', 'bajo']
const barraDe = (punto: PuntoSerie, serie: string): Barra => ({
  etiqueta: serie === 'por_mes' ? etiquetaMes(punto.clave) : punto.etiqueta,
  valor: punto.valor,
  pct: punto.porcentaje,
  ...(serie === 'por_riesgo' && NIVELES.includes(punto.clave) && { riesgo: punto.clave as NivelRiesgo }),
})

export function graficosDeReporte(api: ReporteApi): Grafico[] {
  return SERIES[api.tipo].flatMap((def): Grafico[] => {
    const puntos = api.series[def.clave]
    if (!Array.isArray(puntos)) return []
    return [{
      id: `${api.tipo}-${def.clave}`,
      titulo: def.titulo,
      ...(def.descripcion && { descripcion: def.descripcion }),
      forma: def.forma,
      ...(def.dona && { visual: 'dona' as const }),
      unidad: def.unidad,
      barras: puntos.map((punto) => barraDe(punto, def.clave)),
    }]
  })
}

/* ───────────── Detalle ───────────── */
const fila = (id: string, celdas: Array<string | number>, extra: Partial<Fila> = {}): Fila => ({ id, celdas, ...extra })
const ubicacion = (municipio: { nombre: string } | null) => municipio?.nombre ?? '—'

function tablaAdultos(detalle: DetalleAdulto[]): Pick<TablaReporte, 'columnas' | 'filas'> {
  const columnas: Columna[] = [
    { etiqueta: 'Adulto mayor' }, { etiqueta: 'Municipio' }, { etiqueta: 'Sector' }, { etiqueta: 'Edad', tipo: 'numero' }, { etiqueta: 'Sexo' },
    { etiqueta: 'Riesgo vigente', tipo: 'riesgo' }, { etiqueta: 'Estado' }, { etiqueta: 'Fecha de alta' }, { etiqueta: 'Personal asignado', tipo: 'numero' },
  ]
  return {
    columnas,
    filas: detalle.map((d) => fila(d.envejeciente_id, [
      nombre(d), ubicacion(d.municipio), d.zona ?? '—', d.edad ?? '—', d.sexo ? (SEXO[d.sexo] ?? d.sexo) : '—',
      textoRiesgo(d.riesgo_vigente), ESTADO_ADULTO[d.estado] ?? d.estado, fecha(d.fecha_alta), d.personal_asignado,
    ], { adultoId: d.envejeciente_id, ...(d.riesgo_vigente && { riesgo: d.riesgo_vigente }) })),
  }
}

function tablaVisitas(detalle: DetalleVisita[]): Pick<TablaReporte, 'columnas' | 'filas'> {
  const columnas: Columna[] = [
    { etiqueta: 'Fecha' }, { etiqueta: 'Horario' }, { etiqueta: 'Razón' }, { etiqueta: 'Origen' }, { etiqueta: 'Tipo de visita' }, { etiqueta: 'Responsables' }, { etiqueta: 'Adultos atendidos' },
  ]
  return {
    columnas,
    filas: detalle.map((d) => fila(d.visita_id, [
      fecha(d.fecha),
      d.hora_inicio ? `${d.hora_inicio}${d.hora_fin ? ` – ${d.hora_fin}` : ''}` : '—',
      d.razon ?? '—',
      ORIGEN_VISITA[d.origen] ?? d.origen,
      d.tipo_visita === 'institucional' ? 'Institucional sin expediente' : 'Con expediente',
      d.responsables.map(nombre).join(', ') || '—',
      d.adultos.map((a) => `${nombre(a)}${a.estado_general ? ` (${ESTADO_GENERAL[a.estado_general] ?? a.estado_general})` : ''}`).join('; ') || '—',
    ])),
  }
}

function tablaNecesidades(detalle: DetalleNecesidad[]): Pick<TablaReporte, 'columnas' | 'filas'> {
  const columnas: Columna[] = [
    { etiqueta: 'Categoría' }, { etiqueta: 'Total', tipo: 'numero' }, { etiqueta: '% del total', tipo: 'numero' }, { etiqueta: 'Pendientes', tipo: 'numero' },
    { etiqueta: 'En proceso', tipo: 'numero' }, { etiqueta: 'Resueltas', tipo: 'numero' }, { etiqueta: 'Canceladas', tipo: 'numero' },
    { etiqueta: 'Prioridad alta', tipo: 'numero' }, { etiqueta: 'Recurrentes', tipo: 'numero' },
  ]
  return {
    columnas,
    filas: detalle.map((d) => fila(String(d.tipo_necesidad_id), [
      d.nombre, d.total, `${d.porcentaje}%`, d.pendientes, d.en_proceso, d.resueltas, d.canceladas, d.prioridad_alta, d.recurrentes,
    ])),
  }
}

function tablaCasos(detalle: DetalleCasoPrioritario[]): Pick<TablaReporte, 'columnas' | 'filas'> {
  const columnas: Columna[] = [
    { etiqueta: 'Adulto mayor' }, { etiqueta: 'Municipio' }, { etiqueta: 'Sector' }, { etiqueta: 'Riesgo vigente', tipo: 'riesgo' },
    { etiqueta: 'Alertas', tipo: 'numero' }, { etiqueta: 'Abiertas', tipo: 'numero' }, { etiqueta: 'Tipos de alerta' }, { etiqueta: 'Estado actual' }, { etiqueta: 'Última alerta' },
  ]
  return {
    columnas,
    filas: detalle.map((d) => fila(d.envejeciente_id, [
      nombre(d), ubicacion(d.municipio), d.zona ?? '—', textoRiesgo(d.riesgo_vigente), d.alertas, d.alertas_abiertas,
      d.tipos.map((t) => TIPO_ALERTA[t] ?? t).join(', ') || '—', ESTADO_ALERTA[d.estado_actual] ?? d.estado_actual, fecha(d.ultima_alerta),
    ], { adultoId: d.envejeciente_id, ...(d.riesgo_vigente && { riesgo: d.riesgo_vigente }) })),
  }
}

export const notaDeDetalle = (api: Pick<ReporteApi, 'detalle' | 'detalle_total' | 'detalle_truncado'>): string | undefined =>
  api.detalle_truncado
    ? `Detalle recortado: se muestran ${entero(api.detalle.length)} de ${entero(api.detalle_total)} filas. Acota el período o los filtros para ver el resto.`
    : undefined

function tablaDeReporte(api: ReporteApi): Pick<TablaReporte, 'columnas' | 'filas'> {
  switch (api.tipo) {
    case 'adultos': return tablaAdultos(api.detalle)
    case 'visitas': return tablaVisitas(api.detalle)
    case 'necesidades': return tablaNecesidades(api.detalle)
    case 'casos_prioritarios': return tablaCasos(api.detalle)
  }
}

/** Modelo de reporte que dibujan y exportan las pantallas del prototipo, armado con lo que respondió el servidor. */
export function construirReporte(api: ReporteApi): Reporte {
  const def = definicion(api.tipo)
  const nota = notaDeDetalle(api)
  return {
    tipo: api.tipo === 'casos_prioritarios' ? 'prioritarios' : api.tipo,
    titulo: def.label,
    descripcion: def.descripcion,
    vacio: api.vacio,
    kpis: indicadoresDeReporte(api),
    graficos: graficosDeReporte(api),
    tabla: { titulo: def.detalle, ...tablaDeReporte(api), ...(nota && { nota }) },
  }
}

/* ───────────── Análisis avanzado ───────────── */
const celdaDecimal = (valor: number | null, digitos: number) => (valor === null ? '—' : decimales(valor, digitos))
const celdaConteo = (valor: number | null) => (valor === null ? '—' : valor)
const variacion = (valor: number | null) => (valor === null ? '—' : `${valor > 0 ? '+' : ''}${valor}%`)

/**
 * Sin `visitas:ver` (p. ej. en cuentas Familia) el servidor publica las visitas como `null`: no son cero, son un dato que no
 * llega. Si todas las filas vienen así se ocultan las columnas y la serie de visitas; si solo algunas, se muestra un guion.
 */
const sinVisitas = (valores: Array<number | null>) => valores.length > 0 && valores.every((valor) => valor === null)
export const avanzadoSinVisitas = (api: Pick<AnalisisAvanzadoApi, 'comparativo_zonas' | 'comparativo_municipios' | 'tendencias'>) =>
  sinVisitas(api.comparativo_zonas.map((d) => d.visitas_realizadas)) || sinVisitas(api.comparativo_municipios.map((d) => d.visitas_realizadas)) ||
  sinVisitas(api.tendencias.map((d) => d.visitas_realizadas))

const columnasComparativo = (conVisitas: boolean): Columna[] => [
  { etiqueta: 'Adultos activos', tipo: 'numero' }, { etiqueta: 'Riesgo alto', tipo: 'numero' },
  ...(conVisitas ? [{ etiqueta: 'Visitas realizadas', tipo: 'numero' as const }, { etiqueta: 'Visitas por adulto', tipo: 'numero' as const }] : []),
  { etiqueta: 'Necesidades activas', tipo: 'numero' }, { etiqueta: 'Alertas abiertas', tipo: 'numero' },
  ...(conVisitas ? [{ etiqueta: 'Días sin visita (prom.)', tipo: 'numero' as const }] : []),
  { etiqueta: 'Sin personal asignado', tipo: 'numero' },
]
const celdasComparativo = (d: FilaComparativo, conVisitas: boolean): Array<string | number> => [
  d.adultos_activos, d.riesgo_alto,
  ...(conVisitas ? [celdaConteo(d.visitas_realizadas), celdaDecimal(d.visitas_por_adulto, 2)] : []),
  d.necesidades_activas, d.alertas_abiertas,
  ...(conVisitas ? [celdaDecimal(d.dias_sin_visita_promedio, 1)] : []),
  d.sin_personal_asignado,
]

/** Etiqueta de cada sector; si un mismo sector existe en dos municipios, se añade el municipio. */
export function etiquetasDeSectores(filas: Array<Pick<FilaComparativo, 'zona' | 'municipio'>>): string[] {
  const cuenta = new Map<string, number>()
  for (const f of filas) cuenta.set(f.zona ?? '', (cuenta.get(f.zona ?? '') ?? 0) + 1)
  return filas.map((f) => {
    const sector = f.zona ?? 'Sin sector'
    return (cuenta.get(f.zona ?? '') ?? 0) > 1 && f.municipio ? `${sector} (${f.municipio.nombre})` : sector
  })
}

export function construirAvanzado(api: AnalisisAvanzadoApi): AnalisisAvanzado {
  const sectores = etiquetasDeSectores(api.comparativo_zonas)
  const visitasZonas = !sinVisitas(api.comparativo_zonas.map((d) => d.visitas_realizadas))
  const visitasMunicipios = !sinVisitas(api.comparativo_municipios.map((d) => d.visitas_realizadas))
  const visitasTendencias = !sinVisitas(api.tendencias.map((d) => d.visitas_realizadas))
  const zonas: Analisis = {
    vacio: api.comparativo_zonas.length === 0,
    grafico: {
      id: 'zonas',
      titulo: 'Comparativo por sector',
      descripcion: visitasZonas ? 'Adultos activos, visitas realizadas y necesidades activas en cada sector' : 'Adultos activos y necesidades activas en cada sector',
      forma: 'barras',
      unidad: ['registro', 'registros'],
      etiquetas: sectores,
      series: [
        { nombre: 'Adultos activos', valores: api.comparativo_zonas.map((d) => d.adultos_activos) },
        ...(visitasZonas ? [{ nombre: 'Visitas realizadas', valores: api.comparativo_zonas.map((d) => d.visitas_realizadas ?? 0) }] : []),
        { nombre: 'Necesidades activas', valores: api.comparativo_zonas.map((d) => d.necesidades_activas) },
      ],
    } satisfies GraficoSeries,
    tabla: {
      titulo: 'Comparativo por sector',
      columnas: [{ etiqueta: 'Sector' }, { etiqueta: 'Municipio' }, ...columnasComparativo(visitasZonas)],
      filas: api.comparativo_zonas.map((d, i) => fila(`${d.municipio?.codigo ?? ''}|${d.zona ?? ''}|${i}`, [d.zona ?? 'Sin sector', ubicacion(d.municipio), ...celdasComparativo(d, visitasZonas)])),
    },
  }
  const tendencias: Analisis = {
    vacio: api.vacio,
    grafico: {
      id: 'tendencias',
      titulo: 'Tendencias mensuales',
      descripcion: `${api.tendencias.length === 1 ? 'Un mes' : `${api.tendencias.length} meses`} de ${visitasTendencias ? 'visitas, ' : ''}necesidades y alertas`,
      forma: 'lineas',
      unidad: ['registro', 'registros'],
      etiquetas: api.tendencias.map((d) => etiquetaMes(d.mes)),
      series: [
        ...(visitasTendencias ? [{ nombre: 'Visitas realizadas', valores: api.tendencias.map((d) => d.visitas_realizadas ?? 0) }] : []),
        { nombre: 'Necesidades registradas', valores: api.tendencias.map((d) => d.necesidades_registradas) },
        { nombre: 'Alertas prioritarias', valores: api.tendencias.map((d) => d.alertas_prioritarias) },
        { nombre: 'Perfiles nuevos', valores: api.tendencias.map((d) => d.perfiles_nuevos) },
      ],
    } satisfies GraficoSeries,
    tabla: {
      titulo: 'Tendencias mensuales',
      columnas: [
        { etiqueta: 'Mes' },
        ...(visitasTendencias ? [{ etiqueta: 'Visitas realizadas', tipo: 'numero' as const }, { etiqueta: 'Variación de visitas', tipo: 'numero' as const }] : []),
        { etiqueta: 'Necesidades registradas', tipo: 'numero' }, { etiqueta: 'Alertas prioritarias', tipo: 'numero' }, { etiqueta: 'Perfiles nuevos', tipo: 'numero' },
      ],
      filas: api.tendencias.map((d) => fila(d.mes, [
        etiquetaMes(d.mes),
        ...(visitasTendencias ? [celdaConteo(d.visitas_realizadas), variacion(d.variacion_visitas)] : []),
        d.necesidades_registradas, d.alertas_prioritarias, d.perfiles_nuevos,
      ])),
    },
  }
  return {
    zonas,
    tendencias,
    municipios: {
      vacio: api.comparativo_municipios.length === 0,
      tabla: {
        titulo: 'Comparativo por municipio',
        columnas: [{ etiqueta: 'Municipio' }, ...columnasComparativo(visitasMunicipios)],
        filas: api.comparativo_municipios.map((d, i) => fila(`${d.municipio?.codigo ?? ''}|${i}`, [ubicacion(d.municipio), ...celdasComparativo(d, visitasMunicipios)])),
      },
    },
  }
}

/** Reporte «de relleno» para exportar solo el análisis avanzado con los mismos generadores de PDF y Excel. */
export const reporteAvanzado = (): Reporte => ({
  tipo: 'adultos',
  titulo: 'Análisis avanzado',
  descripcion: 'Comparativo por sector y por municipio, y tendencias mensuales de los adultos mayores que cumplen los filtros de ubicación y riesgo.',
  vacio: false,
  kpis: [],
  graficos: [],
  tabla: { titulo: 'Análisis avanzado', columnas: [], filas: [] },
})

/** Nombre del archivo exportado en el navegador: `reporte-<tipo>-<YYYY-MM-DD>.<ext>` (el mismo patrón del CSV del servidor). */
export const nombreDeArchivo = (rutaTipo: string, hoy: string, extension: 'pdf' | 'xlsx' | 'csv') => `reporte-${rutaTipo}-${hoy}.${extension}`

/* ───────────── Permisos y plan (informativos: el servidor vuelve a validarlos) ───────────── */
type CuentaAcceso = Pick<CuentaMe, 'permisos' | 'tipo' | 'funcionalidades'>

/**
 * Tipos de reporte que el rol puede usar. Todos exigen `reportes:ver`; el de visitas exige además `visitas:ver`, y Visitas es
 * exclusivo de las Organizaciones (en Familia el servidor responde 403).
 */
export function tiposDisponibles(cuenta: CuentaAcceso): TipoReporte[] {
  if (!cuenta.permisos.includes('reportes:ver')) return []
  const visitas = cuenta.tipo === 'organizacion' && cuenta.permisos.includes('visitas:ver')
  return TIPOS_REPORTE.map((t) => t.value).filter((tipo) => tipo !== 'visitas' || visitas)
}
/** El plan incluye la funcionalidad según el contexto de la cuenta (`funcionalidades`). */
export const incluyeFuncionalidad = (cuenta: Pick<CuentaMe, 'funcionalidades'>, funcionalidad: 'dashboard_metricas' | 'reportes_avanzados') =>
  cuenta.funcionalidades?.includes(funcionalidad) === true

/** Opciones de ubicación del alcance que devuelve el servidor. */
export function opcionesUbicacion(api: OpcionesReporte | undefined) {
  return {
    municipios: (api?.municipios ?? []).map(({ codigo, nombre }) => ({ value: codigo, label: nombre ?? codigo })),
    sectores: (api?.sectores ?? []).map((sector) => ({ value: sector, label: sector })),
  }
}

/** Contexto de un PDF o Excel: usa la constancia que devolvió el servidor al registrar la exportación (quién, cuándo y cuál). */
export function contextoDeExportacion(datos: {
  exportacion: ExportacionApi
  reporte: Reporte
  filtros: string[]
  tipoCuenta: TipoCuenta
  imagenes: Record<string, ImagenGrafico>
  avanzado?: AnalisisAvanzado | null
  soloAvanzado?: boolean
}): ContextoExportacion {
  const { exportacion } = datos
  const { nombres, apellidos, rol } = exportacion.generado_por
  return {
    reporte: datos.reporte,
    filtros: datos.filtros,
    cuenta: `${exportacion.cuenta.nombre} · Cuenta ${TIPO_TEXTO[datos.tipoCuenta]}`,
    generadoPor: `${nombres} ${apellidos} (${ROL_TEXTO[rol as RolCuenta] ?? rol})`,
    generado: new Date(exportacion.fecha),
    avanzado: datos.avanzado ?? null,
    avisoAvanzado: '',
    imagenes: datos.imagenes,
    constancia: `Exportación ${exportacion.exportacion_id}`,
    ...(datos.soloAvanzado && { soloAvanzado: true }),
  }
}
