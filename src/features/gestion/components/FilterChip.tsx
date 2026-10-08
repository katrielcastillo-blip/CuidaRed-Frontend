import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './FilterChip.module.css'

export interface OpcionFiltro<T extends string> {
  value: T
  label: string
}

/**
 * Chip de filtro desplegable («Riesgo: Todos ▾»). Usa un <select> nativo transparente encima,
 * así abre el selector del sistema (móvil) y es accesible por teclado.
 * Se resalta cuando el valor es distinto de `neutro` (por defecto, la primera opción).
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
    <label className={`${styles.chip} ${activo ? styles.activo : ''}`}>
      {icono}
      <span className={styles.texto}>
        <b>{etiqueta}:</b> {actual?.label}
      </span>
      <ChevronDown size={16} aria-hidden />
      <select className={styles.nativo} aria-label={etiqueta} value={value} onChange={(e) => onChange(e.target.value as T)}>
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
export function FilaFiltros({ children }: { children: ReactNode }) {
  return <div className={styles.fila}>{children}</div>
}
