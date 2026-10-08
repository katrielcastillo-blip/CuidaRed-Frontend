import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import styles from './Nota.module.css'

/** Caja informativa azul con icono «i» (nota de invitación, umbrales de alerta). */
export function Nota({ children }: { children: ReactNode }) {
  return (
    <div className={styles.nota} role="note">
      <Info size={20} className={styles.icono} aria-hidden />
      <p>{children}</p>
    </div>
  )
}
