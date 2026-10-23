/*
 * RiesgoSelector.tsx — Selector del nivel de riesgo (Nivel_Riesgo: bajo / medio / alto) con el indicador de
 * color + forma del SRS §18.4 (RiesgoBadge). Se usa en el formulario de perfil y al registrar un factor de riesgo.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useId, type ReactNode } from 'react'
import { HelpTip, RiesgoBadge } from '@/components/ui'
import type { Riesgo } from '@/domain/types'
import { cn } from '@/lib/cn'

const NIVELES: Riesgo[] = ['bajo', 'medio', 'alto']

export function RiesgoSelector({
  value,
  onChange,
  error,
  label = 'Nivel de riesgo social',
  help,
}: {
  value: Riesgo | ''
  onChange: (r: Riesgo) => void
  error?: string
  label?: string
  help?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <span className="flex items-center gap-1 text-base font-semibold text-ink" id={`${id}-label`}>
        {label}
        <span aria-hidden> *</span>
        <span className="sr-only"> (obligatorio)</span>
        {help && <HelpTip label={`Ayuda: ${label}`}>{help}</HelpTip>}
      </span>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-err` : undefined}>
        {NIVELES.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-invalid={error ? true : undefined}
            aria-label={`Riesgo ${n}`}
            onClick={() => onChange(n)}
            className={cn(
              'grid place-items-center min-h-12 rounded-sm border-2 transition-colors',
              value === n ? 'border-navy bg-blue-100 shadow-1' : error ? 'border-danger bg-bg' : 'border-line-soft bg-bg hover:border-line',
            )}
          >
            <RiesgoBadge riesgo={n} />
          </button>
        ))}
      </div>
      {error && (
        <p className="text-danger text-sm" role="alert" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  )
}
