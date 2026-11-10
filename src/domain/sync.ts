/*
 * sync.ts — Cola sin conexión (IndexedDB) y cliente de sincronización (RF-10 · CU-14 · RSUP-03 · RS-018).
 * Módulo: dominio · offline.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * ── Flujo ────────────────────────────────────────────────────────────────────────────────────────────
 *  1. Sin conexión, las visitas y necesidades se guardan en una cola local (IndexedDB) asociada al usuario
 *     autenticado y se muestran marcadas como "Pendiente de sincronización".
 *  2. Al recuperar la conexión (evento online, fin de la simulación, inicio de sesión, reintento periódico o
 *     el botón "Sincronizar ahora") se envían al servidor POR LOTES, en orden de captura.
 *  3. Idempotencia: cada operación lleva un UUID generado en el cliente (`claveCliente`). El servidor anota las
 *     claves que ya procesó (`syncClaves`, ver más abajo) y, si recibe otra vez la misma, responde "duplicada"
 *     sin volver a escribir. Así, reintentar tras un corte, un cierre del navegador o desde dos pestañas nunca
 *     duplica el registro. Como segunda barrera, una operación cuyo `actualizadoEn` ya está en el servidor
 *     también se trata como duplicada (filas heredadas que no tienen clave).
 *  4. Conflictos (el registro también cambió en el servidor): gana la versión con la marca de tiempo UTC más
 *     reciente (Last-Write-Wins). Si las marcas son iguales gana el servidor (resultado estable). Se audita y
 *     se informa al usuario. El resultado de un conflicto es definitivo: no se vuelve a evaluar al reintentar.
 *  5. Errores: la operación sigue pendiente y se reintenta con espera exponencial (ESPERA_BASE_MS × 2^(n-1),
 *     con tope ESPERA_MAX_MS y una pequeña variación aleatoria). Tras MAX_INTENTOS fallos queda "detenida":
 *     deja de reintentarse sola y espera al usuario ("Sincronizar ahora" la reintenta; "Descartar" la elimina).
 *     Una operación fallida no bloquea a las demás.
 *  6. Lo sincronizado se elimina del dispositivo (en el mismo paso se guardan los cambios de los que fallaron).
 *
 * ── Almacenamiento local (RS-018: solo datos del trabajo de campo, sin credenciales) ────────────────
 *  IndexedDB «cuidared-offline», versión 2.
 *    Almacén «pendientes»  (keyPath «id»)  una fila por registro pendiente:
 *      id, usuarioId, entidad ('visita' | 'necesidad'), tipo ('crear' | 'actualizar'), registroId,
 *      datos (el registro completo de la visita o necesidad, sin marcas de la vista),
 *      baseActualizadoEn, actualizadoEn, creadaEn, intentos, ultimoError?,
 *      claveCliente (UUID, idempotencia), orden (desempate al ordenar), proximoIntentoEn? (espera de reintento).
 *    Índices: «porUsuario» (usuarioId) y «porRegistro» (registroId).
 *  Migraciones (onupgradeneeded, acumulativas):
 *    v0 → v1  crea el almacén «pendientes».
 *    v1 → v2  crea los índices y reescribe cada fila heredada con normalizarOperacion(): agrega claveCliente y
 *             orden, y depura cualquier campo sensible. Las filas inválidas se eliminan.
 *    Al abrir también se vuelve a normalizar lo leído, por si la migración no pudo ejecutarse.
 *  Qué NO se guarda nunca: contraseñas, hashes, tokens, claves de API, cookies ni datos de sesión. La sesión del
 *  dispositivo vive en localStorage (sesion.ts) y el cliente conectado no usa esta cola. minimizarDatos() elimina
 *  del registro cualquier clave con ese aspecto y las marcas propias de la vista (`pendienteSync`).
 *  Al cerrar sesión se descarta el último resultado y se limpia la cola del usuario de lo que ya llegó al
 *  servidor; lo que aún no se envió se conserva (es trabajo de campo del usuario) y se envía cuando él vuelva
 *  a entrar (sincronizarAntesDeSalir() permite enviarlo justo antes de cerrar la sesión). Los registros de otros
 *  usuarios del mismo dispositivo nunca se muestran ni se envían.
 *
 * ── «Servidor» simulado ──────────────────────────────────────────────────────────────────────────────
 *  La copia del servidor (store.ts) guarda además `syncClaves`: las últimas MAX_CLAVES_APLICADAS claves de
 *  cliente procesadas. En un backend real es una tabla (clave del cliente → respuesta) escrita en la misma
 *  transacción que el registro.
 */
import { useSyncExternalStore } from 'react'
import { auditar } from './auditoria'
import { avisar } from './avisos'
import { estaEnLinea, suscribirConectividad } from './conectividad'
import { puede } from './permisos'
import { getSesion, suscribirSesion } from './sesion'
import { alReiniciar, getServidor, mutate, setPendientes, getPendientes, subscribe, type EntidadOffline, type OperacionPendiente } from './store'
import type { DB, Necesidad, Usuario, Visita } from './types'

/* ───────────── Parámetros ───────────── */
/** Registros que se envían al servidor en cada petición. */
export const TAMANO_LOTE = 25
/** Fallos acumulados tras los cuales una operación deja de reintentarse sola. */
export const MAX_INTENTOS = 8
/** Espera tras el primer fallo; se duplica en cada fallo siguiente. */
export const ESPERA_BASE_MS = 15_000
/** Tope de la espera entre reintentos. */
export const ESPERA_MAX_MS = 15 * 60_000
/** Claves de cliente que el servidor recuerda para detectar duplicados. */
export const MAX_CLAVES_APLICADAS = 2000
/** Cada cuánto se comprueba si hay algo que enviar (además de los eventos y de la espera de cada reintento). */
const REINTENTO_MS = 30_000
/** Tiempo máximo esperando a IndexedDB antes de avisar al usuario (p. ej. otra pestaña con el esquema anterior abierta). */
const ESPERA_IDB_MS = 4_000

/* ───────────── Tipos ───────────── */
/** Campos de control que la cola agrega a OperacionPendiente (opcionales: las filas heredadas no los tienen). */
export type OpCola = OperacionPendiente & {
  /** UUID generado en el cliente: identifica esta escritura ante el servidor (idempotencia). */
  claveCliente?: string
  /** Número creciente de captura; desempata operaciones con la misma marca de tiempo. */
  orden?: number
  /** ISO UTC: no se reintenta antes de esta hora (espera exponencial). */
  proximoIntentoEn?: string
}

export interface ClaveAplicada {
  clave: string
  registroId: string
  /** ISO UTC en que el servidor la procesó. */
  en: string
}

/** Copia del servidor con su tabla de claves procesadas. */
type DBConSync = DB & { syncClaves?: ClaveAplicada[] }

export interface ResultadoSync {
  fecha: string
  /** Usuario cuya cola se sincronizó (el resultado solo se muestra a ese usuario). */
  usuarioId?: string
  sincronizados: number
  conflictos: Array<{ registroId: string; entidad: EntidadOffline; gana: 'local' | 'servidor' }>
  errores: Array<{ registroId: string; entidad: EntidadOffline; motivo: string; intentos?: number; detenida?: boolean }>
  /** Cuántos de los sincronizados el servidor ya tenía (reintento sin duplicar). */
  duplicados?: number
  /** Peticiones (lotes) enviadas. */
  lotes?: number
  /** Registros del usuario que siguen pendientes al terminar. */
  restantes?: number
}

interface EstadoSync {
  sincronizando: boolean
  ultimo: ResultadoSync | null
}

export interface OpcionesSync {
  /** Lo pide el usuario: ignora las esperas, reintenta también las detenidas y siempre muestra el resultado. */
  manual?: boolean
  /** Ignora las esperas de reintento (p. ej. al recuperar la conexión). */
  sinEspera?: boolean
}

/* ───────────── Lógica pura (sin red, sin almacenamiento): se prueba en tests/unit/sync-*.spec.ts ───────────── */

/** Claves cuyo nombre sugiere una credencial o un dato de sesión: nunca viajan ni se guardan en la cola. */
const CLAVE_SENSIBLE = /pass|contrase|hash|token|secret|credencial|credential|sesion|session|api[_-]?key|jwt|bearer|authorization|cookie/i
export const esClaveSensible = (clave: string) => CLAVE_SENSIBLE.test(clave)

/**
 * Copia del registro apta para guardarse en el dispositivo: sin claves sensibles (en cualquier nivel), sin la
 * marca `pendienteSync` de la vista y sin valores que no son datos (funciones, undefined).
 */
export function minimizarDatos<T extends object>(datos: T): T {
  return JSON.parse(JSON.stringify(datos, (clave, valor: unknown) => (clave && (clave === 'pendienteSync' || esClaveSensible(clave)) ? undefined : valor))) as T
}

/** UUID v4 (crypto.randomUUID cuando existe; si no, con getRandomValues). */
export function nuevoUUID(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Clave de idempotencia de una operación (las filas heredadas usan su id, que también es único). */
export const claveDe = (op: Pick<OpCola, 'id' | 'claveCliente'>) => op.claveCliente ?? op.id

let ultimoOrden = 0
/** Número de captura estrictamente creciente. */
function siguienteOrden() {
  ultimoOrden = Math.max(Date.now(), ultimoOrden + 1)
  return ultimoOrden
}

/** Convierte lo leído de IndexedDB en una operación válida y mínima (null si la fila no sirve). Idempotente. */
export function normalizarOperacion(raw: unknown): OpCola | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const texto = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const id = texto(o.id)
  const usuarioId = texto(o.usuarioId)
  const registroId = texto(o.registroId)
  if (!id || !usuarioId || !registroId) return null
  if (o.entidad !== 'visita' && o.entidad !== 'necesidad') return null
  if (!o.datos || typeof o.datos !== 'object') return null
  const datos = minimizarDatos(o.datos as Visita | Necesidad)
  const creadaEn = texto(o.creadaEn) ?? texto(o.actualizadoEn) ?? new Date(0).toISOString()
  const intentos = typeof o.intentos === 'number' && Number.isFinite(o.intentos) ? Math.max(0, Math.trunc(o.intentos)) : 0
  return {
    id,
    usuarioId,
    entidad: o.entidad,
    tipo: o.tipo === 'actualizar' ? 'actualizar' : 'crear',
    registroId,
    datos,
    baseActualizadoEn: texto(o.baseActualizadoEn) ?? null,
    actualizadoEn: texto(o.actualizadoEn) ?? datos.actualizadoEn ?? creadaEn,
    creadaEn,
    intentos,
    ultimoError: texto(o.ultimoError)?.slice(0, 300),
    claveCliente: texto(o.claveCliente) ?? nuevoUUID(),
    orden: typeof o.orden === 'number' && Number.isFinite(o.orden) ? o.orden : undefined,
    proximoIntentoEn: texto(o.proximoIntentoEn),
  }
}

const marca = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/**
 * Last-Write-Wins: gana la versión con la marca de tiempo UTC más reciente. Si son iguales (o no se pueden
 * comparar) gana el servidor: es la que ya está confirmada y el resultado no cambia al reintentar.
 */
export function resolverLWW(localUTC: string, servidorUTC: string): 'local' | 'servidor' {
  const l = marca(localUTC)
  const s = marca(servidorUTC)
  if (l === null) return 'servidor'
  if (s === null) return 'local'
  return l > s ? 'local' : 'servidor'
}

/** Orden de envío: por momento de captura; si coincide, por número de captura y, al final, por id. */
export function compararOperaciones(a: OpCola, b: OpCola): number {
  const ta = marca(a.creadaEn)
  const tb = marca(b.creadaEn)
  if (ta !== null && tb !== null && ta !== tb) return ta - tb
  if (ta === null || tb === null) {
    const c = a.creadaEn.localeCompare(b.creadaEn)
    if (c !== 0) return c
  }
  const oa = a.orden ?? 0
  const ob = b.orden ?? 0
  if (oa !== ob) return oa - ob
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export const ordenarCola = (cola: readonly OpCola[]): OpCola[] => [...cola].sort(compararOperaciones)

/** Divide la cola en lotes de `tamano` (el último puede ser menor). */
export function dividirEnLotes<T>(items: readonly T[], tamano = TAMANO_LOTE): T[][] {
  const n = Math.max(1, Math.trunc(tamano))
  const lotes: T[][] = []
  for (let i = 0; i < items.length; i += n) lotes.push(items.slice(i, i + n))
  return lotes
}

/** Milisegundos de espera tras el fallo número `intentos` (1 = primer fallo). `variacion` ∈ [0,1) suma hasta un 20 %. */
export function esperaReintento(intentos: number, variacion = 0): number {
  const base = Math.min(ESPERA_MAX_MS, ESPERA_BASE_MS * 2 ** Math.max(0, intentos - 1))
  return Math.min(ESPERA_MAX_MS, Math.round(base * (1 + 0.2 * Math.min(Math.max(variacion, 0), 0.999))))
}

/** ¿Agotó los reintentos automáticos? */
export const estaDetenida = (op: Pick<OpCola, 'intentos'>) => op.intentos >= MAX_INTENTOS

/** Devuelve la operación con el fallo anotado: un intento más, su motivo y cuándo volver a intentarlo. */
export function registrarFallo(op: OpCola, motivo: string, ahora: number, variacion = 0): OpCola {
  const intentos = op.intentos + 1
  return {
    ...op,
    intentos,
    ultimoError: motivo.slice(0, 300),
    proximoIntentoEn: intentos >= MAX_INTENTOS ? undefined : new Date(ahora + esperaReintento(intentos, variacion)).toISOString(),
  }
}

/** Qué se puede enviar ahora, en orden: sin las que esperan su turno de reintento ni las detenidas. */
export function seleccionarParaEnvio(cola: readonly OpCola[], ahora: number, o: { sinEspera?: boolean; incluirDetenidas?: boolean } = {}): OpCola[] {
  return ordenarCola(
    cola.filter((op) => {
      if (estaDetenida(op)) return !!o.incluirDetenidas
      if (o.sinEspera || !op.proximoIntentoEn) return true
      const t = marca(op.proximoIntentoEn)
      return t === null || t <= ahora
    }),
  )
}

/** Milisegundos hasta el próximo reintento programado (null si no hay ninguno por esperar). */
export function proximoReintentoMs(cola: readonly OpCola[], ahora: number): number | null {
  let menor: number | null = null
  for (const op of cola) {
    if (estaDetenida(op) || !op.proximoIntentoEn) continue
    const t = marca(op.proximoIntentoEn)
    if (t !== null && t > ahora && (menor === null || t - ahora < menor)) menor = t - ahora
  }
  return menor
}

/** Operaciones que el servidor ya procesó (su clave está anotada): sobran en el dispositivo. */
export const yaAplicadas = (cola: readonly OpCola[], claves: ReadonlySet<string>) => cola.filter((op) => claves.has(claveDe(op)))

export type VeredictoOperacion = 'aplicada' | 'duplicada' | 'conflicto'

export interface OperacionAplicable<T> {
  registroId: string
  datos: T
  /** `actualizadoEn` que tenía el registro en el servidor cuando se editó en el dispositivo (null si es nuevo). */
  baseActualizadoEn: string | null
  /** Marca UTC de la modificación hecha en el dispositivo. */
  actualizadoEn: string
  claveCliente: string
}

export interface ResultadoAplicacion<T> {
  /** Lista resultante (la original no se modifica). */
  lista: T[]
  veredicto: VeredictoOperacion
  /** En un conflicto, qué versión se conserva. */
  gana?: 'local' | 'servidor'
  /** En un conflicto, la marca UTC que tenía el servidor. */
  servidorActualizadoEn?: string
}

/**
 * Aplica una operación sobre la lista del servidor:
 *  - clave ya procesada, o registro idéntico ya presente → "duplicada" (no cambia nada: idempotencia);
 *  - el registro cambió en el servidor desde la versión base → "conflicto", se conserva la más reciente (LWW);
 *  - en otro caso se crea o reemplaza → "aplicada".
 */
export function aplicarOperacion<T extends { id: string; actualizadoEn: string }>(
  lista: readonly T[],
  op: OperacionAplicable<T>,
  claves: ReadonlySet<string>,
): ResultadoAplicacion<T> {
  const copia = [...lista]
  if (claves.has(op.claveCliente)) return { lista: copia, veredicto: 'duplicada' }
  const i = copia.findIndex((x) => x.id === op.registroId)
  const enServidor = i >= 0 ? copia[i] : undefined
  if (enServidor && enServidor.actualizadoEn === op.actualizadoEn) return { lista: copia, veredicto: 'duplicada' }
  if (enServidor && enServidor.actualizadoEn !== op.baseActualizadoEn) {
    const gana = resolverLWW(op.actualizadoEn, enServidor.actualizadoEn)
    if (gana === 'local') copia[i] = op.datos
    return { lista: copia, veredicto: 'conflicto', gana, servidorActualizadoEn: enServidor.actualizadoEn }
  }
  if (i >= 0) copia[i] = op.datos
  else copia.push(op.datos)
  return { lista: copia, veredicto: 'aplicada' }
}

const ETIQUETA: Record<EntidadOffline, string> = { visita: 'visita', necesidad: 'necesidad' }

/** ¿Puede el servidor aceptar todavía esta operación? Devuelve el motivo del rechazo, o null. */
export function validarOperacion(db: DB, op: OpCola, usuario: Usuario | undefined): string | null {
  if (!usuario || usuario.estado !== 'activo') return 'El usuario que capturó el registro ya no está activo.'
  const adulto = db.adultos.find((a) => a.id === op.datos.adultoId)
  if (!adulto) return 'El perfil del adulto mayor ya no existe.'
  if (adulto.estado !== 'activo') return 'El perfil del adulto mayor fue desactivado.'
  const accion = op.entidad === 'visita' ? 'visitas:registrar' : op.tipo === 'crear' ? 'necesidades:registrar' : 'necesidades:actualizar'
  if (!puede(usuario, accion, adulto)) return 'Ya no tienes permiso sobre este adulto mayor.'
  return null
}

export interface ContextoLote {
  /** Usuario que capturó los registros (en el servidor). */
  usuario: Usuario | undefined
  /** Si viene, el servidor "no responde": todas las operaciones fallan con este motivo y no se escribe nada. */
  fallo?: string | null
  /** Hora de proceso (ISO UTC) para anotar las claves. */
  ahora?: string
  /** Reglas del servidor para aceptar una operación (por omisión, validarOperacion). */
  validar?: (db: DB, op: OpCola, usuario: Usuario | undefined) => string | null
}

export interface ResultadoLote {
  /** Ids de las operaciones que el servidor ya tiene (aplicadas, resueltas por conflicto o duplicadas). */
  confirmados: string[]
  /** Ids de las que fallaron → motivo. */
  fallidos: Map<string, string>
  sincronizados: number
  duplicados: number
  conflictos: ResultadoSync['conflictos']
  errores: ResultadoSync['errores']
}

/**
 * Procesa un lote de operaciones dentro de la transacción del servidor (`db` es el borrador de mutate()).
 * Una operación que falla no detiene a las demás.
 */
export function aplicarLote(db: DB, lote: readonly OpCola[], ctx: ContextoLote): ResultadoLote {
  const res: ResultadoLote = { confirmados: [], fallidos: new Map(), sincronizados: 0, duplicados: 0, conflictos: [], errores: [] }
  const ahora = ctx.ahora ?? new Date().toISOString()
  const servidor = db as DBConSync
  const tabla = servidor.syncClaves ?? []
  const claves = new Set(tabla.map((c) => c.clave))
  const usuario = ctx.usuario
  const actor = usuario ?? 'sistema'

  for (const op of ordenarCola(lote)) {
    const motivo = ctx.fallo ?? (ctx.validar ?? validarOperacion)(db, op, usuario)
    if (motivo) {
      res.fallidos.set(op.id, motivo)
      res.errores.push({ registroId: op.registroId, entidad: op.entidad, motivo })
      if (usuario) auditar(db, usuario, { accion: 'sync.error', entidad: 'sincronizacion', registroId: op.registroId, resultado: 'fallo', detalle: `${ETIQUETA[op.entidad]}: ${motivo}` })
      continue
    }
    const clave = claveDe(op)
    const aplicable = { registroId: op.registroId, datos: op.datos, baseActualizadoEn: op.baseActualizadoEn, actualizadoEn: op.actualizadoEn, claveCliente: clave }
    const r =
      op.entidad === 'visita'
        ? aplicarOperacion<Visita | Necesidad>(db.visitas, aplicable, claves)
        : aplicarOperacion<Visita | Necesidad>(db.necesidades, aplicable, claves)
    if (r.veredicto !== 'duplicada') {
      if (op.entidad === 'visita') db.visitas = r.lista as Visita[]
      else db.necesidades = r.lista as Necesidad[]
      tabla.push({ clave, registroId: op.registroId, en: ahora })
      claves.add(clave)
    }
    if (r.veredicto === 'duplicada') {
      res.duplicados++
    } else if (r.veredicto === 'conflicto') {
      const ganaLocal = r.gana === 'local'
      res.conflictos.push({ registroId: op.registroId, entidad: op.entidad, gana: ganaLocal ? 'local' : 'servidor' })
      auditar(db, actor, {
        accion: 'sync.conflicto',
        entidad: 'sincronizacion',
        registroId: op.registroId,
        resultado: 'conflicto',
        detalle: `${ETIQUETA[op.entidad]}: se conservó la versión ${ganaLocal ? 'del dispositivo' : 'del servidor'} (local ${op.actualizadoEn} · servidor ${r.servidorActualizadoEn}).`,
      })
    } else {
      auditar(db, actor, {
        accion: 'sync.registro',
        entidad: 'sincronizacion',
        registroId: op.registroId,
        detalle: `${ETIQUETA[op.entidad]} ${op.tipo === 'crear' ? 'creada' : 'actualizada'} sin conexión el ${op.actualizadoEn}.`,
      })
      // Auditoría de la operación de negocio original.
      if (op.entidad === 'necesidad') {
        auditar(db, actor, { accion: op.tipo === 'crear' ? 'necesidad.crear' : 'necesidad.estado', entidad: 'necesidad', registroId: op.registroId, detalle: 'Registrada sin conexión y sincronizada.' })
      } else {
        auditar(db, actor, { accion: 'visita.registrar', entidad: 'visita', registroId: op.registroId, detalle: 'Registrada sin conexión y sincronizada.' })
      }
    }
    res.sincronizados++
    res.confirmados.push(op.id)
  }
  servidor.syncClaves = tabla.length > MAX_CLAVES_APLICADAS ? tabla.slice(tabla.length - MAX_CLAVES_APLICADAS) : tabla
  return res
}

/* ───────────── IndexedDB (con respaldo en memoria) ───────────── */
const NOMBRE_IDB = 'cuidared-offline'
const VERSION_IDB = 2
const STORE = 'pendientes'
let idb: Promise<IDBDatabase | null> | null = null

/** Migra el esquema de `desde` a la versión actual (ver el encabezado). Corre dentro de la transacción de versión. */
function migrar(req: IDBOpenDBRequest, desde: number) {
  const db = req.result
  const t = req.transaction
  if (desde < 1) db.createObjectStore(STORE, { keyPath: 'id' })
  if (desde < 2 && t) {
    const s = t.objectStore(STORE)
    s.createIndex('porUsuario', 'usuarioId')
    s.createIndex('porRegistro', 'registroId')
    s.openCursor().onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result
      if (!cursor) return
      const op = normalizarOperacion(cursor.value)
      if (op) cursor.update(op)
      else cursor.delete()
      cursor.continue()
    }
  }
}

function abrir(): Promise<IDBDatabase | null> {
  if (idb) return idb
  idb = new Promise((resolve) => {
    try {
      const req = indexedDB.open(NOMBRE_IDB, VERSION_IDB)
      req.onupgradeneeded = (ev) => migrar(req, ev.oldVersion)
      req.onsuccess = () => {
        const db = req.result
        // Otra pestaña necesita actualizar el esquema: se libera la conexión para no bloquearla.
        db.onversionchange = () => {
          db.close()
          idb = null
        }
        resolve(db)
      }
      req.onerror = () => {
        idb = null
        resolve(null)
      }
    } catch {
      idb = null
      resolve(null)
    }
  })
  return idb
}

const conTiempo = <T>(p: Promise<T>, ms = ESPERA_IDB_MS) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('IndexedDB no respondió')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })

async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await conTiempo(abrir())
  if (!db) return undefined
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, modo)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(req ? req.result : undefined)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

const idbTodos = () => tx<OpCola[]>('readonly', (s) => s.getAll() as IDBRequest<OpCola[]>)
const idbGuardar = (op: OpCola) => tx('readwrite', (s) => void s.put(op))
const idbBorrar = (id: string) => tx('readwrite', (s) => void s.delete(id))
const idbVaciar = () => tx('readwrite', (s) => void s.clear())
/** Guarda y borra varias filas en una sola transacción (todo o nada). */
const idbAplicar = (guardar: readonly OpCola[], borrar: readonly string[]) =>
  guardar.length === 0 && borrar.length === 0
    ? Promise.resolve()
    : tx(
        'readwrite',
        (s) => {
          guardar.forEach((op) => s.put(op))
          borrar.forEach((id) => s.delete(id))
        },
      ).then(() => undefined)

/* ───────────── Estado observable de la sincronización ───────────── */
const CLAVE_ULTIMO = 'cuidared:sync-ultimo'
const CLAVE_FALLO = 'cuidared:simular-fallo-sync'
let estado: EstadoSync = { sincronizando: false, ultimo: leerUltimo() }
const oyentes = new Set<() => void>()

/** Último resultado del usuario en sesión (el de otro usuario del dispositivo no se muestra). */
function leerUltimo(): ResultadoSync | null {
  try {
    const raw = localStorage.getItem(CLAVE_ULTIMO)
    if (!raw) return null
    const r = JSON.parse(raw) as ResultadoSync
    return r.usuarioId && r.usuarioId === getSesion()?.usuarioId ? r : null
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
const cola = () => getPendientes() as OpCola[]

/** Pendientes del usuario en sesión (los de otros usuarios del mismo dispositivo no se muestran ni se envían). */
export function pendientesDelUsuario(usuarioId = getSesion()?.usuarioId): OpCola[] {
  return usuarioId ? cola().filter((p) => p.usuarioId === usuarioId) : []
}

let cache: { base: OperacionPendiente[]; uid: string | undefined; lista: OpCola[] } | null = null
function snapshotPendientes(): OpCola[] {
  const base = getPendientes()
  const uid = getSesion()?.usuarioId
  if (!cache || cache.base !== base || cache.uid !== uid) cache = { base, uid, lista: pendientesDelUsuario(uid) }
  return cache.lista
}

/** Hook: registros del usuario en sesión que esperan sincronización. */
export function usePendientes(): OpCola[] {
  return useSyncExternalStore(subscribe, snapshotPendientes, snapshotPendientes)
}

let secuencia = 0

/**
 * Guarda localmente un registro creado o modificado sin conexión. Si el mismo registro ya estaba
 * pendiente, se combina: se conservan el tipo de operación, la versión base y el lugar en la cola, pero la
 * escritura es nueva (otra clave de cliente) y vuelve a intentarse desde cero.
 */
export async function encolar(entidad: EntidadOffline, datos: Visita | Necesidad, usuario: Usuario): Promise<void> {
  const ahora = new Date().toISOString()
  const actual = cola().find((p) => p.registroId === datos.id && p.usuarioId === usuario.id)
  const enServidor = (entidad === 'visita' ? getServidor().visitas : getServidor().necesidades).find((x) => x.id === datos.id) as
    | Visita
    | Necesidad
    | undefined
  const limpio = minimizarDatos({ ...datos, actualizadoEn: ahora, actualizadoPor: usuario.id })
  const op: OpCola = actual
    ? { ...actual, datos: limpio, actualizadoEn: ahora, claveCliente: nuevoUUID(), intentos: 0, ultimoError: undefined, proximoIntentoEn: undefined }
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
        claveCliente: nuevoUUID(),
        orden: siguienteOrden(),
      }
  setPendientes([...cola().filter((p) => p.id !== op.id), op])
  try {
    await idbGuardar(op)
  } catch {
    avisar('No se pudo guardar el registro en el dispositivo. Verifica el espacio disponible.', 'error')
  }
}

/** Descarta un registro pendiente (el usuario decide no enviarlo). */
export async function descartarPendiente(opId: string) {
  setPendientes(cola().filter((p) => p.id !== opId))
  await idbBorrar(opId)
}

/** Quita de la cola (y del dispositivo) lo que el servidor ya procesó. Devuelve cuántas quitó. */
async function limpiarYaAplicadas(usuarioId?: string): Promise<number> {
  const claves = new Set(((getServidor() as DBConSync).syncClaves ?? []).map((c) => c.clave))
  const sobran = yaAplicadas(usuarioId ? pendientesDelUsuario(usuarioId) : cola(), claves).map((op) => op.id)
  if (sobran.length === 0) return 0
  setPendientes(cola().filter((p) => !sobran.includes(p.id)))
  try {
    await idbAplicar([], sobran)
  } catch {
    /* quedarán para la próxima limpieza: el servidor las reconoce como duplicadas */
  }
  return sobran.length
}

/* ───────────── Sincronización ───────────── */
const MOTIVO_FALLO_SIMULADO = 'El servidor no respondió (fallo simulado).'

/** Envía al servidor los registros pendientes del usuario en sesión, por lotes. */
export async function sincronizar(opciones: OpcionesSync = {}): Promise<ResultadoSync | null> {
  const uid = getSesion()?.usuarioId
  if (!uid || !estaEnLinea() || estado.sincronizando) return null
  const inicio = Date.now()
  const elegidas = seleccionarParaEnvio(pendientesDelUsuario(uid), inicio, { sinEspera: opciones.sinEspera || opciones.manual, incluirDetenidas: opciones.manual })
  if (elegidas.length === 0) return null
  setEstado({ sincronizando: true })

  const resultado: ResultadoSync = { fecha: new Date(inicio).toISOString(), usuarioId: uid, sincronizados: 0, conflictos: [], errores: [], duplicados: 0, lotes: 0 }
  const fallo = simulandoFalloSync() ? MOTIVO_FALLO_SIMULADO : null
  // Las que estaban detenidas vuelven a empezar (el usuario pidió reintentarlas).
  const reiniciar = new Set(elegidas.filter(estaDetenida).map((o) => o.id))

  try {
    for (const lote of dividirEnLotes(elegidas, TAMANO_LOTE)) {
      if (!estaEnLinea()) break
      // Se toma la versión actual de cada una: el usuario pudo editarla o descartarla entre lotes.
      const vigentes = lote.map((o) => cola().find((p) => p.id === o.id)).filter((o): o is OpCola => !!o).map((o) => (reiniciar.has(o.id) ? { ...o, intentos: 0 } : o))
      if (vigentes.length === 0) continue

      const caja: { r?: ResultadoLote } = {}
      const ok = mutate(
        (db) => {
          caja.r = aplicarLote(db, vigentes, { usuario: db.usuarios.find((u) => u.id === uid), fallo })
        },
        { silencioso: true },
      )
      const r = caja.r
      if (!ok || !r) break // se perdió la conexión a mitad de camino: no cuenta como intento fallido

      // Se retiran del dispositivo los confirmados y se anotan los fallos; lo demás queda como estaba.
      const ahora = Date.now()
      const restantes = cola()
        .filter((p) => !r.confirmados.includes(p.id))
        .map((p) => (r.fallidos.has(p.id) ? registrarFallo(reiniciar.has(p.id) ? { ...p, intentos: 0 } : p, r.fallidos.get(p.id)!, ahora, Math.random()) : p))
      setPendientes(restantes)
      const actualizadas = restantes.filter((p) => r.fallidos.has(p.id))
      try {
        await idbAplicar(actualizadas, r.confirmados)
      } catch {
        avisar('No se pudo actualizar el almacenamiento del dispositivo. Verifica el espacio disponible.', 'error')
      }

      resultado.lotes = (resultado.lotes ?? 0) + 1
      resultado.sincronizados += r.sincronizados
      resultado.duplicados = (resultado.duplicados ?? 0) + r.duplicados
      resultado.conflictos.push(...r.conflictos)
      for (const e of r.errores) {
        const op = actualizadas.find((p) => p.registroId === e.registroId && p.entidad === e.entidad)
        resultado.errores.push({ ...e, intentos: op?.intentos, detenida: op ? estaDetenida(op) : undefined })
      }
    }
  } finally {
    setEstado({ sincronizando: false })
  }

  if (!resultado.lotes) return null
  resultado.restantes = pendientesDelUsuario(uid).length
  setEstado({ ultimo: resultado })
  informar(resultado, !!opciones.manual)
  programarReintento()
  return resultado
}

/**
 * Para el cierre de sesión: si hay conexión envía lo pendiente del usuario antes de salir y devuelve cuántos
 * registros siguen guardados solo en este dispositivo (la pantalla puede avisarle antes de cerrar la sesión).
 */
export async function sincronizarAntesDeSalir(): Promise<number> {
  if (estaEnLinea() && pendientesDelUsuario().length) await sincronizar({ sinEspera: true })
  return pendientesDelUsuario().length
}

/** Avisa al usuario del resultado. Los reintentos automáticos solo molestan la primera vez que un registro falla. */
function informar(r: ResultadoSync, manual: boolean) {
  const n = r.sincronizados
  if (n > 0) {
    const ganaServidor = r.conflictos.filter((c) => c.gana === 'servidor').length
    const conflictos = r.conflictos.length
      ? ` ${r.conflictos.length} conflicto(s) resuelto(s) con "última escritura gana"${ganaServidor ? `: en ${ganaServidor} se conservó la versión más reciente del servidor` : ''}.`
      : ''
    avisar(`Sincronización completada: ${n} registro(s) enviado(s).${conflictos}`, r.conflictos.length ? 'info' : 'ok')
  }
  if (r.errores.length === 0) return
  const detenidas = r.errores.filter((e) => e.detenida).length
  if (detenidas > 0) {
    avisar(`${detenidas} registro(s) no se pudieron enviar después de varios intentos. Siguen guardados en el dispositivo: revisa «Conexión y sincronización».`, 'error')
  } else if (manual || r.errores.some((e) => e.intentos === 1)) {
    avisar(`No se pudieron sincronizar ${r.errores.length} registro(s). Siguen guardados en el dispositivo y se reintentará.`, 'error')
  }
}

/* ───────────── Arranque ───────────── */
let iniciado = false
let temporizador: ReturnType<typeof setTimeout> | undefined

function intentar(opciones: OpcionesSync = {}) {
  if (!estaEnLinea()) return
  if (seleccionarParaEnvio(pendientesDelUsuario(), Date.now(), { sinEspera: opciones.sinEspera }).length) void sincronizar(opciones)
}

/** Programa el próximo reintento justo cuando termina la espera más corta. */
function programarReintento() {
  clearTimeout(temporizador)
  const t = proximoReintentoMs(pendientesDelUsuario(), Date.now())
  if (t !== null) temporizador = setTimeout(() => intentar(), t + 250)
}

/** Al cerrar la sesión de `usuarioId`: se descarta su último resultado y se limpia lo que ya está en el servidor. */
async function alCerrarSesion(usuarioId: string) {
  setEstado({ ultimo: null })
  try {
    localStorage.removeItem(CLAVE_ULTIMO)
  } catch {
    /* ignorar */
  }
  await limpiarYaAplicadas(usuarioId)
}

/** Carga la cola desde IndexedDB y programa la sincronización automática. Se llama una vez al iniciar la app. */
export async function iniciarSync() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true
  try {
    const leidas = ((await idbTodos()) ?? []).map((cruda) => ({ cruda: cruda as Partial<OpCola> | null, op: normalizarOperacion(cruda) }))
    const normalizadas = leidas.flatMap((l) => (l.op ? [l.op] : []))
    // Lo capturado mientras se leía (si ocurrió) tiene prioridad sobre lo leído.
    const enMemoria = cola()
    setPendientes([...normalizadas.filter((o) => !enMemoria.some((m) => m.id === o.id)), ...enMemoria])
    ultimoOrden = Math.max(ultimoOrden, ...cola().map((o) => o.orden ?? 0))
    // Lo que cambió al normalizar (fila heredada sin clave, datos sensibles) se vuelve a guardar depurado;
    // las filas inválidas se eliminan.
    const depuradas = leidas.flatMap((l) => (l.op && (!l.cruda?.claveCliente || JSON.stringify(l.cruda.datos) !== JSON.stringify(l.op.datos)) ? [l.op] : []))
    const invalidas = leidas.flatMap((l) => (!l.op && typeof l.cruda?.id === 'string' ? [l.cruda.id] : []))
    await idbAplicar(depuradas, invalidas)
  } catch {
    /* sin IndexedDB o sin respuesta: se trabaja con lo que haya en memoria */
  }
  await limpiarYaAplicadas()

  let uidPrevio = getSesion()?.usuarioId
  suscribirConectividad(() => setTimeout(() => intentar({ sinEspera: true }), 300))
  suscribirSesion(() => {
    // sesion.ts también avisa en cada latido de actividad (1 por minuto): esos no deben saltarse la espera de reintento.
    const actual = getSesion()?.usuarioId
    const cambio = actual !== uidPrevio
    if (cambio) {
      const previo = uidPrevio
      uidPrevio = actual
      if (previo) void alCerrarSesion(previo)
    }
    setTimeout(() => intentar({ sinEspera: cambio }), 300)
  })
  setInterval(() => intentar(), REINTENTO_MS)
  intentar()
  programarReintento()
}

alReiniciar(() => {
  setPendientes([])
  void idbVaciar().catch(() => undefined)
  try {
    localStorage.removeItem(CLAVE_ULTIMO)
  } catch {
    /* ignorar */
  }
  setEstado({ ultimo: null })
})
