/*
 * Button.tsx — Botones del sistema (Button y ButtonLink).
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'outline' | 'soft' | 'danger' | 'danger-soft' | 'ghost' | 'light'

interface CommonProps {
  variant?: Variant
  fullWidth?: boolean
  size?: 'md' | 'sm'
  icon?: ReactNode
  loading?: boolean
}

const BASE =
  'inline-flex items-center justify-center gap-2 border-2 font-semibold leading-[1.1] text-center select-none transition ' +
  'active:enabled:translate-y-px disabled:opacity-55 disabled:cursor-not-allowed aria-disabled:opacity-55'

const VARIANTES: Record<Variant, string> = {
  primary: 'border-transparent bg-navy text-white hover:enabled:bg-navy-700 [&:is(a)]:hover:bg-navy-700',
  outline: 'bg-bg text-navy border-navy hover:bg-blue-100',
  soft: 'bg-teal-100 text-success-700 border-teal text-lg hover:brightness-[.97]',
  danger: 'border-transparent bg-danger text-white hover:brightness-95',
  'danger-soft': 'bg-danger-100 text-danger border-danger text-lg hover:brightness-[.97]',
  ghost: 'border-transparent bg-transparent text-navy text-base hover:bg-blue-100',
  light: 'bg-blue-100 text-navy border-blue text-base',
}

// Objetivo táctil mínimo de 48 px en todos los tamaños (RF-06 · WCAG 2.5.5).
const TAMANOS = {
  md: 'min-h-14 px-6 rounded-md text-xl',
  sm: 'min-h-12 px-4 rounded-[10px] text-base',
}

const cls = (v: Variant, fullWidth?: boolean, size: 'md' | 'sm' = 'md') =>
  cn(BASE, TAMANOS[v === 'ghost' ? 'sm' : size], VARIANTES[v], fullWidth && 'w-full')

/** Botón del sistema. primary = navy sólido · outline = borde navy · soft = verde suave (acciones positivas) · danger-soft = rojo suave. */
export function Button({
  variant = 'primary',
  fullWidth,
  size,
  icon,
  loading,
  children,
  disabled,
  className,
  type = 'button',
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(cls(variant, fullWidth, size), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="size-[18px] rounded-full border-[3px] border-current border-r-transparent animate-spin" aria-hidden />
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  )
}

/** Mismo aspecto que Button pero renderiza un <Link>. */
export function ButtonLink({
  variant = 'primary',
  fullWidth,
  size,
  icon,
  children,
  className,
  ...rest
}: CommonProps & LinkProps) {
  return (
    <Link className={cn(cls(variant, fullWidth, size), className)} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  )
}
