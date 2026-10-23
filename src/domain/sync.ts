/*
 * sync.ts — Registro sin conexión y sincronización automática (RF-10 · CU-14 · RSUP-03).
 * Módulo: dominio · offline.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Flujo:
 *  1. Sin conexión, las visitas y necesidades se guardan en una cola local (IndexedDB) asociada al usuario
 *     autenticado y se muestran marcadas como "Pendiente de sincronización".
 *  2. Al recuperar la conexión (evento online, fin de la simulación, inicio de sesión o reintento
 *     periódico) se envían al servidor en orden.
 *  3. Conflictos (el registro también cambió en el servidor): gana la versión con la marca de tiempo UTC
 *     más reciente (Last-Write-Wins). Se audita y se informa al usuario.
 *  4. Errores: el registro sigue pendiente y se reintenta más tarde.
 *  5. Lo sincronizado se elimina del almacenamiento local.
 */
import { useSyncExternalStore } from 'react'
import { auditar } from './auditoria'
import { avisar } from './avisos'
import { estaEnLinea, suscribirConectividad } from './conectividad'
import { puede } from './permisos'
import { getSesion, suscribirSesion } from './sesion'
import { alReiniciar, getServidor, mutate, setPendientes, getPendientes, subscribe, type EntidadOffline, type OperacionPendiente } from './store'
import type { DB, Necesidad, Usuario, Visita } from './types'

/* ───────────── IndexedDB (con respaldo en memoria) ───────────── */
const NOMBRE_IDB = 'cuidared-offline'
const STORE = 'pendientes'
let idb: Promise<IDBDatabase | null> | null = null

function abrir(): Promise<IDBDatabase | null> {
  if (idb) return idb
  idb = new Promise((resolve) => {
    try {
      const req = indexedDB.open(NOMBRE_IDB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return idb
}

async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await abrir()
  if (!db) return undefined
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, modo)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(req ? req.result : undefined)
    t.onerror = () => reject(t.error)
  })
}

const idbTodos = () => tx<OperacionPendiente[]>('readonly', (s) => s.getAll() as IDBRequest<OperacionPendiente[]>)
const idbGuardar = (op: OperacionPendiente) => tx('readwrite', (s) => void s.put(op))
const idbBorrar = (id: string) => tx('readwrite', (s) => void s.delete(id))
const idbVaciar = () => tx('readwrite', (s) => void s.clear())

/* ───────────── Estado observable de la sincronización ───────────── */
export interface ResultadoSync {
  fecha: string
  sincronizados: number
  conflictos: Array<{ registroId: string; entidad: EntidadOffline; gana: 'local' | 'servidor' }>
  errores: Array<{ registroId: string; entidad: EntidadOffline; motivo: string }>
}

interface EstadoSync {
  sincronizando: boolean
  ultimo: ResultadoSync | null
}

const CLAVE_ULTIMO = 'cuidared:sync-ultimo'
const CLAVE_FALLO = 'cuidared:simular-fallo-sync'
let estado: EstadoSync = { sincronizando: false, ultimo: leerUltimo() }
const oyentes = new Set<() => void>()

function leerUltimo(): ResultadoSync | null {
  try {
    const raw = localStorage.getItem(CLAVE_ULTIMO)
    return raw ? (JSON.parse(raw) as ResultadoSync) : null
  } catch {
    return null
  }
}

function setEstado(parcial: Partial<EstadoSync>) {
  estado = { ...estado, ...parcial }
  if (parcial.ultimo) {
    try {
      localStorage.setItem(CLAVE_ULTIMO, JSON.stringify(parcial.ultimo))
    } catch {
      /* ignorar */
    }
  }
  oyentes.forEach((l) => l())
}

const suscribir = (l: () => void) => {
  oyentes.add(l)
  return () => {
    oyentes.delete(l)
  }
}

export function useEstadoSync(): EstadoSync {
  return useSyncExternalStore(suscribir, () => estado, () => estado)
}

/** Simula que el servidor rechaza la sincronización (para probar el flujo alternativo B de CU-14). */
export const simulandoFalloSync = () => {
  try {
    return localStorage.getItem(CLAVE_FALLO) === '1'
  } catch {
    return false
  }
}
export function setSimularFalloSync(v: boolean) {
  try {
    if (v) localStorage.setItem(CLAVE_FALLO, '1')
    else localStorage.removeItem(CLAVE_FALLO)
  } catch {
    /* ignorar */
  }
  oyentes.forEach((l) => l())
}

/* ───────────── Cola ───────────── */
/** Pendientes del usuario en sesión (los de otros usuarios del mismo dispositivo no se muestran ni se envían). */
export function pendientesDelUsuario(usuarioId = getSesion()?.usuarioId): OperacionPendiente[] {
  return usuarioId ? getPendientes().filter((p) => p.usuarioId === usuarioId) : []
}

let cache: { base: OperacionPendiente[]; uid: string | undefined; lista: OperacionPendiente[] } | null = null
function snapshotPendientes(): OperacionPendiente[] {
  const base = getPendientes()
  const uid = getSesion()?.usuarioId
  if (!cache || cache.base !== base || cache.uid !== uid) cache = { base, uid, lista: pendientesDelUsuario(uid) }
  return cache.lista
}

/** Hook: registros del usuario en sesión que esperan sincronización. */
export function usePendientes(): OperacionPendiente[] {
  return useSyncExternalStore(subscribe, snapshotPendientes, snapshotPendientes)
}

let secuencia = 0

/**
 * Guarda localmente un registro creado o modificado sin conexión. Si el mismo registro ya estaba
 * pendiente, se combina (se conserva el tipo de operación y la versión base originales).
 */
export async function encolar(entidad: EntidadOffline, datos: Visita | Necesidad, usuario: Usuario): Promise<void> {
  const ahora = new Date().toISOString()
  const actual = getPendientes().find((p) => p.registroId === datos.id && p.usuarioId === usuario.id)
  const enServidor = (entidad === 'visita' ? getServidor().visitas : getServidor().necesidades).find((x) => x.id === datos.id) as
    | Visita
    | Necesidad
    | undefined
  const limpio = { ...datos, actualizadoEn: ahora, actualizadoPor: usuario.id }
  delete (limpio as { pendienteSync?: boolean }).pendienteSync
  const op: OperacionPendiente = actual
    ? { ...actual, datos: limpio, actualizadoEn: ahora }
    : {
        id: `op-${Date.now().toString(36)}-${(secuencia++).toString(36)}`,
        usuarioId: usuario.id,
        entidad,
        tipo: enServidor ? 'actualizar' : 'crear',
        registroId: datos.id,
        datos: limpio,
        baseActualizadoEn: enServidor?.actualizadoEn ?? null,
        actualizadoEn: ahora,
        creadaEn: ahora,
        intentos: 0,
      }
  setPendientes([...getPendientes().filter((p) => p.id !== op.id), op])
  try {
    await idbGuardar(op)
  } catch {
    avisar('No se pudo guardar el registro en el dispositivo. Verifica el espacio disponible.', 'error')
  }
}

/** Descarta un registro pendiente (el usuario decide no enviarlo). */
export async function descartarPendiente(opId: string) {
  setPendientes(getPendientes().filter((p) => p.id !== opId))
  await idbBorrar(opId)
}

/* ───────────── Sincronización ───────────── */
function validar(db: DB, op: OperacionPendiente, usuario: Usuario | undefined): string | null {
  if (!usuario || usuario.estado !== 'activo') return 'El usuario que capturó el registro ya no está activo.'
  const adulto = db.adultos.find((a) => a.id === op.datos.adultoId)
  if (!adulto) return 'El perfil del adulto mayor ya no existe.'
  if (adulto.estado !== 'activo') return 'El perfil del adulto mayor fue desactivado.'
  const accion = op.entidad === 'visita' ? 'visitas:registrar' : op.tipo === 'crear' ? 'necesidades:registrar' : 'necesidades:actualizar'
  if (!puede(usuario, accion, adulto)) return 'Ya no tienes permiso sobre este adulto mayor.'
  return null
}

const ETIQUETA: Record<EntidadOffline, string> = { visita: 'visita', necesidad: 'necesidad' }

/** Envía al servidor los registros pendientes del usuario en sesión. */
export async function sincronizar(): Promise<ResultadoSync | null> {
  const uid = getSesion()?.usuarioId
  const cola = pendientesDelUsuario(uid).sort((a, b) => a.creadaEn.localeCompare(b.creadaEn))
  if (!uid || cola.length === 0 || !estaEnLinea() || estado.sincronizando) return null
  setEstado({ sincronizando: true })

  const resultado: ResultadoSync = { fecha: new Date().toISOString(), sincronizados: 0, conflictos: [], errores: [] }
  const confirmados: string[] = []
  const fallidos = new Map<string, string>()
  const falloSimulado = simulandoFalloSync()

  const ok = mutate(
    (db) => {
      const usuario = db.usuarios.find((u) => u.id === uid)
      for (const op of cola) {
        const motivo = falloSimulado ? 'El servidor no respondió (fallo simulado).' : validar(db, op, usuario)
        if (motivo) {
          fallidos.set(op.id, motivo)
          resultado.errores.push({ registroId: op.registroId, entidad: op.entidad, motivo })
          if (usuario) auditar(db, usuario, { accion: 'sync.error', entidad: 'sincronizacion', registroId: op.registroId, resultado: 'fallo', detalle: `${ETIQUETA[op.entidad]}: ${motivo}` })
          continue
        }
        const lista = (op.entidad === 'visita' ? db.visitas : db.necesidades) as Array<Visita | Necesidad>
        const i = lista.findIndex((x) => x.id === op.registroId)
        const enServidor = i >= 0 ? lista[i]! : undefined
        const huboCambioRemoto = !!enServidor && enServidor.actualizadoEn !== op.baseActualizadoEn
        if (huboCambioRemoto) {
          // Conflicto: Last-Write-Wins por marca de tiempo UTC de cada modificación.
          const ganaLocal = op.actualizadoEn > enServidor.actualizadoEn
          if (ganaLocal) lista[i] = op.datos
          resultado.conflictos.push({ registroId: op.registroId, entidad: op.entidad, gana: ganaLocal ? 'local' : 'servidor' })
          auditar(db, usuario!, {
            accion: 'sync.conflicto',
            entidad: 'sincronizacion',
            registroId: op.registroId,
            resultado: 'conflicto',
            detalle: `${ETIQUETA[op.entidad]}: se conservó la versión ${ganaLocal ? 'del dispositivo' : 'del servidor'} (local ${op.actualizadoEn} · servidor ${enServidor.actualizadoEn}).`,
          })
        } else {
          if (i >= 0) lista[i] = op.datos
          else lista.push(op.datos)
          auditar(db, usuario!, {
            accion: 'sync.registro',
            entidad: 'sincronizacion',
            registroId: op.registroId,
            detalle: `${ETIQUETA[op.entidad]} ${op.tipo === 'crear' ? 'creada' : 'actualizada'} sin conexión el ${op.actualizadoEn}.`,
          })
          // Auditoría de la operación de negocio original.
          if (op.entidad === 'necesidad') {
            auditar(db, usuario!, { accion: op.tipo === 'crear' ? 'necesidad.crear' : 'necesidad.estado', entidad: 'necesidad', registroId: op.registroId, detalle: 'Registrada sin conexión y sincronizada.' })
          } else {
            auditar(db, usuario!, { accion: 'visita.registrar', entidad: 'visita', registroId: op.registroId, detalle: 'Registrada sin conexión y sincronizada.' })
          }
        }
        resultado.sincronizados++
        confirmados.push(op.id)
      }
    },
    { silencioso: true },
  )

  if (!ok) {
    setEstado({ sincronizando: false })
    return null
  }

  // Se eliminan del dispositivo los registros confirmados; los fallidos siguen pendientes.
  const restantes = getPendientes()
    .filter((p) => !confirmados.includes(p.id))
    .map((p) => (fallidos.has(p.id) ? { ...p, intentos: p.intentos + 1, ultimoError: fallidos.get(p.id) } : p))
  setPendientes(restantes)
  await Promise.all(confirmados.map((id) => idbBorrar(id)))
  await Promise.all(restantes.filter((p) => fallidos.has(p.id)).map((p) => idbGuardar(p)))

  setEstado({ sincronizando: false, ultimo: resultado })
  informar(resultado)
  return resultado
}

function informar(r: ResultadoSync) {
  const n = r.sincronizados
  if (n > 0) {
    const ganaServidor = r.conflictos.filter((c) => c.gana === 'servidor').length
    const conflictos = r.conflictos.length
      ? ` ${r.conflictos.length} conflicto(s) resuelto(s) con "última escritura gana"${ganaServidor ? `: en ${ganaServidor} se conservó la versión más reciente del servidor` : ''}.`
      : ''
    avisar(`Sincronización completada: ${n} registro(s) enviado(s).${conflictos}`, r.conflictos.length ? 'info' : 'ok')
  }
  if (r.errores.length) avisar(`No se pudieron sincronizar ${r.errores.length} registro(s). Siguen guardados en el dispositivo y se reintentará.`, 'error')
}

/* ───────────── Arranque ───────────── */
let iniciado = false
const REINTENTO_MS = 30_000

/** Carga la cola desde IndexedDB y programa la sincronización automática. Se llama una vez al iniciar la app. */
export async function iniciarSync() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true
  try {
    setPendientes((await idbTodos()) ?? [])
  } catch {
    setPendientes([])
  }
  const intentar = () => {
    if (estaEnLinea() && pendientesDelUsuario().length) void sincronizar()
  }
  suscribirConectividad(() => setTimeout(intentar, 300))
  suscribirSesion(() => setTimeout(intentar, 300))
  setInterval(intentar, REINTENTO_MS)
  intentar()
}

alReiniciar(() => {
  setPendientes([])
  void idbVaciar()
  try {
    localStorage.removeItem(CLAVE_ULTIMO)
  } catch {
    /* ignorar */
  }
  setEstado({ ultimo: null })
})
