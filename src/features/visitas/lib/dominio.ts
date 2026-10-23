/*
 * dominio.ts — Presentación del dominio de visitas y necesidades: etiquetas, tonos, iconos y puntos de
 * color de cada estado, orden de visitas, motivos de visita (Visit_razon), prioridades (Prioridad) y adultos
 * elegibles para registrar (RF-02 · RF-03 · CU-05 a CU-08).
 * Módulo: visitas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Bus, CircleEllipsis, Frown, HeartHandshake, Meh, Pill, Smile, Utensils } from 'lucide-react'
import { TIPOS_NECESIDAD_TEXTO } from '@/domain/catalogos'
import { fechaCorta, hhmmA12, pad } from '@/domain/dates'
import { useSession } from '@/domain/auth'
import { puede, type Accion } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import { visitaIncluye } from '@/domain/relaciones'
import type { Adulto, EstadoAdultoVisita, EstadoNecesidad, EstadoVisita, Necesidad, Prioridad, Riesgo, TipoNecesidad, Visita } from '@/domain/types'
import type { Tone } from '@/components/ui'

/** Tonos del Badge del kit. */
export type Tono = Tone

/** Presentación de un estado: texto, texto del badge, tono del badge y clase del punto de color (●). */
export interface VistaEstado {
  label: string
  badge: string
  tone: Tono
  /** Clase Tailwind de fondo del punto de estado. */
  dot: string
}

/* ───────────── Necesidades ───────────── */
const ICONOS_NECESIDAD: Record<TipoNecesidad, LucideIcon> = {
  medicamentos: Pill,
  alimentacion: Utensils,
  transporte: Bus,
  compania: HeartHandshake,
  otros: CircleEllipsis,
}

/** Categorías de necesidad (CU-07): Medicamentos, Alimentación, Transporte, Compañía, Otros apoyos. */
export const TIPOS_NECESIDAD: Array<{ value: TipoNecesidad; label: string; icon: LucideIcon }> = (
  Object.keys(TIPOS_NECESIDAD_TEXTO) as TipoNecesidad[]
).map((value) => ({ value, label: TIPOS_NECESIDAD_TEXTO[value], icon: ICONOS_NECESIDAD[value] }))

export const tipoNecesidad = (t: TipoNecesidad) => TIPOS_NECESIDAD.find((x) => x.value === t) ?? TIPOS_NECESIDAD[TIPOS_NECESIDAD.length - 1]!

/**
 * Estados de una necesidad (RF-03): Pendiente (ámbar), En proceso (azul), Satisfecha (verde), Inactiva (gris).
 * Una necesidad de medicamentos pendiente se muestra en rojo: genera una alerta de caso prioritario (RF-04).
 */
export const ESTADO_NECESIDAD: Record<EstadoNecesidad, VistaEstado> = {
  pendiente: { label: 'Pendiente', badge: 'PENDIENTE', tone: 'warning', dot: 'bg-warning' },
  en_proceso: { label: 'En proceso', badge: 'EN PROCESO', tone: 'info', dot: 'bg-blue' },
  satisfecha: { label: 'Satisfecha', badge: 'SATISFECHA', tone: 'success', dot: 'bg-green' },
  inactiva: { label: 'Inactiva', badge: 'INACTIVA', tone: 'neutral', dot: 'bg-muted' },
}

/** Estado visual de una necesidad concreta (rojo si es de medicamentos y sigue pendiente). */
export function vistaNecesidad(n: Pick<Necesidad, 'estado' | 'tipo'>): VistaEstado {
  const base = ESTADO_NECESIDAD[n.estado]
  if (n.estado === 'pendiente' && n.tipo === 'medicamentos') return { ...base, tone: 'danger', dot: 'bg-danger' }
  return base
}

/** Cambios de estado permitidos desde cada estado (CU-08). */
export const TRANSICIONES_NECESIDAD: Record<EstadoNecesidad, EstadoNecesidad[]> = {
  pendiente: ['en_proceso', 'satisfecha', 'inactiva'],
  en_proceso: ['satisfecha', 'pendiente', 'inactiva'],
  satisfecha: ['pendiente'],
  inactiva: ['pendiente'],
}

/** Estados que cierran la necesidad: exigen motivo de resolución (Env_Necesidad.motivo_resolucion). */
export const ESTADOS_RESOLUCION: EstadoNecesidad[] = ['satisfecha', 'inactiva']
export const resuelve = (e: EstadoNecesidad | '') => e !== '' && ESTADOS_RESOLUCION.includes(e)

/** Prioridad (catálogo Prioridad): texto y tono del badge. */
export const PRIORIDADES: Array<{ value: Prioridad; label: string; tone: Tono }> = [
  { value: 'alta', label: 'Alta', tone: 'danger' },
  { value: 'media', label: 'Media', tone: 'warning' },
  { value: 'baja', label: 'Baja', tone: 'neutral' },
]
export const prioridad = (p: Prioridad) => PRIORIDADES.find((x) => x.value === p) ?? PRIORIDADES[1]!
/** Prioridad por defecto de una categoría: alta en medicamentos (RF-04), media en el resto. */
export const prioridadPorDefecto = (t: TipoNecesidad | ''): Prioridad => (t === 'medicamentos' ? 'alta' : 'media')

/** Texto del botón para pasar a cada estado. */
export const ACCION_ESTADO_NECESIDAD: Record<EstadoNecesidad, string> = {
  pendiente: 'Reabrir (pendiente)',
  en_proceso: 'En proceso',
  satisfecha: 'Satisfecha',
  inactiva: 'Inactiva',
}

/* ───────────── Visitas ───────────── */
export const ESTADO_VISITA: Record<EstadoVisita, VistaEstado> = {
  pendiente: { label: 'Programada', badge: 'PROGRAMADA', tone: 'warning', dot: 'bg-warning' },
  en_curso: { label: 'En curso', badge: 'EN CURSO', tone: 'info', dot: 'bg-blue' },
  completada: { label: 'Completada', badge: 'COMPLETADA', tone: 'success', dot: 'bg-green' },
  cancelada: { label: 'Cancelada', badge: 'CANCELADA', tone: 'neutral', dot: 'bg-muted' },
}

/** Estado del adulto observado en la visita (tiles del formulario). */
export const ESTADOS_ADULTO: Array<{ value: EstadoAdultoVisita; label: string; icon: LucideIcon; tone: 'success' | 'warning' | 'danger' }> = [
  { value: 'estable', label: 'Estable', icon: Smile, tone: 'success' },
  { value: 'requiere_atencion', label: 'Requiere atención', icon: Meh, tone: 'warning' },
  { value: 'situacion_critica', label: 'Situación crítica', icon: Frown, tone: 'danger' },
]

export const estadoAdulto = (e: EstadoAdultoVisita) => ESTADOS_ADULTO.find((x) => x.value === e) ?? ESTADOS_ADULTO[0]!

/** Motivos predefinidos de la visita (Visita.Visit_razon). «Otra» pide escribir el motivo. */
export const RAZON_OTRA = 'otra'
export const RAZONES_VISITA: string[] = [
  'Seguimiento periódico',
  'Revisión de medicamentos',
  'Entrega de apoyo',
  'Control de salud',
  'Visita familiar conjunta',
]
export const RAZON_POR_DEFECTO = RAZONES_VISITA[0]!

/** Máximo de adultos adicionales del mismo hogar por visita (filas extra de DetalleVisita; RF-06: ≤ 5 textos libres). */
export const MAX_ADICIONALES = 3

/** "10:30 a.m. · 24/08/2026" */
export const fechaHoraVisita = (v: Visita) => `${hhmmA12(v.horaPautada)} · ${fechaCorta(v.fecha)}`

/** Instante (ISO) que ordena una visita en el tiempo. */
export const instanteVisita = (v: Visita) => v.fin ?? v.inicio ?? new Date(`${v.fecha}T${v.horaPautada}:00`).toISOString()

/** Visita completada más reciente de un adulto (como principal o como adulto adicional del hogar). */
export function ultimaVisitaDe(visitas: Visita[], adultoId: string): Visita | undefined {
  let ult: Visita | undefined
  for (const v of visitas) {
    if (v.estado !== 'completada' || !visitaIncluye(v, adultoId)) continue
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

/** ¿Comparten domicilio? (misma dirección y municipio: candidatos a «mismo hogar» en DetalleVisita). */
export const mismoHogar = (a: Pick<Adulto, 'direccion' | 'municipioCod'>, b: Pick<Adulto, 'direccion' | 'municipioCod'>) =>
  !!a.direccion && normalizar(a.direccion) === normalizar(b.direccion) && a.municipioCod === b.municipioCod

/** "HH:MM" local de una fecha. */
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/**
 * Adultos activos sobre los que el usuario en sesión puede realizar la acción (RBAC + alcance):
 * el voluntario, solo los que tienen vínculo «voluntario asignado» (tabla Vinculo); el coordinador, todos los de su organización.
 */
export function useAdultosElegibles(accion: Accion = 'visitas:registrar'): Adulto[] {
  const { user } = useSession()
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  return useMemo(() => {
    if (!user) return []
    return adultos.filter((a) => a.estado === 'activo' && puede(user, accion, a, vinculos)).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [adultos, vinculos, user, accion])
}
