/*
 * usuarios.ts — Gestión de usuarios y roles (RF-09 · CU-13): tablas Usuario, Membresia y Vinculo (familiar
 * responsable), contraseñas, invitaciones y configuración de la cuenta (Cuenta + Configuracion_Cuenta).
 * Módulo: dominio · servicios.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { auditar } from '../auditoria'
import { ROLES } from '../catalogos'
import { PARAM } from '../datosMaestros'
import { ROL_LABEL } from '../nombres'
import { fijarParametro } from '../relaciones'
import { generarCodigo, hashSecreto, nuevaSal, protegerPassword, SAL_CODIGOS, validarPassword, verificarSecreto } from '../seguridad'
import { getDB, mutate, uid } from '../store'
import type { DB, Organizacion, Rol, Usuario } from '../types'
import { emailValido, enLista, errorCedula, errorEmail, errorNombre, errorTelefono, hayErrores, limpiarTexto } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from './comun'

const ROL_VALORES = ROLES.map((r) => r.value)

export interface DatosUsuario {
  nombre: string
  apellido: string
  email: string
  telefono: string
  cedula: string
  rol: Rol | ''
  /** Solo para familiares: adultos mayores a su cargo (vínculos "familiar_responsable"). */
  adultoIds: string[]
  /**
   * Contraseña inicial. Vacía = INVITACIÓN: la cuenta queda "invitado" y la persona la activa desde
   * "Activar mi cuenta" (/registro) eligiendo su propia contraseña (recomendado: el administrador nunca la conoce).
   */
  password: string
}

export function validarUsuario(d: DatosUsuario, usuarios: Usuario[], idActual?: string, conPassword = true) {
  const correoUsado = usuarios.some((u) => u.id !== idActual && u.email.toLowerCase() === d.email.trim().toLowerCase())
  return {
    nombre: errorNombre(d.nombre, 'nombre'),
    apellido: errorNombre(d.apellido, 'apellido'),
    email: errorEmail(d.email) ?? (correoUsado ? 'Ya existe una cuenta con este correo.' : undefined),
    telefono: errorTelefono(d.telefono),
    cedula: errorCedula(d.cedula, false),
    rol: enLista(d.rol, ROL_VALORES) ? undefined : 'Selecciona un rol válido.',
    adultoIds: d.rol === 'familiar' && d.adultoIds.length === 0 ? 'Indica el adulto mayor a cargo de este familiar.' : undefined,
    password: conPassword && d.password ? validarPassword(d.password) : undefined,
  }
}

/** Días de validez del código de activación de una invitación. */
export const DIAS_CODIGO_ACTIVACION = 7

async function nuevoCodigoActivacion() {
  const codigo = generarCodigo()
  return { codigo, codigoHash: await hashSecreto(codigo, SAL_CODIGOS), expira: new Date(Date.now() + DIAS_CODIGO_ACTIVACION * 86_400_000).toISOString() }
}

/* ───────────── Membresía (historial de rol en la cuenta) ───────────── */

/** Cierra la membresía vigente del usuario (dentro de un mutate). */
function cerrarMembresia(db: DB, usuarioId: string, ahora: string) {
  for (const m of db.membresias) {
    if (m.usuarioId === usuarioId && m.estado === 'activa') {
      m.estado = 'inactiva'
      m.fechaFin = ahora
    }
  }
}

/** Abre una membresía nueva con el rol indicado (dentro de un mutate). */
function abrirMembresia(db: DB, usuarioId: string, orgId: string, rol: Rol, ahora: string) {
  cerrarMembresia(db, usuarioId, ahora)
  db.membresias.push({ id: uid('m'), usuarioId, orgId, rol, estado: 'activa', fechaInicio: ahora })
}

/** Sustituye los vínculos de familiar responsable del usuario (dentro de un mutate). */
function fijarAdultosFamiliar(db: DB, usuarioId: string, adultoIds: string[], ahora: string) {
  db.vinculos = db.vinculos.filter((v) => !(v.usuarioId === usuarioId && v.tipoVinculoId === 'familiar_responsable' && !adultoIds.includes(v.adultoId)))
  for (const adultoId of adultoIds) {
    if (!db.vinculos.some((v) => v.usuarioId === usuarioId && v.adultoId === adultoId && v.tipoVinculoId === 'familiar_responsable')) {
      db.vinculos = db.vinculos.filter((v) => !(v.usuarioId === usuarioId && v.adultoId === adultoId))
      db.vinculos.push({ usuarioId, adultoId, tipoVinculoId: 'familiar_responsable', creadoEn: ahora })
    }
  }
}

/** Quita los vínculos que otorgan acceso según el rol anterior (al cambiar de rol no se arrastran accesos). */
function limpiarVinculosDeAcceso(db: DB, usuarioId: string, rolNuevo: Rol) {
  db.vinculos = db.vinculos.filter((v) => {
    if (v.usuarioId !== usuarioId) return true
    if (v.tipoVinculoId === 'voluntario_asignado') return rolNuevo === 'voluntario'
    if (v.tipoVinculoId === 'familiar_responsable') return rolNuevo === 'familiar'
    return true
  })
}

/**
 * Crea una cuenta en la organización del administrador (CU-13). Si es una invitación, devuelve también el
 * `codigoActivacion` (6 dígitos, un solo uso) que la persona necesitará para activar su cuenta. Solo se
 * guarda su hash: el administrador debe entregarlo en ese momento (en producción llegaría por correo).
 */
export async function crearUsuario(actor: Usuario, d: DatosUsuario): Promise<Resultado<Usuario & { codigoActivacion?: string }>> {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'usuarios:gestionar', 'usuario')
  if (denegado) return denegado
  const errores = validarUsuario(d, getDB().usuarios)
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  const rol = d.rol as Rol
  if (rol === 'familiar' && !d.adultoIds.every((id) => getDB().adultos.some((a) => a.id === id && a.orgId === actor.orgId))) return fallo(ERROR_VALIDACION, { adultoIds: 'Hay adultos no válidos.' })
  const ahora = new Date().toISOString()
  const usuario: Usuario = {
    id: uid('u'),
    rol,
    nombre: limpiarTexto(d.nombre),
    apellido: limpiarTexto(d.apellido),
    cedula: d.cedula.trim(),
    email: d.email.trim().toLowerCase(),
    telefono: d.telefono.trim(),
    // Invitación: hash aleatorio inutilizable hasta que la persona active su cuenta.
    ...(d.password ? await protegerPassword(d.password) : await protegerPassword(nuevaSal() + nuevaSal())),
    etiqueta: ROL_LABEL[rol],
    estado: d.password ? 'activo' : 'invitado',
    orgId: actor.orgId,
    creadoEn: ahora,
    actualizadoEn: ahora,
  }
  const activacion = usuario.estado === 'invitado' ? await nuevoCodigoActivacion() : undefined
  mutate((db) => {
    db.usuarios.push(usuario)
    abrirMembresia(db, usuario.id, actor.orgId, rol, ahora)
    if (rol === 'familiar') fijarAdultosFamiliar(db, usuario.id, d.adultoIds, ahora)
    if (activacion) {
      db.invitaciones.push({ id: uid('inv'), invitadoPor: actor.id, email: usuario.email, rol, nombre: usuario.nombre, apellido: usuario.apellido, estado: 'pendiente', creadaEn: ahora, codigoHash: activacion.codigoHash, expira: activacion.expira })
    }
    auditar(db, actor, { accion: 'usuario.crear', entidad: 'usuario', registroId: usuario.id, detalle: `Rol ${ROL_LABEL[rol]}${usuario.estado === 'invitado' ? ' · invitación enviada' : ''}` })
  })
  return exito({ ...usuario, codigoActivacion: activacion?.codigo })
}

/** Genera un nuevo código de activación para una cuenta invitada (el anterior deja de servir). */
export async function reenviarInvitacion(actor: Usuario, usuarioId: string): Promise<Resultado<string>> {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'usuarios:gestionar', 'usuario', undefined, usuarioId)
  if (denegado) return denegado
  const u = getDB().usuarios.find((x) => x.id === usuarioId && x.orgId === actor.orgId)
  if (!u) return fallo(ERROR_NO_ENCONTRADO)
  if (u.estado !== 'invitado') return fallo('La cuenta ya fue activada.')
  const activacion = await nuevoCodigoActivacion()
  mutate((db) => {
    for (const inv of db.invitaciones) if (inv.estado === 'pendiente' && inv.email.toLowerCase() === u.email.toLowerCase()) inv.estado = 'rechazada'
    db.invitaciones.push({ id: uid('inv'), invitadoPor: actor.id, email: u.email, rol: u.rol, nombre: u.nombre, apellido: u.apellido, estado: 'pendiente', creadaEn: new Date().toISOString(), codigoHash: activacion.codigoHash, expira: activacion.expira })
    auditar(db, actor, { accion: 'usuario.invitar', entidad: 'usuario', registroId: u.id, detalle: 'Nuevo código de activación' })
  })
  return exito(activacion.codigo)
}

/** ¿El código de activación corresponde a una invitación pendiente y vigente de este correo? */
export async function verificarCodigoActivacion(email: string, codigo: string): Promise<boolean> {
  if (!/^\d{6}$/.test(codigo.trim())) return false
  const hash = await hashSecreto(codigo.trim(), SAL_CODIGOS)
  const e = email.trim().toLowerCase()
  return getDB().invitaciones.some((i) => i.estado === 'pendiente' && i.email.toLowerCase() === e && i.codigoHash === hash && (!i.expira || Date.parse(i.expira) > Date.now()))
}

/** Edita datos y rol de un usuario. El cambio de rol abre una membresía nueva y se aplica en todos los módulos. */
export function actualizarUsuario(actor: Usuario, id: string, d: Omit<DatosUsuario, 'password'>): Resultado<Usuario> {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'usuarios:gestionar', 'usuario', undefined, id)
  if (denegado) return denegado
  const actual = getDB().usuarios.find((u) => u.id === id && u.orgId === actor.orgId)
  if (!actual) return fallo(ERROR_NO_ENCONTRADO)
  const errores = validarUsuario({ ...d, password: '' }, getDB().usuarios, id, false)
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  const rol = d.rol as Rol
  if (id === actor.id && rol !== 'admin') return fallo('No puedes quitarte a ti mismo el rol de administrador.')
  const admins = getDB().usuarios.filter((u) => u.orgId === actor.orgId && u.rol === 'admin' && u.estado === 'activo')
  if (actual.rol === 'admin' && rol !== 'admin' && admins.length <= 1) return fallo('La organización debe tener al menos un administrador activo.')

  let resultado: Usuario | undefined
  mutate((db) => {
    const u = db.usuarios.find((x) => x.id === id)
    if (!u) return
    const ahora = new Date().toISOString()
    const rolAnterior = u.rol
    u.nombre = limpiarTexto(d.nombre)
    u.apellido = limpiarTexto(d.apellido)
    u.email = d.email.trim().toLowerCase()
    u.telefono = d.telefono.trim()
    u.cedula = d.cedula.trim()
    u.rol = rol
    u.etiqueta = ROL_LABEL[rol]
    if (rolAnterior !== rol) {
      limpiarVinculosDeAcceso(db, id, rol)
      abrirMembresia(db, id, u.orgId, rol, ahora)
    }
    if (rol === 'familiar') fijarAdultosFamiliar(db, id, d.adultoIds, ahora)
    u.actualizadoEn = ahora
    resultado = u
    auditar(db, actor, { accion: 'usuario.editar', entidad: 'usuario', registroId: id })
    if (rolAnterior !== rol) auditar(db, actor, { accion: 'usuario.rol', entidad: 'usuario', registroId: id, detalle: `${ROL_LABEL[rolAnterior]} → ${ROL_LABEL[rol]}` })
  })
  return resultado ? exito(resultado) : fallo(ERROR_NO_ENCONTRADO)
}

/** Desactiva o reactiva una cuenta. Una cuenta desactivada pierde la sesión y no puede volver a entrar. */
export function cambiarEstadoUsuario(actor: Usuario, id: string, estado: 'activo' | 'inactivo'): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'usuarios:gestionar', 'usuario', undefined, id)
  if (denegado) return denegado
  const u = getDB().usuarios.find((x) => x.id === id && x.orgId === actor.orgId)
  if (!u) return fallo(ERROR_NO_ENCONTRADO)
  if (id === actor.id) return fallo('No puedes desactivar tu propia cuenta.')
  mutate((db) => {
    const x = db.usuarios.find((y) => y.id === id)
    if (!x) return
    const ahora = new Date().toISOString()
    // Una cuenta que nunca se activó vuelve a "invitado" (nadie conoce su contraseña).
    const sinActivar = db.invitaciones.some((i) => i.email.toLowerCase() === x.email.toLowerCase() && i.estado === 'pendiente')
    x.estado = estado === 'activo' && sinActivar ? 'invitado' : estado
    if (estado === 'inactivo') cerrarMembresia(db, id, ahora)
    else abrirMembresia(db, id, x.orgId, x.rol, ahora)
    x.actualizadoEn = ahora
    auditar(db, actor, { accion: estado === 'activo' ? 'usuario.reactivar' : 'usuario.desactivar', entidad: 'usuario', registroId: id })
  })
  return exito(undefined)
}

/** Elimina una cuenta (los registros históricos conservan el nombre en auditoría). */
export function eliminarUsuario(actor: Usuario, id: string): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'usuarios:gestionar', 'usuario', undefined, id)
  if (denegado) return denegado
  const u = getDB().usuarios.find((x) => x.id === id && x.orgId === actor.orgId)
  if (!u) return fallo(ERROR_NO_ENCONTRADO)
  if (id === actor.id) return fallo('No puedes eliminar tu propia cuenta desde aquí.')
  mutate((db) => {
    db.usuarios = db.usuarios.filter((x) => x.id !== id)
    db.vinculos = db.vinculos.filter((v) => v.usuarioId !== id)
    cerrarMembresia(db, id, new Date().toISOString())
    auditar(db, actor, { accion: 'usuario.eliminar', entidad: 'usuario', registroId: id, detalle: `${u.nombre} ${u.apellido} (${ROL_LABEL[u.rol]})` })
  })
  return exito(undefined)
}

/** Cambio de contraseña del propio usuario (verifica la actual y aplica la política). */
export async function cambiarPassword(actor: Usuario, actual: string, nueva: string): Promise<Resultado> {
  const offline = sinConexion()
  if (offline) return offline
  const u = getDB().usuarios.find((x) => x.id === actor.id)
  if (!u) return fallo(ERROR_NO_ENCONTRADO)
  if (!(await verificarSecreto(actual, u.passwordSalt, u.passwordHash))) return fallo(ERROR_VALIDACION, { actual: 'La contraseña actual no es correcta.' })
  const err = validarPassword(nueva)
  if (err) return fallo(ERROR_VALIDACION, { nueva: err })
  if (actual === nueva) return fallo(ERROR_VALIDACION, { nueva: 'La nueva contraseña debe ser distinta de la actual.' })
  const protegida = await protegerPassword(nueva)
  mutate((db) => {
    const x = db.usuarios.find((y) => y.id === actor.id)
    if (!x) return
    Object.assign(x, protegida, { actualizadoEn: new Date().toISOString() })
    auditar(db, actor, { accion: 'usuario.password', entidad: 'usuario', registroId: actor.id })
  })
  return exito(undefined)
}

/* ───────────── Cuenta (organización) y parámetros ───────────── */

export type DatosCuenta = Pick<Organizacion, 'nombre' | 'tipoCuentaId' | 'categoriaCuentaId' | 'municipioCod' | 'direccion' | 'telefono' | 'correo'>

/** Datos generales de la cuenta (tabla Cuenta). */
export function actualizarCuenta(actor: Usuario, d: DatosCuenta): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'organizacion:configurar', 'organizacion', undefined, actor.orgId)
  if (denegado) return denegado
  const cat = getDB().catalogos
  const errores = {
    nombre: d.nombre.trim().length >= 3 ? undefined : 'Escribe el nombre de la organización.',
    tipoCuentaId: cat.tiposCuenta.some((t) => t.id === d.tipoCuentaId) ? undefined : 'Selecciona el tipo de organización.',
    categoriaCuentaId: cat.categoriasCuenta.some((t) => t.id === d.categoriaCuentaId) ? undefined : 'Selecciona la categoría.',
    municipioCod: cat.municipios.some((m) => m.cod === d.municipioCod) ? undefined : 'Selecciona el municipio.',
    direccion: d.direccion.length > 150 ? 'Máximo 150 caracteres.' : undefined,
    telefono: errorTelefono(d.telefono),
    correo: d.correo && !emailValido(d.correo) ? 'Escribe un correo válido.' : undefined,
  }
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  mutate((db) => {
    const o = db.orgs.find((x) => x.id === actor.orgId)
    if (!o) return
    Object.assign(o, { ...d, nombre: limpiarTexto(d.nombre), direccion: limpiarTexto(d.direccion), telefono: d.telefono.trim(), correo: d.correo.trim().toLowerCase() })
    auditar(db, actor, { accion: 'organizacion.configurar', entidad: 'organizacion', registroId: o.id, detalle: 'Datos de la cuenta' })
  })
  return exito(undefined)
}

/** Guarda valores de parámetros de la cuenta (Configuracion_Cuenta), validados según su tipo. */
export function guardarParametros(actor: Usuario, valores: Record<string, string>): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'organizacion:configurar', 'organizacion', undefined, actor.orgId)
  if (denegado) return denegado
  const parametros = getDB().catalogos.parametros
  const errores: Record<string, string | undefined> = {}
  for (const [clave, valor] of Object.entries(valores)) {
    const p = parametros.find((x) => x.clave === clave)
    if (!p) errores[clave] = 'Parámetro desconocido.'
    else if (p.tipo === 'numero' && !(Number.isInteger(Number(valor)) && Number(valor) >= 1 && Number(valor) <= 365)) errores[clave] = 'Indica un número entero entre 1 y 365.'
    else if (clave === PARAM.DIAS_SIN_VISITA_ALERTA && Number(valor) > 90) errores[clave] = 'Indica un número de días entre 1 y 90.'
    else if (p.tipo === 'booleano' && valor !== 'true' && valor !== 'false') errores[clave] = 'Valor no válido.'
    else if (p.tipo === 'texto' && valor.length > 120) errores[clave] = 'Máximo 120 caracteres.'
    else if (clave === PARAM.CONTACTO_INSTITUCIONAL_TELEFONO && valor && errorTelefono(valor)) errores[clave] = errorTelefono(valor)
  }
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  mutate((db) => {
    const cambios: string[] = []
    for (const [clave, valor] of Object.entries(valores)) {
      const p = db.catalogos.parametros.find((x) => x.clave === clave)!
      const previo = db.configuracion.find((c) => c.orgId === actor.orgId && c.parametroId === p.id)?.valor ?? p.valorDefecto
      if (previo !== valor.trim()) {
        fijarParametro(db, actor.orgId, clave, valor.trim())
        cambios.push(`${p.nombre}: ${previo || '—'} → ${valor.trim() || '—'}`)
      }
    }
    if (cambios.length) auditar(db, actor, { accion: 'organizacion.configurar', entidad: 'organizacion', registroId: actor.orgId, detalle: cambios.join('; ') })
  })
  return exito(undefined)
}
