/*
 * registro.ts — Activación de cuentas invitadas y registro de organizaciones.
 * Módulo: auth (CU-01 · CU-13 · Req. de negocio 8.1 · SRS §8.2.2.3.5 b: sin contraseñas en texto plano).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Modelo de cuentas:
 *  - Las cuentas personales (coordinador, voluntario, familiar responsable y otros administradores) las CREA
 *    el administrador de la organización: quedan en estado "invitado" con una invitación pendiente.
 *  - "/registro" ACTIVA esa cuenta: la persona confirma sus datos, elige su propia contraseña (el
 *    administrador nunca la conoce) y acepta los Términos y la Política de Privacidad.
 *  - "/registro-organizacion" incorpora una organización nueva (tabla Cuenta, con su plan y la prueba gratuita
 *    de 30 días) junto con su primera cuenta de Administrador (Usuario + Membresia), que queda como titular
 *    (User_Titular). Los parámetros (Configuracion_Cuenta) toman su valor por defecto.
 *  - Toda cuenta activa tiene una membresía vigente (tabla Membresia): la activación la crea si falta.
 *
 * No existe un servicio en domain/api para estos flujos públicos (no hay usuario en sesión): se escriben
 * aquí con mutate() + auditar(), validando todo de nuevo antes de escribir.
 */
import { login, type AuthResult } from '@/domain/auth'
import { verificarCodigoActivacion } from '@/domain/api'
import { auditar } from '@/domain/auditoria'
import { estaEnLinea } from '@/domain/conectividad'
import { addDays, toISODate } from '@/domain/dates'
import { ROL_LABEL } from '@/domain/nombres'
import { protegerPassword, validarPassword } from '@/domain/seguridad'
import { getDB, MENSAJE_SIN_CONEXION, mutate, uid } from '@/domain/store'
import type { DB, Organizacion, Rol, Usuario } from '@/domain/types'
import { emailValido, errorCedula, errorEmail, errorNombre, errorTelefono, errorTexto, hayErrores, limpiarTexto } from '@/domain/validacion'
import { normalizarEmail } from './validar'

export type Errores = Record<string, string | undefined>
export type ResultadoRegistro = AuthResult | { ok: false; error: string; errores?: Errores }

export const MENSAJE_SIN_INVITACION = 'Tu organización debe crear tu cuenta; pide al administrador que te invite.'
const ERROR_REVISA = 'Revisa los campos marcados.'
/** Mensaje genérico ante correo o código incorrectos: no revela cuál de los dos falló. */
export const MENSAJE_CODIGO_INVALIDO = 'El correo o el código de activación no son válidos (o el código caducó). Pide al administrador un código nuevo.'

/* ───────────── Memoria de contraseñas entre pantallas ─────────────
 * Si la persona abre los Términos o la Política y vuelve, no pierde lo escrito. Solo vive en la memoria
 * del módulo: la contraseña nunca se escribe en sessionStorage ni en localStorage.
 */
export interface MemoriaClave {
  password: string
  confirmar: string
  acepto: boolean
}
const memoria = new Map<string, MemoriaClave>()
export const leerMemoria = (flujo: string): MemoriaClave => memoria.get(flujo) ?? { password: '', confirmar: '', acepto: false }
export const guardarMemoria = (flujo: string, m: MemoriaClave) => void memoria.set(flujo, m)
export const limpiarMemoria = (flujo: string) => void memoria.delete(flujo)

/* ───────────── Activación de cuentas invitadas ───────────── */
export interface DatosPersonales {
  cedula: string
  nombre: string
  apellido: string
  telefono: string
}

export interface InvitacionEncontrada {
  rol: Rol
  organizacion: string
}

const cuentaInvitada = (email: string): Usuario | undefined => {
  const e = normalizarEmail(email)
  return getDB().usuarios.find((u) => u.email.toLowerCase() === e && u.estado === 'invitado')
}

/** Datos de la invitación de un correo (sin verificar el código: solo para volver a mostrarlos en pantalla). */
export function datosInvitacion(email: string): InvitacionEncontrada | null {
  const u = cuentaInvitada(email)
  if (!u) return null
  const org = getDB().orgs.find((o) => o.id === u.orgId)
  return { rol: u.rol, organizacion: org?.nombre ?? 'tu organización' }
}

/**
 * Paso 1: correo + código de activación de un solo uso entregado por el administrador. Solo dice "sí"
 * (con el rol y la organización) o devuelve un mensaje genérico que no revela si el correo existe.
 */
export async function buscarInvitacion(email: string, codigo: string): Promise<{ ok: true; valor: InvitacionEncontrada } | { ok: false; error: string }> {
  if (!estaEnLinea()) return { ok: false, error: MENSAJE_SIN_CONEXION }
  const u = cuentaInvitada(email)
  if (!u) return { ok: false, error: MENSAJE_SIN_INVITACION }
  if (!(await verificarCodigoActivacion(email, codigo))) {
    mutate((db) => auditar(db, { anonimo: normalizarEmail(email) }, { accion: 'sesion.fallida', entidad: 'usuario', registroId: u.id, resultado: 'fallo', detalle: 'Código de activación incorrecto', orgId: u.orgId }), { silencioso: true })
    return { ok: false, error: MENSAJE_CODIGO_INVALIDO }
  }
  return { ok: true, valor: datosInvitacion(email)! }
}

export function validarDatosPersonales(d: DatosPersonales): Errores {
  return {
    cedula: errorCedula(d.cedula),
    nombre: errorNombre(d.nombre, 'nombre'),
    apellido: errorNombre(d.apellido, 'apellido'),
    telefono: errorTelefono(d.telefono),
  }
}

/** Días de la prueba gratuita de una cuenta nueva (Cuenta.Prueba_gratuita). */
export const DIAS_PRUEBA_GRATUITA = 30

/**
 * Garantiza que el usuario tenga una membresía vigente con su rol actual (dentro de un mutate): si no tiene
 * ninguna la crea; si la vigente es de otro rol o de otra cuenta, la cierra y abre una nueva.
 */
function asegurarMembresia(db: DB, u: Usuario, ahora: string) {
  const vigente = db.membresias.find((m) => m.usuarioId === u.id && m.estado === 'activa')
  if (vigente && vigente.rol === u.rol && vigente.orgId === u.orgId) return
  for (const m of db.membresias) {
    if (m.usuarioId === u.id && m.estado === 'activa') {
      m.estado = 'inactiva'
      m.fechaFin = ahora
    }
  }
  db.membresias.push({ id: uid('m'), usuarioId: u.id, orgId: u.orgId, rol: u.rol, estado: 'activa', fechaInicio: ahora })
}

const cedulaEnUso = (cedula: string, excepto?: string) => getDB().usuarios.some((u) => u.id !== excepto && u.cedula && u.cedula === cedula.trim())

/**
 * Paso final: activa la cuenta invitada con la contraseña elegida por la persona (hash + sal), marca la
 * invitación como aceptada, audita "usuario.editar · Cuenta activada" e inicia sesión.
 */
export async function activarCuenta(email: string, codigo: string, datos: DatosPersonales, password: string, acepto: boolean): Promise<ResultadoRegistro> {
  if (!estaEnLinea()) return { ok: false, error: MENSAJE_SIN_CONEXION }
  const invitado = cuentaInvitada(email)
  if (!invitado) return { ok: false, error: MENSAJE_SIN_INVITACION }
  if (!(await verificarCodigoActivacion(email, codigo))) return { ok: false, error: MENSAJE_CODIGO_INVALIDO }

  const errores: Errores = {
    ...validarDatosPersonales(datos),
    password: validarPassword(password),
    acepto: acepto ? undefined : 'Debes aceptar los Términos y la Política de Privacidad.',
  }
  // Si el administrador registró la cédula al invitar, debe coincidir (verificación básica de identidad).
  if (!errores.cedula && invitado.cedula && invitado.cedula !== datos.cedula.trim()) {
    errores.cedula = 'La cédula no coincide con la registrada por tu organización.'
  } else if (!errores.cedula && cedulaEnUso(datos.cedula, invitado.id)) {
    errores.cedula = 'Esta cédula ya está asociada a otra cuenta. Contacta al administrador de tu organización.'
  }
  if (hayErrores(errores)) return { ok: false, error: ERROR_REVISA, errores }

  const protegida = await protegerPassword(password)
  const ahora = new Date().toISOString()
  const e = invitado.email.toLowerCase()
  const escrito = mutate((db) => {
    const u = db.usuarios.find((x) => x.id === invitado.id && x.estado === 'invitado')
    if (!u) return
    Object.assign(u, protegida, {
      nombre: limpiarTexto(datos.nombre),
      apellido: limpiarTexto(datos.apellido),
      cedula: datos.cedula.trim(),
      telefono: datos.telefono.trim(),
      estado: 'activo',
      actualizadoEn: ahora,
    })
    for (const inv of db.invitaciones) if (inv.estado === 'pendiente' && inv.email.toLowerCase() === e) inv.estado = 'aceptada'
    asegurarMembresia(db, u, ahora)
    auditar(db, u, { accion: 'usuario.editar', entidad: 'usuario', registroId: u.id, detalle: 'Cuenta activada' })
  })
  if (!escrito) return { ok: false, error: MENSAJE_SIN_CONEXION }
  return login(e, password)
}

/* ───────────── Registro de una organización nueva ───────────── */

/** Datos de la tabla Cuenta que se piden al registrar la organización. */
export interface DatosOrganizacion {
  nombre: string
  tipoCuentaId: string
  categoriaCuentaId: string
  provinciaCod: string
  municipioCod: string
  direccion: string
  telefono: string
  correo: string
}

/** Errores con las claves de los campos del formulario de registro (paso 1). */
export function validarOrganizacion(o: DatosOrganizacion): Errores {
  const cat = getDB().catalogos
  return {
    nombreOrg: errorTexto(o.nombre, 'el nombre de la organización', 3, 80),
    tipoCuentaId: cat.tiposCuenta.some((t) => t.id === o.tipoCuentaId) ? undefined : 'Selecciona el tipo de organización.',
    categoriaCuentaId: cat.categoriasCuenta.some((c) => c.id === o.categoriaCuentaId) ? undefined : 'Selecciona la categoría.',
    provinciaCod: cat.provincias.some((p) => p.cod === o.provinciaCod) ? undefined : 'Selecciona la provincia.',
    municipioCod: cat.municipios.some((m) => m.cod === o.municipioCod && m.provinciaCod === o.provinciaCod) ? undefined : 'Selecciona el municipio.',
    direccion: o.direccion.trim().length > 150 ? 'Máximo 150 caracteres.' : undefined,
    telefonoOrg: errorTelefono(o.telefono),
    correoOrg: o.correo.trim() && !emailValido(o.correo) ? 'Escribe un correo válido (ejemplo@correo.com).' : undefined,
  }
}

/** El plan elegido debe existir y estar activo (paso 2). */
export function validarPlan(planId: string): Errores {
  return { planId: getDB().catalogos.planes.some((p) => p.id === planId && p.estado === 'activo') ? undefined : 'Elige un plan para tu organización.' }
}

/** Mensaje neutro: no confirma si el correo pertenece a otra cuenta. */
const ERROR_CORREO_NO_DISPONIBLE = 'No es posible usar este correo. Si ya tienes una cuenta, inicia sesión o recupera tu contraseña.'

export function validarAdministrador(d: DatosPersonales & { email: string }): Errores {
  const e = normalizarEmail(d.email)
  return {
    ...validarDatosPersonales(d),
    cedula: errorCedula(d.cedula) ?? (cedulaEnUso(d.cedula) ? 'Esta cédula ya está asociada a otra cuenta.' : undefined),
    email: errorEmail(d.email) ?? (getDB().usuarios.some((u) => u.email.toLowerCase() === e) ? ERROR_CORREO_NO_DISPONIBLE : undefined),
  }
}

/**
 * Crea la cuenta (Cuenta) con el plan elegido y una prueba gratuita de 30 días (Suscripcion_Estado "prueba",
 * Plan_Precio copiado del plan), su cuenta de Administrador activa (Usuario) con su membresía vigente
 * (Membresia) y la marca como titular (User_Titular). Los parámetros toman su valor por defecto (no se escribe
 * Configuracion_Cuenta). Audita e inicia sesión.
 */
export async function registrarOrganizacion(
  org: DatosOrganizacion,
  planId: string,
  admin: DatosPersonales & { email: string },
  password: string,
  acepto: boolean,
): Promise<ResultadoRegistro> {
  if (!estaEnLinea()) return { ok: false, error: MENSAJE_SIN_CONEXION }
  const errores: Errores = {
    ...validarOrganizacion(org),
    ...validarPlan(planId),
    ...validarAdministrador(admin),
    password: validarPassword(password),
    acepto: acepto ? undefined : 'Debes aceptar los Términos y la Política de Privacidad.',
  }
  if (hayErrores(errores)) return { ok: false, error: ERROR_REVISA, errores }
  const plan = getDB().catalogos.planes.find((p) => p.id === planId)!

  const email = normalizarEmail(admin.email)
  const ahora = new Date().toISOString()
  const hoy = new Date()
  const usuarioId = uid('u')
  const organizacion: Organizacion = {
    id: uid('org'),
    nombre: limpiarTexto(org.nombre),
    tipoCuentaId: org.tipoCuentaId,
    categoriaCuentaId: org.categoriaCuentaId,
    municipioCod: org.municipioCod,
    direccion: limpiarTexto(org.direccion),
    telefono: org.telefono.trim(),
    correo: org.correo.trim().toLowerCase(),
    suscripcionEstado: 'prueba',
    creadoEn: ahora,
    pruebaGratuita: true,
    fechaInicioPrueba: toISODate(hoy),
    fechaFinPrueba: toISODate(addDays(hoy, DIAS_PRUEBA_GRATUITA)),
    planId: plan.id,
    planPrecio: plan.precio,
    usuarioTitularId: usuarioId,
  }
  const usuario: Usuario = {
    id: usuarioId,
    rol: 'admin',
    nombre: limpiarTexto(admin.nombre),
    apellido: limpiarTexto(admin.apellido),
    cedula: admin.cedula.trim(),
    email,
    telefono: admin.telefono.trim(),
    ...(await protegerPassword(password)),
    etiqueta: ROL_LABEL.admin,
    estado: 'activo',
    orgId: organizacion.id,
    creadoEn: ahora,
    actualizadoEn: ahora,
  }
  const escrito = mutate((db) => {
    db.orgs.push(organizacion)
    db.usuarios.push(usuario)
    db.membresias.push({ id: uid('m'), usuarioId: usuario.id, orgId: organizacion.id, rol: 'admin', estado: 'activa', fechaInicio: ahora })
    auditar(db, usuario, {
      accion: 'usuario.crear',
      entidad: 'usuario',
      registroId: usuario.id,
      orgId: organizacion.id,
      detalle: `Rol ${ROL_LABEL.admin} · registro de la organización`,
    })
    auditar(db, usuario, {
      accion: 'pago.plan',
      entidad: 'pago',
      registroId: organizacion.id,
      orgId: organizacion.id,
      detalle: `Plan ${plan.nombre} · prueba gratuita de ${DIAS_PRUEBA_GRATUITA} días`,
    })
  })
  if (!escrito) return { ok: false, error: MENSAJE_SIN_CONEXION }
  return login(email, password)
}
