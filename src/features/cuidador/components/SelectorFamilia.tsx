import { useCallback, useState } from 'react'
import { Check } from 'lucide-react'
import type { Familia } from '@/domain/types'
import { Sheet } from '@/components/ui'
import { TODAS } from '../lib/familia'
import styles from './SelectorFamilia.module.css'

/** Selector "▾ Flia. Rodríguez" de la cabecera del Dashboard: abre un Sheet con las familias del usuario y «Todas». */
export function SelectorFamilia({
  familias,
  valor,
  onChange,
}: {
  familias: Familia[]
  valor: string
  onChange: (valor: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const cerrar = useCallback(() => setAbierto(false), [])
  const opciones = [...familias.map((f) => ({ value: f.id, label: f.nombre })), { value: TODAS, label: 'Todas' }]
  const etiqueta = valor === TODAS ? 'Todas las familias' : (familias.find((f) => f.id === valor)?.nombre ?? 'Familia')

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setAbierto(true)} aria-haspopup="dialog" aria-label={`Familia: ${etiqueta}. Cambiar familia`}>
        <svg width="14" height="8" viewBox="0 0 14 8" aria-hidden className={styles.triangulo}>
          <path d="M0 0h14L7 8z" fill="currentColor" />
        </svg>
        <span className={styles.nombre}>{etiqueta}</span>
      </button>

      <Sheet open={abierto} onClose={cerrar} title="Mis familias">
        <div className={styles.lista} role="radiogroup" aria-label="Familia">
          {opciones.map((o) => {
            const on = o.value === valor
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={on}
                className={`${styles.opcion} ${on ? styles.on : ''}`}
                onClick={() => {
                  onChange(o.value)
                  cerrar()
                }}
              >
                <span>{o.label}</span>
                {on && <Check size={20} aria-hidden />}
              </button>
            )
          })}
        </div>
      </Sheet>
    </>
  )
}
