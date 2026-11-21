/* Cálculo de fechas de una serie de tareas, compartido por los formularios y el prototipo. */
import { fechaValida } from './validacion'

export type Repeticion = 'ninguna' | 'diaria' | 'semanal'
export const MAX_OCURRENCIAS = 60

const DIA_MS = 86_400_000
const aMs = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

/** Genera como máximo 61 fechas para detectar que la serie excede el límite. */
export function fechasDeSerie(d: { fechaProgramada: string; repeticion: Repeticion; diasSemana: number[]; fechaFin: string }): string[] {
  if (!fechaValida(d.fechaProgramada)) return []
  if (d.repeticion === 'ninguna') return [d.fechaProgramada]
  if (!fechaValida(d.fechaFin) || d.fechaFin < d.fechaProgramada) return []
  if (d.repeticion === 'semanal' && d.diasSemana.length === 0) return []
  const fechas: string[] = []
  const fin = aMs(d.fechaFin)
  let pasos = 0
  for (let t = aMs(d.fechaProgramada); t <= fin && fechas.length <= MAX_OCURRENCIAS && pasos < 3700; t += DIA_MS, pasos++) {
    const dia = new Date(t)
    if (d.repeticion === 'diaria' || d.diasSemana.includes(dia.getUTCDay())) fechas.push(dia.toISOString().slice(0, 10))
  }
  return fechas
}
