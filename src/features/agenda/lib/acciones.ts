/*
 * acciones.ts — Acciones sobre tareas y evidencias con su retroalimentación (toast), compartidas por la agenda, el
 * detalle de la tarea y la bandeja de evidencias por validar. Todas pasan por la capa de servicios (domain/api).
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useToast } from '@/components/ui'
import { cambiarEstadoTarea, cancelarTarea, validarEvidencia, type Resultado } from '@/domain/api'
import { useUser } from '@/domain/auth'
import type { EstadoTarea, Evidencia, Tarea } from '@/domain/types'

export function useAccionesTarea() {
  const user = useUser()
  const toast = useToast()

  /** Inicia o completa una tarea. Devuelve true si el cambio se aplicó. */
  const cambiar = (t: Pick<Tarea, 'id'>, estado: EstadoTarea): boolean => {
    const r = cambiarEstadoTarea(user, t.id, estado)
    if (!r.ok) {
      toast(r.error, 'error')
      return false
    }
    const textos: Record<EstadoTarea, string> = {
      pendiente: 'Tarea reabierta.',
      en_curso: 'Tarea iniciada.',
      completada: 'Tarea completada.',
      cancelada: 'Tarea cancelada.',
    }
    toast(textos[estado], 'ok')
    return true
  }

  /** Cancela la tarea o, con 'siguientes', esta y las siguientes de su serie. */
  const cancelar = (t: Pick<Tarea, 'id'>, alcance: 'esta' | 'siguientes' = 'esta'): boolean => {
    const r = cancelarTarea(user, t.id, alcance)
    if (!r.ok) {
      toast(r.error, 'error')
      return false
    }
    toast(r.valor > 1 ? `Se cancelaron ${r.valor} tareas.` : 'Tarea cancelada.', 'ok')
    return true
  }

  /** Valida una evidencia pendiente. */
  const validar = (e: Pick<Evidencia, 'id'>): boolean => {
    const r = validarEvidencia(user, e.id, 'validada')
    if (!r.ok) {
      toast(r.error, 'error')
      return false
    }
    toast(r.valor.tareaCompletada ? 'Evidencia validada. La tarea quedó completada y se avisó al cuidador.' : 'Evidencia validada. Se avisó al cuidador.', 'ok')
    return true
  }

  /** Rechaza una evidencia pendiente con su motivo (obligatorio). Devuelve el resultado para mostrar el error junto al campo. */
  const rechazar = (e: Pick<Evidencia, 'id'>, motivo: string): Resultado<{ tareaCompletada: boolean }> => {
    const r = validarEvidencia(user, e.id, 'rechazada', motivo)
    if (r.ok) toast('Evidencia rechazada. Se avisó al cuidador con el motivo.', 'info')
    else if (!r.errores) toast(r.error, 'error')
    return r
  }

  return { cambiar, cancelar, validar, rechazar }
}
