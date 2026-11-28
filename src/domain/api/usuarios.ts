/*
 * usuarios.ts — Gestión de miembros y roles de la cuenta (RF-09 · CU-13): Usuario, Membresia y Vinculo (acceso a
 * adultos mayores), invitaciones con código de activación y configuración de la cuenta (Cuenta + Configuracion_Cuenta).
 * Módulo: dominio · servicios.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reglas de Negocio V2 que aplica este módulo:
 *  - Un usuario puede pertenecer a varias cuentas con un rol distinto en cada una (tabla Membresia). Todo lo que
 *    se hace aquí actúa sobre la membresía de la cuenta ACTIVA del actor (`actor.orgId`), nunca sobre las demás.
 *  - Una cuenta es Familia u Organización y solo admite los roles de su tipo (ROLES_POR_TIPO_CUENTA).
 *  - Gestiona los miembros quien tenga `usuarios:gestionar`: el Administrador en una Organización y el Coordinador
 *    en una cuenta Familia (permisos.ts).
 *  - Desactivar a un miembro cierra su membresía (estado «inactiva» + fecha de fin): el historial se conserva.
 *  - El Voluntario ocasional no paga plan propio: no cuenta como usuario para el límite del plan.
 *  - Si el correo invitado ya pertenece a otra persona registrada, no se duplica: se agrega una membresía nueva.
 */
import { auditar } from '../auditoria'
import { PARAM } from '../datosMaestros'
import { ROL_LABEL } from '../nombres'
import { excedeLimite, ROLES_POR_TIPO_CUENTA, TIPO_CUENTA_LABEL, tipoDeCuenta, type TipoCuenta } from '../planes'
import { fijarParametro, usoDelPlan, VINCULO_DE_ROL } from '../relaciones'
import { generarCodigo, hashSecreto, nuevaSal, protegerPassword, SAL_CODIGOS, validarPassword, verificarSecreto } from '../seguridad'
import { getDB, mutate, uid } from '../store'
import type { DB, EstadoMiembro, Membresia, Organizacion, Rol, Usuario } from '../types'
import { emailValido, enLista, errorCedula, errorEmail, errorNombre, errorTelefono, hayErrores, limpiarTexto } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from './comun'

export interface DatosUsuario {
  nombre: string
  apellido: string
  email: string
  telefono: string
  cedula: string
  rol: Rol | ''
  /**
   * Adultos mayores a los que tendrá acceso (tabla Vinculo): «familiar_responsable» si es Familiar (permiso explícito),
   * «cuidador_asignado» si es Cuidador y «voluntario_asignado» si es Voluntario. Con otros roles se ignora.
   */
  adultoIds: string[]
  /**
   * Contraseña inicial. Vacía = INVITACIÓN: la cuenta queda "invitado" y la persona la activa desde
   * "Activar mi cuenta" (/registro) eligiendo su propia contraseña (recomendado: el administrador nunca la conoce).
   */
  password: string
}

/** Datos que se pueden editar de un miembro (el rol y los adultos son opcionales: solo se aplican si vienen). */
export type DatosEdicionUsuario = Omit<DatosUsuario, 'password' | 'adultoIds' | 'rol'> & { rol?: Rol | ''; adultoIds?: string[] }

/** Roles que admite una cuenta según su tipo (Familia u Organización). */
export const rolesDeCuenta = (org: Pick<Organizacion, 'tipoCuentaId'> | null | undefined): readonly Rol[] => ROLES_POR_TIPO_CUENTA[tipoDeCuenta(org)]

/** Rol que gestiona los miembros de la cuenta: el Administrador (Organización) o el Coordinador (Familia). */
export const rolGestorDeCuenta = (tipo: TipoCuenta): Rol => (tipo === 'familia' ? 'coordinador' : 'admin')

/** Membresía de la persona en la cuenta: la vigente o, si no hay, la más reciente (historial). */
export function membresiaEnCuenta(membresias: Membresia[], usuarioId: string, orgId: string): Membresia | undefined {
  const propias = membresias.filter((m) => m.usuarioId === usuarioId && m.orgId === orgId)
  return propias.find((m) => m.estado === 'activa') ?? propias.sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))[0]
}

/** Estado de la persona dentro de la cuenta: lo da su membresía (y si aún no activó su acceso, «invitado»). */
export function estadoEnCuenta(u: Pick<Usuario, 'estado'>, m: Pick<Membresia, 'estado'> | undefined): EstadoMiembro {
  if (!m || m.estado !== 'activa' || u.estado === 'inactivo') return 'inactivo'
  return u.estado === 'invitado' ? 'invitado' : 'activo'
}

export function validarUsuario(d: DatosUsuario, usuarios: Usuario[], idActual?: string, conPassword = true, tipo?: TipoCuenta) {
  const correoUsado = usuarios.some((u) => u.id !== idActual && u.email.toLowerCase() === d.email.trim().toLowerCase())
  const rolesValidos: readonly Rol[] = tipo ? ROLES_POR_TIPO_CUENTA[tipo] : ROLES_VALORES
  return {
    nombre: errorNombre(d.nombre, 'nombre'),
    apellido: errorNombre(d.apellido, 'apellido'),
    email: errorEmail(d.email) ?? (correoUsado ? 'Ya existe una cuenta con este correo.' : undefined),
    telefono: errorTelefono(d.telefono),
    cedula: errorCedula(d.cedula, false),
    rol: enLista(d.rol, rolesValidos) ? undefined : tipo ? `Este rol no existe en una cuenta ${TIPO_CUENTA_LABEL[tipo]}.` : 'Selecciona un rol válido.',
    adultoIds: undefined as string | undefined,
    password: conPassword && d.password ? validarPassword(d.password) : undefined,
  }
}
const ROLES_VALORES: readonly Rol[] = ['admin', 'coordinador', 'cuidador', 'voluntario', 'familiar']

/** Días de validez del código de activación de una invitación. */
export const DIAS_CODIGO_ACTIVACION = 7

async function nuevoCodigoActivacion() {
  const codigo = generarCodigo()
  return { codigo, codigoHash: await hashSecreto(codigo, SAL_CODIGOS), expira: new Date(Date.now() + DIAS_CODIGO_ACTIVACION * 86_400_000).toISOString() }
}

/* ───────────── Límites del plan ───────────── */

type DatosUso = Pick<DB, 'adultos' | 'usuarios' | 'membresias' | 'catalogos'>

/**
 * Uso de los límites del plan de la cuenta (usoDelPlan) con la regla V2 del Voluntario ocasional: no paga plan
 * propio, así que no cuenta como usuario. `voluntarios` informa cuántos hay, aparte.
 */
export function usoDeCuenta(db: DatosUso, org: Organizacion | null | undefined) {
  const uso = usoDelPlan(db, org)
  const vivos = new Set(db.usuarios.filter((u) => u.estado !== 'inactivo').map((u) => u.id))
  const activas = db.membresias.filter((m) => m.orgId === org?.id && m.estado === 'activa' && vivos.has(m.usuarioId))
  const usuarios = new Set(activas.filter((m) => m.rol !== 'voluntario').map((m) => m.usuarioId)).size
  const voluntarios = new Set(activas.filter((m) => m.rol === 'voluntario').map((m) => m.usuarioId)).size
  return { ...uso, usuarios, voluntarios, excedeUsuarios: excedeLimite(usuarios, uso.limites.usuarios) }
}

/**
 * Mensaje si sumar a alguien con `rolNuevo` (o pasarlo de `rolActual` a `rolNuevo`) supera los límites del plan;
 * `undefined` si hay cupo. Los voluntarios no cuentan para el límite de usuarios.
 */
export function errorDeCupo(db: DatosUso, org: Organizacion | null | undefined, rolNuevo: Rol, rolActual?: Rol): string | undefined {
  const uso = usoDeCuenta(db, org)
  const { usuarios: limUsuarios, familiares: limFamiliares } = uso.limites
  const cuenta = (r?: Rol) => r !== undefined && r !== 'voluntario'
  if (cuenta(rolNuevo) && !cuenta(rolActual) && limUsuarios != null && uso.usuarios + 1 > limUsuarios) {
    return `Tu plan permite ${limUsuarios} usuarios y ya los alcanzaste. Cambia de plan o desactiva a alguien (los voluntarios no cuentan para este límite).`
  }
  if (rolNuevo === 'familiar' && rolActual !== 'familiar' && limFamiliares != null && uso.familiares + 1 > limFamiliares) {
    return `Tu plan permite ${limFamiliares} familiares y ya los alcanzaste. Cambia de plan o desactiva a un familiar.`
  }
  return undefined
}

/* ───────────── Membresía y vínculos (siempre dentro de un mutate) ───────────── */

/** Cierra la membresía vigente de la persona EN ESA CUENTA (las de otras cuentas no se tocan). */
function cerrarMembresia(db: DB, usuarioId: string, orgId: string, ahora: string) {
  for (const m of db.membresias) {
    if (m.usuarioId === usuarioId && m.orgId === orgId && m.estado === 'activa') {
      m.estado = 'inactiva'
      m.fechaFin = ahora
    }
  }
}

/** Abre una membresía nueva con el rol indicado en la cuenta (cierra antes la vigente de esa cuenta, si la hay). */
function abrirMembresia(db: DB, usuarioId: string, orgId: string, rol: Rol, ahora: string) {
  cerrarMembresia(db, usuarioId, orgId, ahora)
  db.membresias.push({ id: uid('m'), usuarioId, orgId, rol, estado: 'activa', fechaInicio: ahora })
}

/** Ids de los adultos mayores de la cuenta. */
const adultosDeCuenta = (db: DB, orgId: string) => new Set(db.adultos.filter((a) => a.orgId === orgId).map((a) => a.id))

/** Sustituye los vínculos de acceso del rol (familiar responsable, cuidador o voluntario asignado) con los adultos de la cuenta. */
function fijarVinculosDeRol(db: DB, usuarioId: string, rol: Rol, orgId: string, adultoIds: string[], ahora: string) {
  const tipo = VINCULO_DE_ROL[rol]
  if (!tipo) return
  const propios = adultosDeCuenta(db, orgId)
  db.vinculos = db.vinculos.filter((v) => !(v.usuarioId === usuarioId && v.tipoVinculoId === tipo && propios.has(v.adultoId) && !adultoIds.includes(v.adultoId)))
  for (const adultoId of adultoIds) {
    if (db.vinculos.some((v) => v.usuarioId === usuarioId && v.adultoId === adultoId && v.tipoVinculoId === tipo)) continue
    // Un usuario tiene un solo vínculo por adulto (PK Env_Id + User_Id): se reemplaza el anterior.
    db.vinculos = db.vinculos.filter((v) => !(v.usuarioId === usuarioId && v.adultoId === adultoId))
    db.vinculos.push({ usuarioId, adultoId, tipoVinculoId: tipo, creadoEn: ahora })
  }
}

/** Quita los vínculos que otorgan acceso según el rol anterior (al cambiar de rol no se arrastran accesos). Solo en esa cuenta. */
function limpiarVinculosDeAcceso(db: DB, usuarioId: string, rolNuevo: Rol, orgId: string) {
  const propios = adultosDeCuenta(db, orgId)
  db.vinculos = db.vinculos.filter((v) => {
    if (v.usuarioId !== usuarioId || !propios.has(v.adultoId)) return true
    if (v.tipoVinculoId === 'voluntario_asignado') return rolNuevo === 'voluntario'
    if (v.tipoVinculoId === 'cuidador_asignado') return rolNuevo === 'cuidador'
    if (v.tipoVinculoId === 'familiar_responsable') return rolNuevo === 'familiar'
    return true
  })
}

/** Quita todos los vínculos de acceso de la persona con los adultos de la cuenta (al perder el acceso). */
function quitarVinculosDeCuenta(db: DB, usuarioId: string, orgId: string) {
  const propios = adultosDeCuenta(db, orgId)
  db.vinculos = db.vinculos.filter((v) => !(v.usuarioId === usuarioId && propios.has(v.adultoId)))
}

/**
 * Mantiene coherentes los datos desnormalizados de Usuario (cuenta principal y rol) con su membresía vigente:
 * si la cuenta principal ya no está activa para la persona, pasa a la más reciente de las que sí.
 */
function sincronizarPrincipal(db: DB, usuarioId: string) {
  const u = db.usuarios.find((x) => x.id === usuarioId)
  if (!u) return
  const activas = db.membresias.filter((m) => m.usuarioId === usuarioId && m.estado === 'activa').sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))
  const m = activas.find((a) => a.orgId === u.orgId) ?? activas[0]
  if (!m) return
  u.orgId = m.orgId
  u.rol = m.rol
  u.etiqueta = ROL_LABEL[m.rol]
}

/**
 * Estado global de la persona según sus membresías: sin ninguna activa queda «inactivo» (no puede iniciar sesión);
 * al recuperar una, vuelve a «activo» (o «invitado» si nunca activó su cuenta).
 */
function sincronizarEstado(db: DB, usuarioId: string) {
  const u = db.usuarios.find((x) => x.id === usuarioId)
  if (!u) return
  const hayActiva = db.membresias.some((m) => m.usuarioId === usuarioId && m.estado === 'activa')
  if (!hayActiva) {
    if (u.estado !== 'inactivo') u.estado = 'inactivo'
    return
  }
  if (u.estado === 'inactivo') {
    const sinActivar = db.invitaciones.some((i) => i.email.toLowerCase() === u.email.toLowerCase() && i.estado === 'pendiente')
    u.estado = sinActivar ? 'invitado' : 'activo'
  }
}

/** ¿Quedaría la cuenta sin nadie que gestione los miembros? (Administrador en Organización, Coordinador en Familia). */
function ultimoGestor(db: DB, orgId: string, usuarioId: string, tipo: TipoCuenta) {
  const gestor = rolGestorDeCuenta(tipo)
  const otros = db.membresias.filter((m) => m.orgId === orgId && m.estado === 'activa' && m.rol === gestor && m.usuarioId !== usuarioId && db.usuarios.some((u) => u.id === m.usuarioId && u.estado !== 'inactivo'))
  return otros.length === 0
}

const TEXTO_TITULAR = 'La persona titular de la cuenta no puede cambiar de rol ni desactivarse.'

/* ───────────── Alta de miembros (invitación) ───────────── */

export type UsuarioCreado = Usuario & {
  /** Código de activación (solo en invitaciones de personas nuevas); se muestra una única vez. */
  codigoActivacion?: string
  /** La persona ya estaba registrada con ese correo: se le agregó una membresía en esta cuenta. */
  yaExistia?: boolean
}

/**
 * Agrega un miembro a la cuenta del actor (CU-13). Tres casos:
 *  - Persona nueva con invitación: queda «invitado» y se devuelve el `codigoActivacion` (6 dígitos, un solo uso)
 *    que necesitará en /registro. Solo se guarda su hash: debe entregarse en ese momento.
 *  - Persona nueva con contraseña inicial: queda activa.
 *  - Correo de una persona ya registrada (en otra cuenta): no se duplica; se le abre una membresía en esta cuenta.
 * Valida que el rol exista en el tipo de cuenta y que el plan tenga cupo (los voluntarios no cuentan).
 */
export async function crearUsuario(actor: Usuario, d: DatosUsuario): Promise<Resultado<UsuarioCreado>> {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'usuarios:gestionar', 'usuario')
  if (denegado) return denegado
  const db0 = getDB()
  const org = db0.orgs.find((o) => o.id === actor.orgId)
  if (!org) return fallo(ERROR_NO_ENCONTRADO)
  const tipo = tipoDeCuenta(org)
  const email = d.email.trim().toLowerCase()
  const existente = db0.usuarios.find((u) => u.email.toLowerCase() === email)

  const errores: Record<string, string | undefined> = { ...validarUsuario(d, existente ? [] : db0.usuarios, undefined, true, tipo) }
  const rol = d.rol as Rol
  if (existente) {
    // Los datos personales son de la persona: se conservan los que ya tiene.
    Object.assign(errores, { nombre: undefined, apellido: undefined, telefono: undefined, cedula: undefined, password: undefined })
    const m = membresiaEnCuenta(db0.membresias, existente.id, org.id)
    const sinActivar = db0.invitaciones.some((i) => i.estado === 'pendiente' && i.email.toLowerCase() === email)
    if (m?.estado === 'activa') {
      errores.email = existente.estado === 'invitado' ? 'Ya tiene una invitación pendiente en esta cuenta. Genera un código nuevo desde su perfil.' : 'Esta persona ya es miembro de la cuenta.'
    } else if (m) errores.email = 'Esta persona ya estuvo en la cuenta: reactívala desde su perfil en Miembros.'
    else if (existente.estado === 'invitado' || sinActivar) errores.email = 'Este correo aún no activó su cuenta. Podrás agregarlo cuando la active.'
  }
  if (!errores.rol) {
    const cupo = errorDeCupo(db0, org, rol)
    if (cupo) errores.rol = cupo
  }
  const tipoVinculo = enLista(d.rol, ROLES_VALORES) ? VINCULO_DE_ROL[rol] : undefined
  const adultoIds = tipoVinculo ? [...new Set(d.adultoIds)] : []
  if (adultoIds.length) {
    if (!adultoIds.every((id) => db0.adultos.some((a) => a.id === id && a.orgId === org.id))) errores.adultoIds = 'Hay adultos no válidos.'
    const permiso = verificar(actor, rol === 'familiar' ? 'familiares:autorizar' : 'adultos:asignar', 'usuario')
    if (permiso) return permiso
  }
  if (hayErrores(errores)) return fallo(errores.rol && !errores.email ? errores.rol : ERROR_VALIDACION, errores)

  const ahora = new Date().toISOString()

  // Persona ya registrada: una membresía nueva en esta cuenta (V2: un usuario, varias cuentas).
  if (existente) {
    mutate((db) => {
      abrirMembresia(db, existente.id, org.id, rol, ahora)
      fijarVinculosDeRol(db, existente.id, rol, org.id, adultoIds, ahora)
      sincronizarEstado(db, existente.id)
      sincronizarPrincipal(db, existente.id)
      db.notificaciones.push({
        id: uid('nt'),
        usuarioId: existente.id,
        fecha: ahora,
        mensaje: `Te agregaron a «${org.nombre}» como ${ROL_LABEL[rol]}. Cambia de cuenta desde el selector para entrar.`,
        orgId: org.id,
        estado: 'no_leida',
      })
      auditar(db, actor, { accion: 'usuario.crear', entidad: 'usuario', registroId: existente.id, detalle: `Rol ${ROL_LABEL[rol]} · persona ya registrada: se agregó una membresía` })
    })
    return exito({ ...getDB().usuarios.find((u) => u.id === existente.id)!, rol, orgId: org.id, etiqueta: ROL_LABEL[rol], yaExistia: true })
  }

  const usuario: Usuario = {
    id: uid('u'),
    rol,
    nombre: limpiarTexto(d.nombre),
    apellido: limpiarTexto(d.apellido),
    cedula: d.cedula.trim(),
    email,
    telefono: d.telefono.trim(),
    // Invitación: hash aleatorio inutilizable hasta que la persona active su cuenta.
    ...(d.password ? await protegerPassword(d.password) : await protegerPassword(nuevaSal() + nuevaSal())),
    etiqueta: ROL_LABEL[rol],
    estado: d.password ? 'activo' : 'invitado',
    orgId: org.id,
    creadoEn: ahora,
    actualizadoEn: ahora,
  }
  const activacion = usuario.estado === 'invitado' ? await nuevoCodigoActivacion() : undefined
  mutate((db) => {
    db.usuarios.push(usuario)
    abrirMembresia(db, usuario.id, org.id, rol, ahora)
    fijarVinculosDeRol(db, usuario.id, rol, org.id, adultoIds, ahora)
    if (activacion) {
      db.invitaciones.push({ id: uid('inv'), invitadoPor: actor.id, email: usuario.email, rol, nombre: usuario.nombre, apellido: usuario.apellido, estado: 'pendiente', creadaEn: ahora, codigoHash: activacion.codigoHash, expira: activacion.expira })
    }
    auditar(db, actor, { accion: 'usuario.crear', entidad: 'usuario', registroId: usuario.id, detalle: `Rol ${ROL_LABEL[rol]}${usuario.estado === 'invitado' ? ' · invitación enviada' : ''}${adultoIds.length ? ` · ${adultoIds.length} adulto(s) con acceso` : ''}` })
  })
  return exito({ ...usuario, codigoActivacion: activacion?.codigo })
}

/** Genera un nuevo código de activación para un miembro invitado de la cuenta (el anterior deja de servir). */
export async function reenviarInvitacion(actor: Usuario, usuarioId: string): Promise<Resultado<string>> {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'usuarios:gestionar', 'usuario', undefined, usuarioId)
  if (denegado) return denegado
  const db0 = getDB()
  const u = db0.usuarios.find((x) => x.id === usuarioId)
  const m = u ? membresiaEnCuenta(db0.membresias, usuarioId, actor.orgId) : undefined
  if (!u || m?.estado !== 'activa') return fallo(ERROR_NO_ENCONTRADO)
  if (u.estado !== 'invitado') return fallo('La cuenta ya fue activada.')
  const activacion = await nuevoCodigoActivacion()
  mutate((db) => {
    for (const inv of db.invitaciones) if (inv.estado === 'pendiente' && inv.email.toLowerCase() === u.email.toLowerCase()) inv.estado = 'rechazada'
    db.invitaciones.push({ id: uid('inv'), invitadoPor: actor.id, email: u.email, rol: m.rol, nombre: u.nombre, apellido: u.apellido, estado: 'pendiente', creadaEn: new Date().toISOString(), codigoHash: activacion.codigoHash, expira: activacion.expira })
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

/* ───────────── Edición, cambio de rol, estado y baja ───────────── */

/**
 * Edita a un miembro de la cuenta: sus datos personales (solo si esta es su cuenta principal: si pertenece también a
 * otra cuenta, sus datos son suyos) y/o su rol en ESTA cuenta (cierra la membresía vigente y abre otra, y limpia los
 * accesos del rol anterior).
 */
function editarMiembro(actor: Usuario, id: string, datos: DatosEdicionUsuario | null, rolNuevo: Rol | '' | undefined): Resultado<Usuario> {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'usuarios:gestionar', 'usuario', undefined, id)
  if (denegado) return denegado
  const db0 = getDB()
  const org = db0.orgs.find((o) => o.id === actor.orgId)
  const actual = db0.usuarios.find((u) => u.id === id)
  const m = actual ? membresiaEnCuenta(db0.membresias, id, actor.orgId) : undefined
  if (!org || !actual || !m) return fallo(ERROR_NO_ENCONTRADO)
  const tipo = tipoDeCuenta(org)
  const rolActual = m.rol
  const rol = (rolNuevo || rolActual) as Rol
  const cambiaRol = rol !== rolActual
  const propia = actual.orgId === actor.orgId

  let errores: Record<string, string | undefined> = {}
  if (datos && propia) {
    errores = { ...validarUsuario({ ...datos, rol, adultoIds: [], password: '' }, db0.usuarios, id, false, tipo) }
    errores.adultoIds = undefined
    if (!cambiaRol) errores.rol = undefined
  } else if (cambiaRol && !enLista(rol, ROLES_POR_TIPO_CUENTA[tipo])) errores.rol = `Este rol no existe en una cuenta ${TIPO_CUENTA_LABEL[tipo]}.`
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)

  if (cambiaRol) {
    if (m.estado !== 'activa') return fallo('Reactiva a la persona antes de cambiar su rol.')
    if (id === actor.id) return fallo('No puedes cambiar tu propio rol.')
    if (org.usuarioTitularId === id) return fallo(TEXTO_TITULAR)
    if (rolActual === rolGestorDeCuenta(tipo) && ultimoGestor(db0, org.id, id, tipo)) {
      return fallo(`La cuenta debe tener al menos un ${ROL_LABEL[rolGestorDeCuenta(tipo)].toLowerCase()} activo.`)
    }
    const cupo = errorDeCupo(db0, org, rol, rolActual)
    if (cupo) return fallo(cupo, { rol: cupo })
  }
  const adultoIds = datos?.adultoIds
  if (adultoIds?.length) {
    if (!adultoIds.every((a) => db0.adultos.some((x) => x.id === a && x.orgId === org.id))) return fallo(ERROR_VALIDACION, { adultoIds: 'Hay adultos no válidos.' })
    const permiso = verificar(actor, rol === 'familiar' ? 'familiares:autorizar' : 'adultos:asignar', 'usuario', undefined, id)
    if (permiso) return permiso
  }

  let resultado: Usuario | undefined
  mutate((db) => {
    const u = db.usuarios.find((x) => x.id === id)
    if (!u) return
    const ahora = new Date().toISOString()
    let cambioDatos = false
    if (datos && propia) {
      const nuevo = { nombre: limpiarTexto(datos.nombre), apellido: limpiarTexto(datos.apellido), email: datos.email.trim().toLowerCase(), telefono: datos.telefono.trim(), cedula: datos.cedula.trim() }
      cambioDatos = (Object.keys(nuevo) as Array<keyof typeof nuevo>).some((k) => u[k] !== nuevo[k])
      Object.assign(u, nuevo)
    }
    if (cambiaRol) {
      limpiarVinculosDeAcceso(db, id, rol, org.id)
      abrirMembresia(db, id, org.id, rol, ahora)
    }
    if (adultoIds !== undefined) fijarVinculosDeRol(db, id, rol, org.id, VINCULO_DE_ROL[rol] ? adultoIds : [], ahora)
    sincronizarPrincipal(db, id)
    u.actualizadoEn = ahora
    resultado = { ...u, rol, orgId: org.id, etiqueta: ROL_LABEL[rol] }
    if (cambioDatos) auditar(db, actor, { accion: 'usuario.editar', entidad: 'usuario', registroId: id })
    if (cambiaRol) auditar(db, actor, { accion: 'usuario.rol', entidad: 'usuario', registroId: id, detalle: `${ROL_LABEL[rolActual]} → ${ROL_LABEL[rol]}` })
  })
  return resultado ? exito(resultado) : fallo(ERROR_NO_ENCONTRADO)
}

/** Edita datos y rol de un miembro de la cuenta. El cambio de rol abre una membresía nueva y se aplica en todos los módulos. */
export const actualizarUsuario = (actor: Usuario, id: string, d: DatosEdicionUsuario): Resultado<Usuario> => editarMiembro(actor, id, d, d.rol)

/** Cambia solo el rol del miembro en esta cuenta (cierra su membresía vigente y abre otra; se limpian los accesos del rol anterior). */
export const cambiarRolMiembro = (actor: Usuario, id: string, rol: Rol): Resultado<Usuario> => editarMiembro(actor, id, null, rol)

/**
 * Desactiva o reactiva a un miembro EN ESTA CUENTA: cierra su membresía (estado «inactiva» y fecha de fin) o abre una
 * nueva con el mismo rol. El historial se conserva. Si no le queda ninguna cuenta activa, pierde la sesión y no puede
 * volver a entrar; si pertenece a otras cuentas, sigue activo en ellas.
 */
export function cambiarEstadoUsuario(actor: Usuario, id: string, estado: 'activo' | 'inactivo'): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'usuarios:gestionar', 'usuario', undefined, id)
  if (denegado) return denegado
  const db0 = getDB()
  const org = db0.orgs.find((o) => o.id === actor.orgId)
  const u = db0.usuarios.find((x) => x.id === id)
  const m = u ? membresiaEnCuenta(db0.membresias, id, actor.orgId) : undefined
  if (!org || !u || !m) return fallo(ERROR_NO_ENCONTRADO)
  const tipo = tipoDeCuenta(org)
  if (estado === 'inactivo') {
    if (id === actor.id) return fallo('No puedes desactivar tu propia cuenta.')
    if (m.estado !== 'activa') return fallo('Esta persona ya está inactiva en la cuenta.')
    if (org.usuarioTitularId === id) return fallo(TEXTO_TITULAR)
    if (m.rol === rolGestorDeCuenta(tipo) && ultimoGestor(db0, org.id, id, tipo)) return fallo(`La cuenta debe tener al menos un ${ROL_LABEL[rolGestorDeCuenta(tipo)].toLowerCase()} activo.`)
  } else {
    if (m.estado === 'activa') return fallo('Esta persona ya está activa en la cuenta.')
    if (!enLista(m.rol, ROLES_POR_TIPO_CUENTA[tipo])) return fallo(`El rol ${ROL_LABEL[m.rol]} no existe en una cuenta ${TIPO_CUENTA_LABEL[tipo]}: cámbialo antes de reactivar.`)
    const cupo = errorDeCupo(db0, org, m.rol)
    if (cupo) return fallo(cupo)
  }
  mutate((db) => {
    const x = db.usuarios.find((y) => y.id === id)
    if (!x) return
    const ahora = new Date().toISOString()
    if (estado === 'inactivo') {
      cerrarMembresia(db, id, org.id, ahora)
      quitarVinculosDeCuenta(db, id, org.id)
    } else abrirMembresia(db, id, org.id, m.rol, ahora)
    sincronizarEstado(db, id)
    sincronizarPrincipal(db, id)
    x.actualizadoEn = ahora
    auditar(db, actor, { accion: estado === 'activo' ? 'usuario.reactivar' : 'usuario.desactivar', entidad: 'usuario', registroId: id, detalle: `Membresía ${ROL_LABEL[m.rol]}` })
  })
  return exito(undefined)
}

/**
 * Cancela una invitación que nunca se activó: elimina la cuenta pendiente. A cualquier otro miembro NO se le borra
 * nada (su historial se conserva): se le desactiva con `cambiarEstadoUsuario`.
 */
export function eliminarUsuario(actor: Usuario, id: string): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'usuarios:gestionar', 'usuario', undefined, id)
  if (denegado) return denegado
  const db0 = getDB()
  const u = db0.usuarios.find((x) => x.id === id)
  const m = u ? membresiaEnCuenta(db0.membresias, id, actor.orgId) : undefined
  if (!u || !m) return fallo(ERROR_NO_ENCONTRADO)
  if (id === actor.id) return fallo('No puedes eliminar tu propia cuenta desde aquí.')
  const enOtraCuenta = db0.membresias.some((x) => x.usuarioId === id && x.orgId !== actor.orgId)
  if (u.estado !== 'invitado' || enOtraCuenta) return fallo('Para retirar a una persona usa «Desactivar»: su historial se conserva.')
  mutate((db) => {
    db.usuarios = db.usuarios.filter((x) => x.id !== id)
    db.vinculos = db.vinculos.filter((v) => v.usuarioId !== id)
    db.membresias = db.membresias.filter((x) => x.usuarioId !== id)
    for (const inv of db.invitaciones) if (inv.estado === 'pendiente' && inv.email.toLowerCase() === u.email.toLowerCase()) inv.estado = 'rechazada'
    auditar(db, actor, { accion: 'usuario.eliminar', entidad: 'usuario', registroId: id, detalle: `Invitación cancelada · ${u.nombre} ${u.apellido} (${ROL_LABEL[m.rol]})` })
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

/** Datos generales de la cuenta (tabla Cuenta). El tipo de cuenta (Familia u Organización) no se cambia: define sus roles y planes. */
export function actualizarCuenta(actor: Usuario, d: DatosCuenta): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'organizacion:configurar', 'organizacion', undefined, actor.orgId)
  if (denegado) return denegado
  const cat = getDB().catalogos
  const actual = getDB().orgs.find((o) => o.id === actor.orgId)
  const errores = {
    nombre: d.nombre.trim().length >= 3 ? undefined : 'Escribe el nombre de la organización.',
    tipoCuentaId: !actual || d.tipoCuentaId === actual.tipoCuentaId ? undefined : 'El tipo de cuenta no se puede cambiar: define los roles y planes disponibles.',
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
