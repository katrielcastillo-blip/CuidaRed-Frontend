/*
 * SeccionAvanzada.tsx — Análisis avanzado de reportes (plan «reportes_avanzados»): comparativo por zona y
 * tendencias mensuales, cada uno con su gráfico de Chart.js y su tabla. Si el plan de la cuenta no lo incluye,
 * muestra qué contiene y el aviso "Disponible en el plan …" en lugar de ocultarlo.
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { ChartLine, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Analisis, AnalisisAvanzado } from '../../lib/reportes'
import { AvisoPlan } from './AvisoPlan'
import { PanelGrafico } from './PanelGrafico'

function TablaAnalisis({ a, id }: { a: Analisis; id: string }) {
  const { columnas, filas, titulo } = a.tabla
  return (
    <section className="flex flex-col gap-3 min-w-0" aria-labelledby={id}>
      <h3 id={id} className="text-lg font-bold">
        {titulo} <span className="text-sm font-normal text-muted">({filas.length})</span>
      </h3>
      <div className="relative overflow-x-auto rounded-md bg-surface shadow-1" tabIndex={0} role="region" aria-label={`${titulo}: desplázate horizontalmente si no ves todas las columnas`}>
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-2">
            <tr>
              {columnas.map((c) => (
                <th key={c.etiqueta} scope="col" className={cn('px-3 py-3', c.tipo === 'numero' && 'text-right')}>
                  {c.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-line-soft">
                {f.celdas.map((v, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                      {v}
                    </th>
                  ) : (
                    <td key={i} className={cn('px-3 py-2 whitespace-nowrap', columnas[i]?.tipo === 'numero' && 'text-right tabular-nums')}>
                      {v}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** `sinDatos`: el reporte elegido no tiene datos con los filtros actuales; el análisis avanzado tampoco se dibuja. */
export function SeccionAvanzada({ incluido, analisis, sinDatos }: { incluido: boolean; analisis: AnalisisAvanzado; sinDatos?: boolean }) {
  const { zonas, tendencias } = analisis
  return (
    <section className="flex flex-col gap-4 min-w-0 no-print" aria-labelledby="titulo-avanzado" data-testid="analisis-avanzado">
      <div>
        <h2 id="titulo-avanzado" className="text-xl font-bold text-navy">
          Análisis avanzado
        </h2>
        <p className="text-sm text-ink-2">Comparativo por zona y tendencias mensuales de los adultos mayores que cumplen los filtros de ubicación y riesgo.</p>
      </div>
      {!incluido ? (
        <div className="flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1 border border-dashed border-line" data-testid="analisis-avanzado-bloqueado">
          <div className="flex items-center gap-3">
            <span className="grid flex-none place-items-center size-10 rounded-pill bg-warning-100 text-warning-700" aria-hidden>
              <Lock size={20} />
            </span>
            <p className="font-semibold text-ink">Comparativo por zona y tendencias no incluidos en tu plan</p>
          </div>
          <ul className="grid gap-1 pl-4 text-sm text-ink-2 list-disc sm:grid-cols-2">
            <li>Adultos activos, visitas y necesidades de cada sector, lado a lado.</li>
            <li>Evolución mensual de visitas, necesidades y alertas, con variación respecto al mes anterior.</li>
          </ul>
          <AvisoPlan funcionalidad="reportes_avanzados" />
        </div>
      ) : sinDatos || (zonas.vacio && tendencias.vacio) ? (
        <p className="flex items-center gap-2 p-4 rounded-md bg-surface shadow-1 text-sm text-ink-2" role="status">
          <ChartLine size={18} className="text-muted" aria-hidden /> No hay datos para el análisis avanzado con los filtros seleccionados.
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            {!zonas.vacio && <PanelGrafico g={zonas.grafico} />}
            {!tendencias.vacio && <PanelGrafico g={tendencias.grafico} />}
          </div>
          {!zonas.vacio && <TablaAnalisis a={zonas} id="tabla-zonas" />}
          {!tendencias.vacio && <TablaAnalisis a={tendencias} id="tabla-tendencias" />}
        </>
      )}
    </section>
  )
}
