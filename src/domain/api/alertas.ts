/*
 * alertas.ts — Gestión de alertas (CU-09 paso 4 · CU-10) y notificaciones internas a coordinadores.
 * Módulo: dominio · servicios. La GENERACIÓN automática está en domain/reglas.ts.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { auditar } from '../auditoria'
import { ESTADOS_ALERTA } from '../catalogos'
import { adultosVisibles, puede } from '../permisos'
import { getDB, mutate, uid } from '../store'
import type { Alerta, DB, EstadoAlerta, Notificacion, Usuario } from '../types'
import { enLista } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from './comun'

/** Registra la acción tomada y actualiza el estado de la alerta. La nota es obligatoria al cerrarla. */
export function gestionarAlerta(actor: Usuario, alertaId: string, estado: EstadoAlerta, nota: string): Resultado<Alerta> {
  const offline = sinConexion()
  if (offline) return offline
  const db = getDB()
  const al = db.alertas.find((x) => x.id === alertaId)
  if (!al) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'alertas:gestionar', 'alerta', db.adultos.find((a) => a.id === al.adultoId), alertaId)
  if (denegado) return denegado
  if (!enLista(estado, ESTADOS_ALERTA.map((e) => e.value))) return fallo('Estado no válido.')
  const texto = nota.trim()
  if (estado === 'atendida' && texto.length < 5) return fallo(ERROR_VALIDACION, { nota: 'Describe la acción tomada (mínimo 5 caracteres).' })
  if (texto.length > 500) return fallo(ERROR_VALIDACION, { nota: 'Máximo 500 caracteres.' })
  if (estado === al.estado && !texto) return fallo(ERROR_VALIDACION, { nota: 'Escribe la acción tomada o cambia el estado.' })

  let resultado: Alerta | undefined
  mutate((draft) => {
    const x = draft.alertas.find((y) => y.id === alertaId)
    if (!x) return
    const ahora = new Date().toISOString()
    const anterior = x.estado
    x.estado = estado
    x.acciones.push({ id: uid('ac'), fecha: ahora, usuarioId: actor.id, estado, nota: texto || `Estado cambiado a ${ESTADOS_ALERTA.find((e) => e.value === estado)?.label}` })
    if (estado === 'atendida') {
      x.atendidaPor = actor.id
      x.atendidaEn = ahora
      x.notaAtencion = texto
    } else {
      delete x.atendidaPor
      delete x.atendidaEn
    }
    if (!x.leidaPor.includes(actor.id)) x.leidaPor.push(actor.id)
    x.actualizadoEn = ahora
    resultado = x
    auditar(draft, actor, { accion: 'alerta.gestionar', entidad: 'alerta', registroId: alertaId, detalle: `${anterior} → ${estado}` })
  })
  return resultado ? exito(resultado) : fallo(ERROR_NO_ENCONTRADO)
}

/** Alertas que el usuario puede ver (según rol y alcance). */
export function alertasVisibles(db: Pick<DB, 'alertas' | 'adultos'>, u: Usuario | null): Alerta[] {
  if (!u || !puede(u, 'alertas:ver')) return []
  const ids = new Set(adultosVisibles(u, db.adultos).map((a) => a.id))
  return db.alertas.filter((a) => ids.has(a.adultoId))
}

/** Notificaciones del usuario (tabla Notificacion), las más recientes primero. */
export function notificacionesDe(db: Pick<DB, 'notificaciones'>, u: Usuario | null): Notificacion[] {
  if (!u) return []
  return db.notificaciones.filter((n) => n.usuarioId === u.id).sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/** Notificaciones sin leer del usuario. */
export function notificacionesSinLeer(db: Pick<DB, 'notificaciones'>, u: Usuario | null): Notificacion[] {
  return notificacionesDe(db, u).filter((n) => n.estado === 'no_leida')
}

/** Marca alertas como vistas por el usuario (al abrir el detalle) y sus notificaciones como leídas. */
export function marcarLeidas(actor: Usuario, alertaIds: string[]) {
  const db = getDB()
  const hayAlertas = db.alertas.some((a) => alertaIds.includes(a.id) && !a.leidaPor.includes(actor.id))
  const hayNotifs = db.notificaciones.some((n) => n.usuarioId === actor.id && n.estado === 'no_leida' && n.alertaId && alertaIds.includes(n.alertaId))
  if (!hayAlertas && !hayNotifs) return
  mutate(
    (draft) => {
      const ahora = new Date().toISOString()
      for (const a of draft.alertas) if (alertaIds.includes(a.id) && !a.leidaPor.includes(actor.id)) a.leidaPor.push(actor.id)
      for (const n of draft.notificaciones) {
        if (n.usuarioId === actor.id && n.estado === 'no_leida' && n.alertaId && alertaIds.includes(n.alertaId)) {
          n.estado = 'leida'
          n.fechaLectura = ahora
        }
      }
    },
    { silencioso: true },
  )
}
