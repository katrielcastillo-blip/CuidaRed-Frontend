/* Icono accesible de la familia Material Symbols Outlined, autoalojada y disponible offline. © 2026 Equipo CuidaRed – INTEC. */
import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: number | string
  strokeWidth?: number | string
  absoluteStrokeWidth?: boolean
  fill?: string
  color?: string
  filled?: boolean
}
const tamanos = (size: number | string) => {
  const n = Number(size)
  return n <= 20 ? 'text-[1.25rem]' : n <= 28 ? 'text-[1.5rem]' : n <= 40 ? 'text-[2rem]' : 'text-[3rem]'
}

export const Icon = forwardRef<HTMLSpanElement, IconProps & { name: string }>(function Icon(
  { name, size = 24, filled = false, className, strokeWidth: _strokeWidth, absoluteStrokeWidth: _absolute, fill: _fill, color: _color, ...props }, ref
) {
  return <span ref={ref} {...props} className={cn('cr-symbol', tamanos(size), className)} data-icon={name} data-filled={filled || undefined}
    aria-hidden={props['aria-label'] ? undefined : props['aria-hidden'] ?? true} role={props['aria-label'] ? 'img' : props.role} />
})

export function iconoMaterial(name: string) {
  return forwardRef<HTMLSpanElement, IconProps>(function MaterialIcon(props, ref) {
    return <Icon {...props} name={name} ref={ref} />
  })
}
