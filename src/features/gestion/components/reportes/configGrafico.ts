/*
 * configGrafico.ts — Configuración de Chart.js para los gráficos de reportes (anillo, barras, barras agrupadas y
 * líneas) y generación de su imagen (chart.toBase64Image()) para el PDF y la hoja imprimible.
 * Se importa solo desde GraficoChart (carga diferida) y con import() desde la exportación: Chart.js no entra en el
 * paquete principal.
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js'
import { esGraficoSeries, type Grafico, type GraficoReporte, type GraficoSeries } from '../../lib/reportes'
import { alturaGrafico, horizontalSeries } from './alturaGrafico'

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip)

/* Colores de la marca (tokens.css). Chart.js dibuja en canvas y no lee variables CSS. */
const NAVY = '#0c3b6e'
const TEXTO = '#1a2b3c'
const TEXTO_2 = '#434652'
const REJILLA = '#e2e8f0'
const RIESGO = { alto: '#c0392b', medio: '#d4880a', bajo: '#1d9e75' } as const
/** Series: azul marino, ámbar, verde azulado y rojo; además de color se distinguen por forma y trazo. */
const SERIES = ['#0c3b6e', '#d4880a', '#14a085', '#c0392b']
const TRAZOS: number[][] = [[], [7, 4], [2, 3], [10, 3, 2, 3]]
const PUNTOS = ['circle', 'rect', 'triangle', 'rectRot'] as const
const PALETA_DONA = ['#0c3b6e', '#378add', '#14a085', '#d4880a', '#c0392b', '#64748b']

Chart.defaults.font.family = "'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
Chart.defaults.font.size = 12
Chart.defaults.color = TEXTO_2

/** Parte una etiqueta larga en líneas para que no se corte en el eje. */
function envolver(texto: string, max = 16): string | string[] {
  if (texto.length <= max) return texto
  const lineas: string[] = []
  let actual = ''
  for (const palabra of texto.split(' ')) {
    if (actual && `${actual} ${palabra}`.length > max) {
      lineas.push(actual)
      actual = palabra
    } else actual = actual ? `${actual} ${palabra}` : palabra
  }
  if (actual) lineas.push(actual)
  return lineas
}

/** Dibuja el valor al extremo de cada barra (los números también se leen en la imagen del PDF). */
const etiquetasValor: Plugin = {
  id: 'etiquetasValor',
  afterDatasetsDraw(chart) {
    if ((chart.config as { type?: string }).type !== 'bar' || chart.data.datasets.length !== 1) return
    const horizontal = (chart.options as { indexAxis?: string }).indexAxis === 'y'
    const { ctx } = chart
    ctx.save()
    ctx.fillStyle = TEXTO
    ctx.font = `600 12px ${Chart.defaults.font.family}`
    ctx.textAlign = horizontal ? 'left' : 'center'
    ctx.textBaseline = horizontal ? 'middle' : 'bottom'
    chart.getDatasetMeta(0).data.forEach((el, i) => {
      const valor = chart.data.datasets[0]!.data[i]
      if (typeof valor !== 'number' || valor === 0) return
      const { x, y } = el.getProps(['x', 'y'], true)
      if (horizontal) ctx.fillText(String(valor), x + 6, y)
      else ctx.fillText(String(valor), x, y - 4)
    })
    ctx.restore()
  },
}

/** Fondo blanco para las imágenes exportadas (el canvas es transparente por defecto). */
const fondoBlanco: Plugin = {
  id: 'fondoBlanco',
  beforeDraw(chart) {
    const { ctx, width, height } = chart
    ctx.save()
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  },
}

export interface OpcionesConfig {
  animar?: boolean
  /** Para la imagen exportada: sin interactividad ni redimensionado. */
  imagen?: boolean
}

type Config = ChartConfiguration

function configAnillo(g: Grafico, { animar }: OpcionesConfig): ChartConfiguration<'doughnut'> {
  const etiquetas = g.barras.map((b) => `${b.etiqueta} · ${b.valor} (${b.pct}%)`)
  return {
    type: 'doughnut',
    data: {
      labels: etiquetas,
      datasets: [{ data: g.barras.map((b) => b.valor), backgroundColor: g.barras.map((b, i) => (b.riesgo ? RIESGO[b.riesgo] : PALETA_DONA[i % PALETA_DONA.length]!)), borderColor: '#ffffff', borderWidth: 3, hoverOffset: 6 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      animation: animar ? { duration: 500 } : false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 14, boxHeight: 14, padding: 14, color: TEXTO, font: { size: 13 } } },
        tooltip: { callbacks: { label: (c) => ` ${c.label}` } },
      },
    },
  }
}

function configBarras(g: Grafico, { animar }: OpcionesConfig): Config {
  const horizontal = g.forma === 'h'
  const colores = g.barras.map((b) => (b.riesgo ? RIESGO[b.riesgo] : NAVY))
  const unidad = (n: number) => (n === 1 ? g.unidad[0] : g.unidad[1])
  return {
    type: 'bar',
    data: { labels: g.barras.map((b) => envolver(b.etiqueta)), datasets: [{ label: g.titulo, data: g.barras.map((b) => b.valor), backgroundColor: colores, borderRadius: 4, maxBarThickness: horizontal ? 26 : 38 }] },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      animation: animar ? { duration: 500 } : false,
      layout: { padding: horizontal ? { right: 34 } : { top: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => g.barras[items[0]!.dataIndex]?.etiqueta ?? '',
            label: (c) => ` ${c.parsed[horizontal ? 'x' : 'y']} ${unidad(Number(c.parsed[horizontal ? 'x' : 'y']))} · ${g.barras[c.dataIndex]?.pct ?? 0}%`,
          },
        },
      },
      scales: {
        [horizontal ? 'x' : 'y']: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: REJILLA } },
        [horizontal ? 'y' : 'x']: { grid: { display: false }, ticks: { color: TEXTO, font: { size: 12 } } },
      },
    },
  }
}

function configSeries(g: GraficoSeries, { animar }: OpcionesConfig): Config {
  const lineas = g.forma === 'lineas'
  const horizontal = horizontalSeries(g)
  const unidad = (n: number) => (n === 1 ? g.unidad[0] : g.unidad[1])
  return {
    type: lineas ? 'line' : 'bar',
    data: {
      labels: g.etiquetas.map((e) => envolver(e, horizontal ? 18 : 12)),
      datasets: g.series.map((s, i) => ({
        label: s.nombre,
        data: s.valores,
        backgroundColor: SERIES[i % SERIES.length],
        borderColor: SERIES[i % SERIES.length],
        ...(lineas
          ? { borderWidth: 2.5, borderDash: TRAZOS[i % TRAZOS.length], tension: 0.25, pointRadius: 4.5, pointHoverRadius: 6, pointStyle: PUNTOS[i % PUNTOS.length], fill: false }
          : { borderRadius: 3, maxBarThickness: 28 }),
      })),
    },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      animation: animar ? { duration: 500 } : false,
      interaction: { mode: lineas ? 'index' : 'nearest', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, padding: 14, color: TEXTO, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            title: (items) => g.etiquetas[items[0]!.dataIndex] ?? '',
            label: (c) => {
              const v = Number(c.parsed[horizontal ? 'x' : 'y'])
              return ` ${c.dataset.label}: ${v} ${unidad(v)}`
            },
          },
        },
      },
      scales: {
        [horizontal ? 'x' : 'y']: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: REJILLA } },
        [horizontal ? 'y' : 'x']: { grid: { display: false }, ticks: { color: TEXTO, font: { size: 12 } } },
      },
    },
  }
}

/** Configuración de Chart.js para el gráfico (el mismo código dibuja la pantalla y la imagen exportada). */
export function construirConfig(g: GraficoReporte, opciones: OpcionesConfig = {}): Config {
  const config = esGraficoSeries(g) ? configSeries(g, opciones) : g.visual === 'dona' ? (configAnillo(g, opciones) as unknown as Config) : configBarras(g, opciones)
  return { ...config, plugins: [etiquetasValor, ...(opciones.imagen ? [fondoBlanco] : [])] }
}

/**
 * Dibuja el gráfico fuera de pantalla y devuelve su imagen PNG (chart.toBase64Image()), con fondo blanco y el doble
 * de resolución, para el PDF y la versión imprimible.
 */
export function imagenDeGrafico(g: GraficoReporte, ancho = 760): { dataUrl: string; ancho: number; alto: number } {
  const alto = alturaGrafico(g)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  canvas.style.width = `${ancho}px`
  canvas.style.height = `${alto}px`
  const config = construirConfig(g, { imagen: true, animar: false })
  const chart = new Chart(canvas, { ...config, options: { ...config.options, responsive: false, animation: false, devicePixelRatio: 2, events: [] } })
  try {
    return { dataUrl: chart.toBase64Image('image/png', 1), ancho, alto }
  } finally {
    chart.destroy()
  }
}
