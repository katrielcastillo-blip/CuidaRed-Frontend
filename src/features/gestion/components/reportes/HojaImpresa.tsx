/*
 * HojaImpresa.tsx — Hoja del reporte para imprimir o guardar como PDF con window.print(): título, cuenta, filtros,
 * fecha de generación, indicadores, imagen y tabla de cada gráfico y detalle. Solo se ve al imprimir (hidden
 * print:block); el resto de la aplicación se oculta con print:hidden mientras el reporte está abierto.
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { fechaLarga, hora12 } from '@/domain/dates'
import { graficosDelReporte, SIN_DATOS, tablaDeGrafico } from '../../lib/reportes'
import type { ContextoExportacion } from './tipos'

const TABLA = 'w-full border-collapse [&_td]:border [&_th]:border [&_td]:border-gray-400 [&_th]:border-gray-400 [&_td]:px-2 [&_th]:px-2 [&_td]:py-1 [&_th]:py-1 [&_th]:text-left'

export function HojaImpresa({ ctx }: { ctx: ContextoExportacion }) {
  const { reporte: r } = ctx
  return (
    <div className="hidden print:block p-6 text-[12px] text-black bg-white" aria-hidden data-testid="hoja-impresa">
      <h1 className="text-xl font-bold">CuidaRed · {r.titulo}</h1>
      <p>
        {ctx.cuenta} · Generado el {fechaLarga(ctx.generado)}, {hora12(ctx.generado)} · por {ctx.generadoPor}
      </p>
      <p className="mt-1 text-[11px]">Filtros: {ctx.filtros.join(' · ')}</p>
      {r.vacio ? (
        <p className="mt-4 font-semibold">{SIN_DATOS}</p>
      ) : (
        <>
          <h2 className="mt-4 mb-1 text-sm font-bold">Indicadores</h2>
          <table className={TABLA}>
            <tbody>
              {r.kpis.map((k) => (
                <tr key={k.etiqueta}>
                  <th>{k.etiqueta}</th>
                  <td>
                    {k.valor} {k.nota ? `(${k.nota})` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-x-4">
            {graficosDelReporte(r, ctx.avanzado).map((g) => {
              const img = ctx.imagenes[g.id]
              const datos = tablaDeGrafico(g)
              return (
                <div key={g.id} className="break-inside-avoid">
                  <h2 className="mt-4 mb-1 text-sm font-bold">{g.titulo}</h2>
                  {img && <img src={img.dataUrl} alt="" className="w-full h-auto mb-1" />}
                  <table className={TABLA}>
                    <thead>
                      <tr>
                        {datos.columnas.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {datos.filas.map((f) => (
                        <tr key={String(f[0])}>
                          {f.map((v, i) => (
                            <td key={i}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
          <h2 className="mt-4 mb-1 text-sm font-bold">{r.tabla.titulo}</h2>
          <table className={TABLA}>
            <thead>
              <tr>
                {r.tabla.columnas.map((c) => (
                  <th key={c.etiqueta}>{c.etiqueta}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.tabla.filas.map((f) => (
                <tr key={f.id} className="break-inside-avoid">
                  {f.celdas.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {(ctx.avanzado ? [ctx.avanzado.zonas, ctx.avanzado.tendencias] : [])
            .filter((a) => !a.vacio)
            .map((a) => (
              <div key={a.tabla.titulo} className="break-inside-avoid">
                <h2 className="mt-4 mb-1 text-sm font-bold">{a.tabla.titulo}</h2>
                <table className={TABLA}>
                  <thead>
                    <tr>
                      {a.tabla.columnas.map((c) => (
                        <th key={c.etiqueta}>{c.etiqueta}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.tabla.filas.map((f) => (
                      <tr key={f.id}>
                        {f.celdas.map((v, i) => (
                          <td key={i}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          {!ctx.avanzado && <p className="mt-3 text-[11px] italic">Comparativos por zona y tendencias: {ctx.avisoAvanzado}</p>}
        </>
      )}
      <p className="mt-6 text-[10px]">© 2026 Equipo CuidaRed – INTEC. Documento de uso interno: contiene datos personales protegidos por la Ley 172-13.</p>
    </div>
  )
}
