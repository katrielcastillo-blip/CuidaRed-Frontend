/*
 * PerfilCabecera.tsx — Bloque superior de Mi perfil / Editar perfil: avatar, nombre, cédula, rol y organización.
 * Módulo: perfil (SRS §18.3: nombre del usuario junto con su rol).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui'

export function PerfilCabecera({
  nombre,
  avatar,
  size,
  cedula,
  rol,
  organizacion,
  fotoAccion,
  children,
}: {
  nombre: string
  avatar?: string
  size: number
  cedula?: string
  /** Etiqueta del rol (ROL_LABEL). */
  rol: string
  organizacion?: string
  /** Editar perfil: botón de lápiz sobre el avatar. */
  fotoAccion?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="flex flex-col items-center gap-1.5 text-center">
      <div className="relative mb-3 flex-none" style={{ width: size, height: size }}>
        <Avatar nombre={nombre} src={avatar} size={size} ring />
        {fotoAccion}
      </div>
      <h2 className="wrap-anywhere text-[1.75rem] font-bold leading-tight text-[#003f9e]">{nombre}</h2>
      {cedula && <p className="font-semibold tracking-[0.02em] text-muted">{cedula}</p>}
      <span className="mt-0.5 inline-flex min-w-[134px] items-center justify-center rounded-pill bg-blue-100 px-5 py-1 font-semibold text-[#1f6fd0]">{rol}</span>
      {organizacion && <p className="text-sm text-ink-2">{organizacion}</p>}
      {children}
    </header>
  )
}
