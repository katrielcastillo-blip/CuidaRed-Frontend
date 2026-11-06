/*
 * exportarExcel.ts — Exporta el reporte a Excel (.xlsx) con write-excel-file: una hoja de resumen (cuenta,
 * filtros e indicadores), una hoja por indicador (datos de cada gráfico), el detalle y, si el plan lo incluye, el
 * comparativo por zona y las tendencias. La biblioteca se carga con import() solo al exportar.
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { fechaLarga, hora12 } from '@/domain/dates'
import { descargarBlob, graficosDelReporte, SIN_DATOS, tablaDeGrafico, type Columna } from '../../lib/reportes'
import type { ContextoExportacion } from './tipos'

type Celda = string | number | { value: string | number; fontWeight?: 'bold'; fontStyle?: 'italic'; fontSize?: number; textColor?: string; backgroundColor?: string; align?: 'left' | 'right'; wrap?: boolean }
type Fila = Celda[]

const NAVY = '#0c3b6e'
const encabezado = (t: string, numerico = false): Celda => ({ value: t, fontWeight: 'bold', textColor: '#ffffff', backgroundColor: NAVY, align: numerico ? 'right' : 'left', wrap: true })
const titulo = (t: string): Celda => ({ value: t, fontWeight: 'bold', fontSize: 14, textColor: NAVY })
const seccion = (t: string): Celda => ({ value: t, fontWeight: 'bold', fontSize: 12, textColor: NAVY })
const etiqueta = (t: string): Celda => ({ value: t, fontWeight: 'bold' })

/** Nombre de hoja válido en Excel: hasta 31 caracteres, sin \ / ? * [ ] : y único en el libro. */
function nombreHoja(base: string, usados: Set<string>): string {
  const limpio = base.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim()
  let nombre = limpio.slice(0, 31) || 'Hoja'
  for (let n = 2; usados.has(nombre.toLowerCase()); n++) nombre = `${limpio.slice(0, 31 - String(n).length - 1)} ${n}`
  usados.add(nombre.toLowerCase())
  return nombre
}

/** Fila de datos: los números se escriben como números y el resto como texto. */
const datos = (celdas: Array<string | number>): Fila => celdas.map((c) => (typeof c === 'number' ? { value: c, align: 'right' as const } : c))

const anchos = (columnas: number, primera = 34) => Array.from({ length: columnas }, (_, i) => ({ width: i === 0 ? primera : 18 }))

function tablaEn(columnas: Array<Pick<Columna, 'etiqueta' | 'tipo'>>, filas: Array<Array<string | number>>): Fila[] {
  return [columnas.map((c) => encabezado(c.etiqueta, c.tipo === 'numero')), ...filas.map(datos)]
}

/** Genera el libro de Excel y lo descarga. Devuelve el número de hojas. */
export async function exportarExcel(ctx: ContextoExportacion, nombreArchivo: string): Promise<number> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const { reporte: r } = ctx
  const usados = new Set<string>()
  const hojas: Array<{ sheet: string; data: Fila[]; columns?: Array<{ width: number }>; stickyRowsCount?: number }> = []

  /* Resumen: cuenta, filtros e indicadores */
  const resumen: Fila[] = [
    [titulo(`CuidaRed · Reporte: ${r.titulo}`)],
    [etiqueta('Descripción'), r.descripcion],
    [etiqueta('Cuenta'), ctx.cuenta],
    [etiqueta('Generado'), `${fechaLarga(ctx.generado)}, ${hora12(ctx.generado)}`],
    [etiqueta('Generado por'), ctx.generadoPor],
    ...ctx.filtros.map((f, i): Fila => [i === 0 ? etiqueta('Filtros aplicados') : '', f]),
    [],
  ]
  if (r.vacio) resumen.push([{ value: SIN_DATOS, fontStyle: 'italic' }])
  else resumen.push([seccion('Indicadores')], ...tablaEn([{ etiqueta: 'Indicador' }, { etiqueta: 'Valor', tipo: 'numero' }, { etiqueta: 'Nota' }], r.kpis.map((k) => [k.etiqueta, k.valor, k.nota ?? ''])))
  if (!ctx.avanzado) resumen.push([], [{ value: `Comparativos por zona y tendencias: ${ctx.avisoAvanzado}`, fontStyle: 'italic', textColor: '#64748b' }])
  hojas.push({ sheet: nombreHoja('Resumen', usados), data: resumen, columns: [{ width: 28 }, { width: 62 }, { width: 38 }] })

  if (!r.vacio) {
    /* Una hoja por indicador (gráfico) con sus datos; el análisis avanzado tiene sus propias hojas más abajo */
    for (const g of graficosDelReporte(r, null)) {
      const t = tablaDeGrafico(g)
      hojas.push({
        sheet: nombreHoja(g.titulo, usados),
        data: [[seccion(g.titulo)], ...(g.descripcion ? [[{ value: g.descripcion, fontStyle: 'italic' as const }]] : []), [], ...tablaEn(t.columnas.map((c, i) => ({ etiqueta: c, tipo: i > 0 ? ('numero' as const) : undefined })), t.filas)],
        columns: anchos(t.columnas.length),
      })
    }
    /* Detalle */
    hojas.push({
      sheet: nombreHoja('Detalle', usados),
      data: [[seccion(r.tabla.titulo)], [], ...tablaEn(r.tabla.columnas, r.tabla.filas.map((f) => f.celdas))],
      columns: anchos(r.tabla.columnas.length, 30),
    })
    /* Análisis avanzado (plan «reportes_avanzados») */
    for (const a of ctx.avanzado ? [ctx.avanzado.zonas, ctx.avanzado.tendencias] : []) {
      if (a.vacio) continue
      hojas.push({
        sheet: nombreHoja(a.tabla.titulo, usados),
        data: [[seccion(a.tabla.titulo)], [], ...tablaEn(a.tabla.columnas, a.tabla.filas.map((f) => f.celdas))],
        columns: anchos(a.tabla.columnas.length, 26),
      })
    }
  }

  const blob = await writeXlsxFile(hojas, { fontFamily: 'Calibri', fontSize: 11 }).toBlob()
  descargarBlob(nombreArchivo, blob)
  return hojas.length
}
