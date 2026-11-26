/*
 * marca.ts — Configuración de marca de CuidaRed para la PWA y los reportes.
 * Módulo: app.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useSyncExternalStore } from 'react'

type Variante = 'completo_claro' | 'completo_oscuro' | 'isotipo'
type Marca = Partial<Record<Variante, string | null>>
const predeterminados: Record<Variante, string> = {
  completo_claro: '/brand/logo.png', completo_oscuro: '/brand/logo.png', isotipo: '/brand/logosimbolo.png',
}
const observers = new Set<() => void>()
const cacheKey = 'cuidared:marca:' + (import.meta.env.VITE_SUPABASE_URL ?? 'local')
let marca: Marca = marcaGuardada()
let controller: AbortController | undefined
let intento = 0
const base = () => import.meta.env.VITE_API_URL?.replace(/\/$/, '')

function validarMarca(data: unknown): Marca {
  const nueva: Marca = {}
  if (!data || typeof data !== 'object' || Array.isArray(data)) return nueva
  for (const variante of Object.keys(predeterminados) as Variante[]) {
    const url = (data as Record<string, unknown>)[variante]
    if (typeof url !== 'string' || url.length > 2048) continue
    try {
      const parsed = new URL(url)
      const proyecto = new URL(import.meta.env.VITE_SUPABASE_URL ?? '')
      if (parsed.origin === proyecto.origin && !parsed.username && !parsed.password
        && (parsed.protocol === 'https:' || (import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(parsed.hostname)))
        && parsed.pathname.startsWith('/storage/v1/object/public/cuidared-marca/')) nueva[variante] = parsed.href
    } catch { /* una variante inválida no impide cargar las demás */ }
  }
  return nueva
}

function marcaGuardada(): Marca {
  try { return validarMarca(JSON.parse(localStorage.getItem(cacheKey) ?? '{}')) }
  catch { return {} }
}

function leerMarca(variante: Variante) {
  return marca[variante] ?? predeterminados[variante]
}

export async function actualizarMarca() {
  if (!base() || (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'demo')) return
  const actual = ++intento
  try {
    const response = await fetch(base() + '/api/admin/marca', { cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!response.ok) return
    const { data } = await response.json() as { data: unknown }
    const nueva = validarMarca(data)
    if (actual !== intento) return
    marca = nueva
    try {
      if (Object.keys(nueva).length) localStorage.setItem(cacheKey, JSON.stringify(nueva))
      else localStorage.removeItem(cacheKey)
    } catch { /* el logo sigue disponible aunque el navegador no permita guardar su referencia */ }
    observers.forEach((observer) => observer())
  } catch { /* conservar la última marca conocida durante una desconexión */ }
}

async function escuchar(signal: AbortSignal) {
  while (!signal.aborted) {
    try {
      await actualizarMarca()
      const response = await fetch(base() + '/api/admin/marca/eventos', { cache: 'no-store', signal })
      if (!response.ok || !response.body) throw new Error()
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        pending += decoder.decode(value, { stream: true })
        const events = pending.split(/\r?\n\r?\n/)
        pending = events.pop() ?? ''
        if (events.some((event) => event.split(/\r?\n/).some((line) => line.startsWith('data:')))) void actualizarMarca()
      }
    } catch { /* reintentar al recuperar la red */ }
    if (!signal.aborted) await new Promise((resolve) => setTimeout(resolve, 10000))
  }
}

function subscribe(observer: () => void) {
  observers.add(observer)
  if (!controller && base() && !(import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'demo')) {
    controller = new AbortController()
    void escuchar(controller.signal)
  }
  return () => {
    observers.delete(observer)
    if (!observers.size) { controller?.abort(); controller = undefined }
  }
}

export function useLogo(variante: Variante = 'completo_claro') {
  const url = useSyncExternalStore(subscribe, () => leerMarca(variante))
  useEffect(() => {
    if (url !== predeterminados[variante]) { const imagen = new Image(); imagen.src = url }
  }, [url, variante])
  return url
}

export async function logoParaReporte(): Promise<HTMLImageElement | null> {
  await actualizarMarca()
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = leerMarca('completo_oscuro')
  })
}
