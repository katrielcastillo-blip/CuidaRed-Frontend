/*
 * use-capa.ts — Comportamiento común de hojas y menús modales: foco inicial, atrapar Tab, Escape y bloqueo del scroll.
 * El devolver el foco al disparador lo hace quien abre la capa (sabe si se cierra por navegar o por cancelar).
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useRef, type RefObject } from 'react'

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function useCapa(abierta: boolean, cerrar: () => void, panel: RefObject<HTMLElement | null>) {
  const cerrarRef = useRef(cerrar)
  useEffect(() => { cerrarRef.current = cerrar })
  useEffect(() => {
    if (!abierta) return
    const lista = () => [...(panel.current?.querySelectorAll<HTMLElement>(ENFOCABLES) ?? [])]
    ;(lista()[0] ?? panel.current)?.focus()
    const tecla = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        cerrarRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = lista()
      if (items.length === 0) return
      const primero = items[0]!
      const ultimo = items[items.length - 1]!
      const activo = document.activeElement
      if (event.shiftKey && (activo === primero || !panel.current?.contains(activo))) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && (activo === ultimo || !panel.current?.contains(activo))) {
        event.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', tecla)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = overflow
    }
  }, [abierta, panel])
}
