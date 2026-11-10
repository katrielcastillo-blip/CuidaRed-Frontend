/*
 * alturaGrafico.ts — Tamaño de los gráficos de reporte (sin importar Chart.js, para no cargarlo en el paquete
 * principal): crece con el número de barras horizontales para que no se aplasten.
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { esGraficoSeries, type GraficoReporte, type GraficoSeries } from '../../lib/reportes'

/** Las barras agrupadas con muchas zonas se dibujan en horizontal. */
export const horizontalSeries = (g: GraficoSeries) => g.forma === 'barras' && g.etiquetas.length > 5

/** Altura en píxeles del gráfico. */
export function alturaGrafico(g: GraficoReporte): number {
  if (esGraficoSeries(g)) {
    if (g.forma === 'lineas') return 320
    return horizontalSeries(g) ? Math.max(240, 70 + g.etiquetas.length * (g.series.length * 15 + 16)) : 320
  }
  if (g.visual === 'dona') return 300
  if (g.forma === 'v') return 270
  return Math.max(190, 56 + g.barras.length * 42)
}
