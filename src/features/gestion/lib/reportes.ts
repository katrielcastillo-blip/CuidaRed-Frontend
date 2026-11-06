/*
 * reportes.ts — Reportes estadísticos (RF-08 · CU-12): adultos mayores registrados, visitas realizadas
 * (incluidas las visitas compartidas, DetalleVisita), necesidades frecuentes (con prioridad y recurrencia de
 * Env_Necesidad) y casos prioritarios, con filtros de fecha, municipio (Municipio_Cod), sector, riesgo y
 * categoría. Incluye el análisis avanzado del plan «reportes_avanzados» (comparativo por zona y tendencias
 * mensuales) y los textos accesibles de cada gráfico (aria-label y tabla de datos).
 * Funciones puras (sin React): calculan el reporte, describen los filtros y generan el CSV.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { nombreCompleto } from '@/domain/auth'
import { addDays, edad, fechaCorta, fechaLarga, toISODate } from '@/domain/dates'
import { diasSinVisita } from '@/domain/reglas'
import { adultosDeVisita, nombreMunicipio } from '@/domain/relaciones'
import type { Adulto, Alerta, Catalogos, DB, EstadoAdultoVisita, Prioridad, Riesgo, TipoNecesidad } from '@/domain/types'
import { diaLocal, ESTADO_ALERTA_TEXTO, ESTADO_NECESIDAD_TEXTO, necesidadAbierta, nombreAdulto, RIESGO_TEXTO, TIPO_NECESIDAD_TEXTO } from './formato'
import { personalAsignado, usuariosActivos } from './resumen'

/* ───────────── Tipos de reporte y filtros ───────────── */
export type TipoReporte = 'adultos' | 'visitas' | 'necesidades' | 'prioritarios'

export const TIPOS_REPORTE: Array<{ value: TipoReporte; label: string; descripcion: string }> = [
  { value: 'adultos', label: 'Adultos mayores registrados', descripcion: 'Perfiles registrados en el período, por nivel de riesgo, municipio y sector.' },
  { value: 'visitas', label: 'Visitas realizadas', descripcion: 'Visitas comunitarias completadas en el período y estado observado.' },
  { value: 'necesidades', label: 'Necesidades frecuentes', descripcion: 'Necesidades registradas en el período, agrupadas por categoría, prioridad y recurrencia.' },
  { value: 'prioritarios', label: 'Casos prioritarios', descripcion: 'Adultos con alertas de urgencia Alta (caso prioritario o emergencia).' },
]

export type Rango = 'todo' | 'mes' | '3m' | '6m' | 'anio' | 'personalizado'

export const RANGOS: Array<{ value: Rango; label: string }> = [
  { value: 'todo', label: 'Todo el tiempo' },
  { value: 'mes', label: 'Este mes' },
  { value: '3m', label: 'Últimos 3 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: 'anio', label: 'Este año' },
  { value: 'personalizado', label: 'Personalizado (desde / hasta)' },
]

export interface FiltrosReporte {
  tipo: TipoReporte
  rango: Rango
  /** YYYY-MM-DD; solo con rango personalizado. */
  desde: string
  hasta: string
  /** Municipio_Cod ('' = todos). */
  municipio: string
  /** Sector o barrio ('' = todos). */
  sector: string
  riesgo: '' | Riesgo
  /** Categoría de necesidad (reporte de necesidades frecuentes). */
  categoria: '' | TipoNecesidad
}

export const FILTROS_INICIALES: FiltrosReporte = { tipo: 'adultos', rango: 'todo', desde: '', hasta: '', municipio: '', sector: '', riesgo: '', categoria: '' }

/** Límites del período (YYYY-MM-DD, inclusivos); null = sin límite. */
export function limitesRango(f: Pick<FiltrosReporte, 'rango' | 'desde' | 'hasta'>, hoy: Date = new Date()): { desde: string | null; hasta: string | null } {
  if (f.rango === 'todo') return { desde: null, hasta: null }
  if (f.rango === 'personalizado') return { desde: f.desde || null, hasta: f.hasta || null }
  const meses = f.rango === 'mes' ? 1 : f.rango === '3m' ? 3 : 6
  const inicio = f.rango === 'anio' ? new Date(hoy.getFullYear(), 0, 1) : new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1), 1)
  return { desde: toISODate(inicio), hasta: toISODate(hoy) }
}

/** Error del rango personalizado (se muestra junto al campo "Hasta"). */
export function errorRango(f: Pick<FiltrosReporte, 'rango' | 'desde' | 'hasta'>): string | undefined {
  if (f.rango !== 'personalizado' || !f.desde || !f.hasta) return undefined
  return f.desde > f.hasta ? 'La fecha "hasta" debe ser igual o posterior a "desde".' : undefined
}

const dentro = (dia: string, l: { desde: string | null; hasta: string | null }) => (!l.desde || dia >= l.desde) && (!l.hasta || dia <= l.hasta)
const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0)

/* ───────────── Estructura común de un reporte ───────────── */
export interface Kpi {
  etiqueta: string
  valor: string | number
  nota?: string
  peligro?: boolean
}

export interface Barra {
  etiqueta: string
  valor: number
  /** Porcentaje respecto al total del gráfico. */
  pct: number
  riesgo?: Riesgo
}

export interface Grafico {
  id: string
  titulo: string
  descripcion?: string
  /** 'h' = barras horizontales con texto · 'v' = columnas por mes. */
  forma: 'h' | 'v'
  /** 'dona' dibuja un anillo (partes de un todo con pocas categorías); por defecto, barras según `forma`. */
  visual?: 'dona'
  unidad: [string, string] // singular, plural
  barras: Barra[]
}

export interface Columna {
  etiqueta: string
  tipo?: 'texto' | 'numero' | 'riesgo'
}

export interface Fila {
  id: string
  /** Si la fila corresponde a un adulto, se enlaza a su perfil. */
  adultoId?: string
  riesgo?: Riesgo
  celdas: Array<string | number>
}

export interface Reporte {
  tipo: TipoReporte
  titulo: string
  descripcion: string
  vacio: boolean
  kpis: Kpi[]
  graficos: Grafico[]
  tabla: { titulo: string; columnas: Columna[]; filas: Fila[] }
}

export const SIN_DATOS = 'No existen datos disponibles para este reporte con los filtros seleccionados.'

type Datos = Pick<DB, 'visitas' | 'necesidades' | 'alertas' | 'usuarios' | 'vinculos' | 'catalogos'>

const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const NIVELES: Riesgo[] = ['alto', 'medio', 'bajo']
const TIPOS: TipoNecesidad[] = ['medicamentos', 'alimentacion', 'transporte', 'compania', 'otros']
const PRIORIDADES: Prioridad[] = ['alta', 'media', 'baja']
const ESTADO_ADULTO_TEXTO: Record<EstadoAdultoVisita, string> = {
  estable: 'Estable',
  requiere_atencion: 'Requiere atención',
  situacion_critica: 'Situación crítica',
}

const barras = (items: Array<{ etiqueta: string; valor: number; riesgo?: Riesgo }>): Barra[] => {
  const total = items.reduce((t, x) => t + x.valor, 0)
  return items.map((x) => ({ ...x, pct: porcentaje(x.valor, total) }))
}

const encabezado = (tipo: TipoReporte) => {
  const t = TIPOS_REPORTE.find((x) => x.value === tipo)!
  return { tipo, titulo: t.label, descripcion: t.descripcion }
}

/* ───────────── Reportes ───────────── */
const contar = (claves: string[]) => {
  const m = new Map<string, number>()
  for (const k of claves) m.set(k, (m.get(k) ?? 0) + 1)
  return [...m.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'es')).map(([etiqueta, valor]) => ({ etiqueta, valor }))
}

function reporteAdultos(base: Adulto[], db: Datos, lim: ReturnType<typeof limitesRango>): Reporte {
  const lista = base.filter((a) => dentro(diaLocal(a.creadoEn), lim)).sort((x, y) => nombreAdulto(x).localeCompare(nombreAdulto(y), 'es'))
  const activos = lista.filter((a) => a.estado === 'activo')
  const edades = lista.filter((a) => !a.anonimizado).map((a) => edad(a.fechaNacimiento))
  const muni = (a: Adulto) => nombreMunicipio(db.catalogos, a.municipioCod) || 'Sin municipio'
  // Personal asignado = cuidadores + voluntarios con cuenta activa (asignadosDe).
  const activosIds = usuariosActivos(db.usuarios)
  const personal = (a: Adulto) => personalAsignado(db.vinculos, activosIds, a.id).ids.length
  const sinPersonal = activos.filter((a) => personal(a) === 0).length
  return {
    ...encabezado('adultos'),
    vacio: lista.length === 0,
    kpis: [
      { etiqueta: 'Adultos registrados', valor: lista.length, nota: 'En el período' },
      { etiqueta: 'Perfiles activos', valor: activos.length, nota: `${lista.length - activos.length} inactivos` },
      { etiqueta: 'Riesgo alto', valor: activos.filter((a) => a.riesgo === 'alto').length, nota: 'Perfiles activos', peligro: activos.some((a) => a.riesgo === 'alto') },
      { etiqueta: 'Edad promedio', valor: edades.length ? Math.round(edades.reduce((t, e) => t + e, 0) / edades.length) : '—', nota: 'años' },
      { etiqueta: 'Sin personal asignado', valor: sinPersonal, nota: 'Perfiles activos', peligro: sinPersonal > 0 },
    ],
    graficos: [
      {
        id: 'riesgo',
        titulo: 'Adultos activos por nivel de riesgo',
        forma: 'h',
        visual: 'dona',
        unidad: ['adulto', 'adultos'],
        barras: barras(NIVELES.map((n) => ({ etiqueta: RIESGO_TEXTO[n], valor: activos.filter((a) => a.riesgo === n).length, riesgo: n }))),
      },
      {
        id: 'municipio',
        titulo: 'Adultos activos por municipio',
        forma: 'h',
        unidad: ['adulto', 'adultos'],
        barras: barras(contar(activos.map(muni))),
      },
      {
        id: 'sector',
        titulo: 'Adultos activos por sector',
        forma: 'h',
        unidad: ['adulto', 'adultos'],
        barras: barras(contar(activos.map((a) => a.zona || 'Sin sector'))),
      },
    ],
    tabla: {
      titulo: 'Detalle de adultos mayores',
      columnas: [
        { etiqueta: 'Nombre' },
        { etiqueta: 'Cédula' },
        { etiqueta: 'Municipio' },
        { etiqueta: 'Sector' },
        { etiqueta: 'Edad', tipo: 'numero' },
        { etiqueta: 'Riesgo', tipo: 'riesgo' },
        { etiqueta: 'Personal asignado', tipo: 'numero' },
        { etiqueta: 'Registrado' },
        { etiqueta: 'Estado' },
      ],
      filas: lista.map((a) => ({
        id: a.id,
        adultoId: a.id,
        riesgo: a.riesgo,
        celdas: [
          nombreAdulto(a),
          a.cedula,
          muni(a),
          a.zona || '—',
          a.anonimizado ? '—' : edad(a.fechaNacimiento),
          RIESGO_TEXTO[a.riesgo],
          personal(a),
          fechaCorta(a.creadoEn),
          a.estado === 'activo' ? 'Activo' : 'Inactivo',
        ],
      })),
    },
  }
}

/** Meses (clave YYYY-MM) entre dos fechas, como máximo los 12 últimos. */
function mesesEntre(desde: string, hasta: string) {
  const [ya, ma] = desde.split('-').map(Number)
  const [yb, mb] = hasta.split('-').map(Number)
  const lista: Array<{ clave: string; y: number; m: number }> = []
  let y = ya!
  let m = ma! - 1
  while (y < yb! || (y === yb! && m <= mb! - 1)) {
    lista.push({ clave: `${y}-${String(m + 1).padStart(2, '0')}`, y, m })
    m++
    if (m === 12) {
      m = 0
      y++
    }
  }
  return lista.slice(-12)
}

function reporteVisitas(base: Adulto[], db: Datos, lim: ReturnType<typeof limitesRango>, hoy: Date): Reporte {
  const porId = new Map(base.map((a) => [a.id, a]))
  // Una visita cuenta si atendió a algún adulto del filtro (principal o adicional del hogar, DetalleVisita).
  const lista = db.visitas
    .filter((v) => v.estado === 'completada' && adultosDeVisita(v).some((id) => porId.has(id)) && dentro(v.fecha, lim))
    .sort((x, y) => y.fecha.localeCompare(x.fecha) || y.horaPautada.localeCompare(x.horaPautada))
  const visitados = new Set(lista.flatMap((v) => adultosDeVisita(v).filter((id) => porId.has(id))))
  const compartidas = lista.filter((v) => v.detallesAdicionales.length > 0).length
  const atencion = lista.filter((v) => v.estadoAdulto === 'requiere_atencion' || v.estadoAdulto === 'situacion_critica').length
  const hasta = lim.hasta ?? toISODate(hoy)
  const primera = lista.length ? lista[lista.length - 1]!.fecha : toISODate(addDays(hoy, -150))
  const desde = lim.desde ?? (primera < hasta ? primera : hasta)
  const meses = mesesEntre(desde, hasta)
  const variosAnios = new Set(meses.map((x) => x.y)).size > 1
  const usuario = (id: string) => {
    const u = db.usuarios.find((x) => x.id === id)
    return u ? nombreCompleto(u) : '—'
  }
  return {
    ...encabezado('visitas'),
    vacio: lista.length === 0,
    kpis: [
      { etiqueta: 'Visitas realizadas', valor: lista.length, nota: 'Completadas en el período' },
      { etiqueta: 'Adultos visitados', valor: visitados.size, nota: `de ${base.filter((a) => a.estado === 'activo').length} activos` },
      { etiqueta: 'Promedio por adulto', valor: visitados.size ? (lista.length / visitados.size).toFixed(1).replace('.', ',') : '0', nota: 'visitas' },
      { etiqueta: 'Requirieron atención', valor: atencion, nota: 'Estado del adulto en la visita', peligro: atencion > 0 },
      { etiqueta: 'Visitas compartidas', valor: compartidas, nota: 'Más de un adulto del hogar' },
    ],
    graficos: [
      {
        id: 'mes',
        titulo: 'Visitas por mes',
        descripcion: meses.length === 12 ? 'Últimos 12 meses del período' : undefined,
        forma: 'v',
        unidad: ['visita', 'visitas'],
        barras: barras(
          meses.map((x) => ({
            etiqueta: `${MES_CORTO[x.m]}${variosAnios ? ` ${String(x.y).slice(2)}` : ''}`,
            valor: lista.filter((v) => v.fecha.startsWith(x.clave)).length,
          })),
        ),
      },
      {
        id: 'estado',
        titulo: 'Estado observado del adulto',
        forma: 'h',
        unidad: ['visita', 'visitas'],
        barras: barras(
          (Object.keys(ESTADO_ADULTO_TEXTO) as EstadoAdultoVisita[]).map((e) => ({ etiqueta: ESTADO_ADULTO_TEXTO[e], valor: lista.filter((v) => v.estadoAdulto === e).length })),
        ),
      },
    ],
    tabla: {
      titulo: 'Detalle de visitas',
      columnas: [{ etiqueta: 'Fecha' }, { etiqueta: 'Adultos atendidos' }, { etiqueta: 'Responsable' }, { etiqueta: 'Razón' }, { etiqueta: 'Estado del adulto' }],
      filas: lista.map((v) => {
        const atendidos = adultosDeVisita(v)
          .map((id) => porId.get(id))
          .filter((a): a is Adulto => !!a)
        return {
          id: v.id,
          adultoId: atendidos[0]?.id,
          celdas: [fechaCorta(v.fecha), atendidos.map(nombreAdulto).join(', '), usuario(v.cuidadorId), v.razon || v.tipo, v.estadoAdulto ? ESTADO_ADULTO_TEXTO[v.estadoAdulto] : '—'],
        }
      }),
    },
  }
}

function reporteNecesidades(base: Adulto[], db: Datos, lim: ReturnType<typeof limitesRango>, categoria: FiltrosReporte['categoria']): Reporte {
  const ids = new Set(base.map((a) => a.id))
  const lista = db.necesidades.filter((n) => ids.has(n.adultoId) && (!categoria || n.tipo === categoria) && dentro(diaLocal(n.creadaEn), lim))
  const porTipo = TIPOS.map((t) => {
    const deTipo = lista.filter((n) => n.tipo === t)
    return {
      tipo: t,
      total: deTipo.length,
      pendiente: deTipo.filter((n) => n.estado === 'pendiente').length,
      en_proceso: deTipo.filter((n) => n.estado === 'en_proceso').length,
      satisfecha: deTipo.filter((n) => n.estado === 'satisfecha').length,
      inactiva: deTipo.filter((n) => n.estado === 'inactiva').length,
      alta: deTipo.filter((n) => n.prioridad === 'alta').length,
      recurrentes: deTipo.filter((n) => n.recurrente).length,
    }
  })
    .filter((x) => x.total > 0)
    .sort((x, y) => y.total - x.total)
  const pendientes = lista.filter((n) => necesidadAbierta(n.estado)).length
  const altaAbiertas = lista.filter((n) => n.prioridad === 'alta' && necesidadAbierta(n.estado)).length
  const recurrentes = lista.filter((n) => n.recurrente).length
  const nombrePrioridad = (p: Prioridad) => db.catalogos.prioridades.find((x) => x.id === p)?.nombre ?? p
  return {
    ...encabezado('necesidades'),
    vacio: lista.length === 0,
    kpis: [
      { etiqueta: 'Necesidades registradas', valor: lista.length, nota: 'En el período' },
      { etiqueta: 'Por resolver', valor: pendientes, nota: 'Pendientes o en proceso', peligro: pendientes > 0 },
      { etiqueta: 'Satisfechas', valor: lista.filter((n) => n.estado === 'satisfecha').length, nota: `${porcentaje(lista.filter((n) => n.estado === 'satisfecha').length, lista.length)}% del total` },
      { etiqueta: 'Prioridad alta por resolver', valor: altaAbiertas, nota: 'Catálogo de prioridades', peligro: altaAbiertas > 0 },
      { etiqueta: 'Recurrentes', valor: recurrentes, nota: `${porcentaje(recurrentes, lista.length)}% del total (se repiten)` },
      { etiqueta: 'Más frecuente', valor: porTipo[0] ? TIPO_NECESIDAD_TEXTO[porTipo[0].tipo] : '—', nota: porTipo[0] ? `${porTipo[0].total} solicitudes` : undefined },
    ],
    graficos: [
      {
        id: 'categoria',
        titulo: 'Necesidades por categoría',
        descripcion: 'De la más a la menos frecuente',
        forma: 'h',
        unidad: ['necesidad', 'necesidades'],
        barras: barras(porTipo.map((x) => ({ etiqueta: TIPO_NECESIDAD_TEXTO[x.tipo], valor: x.total }))),
      },
      {
        id: 'estado',
        titulo: 'Necesidades por estado',
        forma: 'h',
        unidad: ['necesidad', 'necesidades'],
        barras: barras((['pendiente', 'en_proceso', 'satisfecha', 'inactiva'] as const).map((e) => ({ etiqueta: ESTADO_NECESIDAD_TEXTO[e], valor: lista.filter((n) => n.estado === e).length }))),
      },
      {
        id: 'prioridad',
        titulo: 'Necesidades por prioridad',
        forma: 'h',
        unidad: ['necesidad', 'necesidades'],
        barras: barras(PRIORIDADES.map((p) => ({ etiqueta: nombrePrioridad(p), valor: lista.filter((n) => n.prioridad === p).length }))),
      },
      {
        id: 'recurrencia',
        titulo: 'Recurrentes y puntuales',
        forma: 'h',
        unidad: ['necesidad', 'necesidades'],
        barras: barras([
          { etiqueta: 'Recurrentes', valor: recurrentes },
          { etiqueta: 'Puntuales', valor: lista.length - recurrentes },
        ]),
      },
    ],
    tabla: {
      titulo: 'Necesidades frecuentes por categoría',
      columnas: [
        { etiqueta: 'Categoría' },
        { etiqueta: 'Total', tipo: 'numero' },
        { etiqueta: '% del total', tipo: 'numero' },
        { etiqueta: 'Pendientes', tipo: 'numero' },
        { etiqueta: 'En proceso', tipo: 'numero' },
        { etiqueta: 'Satisfechas', tipo: 'numero' },
        { etiqueta: 'Inactivas', tipo: 'numero' },
        { etiqueta: 'Prioridad alta', tipo: 'numero' },
        { etiqueta: 'Recurrentes', tipo: 'numero' },
      ],
      filas: porTipo.map((x) => ({
        id: x.tipo,
        celdas: [TIPO_NECESIDAD_TEXTO[x.tipo], x.total, `${porcentaje(x.total, lista.length)}%`, x.pendiente, x.en_proceso, x.satisfecha, x.inactiva, x.alta, x.recurrentes],
      })),
    },
  }
}

/** Agrupa las condiciones de las alertas en categorías legibles para el gráfico. */
function categoriaCondicion(al: Alerta, c: string) {
  const t = c.toLowerCase()
  if (t.includes('riesgo')) return 'Riesgo social alto'
  if (t.includes('medicamento')) return 'Medicamentos pendientes'
  if (al.tipo === 'emergencia') return 'Emergencia reportada en visita'
  return c
}

function reportePrioritarios(base: Adulto[], db: Datos, lim: ReturnType<typeof limitesRango>): Reporte {
  const porId = new Map(base.map((a) => [a.id, a]))
  const alertas = db.alertas
    .filter((al) => (al.tipo === 'prioritaria' || al.tipo === 'emergencia') && porId.has(al.adultoId) && dentro(diaLocal(al.creadaEn), lim))
    .sort((x, y) => y.creadaEn.localeCompare(x.creadaEn))
  const casos = new Map<string, Alerta[]>()
  for (const al of alertas) casos.set(al.adultoId, [...(casos.get(al.adultoId) ?? []), al])
  const condiciones = new Map<string, number>()
  for (const al of alertas) {
    const cats = new Set((al.condiciones.length ? al.condiciones : [al.titulo]).map((c) => categoriaCondicion(al, c)))
    for (const c of cats) condiciones.set(c, (condiciones.get(c) ?? 0) + 1)
  }
  const abiertos = [...casos.values()].filter((l) => l.some((al) => al.estado !== 'atendida')).length
  const filas = [...casos.entries()]
    .map(([adultoId, l]) => {
      const a = porId.get(adultoId)!
      const ultima = l[0]!
      const abierta = l.find((al) => al.estado !== 'atendida')
      return {
        id: adultoId,
        adultoId,
        riesgo: a.riesgo,
        abierta: !!abierta,
        celdas: [
          nombreAdulto(a),
          nombreMunicipio(db.catalogos, a.municipioCod) || '—',
          a.zona || '—',
          RIESGO_TEXTO[a.riesgo],
          [...new Set(l.flatMap((al) => (al.condiciones.length ? al.condiciones : [al.titulo])))].join('; '),
          l.length,
          ESTADO_ALERTA_TEXTO[(abierta ?? ultima).estado],
          fechaCorta(ultima.creadaEn),
        ] as Array<string | number>,
      }
    })
    .sort((x, y) => Number(y.abierta) - Number(x.abierta) || String(x.celdas[0]).localeCompare(String(y.celdas[0]), 'es'))
  return {
    ...encabezado('prioritarios'),
    vacio: alertas.length === 0,
    kpis: [
      { etiqueta: 'Casos prioritarios', valor: casos.size, nota: 'Adultos con urgencia Alta', peligro: casos.size > 0 },
      { etiqueta: 'Casos abiertos', valor: abiertos, nota: 'Con alerta sin atender', peligro: abiertos > 0 },
      { etiqueta: 'Alertas de urgencia Alta', valor: alertas.length, nota: 'Generadas en el período' },
      { etiqueta: 'Alertas atendidas', valor: alertas.filter((al) => al.estado === 'atendida').length, nota: `${porcentaje(alertas.filter((al) => al.estado === 'atendida').length, alertas.length)}% del total` },
    ],
    graficos: [
      {
        id: 'estado',
        titulo: 'Alertas por estado de atención',
        forma: 'h',
        unidad: ['alerta', 'alertas'],
        barras: barras((['pendiente', 'en_atencion', 'atendida'] as const).map((e) => ({ etiqueta: ESTADO_ALERTA_TEXTO[e], valor: alertas.filter((al) => al.estado === e).length }))),
      },
      {
        id: 'condicion',
        titulo: 'Condiciones que originaron las alertas',
        forma: 'h',
        unidad: ['alerta', 'alertas'],
        barras: barras([...condiciones.entries()].sort((x, y) => y[1] - x[1]).map(([etiqueta, valor]) => ({ etiqueta, valor }))),
      },
    ],
    tabla: {
      titulo: 'Detalle de casos prioritarios',
      columnas: [
        { etiqueta: 'Adulto mayor' },
        { etiqueta: 'Municipio' },
        { etiqueta: 'Sector' },
        { etiqueta: 'Riesgo', tipo: 'riesgo' },
        { etiqueta: 'Condiciones' },
        { etiqueta: 'Alertas', tipo: 'numero' },
        { etiqueta: 'Estado actual' },
        { etiqueta: 'Última alerta' },
      ],
      filas: filas.map(({ id, adultoId, riesgo, celdas }) => ({ id, adultoId, riesgo, celdas })),
    },
  }
}

/** Adultos que pasan los filtros de ubicación y riesgo (los de fecha y categoría se aplican a cada registro). */
const adultosFiltrados = (adultos: Adulto[], f: FiltrosReporte) =>
  adultos.filter((a) => (!f.municipio || a.municipioCod === f.municipio) && (!f.sector || a.zona === f.sector) && (!f.riesgo || a.riesgo === f.riesgo))

/**
 * Genera el reporte solicitado con información actualizada.
 * @param adultos adultos que el usuario puede consultar (adultosVisibles).
 */
export function generarReporte(db: Datos, adultos: Adulto[], f: FiltrosReporte, hoy: Date = new Date()): Reporte {
  const lim = limitesRango(f, hoy)
  const base = adultosFiltrados(adultos, f)
  switch (f.tipo) {
    case 'adultos':
      return reporteAdultos(base, db, lim)
    case 'visitas':
      return reporteVisitas(base, db, lim, hoy)
    case 'necesidades':
      return reporteNecesidades(base, db, lim, f.categoria)
    case 'prioritarios':
      return reportePrioritarios(base, db, lim)
  }
}

/* ───────────── Análisis avanzado (plan «reportes_avanzados») ───────────── */
export interface SerieGrafico {
  nombre: string
  valores: number[]
}

/** Gráfico con varias series sobre las mismas etiquetas (comparativo por zona y tendencias). */
export interface GraficoSeries {
  id: string
  titulo: string
  descripcion?: string
  /** 'barras' agrupadas por etiqueta · 'lineas' (evolución mensual). */
  forma: 'barras' | 'lineas'
  unidad: [string, string]
  etiquetas: string[]
  series: SerieGrafico[]
}

export type TablaReporte = Reporte['tabla']

export interface Analisis {
  vacio: boolean
  grafico: GraficoSeries
  tabla: TablaReporte
}

export interface AnalisisAvanzado {
  zonas: Analisis
  tendencias: Analisis
}

/** Cualquier gráfico que se puede dibujar, exportar o imprimir. */
export type GraficoReporte = Grafico | GraficoSeries

export const esGraficoSeries = (g: GraficoReporte): g is GraficoSeries => 'series' in g

/** Meses que abarca la tendencia: el período elegido o, si es muy corto, los 6 últimos hasta su fin. */
function mesesTendencia(lim: ReturnType<typeof limitesRango>, hoy: Date) {
  const hasta = lim.hasta ?? toISODate(hoy)
  const desde = lim.desde ?? toISODate(new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1))
  const delPeriodo = mesesEntre(desde < hasta ? desde : hasta, hasta)
  if (delPeriodo.length >= 3) return delPeriodo
  const [y, m] = hasta.split('-').map(Number)
  return mesesEntre(toISODate(new Date(y!, m! - 6, 1)), hasta)
}

const variacion = (actual: number, previo: number | undefined) => {
  if (previo === undefined) return '—'
  if (previo === 0) return actual === 0 ? '0%' : 'Nuevo'
  const v = Math.round(((actual - previo) / previo) * 100)
  return `${v > 0 ? '+' : ''}${v}%`
}

/**
 * Comparativo por zona (sector) y tendencias mensuales de los adultos que pasan los filtros de ubicación y
 * riesgo (no depende del tipo de reporte elegido). Funcionalidad del plan «reportes_avanzados».
 */
export function analisisAvanzado(db: Datos, adultos: Adulto[], f: FiltrosReporte, hoy: Date = new Date()): AnalisisAvanzado {
  const lim = limitesRango(f, hoy)
  const base = adultosFiltrados(adultos, f)
  const porId = new Map(base.map((a) => [a.id, a]))
  const muni = (a: Adulto) => nombreMunicipio(db.catalogos, a.municipioCod) || 'Sin municipio'
  const activosIds = usuariosActivos(db.usuarios)
  const completadas = db.visitas.filter((v) => v.estado === 'completada' && adultosDeVisita(v).some((id) => porId.has(id)))

  /* Comparativo por zona. */
  const zonas = new Map<string, { zona: string; municipio: string; adultos: Adulto[] }>()
  for (const a of base) {
    const k = `${a.municipioCod}|${a.zona}`
    const z = zonas.get(k) ?? { zona: a.zona || 'Sin sector', municipio: muni(a), adultos: [] }
    z.adultos.push(a)
    zonas.set(k, z)
  }
  // Si un mismo sector existe en dos municipios, la etiqueta incluye el municipio.
  const vistas = new Set<string>()
  const repetidas = new Set<string>()
  for (const z of zonas.values()) (vistas.has(z.zona) ? repetidas : vistas).add(z.zona)
  const filasZona = [...zonas.entries()]
    .map(([k, z]) => {
      const ids = new Set(z.adultos.map((a) => a.id))
      const activos = z.adultos.filter((a) => a.estado === 'activo')
      const visitas = completadas.filter((v) => dentro(v.fecha, lim) && adultosDeVisita(v).some((id) => ids.has(id))).length
      const dias = activos.map((a) => diasSinVisita(db, a, hoy).dias)
      return {
        k,
        etiqueta: repetidas.has(z.zona) ? `${z.zona} (${z.municipio})` : z.zona,
        sector: z.zona,
        municipio: z.municipio,
        activos: activos.length,
        riesgoAlto: activos.filter((a) => a.riesgo === 'alto').length,
        visitas,
        porAdulto: activos.length ? (visitas / activos.length).toFixed(1).replace('.', ',') : '—',
        necesidades: db.necesidades.filter((n) => ids.has(n.adultoId) && necesidadAbierta(n.estado) && dentro(diaLocal(n.creadaEn), lim)).length,
        alertas: db.alertas.filter((al) => ids.has(al.adultoId) && al.estado !== 'atendida').length,
        dias: dias.length ? Math.round(dias.reduce((t, d) => t + d, 0) / dias.length) : 0,
        sinPersonal: activos.filter((a) => personalAsignado(db.vinculos, activosIds, a.id).ids.length === 0).length,
      }
    })
    .sort((x, y) => y.activos - x.activos || x.etiqueta.localeCompare(y.etiqueta, 'es'))

  /* Tendencias mensuales. */
  const meses = mesesTendencia(lim, hoy)
  const variosAnios = new Set(meses.map((x) => x.y)).size > 1
  const etiquetaMes = (x: { m: number; y: number }) => `${MES_CORTO[x.m]}${variosAnios ? ` ${String(x.y).slice(2)}` : ''}`
  const altas = db.alertas.filter((al) => (al.tipo === 'prioritaria' || al.tipo === 'emergencia') && porId.has(al.adultoId))
  const visitasMes = meses.map((x) => completadas.filter((v) => v.fecha.startsWith(x.clave)).length)
  const necesidadesMes = meses.map((x) => db.necesidades.filter((n) => porId.has(n.adultoId) && diaLocal(n.creadaEn).startsWith(x.clave)).length)
  const alertasMes = meses.map((x) => altas.filter((al) => diaLocal(al.creadaEn).startsWith(x.clave)).length)
  const perfilesMes = meses.map((x) => base.filter((a) => diaLocal(a.creadoEn).startsWith(x.clave)).length)

  return {
    zonas: {
      vacio: filasZona.length === 0,
      grafico: {
        id: 'zonas',
        titulo: 'Comparativo por zona',
        descripcion: 'Adultos activos, visitas realizadas y necesidades por resolver en cada sector',
        forma: 'barras',
        unidad: ['registro', 'registros'],
        etiquetas: filasZona.map((x) => x.etiqueta),
        series: [
          { nombre: 'Adultos activos', valores: filasZona.map((x) => x.activos) },
          { nombre: 'Visitas realizadas', valores: filasZona.map((x) => x.visitas) },
          { nombre: 'Necesidades por resolver', valores: filasZona.map((x) => x.necesidades) },
        ],
      },
      tabla: {
        titulo: 'Comparativo por zona (sector)',
        columnas: [
          { etiqueta: 'Sector' },
          { etiqueta: 'Municipio' },
          { etiqueta: 'Adultos activos', tipo: 'numero' },
          { etiqueta: 'Riesgo alto', tipo: 'numero' },
          { etiqueta: 'Visitas realizadas', tipo: 'numero' },
          { etiqueta: 'Visitas por adulto', tipo: 'numero' },
          { etiqueta: 'Necesidades por resolver', tipo: 'numero' },
          { etiqueta: 'Alertas abiertas', tipo: 'numero' },
          { etiqueta: 'Días sin visita (prom.)', tipo: 'numero' },
          { etiqueta: 'Sin personal asignado', tipo: 'numero' },
        ],
        filas: filasZona.map((x) => ({ id: x.k, celdas: [x.sector, x.municipio, x.activos, x.riesgoAlto, x.visitas, x.porAdulto, x.necesidades, x.alertas, x.dias, x.sinPersonal] })),
      },
    },
    tendencias: {
      vacio: base.length === 0,
      grafico: {
        id: 'tendencias',
        titulo: 'Tendencias mensuales',
        descripcion: `Últimos ${meses.length} meses`,
        forma: 'lineas',
        unidad: ['registro', 'registros'],
        etiquetas: meses.map(etiquetaMes),
        series: [
          { nombre: 'Visitas realizadas', valores: visitasMes },
          { nombre: 'Necesidades registradas', valores: necesidadesMes },
          { nombre: 'Alertas de urgencia alta', valores: alertasMes },
          { nombre: 'Perfiles nuevos', valores: perfilesMes },
        ],
      },
      tabla: {
        titulo: 'Tendencias mensuales',
        columnas: [
          { etiqueta: 'Mes' },
          { etiqueta: 'Visitas realizadas', tipo: 'numero' },
          { etiqueta: 'Variación de visitas', tipo: 'numero' },
          { etiqueta: 'Necesidades registradas', tipo: 'numero' },
          { etiqueta: 'Alertas de urgencia alta', tipo: 'numero' },
          { etiqueta: 'Perfiles nuevos', tipo: 'numero' },
        ],
        filas: meses.map((x, i) => ({
          id: x.clave,
          celdas: [etiquetaMes(x), visitasMes[i]!, variacion(visitasMes[i]!, i > 0 ? visitasMes[i - 1] : undefined), necesidadesMes[i]!, alertasMes[i]!, perfilesMes[i]!],
        })),
      },
    },
  }
}

/* ───────────── Alternativa accesible de los gráficos ───────────── */
const TIPO_GRAFICO_TEXTO = { barras: 'barras', lineas: 'líneas', dona: 'anillo' } as const

/** Tipo de gráfico en palabras, para el aria-label ("Gráfico de barras"). */
export const tipoGraficoTexto = (g: GraficoReporte) => TIPO_GRAFICO_TEXTO[esGraficoSeries(g) ? g.forma : (g.visual ?? 'barras')]

/**
 * Descripción completa del gráfico para lectores de pantalla (aria-label del canvas): título, tipo y cada valor.
 * La misma información está disponible como tabla (tablaDeGrafico).
 */
export function describirGrafico(g: GraficoReporte): string {
  const cabecera = `Gráfico de ${tipoGraficoTexto(g)}: ${g.titulo}.`
  if (esGraficoSeries(g)) {
    if (g.etiquetas.length === 0) return `${cabecera} Sin datos.`
    return `${cabecera} ${g.series.map((s) => `${s.nombre}: ${g.etiquetas.map((e, i) => `${e} ${s.valores[i] ?? 0}`).join(', ')}.`).join(' ')}`
  }
  if (g.barras.every((b) => b.valor === 0)) return `${cabecera} Sin registros.`
  return `${cabecera} ${g.barras.map((b) => `${b.etiqueta}: ${b.valor} (${b.pct}%)`).join('; ')}.`
}

export interface TablaDatos {
  columnas: string[]
  filas: Array<Array<string | number>>
}

/** Datos del gráfico como tabla (pantalla, PDF, Excel e impresión). */
export function tablaDeGrafico(g: GraficoReporte): TablaDatos {
  if (esGraficoSeries(g)) {
    return { columnas: [g.id === 'tendencias' ? 'Mes' : 'Sector', ...g.series.map((s) => s.nombre)], filas: g.etiquetas.map((e, i) => [e, ...g.series.map((s) => s.valores[i] ?? 0)]) }
  }
  return { columnas: ['Categoría', 'Total', 'Porcentaje'], filas: g.barras.map((b) => [b.etiqueta, b.valor, `${b.pct}%`]) }
}

/** Gráficos del reporte más, si el plan lo incluye, los del análisis avanzado (ninguno si el reporte no tiene datos). */
export const graficosDelReporte = (r: Reporte, avanzado: AnalisisAvanzado | null): GraficoReporte[] =>
  r.vacio ? [] : [...r.graficos, ...(avanzado ? [avanzado.zonas, avanzado.tendencias].filter((a) => !a.vacio).map((a) => a.grafico) : [])]

/** ¿Hay filtros distintos de los iniciales (sin contar el tipo de reporte)? */
export const hayFiltrosReporte = (f: FiltrosReporte) => f.rango !== 'todo' || !!f.municipio || !!f.sector || !!f.riesgo || !!f.categoria

/** Texto legible de los filtros aplicados (CSV y versión imprimible). */
export function describirFiltros(f: FiltrosReporte, cat: Pick<Catalogos, 'municipios'>, hoy: Date = new Date()): string[] {
  const lim = limitesRango(f, hoy)
  const periodo =
    f.rango === 'todo'
      ? 'Todo el tiempo'
      : `${RANGOS.find((r) => r.value === f.rango)?.label.replace(' (desde / hasta)', '')}: ${lim.desde ? fechaCorta(lim.desde) : 'inicio'} – ${lim.hasta ? fechaCorta(lim.hasta) : 'hoy'}`
  return [
    `Período: ${periodo}`,
    `Municipio: ${f.municipio ? nombreMunicipio(cat, f.municipio) : 'Todos'}`,
    `Sector: ${f.sector || 'Todos'}`,
    `Riesgo: ${f.riesgo ? RIESGO_TEXTO[f.riesgo] : 'Todos'}`,
    ...(f.tipo === 'necesidades' ? [`Categoría: ${f.categoria ? TIPO_NECESIDAD_TEXTO[f.categoria] : 'Todas'}`] : []),
  ]
}

const celda = (v: string | number) => {
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV del reporte (UTF-8 con BOM, abre bien en Excel): filtros, indicadores, gráficos y detalle. */
export function reporteCSV(r: Reporte, f: FiltrosReporte, cat: Pick<Catalogos, 'municipios'>, organizacion: string, hoy: Date = new Date(), avanzado: AnalisisAvanzado | null = null): string {
  const filas: Array<Array<string | number>> = [
    [`Reporte CuidaRed: ${r.titulo}`],
    ['Organización', organizacion],
    ['Generado', fechaLarga(hoy)],
    ...describirFiltros(f, cat, hoy).map((x) => [x]),
    [],
  ]
  if (r.vacio) {
    filas.push([SIN_DATOS])
  } else {
    filas.push(['Indicadores'], ['Indicador', 'Valor', 'Nota'], ...r.kpis.map((k) => [k.etiqueta, k.valor, k.nota ?? '']), [])
    for (const g of r.graficos) filas.push([g.titulo], ['Categoría', 'Total', 'Porcentaje'], ...g.barras.map((b) => [b.etiqueta, b.valor, `${b.pct}%`]), [])
    filas.push([r.tabla.titulo], r.tabla.columnas.map((c) => c.etiqueta), ...r.tabla.filas.map((x) => x.celdas))
    for (const a of avanzado ? [avanzado.zonas, avanzado.tendencias] : []) {
      if (a.vacio) continue
      filas.push([], [a.tabla.titulo], a.tabla.columnas.map((c) => c.etiqueta), ...a.tabla.filas.map((x) => x.celdas))
    }
  }
  return '﻿' + filas.map((fila) => fila.map(celda).join(',')).join('\r\n')
}

/** Descarga un archivo (Blob) desde el navegador. */
export function descargarBlob(nombre: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Descarga un texto como archivo desde el navegador. */
export function descargarArchivo(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8') {
  descargarBlob(nombre, new Blob([contenido], { type: tipo }))
}
