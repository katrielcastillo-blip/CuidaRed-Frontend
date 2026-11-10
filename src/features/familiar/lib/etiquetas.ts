/*
 * etiquetas.ts — Textos, tonos e iconos del Portal Familiar (solo lectura) y formatos de fecha para la familia.
 * Son puras (sin store ni red): sirven igual con los datos locales de hoy y con la API de mañana.
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Car, ClipboardList, Frown, HeartHandshake, Meh, Pill, Smile, Utensils, type LucideIcon } from 'lucide-react'
import { addDays, fechaCorta, toISODate, todayISO } from '@/domain/dates'
import type { Tone } from '@/components/ui'
import type { EstadoAdultoVisita, EstadoNecesidad, EstadoVisita, Prioridad, TipoNecesidad } from '@/domain/types'
import type { EstadoIndicacion } from './modelos'

/** Tipos de necesidad (catálogo TipoNecesidad). */
export const TIPO_NECESIDAD: Record<TipoNecesidad, { label: string; icon: LucideIcon }> = {
  medicamentos: { label: 'Medicamentos', icon: Pill },
  alimentacion: { label: 'Alimentación', icon: Utensils },
  transporte: { label: 'Transporte', icon: Car },
  compania: { label: 'Compañía', icon: HeartHandshake },
  otros: { label: 'Otros apoyos', icon: ClipboardList },
}

/** Estados de necesidad (RF-03) con texto claro para la familia. */
export const ESTADO_NECESIDAD: Record<EstadoNecesidad, { label: string; tono: Tone; explicacion: string; punto: string }> = {
  pendiente: { label: 'Pendiente', tono: 'danger', explicacion: 'Registrada; aún no se ha empezado a atender.', punto: 'bg-danger' },
  en_proceso: { label: 'En proceso', tono: 'warning', explicacion: 'El equipo de la cuenta ya la está atendiendo.', punto: 'bg-warning' },
  satisfecha: { label: 'Satisfecha', tono: 'success', explicacion: 'La necesidad fue cubierta.', punto: 'bg-success' },
  inactiva: { label: 'Inactiva', tono: 'neutral', explicacion: 'Ya no requiere seguimiento.', punto: 'bg-muted' },
}

/** Prioridad de una necesidad (Prioridad_Id). */
export const PRIORIDAD: Record<Prioridad, { label: string; tono: Tone }> = {
  alta: { label: 'Prioridad alta', tono: 'danger' },
  media: { label: 'Prioridad media', tono: 'warning' },
  baja: { label: 'Prioridad baja', tono: 'success' },
}

/** "30 tabletas" (Cantidad + Unidad_Medida), o undefined si no se registró cantidad. */
export const cantidadTexto = (n: { cantidad?: number; unidad?: string }) =>
  n.cantidad != null ? `${n.cantidad.toLocaleString('es-DO')} ${n.unidad ?? ''}`.trim() : undefined

/** Necesidades que siguen abiertas (pendientes o en proceso). */
export const necesidadAbierta = (e: EstadoNecesidad) => e === 'pendiente' || e === 'en_proceso'

export const ESTADO_VISITA: Record<EstadoVisita, { label: string; tono: Tone }> = {
  completada: { label: 'Realizada', tono: 'success' },
  pendiente: { label: 'Programada', tono: 'info' },
  en_curso: { label: 'En curso', tono: 'warning' },
  cancelada: { label: 'Cancelada', tono: 'neutral' },
}

/** Cómo encontró el visitante al adulto mayor (Visita.estado del adulto), de más a menos tranquilo. */
export const ESTADO_ADULTO_VISITA: Record<EstadoAdultoVisita, { label: string; tono: Tone; icon: LucideIcon }> = {
  estable: { label: 'Estable', tono: 'success', icon: Smile },
  requiere_atencion: { label: 'Requiere atención', tono: 'warning', icon: Meh },
  situacion_critica: { label: 'Situación crítica', tono: 'danger', icon: Frown },
}

/** Estados de una indicación médica (Indicacion_Medica.Estado). */
export const ESTADO_INDICACION: Record<EstadoIndicacion, { label: string; tono: Tone }> = {
  vigente: { label: 'Vigente', tono: 'success' },
  suspendida: { label: 'Suspendida', tono: 'warning' },
  finalizada: { label: 'Finalizada', tono: 'neutral' },
}

/** "Hoy" · "Mañana" · "Ayer" · "24/08/2026" para una fecha YYYY-MM-DD. */
export function etiquetaDia(fecha: string) {
  if (fecha === todayISO()) return 'Hoy'
  if (fecha === toISODate(addDays(new Date(), 1))) return 'Mañana'
  if (fecha === toISODate(addDays(new Date(), -1))) return 'Ayer'
  return fechaCorta(fecha)
}

/** "hoy" · "hace 1 día" · "hace 12 días". */
export const haceDias = (dias: number) => (dias <= 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`)

/** Minúsculas y sin tildes para buscar. */
export const normaliza = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Vigencia de una indicación: "Desde 03/10/2026 · hasta 10/12/2026" o "· sin fecha de fin". */
export const vigenciaTexto = (i: { fechaInicio: string; fechaFin?: string }) =>
  `Desde ${fechaCorta(i.fechaInicio)}${i.fechaFin ? ` · hasta ${fechaCorta(i.fechaFin)}` : ' · sin fecha de fin'}`

/** Aviso obligatorio junto a toda indicación médica que ve la familia (Ley 42-01; CuidaRed no es expediente clínico). */
export const AVISO_INDICACIONES =
  'Información transcrita de lo indicado por el personal de salud; no sustituye al médico. Ante cualquier duda, consulta a su médico.'
