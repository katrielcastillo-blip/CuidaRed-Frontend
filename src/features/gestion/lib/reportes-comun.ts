/*
 * reportes-comun.ts — Modelo de reporte y utilidades sin estado: tipos de indicadores, gráficos y tablas, alternativa
 * accesible de los gráficos y descarga de archivos. No depende del almacén del prototipo ni del dominio local, así que lo
 * comparten el modo demo (lib/reportes.ts lo reexporta) y el modo conectado (access-real) sin cargar datos simulados.
 * Módulo: gestión · reportes.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { Riesgo } from '@/domain/types'

/** Tipos del prototipo; el modo conectado usa `prioritarios` para los casos prioritarios. */
export type TipoReporte = 'adultos' | 'visitas' | 'necesidades' | 'prioritarios'

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
  /** `nota`: aviso bajo la tabla (p. ej. detalle recortado por el servidor); lo imprimen el PDF y el Excel. */
  tabla: { titulo: string; columnas: Columna[]; filas: Fila[]; nota?: string }
}

export const SIN_DATOS = 'No existen datos disponibles para este reporte con los filtros seleccionados.'

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

/** Análisis que solo se muestra y exporta como tabla (comparativo por municipio del modo conectado). */
export interface AnalisisTabla {
  vacio: boolean
  tabla: TablaReporte
}

export interface AnalisisAvanzado {
  zonas: Analisis
  tendencias: Analisis
  /** Solo en el modo conectado; el prototipo no calcula el comparativo por municipio. */
  municipios?: AnalisisTabla
}

/** Tablas del análisis avanzado en el orden en que se muestran y exportan. */
export const tablasAvanzadas = (a: AnalisisAvanzado): Array<Pick<Analisis, 'vacio' | 'tabla'>> => [a.zonas, a.tendencias, ...(a.municipios ? [a.municipios] : [])]

/** Cualquier gráfico que se puede dibujar, exportar o imprimir. */
export type GraficoReporte = Grafico | GraficoSeries

export const esGraficoSeries = (g: GraficoReporte): g is GraficoSeries => 'series' in g

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
