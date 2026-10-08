import { FileText, X } from 'lucide-react'
import { esMiniatura } from '../lib/evidencias'
import styles from './EvidenciasLista.module.css'

/** Evidencias adjuntas: miniaturas de imágenes o chips con el nombre del archivo. Con `onQuitar` se pueden eliminar. */
export function EvidenciasLista({ items, onQuitar }: { items: string[]; onQuitar?: (i: number) => void }) {
  if (items.length === 0) return null
  return (
    <ul className={styles.lista} aria-label="Evidencias adjuntas">
      {items.map((ev, i) => (
        <li key={`${i}-${ev.slice(0, 24)}`} className={styles.item}>
          {esMiniatura(ev) ? (
            <img src={ev} alt={`Evidencia ${i + 1}`} className={styles.img} />
          ) : (
            <span className={styles.archivo}>
              <FileText size={20} aria-hidden />
              <span>{ev}</span>
            </span>
          )}
          {onQuitar && (
            <button type="button" className={styles.quitar} onClick={() => onQuitar(i)} aria-label={`Quitar evidencia ${i + 1}`}>
              <span className={styles.quitarIcono}>
                <X size={14} aria-hidden />
              </span>
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
