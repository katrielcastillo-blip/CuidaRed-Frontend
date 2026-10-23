/*
 * EvidenciasLista.tsx — Evidencias adjuntas a una visita: miniaturas de imágenes o chips con el nombre del archivo.
 * Módulo: visitas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { FileText, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { esMiniatura } from '../lib/evidencias'

/** Con `onQuitar` se pueden eliminar (botón de 48 px). `compacta` usa miniaturas pequeñas (formulario). */
export function EvidenciasLista({ items, onQuitar, compacta }: { items: string[]; onQuitar?: (i: number) => void; compacta?: boolean }) {
  if (items.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-3 m-0 p-0 list-none" aria-label="Evidencias adjuntas">
      {items.map((ev, i) => (
        <li key={`${i}-${ev.slice(0, 24)}`} className="relative">
          {esMiniatura(ev) ? (
            <img
              src={ev}
              alt={`Evidencia ${i + 1}`}
              className={cn('object-cover rounded-sm border border-line-soft bg-surface-2', compacta ? 'size-14' : 'size-24')}
            />
          ) : (
            <span className="inline-flex items-center gap-2 min-h-12 max-w-full px-3 rounded-sm border border-line-soft bg-bg text-sm text-ink-2">
              <FileText size={20} aria-hidden />
              <span className="wrap-anywhere">{ev}</span>
            </span>
          )}
          {onQuitar && (
            <button
              type="button"
              className="group absolute -top-4 -right-4 size-12 grid place-items-center"
              onClick={() => onQuitar(i)}
              aria-label={`Quitar evidencia ${i + 1}`}
            >
              <span className="size-6 grid place-items-center rounded-full bg-navy text-white shadow-1 group-hover:bg-danger">
                <X size={14} aria-hidden />
              </span>
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
