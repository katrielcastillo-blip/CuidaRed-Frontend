/*
 * avisos.ts — Avisos globales (toasts) que el dominio puede emitir sin depender de React:
 * resultados de sincronización, sesión expirada, operaciones que requieren conexión…
 * Módulo: dominio. El ToastProvider del kit UI escucha este evento y lo muestra.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
export type ToastTone = 'ok' | 'error' | 'info'

export const EVENTO_TOAST = 'cuidared:toast'

export function avisar(text: string, tone: ToastTone = 'ok') {
  if (typeof window === 'undefined') return
  // Se difiere un ciclo: al arrancar la app el proveedor de avisos aún no está escuchando.
  setTimeout(() => window.dispatchEvent(new CustomEvent(EVENTO_TOAST, { detail: { text, tone } })), 0)
}
