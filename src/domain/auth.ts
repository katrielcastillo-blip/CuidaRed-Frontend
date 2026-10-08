import { useMemo } from 'react'
import { getDB, mutate, useDB } from './store'
import type { Organizacion, Rol, Usuario } from './types'

/** Ruta de inicio de cada rol. */
export const HOME_BY_ROL: Record<Rol, string> = {
  cuidador: '/cuidador',
  familiar: '/familiar',
  admin: '/admin',
  coordinador: '/coordinador',
}

export const ROL_LABEL: Record<Rol, string> = {
  cuidador: 'Cuidador',
  familiar: 'Familiar',
  admin: 'Administrador',
  coordinador: 'Coordinador',
}

export type AuthResult = { ok: true; user: Usuario } | { ok: false; error: string }

export function login(email: string, password: string): AuthResult {
  const e = email.trim().toLowerCase()
  const user = getDB().usuarios.find((u) => u.email.toLowerCase() === e)
  if (!user || user.password !== password) return { ok: false, error: 'Correo o contraseña incorrectos.' }
  if (user.estado === 'inactivo') return { ok: false, error: 'Tu cuenta está inactiva. Contacta a tu organización.' }
  mutate((db) => {
    db.sessionUserId = user.id
  })
  return { ok: true, user }
}

export function logout() {
  mutate((db) => {
    db.sessionUserId = null
  })
}

/** Usuario en sesión (o null) y su organización. */
export function useSession(): { user: Usuario | null; org: Organizacion | null } {
  const sessionUserId = useDB((s) => s.sessionUserId)
  const usuarios = useDB((s) => s.usuarios)
  const orgs = useDB((s) => s.orgs)
  return useMemo(() => {
    const user = usuarios.find((u) => u.id === sessionUserId) ?? null
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

export function nombreCompleto(u: Pick<Usuario, 'nombre' | 'apellido'>) {
  return `${u.nombre} ${u.apellido}`.trim()
}
