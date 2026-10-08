import { useId, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import styles from './TileSelect.module.css'

export interface TileOpcion<T extends string> {
  value: T
  label: string
  icon: LucideIcon
  /** Color del tile cuando está seleccionado (por defecto navy). */
  tone?: 'success' | 'warning' | 'danger'
}

/**
 * Grupo de tiles con icono (tipos de necesidad, estado del adulto en la visita). Un solo valor seleccionable.
 * `columnas` = columnas en móvil; `columnasWide` = columnas desde 768px (una sola fila en escritorio).
 */
export function TileSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  columnas = 3,
  columnasWide,
  error,
}: {
  value: T | ''
  onChange: (v: T) => void
  options: Array<TileOpcion<T>>
  label: string
  columnas?: number
  columnasWide?: number
  error?: string
}) {
  const id = useId()
  const vars = { '--cols': columnas, '--cols-wide': columnasWide ?? columnas } as CSSProperties
  return (
    <div className={styles.wrap}>
      <span className={styles.label} id={id}>
        {label}
      </span>
      <div className={styles.grid} style={vars} role="radiogroup" aria-labelledby={id}>
        {options.map((o) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              className={`${styles.tile} ${on ? `${styles.on} ${o.tone ? styles[o.tone] : ''}` : ''}`}
              onClick={() => onChange(o.value)}
            >
              <o.icon size={24} aria-hidden />
              <span>{o.label}</span>
            </button>
          )
        })}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
