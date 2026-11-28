/*
 * Opcion.tsx — Tarjeta de opción seleccionable con ícono (Figma «Opción»): Normal / Seleccionada.
 * La selección se indica con borde grueso, fondo, color Y una marca de verificación (nunca solo color).
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icono, type NombreIcono } from './Icono'

/**
 * Úsala en una rejilla (`grid grid-cols-2 gap-3`). Por defecto es un botón de alternar (`aria-pressed`);
 * dentro de un `role="radiogroup"` pasa `role="radio"` y se expone con `aria-checked`.
 */
export function Opcion({
  icono,
  seleccionada = false,
  children,
  className,
  role,
  type = 'button',
  ...rest
}: {
  icono?: NombreIcono | ReactNode
  seleccionada?: boolean
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const esRadio = role === 'radio'
  return (
    <button
      type={type}
      role={role}
      aria-pressed={esRadio ? undefined : seleccionada}
      aria-checked={esRadio ? seleccionada : undefined}
      className={cn(
        'relative flex min-h-[104px] flex-col items-center justify-center gap-2.5 rounded-2xl text-center text-tarjeta transition',
        'disabled:opacity-55 disabled:cursor-not-allowed',
        seleccionada
          ? 'border-2 border-blue-principal bg-blue-100 px-[11px] py-[19px] text-navy'
          : 'border border-line bg-surface px-3 py-5 text-ink hover:bg-blue-100/50',
        className,
      )}
      {...rest}
    >
      {seleccionada && <Icono nombre="check_circle" tamano={20} className="absolute right-2 top-2 text-blue-principal" />}
      {icono !== undefined && (
        <span className={cn('flex-none', seleccionada ? 'text-navy' : 'text-ink')} aria-hidden>
          {typeof icono === 'string' ? <Icono nombre={icono as NombreIcono} tamano={32} /> : icono}
        </span>
      )}
      <span className="min-w-0 wrap-anywhere">{children}</span>
    </button>
  )
}
