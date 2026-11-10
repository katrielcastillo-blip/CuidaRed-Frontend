/*
 * PanelGrafico.tsx — Tarjeta de un gráfico de reporte: título, gráfico de Chart.js (carga diferida, con aria-label
 * que describe todos sus valores) y alternativa accesible en tabla ("Ver tabla de datos"). TablaDeDatos también se
 * usa para los datos de los análisis avanzados.
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { lazy, Suspense } from 'react'
import { Table2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { esGraficoSeries, tablaDeGrafico, type GraficoReporte, type TablaDatos } from '../../lib/reportes'
import { alturaGrafico } from './alturaGrafico'

// Chart.js solo se descarga al abrir un reporte (no entra en el paquete principal).
const GraficoChart = lazy(() => import('./GraficoChart'))

/** Tabla de datos (alternativa accesible al gráfico). La primera columna es el encabezado de cada fila. */
export function TablaDeDatos({ titulo, tabla }: { titulo: string; tabla: TablaDatos }) {
  return (
    <div className="overflow-x-auto rounded-sm border border-line-soft" tabIndex={0} role="region" aria-label={`Tabla de datos: ${titulo}`}>
      <table className="w-full text-sm">
        <caption className="sr-only">Datos del gráfico: {titulo}</caption>
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-2">
          <tr>
            {tabla.columnas.map((c, i) => (
              <th key={c} scope="col" className={cn('px-3 py-2', i > 0 && 'text-right')}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabla.filas.map((f) => (
            <tr key={String(f[0])} className="border-t border-line-soft">
              <th scope="row" className="px-3 py-2 text-left font-semibold wrap-anywhere">
                {f[0]}
              </th>
              {f.slice(1).map((v, i) => (
                <td key={i} className="px-3 py-2 text-right tabular-nums">
                  {typeof v === 'number' ? v.toLocaleString('es-DO') : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const sinRegistros = (g: GraficoReporte) => (esGraficoSeries(g) ? g.etiquetas.length === 0 || g.series.every((s) => s.valores.every((v) => v === 0)) : g.barras.every((b) => b.valor === 0))

export function PanelGrafico({ g }: { g: GraficoReporte }) {
  return (
    <figure className="flex flex-col gap-3 min-w-0 m-0 p-4 rounded-md bg-surface shadow-1" data-testid="grafico-reporte" data-grafico={g.id}>
      <figcaption>
        <h3 className="text-lg font-bold text-ink">{g.titulo}</h3>
        {g.descripcion && <p className="text-sm text-muted">{g.descripcion}</p>}
      </figcaption>
      {sinRegistros(g) ? (
        <p className="text-sm text-muted">Sin registros para mostrar.</p>
      ) : (
        <>
          <div className="relative w-full" style={{ height: alturaGrafico(g) }}>
            <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted">Cargando gráfico…</div>}>
              <GraficoChart g={g} />
            </Suspense>
          </div>
          <details className="group">
            <summary className="inline-flex items-center gap-2 min-h-12 pr-2 text-sm font-semibold text-navy cursor-pointer rounded-sm focus-visible:outline-3 focus-visible:outline-blue focus-visible:outline-offset-2">
              <Table2 size={18} aria-hidden />
              <span className="group-open:hidden">Ver tabla de datos</span>
              <span className="hidden group-open:inline">Ocultar tabla de datos</span>
            </summary>
            <TablaDeDatos titulo={g.titulo} tabla={tablaDeGrafico(g)} />
          </details>
        </>
      )}
    </figure>
  )
}
