/*
 * exportarPdf.ts — Exporta el reporte a PDF (jsPDF + jspdf-autotable): título, cuenta, filtros, fecha de
 * generación, indicadores, imagen y tabla de cada gráfico y detalle. jsPDF se carga con import() solo al exportar.
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { fechaLarga, hora12 } from '@/domain/dates'
import { graficosDelReporte, SIN_DATOS, tablaDeGrafico, type Columna } from '../../lib/reportes'
import type { ContextoExportacion } from './tipos'

type Color = [number, number, number]
const NAVY: Color = [12, 59, 110]
const GRIS: Color = [100, 116, 139]
const TEXTO: Color = [26, 43, 60]
const FILA_ALTERNA: Color = [247, 249, 252]

const MARGEN = 14
const ANCHO_PAGINA = 210
const ALTO_PAGINA = 297
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2
/** Espacio reservado al pie de página. */
const LIMITE_Y = ALTO_PAGINA - 18

const alinear = (columnas: Array<Pick<Columna, 'tipo'>>) => Object.fromEntries(columnas.map((c, i) => [i, { halign: c.tipo === 'numero' ? ('right' as const) : ('left' as const) }]))

/** Genera el PDF y lo descarga. Devuelve el número de páginas. */
export async function exportarPdf(ctx: ContextoExportacion, nombreArchivo: string): Promise<number> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const { reporte: r } = ctx
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 0
  const ultimaY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y

  const asegurarEspacio = (alto: number) => {
    if (y + alto > LIMITE_Y) {
      doc.addPage()
      y = MARGEN
    }
  }
  const subtitulo = (texto: string) => {
    asegurarEspacio(14)
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY)
    doc.text(texto, MARGEN, y)
    y += 3
  }
  const tabla = (columnas: Array<Pick<Columna, 'etiqueta' | 'tipo'>>, filas: Array<Array<string | number>>, tamano = 9) => {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN, bottom: 18 },
      head: [columnas.map((c) => c.etiqueta)],
      body: filas.map((f) => f.map(String)),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: tamano, cellPadding: 1.8, textColor: TEXTO, lineColor: [203, 213, 225], lineWidth: 0.1, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: FILA_ALTERNA },
      columnStyles: alinear(columnas),
    })
    y = ultimaY() + 7
  }

  /* Encabezado */
  doc.setFillColor(...NAVY).rect(0, 0, ANCHO_PAGINA, 26, 'F')
  doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(17)
  doc.text('CuidaRed', MARGEN, 12)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.text('Seguimiento comunitario de adultos mayores', MARGEN, 19)
  y = 38
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...NAVY)
  doc.text(`Reporte: ${r.titulo}`, MARGEN, y)
  y += 6
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS)
  const descripcion = doc.splitTextToSize(r.descripcion, ANCHO_UTIL) as string[]
  doc.text(descripcion, MARGEN, y)
  y += descripcion.length * 4.6 + 3

  /* Cuenta, fecha y filtros */
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    body: [
      ['Cuenta', ctx.cuenta],
      ['Generado', `${fechaLarga(ctx.generado)}, ${hora12(ctx.generado)}`],
      ['Generado por', ctx.generadoPor],
      ['Filtros aplicados', ctx.filtros.join('\n')],
    ],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 1, bottom: 1, left: 0, right: 2 }, textColor: TEXTO },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 36, textColor: NAVY } },
  })
  y = ultimaY() + 6

  if (r.vacio) {
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...TEXTO)
    doc.text(doc.splitTextToSize(SIN_DATOS, ANCHO_UTIL) as string[], MARGEN, y)
  } else {
    /* Indicadores */
    subtitulo('Indicadores')
    tabla(
      [{ etiqueta: 'Indicador' }, { etiqueta: 'Valor', tipo: 'numero' }, { etiqueta: 'Nota' }],
      r.kpis.map((k) => [k.etiqueta, typeof k.valor === 'number' ? k.valor.toLocaleString('es-DO') : k.valor, k.nota ?? '']),
    )

    /* Gráficos: imagen (chart.toBase64Image()) y su tabla de datos */
    for (const g of graficosDelReporte(r, ctx.avanzado)) {
      const img = ctx.imagenes[g.id]
      const datos = tablaDeGrafico(g)
      const anchoImg = Math.min(ANCHO_UTIL, 150)
      const altoImg = img ? (anchoImg * img.alto) / img.ancho : 0
      asegurarEspacio(14 + altoImg + 24)
      subtitulo(g.titulo)
      if (g.descripcion) {
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...GRIS)
        doc.text(g.descripcion, MARGEN, y + 1)
        y += 5
      }
      if (img) {
        doc.addImage(img.dataUrl, 'PNG', MARGEN + (ANCHO_UTIL - anchoImg) / 2, y, anchoImg, altoImg)
        y += altoImg + 4
      }
      tabla(
        datos.columnas.map((etiqueta, i) => ({ etiqueta, tipo: i > 0 ? ('numero' as const) : undefined })),
        datos.filas,
        8.5,
      )
    }

    /* Detalle del reporte */
    asegurarEspacio(30)
    subtitulo(`${r.tabla.titulo} (${r.tabla.filas.length})`)
    tabla(
      r.tabla.columnas,
      r.tabla.filas.map((f) => f.celdas),
      r.tabla.columnas.length > 7 ? 7.5 : 8.5,
    )

    /* Tablas del análisis avanzado (si el plan lo incluye) */
    for (const a of ctx.avanzado ? [ctx.avanzado.zonas, ctx.avanzado.tendencias] : []) {
      if (a.vacio) continue
      asegurarEspacio(30)
      subtitulo(a.tabla.titulo)
      tabla(
        a.tabla.columnas,
        a.tabla.filas.map((f) => f.celdas),
        a.tabla.columnas.length > 7 ? 7.5 : 8.5,
      )
    }
    if (!ctx.avanzado) {
      asegurarEspacio(12)
      doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(...GRIS)
      doc.text(doc.splitTextToSize(`Comparativos por zona y tendencias: ${ctx.avisoAvanzado}`, ANCHO_UTIL) as string[], MARGEN, y)
    }
  }

  /* Pie de página en todas las hojas */
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(203, 213, 225).line(MARGEN, ALTO_PAGINA - 14, ANCHO_PAGINA - MARGEN, ALTO_PAGINA - 14)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS)
    doc.text('© 2026 Equipo CuidaRed – INTEC. Documento de uso interno: contiene datos personales protegidos por la Ley 172-13.', MARGEN, ALTO_PAGINA - 9)
    doc.text(`Página ${i} de ${total}`, ANCHO_PAGINA - MARGEN, ALTO_PAGINA - 9, { align: 'right' })
  }

  doc.setProperties({ title: `CuidaRed - ${r.titulo}`, subject: ctx.cuenta, author: ctx.generadoPor, creator: 'CuidaRed' })
  doc.save(nombreArchivo)
  return total
}
