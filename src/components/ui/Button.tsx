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
  'inline-flex items-center justify-center gap-2 border-2 font-semibold text-center select-none transition ' +
  'active:enabled:translate-y-px disabled:opacity-55 disabled:cursor-not-allowed aria-disabled:opacity-55'

// Figma «Botón»: Primario (azul noche sólido) · Secundario (borde azul noche) · Texto (enlace subrayado) · Peligro (rojo pálido con borde rojo).
const VARIANTES: Record<Variant, string> = {
  primary: 'border-transparent bg-navy text-white hover:enabled:bg-navy-700 [&:is(a)]:hover:bg-navy-700',
  outline: 'bg-surface text-navy border-navy hover:bg-blue-100',
  soft: 'bg-teal-100 text-success-700 border-teal hover:brightness-[.97]',
  danger: 'bg-danger-100 text-danger border-danger hover:brightness-[.97]',
  'danger-soft': 'bg-danger-100 text-danger border-danger hover:brightness-[.97]',
  ghost: 'border-transparent bg-transparent text-navy underline underline-offset-[3px] hover:bg-blue-100',
  light: 'bg-blue-100 text-navy border-blue',
}

// Objetivo táctil mínimo de 48 px en todos los tamaños (RF-06 · WCAG 2.5.5). El tamaño md es el del Figma:
// 56 px de alto y texto de 18/24 (text-tarjeta).
const TAMANOS = {
  md: 'min-h-14 px-6 py-3 rounded-md text-tarjeta',
  sm: 'min-h-12 px-4 py-2 rounded-[10px] text-base leading-6',
}

/**
 * Ancho: `fullWidth` true = siempre 100 % · false = ancho del contenido · sin indicar = 100 % en móvil para el
 * tamaño md (como el Figma) y ancho del contenido desde tablet; el tamaño sm siempre ajusta al contenido.
 */
const ancho = (fullWidth: boolean | undefined, size: 'md' | 'sm') =>
  fullWidth ? 'w-full' : fullWidth === undefined && size === 'md' ? 'w-full md:w-auto' : undefined

const cls = (v: Variant, fullWidth?: boolean, size: 'md' | 'sm' = 'md') => {
  const tam = v === 'ghost' ? 'sm' : size
  return cn(BASE, TAMANOS[tam], VARIANTES[v], ancho(fullWidth, tam))
}

/** Botón del sistema. primary = Primario · outline = Secundario · ghost = Texto · danger y danger-soft = Peligro · soft = verde suave (acciones positivas). */
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
