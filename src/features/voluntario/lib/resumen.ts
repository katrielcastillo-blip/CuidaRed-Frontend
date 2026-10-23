/*
 * resumen.ts — Datos de seguimiento de los adultos asignados al voluntario (tabla Vinculo, «voluntario
 * asignado»): días sin visita (RF-05, umbral del parámetro DIAS_SIN_VISITA_ALERTA de Configuracion_Cuenta) y
 * necesidades pendientes (RF-03), para priorizar el trabajo de campo.
 * Módulo: voluntario.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { useSession } from '@/domain/auth'
import { adultosVisibles } from '@/domain/permisos'
import { diasSinVisita } from '@/domain/reglas'
import { configOrg } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { RIESGO_PESO } from '@/features/visitas/lib/dominio'

export interface ResumenAdulto {
  adulto: Adulto
  /** Días calendario desde la última visita completada (o desde el alta si nunca fue visitado). */
  dias: number
  conVisitas: boolean
  /** Necesidades en estado "pendiente" o "en proceso". */
  pendientes: number
  /** Supera el umbral de días sin visita de la organización (RF-05). */
  atrasado: boolean
}

/** "Hoy" · "Hace 1 día" · "Hace 12 días" · "Sin visitas (12 días)". */
export function textoDias(r: Pick<ResumenAdulto, 'dias' | 'conVisitas'>) {
  if (!r.conVisitas) return `Sin visitas (${r.dias} d)`
  if (r.dias === 0) return 'Hoy'
  return `Hace ${r.dias} ${r.dias === 1 ? 'día' : 'días'}`
}

/**
 * Adultos activos visibles para el usuario (al voluntario solo los asignados, RBAC) con su resumen,
 * ordenados por prioridad: riesgo, luego días sin visita.
 */
export function useMisAdultos(): ResumenAdulto[] {
  const { user } = useSession()
  const adultos = useDB((s) => s.adultos)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const vinculos = useDB((s) => s.vinculos)
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  const umbral = useMemo(() => configOrg({ catalogos, configuracion }, user?.orgId).diasSinVisitaAlerta, [catalogos, configuracion, user?.orgId])
  return useMemo(() => {
    const ahora = new Date()
    return adultosVisibles(user, adultos, vinculos)
      .filter((a) => a.estado === 'activo')
      .map((adulto) => {
        const { dias, conVisitas } = diasSinVisita({ visitas }, adulto, ahora)
        const pendientes = necesidades.filter((n) => n.adultoId === adulto.id && (n.estado === 'pendiente' || n.estado === 'en_proceso')).length
        return { adulto, dias, conVisitas, pendientes, atrasado: dias > umbral }
      })
      .sort((a, b) => RIESGO_PESO[a.adulto.riesgo] - RIESGO_PESO[b.adulto.riesgo] || b.dias - a.dias || a.adulto.nombre.localeCompare(b.adulto.nombre))
  }, [user, adultos, vinculos, visitas, necesidades, umbral])
}
