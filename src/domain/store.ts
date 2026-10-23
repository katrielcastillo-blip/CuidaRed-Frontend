/*
 * store.ts — Almacén de datos de CuidaRed.
 * Módulo: dominio · persistencia.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Esta versión es solo frontend: el "servidor central" se simula con un objeto DB persistido en
 * localStorage (compartido por todas las pestañas, que actúan como dispositivos distintos).
 *
 *  - Leer:      const adultos = useDB(s => s.adultos)
 *               (selecciona referencias del estado; NO crees arrays/objetos nuevos dentro del selector, deriva con useMemo)
 *  - Escribir:  mutate(db => { ... })  → aplica el cambio en el servidor, ejecuta el motor de alertas
 *               (reglas.ts) y persiste. Devuelve false SIN aplicar nada si no hay conexión.
 *  - Fuera de React: getDB()
 *
 * Lo que se lee (vista) = servidor + registros pendientes de sincronización del usuario en sesión
 * (visitas y necesidades capturadas sin conexión, ver sync.ts), marcados con `pendienteSync`.
 */
import { useSyncExternalStore } from 'react'
import { avisar } from './avisos'
import { estaEnLinea, suscribirConectividad } from './conectividad'
import { registrarFuenteVinculos } from './permisos'
import { aplicarReglas } from './reglas'
import { buildSeed, DB_VERSION } from './seed'
import { getSesion, suscribirSesion } from './sesion'
import type { DB, Necesidad, Visita } from './types'

const KEY = 'cuidared:db'
const listeners = new Set<() => void>()

/* ───────────── Operaciones pendientes (cola offline) ───────────── */
export type EntidadOffline = 'visita' | 'necesidad'

/** Registro capturado sin conexión que espera ser enviado al servidor (RF-10 · CU-14). */
export interface OperacionPendiente {
  id: string
  /** Usuario autenticado que capturó el registro (SRS §8.2.2.3.5 k). */
  usuarioId: string
  entidad: EntidadOffline
  tipo: 'crear' | 'actualizar'
  registroId: string
  /** Versión completa del registro tras el cambio local. */
  datos: Visita | Necesidad
  /** `actualizadoEn` del registro en el servidor cuando se editó localmente (null si es nuevo). */
  baseActualizadoEn: string | null
  /** Marca de tiempo UTC de la modificación local (Last-Write-Wins). */
  actualizadoEn: string
  creadaEn: string
  intentos: number
  ultimoError?: string
}

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
  const seed = buildSeed()
  aplicarReglas(seed)
  return seed
}

let servidor: DB = load()
let pendientes: OperacionPendiente[] = []
let vista: DB = servidor

function calcularVista(): DB {
  const uid = getSesion()?.usuarioId
  const mias = uid ? pendientes.filter((p) => p.usuarioId === uid) : []
  if (mias.length === 0) return servidor
  const visitas = [...servidor.visitas]
  const necesidades = [...servidor.necesidades]
  for (const op of mias) {
    const lista = (op.entidad === 'visita' ? visitas : necesidades) as Array<Visita | Necesidad>
    const i = lista.findIndex((x) => x.id === op.registroId)
    const rec = { ...op.datos, pendienteSync: true }
    if (i >= 0) lista[i] = rec
    else lista.push(rec)
  }
  return { ...servidor, visitas, necesidades }
}

function notificar() {
  vista = calcularVista()
  listeners.forEach((l) => l())
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(servidor))
  } catch {
    avisar('No se pudo guardar en este dispositivo (almacenamiento lleno o bloqueado).', 'error')
  }
}
persist()

/** Estado visible (servidor + pendientes del usuario en sesión). */
export const getDB = () => vista
/** Estado del servidor sin los registros locales pendientes (lo usa la sincronización). */
export const getServidor = () => servidor

export const MENSAJE_SIN_CONEXION = 'Sin conexión: esta acción necesita internet. Las visitas y necesidades sí se pueden registrar sin conexión.'

/**
 * Aplica un cambio en el servidor y ejecuta el motor de alertas. Sin conexión no aplica nada, avisa al
 * usuario y devuelve false (las pantallas deben comprobar el resultado o deshabilitar la acción con useEnLinea()).
 */
export function mutate(fn: (draft: DB) => void, opciones: { silencioso?: boolean } = {}): boolean {
  if (!estaEnLinea()) {
    if (!opciones.silencioso) avisar(MENSAJE_SIN_CONEXION, 'error')
    return false
  }
  const draft = structuredClone(servidor)
  fn(draft)
  aplicarReglas(draft)
  servidor = draft
  persist()
  notificar()
  return true
}

/** Evaluación periódica del motor de alertas (los días pasan aunque nadie edite nada). */
export function evaluarReglas() {
  if (!estaEnLinea()) return
  const draft = structuredClone(servidor)
  if (!aplicarReglas(draft)) return
  servidor = draft
  persist()
  notificar()
}

/** La cola offline (sync.ts) informa de sus cambios para recalcular la vista. */
export function setPendientes(lista: OperacionPendiente[]) {
  pendientes = lista
  notificar()
}
export const getPendientes = () => pendientes

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useDB<T>(selector: (db: DB) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(vista),
    () => selector(vista),
  )
}

const alReiniciarCbs = new Set<() => void>()
/** Registra limpieza adicional al restablecer los datos de demostración (cola offline, sesión…). */
export function alReiniciar(cb: () => void) {
  alReiniciarCbs.add(cb)
}

/** Restablece los datos de demostración. */
export function resetDemo() {
  servidor = buildSeed()
  aplicarReglas(servidor)
  persist()
  alReiniciarCbs.forEach((cb) => cb())
  notificar()
}

/** Id corto y único para entidades nuevas: uid('v') → "v-k3j9x2a". */
export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

// Los permisos consultan la tabla Vinculo de la vista actual.
registrarFuenteVinculos(() => vista.vinculos)

// Cambió la sesión → cambia qué pendientes se superponen.
suscribirSesion(notificar)

/** Relee la copia del servidor (cambios hechos por otros "dispositivos" mientras este estaba sin conexión). */
function releerServidor(raw: string | null = localStorage.getItem(KEY)) {
  if (!raw) return
  try {
    const nuevo = JSON.parse(raw) as DB
    if (nuevo.version === DB_VERSION) {
      servidor = nuevo
      notificar()
    }
  } catch {
    /* ignorar */
  }
}

if (typeof window !== 'undefined') {
  // Otra pestaña (otro "dispositivo") modificó el servidor: solo se recibe si este dispositivo está en línea.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue && estaEnLinea()) releerServidor(e.newValue)
  })
  // Al recuperar la conexión se descarga el estado actual del servidor.
  let enLinea = estaEnLinea()
  suscribirConectividad(() => {
    const ahora = estaEnLinea()
    if (ahora && !enLinea) releerServidor()
    enLinea = ahora
  })
}
