import { useSyncExternalStore } from 'react'
import { buildSeed, DB_VERSION } from './seed'
import type { DB } from './types'

/**
 * Store local del prototipo: un único objeto DB persistido en localStorage.
 *  - Leer:      const adultos = useDB(s => s.adultos)   (selecciona referencias del estado; NO crees arrays/objetos nuevos dentro del selector, deriva con useMemo)
 *  - Escribir:  mutate(db => { db.visitas.push(...) })   (la mutación se aplica sobre un clon y se persiste)
 *  - Fuera de React: getDB()
 */
const KEY = 'cuidared:db'
const listeners = new Set<() => void>()

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed.version === DB_VERSION) return parsed
    }
  } catch {
    /* localStorage no disponible o JSON corrupto → semilla */
  }
  return buildSeed()
}

let state: DB = load()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* modo privado / cuota: el prototipo sigue funcionando en memoria */
  }
}
persist()

export const getDB = () => state

export function mutate(fn: (draft: DB) => void) {
  const draft = structuredClone(state)
  fn(draft)
  state = draft
  persist()
  listeners.forEach((l) => l())
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useDB<T>(selector: (db: DB) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  )
}

/** Restablece los datos de demostración (cierra la sesión). */
export function resetDemo() {
  state = buildSeed()
  persist()
  listeners.forEach((l) => l())
}

/** Id corto y único para entidades nuevas: uid('v') → "v-k3j9x2a". */
export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

// Sincroniza varias pestañas/ventanas del prototipo.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        state = JSON.parse(e.newValue) as DB
        listeners.forEach((l) => l())
      } catch {
        /* ignorar */
      }
    }
  })
}
