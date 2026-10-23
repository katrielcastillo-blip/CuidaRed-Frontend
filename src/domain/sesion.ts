/*
 * sesion.ts — Sesión del dispositivo: quién inició sesión y cuándo expira.
 * Módulo: dominio · seguridad (SRS §8.2.2.3.5 b/i: gestión segura de sesiones).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * La sesión vive en el dispositivo (localStorage), separada de los datos del servidor. Expira por
 * inactividad (30 min) o por duración máxima (12 h). auth.ts la invalida además si el usuario se
 * desactiva o se elimina.
 */
export interface Sesion {
  usuarioId: string
  inicio: string // ISO UTC
  ultimaActividad: string // ISO UTC
}

/** Configurable con VITE_SESION_MINUTOS_INACTIVIDAD (ver .env.example). */
export const MINUTOS_INACTIVIDAD = Number(import.meta.env?.VITE_SESION_MINUTOS_INACTIVIDAD) || 30
export const HORAS_MAXIMAS = 12

const CLAVE = 'cuidared:sesion'
const listeners = new Set<() => void>()

function leer(): Sesion | null {
  try {
    const raw = localStorage.getItem(CLAVE)
    return raw ? (JSON.parse(raw) as Sesion) : null
  } catch {
    return null
  }
}

let actual: Sesion | null = typeof window !== 'undefined' ? leer() : null

const emitir = () => listeners.forEach((l) => l())

function guardar(s: Sesion | null) {
  actual = s
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s))
    else localStorage.removeItem(CLAVE)
  } catch {
    /* modo privado: la sesión dura lo que la pestaña */
  }
  emitir()
}

export const getSesion = () => actual

export function abrirSesion(usuarioId: string) {
  const ahora = new Date().toISOString()
  guardar({ usuarioId, inicio: ahora, ultimaActividad: ahora })
}

export function cerrarSesionLocal() {
  guardar(null)
}

/** Registra actividad del usuario (se llama, como mucho, una vez por minuto). */
export function tocarSesion() {
  if (!actual) return
  const ahora = Date.now()
  if (ahora - Date.parse(actual.ultimaActividad) < 60_000) return
  guardar({ ...actual, ultimaActividad: new Date(ahora).toISOString() })
}

/** Motivo de expiración, o null si la sesión sigue vigente. */
export function motivoExpiracion(s: Sesion, ahora = Date.now()): 'inactividad' | 'duracion' | null {
  if (ahora - Date.parse(s.ultimaActividad) > MINUTOS_INACTIVIDAD * 60_000) return 'inactividad'
  if (ahora - Date.parse(s.inicio) > HORAS_MAXIMAS * 3_600_000) return 'duracion'
  return null
}

export function suscribirSesion(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

// Otra pestaña inició o cerró sesión.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CLAVE) {
      actual = leer()
      emitir()
    }
  })
}
