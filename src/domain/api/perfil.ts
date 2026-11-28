/*
 * perfil.ts — Servicios del perfil propio (CU-01 · HU-01 · RF-1.4): editar mis datos y desactivar mi cuenta.
 * Módulo: dominio · servicios (Reglas de Negocio V2 §Membresía: desactivar conserva el historial).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * A diferencia de usuarios.ts (gestión de otras personas, permiso `usuarios:gestionar`), aquí cualquier rol actúa
 * solo sobre SU propio registro: se exige conexión y una cuenta activa con membresía vigente. El cambio de
 * contraseña propio vive en usuarios.ts (`cambiarPassword`).
 *
 * "Eliminar cuenta" del CU-01 se implementa como DESACTIVAR (V2): las membresías pasan a `inactiva` con `fechaFin`
 * y el usuario a `inactivo`. Las visitas, necesidades, vínculos y auditoría que dejó se conservan; solo la
 * persona responsable de la cuenta puede reactivarlo (usuarios.ts → `cambiarEstadoUsuario`).
 */
import { auditar } from '../auditoria'
import { logout, membresiaVigente, membresiasActivas, usuarioEnMembresia } from '../auth'
import { estaEnLinea } from '../conectividad'
import { ROL_LABEL } from '../nombres'
import { verificarSecreto } from '../seguridad'
import { getDB, MENSAJE_SIN_CONEXION, mutate } from '../store'
import { pendientesDelUsuario } from '../sync'
import type { DB, Usuario } from '../types'
import { errorNombre, errorTelefono, hayErrores, limpiarTexto } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_PERMISO, ERROR_VALIDACION, exito, fallo, sinConexion, type Resultado } from './comun'

/* ───────────── Editar mis datos ───────────── */

export interface DatosMiPerfil {
  nombre: string
  apellido: string
  telefono: string
  /** Foto de perfil (dataURL de imagen); vacío o ausente = sin foto. */
  avatar?: string
}

/** Tope de la foto guardada (dataURL): `leerAvatar` la reduce a 256 px, así que esto solo frena valores manipulados. */
const MAX_AVATAR = 600_000
const AVATAR_VALIDO = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/

/** Validación pura de los datos editables (la usan el formulario y el servicio). El correo y la cédula no se editan aquí. */
export function validarMiPerfil(d: Pick<DatosMiPerfil, 'nombre' | 'apellido' | 'telefono'> & { avatar?: string }) {
  const avatar = d.avatar ? (d.avatar.length > MAX_AVATAR ? 'La foto es demasiado pesada. Elige otra.' : !AVATAR_VALIDO.test(d.avatar) ? 'La foto no es válida. Elige una imagen JPG, PNG o WebP.' : undefined) : undefined
  return {
    nombre: errorNombre(d.nombre, 'nombre'),
    apellido: errorNombre(d.apellido, 'apellido'),
    telefono: errorTelefono(d.telefono),
    avatar,
  }
}

/**
 * Perfil propio: cualquier rol puede editar sus datos y desactivar su cuenta, pero solo la suya, con la cuenta
 * activa y con una membresía vigente (un usuario desactivado no puede operar). Si falla, deja constancia del
 * intento denegado (igual que `verificar`).
 */
function verificarPropia(actor: Usuario | null | undefined): Resultado<never> | null {
  const db = getDB()
  const u = actor ? db.usuarios.find((x) => x.id === actor.id) : undefined
  if (actor && u && u.estado === 'activo' && membresiaVigente(db.membresias, u) !== null) return null
  if (actor && estaEnLinea()) {
    mutate((d) => auditar(d, actor, { accion: 'acceso.denegado', entidad: 'usuario', registroId: actor.id, resultado: 'denegado', detalle: 'Perfil propio: la cuenta no está activa' }), { silencioso: true })
  }
  return fallo(ERROR_PERMISO)
}

/** Actualiza nombre, apellido, teléfono y foto del propio usuario (RF-1.4). Requiere conexión. */
export function actualizarMiPerfil(actor: Usuario, d: DatosMiPerfil): Resultado<Usuario> {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificarPropia(actor)
  if (denegado) return denegado
  const errores = validarMiPerfil(d)
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)

  let resultado: Usuario | undefined
  const escrito = mutate((db) => {
    const u = db.usuarios.find((x) => x.id === actor.id)
    if (!u) return
    const nombre = limpiarTexto(d.nombre)
    const apellido = limpiarTexto(d.apellido)
    const telefono = d.telefono.trim()
    const cambios: string[] = []
    if (u.nombre !== nombre) cambios.push('nombre')
    if (u.apellido !== apellido) cambios.push('apellido')
    if (u.telefono !== telefono) cambios.push('teléfono')
    if ((u.avatar ?? '') !== (d.avatar ?? '')) cambios.push('foto')
    u.nombre = nombre
    u.apellido = apellido
    u.telefono = telefono
    if (d.avatar) u.avatar = d.avatar
    else delete u.avatar
    u.actualizadoEn = new Date().toISOString()
    resultado = u
    auditar(db, actor, { accion: 'usuario.editar', entidad: 'usuario', registroId: u.id, detalle: `Edición del propio perfil${cambios.length ? ` · ${cambios.join(', ')}` : ''}` })
  })
  if (!escrito) return fallo(MENSAJE_SIN_CONEXION)
  return resultado ? exito(resultado) : fallo(ERROR_NO_ENCONTRADO)
}

/* ───────────── Desactivar mi cuenta ───────────── */

export interface BloqueoDesactivacion {
  tipo: 'titular' | 'ultimo_admin'
  orgId: string
  /** Nombre de la cuenta (Familia u Organización) que impide desactivar. */
  cuenta: string
  mensaje: string
}

/**
 * Motivos por los que el usuario NO puede desactivar su cuenta todavía (V2): ser el titular de una cuenta
 * (`usuarioTitularId`: no puede quedar sin titular) o ser el único administrador activo de una organización.
 * Función pura: la usan la pantalla (para avisar antes) y el servicio (para garantizarlo).
 */
export function bloqueosDesactivacion(db: Pick<DB, 'orgs' | 'membresias' | 'usuarios'>, usuarioId: string): BloqueoDesactivacion[] {
  const bloqueos: BloqueoDesactivacion[] = []
  for (const org of db.orgs) {
    if (org.usuarioTitularId === usuarioId) {
      bloqueos.push({
        tipo: 'titular',
        orgId: org.id,
        cuenta: org.nombre,
        mensaje: `Eres la persona titular de «${org.nombre}». Una cuenta no puede quedar sin titular: transfiere la titularidad a otra persona antes de desactivar tu cuenta.`,
      })
      continue
    }
    const admins = db.membresias.filter((m) => m.orgId === org.id && m.rol === 'admin' && m.estado === 'activa' && db.usuarios.some((u) => u.id === m.usuarioId && u.estado === 'activo'))
    if (admins.length === 1 && admins[0]!.usuarioId === usuarioId) {
      bloqueos.push({
        tipo: 'ultimo_admin',
        orgId: org.id,
        cuenta: org.nombre,
        mensaje: `Eres la única persona administradora activa de «${org.nombre}». Designa a otra persona como administradora antes de desactivar tu cuenta.`,
      })
    }
  }
  return bloqueos
}

/**
 * Desactiva la cuenta del propio usuario (reemplaza "Eliminar cuenta", CU-01): pide la contraseña actual, marca
 * inactivas todas sus membresías activas (`fechaFin`), pone `Usuario.estado` en `inactivo`, audita
 * `cuenta.desactivar` (una entrada por cuenta) y cierra la sesión. El historial se conserva. Bloqueado si es titular
 * de una cuenta, único administrador de una organización o si tiene registros sin sincronizar.
 */
export async function desactivarMiCuenta(actor: Usuario, password: string): Promise<Resultado> {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificarPropia(actor)
  if (denegado) return denegado
  const u = getDB().usuarios.find((x) => x.id === actor.id)
  if (!u) return fallo(ERROR_NO_ENCONTRADO)

  const bloqueos = bloqueosDesactivacion(getDB(), u.id)
  if (bloqueos.length) return fallo(bloqueos.map((b) => b.mensaje).join(' '))
  const pendientes = pendientesDelUsuario(u.id).length
  if (pendientes) {
    return fallo(`Tienes ${pendientes} registro${pendientes === 1 ? '' : 's'} sin sincronizar. Sincronízalos antes de desactivar tu cuenta para no perderlos.`)
  }
  if (!password) return fallo(ERROR_VALIDACION, { password: 'Escribe tu contraseña actual para confirmar.' })
  if (!(await verificarSecreto(password, u.passwordSalt, u.passwordHash))) return fallo(ERROR_VALIDACION, { password: 'La contraseña no es correcta.' })

  const escrito = mutate((db) => {
    const x = db.usuarios.find((y) => y.id === u.id)
    if (!x) return
    const ahora = new Date().toISOString()
    const abiertas = membresiasActivas(db.membresias, x.id)
    for (const m of abiertas) {
      m.estado = 'inactiva'
      m.fechaFin = ahora
    }
    x.estado = 'inactivo'
    x.actualizadoEn = ahora
    // Una entrada en la auditoría de cada cuenta, con el rol que tenía en ella.
    for (const m of abiertas) {
      const cuenta = db.orgs.find((o) => o.id === m.orgId)?.nombre ?? 'cuenta'
      auditar(db, usuarioEnMembresia(x, m), {
        accion: 'cuenta.desactivar',
        entidad: 'usuario',
        registroId: x.id,
        orgId: m.orgId,
        detalle: `Desactivó su propia cuenta (${ROL_LABEL[m.rol]} en «${cuenta}»). El historial se conserva.`,
      })
    }
    if (!abiertas.length) auditar(db, x, { accion: 'cuenta.desactivar', entidad: 'usuario', registroId: x.id, detalle: 'Desactivó su propia cuenta. El historial se conserva.' })
  })
  if (!escrito) return fallo(MENSAJE_SIN_CONEXION)
  logout('cuenta')
  return exito(undefined)
}
