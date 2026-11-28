/*
 * solicitudes.ts — Solicitudes de visita de personas externas (visitante / voluntario ocasional).
 * Módulo: dominio · servicios (Reglas de Negocio V2 §Usuario y §Visita · feedback de PM sobre LOGIN SCREEN).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Flujo:
 *  1. El visitante, sin cuenta, llena "Solicitar una visita" en la página de bienvenida: elige la organización y
 *     escribe a quién quiere visitar. Recibe un código de seguimiento (solo se guarda su hash).
 *  2. Un usuario principal de la cuenta (Administrador o Coordinador: permiso visitas:autorizar) confirma el adulto
 *     y la autoriza, o la rechaza con motivo. Al autorizar se crea la Visita programada.
 *  3. Con el código, el visitante consulta el resultado y, el día de la visita o después, deja su observación:
 *     la visita queda realizada (cuenta como contacto efectivo).
 * Privacidad: al público solo se listan organizaciones (no familias) y nunca perfiles de adultos mayores.
 */
import { auditar } from '../auditoria'
import { todayISO } from '../dates'
import { tipoDeCuenta } from '../planes'
import { hashSecreto, SAL_CODIGOS } from '../seguridad'
import { getDB, mutate, uid } from '../store'
import type { DB, Organizacion, SolicitudVisita, Usuario, Visita } from '../types'
import { errorCedula, errorEmail, errorNombre, errorTelefono, errorTexto, fechaValida, hayErrores } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from './comun'

export interface DatosSolicitudVisita {
  orgId: string
  nombres: string
  apellidos: string
  cedula: string
  telefono: string
  correo: string
  personaAVisitar: string
  fechaPropuesta: string
  horaPropuesta: string
  motivo: string
}

export const SOLICITUD_VACIA: DatosSolicitudVisita = {
  orgId: '',
  nombres: '',
  apellidos: '',
  cedula: '',
  telefono: '',
  correo: '',
  personaAVisitar: '',
  fechaPropuesta: '',
  horaPropuesta: '',
  motivo: '',
}

export const ESTADO_SOLICITUD: Record<SolicitudVisita['estado'], string> = {
  pendiente: 'Pendiente de autorización',
  autorizada: 'Autorizada',
  rechazada: 'No autorizada',
  realizada: 'Visita realizada',
  cancelada: 'Cancelada',
}

/** Organizaciones que reciben solicitudes públicas (las cuentas Familia no se listan por privacidad). */
export const organizacionesPublicas = (orgs: Organizacion[]) =>
  orgs.filter((o) => tipoDeCuenta(o) === 'organizacion' && o.suscripcionEstado !== 'cancelada').sort((a, b) => a.nombre.localeCompare(b.nombre))

/** La fecha propuesta no puede ser anterior a hoy. */
function errorFechaFutura(v: string): string | undefined {
  if (!fechaValida(v)) return 'Indica una fecha válida.'
  if (v < todayISO()) return 'La fecha no puede ser anterior a hoy.'
  return undefined
}

export function validarSolicitud(d: DatosSolicitudVisita) {
  return {
    orgId: d.orgId ? undefined : 'Elige la organización.',
    nombres: errorNombre(d.nombres, 'nombre'),
    apellidos: errorNombre(d.apellidos, 'apellido'),
    cedula: errorCedula(d.cedula),
    telefono: errorTelefono(d.telefono),
    correo: d.correo.trim() ? errorEmail(d.correo) : undefined,
    personaAVisitar: errorTexto(d.personaAVisitar, 'el nombre de la persona que quieres visitar', 3, 120),
    fechaPropuesta: errorFechaFutura(d.fechaPropuesta),
    horaPropuesta: /^\d{2}:\d{2}$/.test(d.horaPropuesta) ? undefined : 'Indica la hora.',
    motivo: errorTexto(d.motivo, 'el motivo de la visita', 3, 300),
  }
}

/** Código de seguimiento legible y difícil de adivinar: "VIS-7K2M-Q9TX" (sin 0/O/1/I). */
function nuevoCodigoSeguimiento(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const c = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
  return `VIS-${c.slice(0, 4)}-${c.slice(4)}`
}

const normalizarCodigo = (codigo: string) => codigo.trim().toUpperCase().replace(/\s+/g, '')
const hashCodigo = (codigo: string) => hashSecreto(normalizarCodigo(codigo), SAL_CODIGOS)

/** Crea la solicitud (pública, sin sesión). Devuelve el código de seguimiento, que se muestra una sola vez. */
export async function crearSolicitudVisita(d: DatosSolicitudVisita): Promise<Resultado<{ codigo: string; solicitud: SolicitudVisita }>> {
  const offline = sinConexion()
  if (offline) return offline
  const errores = validarSolicitud(d)
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  const org = organizacionesPublicas(getDB().orgs).find((o) => o.id === d.orgId)
  if (!org) return fallo(ERROR_VALIDACION, { orgId: 'Elige una organización de la lista.' })
  const codigo = nuevoCodigoSeguimiento()
  const solicitud: SolicitudVisita = {
    id: uid('sv'),
    orgId: org.id,
    visitante: {
      nombres: d.nombres.trim(),
      apellidos: d.apellidos.trim(),
      cedula: d.cedula.trim(),
      telefono: d.telefono.trim(),
      ...(d.correo.trim() ? { correo: d.correo.trim().toLowerCase() } : {}),
    },
    personaAVisitar: d.personaAVisitar.trim(),
    fechaPropuesta: d.fechaPropuesta,
    horaPropuesta: d.horaPropuesta,
    motivo: d.motivo.trim(),
    estado: 'pendiente',
    codigoHash: await hashCodigo(codigo),
    creadaEn: new Date().toISOString(),
  }
  mutate((db) => {
    db.solicitudesVisita.push(solicitud)
    // Aviso a los usuarios principales de la cuenta (sin datos del adulto: aún no está confirmado).
    const principales = db.membresias.filter((m) => m.orgId === org.id && m.estado === 'activa' && (m.rol === 'admin' || m.rol === 'coordinador'))
    for (const m of principales) {
      db.notificaciones.push({
        id: uid('nt'),
        usuarioId: m.usuarioId,
        orgId: org.id,
        fecha: solicitud.creadaEn,
        mensaje: `Nueva solicitud de visita de ${solicitud.visitante.nombres} ${solicitud.visitante.apellidos} para el ${solicitud.fechaPropuesta}.`,
        estado: 'no_leida',
      })
    }
    auditar(db, { anonimo: solicitud.visitante.cedula }, { accion: 'solicitud.crear', entidad: 'solicitud', registroId: solicitud.id, orgId: org.id })
  })
  return exito({ codigo, solicitud })
}

/** Lo que el visitante puede ver de su solicitud (sin datos del adulto mayor ni del personal). */
export interface EstadoPublicoSolicitud {
  id: string
  organizacion: string
  estado: SolicitudVisita['estado']
  estadoTexto: string
  fechaPropuesta: string
  horaPropuesta: string
  motivoRechazo?: string
  puedeRegistrarObservacion: boolean
  observacion?: string
}

async function buscarPorCodigo(codigo: string): Promise<SolicitudVisita | undefined> {
  if (!/^VIS-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizarCodigo(codigo))) return undefined
  const hash = await hashCodigo(codigo)
  return getDB().solicitudesVisita.find((s) => s.codigoHash === hash)
}

const puedeObservar = (s: SolicitudVisita, db: Pick<DB, 'visitas'>) => {
  const v = db.visitas.find((x) => x.id === s.visitaId)
  return s.estado === 'autorizada' && !!v && v.estado !== 'cancelada' && v.fecha <= todayISO()
}

/** Consulta pública con el código de seguimiento. */
export async function consultarSolicitud(codigo: string): Promise<Resultado<EstadoPublicoSolicitud>> {
  const s = await buscarPorCodigo(codigo)
  if (!s) return fallo('No encontramos una solicitud con ese código. Revisa que esté bien escrito.')
  const db = getDB()
  const v = db.visitas.find((x) => x.id === s.visitaId)
  return exito({
    id: s.id,
    organizacion: db.orgs.find((o) => o.id === s.orgId)?.nombre ?? 'Organización',
    estado: s.estado,
    estadoTexto: ESTADO_SOLICITUD[s.estado],
    fechaPropuesta: v?.fecha ?? s.fechaPropuesta,
    horaPropuesta: v?.horaPautada ?? s.horaPropuesta,
    motivoRechazo: s.motivoRechazo,
    puedeRegistrarObservacion: puedeObservar(s, db),
    observacion: s.observacion,
  })
}

/** El visitante deja su observación: la visita queda realizada (V2: solo registra que ocurrió y su observación). */
export async function registrarObservacionVisitante(codigo: string, observacion: string): Promise<Resultado<EstadoPublicoSolicitud>> {
  const offline = sinConexion()
  if (offline) return offline
  const error = errorTexto(observacion, 'tu observación', 3, 600)
  if (error) return fallo(ERROR_VALIDACION, { observacion: error })
  const s = await buscarPorCodigo(codigo)
  if (!s) return fallo('No encontramos una solicitud con ese código.')
  if (!puedeObservar(s, getDB())) return fallo('Esta solicitud no admite observaciones todavía. Podrás dejarla el día de la visita.')
  const ahora = new Date().toISOString()
  mutate((db) => {
    const sol = db.solicitudesVisita.find((x) => x.id === s.id)
    const v = db.visitas.find((x) => x.id === s.visitaId)
    if (!sol || !v) return
    sol.estado = 'realizada'
    sol.observacion = observacion.trim()
    sol.observacionEn = ahora
    v.estado = 'completada'
    v.observaciones = observacion.trim()
    v.inicio = v.inicio ?? ahora
    v.fin = ahora
    v.actualizadoEn = ahora
    auditar(db, { anonimo: sol.visitante.cedula }, { accion: 'solicitud.observacion', entidad: 'solicitud', registroId: sol.id, orgId: sol.orgId })
  })
  return consultarSolicitud(codigo)
}

/** Solicitudes de la cuenta activa, las pendientes primero. */
export const solicitudesDeCuenta = (db: Pick<DB, 'solicitudesVisita'>, orgId: string) =>
  db.solicitudesVisita
    .filter((s) => s.orgId === orgId)
    .sort((a, b) => Number(b.estado === 'pendiente') - Number(a.estado === 'pendiente') || b.creadaEn.localeCompare(a.creadaEn))

export interface DatosAutorizacion {
  adultoId: string
  fecha: string
  hora: string
}

/** Autoriza la solicitud: confirma el adulto y crea la visita programada (RegistroVisita.Autorizada_por_user_Id). */
export function autorizarSolicitud(actor: Usuario, solicitudId: string, d: DatosAutorizacion): Resultado<Visita> {
  const offline = sinConexion()
  if (offline) return offline
  const db = getDB()
  const s = db.solicitudesVisita.find((x) => x.id === solicitudId && x.orgId === actor.orgId)
  if (!s) return fallo(ERROR_NO_ENCONTRADO)
  const adulto = db.adultos.find((a) => a.id === d.adultoId && a.orgId === actor.orgId && a.estado === 'activo')
  const denegado = verificar(actor, 'visitas:autorizar', 'solicitud', adulto, solicitudId)
  if (denegado) return denegado
  if (s.estado !== 'pendiente') return fallo('Esta solicitud ya fue revisada.')
  const errores = {
    adultoId: adulto ? undefined : 'Confirma a qué adulto mayor corresponde la visita.',
    fecha: errorFechaFutura(d.fecha),
    hora: /^\d{2}:\d{2}$/.test(d.hora) ? undefined : 'Indica la hora.',
  }
  if (hayErrores(errores) || !adulto) return fallo(ERROR_VALIDACION, errores)
  const ahora = new Date().toISOString()
  const nombre = `${s.visitante.nombres} ${s.visitante.apellidos}`
  const visita: Visita = {
    id: uid('v'),
    adultoId: adulto.id,
    cuidadorId: actor.id,
    autorizadaPor: actor.id,
    razon: s.motivo.slice(0, 120),
    tipo: 'Visita de voluntario ocasional',
    fecha: d.fecha,
    horaPautada: d.hora,
    estado: 'pendiente',
    detallesAdicionales: [],
    checklist: [],
    evidencias: [],
    // Los datos de contacto del visitante quedan solo en la solicitud (visible para quien autoriza), no en la visita.
    notas: `Visita de voluntario ocasional autorizada a partir de una solicitud.`,
    creadaPor: actor.id,
    visitante: { nombre, solicitudId: s.id },
    actualizadoEn: ahora,
    actualizadoPor: actor.id,
  }
  mutate((draft) => {
    draft.visitas.push(visita)
    const sol = draft.solicitudesVisita.find((x) => x.id === s.id)
    if (sol) {
      sol.estado = 'autorizada'
      sol.adultoId = adulto.id
      sol.revisadaPor = actor.id
      sol.revisadaEn = ahora
      sol.visitaId = visita.id
    }
    auditar(draft, actor, { accion: 'solicitud.autorizar', entidad: 'solicitud', registroId: s.id, detalle: `Visita ${visita.id} para ${d.fecha} ${d.hora}` })
  })
  return exito(visita)
}

/** Rechaza la solicitud con un motivo que verá el visitante. */
export function rechazarSolicitud(actor: Usuario, solicitudId: string, motivo: string): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const s = getDB().solicitudesVisita.find((x) => x.id === solicitudId && x.orgId === actor.orgId)
  if (!s) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'visitas:autorizar', 'solicitud', undefined, solicitudId)
  if (denegado) return denegado
  if (s.estado !== 'pendiente') return fallo('Esta solicitud ya fue revisada.')
  const error = errorTexto(motivo, 'el motivo', 3, 300)
  if (error) return fallo(ERROR_VALIDACION, { motivo: error })
  mutate((draft) => {
    const sol = draft.solicitudesVisita.find((x) => x.id === s.id)
    if (!sol) return
    sol.estado = 'rechazada'
    sol.motivoRechazo = motivo.trim()
    sol.revisadaPor = actor.id
    sol.revisadaEn = new Date().toISOString()
    auditar(draft, actor, { accion: 'solicitud.rechazar', entidad: 'solicitud', registroId: s.id })
  })
  return exito(undefined)
}
