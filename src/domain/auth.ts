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
import { abrirSesion, cerrarSesionLocal, getSesion, motivoExpiracion, suscribirSesion, tocarSesion } from './sesion'
import { getDB, mutate, useDB } from './store'
import type { Organizacion, Rol, Usuario } from './types'

export { nombreCompleto, ROL_LABEL }

/** Ruta de inicio de cada rol. */
export const HOME_BY_ROL: Record<Rol, string> = {
  voluntario: '/voluntario',
  familiar: '/familiar',
  admin: '/admin',
  coordinador: '/coordinador',
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
  mutate((d) => {
    delete d.bloqueos[e]
    auditar(d, user, { accion: 'sesion.iniciar', entidad: 'sesion', registroId: user.id })
  })
  abrirSesion(user.id)
  return { ok: true, user }
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

/** Usuario en sesión (o null) y su organización. Una cuenta desactivada o eliminada no tiene sesión válida. */
export function useSession(): { user: Usuario | null; org: Organizacion | null } {
  const sessionUserId = useSyncExternalStore(suscribirSesion, getUsuarioSesionId, getUsuarioSesionId)
  const usuarios = useDB((s) => s.usuarios)
  const orgs = useDB((s) => s.orgs)
  return useMemo(() => {
    const encontrado = usuarios.find((u) => u.id === sessionUserId) ?? null
    const user = encontrado && encontrado.estado === 'activo' ? encontrado : null
    const org = user ? (orgs.find((o) => o.id === user.orgId) ?? null) : null
    return { user, org }
  }, [sessionUserId, usuarios, orgs])
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

  // Cuenta desactivada o eliminada mientras tenía la sesión abierta.
  useEffect(() => {
    if (!sessionUserId) return
    const u = usuarios.find((x) => x.id === sessionUserId)
    if ((!u || u.estado !== 'activo') && getSesion()?.usuarioId === sessionUserId) {
      logout('cuenta')
      avisar('Tu sesión se cerró porque tu cuenta ya no está activa.', 'error')
    }
  }, [sessionUserId, usuarios])

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
