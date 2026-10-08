import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import styles from './Button.module.css'

type Variant = 'primary' | 'outline' | 'soft' | 'danger' | 'danger-soft' | 'ghost' | 'light'

interface CommonProps {
  variant?: Variant
  fullWidth?: boolean
  size?: 'md' | 'sm'
  icon?: ReactNode
  loading?: boolean
}

const cls = (v: Variant, fullWidth?: boolean, size: 'md' | 'sm' = 'md') =>
  [styles.btn, styles[v], size === 'sm' ? styles.sm : '', fullWidth ? styles.full : ''].join(' ')

/** Botón del sistema. primary = navy sólido · outline = borde navy · soft = verde suave (acciones positivas) · danger-soft = rojo suave. */
export function Button({
  variant = 'primary',
  fullWidth,
  size,
  icon,
  loading,
  children,
  disabled,
  type = 'button',
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cls(variant, fullWidth, size)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden /> : icon}
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
  ...rest
}: CommonProps & LinkProps) {
  return (
    <Link className={cls(variant, fullWidth, size)} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  )
}
