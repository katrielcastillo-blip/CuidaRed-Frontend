/*
 * MiembroUi.tsx — Piezas visuales de usuarios: chips de rol y estado, avatar de lista y avatar grande.
 * Módulo: admin (RF-09 · CU-13).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { CircleUserRound, UserRound } from 'lucide-react'
import { ROL_LABEL } from '@/domain/auth'
import type { EstadoMiembro, Rol } from '@/domain/types'
import { cn } from '@/lib/cn'

const ESTADO_TXT: Record<EstadoMiembro, string> = { activo: 'Activo', inactivo: 'Inactivo', invitado: 'Invitado' }

export const rolTexto = (r: Rol) => ROL_LABEL[r]
export const estadoTexto = (e: EstadoMiembro) => ESTADO_TXT[e]

// Combinaciones con contraste WCAG AA para texto pequeño.
const ROL_TONO: Record<Rol, string> = {
  admin: 'bg-ink text-white',
  coordinador: 'bg-blue-100 text-navy border border-navy',
  voluntario: 'bg-navy text-blue-100',
  familiar: 'bg-teal-100 text-success-700 border border-teal',
}
const ESTADO_TONO: Record<EstadoMiembro, string> = {
  activo: 'bg-success-700 text-white',
  invitado: 'bg-warning-700 text-white',
  inactivo: 'bg-surface-2 text-ink-2',
}

const CHIP = 'inline-flex items-center justify-center whitespace-nowrap font-bold'
const CHICO = 'px-2 py-0.5 rounded-xl text-[10px] leading-[15px] uppercase tracking-[0.02em]'
const GRANDE = 'min-w-24 min-h-[29px] px-4 py-1 rounded-pill text-sm'

/** Chip de rol (un color por rol; gris si la cuenta está inactiva). `grande` = versión del perfil. */
export function RolBadge({ rol, inactivo, grande }: { rol: Rol; inactivo?: boolean; grande?: boolean }) {
  return <span className={cn(CHIP, grande ? GRANDE : CHICO, inactivo ? ESTADO_TONO.inactivo : ROL_TONO[rol])}>{rolTexto(rol)}</span>
}

/** Chip de estado: Activo verde · Invitado ámbar · Inactivo gris. */
export function EstadoBadge({ estado, grande }: { estado: EstadoMiembro; grande?: boolean }) {
  return <span className={cn(CHIP, grande ? GRANDE : CHICO, ESTADO_TONO[estado])}>{estadoTexto(estado)}</span>
}

/** Avatar de lista: foto si existe; si no, silueta sobre azul (gris si está inactivo). */
export function MiembroAvatar({ src, inactivo, size = 48 }: { src?: string; inactivo?: boolean; size?: number }) {
  return (
    <span
      className={cn(
        'inline-grid place-items-center flex-none overflow-hidden rounded-md border',
        inactivo ? 'bg-surface-2 border-surface-2 text-muted' : 'bg-blue-100 border-blue text-blue',
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <UserRound size={Math.round(size * 0.5)} />}
    </span>
  )
}

/** Avatar grande del perfil (círculo con silueta azul). */
export function MiembroAvatarGrande({ src, size = 128 }: { src?: string; size?: number }) {
  return src ? (
    <span className="block flex-none overflow-hidden rounded-full border-[3px] border-blue-bright" style={{ width: size, height: size }} aria-hidden>
      <img src={src} alt="" className="size-full object-cover" />
    </span>
  ) : (
    <CircleUserRound className="flex-none text-blue-bright" size={size} strokeWidth={1.4} aria-hidden />
  )
}
