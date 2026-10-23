/*
 * dates.ts — Helpers de fecha en español (República Dominicana). Todo en hora local salvo ahoraUTC().
 * Módulo: dominio.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */

export const pad = (n: number) => String(n).padStart(2, '0')

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISODate(new Date())

export function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** ISO completo para "hoy a las HH:MM" desplazado `dayOffset` días. */
export function isoAt(dayOffset: number, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = addDays(new Date(), dayOffset)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** "Lunes 24 de Agosto 2026" */
export function fechaLarga(d: Date | string = new Date()) {
  const x = typeof d === 'string' ? new Date(d) : d
  return `${DIAS[x.getDay()]} ${x.getDate()} de ${MESES[x.getMonth()]} ${x.getFullYear()}`
}

/** "24/08/2026" */
export function fechaCorta(d: Date | string) {
  const x = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d)
  return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`
}

/** "04:30 p.m." */
export function hora12(d: Date | string) {
  const x = typeof d === 'string' ? new Date(d) : d
  let h = x.getHours()
  const suf = h >= 12 ? 'p.m.' : 'a.m.'
  h = h % 12 || 12
  return `${pad(h)}:${pad(x.getMinutes())} ${suf}`
}

/** "10:30" → "10:30 a.m." */
export function hhmmA12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return hora12(d)
}

/** "Hoy, 12:00 p.m." · "Ayer, 04:30 p.m." · "24/08/2026" */
export function relativo(iso: string) {
  const d = new Date(iso)
  const hoy = new Date()
  const diff = Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000)
  if (diff === 0) return `Hoy, ${hora12(d)}`
  if (diff === 1) return `Ayer, ${hora12(d)}`
  return fechaCorta(d)
}

export function edad(fechaNacimiento: string) {
  const n = new Date(`${fechaNacimiento}T00:00:00`)
  const h = new Date()
  let e = h.getFullYear() - n.getFullYear()
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--
  return e
}

/** Días calendario entre dos instantes/fechas (hora local): 0 si es el mismo día. */
export function diasCalendario(desde: Date | string, hasta: Date | string = new Date()) {
  const a = typeof desde === 'string' ? (/^\d{4}-\d{2}-\d{2}$/.test(desde) ? new Date(`${desde}T00:00:00`) : new Date(desde)) : desde
  const b = typeof hasta === 'string' ? (/^\d{4}-\d{2}-\d{2}$/.test(hasta) ? new Date(`${hasta}T00:00:00`) : new Date(hasta)) : hasta
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ub - ua) / 86_400_000)
}

/** "24/08/2026 04:30 p.m." */
export const fechaHora = (iso: string) => `${fechaCorta(iso)} ${hora12(iso)}`

/** Marca de tiempo UTC (ISO 8601) para auditoría y Last-Write-Wins. */
export const ahoraUTC = () => new Date().toISOString()
