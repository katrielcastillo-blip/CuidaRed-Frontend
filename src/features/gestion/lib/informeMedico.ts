/*
 * informeMedico.ts — Generación del informe médico exportable en PDF (permiso informe:exportar: Coordinador y
 * Cuidador). Contenido: datos de identificación mínimos, indicaciones vigentes, riesgos vigentes e historial de
 * riesgos, visitas recientes con sus observaciones, fecha de generación, quién lo generó y el aviso de que
 * CuidaRed no diagnostica ni sustituye al médico tratante. jsPDF y jspdf-autotable se cargan con import()
 * dinámico, así no pesan en la carga inicial de la aplicación. No valida permisos: lo hace BotonInformeMedico
 * (y registra la exportación en auditoría) antes de llamar a esta función.
 * Módulo: gestión (reutilizable por cualquier área).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { jsPDF } from 'jspdf'
import { ROL_LABEL, nombreCompleto } from '@/domain/auth'
import { edad, fechaCorta, fechaHora, todayISO } from '@/domain/dates'
import { estadoAdultoPara, nombreMunicipio, observacionPara, provinciaDe, riesgosDe, visitaIncluye } from '@/domain/relaciones'
import { ultimaVisitaCompletada } from '@/domain/reglas'
import type { Adulto, DB, Usuario } from '@/domain/types'
import { nombreCatalogo, nombreUsuario } from './datos'
import { ESTADO_RIESGO_TEXTO, nombreAdulto, plural, RIESGO_TEXTO, vigenciaTexto } from './formato'
import { ESTADO_ADULTO_TEXTO } from './historial'

export interface DatosInformeMedico {
  adulto: Adulto
  generadoPor: Usuario
  /** Nombre de la cuenta (organización o familia) a la que pertenece el adulto. */
  cuenta: string
  db: Pick<DB, 'indicaciones' | 'riesgos' | 'visitas' | 'usuarios' | 'catalogos'>
  /** Incluye indicaciones (permiso indicaciones:ver). */
  verIndicaciones: boolean
  /** Incluye riesgos y observaciones de visitas (permiso adultos:ver-sensible). */
  verSensible: boolean
  ahora?: Date
}

/** Visitas recientes que se listan en el informe. */
export const VISITAS_EN_INFORME = 10
/** Registros de riesgo que se listan en el historial del informe. */
export const RIESGOS_EN_INFORME = 15
export const AVISO_INFORME = 'CuidaRed no diagnostica ni sustituye al médico tratante.'

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

/** Nombre de archivo sin acentos ni espacios: `informe-medico-perez-juan-2026-11-05.pdf`. */
export function nombreArchivoInforme(adulto: Pick<Adulto, 'nombre' | 'apellido'>, fecha = todayISO()) {
  const slug = `${adulto.apellido} ${adulto.nombre}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `informe-medico-${slug || 'adulto'}-${fecha}.pdf`
}

type Doc = jsPDF & { lastAutoTable?: { finalY?: number } }

export async function generarInformeMedico(d: DatosInformeMedico): Promise<{ doc: jsPDF; nombreArchivo: string }> {
  const [{ jsPDF: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const ahora = d.ahora ?? new Date()
  const { adulto, db } = d
  const doc: Doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const quien = `${nombreCompleto(d.generadoPor)} (${ROL_LABEL[d.generadoPor.rol]})`
  const generado = `${fechaHora(ahora.toISOString())}`
  let y = 0

  doc.setProperties({ title: t(`Informe médico - ${nombreAdulto(adulto)}`), subject: 'Informe médico de seguimiento', author: t(nombreCompleto(d.generadoPor)), creator: 'CuidaRed' })

  /* Cabecera */
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, ancho, 24, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('CuidaRed', MARGEN, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Seguimiento comunitario de adultos mayores', MARGEN, 18.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(t('Informe médico de seguimiento'), ancho - MARGEN, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(t(d.cuenta), ancho - MARGEN, 18.5, { align: 'right' })

  /* Título y datos de generación */
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(t(nombreAdulto(adulto)), MARGEN, 35)
  doc.setTextColor(...GRIS)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(t(`Generado el ${generado} por ${quien}`), MARGEN, 41)
  y = 47

  const titulo = (texto: string) => {
    if (y > alto - 45) {
      doc.addPage()
      y = 20
    }
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(t(texto), MARGEN, y)
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(0.4)
    doc.line(MARGEN, y + 1.5, ancho - MARGEN, y + 1.5)
    y += 5
  }
  const nota = (texto: string) => {
    doc.setTextColor(...GRIS)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
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
  const riesgoActual = d.verSensible ? RIESGO_TEXTO[adulto.riesgo] : 'No disponible'
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: { left: MARGEN, right: MARGEN },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.4, textColor: [30, 35, 45] },
    columnStyles: { 0: { fontStyle: 'bold', textColor: GRIS, cellWidth: 38 }, 2: { fontStyle: 'bold', textColor: GRIS, cellWidth: 38 } },
    body: [
      ['Nombre completo', t(nombreAdulto(adulto)), 'Cédula', t(adulto.cedula)],
      ['Fecha de nacimiento', `${fechaCorta(adulto.fechaNacimiento)} (${edad(adulto.fechaNacimiento)} años)`, 'Sexo', adulto.sexo],
      ['Municipio', t([nombreMunicipio(db.catalogos, adulto.municipioCod), provinciaDe(db.catalogos, adulto.municipioCod)?.nombre].filter(Boolean).join(', ') || '-'), 'Nivel de riesgo vigente', t(riesgoActual)],
    ],
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 6

  /* 2. Indicaciones vigentes */
  titulo('2. Indicaciones médicas vigentes')
  if (!d.verIndicaciones) {
    nota('Las indicaciones médicas no están disponibles para tu rol.')
  } else {
    const propias = db.indicaciones.filter((i) => i.adultoId === adulto.id)
    const vigentes = propias.filter((i) => i.estado === 'vigente').sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))
    if (vigentes.length === 0) nota('Sin indicaciones vigentes registradas.')
    else {
      tabla(
        ['Tipo', 'Indicación', 'Frecuencia u horario', 'Vigencia', 'Registrada por'],
        vigentes.map((i) => [nombreCatalogo(db.catalogos.tiposIndicacion, i.tipoIndicacionId), `${i.titulo}\n${i.descripcion}`, i.frecuenciaHorario, vigenciaTexto(i), nombreUsuario(db.usuarios, i.registradaPor) ?? '-']),
        [24, 62, 32, 36, 26],
      )
    }
    const otras = propias.length - vigentes.length
    if (otras > 0) nota(`No se incluyen ${plural(otras, 'indicación suspendida o finalizada', 'indicaciones suspendidas o finalizadas')}. Solo se transcribe lo indicado por personal de salud.`)
    else nota('Solo se transcribe lo indicado por personal de salud.')
  }

  /* 3. Riesgos */
  titulo('3. Riesgos vigentes e historial')
  if (!d.verSensible) {
    nota('La información de riesgo no está disponible para tu rol.')
  } else {
    const todos = riesgosDe(db.riesgos, adulto.id)
    const vigentes = todos.filter((r) => r.estado === 'vigente')
    if (vigentes.length === 0) nota('Sin factores de riesgo vigentes.')
    else {
      tabla(
        ['Factor', 'Nivel', 'Motivo y observación', 'Fecha'],
        vigentes.map((r) => [nombreCatalogo(db.catalogos.riesgos, r.riesgoId), RIESGO_TEXTO[r.nivel], [r.motivo, r.observacion ? `Observación: ${r.observacion}` : ''].filter(Boolean).join('\n'), fechaCorta(r.fecha)]),
        [38, 20, 94, 28],
      )
    }
    if (todos.length > 0) {
      doc.setTextColor(...NAVY)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.text('Historial de riesgos', MARGEN, y)
      y += 2
      const recientes = todos.slice(0, RIESGOS_EN_INFORME)
      tabla(
        ['Fecha', 'Factor', 'Nivel', 'Estado', 'Motivo'],
        recientes.map((r) => [fechaCorta(r.fecha), nombreCatalogo(db.catalogos.riesgos, r.riesgoId), RIESGO_TEXTO[r.nivel], ESTADO_RIESGO_TEXTO[r.estado], r.motivo]),
        [22, 38, 20, 22, 78],
      )
      if (todos.length > recientes.length) nota(`Se muestran los ${recientes.length} registros más recientes de ${todos.length}.`)
    }
  }

  /* 4. Visitas recientes */
  titulo('4. Visitas recientes')
  const realizadas = db.visitas.filter((v) => visitaIncluye(v, adulto.id) && v.estado === 'completada').sort((a, b) => (b.fin ?? `${b.fecha}T${b.horaPautada}`).localeCompare(a.fin ?? `${a.fecha}T${a.horaPautada}`))
  if (realizadas.length === 0) nota('Aún no hay visitas realizadas. Atención inicial pendiente.')
  else {
    const recientes = realizadas.slice(0, VISITAS_EN_INFORME)
    tabla(
      ['Fecha', 'Responsable', 'Estado del adulto', 'Observaciones'],
      recientes.map((v) => {
        const responsable = v.visitante ? `${v.visitante.nombre} (visitante externo; autorizó ${nombreUsuario(db.usuarios, v.cuidadorId) ?? '-'})` : (nombreUsuario(db.usuarios, v.cuidadorId) ?? '-')
        const obs = d.verSensible ? (observacionPara(v, adulto.id) ?? '') : 'No disponible para tu rol'
        const estado = d.verSensible ? estadoAdultoPara(v, adulto.id) : undefined // el de este adulto, no el del principal de la visita
        return [fechaCorta(v.fecha), responsable, estado ? ESTADO_ADULTO_TEXTO[estado] : '-', obs || 'Sin observaciones']
      }),
      [22, 44, 32, 82],
    )
    const ultima = ultimaVisitaCompletada(db.visitas, adulto.id)
    nota(`Última visita realizada: ${ultima ? fechaCorta(ultima.fin ?? ultima.fecha) : '-'} · ${plural(realizadas.length, 'visita realizada', 'visitas realizadas')} en total. Solo se cuentan las visitas realizadas.`)
  }

  /* Aviso */
  if (y > alto - 40) {
    doc.addPage()
    y = 20
  }
  doc.setDrawColor(...NAVY)
  doc.setFillColor(230, 241, 251)
  const aviso = doc.splitTextToSize(t(`${AVISO_INFORME} Este informe resume información registrada por la red de cuidado comunitario y debe ser interpretado por personal de salud. Contiene datos sensibles: compártelo solo con quien corresponda (Ley 172-13).`), ancho - MARGEN * 2 - 8) as string[]
  const altoAviso = aviso.length * 4.2 + 8
  doc.roundedRect(MARGEN, y, ancho - MARGEN * 2, altoAviso, 2, 2, 'FD')
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(aviso, MARGEN + 4, y + 6)

  /* Pie de cada página: quién y cuándo lo generó, numeración */
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setDrawColor(210, 215, 222)
    doc.setLineWidth(0.2)
    doc.line(MARGEN, alto - 13, ancho - MARGEN, alto - 13)
    doc.setTextColor(...GRIS)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(t(`Generado el ${generado} por ${quien} · Documento confidencial`), MARGEN, alto - 8.5)
    doc.text(t(AVISO_INFORME), MARGEN, alto - 5)
    doc.text(`Página ${p} de ${paginas}`, ancho - MARGEN, alto - 8.5, { align: 'right' })
  }

  return { doc, nombreArchivo: nombreArchivoInforme(adulto, todayISO()) }
}
