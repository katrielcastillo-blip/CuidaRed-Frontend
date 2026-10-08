import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import { Car, ClipboardList, HeartHandshake, Pill, Utensils, type LucideIcon } from 'lucide-react'
import { useUser } from '@/domain/auth'
import { addDays, fechaCorta, toISODate, todayISO } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Badge } from '@/components/ui'
import type { Adulto, EstadoNecesidad, EstadoVisita, Riesgo, TipoNecesidad, Visita } from '@/domain/types'

/** Helpers y hooks del área FAMILIAR (solo lectura sobre el dominio). */

type Tono = NonNullable<ComponentProps<typeof Badge>['tone']>

/* ───────────── Etiquetas ───────────── */
export const TIPO_NECESIDAD: Record<TipoNecesidad, { label: string; icon: LucideIcon }> = {
  medicamentos: { label: 'Medicamentos', icon: Pill },
  alimentacion: { label: 'Alimentación', icon: Utensils },
  transporte: { label: 'Transporte', icon: Car },
  compania: { label: 'Compañía', icon: HeartHandshake },
  otros: { label: 'Otros', icon: ClipboardList },
}

export const ESTADO_NECESIDAD: Record<EstadoNecesidad, { label: string; texto: string; tono: Tono; punto: string }> = {
  activa: { label: 'ACTIVA', texto: 'Activa', tono: 'danger', punto: 'var(--c-green)' },
  satisfecha: { label: 'SATISFECHA', texto: 'Satisfecha', tono: 'success', punto: 'var(--c-blue)' },
  inactiva: { label: 'INACTIVA', texto: 'Inactiva', tono: 'neutral', punto: 'var(--c-muted)' },
}

export const ESTADO_VISITA: Record<EstadoVisita, { label: string; tono: Tono }> = {
  completada: { label: 'REALIZADA', tono: 'success' },
  pendiente: { label: 'PENDIENTE', tono: 'warning' },
  en_curso: { label: 'EN CURSO', tono: 'info' },
  cancelada: { label: 'CANCELADA', tono: 'neutral' },
}

/** El Figma del dashboard escribe el riesgo en femenino ("MEDIA", "ALTA"), el de los detalles en masculino. */
export const RIESGO_FEM: Record<Riesgo, string> = { alto: 'ALTA', medio: 'MEDIA', bajo: 'BAJA' }
export const RIESGO_MASC: Record<Riesgo, string> = { alto: 'ALTO', medio: 'MEDIO', bajo: 'BAJO' }
export const RIESGO_TONO: Record<Riesgo, Tono> = { alto: 'danger', medio: 'warning', bajo: 'success' }
export const RIESGO_ORDEN: Record<Riesgo, number> = { alto: 0, medio: 1, bajo: 2 }

/* ───────────── Fechas de visitas ───────────── */
/** Fecha+hora pautada de la visita como ISO local ("2026-10-08T15:00:00"). */
export const isoPautado = (v: Visita) => `${v.fecha}T${v.horaPautada}:00`

/** Ordena visitas de más reciente a más antigua (por fecha y hora pautada). */
export const masRecientesPrimero = (a: Visita, b: Visita) => isoPautado(b).localeCompare(isoPautado(a))

/** Última visita completada de un adulto. */
export function ultimaVisitaCompletada(visitas: Visita[], adultoId: string): Visita | undefined {
  return visitas.filter((v) => v.adultoId === adultoId && v.estado === 'completada').sort(masRecientesPrimero)[0]
}

/** "Hoy" · "Mañana" · "Ayer" · "24/08/2026" para una fecha YYYY-MM-DD. */
export function etiquetaDia(fecha: string) {
  if (fecha === todayISO()) return 'Hoy'
  if (fecha === toISODate(addDays(new Date(), 1))) return 'Mañana'
  if (fecha === toISODate(addDays(new Date(), -1))) return 'Ayer'
  return fechaCorta(fecha)
}

/* ───────────── Texto ───────────── */
/** Minúsculas y sin tildes para buscar. */
export const normaliza = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* ───────────── Hooks ───────────── */
/** Adultos de las familias del familiar en sesión. */
export function useAdultosFamilia(): Adulto[] {
  const user = useUser()
  const adultos = useDB((s) => s.adultos)
  return useMemo(() => adultos.filter((a) => user.familiaIds.includes(a.familiaId)), [adultos, user.familiaIds])
}

/** El adulto solo se devuelve si pertenece a una familia del usuario (evita ver datos ajenos por URL). */
export function useAdultoPropio(adultoId: string | undefined): Adulto | undefined {
  const adultos = useAdultosFamilia()
  return useMemo(() => adultos.find((a) => a.id === adultoId), [adultos, adultoId])
}

/** Estado de conexión del navegador ("● En línea"). */
export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setEnLinea(true)
    const off = () => setEnLinea(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return enLinea
}
