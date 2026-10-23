/*
 * Overlay.tsx — Capas superpuestas: Sheet (panel/diálogo), SuccessOverlay, ToastProvider/useToast.
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Smile, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { EVENTO_TOAST, type ToastTone } from '@/domain/avisos'

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/45 animate-fade md:items-center md:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-h-[88vh] flex flex-col bg-bg rounded-t-lg shadow-2 pb-safe outline-none animate-up md:max-w-[520px] md:rounded-lg md:animate-pop"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" className="size-12 grid place-items-center rounded-full text-ink hover:bg-surface-2" onClick={onClose} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>
        <div className="flex flex-col gap-4 px-5 pt-2 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="flex gap-3 px-5 pt-4 pb-5 border-t border-surface-2 [&>*]:flex-1">{footer}</div>}
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
  detail,
}: {
  open: boolean
  message: string
  onDone: () => void
  duration?: number
  icon?: ReactNode
  /** Texto secundario (p. ej. "Pendiente de sincronización"). */
  detail?: ReactNode
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
    <div
      className="fixed inset-0 z-[60] grid place-items-center p-6 bg-blue/55 backdrop-blur-[2px] animate-fade cursor-pointer"
      role="status"
      aria-live="polite"
      onClick={onDone}
    >
      <div className="w-[min(100%,320px)] flex flex-col items-center gap-4 px-6 py-8 bg-white rounded-md text-navy text-center shadow-2 animate-pop">
        {icon ?? <Smile size={56} strokeWidth={1.6} aria-hidden />}
        <p className="text-xl font-bold">{message}</p>
        {detail && <div className="text-sm text-ink-2">{detail}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ───────────── Toast ───────────── */
type Toast = { id: number; text: string; tone: ToastTone }
const ToastCtx = createContext<(text: string, tone?: ToastTone) => void>(() => {})

/** const toast = useToast(); toast('Guardado') */
export const useToast = () => useContext(ToastCtx)

const TOAST_TONO: Record<ToastTone, string> = { ok: 'bg-navy', error: 'bg-danger', info: 'bg-ink' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: ToastTone = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, text, tone }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), tone === 'error' ? 5000 : 3600)
  }, [])
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; tone: ToastTone }>).detail
      push(d.text, d.tone)
    }
    window.addEventListener(EVENTO_TOAST, on)
    return () => window.removeEventListener(EVENTO_TOAST, on)
  }, [push])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div
          className="fixed z-[70] left-1/2 -translate-x-1/2 bottom-[calc(var(--bottomnav-h)+16px+var(--safe-bottom))] flex flex-col gap-2 w-[min(92vw,420px)] pointer-events-none md:bottom-6"
          aria-live="polite"
          role="status"
        >
          {items.map((t) => (
            <div key={t.id} className={cn('px-4 py-3 rounded-md text-white font-semibold shadow-2 animate-up', TOAST_TONO[t.tone])}>
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}
