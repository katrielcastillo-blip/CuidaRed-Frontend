/*
 * TileSelect.tsx — Grupo de "tiles" con icono para elegir una sola opción sin escribir (RF-06):
 * estado del adulto durante la visita.
 * Módulo: visitas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useId, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { HelpTip } from '@/components/ui'
import { cn } from '@/lib/cn'

export interface TileOpcion<T extends string> {
  value: T
  label: string
  icon: LucideIcon
  /** Color del tile cuando está seleccionado (por defecto navy). */
  tone?: 'success' | 'warning' | 'danger'
}

const TONO_ON: Record<NonNullable<TileOpcion<string>['tone']> | 'navy', string> = {
  navy: 'bg-navy border-navy text-white',
  success: 'bg-success-700 border-success-700 text-white',
  warning: 'bg-warning-700 border-warning-700 text-white',
  danger: 'bg-danger border-danger text-white',
}

/** Rejilla de tres tiles de ≥ 64 px de alto (objetivo táctil amplio). Navegable con teclado: es un radiogroup de botones. */
export function TileSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  error,
  help,
  required,
}: {
  value: T | ''
  onChange: (v: T) => void
  options: Array<TileOpcion<T>>
  label: string
  error?: string
  help?: ReactNode
  required?: boolean
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <span className="flex items-center gap-1 text-base font-semibold text-ink" id={id}>
        {label}
        {required && <span aria-hidden> *</span>}
        {help && <HelpTip label={`Ayuda: ${label}`}>{help}</HelpTip>}
      </span>
      <div
        className="grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-labelledby={id}
        aria-describedby={error ? `${id}-err` : undefined}
        aria-required={required || undefined}
      >
        {options.map((o) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              className={cn(
                'flex flex-col items-center justify-center gap-1 min-h-16 px-1 py-2 rounded-sm border text-xs font-bold leading-tight text-center transition-colors',
                on ? cn(TONO_ON[o.tone ?? 'navy'], 'shadow-1') : cn('bg-bg text-ink hover:border-navy', error ? 'border-danger' : 'border-blue'),
              )}
              onClick={() => onChange(o.value)}
            >
              <o.icon size={24} aria-hidden />
              <span className="max-w-full wrap-break-word">{o.label}</span>
            </button>
          )
        })}
      </div>
      {error && (
        <p className="text-danger text-sm" role="alert" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  )
}
