/*
 * registro.ts — Activación de cuentas invitadas y registro de cuentas nuevas (Organización o Familia).
 * Módulo: auth (CU-01 · CU-13 · Req. de negocio 8.1 · SRS §8.2.2.3.5 b: sin contraseñas en texto plano).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Modelo de cuentas:
 *  - Las cuentas personales (coordinador, cuidador, voluntario, familiar responsable y otros administradores) las
 *    CREA quien gestiona la cuenta: quedan en estado "invitado" con una invitación pendiente.
 *  - "/registro" ACTIVA esa cuenta: la persona confirma sus datos, elige su propia contraseña (quien la invitó
 *    nunca la conoce) y acepta los Términos y la Política de Privacidad.
 *  - "/crear-cuenta" pregunta el tipo de cuenta (Familia u Organización). Cada tipo tiene su formulario:
 *      · "/registro-organizacion": tabla Cuenta de tipo Organización + primera cuenta de Administrador.
 *      · "/registro-familia": tabla Cuenta de tipo Familia + persona Coordinadora (en Familia no hay Administrador).
 *    En ambos casos la cuenta nace en prueba gratuita de 7 días (DIAS_PRUEBA_GRATUITA, domain/planes.ts) con
 *    funciones limitadas (PRUEBA_GRATUITA), sin plan (Plan_Id vacío, Plan_Precio 0) y sin pedir tarjeta: el plan
 *    se elige cuando la prueba está por terminar (pantalla Suscripción). La persona registrada queda como titular
 *    (User_Titular) con su Usuario + Membresia. Los parámetros (Configuracion_Cuenta) toman su valor por defecto.
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
import { DIAS_PRUEBA_GRATUITA, TIPO_CUENTA_ID, TIPO_CUENTA_LABEL, type TipoCuenta } from '@/domain/planes'
import { protegerPassword, validarPassword } from '@/domain/seguridad'
import { getDB, MENSAJE_SIN_CONEXION, mutate, uid } from '@/domain/store'
import type { Catalogos, DB, Organizacion, Rol, Usuario } from '@/domain/types'
import { emailValido, errorCedula, errorEmail, errorNombre, errorTelefono, errorTexto, hayErrores, limpiarTexto } from '@/domain/validacion'
import { normalizarEmail } from './validar'

export type Errores = Record<string, string | undefined>
export type ResultadoRegistro = AuthResult | { ok: false; error: string; errores?: Errores }

export const MENSAJE_SIN_INVITACION = 'Tu cuenta debe crearla quien gestiona tu organización o tu familia; pídele que te invite.'
const ERROR_REVISA = 'Revisa los campos marcados.'
/** Mensaje genérico ante correo o código incorrectos: no revela cuál de los dos falló. */
export const MENSAJE_CODIGO_INVALIDO = 'El correo o el código de activación no son válidos (o el código caducó). Pide un código nuevo a quien te invitó.'

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
  return { rol: u.rol, organizacion: org?.nombre ?? 'tu cuenta' }
}

/**
 * Paso 1: correo + código de activación de un solo uso entregado por quien invitó. Solo dice "sí"
 * (con el rol y la cuenta) o devuelve un mensaje genérico que no revela si el correo existe.
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
  // Si quien invitó registró la cédula, debe coincidir (verificación básica de identidad).
  if (!errores.cedula && invitado.cedula && invitado.cedula !== datos.cedula.trim()) {
    errores.cedula = 'La cédula no coincide con la registrada al invitarte.'
  } else if (!errores.cedula && cedulaEnUso(datos.cedula, invitado.id)) {
    errores.cedula = 'Esta cédula ya está asociada a otra cuenta. Contacta a quien te invitó.'
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

/* ───────────── Registro de una cuenta nueva (Organización o Familia) ───────────── */

/** Rol de la persona titular según el tipo de cuenta (V2 §Cuenta): Administrador en Organización, Coordinador en Familia. */
export const ROL_TITULAR: Record<TipoCuenta, Rol> = { organizacion: 'admin', familia: 'coordinador' }

/** Categorías de cuenta válidas para un tipo (Categoria_cuenta.Cuenta_Tipo_Id). */
export const categoriasDeTipo = (cat: Pick<Catalogos, 'categoriasCuenta'>, tipo: TipoCuenta) => cat.categoriasCuenta.filter((c) => c.tipoCuentaId === TIPO_CUENTA_ID[tipo])

/** Datos de la tabla Cuenta que se piden al registrar la cuenta (el tipo lo fija el formulario, no la persona). */
export interface DatosCuenta {
  nombre: string
  categoriaCuentaId: string
  provinciaCod: string
  municipioCod: string
  direccion: string
  telefono: string
  correo: string
}

const NOMBRE_CUENTA: Record<TipoCuenta, string> = { organizacion: 'el nombre de la organización', familia: 'el nombre de la familia' }

/** Categoría y municipio comprobados contra el catálogo (la categoría debe pertenecer al tipo de cuenta). */
function validarClasificacion(tipo: TipoCuenta, c: Pick<DatosCuenta, 'categoriaCuentaId' | 'provinciaCod' | 'municipioCod'>): Errores {
  const cat = getDB().catalogos
  return {
    categoriaCuentaId: categoriasDeTipo(cat, tipo).some((x) => x.id === c.categoriaCuentaId) ? undefined : 'Selecciona la categoría.',
    provinciaCod: cat.provincias.some((p) => p.cod === c.provinciaCod) ? undefined : 'Selecciona la provincia.',
    municipioCod: cat.municipios.some((m) => m.cod === c.municipioCod && m.provinciaCod === c.provinciaCod) ? undefined : 'Selecciona el municipio.',
  }
}

/** Errores con las claves de los campos del formulario de la organización (pasos 1 y 2). */
export function validarOrganizacion(o: DatosCuenta): Errores {
  return {
    nombreOrg: errorTexto(o.nombre, NOMBRE_CUENTA.organizacion, 3, 80),
    ...validarClasificacion('organizacion', o),
    direccion: o.direccion.trim().length > 150 ? 'Máximo 150 caracteres.' : undefined,
    telefonoOrg: errorTelefono(o.telefono),
    correoOrg: o.correo.trim() && !emailValido(o.correo) ? 'Escribe un correo válido (ejemplo@correo.com).' : undefined,
  }
}

/** Errores con las claves del formulario de la familia (paso 1). El contacto de la cuenta es el de la persona coordinadora. */
export function validarFamilia(f: Pick<DatosCuenta, 'nombre' | 'categoriaCuentaId' | 'provinciaCod' | 'municipioCod'>): Errores {
  return {
    nombreFamilia: errorTexto(f.nombre, NOMBRE_CUENTA.familia, 3, 80),
    ...validarClasificacion('familia', f),
  }
}

/** Mensaje neutro: no confirma si el correo pertenece a otra cuenta. */
const ERROR_CORREO_NO_DISPONIBLE = 'No es posible usar este correo. Si ya tienes una cuenta, inicia sesión o recupera tu contraseña.'

/** Persona titular de la cuenta nueva (Administrador de la organización o Coordinadora de la familia). */
export type DatosTitular = DatosPersonales & { email: string }

export function validarTitular(d: DatosTitular): Errores {
  const e = normalizarEmail(d.email)
  return {
    ...validarDatosPersonales(d),
    cedula: errorCedula(d.cedula) ?? (cedulaEnUso(d.cedula) ? 'Esta cédula ya está asociada a otra cuenta.' : undefined),
    email: errorEmail(d.email) ?? (getDB().usuarios.some((u) => u.email.toLowerCase() === e) ? ERROR_CORREO_NO_DISPONIBLE : undefined),
  }
}

/**
 * Crea la cuenta (Cuenta) del tipo indicado, en prueba gratuita de 7 días (Suscripcion_Estado "prueba", sin plan:
 * Plan_Id vacío y Plan_Precio 0), con su persona titular activa (Usuario) y su membresía vigente (Membresia), y la
 * marca como titular (User_Titular). Los parámetros toman su valor por defecto (no se escribe Configuracion_Cuenta).
 * Audita "usuario.crear" y "cuenta.registrar" e inicia sesión. Valida todo de nuevo antes de escribir.
 */
async function registrarCuenta(tipo: TipoCuenta, cuenta: DatosCuenta, titular: DatosTitular, password: string, acepto: boolean): Promise<ResultadoRegistro> {
  if (!estaEnLinea()) return { ok: false, error: MENSAJE_SIN_CONEXION }
  const errores: Errores = {
    ...(tipo === 'familia' ? validarFamilia(cuenta) : validarOrganizacion(cuenta)),
    ...validarTitular(titular),
    password: validarPassword(password),
    acepto: acepto ? undefined : 'Debes aceptar los Términos y la Política de Privacidad.',
  }
  if (hayErrores(errores)) return { ok: false, error: ERROR_REVISA, errores }

  const rol = ROL_TITULAR[tipo]
  const email = normalizarEmail(titular.email)
  const ahora = new Date().toISOString()
  const hoy = new Date()
  const usuarioId = uid('u')
  const organizacion: Organizacion = {
    id: uid('org'),
    nombre: limpiarTexto(cuenta.nombre),
    tipoCuentaId: TIPO_CUENTA_ID[tipo],
    categoriaCuentaId: cuenta.categoriaCuentaId,
    municipioCod: cuenta.municipioCod,
    direccion: limpiarTexto(cuenta.direccion),
    // Una familia no tiene datos institucionales: el contacto de la cuenta es el de la persona coordinadora.
    telefono: (tipo === 'familia' ? titular.telefono : cuenta.telefono).trim(),
    correo: tipo === 'familia' ? email : cuenta.correo.trim().toLowerCase(),
    suscripcionEstado: 'prueba',
    creadoEn: ahora,
    pruebaGratuita: true,
    fechaInicioPrueba: toISODate(hoy),
    fechaFinPrueba: toISODate(addDays(hoy, DIAS_PRUEBA_GRATUITA)),
    planId: '',
    planPrecio: 0,
    usuarioTitularId: usuarioId,
  }
  const usuario: Usuario = {
    id: usuarioId,
    rol,
    nombre: limpiarTexto(titular.nombre),
    apellido: limpiarTexto(titular.apellido),
    cedula: titular.cedula.trim(),
    email,
    telefono: titular.telefono.trim(),
    ...(await protegerPassword(password)),
    etiqueta: ROL_LABEL[rol],
    estado: 'activo',
    orgId: organizacion.id,
    creadoEn: ahora,
    actualizadoEn: ahora,
  }
  const escrito = mutate((db) => {
    db.orgs.push(organizacion)
    db.usuarios.push(usuario)
    db.membresias.push({ id: uid('m'), usuarioId: usuario.id, orgId: organizacion.id, rol, estado: 'activa', fechaInicio: ahora })
    auditar(db, usuario, {
      accion: 'usuario.crear',
      entidad: 'usuario',
      registroId: usuario.id,
      orgId: organizacion.id,
      detalle: `Rol ${ROL_LABEL[rol]} · titular de la cuenta`,
    })
    auditar(db, usuario, {
      accion: 'cuenta.registrar',
      entidad: 'organizacion',
      registroId: organizacion.id,
      orgId: organizacion.id,
      detalle: `Cuenta ${TIPO_CUENTA_LABEL[tipo]} · prueba gratuita de ${DIAS_PRUEBA_GRATUITA} días, sin plan`,
    })
  })
  if (!escrito) return { ok: false, error: MENSAJE_SIN_CONEXION }
  return login(email, password)
}

/** Registra una organización con su primera cuenta de Administrador (titular). */
export const registrarOrganizacion = (org: DatosCuenta, admin: DatosTitular, password: string, acepto: boolean) =>
  registrarCuenta('organizacion', org, admin, password, acepto)

/** Registra una familia con su persona Coordinadora (titular). */
export const registrarFamilia = (familia: DatosCuenta, coordinadora: DatosTitular, password: string, acepto: boolean) =>
  registrarCuenta('familia', familia, coordinadora, password, acepto)
