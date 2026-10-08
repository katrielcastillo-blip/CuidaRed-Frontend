import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Smile, X } from 'lucide-react'
import styles from './Overlay.module.css'

/* ───────────── Modal / Sheet ─────────────
 * Sheet: panel inferior en móvil, diálogo centrado en tablet/escritorio. Cierra con Esc y clic en el fondo.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={styles.sheet}>
        <div className={styles.sheetHead}>
          <h2 className={styles.sheetTitle}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
        {footer && <div className={styles.sheetFoot}>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ───────────── SuccessOverlay ─────────────
 * Pantallas "Visita registrada correctamente!", "Necesidad registrada correctamente!", "Miembro eliminado…":
 * tarjeta blanca con carita sonriente sobre degradado azul. Se renderiza a pantalla completa por encima del contenido.
 */
export function SuccessOverlay({
  open,
  message,
  onDone,
  duration = 2200,
  icon,
}: {
  open: boolean
  message: string
  onDone: () => void
  duration?: number
  icon?: ReactNode
}) {
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => done.current(), duration)
    return () => clearTimeout(t)
  }, [open, duration])

  if (!open) return null
  return createPortal(
    <div className={styles.success} role="status" aria-live="polite" onClick={onDone}>
      <div className={styles.successCard}>
        {icon ?? <Smile size={56} strokeWidth={1.6} aria-hidden />}
        <p>{message}</p>
      </div>
    </div>,
    document.body,
  )
}

/* ───────────── Toast ───────────── */
type Toast = { id: number; text: string; tone: 'ok' | 'error' }
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => {})

/** const toast = useToast(); toast('Guardado') */
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, text, tone }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className={styles.toasts} aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={`${styles.toast} ${t.tone === 'error' ? styles.toastErr : ''}`}>
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}
