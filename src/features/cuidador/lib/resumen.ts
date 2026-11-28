/*
 * resumen.ts — Datos de seguimiento del cuidador en su cuenta activa (V2 §Cuidador): adultos con vínculo
 * «cuidador asignado», días sin visita realizada (RF-05, umbral del parámetro DIAS_SIN_VISITA_ALERTA),
 * necesidades pendientes (RF-03), alertas abiertas (RF-04) y las tareas y visitas que le corresponden.
 * Todo se limita a los adultos visibles en la cuenta activa: si el usuario también trabaja en otra cuenta
 * (Organización / Familia), sus adultos, visitas y tareas no se mezclan.
 * Módulo: cuidador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { useSession } from '@/domain/auth'
import { adultosVisibles, puede } from '@/domain/permisos'
import { diasSinVisita } from '@/domain/reglas'
import { configOrg, cuidadorDeUsuario } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto, Riesgo, Tarea, Visita } from '@/domain/types'
import { normalizar, RIESGO_PESO } from '@/features/visitas/lib/dominio'

export interface ResumenAdulto {
  adulto: Adulto
  /** Días calendario desde la última visita completada (o desde el alta si nunca fue visitado). */
  dias: number
  conVisitas: boolean
  /** Necesidades en estado "pendiente" o "en proceso". */
  pendientes: number
  /** Alertas sin atender (pendientes o en atención). */
  alertas: number
  /** Supera el umbral de días sin visita de la organización (RF-05). */
  atrasado: boolean
  /** Por qué conviene atender hoy a esta persona (riesgo alto, alertas, medicamentos, días sin visita). */
  motivos: string[]
  /** Tiene al menos un motivo de atención prioritaria. */
  prioritario: boolean
}

/** "Hoy" · "Hace 1 día" · "Hace 12 días" · "Sin visitas (12 d)". */
export function textoDias(r: Pick<ResumenAdulto, 'dias' | 'conVisitas'>) {
  if (!r.conVisitas) return `Sin visitas (${r.dias} d)`
  if (r.dias === 0) return 'Hoy'
  return `Hace ${r.dias} ${r.dias === 1 ? 'día' : 'días'}`
}

/** Umbral de días sin visita (parámetro de la cuenta activa). */
export function useUmbralSinVisita(): number {
  const { user } = useSession()
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  return useMemo(() => configOrg({ catalogos, configuracion }, user?.orgId).diasSinVisitaAlerta, [catalogos, configuracion, user?.orgId])
}

/**
 * Adultos activos asignados al usuario en la cuenta activa (alcance RBAC: tabla Vinculo + cuenta) con su resumen,
 * ordenados por prioridad: riesgo, luego días sin visita.
 */
export function useMisAdultos(): ResumenAdulto[] {
  const { user } = useSession()
  const adultos = useDB((s) => s.adultos)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const alertas = useDB((s) => s.alertas)
  const vinculos = useDB((s) => s.vinculos)
  const umbral = useUmbralSinVisita()
  return useMemo(() => {
    const verAlertas = puede(user, 'alertas:ver')
    const abiertasPor = new Map<string, number>()
    if (verAlertas) for (const a of alertas) if (a.estado !== 'atendida') abiertasPor.set(a.adultoId, (abiertasPor.get(a.adultoId) ?? 0) + 1)
    return adultosVisibles(user, adultos, vinculos)
      .filter((a) => a.estado === 'activo')
      .map((adulto): ResumenAdulto => {
        const { dias, conVisitas } = diasSinVisita({ visitas }, adulto)
        const suyas = necesidades.filter((n) => n.adultoId === adulto.id)
        const pendientes = suyas.filter((n) => n.estado === 'pendiente' || n.estado === 'en_proceso').length
        const alertasAbiertas = abiertasPor.get(adulto.id) ?? 0
        const atrasado = dias > umbral
        const motivos: string[] = []
        if (adulto.riesgo === 'alto') motivos.push('Riesgo alto')
        if (alertasAbiertas > 0) motivos.push(alertasAbiertas === 1 ? '1 alerta abierta' : `${alertasAbiertas} alertas abiertas`)
        if (suyas.some((n) => n.tipo === 'medicamentos' && n.estado === 'pendiente')) motivos.push('Medicamentos pendientes')
        if (atrasado) motivos.push(conVisitas ? `${dias} días sin visita` : 'Sin visitas realizadas')
        return { adulto, dias, conVisitas, pendientes, alertas: alertasAbiertas, atrasado, motivos, prioritario: motivos.length > 0 }
      })
      .sort((a, b) => RIESGO_PESO[a.adulto.riesgo] - RIESGO_PESO[b.adulto.riesgo] || b.dias - a.dias || a.adulto.nombre.localeCompare(b.adulto.nombre))
  }, [user, adultos, vinculos, visitas, necesidades, alertas, umbral])
}

/** Personas que requieren atención primero: más motivos, luego mayor riesgo y más días sin visita. */
export const prioritarios = (lista: ResumenAdulto[]) =>
  lista
    .filter((r) => r.prioritario)
    .sort((a, b) => b.motivos.length - a.motivos.length || RIESGO_PESO[a.adulto.riesgo] - RIESGO_PESO[b.adulto.riesgo] || b.dias - a.dias)

/** Identificadores de los adultos que el usuario puede consultar en la cuenta activa. */
function useIdsVisibles(): Set<string> {
  const { user } = useSession()
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  return useMemo(() => new Set(adultosVisibles(user, adultos, vinculos).map((a) => a.id)), [user, adultos, vinculos])
}

/**
 * Tareas de la agenda del cuidador en la cuenta activa. `Tarea.cuidadorId` es el id del perfil Cuidador (no del
 * usuario) y solo cuentan las de adultos asignados en esta cuenta: así no se mezclan con las de otra cuenta.
 */
export function useMisTareas(): Tarea[] {
  const { user } = useSession()
  const tareas = useDB((s) => s.tareas)
  const cuidadores = useDB((s) => s.cuidadores)
  const ids = useIdsVisibles()
  return useMemo(() => {
    const perfil = user ? cuidadorDeUsuario(cuidadores, user.id) : undefined
    if (!perfil) return []
    return tareas.filter((t) => t.cuidadorId === perfil.id && ids.has(t.adultoId))
  }, [user, tareas, cuidadores, ids])
}

/** Visitas de las que el usuario es responsable, de adultos asignados en la cuenta activa. */
export function useMisVisitas(): Visita[] {
  const { user } = useSession()
  const visitas = useDB((s) => s.visitas)
  const ids = useIdsVisibles()
  return useMemo(() => (user ? visitas.filter((v) => v.cuidadorId === user.id && ids.has(v.adultoId)) : []), [user, visitas, ids])
}

/* ───────────── Filtros de «Mis adultos» ───────────── */

export interface FiltrosAdultos {
  /** Texto buscado en nombre o cédula. */
  q: string
  riesgo: Riesgo | 'todos'
  /** Solo con alertas abiertas. */
  conAlertas: boolean
  /** Solo los que superan el umbral de días sin visita. */
  atrasados: boolean
}

export function filtrarAdultos(lista: ResumenAdulto[], f: FiltrosAdultos): ResumenAdulto[] {
  const t = normalizar(f.q)
  const digitos = t.replace(/\D/g, '')
  return lista.filter(({ adulto: a, alertas, atrasado }) => {
    if (f.riesgo !== 'todos' && a.riesgo !== f.riesgo) return false
    if (f.conAlertas && alertas === 0) return false
    if (f.atrasados && !atrasado) return false
    if (!t) return true
    return (
      normalizar(`${a.nombre} ${a.apellido}`).includes(t) ||
      normalizar(a.cedula).includes(t) ||
      (digitos.length > 0 && a.cedula.replace(/\D/g, '').includes(digitos))
    )
  })
}
