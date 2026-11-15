/*
 * telemetria.ts — Informa categorías de fallos de la PWA a la API de CuidaRed.
 * Módulo: access-real.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
type Evento = 'javascript.error' | 'javascript.rejection' | 'api.error' | 'api.network'
const ultimo = new Map<Evento, number>()

export function reportarFallo(evento: Evento, requestId?: string | null, token?: string) {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
  if (!base || !navigator.onLine || import.meta.env.VITE_AUTH_MODE === 'demo') return
  const ahora = Date.now()
  if (ahora - (ultimo.get(evento) ?? 0) < 10000) return
  ultimo.set(evento, ahora)
  const id = requestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId) ? requestId : undefined
  void fetch(`${base}/api/admin/telemetria`, {
    method: 'POST', credentials: 'omit', cache: 'no-store', keepalive: true,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ evento, requestId: id }),
  }).catch(() => undefined)
}

export function escucharFallosDeLaPwa() {
  window.addEventListener('error', () => reportarFallo('javascript.error'))
  window.addEventListener('unhandledrejection', () => reportarFallo('javascript.rejection'))
}
