/*
 * servicios.ts — Operaciones de visitas que aún no existen en la capa de servicios del dominio.
 * Siguen el mismo patrón que domain/api: comprobar conexión, permiso y alcance (verificar), escribir en el
 * servidor simulado (mutate) y dejar rastro en auditoría.
 * Módulo: visitas (RF-02 · RF-09).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { auditar } from '@/domain/auditoria'
import { ERROR_NO_ENCONTRADO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from '@/domain/api'
import { tieneVinculo } from '@/domain/relaciones'
import { getDB, mutate } from '@/domain/store'
import type { Usuario, Visita } from '@/domain/types'

/**
 * Cambia el responsable de una visita programada (coordinador). Requiere conexión.
 * Si el nuevo responsable es un voluntario sin vínculo «voluntario asignado» con el adulto, se crea el vínculo
 * (tabla Vinculo), igual que programarVisita, para que pueda ver al adulto y registrar la visita.
 */
export function reasignarVisita(actor: Usuario, visitaId: string, responsableId: string): Resultado<Visita> {
  const offline = sinConexion()
  if (offline) return offline
  const db = getDB()
  const v = db.visitas.find((x) => x.id === visitaId)
  if (!v) return fallo(ERROR_NO_ENCONTRADO)
  const adulto = db.adultos.find((a) => a.id === v.adultoId)
  const denegado = verificar(actor, 'visitas:programar', 'visita', adulto, visitaId)
  if (denegado) return denegado
  if (v.estado !== 'pendiente' && v.estado !== 'en_curso') return fallo('Solo se pueden reasignar visitas que no se han cerrado.')
  const responsable = db.usuarios.find(
    (u) => u.id === responsableId && u.estado === 'activo' && u.orgId === actor.orgId && (u.rol === 'voluntario' || u.rol === 'coordinador'),
  )
  if (!responsable) return fallo(ERROR_VALIDACION, { responsable: 'Selecciona un voluntario o coordinador activo.' })
  if (responsable.id === v.cuidadorId) return exito(v)

  const ahora = new Date().toISOString()
  const nueva: Visita = { ...v, cuidadorId: responsable.id, actualizadoEn: ahora, actualizadoPor: actor.id }
  delete nueva.pendienteSync
  mutate((draft) => {
    const i = draft.visitas.findIndex((x) => x.id === visitaId)
    if (i >= 0) draft.visitas[i] = nueva
    if (responsable.rol === 'voluntario' && !tieneVinculo(draft.vinculos, responsable.id, v.adultoId, 'voluntario_asignado')) {
      draft.vinculos.push({ adultoId: v.adultoId, usuarioId: responsable.id, tipoVinculoId: 'voluntario_asignado', creadoEn: ahora })
    }
    auditar(draft, actor, { accion: 'visita.reasignar', entidad: 'visita', registroId: visitaId, detalle: `Nuevo responsable ${responsable.id}` })
  })
  return exito(nueva)
}
