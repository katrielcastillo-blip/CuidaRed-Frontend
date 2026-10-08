import { addDays, fechaCorta, fechaLarga, toISODate } from '@/domain/dates'
import type { DB, Riesgo, TipoNecesidad } from '@/domain/types'
import { diaLocal, nombreAdulto, RIESGO_TEXTO, TIPO_NECESIDAD_TEXTO } from './formato'
import { necesidadesActivas, ultimaVisitaCompletada } from './datos'

export type Rango = 'mes' | '3m' | '6m' | 'anio' | 'todo'

export const RANGOS: Array<{ value: Rango; label: string; sufijo: string; anterior: string }> = [
  { value: 'mes', label: 'Este mes', sufijo: 'este mes', anterior: 'mes anterior' },
  { value: '3m', label: 'Últimos 3 meses', sufijo: 'en 3 meses', anterior: '3 meses previos' },
  { value: '6m', label: 'Últimos 6 meses', sufijo: 'en 6 meses', anterior: '6 meses previos' },
  { value: 'anio', label: 'Este año', sufijo: 'este año', anterior: 'año anterior' },
  { value: 'todo', label: 'Todo el tiempo', sufijo: '', anterior: '' },
]

export interface FiltrosReporte {
  rango: Rango
  zona: string // '' = todas
  riesgo: '' | Riesgo
  categoria: '' | TipoNecesidad
}
export const FILTROS_INICIALES: FiltrosReporte = { rango: 'mes', zona: '', riesgo: '', categoria: '' }

export interface Delta {
  /** Variación porcentual respecto al período anterior (null si el anterior fue 0). */
  pct: number | null
  /** Diferencia absoluta. */
  diff: number
}

export interface FilaAdulto {
  id: string
  nombre: string
  cedula: string
  zona: string
  riesgo: Riesgo
  ultimaVisita: string
  necesidadesActivas: number
}

export interface Reporte {
  adultosRegistrados: number
  adultosNuevos: number | null
  visitasRealizadas: number
  visitasDelta: Delta | null
  necesidadesAtendidas: number
  necesidadesDelta: Delta | null
  casosPrioritarios: number
  visitasPorMes: Array<{ clave: string; etiqueta: string; total: number; actual: boolean }>
  visitasSemestre: number
  solicitudes: number
  categorias: Array<{ tipo: TipoNecesidad; etiqueta: string; total: number; pct: number }>
  riesgo: Array<{ nivel: Riesgo; etiqueta: string; total: number; pct: number }>
  adultos: FilaAdulto[]
}

const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const TIPOS: TipoNecesidad[] = ['medicamentos', 'compania', 'alimentacion', 'transporte', 'otros']
const NIVELES: Riesgo[] = ['alto', 'medio', 'bajo']

interface Limites {
  desde: string | null
  hasta: string
  prevDesde: string | null
  prevHasta: string | null
}

function limites(rango: Rango, hoy: Date): Limites {
  const hasta = toISODate(hoy)
  if (rango === 'todo') return { desde: null, hasta, prevDesde: null, prevHasta: null }
  const meses = rango === 'mes' ? 1 : rango === '3m' ? 3 : rango === '6m' ? 6 : 12
  const inicio = rango === 'anio' ? new Date(hoy.getFullYear(), 0, 1) : new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1), 1)
  const prevInicio = rango === 'anio' ? new Date(hoy.getFullYear() - 1, 0, 1) : new Date(inicio.getFullYear(), inicio.getMonth() - meses, 1)
  return {
    desde: toISODate(inicio),
    hasta,
    prevDesde: toISODate(prevInicio),
    prevHasta: toISODate(addDays(inicio, -1)),
  }
}

const dentro = (dia: string, desde: string | null, hasta: string | null) => (!desde || dia >= desde) && (!hasta || dia <= hasta)

function delta(actual: number, previo: number): Delta {
  return { diff: actual - previo, pct: previo > 0 ? Math.round(((actual - previo) / previo) * 100) : null }
}

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0)

/** Calcula todas las métricas del reporte desde el store aplicando los filtros. */
export function calcularReporte(
  db: Pick<DB, 'adultos' | 'visitas' | 'necesidades' | 'alertas'>,
  orgId: string,
  f: FiltrosReporte,
  hoy: Date = new Date(),
): Reporte {
  const lim = limites(f.rango, hoy)
  // Adultos que cumplen zona + riesgo (incluye inactivos para el histórico de visitas/necesidades).
  const coinciden = db.adultos.filter((a) => a.orgId === orgId && (!f.zona || a.zona === f.zona) && (!f.riesgo || a.riesgo === f.riesgo))
  const ids = new Set(coinciden.map((a) => a.id))
  const activos = coinciden.filter((a) => a.estado === 'activo')

  const visitasOk = db.visitas.filter((v) => v.estado === 'completada' && ids.has(v.adultoId))
  const visitasEnRango = visitasOk.filter((v) => dentro(v.fecha, lim.desde, lim.hasta))
  const visitasPrevias = lim.prevDesde ? visitasOk.filter((v) => dentro(v.fecha, lim.prevDesde, lim.prevHasta)) : []

  const necesidadesOk = db.necesidades.filter((n) => ids.has(n.adultoId) && (!f.categoria || n.tipo === f.categoria))
  const fechaAtencion = (n: (typeof necesidadesOk)[number]) => diaLocal(n.satisfechaEn ?? n.creadaEn)
  const atendidas = necesidadesOk.filter((n) => n.estado === 'satisfecha')
  const atendidasEnRango = atendidas.filter((n) => dentro(fechaAtencion(n), lim.desde, lim.hasta))
  const atendidasPrevias = lim.prevDesde ? atendidas.filter((n) => dentro(fechaAtencion(n), lim.prevDesde, lim.prevHasta)) : []
  const solicitudes = necesidadesOk.filter((n) => dentro(diaLocal(n.creadaEn), lim.desde, lim.hasta))

  // Gráfico: últimos 6 meses (independiente del rango), con los filtros de zona y riesgo.
  const visitasPorMes = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1)
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return {
      clave,
      etiqueta: MES_CORTO[d.getMonth()]!,
      total: visitasOk.filter((v) => v.fecha.startsWith(clave)).length,
      actual: i === 5,
    }
  })

  const categorias = TIPOS.map((tipo) => {
    const total = solicitudes.filter((n) => n.tipo === tipo).length
    return { tipo, etiqueta: TIPO_NECESIDAD_TEXTO[tipo], total, pct: porcentaje(total, solicitudes.length) }
  })

  const riesgo = NIVELES.map((nivel) => {
    const total = activos.filter((a) => a.riesgo === nivel).length
    return { nivel, etiqueta: RIESGO_TEXTO[nivel], total, pct: porcentaje(total, activos.length) }
  })

  const nuevos = lim.desde ? activos.filter((a) => dentro(diaLocal(a.creadoEn), lim.desde, lim.hasta)).length : null

  return {
    adultosRegistrados: activos.length,
    adultosNuevos: nuevos,
    visitasRealizadas: visitasEnRango.length,
    visitasDelta: lim.prevDesde ? delta(visitasEnRango.length, visitasPrevias.length) : null,
    necesidadesAtendidas: atendidasEnRango.length,
    necesidadesDelta: lim.prevDesde ? delta(atendidasEnRango.length, atendidasPrevias.length) : null,
    casosPrioritarios: db.alertas.filter((al) => al.severidad === 'alta' && al.estado !== 'atendida' && ids.has(al.adultoId)).length,
    visitasPorMes,
    visitasSemestre: visitasPorMes.reduce((t, m) => t + m.total, 0),
    solicitudes: solicitudes.length,
    categorias,
    riesgo,
    adultos: activos
      .map<FilaAdulto>((a) => ({
        id: a.id,
        nombre: nombreAdulto(a),
        cedula: a.cedula,
        zona: a.zona,
        riesgo: a.riesgo,
        ultimaVisita: ultimaVisitaCompletada(db.visitas, a.id) ?? '',
        necesidadesActivas: necesidadesActivas(db.necesidades, a.id).length,
      }))
      .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')),
  }
}

/** Texto legible de los filtros aplicados (para el CSV y la hoja impresa). */
export function describirFiltros(f: FiltrosReporte): string[] {
  return [
    `Rango: ${RANGOS.find((r) => r.value === f.rango)?.label ?? ''}`,
    `Zona: ${f.zona || 'Todas'}`,
    `Riesgo: ${f.riesgo ? RIESGO_TEXTO[f.riesgo] : 'Todos'}`,
    `Categoría de necesidad: ${f.categoria ? TIPO_NECESIDAD_TEXTO[f.categoria] : 'Todas'}`,
  ]
}

const celda = (v: string | number) => {
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV del reporte (UTF-8 con BOM, abre bien en Excel): resumen, gráficos y detalle de adultos. */
export function reporteCSV(r: Reporte, f: FiltrosReporte, organizacion: string, hoy: Date = new Date()): string {
  const filas: Array<Array<string | number>> = [
    ['Reporte CuidaRed'],
    ['Organización', organizacion],
    ['Generado', fechaLarga(hoy)],
    ...describirFiltros(f).map((x) => [x]),
    [],
    ['Resumen'],
    ['Indicador', 'Valor'],
    ['Adultos registrados', r.adultosRegistrados],
    ['Visitas realizadas', r.visitasRealizadas],
    ['Necesidades atendidas', r.necesidadesAtendidas],
    ['Casos prioritarios', r.casosPrioritarios],
    [],
    ['Visitas por mes'],
    ['Mes', 'Visitas'],
    ...r.visitasPorMes.map((m) => [`${m.etiqueta} (${m.clave})`, m.total]),
    [],
    ['Distribución de necesidades por categoría'],
    ['Categoría', 'Solicitudes', 'Porcentaje'],
    ...r.categorias.map((c) => [c.etiqueta, c.total, `${c.pct}%`]),
    [],
    ['Adultos por nivel de riesgo'],
    ['Nivel', 'Adultos', 'Porcentaje'],
    ...r.riesgo.map((x) => [x.etiqueta, x.total, `${x.pct}%`]),
    [],
    ['Detalle de adultos'],
    ['Nombre', 'Cédula', 'Zona', 'Riesgo', 'Última visita', 'Necesidades activas'],
    ...r.adultos.map((a) => [a.nombre, a.cedula, a.zona, RIESGO_TEXTO[a.riesgo], a.ultimaVisita ? fechaCorta(a.ultimaVisita) : 'Sin visitas', a.necesidadesActivas]),
  ]
  return '﻿' + filas.map((fila) => fila.map(celda).join(',')).join('\r\n')
}

/** Descarga un texto como archivo desde el navegador. */
export function descargarArchivo(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
