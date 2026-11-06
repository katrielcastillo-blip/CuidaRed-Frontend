/*
 * GraficoChart.tsx — Gráfico de Chart.js (react-chartjs-2) de un reporte. Es el único componente que importa
 * Chart.js para la pantalla y se carga de forma diferida desde PanelGrafico. El canvas es una imagen accesible
 * (role="img") con un aria-label que describe el gráfico y todos sus valores.
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { Chart } from 'react-chartjs-2'
import { describirGrafico, type GraficoReporte } from '../../lib/reportes'
import { construirConfig } from './configGrafico'

const sinAnimacion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function GraficoChart({ g }: { g: GraficoReporte }) {
  const config = useMemo(() => construirConfig(g, { animar: !sinAnimacion() }), [g])
  const descripcion = describirGrafico(g)
  return (
    <Chart
      key={`${g.id}-${config.type}`}
      type={config.type}
      data={config.data}
      options={config.options}
      plugins={config.plugins}
      role="img"
      aria-label={descripcion}
      data-testid="canvas-grafico"
    >
      <p>{descripcion}</p>
    </Chart>
  )
}
