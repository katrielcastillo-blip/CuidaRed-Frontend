import { login, type AuthResult } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import { getDB, mutate, uid } from '@/domain/store'
import type { Rol } from '@/domain/types'
import { normalizarEmail } from './validar'

/** Datos del paso 1 del registro (se conservan en sessionStorage entre pantallas). */
export interface DatosPersonales {
  cedula: string
  nombre: string
  apellido: string
  telefono: string
}

const KEY = 'cuidared:registro'

export function leerBorrador(): DatosPersonales | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<DatosPersonales>
    if (!d.cedula || !d.nombre || !d.apellido || !d.telefono) return null
    return { cedula: d.cedula, nombre: d.nombre, apellido: d.apellido, telefono: d.telefono }
  } catch {
    return null
  }
}

export function guardarBorrador(d: DatosPersonales) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* modo privado: el flujo sigue en memoria de la sesión de navegación */
  }
}

export function limpiarBorrador() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignorar */
  }
}

/**
 * Memoria del paso 2 mientras el usuario lee los Términos o la Política y vuelve.
 * Solo vive en memoria del módulo (la contraseña nunca se escribe en sessionStorage).
 */
export interface BorradorCuenta {
  destino: 'familia' | 'organizacion'
  email: string
  password: string
  confirmar: string
  acepto: boolean
}
let memoriaCuenta: BorradorCuenta | null = null
export const leerMemoriaCuenta = () => memoriaCuenta
export const guardarMemoriaCuenta = (b: BorradorCuenta) => {
  memoriaCuenta = b
}
export const limpiarMemoriaCuenta = () => {
  memoriaCuenta = null
}

export const ETIQUETA_POR_ROL: Record<Rol, string> = {
  cuidador: 'Voluntario',
  familiar: 'Familiar',
  admin: 'Administrador',
  coordinador: 'Coordinador',
}

const ORG_DEMO = 'org-1'

/** Un miembro "invitado" por el admin aún no tiene cuenta: su correo sí puede registrarse. */
export function emailRegistrado(email: string) {
  const e = normalizarEmail(email)
  return getDB().usuarios.some((u) => u.email.toLowerCase() === e && u.estado !== 'invitado')
}

/**
 * Crea la cuenta del paso 2. Si hay una invitación pendiente para ese correo se toma su rol y su familia
 * (y la invitación pasa a "aceptada"); si no, el rol es familiar. Si el admin ya había creado al miembro
 * como "invitado", se activa ese mismo usuario (conserva id, rol y organización). Inicia sesión al terminar.
 */
export function registrarCuenta(datos: DatosPersonales, email: string, password: string): AuthResult {
  if (emailRegistrado(email)) return { ok: false, error: 'Ya existe una cuenta con este correo.' }
  const e = normalizarEmail(email)
  const invitacion = getDB().invitaciones.find((i) => i.estado === 'pendiente' && i.email.toLowerCase() === e)
  const invitado = getDB().usuarios.find((u) => u.email.toLowerCase() === e && u.estado === 'invitado')
  const rol: Rol = invitado?.rol ?? invitacion?.rol ?? 'familiar'
  const familia = invitacion ? getDB().familias.find((f) => f.id === invitacion.familiaId) : undefined
  const familiaIds = invitacion?.familiaId ? [invitacion.familiaId] : []

  mutate((db) => {
    const inv = invitacion ? db.invitaciones.find((i) => i.id === invitacion.id) : undefined
    if (inv) inv.estado = 'aceptada'
    const existente = invitado ? db.usuarios.find((u) => u.id === invitado.id) : undefined
    if (existente) {
      Object.assign(existente, {
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        cedula: datos.cedula,
        telefono: datos.telefono,
        password,
        estado: 'activo',
        familiaIds: [...new Set([...existente.familiaIds, ...familiaIds])],
      })
      return
    }
    db.usuarios.push({
      id: uid('u'),
      rol,
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      cedula: datos.cedula,
      email: e,
      telefono: datos.telefono,
      password,
      etiqueta: ETIQUETA_POR_ROL[rol],
      estado: 'activo',
      orgId: familia?.orgId ?? ORG_DEMO,
      familiaIds,
      creadoEn: todayISO(),
    })
  })
  return login(e, password)
}

export interface DatosOrganizacion {
  nombre: string
  tipo: string
  telefono: string
  provincia: string
  municipio: string
}

/** Crea la organización (con configuración por defecto) y su cuenta de administrador; inicia sesión. */
export function registrarOrganizacion(org: DatosOrganizacion, admin: DatosPersonales, email: string, password: string): AuthResult {
  if (emailRegistrado(email)) return { ok: false, error: 'Ya existe una cuenta con este correo.' }
  const e = normalizarEmail(email)
  const orgId = uid('org')
  const nombreOrg = org.nombre.trim()

  mutate((db) => {
    db.orgs.push({
      id: orgId,
      nombre: nombreOrg,
      tipo: org.tipo,
      telefono: org.telefono,
      provincia: org.provincia,
      municipio: org.municipio,
      config: {
        diasSinVisitaAlerta: 15,
        notificarCasosPrioritarios: true,
        notificarNuevosVoluntarios: true,
        contactoInstitucional: { nombre: nombreOrg, telefono: org.telefono },
      },
    })
    db.usuarios.push({
      id: uid('u'),
      rol: 'admin',
      nombre: admin.nombre.trim(),
      apellido: admin.apellido.trim(),
      cedula: admin.cedula,
      email: e,
      telefono: admin.telefono,
      password,
      etiqueta: ETIQUETA_POR_ROL.admin,
      estado: 'activo',
      orgId,
      familiaIds: [],
      creadoEn: todayISO(),
    })
  })
  return login(e, password)
}

export function cedulaRegistrada(cedula: string) {
  return getDB().usuarios.some((u) => u.cedula === cedula)
}
