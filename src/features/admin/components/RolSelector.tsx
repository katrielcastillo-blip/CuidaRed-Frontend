/*
 * RolSelector.tsx — Selector de rol en tarjetas de 48 px (radio accesible). Solo ofrece los roles que existen en el
 * tipo de cuenta (Familia: Coordinador, Cuidador y Familiar; Organización: los 5 roles).
 * Módulo: admin (RF-09 · CU-13 · Reglas de Negocio V2 §Cuenta).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useId } from 'react'
import { Check } from 'lucide-react'
import { HelpTip } from '@/components/ui'
import { ROL_LABEL } from '@/domain/auth'
import type { Rol } from '@/domain/types'
import { cn } from '@/lib/cn'

export function RolSelector({
  valor,
  onChange,
  roles,
  error,
  bloqueado,
  etiqueta = 'Rol',
}: {
  valor: Rol | ''
  onChange: (r: Rol) => void
  /** Roles válidos para el tipo de cuenta, en orden de presentación. */
  roles: readonly Rol[]
  error?: string
  /** Motivo por el que no se puede cambiar el rol (p. ej. tu propia cuenta). */
  bloqueado?: string
  etiqueta?: string
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <span className="flex items-center gap-1 text-base font-semibold text-ink" id={`${id}-l`}>
        {etiqueta}
        <span aria-hidden> *</span>
        <HelpTip label={`Ayuda: ${etiqueta}`}>
          El rol define a qué funciones y datos tendrá acceso la persona en esta cuenta. Puedes cambiarlo después; el cambio se aplica de inmediato en todos los módulos.
        </HelpTip>
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-l`} aria-describedby={error ? `${id}-err` : bloqueado ? `${id}-b` : undefined} className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {roles.map((r) => {
          const on = valor === r
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!!bloqueado && !on}
              onClick={() => onChange(r)}
              className={cn(
                'flex items-center gap-2 min-h-12 px-3 py-2 rounded-sm border text-left text-sm font-semibold leading-tight disabled:opacity-50 disabled:cursor-not-allowed',
                on ? 'bg-navy border-navy text-white' : 'bg-bg text-ink-2',
                error ? 'border-danger' : !on && 'border-line',
              )}
            >
              <span aria-hidden className={cn('grid place-items-center size-5 flex-none rounded-full border-2', on ? 'border-white bg-white text-navy' : 'border-line')}>
                {on && <Check size={12} strokeWidth={4} />}
              </span>
              {ROL_LABEL[r]}
            </button>
          )
        })}
      </div>
      {error ? (
        <p className="text-danger text-sm" role="alert" id={`${id}-err`}>
          {error}
        </p>
      ) : bloqueado ? (
        <p className="text-muted text-sm" id={`${id}-b`}>
          {bloqueado}
        </p>
      ) : null}
    </div>
  )
}
