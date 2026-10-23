/*
 * FilterChip.tsx — Chip de filtro desplegable («Riesgo: Todos ▾») y fila de chips.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface OpcionFiltro<T extends string> {
  value: T
  label: string
}

/**
 * Usa un <select> nativo transparente encima del chip: abre el selector del sistema (móvil) y es accesible
 * por teclado. Objetivo táctil de 48 px. Se resalta cuando el valor es distinto de `neutro` (por defecto, la
 * primera opción).
 */
export function FilterChip<T extends string>({
  etiqueta,
  value,
  onChange,
  opciones,
  neutro,
  icono,
}: {
  etiqueta: string
  value: T
  onChange: (v: T) => void
  opciones: Array<OpcionFiltro<T>>
  neutro?: T
  icono?: ReactNode
}) {
  const actual = opciones.find((o) => o.value === value)
  const activo = value !== (neutro ?? opciones[0]?.value)
  return (
    <label
      className={cn(
        'relative inline-flex items-center gap-1.5 min-h-12 max-w-full pl-3.5 pr-2.5 rounded-pill border text-sm whitespace-nowrap cursor-pointer',
        'focus-within:outline-3 focus-within:outline-blue focus-within:outline-offset-2 [&>svg]:flex-none [&>svg]:text-navy',
        activo ? 'bg-blue-100 border-navy text-navy' : 'bg-surface-2 border-ink-2 text-ink',
      )}
    >
      {icono && <span className="hidden sm:inline-flex text-navy">{icono}</span>}
      <span className="overflow-hidden text-ellipsis">
        <b className="font-bold">{etiqueta}:</b> {actual?.label}
      </span>
      <ChevronDown size={16} aria-hidden />
      <select
        className="absolute inset-0 size-full opacity-0 cursor-pointer text-base appearance-none border-0 bg-transparent"
        aria-label={etiqueta}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Fila de chips con salto de línea (sin scroll horizontal). */
export function FilaFiltros({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap gap-2', className)}>{children}</div>
}
