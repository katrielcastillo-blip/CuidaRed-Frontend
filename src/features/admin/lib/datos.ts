import { useMemo } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { useSession } from '@/domain/auth'
import { useDB } from '@/domain/store'
import { fechaCorta } from '@/domain/dates'
import type { Usuario } from '@/domain/types'

/* ───────────── Utilidades de texto y fecha ───────────── */

/** Minúsculas y sin tildes: para búsquedas tolerantes ("jose" encuentra "José"). */
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export const pad2 = (n: number) => String(n).padStart(2, '0')

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const mesCorto = (mes: number) => MESES_CORTOS[mes] ?? ''

/** "Hace 10 min" · "Hace 2 horas" · "Ayer" · "Hace 3 días" · "24/08/2026". */
export function hace(iso: string, ahora: Date = new Date()) {
  const d = new Date(iso)
  const min = Math.floor((ahora.getTime() - d.getTime()) / 60000)
  if (min < 1) return 'Hace un momento'
  if (min < 60) return `Hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return h === 1 ? 'Hace 1 hora' : `Hace ${h} horas`
  const dias = Math.round(
    (new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000,
  )
  if (dias <= 1) return 'Ayer'
  if (dias < 7) return `Hace ${dias} días`
  return fechaCorta(d)
}

/** "Carmen Rodríguez" → "Carmen R." (como en las tarjetas de alerta del Figma). */
export const nombreCorto = (a: { nombre: string; apellido: string }) =>
  `${a.nombre}${a.apellido ? ` ${a.apellido.trim()[0]!.toUpperCase()}.` : ''}`

/** Contraseña aleatoria para cuentas invitadas (el miembro define la suya al registrarse). */
export function passwordAleatoria() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)
}

/** Vuelve a la pantalla anterior; si se entró directamente por URL, va a `fallback`. */
export function volver(navigate: NavigateFunction, fallback: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (idx > 0) navigate(-1)
  else navigate(fallback, { replace: true })
}

/* ───────────── Validaciones ───────────── */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Teléfono dominicano: 10 dígitos (o 11 con el 1 inicial); admite espacios, guiones y paréntesis. */
export function telefonoValido(t: string) {
  const d = t.replace(/\D/g, '')
  return d.length === 10 || (d.length === 11 && d.startsWith('1'))
}

/* ───────────── Miembros ───────────── */

/** Miembro = usuario de la organización con rol cuidador o coordinador (y cualquier invitado pendiente). */
export const esMiembro = (u: Usuario, orgId: string) =>
  u.orgId === orgId && u.rol !== 'admin' && (u.rol === 'cuidador' || u.rol === 'coordinador' || u.estado === 'invitado')

export function useMiembros(): Usuario[] {
  const { org } = useSession()
  const usuarios = useDB((s) => s.usuarios)
  return useMemo(() => (org ? usuarios.filter((u) => esMiembro(u, org.id)) : []), [usuarios, org])
}
