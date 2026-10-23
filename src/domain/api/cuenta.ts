/*
 * cuenta.ts — Servicios de suscripción (Cuenta, Plan, Pago), perfiles de cuidador (Cuidador) y notificaciones
 * (Notificacion) del modelo de datos V3.0.
 * La monetización NO es parte del MVP (SRS §8.1): aquí no hay cobros reales; el administrador solo registra
 * el plan contratado y los pagos recibidos por otros medios.
 * Módulo: dominio · servicios.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { auditar } from '../auditoria'
import { getDB, mutate, uid } from '../store'
import type { Cuidador, Pago, Usuario } from '../types'
import { fechaValida, hayErrores } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from './comun'

/* ───────────── Plan y pagos ───────────── */

/** Cambia el plan de la cuenta. Plan_Precio se copia del plan (desnormalización del modelo). */
export function cambiarPlan(actor: Usuario, planId: string): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'cuenta:suscripcion', 'pago')
  if (denegado) return denegado
  const plan = getDB().catalogos.planes.find((p) => p.id === planId && p.estado === 'activo')
  if (!plan) return fallo('Selecciona un plan disponible.')
  mutate((db) => {
    const o = db.orgs.find((x) => x.id === actor.orgId)
    if (!o) return
    const anterior = o.planId
    o.planId = plan.id
    o.planPrecio = plan.precio
    if (plan.precio === 0) o.suscripcionEstado = 'activa'
    db.notificaciones.push({ id: uid('nt'), usuarioId: actor.id, fecha: new Date().toISOString(), mensaje: `Plan actualizado a «${plan.nombre}».`, planId: plan.id, orgId: o.id, estado: 'no_leida' })
    auditar(db, actor, { accion: 'pago.plan', entidad: 'pago', registroId: o.id, detalle: `${anterior} → ${plan.id}` })
  })
  return exito(undefined)
}

export interface DatosPago {
  monto: string
  metodoPagoId: string
  fecha: string // YYYY-MM-DD
  referencia: string
}

/** Registra un pago recibido (sin pasarela: solo deja constancia). */
export function registrarPago(actor: Usuario, d: DatosPago): Resultado<Pago> {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'cuenta:suscripcion', 'pago')
  if (denegado) return denegado
  const db = getDB()
  const org = db.orgs.find((o) => o.id === actor.orgId)
  if (!org) return fallo(ERROR_NO_ENCONTRADO)
  const errores = {
    monto: Number(d.monto) > 0 && Number(d.monto) <= 1_000_000 ? undefined : 'Indica un monto válido.',
    metodoPagoId: db.catalogos.metodosPago.some((m) => m.id === d.metodoPagoId && m.activo) ? undefined : 'Selecciona el método de pago.',
    fecha: fechaValida(d.fecha) ? undefined : 'Indica la fecha del pago.',
    referencia: d.referencia.length > 40 ? 'Máximo 40 caracteres.' : undefined,
  }
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  const pago: Pago = {
    id: uid('pg'),
    orgId: org.id,
    planId: org.planId,
    usuarioId: actor.id,
    monto: Number(d.monto),
    metodoPagoId: d.metodoPagoId,
    estado: 'registrado',
    fecha: new Date(`${d.fecha}T12:00:00`).toISOString(),
    ...(d.referencia.trim() ? { referencia: d.referencia.trim() } : {}),
  }
  mutate((draft) => {
    draft.pagos.push(pago)
    auditar(draft, actor, { accion: 'pago.registrar', entidad: 'pago', registroId: pago.id, detalle: `${pago.monto} · ${pago.metodoPagoId}` })
  })
  return exito(pago)
}

/** Confirma o anula un pago registrado. Confirmar un pago deja la suscripción activa. */
export function cambiarEstadoPago(actor: Usuario, pagoId: string, estado: 'confirmado' | 'anulado'): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'cuenta:suscripcion', 'pago')
  if (denegado) return denegado
  if (!getDB().pagos.some((p) => p.id === pagoId && p.orgId === actor.orgId)) return fallo(ERROR_NO_ENCONTRADO)
  mutate((db) => {
    const p = db.pagos.find((x) => x.id === pagoId)
    if (!p) return
    p.estado = estado
    const o = db.orgs.find((x) => x.id === p.orgId)
    if (o && estado === 'confirmado') o.suscripcionEstado = 'activa'
    auditar(db, actor, { accion: 'pago.estado', entidad: 'pago', registroId: pagoId, detalle: estado })
  })
  return exito(undefined)
}

/* ───────────── Cuidadores ───────────── */

export interface DatosCuidador {
  tipoCuidadoId: string
  fechaInicio: string
  fechaFin: string
  independiente: boolean
  empleadorUsuarioId: string
}

/** Crea o actualiza el perfil de cuidador de un usuario (tabla Cuidador). */
export function guardarCuidador(actor: Usuario, usuarioId: string, d: DatosCuidador): Resultado<Cuidador> {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'cuidadores:gestionar', 'usuario', undefined, usuarioId)
  if (denegado) return denegado
  const db = getDB()
  if (!db.usuarios.some((u) => u.id === usuarioId && u.orgId === actor.orgId)) return fallo(ERROR_NO_ENCONTRADO)
  const errores = {
    tipoCuidadoId: db.catalogos.tiposCuidado.some((t) => t.id === d.tipoCuidadoId) ? undefined : 'Selecciona el tipo de cuidado.',
    fechaInicio: fechaValida(d.fechaInicio) ? undefined : 'Indica la fecha de inicio.',
    fechaFin: d.fechaFin && (!fechaValida(d.fechaFin) || d.fechaFin < d.fechaInicio) ? 'La fecha de fin debe ser posterior al inicio.' : undefined,
    empleadorUsuarioId: !d.independiente && !db.usuarios.some((u) => u.id === d.empleadorUsuarioId && u.id !== usuarioId) ? 'Indica quién lo emplea o márcalo como independiente.' : undefined,
  }
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  let guardado: Cuidador | undefined
  mutate((draft) => {
    const datos = {
      tipoCuidadoId: d.tipoCuidadoId,
      fechaInicio: d.fechaInicio,
      fechaFin: d.fechaFin || undefined,
      independiente: d.independiente,
      empleadorUsuarioId: d.independiente ? undefined : d.empleadorUsuarioId,
    }
    const existente = draft.cuidadores.find((c) => c.usuarioId === usuarioId)
    if (existente) {
      Object.assign(existente, datos)
      guardado = existente
    } else {
      guardado = { id: uid('cu'), usuarioId, ...datos }
      draft.cuidadores.push(guardado)
    }
    auditar(draft, actor, { accion: 'usuario.cuidador', entidad: 'usuario', registroId: usuarioId })
  })
  return guardado ? exito(guardado) : fallo(ERROR_NO_ENCONTRADO)
}

/* ───────────── Notificaciones ───────────── */

/** Marca notificaciones del usuario como leídas (Estado + Fecha_lectura) y las alertas relacionadas como vistas. */
export function marcarNotificacionesLeidas(actor: Usuario, ids: string[]) {
  const db = getDB()
  const pendientes = db.notificaciones.filter((n) => ids.includes(n.id) && n.usuarioId === actor.id && n.estado === 'no_leida')
  if (pendientes.length === 0) return
  mutate(
    (draft) => {
      const ahora = new Date().toISOString()
      for (const n of draft.notificaciones) {
        if (ids.includes(n.id) && n.usuarioId === actor.id && n.estado === 'no_leida') {
          n.estado = 'leida'
          n.fechaLectura = ahora
          const al = n.alertaId ? draft.alertas.find((a) => a.id === n.alertaId) : undefined
          if (al && !al.leidaPor.includes(actor.id)) al.leidaPor.push(actor.id)
        }
      }
    },
    { silencioso: true },
  )
}
