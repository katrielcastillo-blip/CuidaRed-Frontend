/*
 * cuenta.ts — Servicios de suscripción (Cuenta, Plan, Pago), perfiles de cuidador (Cuidador) y notificaciones
 * (Notificacion) del modelo de datos V3.0.
 * Reglas de Negocio V2: la cuenta (Familia u Organización) es quien tiene el plan; solo su titular (User_Titular)
 * contrata y paga, y un plan solo se contrata para el tipo de cuenta al que aplica. En el MVP no hay cobros
 * reales: el pago es simulado (se aprueba al instante y no se piden datos de tarjeta); la pasarela llegará con el backend.
 * Módulo: dominio · servicios.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { auditar } from '../auditoria'
import { planesCompatibles } from '../planes'
import { getDB, mutate, uid } from '../store'
import type { Cuidador, DB, Organizacion, Pago, Plan, Usuario } from '../types'
import { fechaValida, hayErrores } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from './comun'

/* ───────────── Plan y pagos ───────────── */

export const ERROR_NO_TITULAR = 'Solo la persona titular de la cuenta puede contratar o pagar un plan.'
const ERROR_PLAN = 'Selecciona un plan disponible para tu tipo de cuenta.'

/** ¿Es el usuario la persona titular de la cuenta? (Cuenta.User_Titular) */
export const esTitularDeCuenta = (usuario: Pick<Usuario, 'id'> | null | undefined, org: Pick<Organizacion, 'usuarioTitularId'> | null | undefined) =>
  !!usuario && !!org && org.usuarioTitularId === usuario.id

/**
 * Comprobaciones comunes de contratar o pagar: hay conexión, el actor tiene el permiso `cuenta:suscripcion` y es la
 * persona titular de su cuenta activa. Los intentos de otro miembro quedan en auditoría como accesos denegados.
 */
function prepararCobro(actor: Usuario): Resultado<never> | { org: Organizacion } {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'cuenta:suscripcion', 'pago')
  if (denegado) return denegado
  const org = getDB().orgs.find((o) => o.id === actor.orgId)
  if (!org) return fallo(ERROR_NO_ENCONTRADO)
  if (!esTitularDeCuenta(actor, org)) {
    mutate((db) => auditar(db, actor, { accion: 'acceso.denegado', entidad: 'pago', registroId: org.id, resultado: 'denegado', detalle: 'Solo la persona titular puede contratar o pagar un plan' }), {
      silencioso: true,
    })
    return fallo(ERROR_NO_TITULAR)
  }
  return { org }
}

/** Plan activo que puede contratar la cuenta según su tipo (V2: un plan aplica a un único tipo de cuenta). */
const planContratable = (db: Pick<DB, 'catalogos'>, org: Organizacion, planId: string): Plan | undefined => planesCompatibles(db.catalogos, org).find((p) => p.id === planId)

/** Deja la suscripción activa con el plan pagado. Plan_Precio se copia del plan (desnormalización del modelo). Dentro de un mutate(). */
function activarSuscripcion(db: DB, actor: Usuario, orgId: string, plan: Plan, origen: string) {
  const o = db.orgs.find((x) => x.id === orgId)
  if (!o) return
  const anterior = o.planId || 'sin plan'
  o.planId = plan.id
  o.planPrecio = plan.precio
  o.suscripcionEstado = 'activa'
  db.notificaciones.push({
    id: uid('nt'),
    usuarioId: actor.id,
    fecha: new Date().toISOString(),
    mensaje: `Pago recibido. Tu cuenta quedó activa con el plan «${plan.nombre}».`,
    planId: plan.id,
    orgId: o.id,
    estado: 'no_leida',
  })
  auditar(db, actor, { accion: 'pago.plan', entidad: 'pago', registroId: o.id, detalle: `${anterior} → ${plan.id} · suscripción activa (${origen})` })
}

/**
 * Contrata (o cambia a) un plan con un pago simulado: el pago queda confirmado al instante, la suscripción pasa a
 * «activa» con el plan pagado y su vigencia depende de la periodicidad del plan (ver `vigenciaDelPago`).
 */
export function contratarPlan(actor: Usuario, planId: string, metodoPagoId: string): Resultado<Pago> {
  const previo = prepararCobro(actor)
  if (!('org' in previo)) return previo
  const { org } = previo
  const db = getDB()
  const plan = planContratable(db, org, planId)
  if (!plan) return fallo(ERROR_PLAN)
  if (!db.catalogos.metodosPago.some((m) => m.id === metodoPagoId && m.activo)) return fallo(ERROR_VALIDACION, { metodoPagoId: 'Selecciona el método de pago.' })
  const pago: Pago = {
    id: uid('pg'),
    orgId: org.id,
    planId: plan.id,
    usuarioId: actor.id,
    monto: plan.precio,
    metodoPagoId,
    estado: 'confirmado',
    fecha: new Date().toISOString(),
    referencia: `SIM-${Date.now().toString(36).toUpperCase().slice(-7)}`,
  }
  mutate((draft) => {
    draft.pagos.push(pago)
    auditar(draft, actor, { accion: 'pago.registrar', entidad: 'pago', registroId: pago.id, detalle: `Pago simulado ${pago.monto} · ${plan.id} · ${metodoPagoId} · confirmado` })
    activarSuscripcion(draft, actor, org.id, plan, 'pago simulado')
  })
  return exito(pago)
}

export interface DatosPago {
  monto: string
  metodoPagoId: string
  fecha: string // YYYY-MM-DD
  referencia: string
  /** Plan al que corresponde el pago; por defecto, el de la cuenta. */
  planId?: string
}

/** Registra un pago recibido por otro medio (queda «por confirmar»; no hay pasarela). */
export function registrarPago(actor: Usuario, d: DatosPago): Resultado<Pago> {
  const previo = prepararCobro(actor)
  if (!('org' in previo)) return previo
  const { org } = previo
  const db = getDB()
  const plan = planContratable(db, org, d.planId ?? org.planId)
  if (!plan) return fallo(ERROR_PLAN)
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
    planId: plan.id,
    usuarioId: actor.id,
    monto: Number(d.monto),
    metodoPagoId: d.metodoPagoId,
    estado: 'registrado',
    fecha: new Date(`${d.fecha}T12:00:00`).toISOString(),
    ...(d.referencia.trim() ? { referencia: d.referencia.trim() } : {}),
  }
  mutate((draft) => {
    draft.pagos.push(pago)
    auditar(draft, actor, { accion: 'pago.registrar', entidad: 'pago', registroId: pago.id, detalle: `${pago.monto} · ${plan.id} · ${pago.metodoPagoId}` })
  })
  return exito(pago)
}

/** Confirma o anula un pago «por confirmar». Confirmar un pago deja la suscripción activa con el plan pagado. */
export function cambiarEstadoPago(actor: Usuario, pagoId: string, estado: 'confirmado' | 'anulado'): Resultado {
  const previo = prepararCobro(actor)
  if (!('org' in previo)) return previo
  const { org } = previo
  const db = getDB()
  const pago = db.pagos.find((p) => p.id === pagoId && p.orgId === org.id)
  if (!pago) return fallo(ERROR_NO_ENCONTRADO)
  if (pago.estado !== 'registrado') return fallo('Solo se pueden confirmar o anular los pagos que están por confirmar.')
  const plan = estado === 'confirmado' ? planContratable(db, org, pago.planId) : undefined
  if (estado === 'confirmado' && !plan) return fallo(ERROR_PLAN)
  mutate((draft) => {
    const p = draft.pagos.find((x) => x.id === pagoId)
    if (!p) return
    p.estado = estado
    auditar(draft, actor, { accion: 'pago.estado', entidad: 'pago', registroId: pagoId, detalle: estado })
    if (plan) activarSuscripcion(draft, actor, org.id, plan, 'pago confirmado')
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
  // V2: la persona puede tener esta cuenta como secundaria; se valida por su membresía activa en la cuenta.
  const esMiembro = db.membresias.some((m) => m.usuarioId === usuarioId && m.orgId === actor.orgId && m.estado === 'activa')
  if (!esMiembro && !db.usuarios.some((u) => u.id === usuarioId && u.orgId === actor.orgId)) return fallo(ERROR_NO_ENCONTRADO)
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
