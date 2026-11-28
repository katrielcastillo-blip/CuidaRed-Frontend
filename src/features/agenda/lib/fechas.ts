/* Formatos de fecha compartidos por la agenda conectada y el prototipo. */
import { addDays, hhmmA12, pad, toISODate } from '@/domain/dates'

const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const aFecha = (iso: string) => new Date(`${iso}T00:00:00`)
export const horaTarea = (hhmm: string) => hhmmA12(hhmm).replace(/^0/, '')
export const sumarDias = (iso: string, n: number) => toISODate(addDays(aFecha(iso), n))

export function fechaDiaLarga(iso: string) {
  const d = aFecha(iso)
  const anio = d.getFullYear() === new Date().getFullYear() ? '' : ` de ${d.getFullYear()}`
  return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}${anio}`
}

export function fechaDiaCorta(iso: string) {
  const d = aFecha(iso)
  return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
}

export const DIAS_SEMANA = [1, 2, 3, 4, 5, 6, 0].map((value) => ({
  value,
  label: DIAS_CORTOS[value]!.replace(/^./, (c) => c.toUpperCase()),
  largo: DIAS_LARGOS[value]!,
}))

export function fechaHoraBreve(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}, ${h % 12 || 12}:${pad(d.getMinutes())} ${h >= 12 ? 'p.m.' : 'a.m.'}`
}
