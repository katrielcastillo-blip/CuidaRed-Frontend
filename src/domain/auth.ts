/*
 * auth.ts — Autenticación: inicio/cierre de sesión, usuario en sesión e invalidación de sesiones.
 * Módulo: dominio · seguridad (CU-01 · SRS §8.2.2.3.5 b, i, l).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { auditar } from './auditoria'
import { avisar } from './avisos'
import { estaEnLinea } from './conectividad'
import { nombreCompleto, ROL_LABEL } from './nombres'
import { MAX_INTENTOS_LOGIN, MINUTOS_BLOQUEO, verificarSecreto } from './seguridad'
import { abrirSesion, cerrarSesionLocal, claveSesion, fijarMembresiaSesion, getSesion, motivoExpiracion, suscribirSesion, tocarSesion } from './sesion'
import { getDB, mutate, useDB } from './store'
import type { Membresia, Organizacion, Rol, Usuario } from './types'

export { nombreCompleto, ROL_LABEL }

/** Ruta de inicio de cada rol. */
export const HOME_BY_ROL: Record<Rol, string> = {
  voluntario: '/voluntario',
  familiar: '/familiar',
  admin: '/admin',
  coordinador: '/coordinador',
  cuidador: '/cuidador',
}

/** Membresías activas del usuario, de la más reciente a la más antigua. */
export const membresiasActivas = (membresias: Membresia[], usuarioId: string) =>
  membresias.filter((m) => m.usuarioId === usuarioId && m.estado === 'activa').sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))

/**
 * Membresía en la que actúa el usuario: la elegida en la sesión, la que coincide con su cuenta principal o la
 * más reciente. `undefined` si el usuario no tiene historial de membresías (se usan los datos de Usuario);
 * `null` si tiene membresías pero ninguna activa: no puede operar (V2: la baja revoca acceso).
 */
export function membresiaVigente(membresias: Membresia[], u: Pick<Usuario, 'id' | 'orgId' | 'rol'>, preferida?: string): Membresia | null | undefined {
  if (!membresias.some((m) => m.usuarioId === u.id)) return undefined
  const activas = membresiasActivas(membresias, u.id)
  return activas.find((m) => m.id === preferida) ?? activas.find((m) => m.orgId === u.orgId && m.rol === u.rol) ?? activas[0] ?? null
}

/** Usuario tal como actúa en la membresía (rol y cuenta de esa membresía). */
export function usuarioEnMembresia(u: Usuario, m: Membresia | null | undefined): Usuario {
  return m ? { ...u, rol: m.rol, orgId: m.orgId, etiqueta: ROL_LABEL[m.rol] } : u
}

export type AuthResult = { ok: true; user: Usuario } | { ok: false; error: string }

/** Mensaje genérico: no revela si el correo existe ni detalles de la cuenta (SRS §8.2.2.3.5 l). */
export const ERROR_CREDENCIALES = 'Correo o contraseña incorrectos.'

export async function login(email: string, password: string): Promise<AuthResult> {
  if (!estaEnLinea()) return { ok: false, error: 'Necesitas conexión a internet para iniciar sesión.' }
  const e = email.trim().toLowerCase()
  const db = getDB()
  const bloqueo = db.bloqueos[e]
  if (bloqueo?.bloqueadoHasta && Date.parse(bloqueo.bloqueadoHasta) > Date.now()) {
    const min = Math.ceil((Date.parse(bloqueo.bloqueadoHasta) - Date.now()) / 60_000)
    return { ok: false, error: `Demasiados intentos fallidos. Intenta de nuevo en ${min} minuto${min === 1 ? '' : 's'}.` }
  }
  const user = db.usuarios.find((u) => u.email.toLowerCase() === e)
  const valida = user ? await verificarSecreto(password, user.passwordSalt, user.passwordHash) : false

  if (!user || !valida) {
    let bloqueada = false
    mutate((d) => {
      const b = d.bloqueos[e] ?? { fallos: 0 }
      b.fallos += 1
      if (b.fallos >= MAX_INTENTOS_LOGIN) {
        b.bloqueadoHasta = new Date(Date.now() + MINUTOS_BLOQUEO * 60_000).toISOString()
        b.fallos = 0
        bloqueada = true
      }
      d.bloqueos[e] = b
      const actor = user ?? { anonimo: e }
      auditar(d, actor, { accion: bloqueada ? 'sesion.bloqueada' : 'sesion.fallida', entidad: 'sesion', resultado: 'fallo', registroId: user?.id, orgId: user?.orgId })
    })
    return {
      ok: false,
      error: bloqueada ? `Demasiados intentos fallidos. Por seguridad, espera ${MINUTOS_BLOQUEO} minutos antes de intentarlo de nuevo.` : ERROR_CREDENCIALES,
    }
  }
  if (user.estado !== 'activo') {
    mutate((d) => auditar(d, user, { accion: 'sesion.fallida', entidad: 'sesion', resultado: 'denegado', registroId: user.id, detalle: 'Cuenta inactiva' }))
    return { ok: false, error: 'Tu cuenta no está activa. Contacta al administrador de tu organización.' }
  }
  const m = membresiaVigente(db.membresias, user)
  if (m === null) {
    mutate((d) => auditar(d, user, { accion: 'sesion.fallida', entidad: 'sesion', resultado: 'denegado', registroId: user.id, detalle: 'Sin membresías activas' }))
    return { ok: false, error: 'Tu acceso a CuidaRed fue desactivado. Contacta a la persona responsable de tu cuenta.' }
  }
  mutate((d) => {
    delete d.bloqueos[e]
    auditar(d, user, { accion: 'sesion.iniciar', entidad: 'sesion', registroId: user.id, orgId: m?.orgId ?? user.orgId })
  })
  abrirSesion(user.id, m?.id)
  return { ok: true, user: usuarioEnMembresia(user, m) }
}

/**
 * Cambia la cuenta/rol activo (selector de cuenta, CR-177). Devuelve la ruta de inicio del nuevo rol, o null si
 * la membresía no pertenece al usuario en sesión o no está activa.
 */
export function cambiarCuenta(membresiaId: string): string | null {
  const s = getSesion()
  if (!s) return null
  const db = getDB()
  const m = db.membresias.find((x) => x.id === membresiaId && x.usuarioId === s.usuarioId && x.estado === 'activa')
  const user = db.usuarios.find((u) => u.id === s.usuarioId)
  if (!m || !user) return null
  fijarMembresiaSesion(m.id)
  const actor = usuarioEnMembresia(user, m)
  mutate((d) => auditar(d, actor, { accion: 'sesion.cambiar_cuenta', entidad: 'sesion', registroId: user.id, orgId: m.orgId, detalle: `Rol ${ROL_LABEL[m.rol]}` }), { silencioso: true })
  return HOME_BY_ROL[m.rol]
}

export function logout(motivo: 'usuario' | 'inactividad' | 'duracion' | 'cuenta' = 'usuario') {
  const s = getSesion()
  const user = s ? getDB().usuarios.find((u) => u.id === s.usuarioId) : undefined
  if (user) {
    mutate(
      (d) =>
        auditar(d, user, {
          accion: motivo === 'usuario' ? 'sesion.cerrar' : 'sesion.expirar',
          entidad: 'sesion',
          registroId: user.id,
          detalle: motivo === 'usuario' ? undefined : motivo === 'cuenta' ? 'Cuenta desactivada o eliminada' : `Expirada por ${motivo}`,
        }),
      { silencioso: true },
    )
  }
  cerrarSesionLocal()
}

const getUsuarioSesionId = () => getSesion()?.usuarioId ?? null

/**
 * Usuario en sesión (o null), actuando con el rol y la cuenta de su membresía activa, y esa cuenta.
 * Una cuenta desactivada o eliminada, o sin membresías activas, no tiene sesión válida.
 */
export function useSession(): { user: Usuario | null; org: Organizacion | null; membresia: Membresia | null } {
  const clave = useSyncExternalStore(suscribirSesion, claveSesion, claveSesion)
  const usuarios = useDB((s) => s.usuarios)
  const orgs = useDB((s) => s.orgs)
  const membresias = useDB((s) => s.membresias)
  return useMemo(() => {
    const [usuarioId, membresiaId] = clave ? clave.split('|') : []
    const encontrado = usuarios.find((u) => u.id === usuarioId) ?? null
    if (!encontrado || encontrado.estado !== 'activo') return { user: null, org: null, membresia: null }
    const m = membresiaVigente(membresias, encontrado, membresiaId || undefined)
    if (m === null) return { user: null, org: null, membresia: null }
    const user = usuarioEnMembresia(encontrado, m)
    const org = orgs.find((o) => o.id === user.orgId) ?? null
    return { user, org, membresia: m ?? null }
  }, [clave, usuarios, orgs, membresias])
}

/** Cuentas en las que el usuario en sesión puede actuar (selector de cuenta, CR-177). */
export function useMisCuentas(): Array<{ membresia: Membresia; org: Organizacion | undefined; activa: boolean }> {
  const { user, membresia } = useSession()
  const membresias = useDB((s) => s.membresias)
  const orgs = useDB((s) => s.orgs)
  return useMemo(() => {
    if (!user) return []
    return membresiasActivas(membresias, user.id).map((m) => ({ membresia: m, org: orgs.find((o) => o.id === m.orgId), activa: m.id === membresia?.id }))
  }, [user, membresia, membresias, orgs])
}

/** Para pantallas dentro de un rol: lanza si no hay sesión (el guard del router lo evita). */
export function useUser(): Usuario {
  const { user } = useSession()
  if (!user) throw new Error('useUser: no hay sesión activa')
  return user
}

/**
 * Vigila la sesión: la cierra por inactividad, por duración máxima o si la cuenta se desactiva/elimina
 * (SRS §8.2.2.3.5 i). Montado una vez en App.
 */
export function useVigilanciaSesion() {
  const sessionUserId = useSyncExternalStore(suscribirSesion, getUsuarioSesionId, getUsuarioSesionId)
  const usuarios = useDB((s) => s.usuarios)
  const membresias = useDB((s) => s.membresias)

  // Cuenta desactivada o eliminada (o sin membresías activas) mientras tenía la sesión abierta.
  useEffect(() => {
    if (!sessionUserId) return
    const u = usuarios.find((x) => x.id === sessionUserId)
    const sinAcceso = !u || u.estado !== 'activo' || membresiaVigente(membresias, u, getSesion()?.membresiaId) === null
    if (sinAcceso && getSesion()?.usuarioId === sessionUserId) {
      logout('cuenta')
      avisar('Tu sesión se cerró porque tu cuenta ya no está activa.', 'error')
    }
  }, [sessionUserId, usuarios, membresias])

  // Expiración por inactividad / duración y registro de actividad.
  useEffect(() => {
    if (!sessionUserId) return
    const actividad = () => tocarSesion()
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    eventos.forEach((ev) => window.addEventListener(ev, actividad, { passive: true }))
    const revisar = () => {
      const s = getSesion()
      if (!s) return
      const motivo = motivoExpiracion(s)
      if (motivo) {
        logout(motivo)
        avisar(motivo === 'inactividad' ? 'Tu sesión expiró por inactividad. Vuelve a iniciar sesión.' : 'Tu sesión expiró. Vuelve a iniciar sesión.', 'info')
      }
    }
    revisar()
    const t = setInterval(revisar, 30_000)
    return () => {
      clearInterval(t)
      eventos.forEach((ev) => window.removeEventListener(ev, actividad))
    }
  }, [sessionUserId])
}
