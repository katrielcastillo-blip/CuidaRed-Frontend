/*
 * lib.ts — Helpers y hooks del módulo de consulta restringida del FAMILIAR RESPONSABLE (solo lectura).
 * El alcance se decide SIEMPRE con domain/permisos (adultosVisibles · alcanzaAdulto · puede): el familiar
 * solo ve los adultos con los que tiene vínculo "familiar_responsable" (tabla Vinculo · SRS §8.2.2.3.4 c · RF-09).
 * Las visitas incluyen aquellas en las que el adulto aparece como adulto adicional del hogar (DetalleVisita).
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { Car, ClipboardList, HeartHandshake, Pill, Utensils, type LucideIcon } from 'lucide-react'
import { useSession, useUser } from '@/domain/auth'
import { addDays, fechaCorta, toISODate, todayISO } from '@/domain/dates'
import { adultosVisibles, alcanzaAdulto, puede } from '@/domain/permisos'
import { configOrg, visitaIncluye } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Tone } from '@/components/ui'
import type { Adulto, EstadoNecesidad, EstadoVisita, Prioridad, TipoNecesidad, Visita } from '@/domain/types'

/* ───────────── Etiquetas ───────────── */
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
  en_proceso: { label: 'En proceso', tono: 'warning', explicacion: 'La organización ya la está atendiendo.', punto: 'bg-warning' },
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

/* ───────────── Fechas de visitas ───────────── */
/** Fecha+hora pautada de la visita como ISO local ("2026-10-08T15:00:00"). */
export const isoPautado = (v: Visita) => `${v.fecha}T${v.horaPautada}:00`

/** Ordena visitas de más reciente a más antigua (por fecha y hora pautada). */
export const masRecientesPrimero = (a: Visita, b: Visita) => isoPautado(b).localeCompare(isoPautado(a))

/** Próximas visitas (programadas o en curso, de hoy en adelante) que incluyen al adulto, de la más cercana a la más lejana. */
export function proximasVisitas(visitas: Visita[], adultoId: string): Visita[] {
  const hoy = todayISO()
  return visitas
    .filter((v) => visitaIncluye(v, adultoId) && (v.estado === 'pendiente' || v.estado === 'en_curso') && v.fecha >= hoy)
    .sort((a, b) => isoPautado(a).localeCompare(isoPautado(b)))
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

/* ───────────── Texto ───────────── */
/** Minúsculas y sin tildes para buscar. */
export const normaliza = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* ───────────── Configuración y vínculo ───────────── */
/** Días sin visita tras los que se considera atrasado el seguimiento (parámetro de Configuracion_Cuenta). */
export function useUmbralSinVisita(): number {
  const { org } = useSession()
  const user = useUser()
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  return useMemo(() => configOrg({ catalogos, configuracion }, org?.id ?? user.orgId).diasSinVisitaAlerta, [catalogos, configuracion, org, user])
}

/** Nombre del tipo de vínculo del usuario con el adulto (Tipo_vinculo), p. ej. "Familiar responsable". */
export function useVinculo(adultoId: string | undefined): string | undefined {
  const user = useUser()
  const vinculos = useDB((s) => s.vinculos)
  const tipos = useDB((s) => s.catalogos.tiposVinculo)
  return useMemo(() => {
    const v = vinculos.find((x) => x.adultoId === adultoId && x.usuarioId === user.id)
    return v ? (tipos.find((t) => t.id === v.tipoVinculoId)?.nombre ?? 'Familiar responsable') : undefined
  }, [vinculos, tipos, adultoId, user])
}

/* ───────────── Hooks de alcance ───────────── */
/** Adultos del grupo familiar del usuario en sesión (adultosVisibles). */
export function useAdultosFamilia(): Adulto[] {
  const user = useUser()
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  return useMemo(() => adultosVisibles(user, adultos, vinculos), [adultos, user, vinculos])
}

/**
 * Devuelve el adulto solo si el usuario puede consultarlo (alcanzaAdulto). Un id de otro grupo familiar
 * (por ejemplo escrito en la URL) devuelve undefined → "No encontrado o sin permiso".
 */
export function useAdultoPropio(adultoId: string | undefined): Adulto | undefined {
  const user = useUser()
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  return useMemo(() => {
    const a = adultos.find((x) => x.id === adultoId)
    return a && puede(user, 'adultos:ver') && alcanzaAdulto(user, a, vinculos) ? a : undefined
  }, [adultos, adultoId, user, vinculos])
}
