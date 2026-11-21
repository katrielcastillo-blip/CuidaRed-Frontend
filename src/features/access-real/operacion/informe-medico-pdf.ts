/*
 * informe-medico-pdf.ts — PDF del informe médico conectado (fase 7), armado con jsPDF a partir de lo que respondió el
 * servidor. Contenido: identificación mínima, indicaciones vigentes, riesgo vigente e historial (hasta 15), últimas 10
 * visitas realizadas con sus observaciones, el aviso de que CuidaRed no diagnostica y quién y cuándo lo generó. Las
 * secciones que el servidor omitió se indican con su motivo. jsPDF se carga con import() al descargar.
 * Módulo: access-real (ID07).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { jsPDF } from 'jspdf'
import { fechaCorta, fechaHora } from '@/domain/dates'
import type { InformeMedicoApi } from '../api/reportes'
import type { RolCuenta } from '../client'
import { ROL_TEXTO } from '../cuentas-datos'
import { MOTIVO_OMISION, SIN_PERMISO, vigenciaIndicacion } from './informe-medico-datos'
import { ESTADO_GENERAL, textoRiesgo } from './reportes-modelo'

const NAVY: [number, number, number] = [12, 59, 110]
const GRIS: [number, number, number] = [90, 98, 110]
const MARGEN = 15

/** Texto seguro para las fuentes estándar del PDF (Latin-1): sustituye comillas y rayas tipográficas y quita lo demás. */
const t = (s: string | undefined | null) =>
  (s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\t\n -ÿ]/g, '')

type Doc = jsPDF & { lastAutoTable?: { finalY?: number } }
const nombre = (p: { nombres: string; apellidos: string }) => `${p.nombres} ${p.apellidos}`.trim()
const quien = (informe: InformeMedicoApi) => `${nombre(informe.generado_por)} (${ROL_TEXTO[informe.generado_por.rol as RolCuenta] ?? informe.generado_por.rol})`
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

export async function generarInformePdf(informe: InformeMedicoApi): Promise<jsPDF> {
  const [{ jsPDF: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc: Doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const { identificacion: id } = informe
  const generado = fechaHora(informe.generado_en)
  const autor = quien(informe)
  const omitida = (s: keyof typeof MOTIVO_OMISION) => informe.secciones_omitidas.includes(s)
  let y = 0

  doc.setProperties({ title: t(`Informe médico - ${nombre(id)}`), subject: 'Informe médico de seguimiento', author: t(nombre(informe.generado_por)), creator: 'CuidaRed' })

  /* Cabecera */
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, ancho, 24, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold').setFontSize(18)
  doc.text('CuidaRed', MARGEN, 12)
  doc.setFont('helvetica', 'normal').setFontSize(9)
  doc.text('Seguimiento comunitario de adultos mayores', MARGEN, 18.5)
  doc.setFont('helvetica', 'bold').setFontSize(12)
  doc.text(t('Informe médico de seguimiento'), ancho - MARGEN, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(9)
  doc.text(t(informe.cuenta.nombre), ancho - MARGEN, 18.5, { align: 'right' })

  /* Título y datos de generación */
  doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(16)
  doc.text(t(nombre(id)), MARGEN, 35)
  doc.setTextColor(...GRIS).setFont('helvetica', 'normal').setFontSize(9)
  doc.text(t(`Generado el ${generado} por ${autor}`), MARGEN, 41)
  doc.text(t(`Constancia del informe: ${informe.informe_id}`), MARGEN, 46)
  y = 52

  const titulo = (texto: string) => {
    if (y > alto - 45) {
      doc.addPage()
      y = 20
    }
    doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(11)
    doc.text(t(texto), MARGEN, y)
    doc.setDrawColor(...NAVY).setLineWidth(0.4)
    doc.line(MARGEN, y + 1.5, ancho - MARGEN, y + 1.5)
    y += 5
  }
  const nota = (texto: string) => {
    doc.setTextColor(...GRIS).setFont('helvetica', 'italic').setFontSize(9)
    const lineas = doc.splitTextToSize(t(texto), ancho - MARGEN * 2) as string[]
    doc.text(lineas, MARGEN, y + 3)
    y += lineas.length * 4 + 4
    doc.setFont('helvetica', 'normal')
  }
  const tabla = (head: string[], body: string[][], anchos?: number[]) => {
    autoTable(doc, {
      startY: y,
      head: [head.map(t)],
      body: body.map((f) => f.map(t)),
      theme: 'grid',
      margin: { left: MARGEN, right: MARGEN, bottom: 18 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, lineColor: [210, 215, 222], lineWidth: 0.2, textColor: [30, 35, 45], valign: 'top' },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      columnStyles: anchos ? Object.fromEntries(anchos.map((w, i) => [i, { cellWidth: w }])) : undefined,
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 6
  }

  /* 1. Identificación mínima */
  titulo('1. Datos de identificación')
  const lugar = [id.municipio?.nombre, id.provincia?.nombre].filter(Boolean).join(', ') || '-'
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: { left: MARGEN, right: MARGEN },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.4, textColor: [30, 35, 45] },
    columnStyles: { 0: { fontStyle: 'bold', textColor: GRIS, cellWidth: 38 }, 2: { fontStyle: 'bold', textColor: GRIS, cellWidth: 38 } },
    body: [
      ['Nombre completo', t(nombre(id)), 'Cédula', t(id.cedula ?? '-')],
      ['Fecha de nacimiento', t(id.fecha_nacimiento ? `${fechaCorta(id.fecha_nacimiento)}${id.edad !== null ? ` (${id.edad} años)` : ''}` : '-'), 'Sexo', t(id.sexo ?? '-')],
      ['Municipio', t(lugar), 'Nivel de riesgo vigente', t(informe.riesgo ? textoRiesgo(informe.riesgo.nivel_vigente) : SIN_PERMISO)],
      ['Estado del expediente', t(capitalizar(id.estado)), '', ''],
    ],
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 6

  /* 2. Indicaciones vigentes */
  titulo('2. Indicaciones médicas vigentes')
  if (omitida('indicaciones') || !informe.indicaciones) nota(MOTIVO_OMISION.indicaciones)
  else {
    const { vigentes, no_vigentes } = informe.indicaciones
    if (vigentes.length === 0) nota('Sin indicaciones vigentes registradas.')
    else {
      tabla(
        ['Tipo', 'Indicación', 'Frecuencia u horario', 'Vigencia', 'Registrada por'],
        vigentes.map((i) => [i.tipo.nombre, [i.titulo, i.descripcion].filter(Boolean).join('\n'), i.frecuencia_horario ?? '-', vigenciaIndicacion(i.fecha_inicio, i.fecha_fin), i.registrada_por ? nombre(i.registrada_por) : '-']),
        [24, 62, 32, 36, 26],
      )
    }
    nota(no_vigentes > 0
      ? `No se incluyen ${plural(no_vigentes, 'indicación suspendida o finalizada', 'indicaciones suspendidas o finalizadas')}. Solo se transcribe lo indicado por personal de salud.`
      : 'Solo se transcribe lo indicado por personal de salud.')
  }

  /* 3. Riesgos */
  titulo('3. Riesgos vigentes e historial')
  if (omitida('riesgo') || !informe.riesgo) nota(MOTIVO_OMISION.riesgo)
  else {
    const { vigentes, historial, historial_total } = informe.riesgo
    if (vigentes.length === 0) nota('Sin factores de riesgo vigentes.')
    else {
      tabla(
        ['Factor', 'Nivel', 'Motivo y observación', 'Fecha'],
        vigentes.map((r) => [r.factor.nombre, r.nivel.nombre, [r.motivo, r.observacion ? `Observación: ${r.observacion}` : ''].filter(Boolean).join('\n'), fechaCorta(r.fecha)]),
        [38, 20, 94, 28],
      )
    }
    if (historial.length > 0) {
      doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(9.5)
      doc.text('Historial de riesgos', MARGEN, y)
      y += 2
      tabla(
        ['Fecha', 'Factor', 'Nivel', 'Estado', 'Motivo'],
        historial.map((r) => [fechaCorta(r.fecha), r.factor.nombre, r.nivel.nombre, capitalizar(r.estado), r.motivo ?? '-']),
        [22, 38, 20, 22, 78],
      )
      if (historial_total > historial.length) nota(`Se muestran los ${historial.length} registros más recientes de ${historial_total}.`)
    }
  }

  /* 4. Visitas recientes */
  titulo('4. Visitas recientes')
  if (omitida('visitas') || !informe.visitas) nota(MOTIVO_OMISION.visitas)
  else {
    const { recientes, realizadas_total, ultima_fecha } = informe.visitas
    if (recientes.length === 0) nota('Aún no hay visitas realizadas. Atención inicial pendiente.')
    else {
      tabla(
        ['Fecha', 'Responsable', 'Estado del adulto', 'Observaciones'],
        recientes.map((v) => [
          fechaCorta(v.fecha),
          v.responsables.map(nombre).join(', ') || '-',
          v.estado_general ? (ESTADO_GENERAL[v.estado_general] ?? v.estado_general) : SIN_PERMISO,
          v.observacion ?? (v.estado_general === null ? SIN_PERMISO : 'Sin observaciones'),
        ]),
        [22, 44, 32, 82],
      )
      nota(`Última visita realizada: ${ultima_fecha ? fechaCorta(ultima_fecha) : '-'} · ${plural(realizadas_total, 'visita realizada', 'visitas realizadas')} en total. Solo se cuentan las visitas realizadas.`)
    }
  }

  /* Aviso */
  if (y > alto - 40) {
    doc.addPage()
    y = 20
  }
  doc.setDrawColor(...NAVY).setFillColor(230, 241, 251)
  const aviso = doc.splitTextToSize(t(`${informe.aviso} Este informe resume información registrada por la red de cuidado comunitario y debe ser interpretado por personal de salud. Contiene datos sensibles: compártelo solo con quien corresponda (Ley 172-13).`), ancho - MARGEN * 2 - 8) as string[]
  doc.roundedRect(MARGEN, y, ancho - MARGEN * 2, aviso.length * 4.2 + 8, 2, 2, 'FD')
  doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(9)
  doc.text(aviso, MARGEN + 4, y + 6)

  /* Pie de cada página: quién y cuándo lo generó, numeración */
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setDrawColor(210, 215, 222).setLineWidth(0.2)
    doc.line(MARGEN, alto - 13, ancho - MARGEN, alto - 13)
    doc.setTextColor(...GRIS).setFont('helvetica', 'normal').setFontSize(7.5)
    doc.text(t(`Generado el ${generado} por ${autor} · Documento confidencial`), MARGEN, alto - 8.5)
    doc.text(t(informe.aviso), MARGEN, alto - 5)
    doc.text(`Página ${p} de ${paginas}`, ancho - MARGEN, alto - 8.5, { align: 'right' })
  }
  return doc
}
