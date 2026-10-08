import { useMemo, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Bus, CircleEllipsis, Frown, HeartHandshake, Meh, Pill, Smile, Utensils } from 'lucide-react'
import { fechaCorta, hhmmA12, pad } from '@/domain/dates'
import { useSession } from '@/domain/auth'
import { useDB } from '@/domain/store'
import type { Adulto, EstadoAdultoVisita, EstadoNecesidad, EstadoVisita, Riesgo, TipoNecesidad, Visita } from '@/domain/types'

/** Color del punto de estado ("● Pendiente") como variable CSS para Comun.module.css. */
export const estiloPunto = (color: string) => ({ '--dot': color }) as CSSProperties

/** Tonos del Badge del kit (el tipo no se exporta desde el kit). */
export type Tono = 'danger' | 'warning' | 'success' | 'info' | 'neutral' | 'navy'

/* ───────────── Necesidades ───────────── */
export const TIPOS_NECESIDAD: Array<{ value: TipoNecesidad; label: string; icon: LucideIcon }> = [
  { value: 'medicamentos', label: 'Medicamentos', icon: Pill },
  { value: 'alimentacion', label: 'Alimentación', icon: Utensils },
  { value: 'transporte', label: 'Transporte', icon: Bus },
  { value: 'compania', label: 'Compañía', icon: HeartHandshake },
  { value: 'otros', label: 'Otros', icon: CircleEllipsis },
]

export const tipoNecesidad = (t: TipoNecesidad) => TIPOS_NECESIDAD.find((x) => x.value === t) ?? TIPOS_NECESIDAD[4]!

export const ESTADO_NECESIDAD: Record<EstadoNecesidad, { label: string; badge: string; tone: Tono; dot: string }> = {
  activa: { label: 'Activa', badge: 'ACTIVA', tone: 'danger', dot: 'var(--c-teal)' },
  inactiva: { label: 'Inactiva', badge: 'INACTIVA', tone: 'neutral', dot: 'var(--c-muted)' },
  satisfecha: { label: 'Satisfecha', badge: 'SATISFECHA', tone: 'success', dot: 'var(--c-blue)' },
}

/* ───────────── Visitas ───────────── */
export const ESTADO_VISITA: Record<EstadoVisita, { label: string; badge: string; tone: Tono; dot: string }> = {
  pendiente: { label: 'Pendiente', badge: 'PENDIENTE', tone: 'warning', dot: 'var(--c-danger)' },
  en_curso: { label: 'En curso', badge: 'EN CURSO', tone: 'info', dot: 'var(--c-teal)' },
  completada: { label: 'Completada', badge: 'COMPLETADA', tone: 'success', dot: 'var(--c-green)' },
  cancelada: { label: 'Cancelada', badge: 'CANCELADA', tone: 'neutral', dot: 'var(--c-muted)' },
}

export const ESTADOS_ADULTO: Array<{ value: EstadoAdultoVisita; label: string; icon: LucideIcon; tone: 'success' | 'warning' | 'danger' }> = [
  { value: 'estable', label: 'Estable', icon: Smile, tone: 'success' },
  { value: 'requiere_atencion', label: 'Requiere Atención', icon: Meh, tone: 'warning' },
  { value: 'situacion_critica', label: 'Situación Crítica', icon: Frown, tone: 'danger' },
]

export const estadoAdulto = (e: EstadoAdultoVisita) => ESTADOS_ADULTO.find((x) => x.value === e) ?? ESTADOS_ADULTO[0]!

/** "10:30 a.m. - 24/08/2026" */
export const fechaHoraVisita = (v: Visita) => `${hhmmA12(v.horaPautada)} - ${fechaCorta(v.fecha)}`

/** Instante (ISO) que ordena una visita en el tiempo. */
export const instanteVisita = (v: Visita) => v.fin ?? v.inicio ?? new Date(`${v.fecha}T${v.horaPautada}:00`).toISOString()

/** Visita completada más reciente de un adulto. */
export function ultimaVisitaDe(visitas: Visita[], adultoId: string): Visita | undefined {
  let ult: Visita | undefined
  for (const v of visitas) {
    if (v.adultoId !== adultoId || v.estado !== 'completada') continue
    if (!ult || instanteVisita(v) > instanteVisita(ult)) ult = v
  }
  return ult
}

/** Orden cronológico por fecha + hora pautada. */
export const porFechaAsc = (a: Visita, b: Visita) => `${a.fecha}T${a.horaPautada}`.localeCompare(`${b.fecha}T${b.horaPautada}`)
export const porFechaDesc = (a: Visita, b: Visita) => porFechaAsc(b, a)

/* ───────────── Adultos ───────────── */
export const RIESGO_PESO: Record<Riesgo, number> = { alto: 0, medio: 1, bajo: 2 }
export const RIESGO_ETIQUETA: Record<Riesgo, string> = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }

/** Minúsculas y sin tildes: para buscar "jose" y encontrar "José". */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** "HH:MM" local de una fecha. */
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Adultos sobre los que el usuario en sesión puede registrar: sus asignados (cuidador) o todos los de la organización (coordinador). */
export function useAdultosElegibles(): Adulto[] {
  const { user } = useSession()
  const adultos = useDB((s) => s.adultos)
  return useMemo(() => {
    if (!user) return []
    return adultos
      .filter((a) => a.estado === 'activo' && a.orgId === user.orgId && (user.rol === 'coordinador' || a.cuidadorIds.includes(user.id)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [adultos, user])
}
