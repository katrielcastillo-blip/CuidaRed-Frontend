/*
 * abreviaturas.ts — Catálogo de abreviaturas (RF-06 · CU-07 "Procesar abreviaturas en texto"): guardado en
 * IndexedDB para usarse sin conexión, caché en memoria, expansión de texto, sugerencias y sincronización futura.
 * Módulo: dominio (catálogos).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Cómo funciona
 *  - La lista local ({@link ABREVIATURAS} de catalogos.ts + {@link ABREVIATURAS_EXTRA}) viaja empaquetada con la app:
 *    `expandirAbreviaturas()` y `sugerencias()` funcionan desde el primer instante, con o sin conexión.
 *  - `obtenerAbreviaturas()` guarda el catálogo en IndexedDB (BD `cuidared-catalogos`, almacén `abreviaturas`,
 *    versión de la BD = {@link VERSION_BD}; versión del catálogo en el almacén `meta`) y lo sirve desde la
 *    caché en memoria. Si IndexedDB no está disponible (modo privado, bloqueo…) usa la lista local sin fallar.
 *  - Si cambian las siglas empaquetadas (nueva versión de la app), el catálogo local se vuelve a sembrar solo.
 *  - `sincronizarAbreviaturas(fetcher)` prepara el contrato con la API (aún no existe): sin `fetcher` no hace
 *    ninguna llamada.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { ABREVIATURAS } from './catalogos'

/* ───────────── Tipos ───────────── */
export interface Abreviatura {
  /** Sigla en minúsculas y solo letras (p. ej. "pa"). */
  sigla: string
  /** Texto completo (p. ej. "presión arterial"). */
  expansion: string
}

export type OrigenCatalogo = 'local' | 'api'

export interface EstadoCatalogoAbreviaturas {
  items: Abreviatura[]
  /** Versión del catálogo (la local empaquetada o la que publique la API). */
  version: number
  origen: OrigenCatalogo
  /** Fecha ISO de la última carga/sincronización ('' si solo se usa la lista empaquetada en memoria). */
  actualizadoEn: string
  /** true si el catálogo está guardado en IndexedDB (disponible aunque se cierre la app sin conexión). */
  enIndexedDB: boolean
}

/* ───────────── Catálogo local ───────────── */
/**
 * Siglas adicionales a las de `catalogos.ts` (la lista del dominio manda si hay conflicto).
 * Solo letras en minúsculas: la expansión respeta la mayúscula inicial que escriba la persona.
 */
export const ABREVIATURAS_EXTRA: Readonly<Record<string, string>> = {
  dm: 'diabetes',
  fc: 'frecuencia cardíaca',
  glic: 'glicemia',
  obs: 'observaciones',
  dom: 'domicilio',
  tel: 'teléfono',
  cel: 'celular',
  ctrl: 'control',
  tmb: 'también',
  pq: 'porque',
}

/** Versión del catálogo local empaquetado. Súbela si quieres forzar el resembrado aunque las siglas no cambien. */
export const VERSION_CATALOGO_LOCAL = 1

const RE_SIGLA = /^\p{L}{1,12}$/u
const MAX_EXPANSION = 80

/** Normaliza, valida y ordena una lista (descarta entradas inválidas; la última repetida gana). */
function normalizar(origen: ReadonlyArray<{ sigla?: unknown; expansion?: unknown }>): Abreviatura[] {
  const porSigla = new Map<string, string>()
  for (const a of origen) {
    if (typeof a?.sigla !== 'string' || typeof a.expansion !== 'string') continue
    const sigla = a.sigla.trim().toLowerCase()
    // Una sola línea, sin caracteres de control (el texto se inserta tal cual en observaciones).
    const expansion = a.expansion.replace(/\s+/g, ' ').trim()
    if (!RE_SIGLA.test(sigla) || expansion.length === 0 || expansion.length > MAX_EXPANSION) continue
    if (/\p{Cc}/u.test(expansion)) continue
    porSigla.set(sigla, expansion)
  }
  return [...porSigla.entries()].map(([sigla, expansion]) => ({ sigla, expansion })).sort((x, y) => x.sigla.localeCompare(y.sigla, 'es'))
}

function listaLocal(): Abreviatura[] {
  const unidas = { ...ABREVIATURAS_EXTRA, ...ABREVIATURAS }
  return normalizar(Object.entries(unidas).map(([sigla, expansion]) => ({ sigla, expansion })))
}

/** Huella de una lista: detecta cuándo cambió el catálogo empaquetado respecto al guardado en IndexedDB. */
function firmaDe(lista: Abreviatura[]): string {
  let h = 5381
  for (const ch of lista.map((a) => `${a.sigla}=${a.expansion}`).join('|')) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0
  return `${lista.length}:${h.toString(36)}`
}

const LOCAL = listaLocal()
const FIRMA_LOCAL = firmaDe(LOCAL)

/* ───────────── Estado en memoria (caché) ───────────── */
let estado: EstadoCatalogoAbreviaturas = { items: LOCAL, version: VERSION_CATALOGO_LOCAL, origen: 'local', actualizadoEn: '', enIndexedDB: false }
let mapa = new Map(estado.items.map((a) => [a.sigla, a.expansion]))
const oyentes = new Set<() => void>()

function aplicar(items: Abreviatura[], resto: Omit<EstadoCatalogoAbreviaturas, 'items'>) {
  estado = { items, ...resto }
  mapa = new Map(items.map((a) => [a.sigla, a.expansion]))
  oyentes.forEach((f) => f())
}

/** Texto de ayuda con toda la lista: "pa → presión arterial · hta → hipertensión · …". */
export const textoAyudaAbreviaturas = (items: Abreviatura[] = estado.items) => items.map((a) => `${a.sigla} → ${a.expansion}`).join(' · ')

/* ───────────── IndexedDB ───────────── */
export const BD_CATALOGOS = 'cuidared-catalogos'
/** Versión del esquema de la BD (sube si se agregan almacenes). No es la versión del catálogo. */
export const VERSION_BD = 1
export const ALMACEN_ABREVIATURAS = 'abreviaturas'
const ALMACEN_META = 'meta'
const CLAVE_META = 'abreviaturas'

interface MetaCatalogo {
  clave: string
  version: number
  origen: OrigenCatalogo
  /** Huella de la lista local con la que se sembró (solo se usa con origen "local"). */
  firma: string
  actualizadoEn: string
}

let bdAbierta: Promise<IDBDatabase | null> | null = null

function abrirBD(): Promise<IDBDatabase | null> {
  if (bdAbierta) return bdAbierta
  bdAbierta = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(BD_CATALOGOS, VERSION_BD)
      req.onupgradeneeded = () => {
        const bd = req.result
        if (!bd.objectStoreNames.contains(ALMACEN_ABREVIATURAS)) bd.createObjectStore(ALMACEN_ABREVIATURAS, { keyPath: 'sigla' })
        if (!bd.objectStoreNames.contains(ALMACEN_META)) bd.createObjectStore(ALMACEN_META, { keyPath: 'clave' })
      }
      req.onsuccess = () => {
        const bd = req.result
        // Otra pestaña actualiza la BD: se cierra para no bloquearla; se reabrirá cuando haga falta.
        bd.onversionchange = () => {
          bd.close()
          bdAbierta = null
        }
        resolve(bd)
      }
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return bdAbierta
}

function leerBD(bd: IDBDatabase): Promise<{ items: unknown[]; meta: MetaCatalogo | undefined }> {
  return new Promise((resolve, reject) => {
    const t = bd.transaction([ALMACEN_ABREVIATURAS, ALMACEN_META], 'readonly')
    const items = t.objectStore(ALMACEN_ABREVIATURAS).getAll()
    const meta = t.objectStore(ALMACEN_META).get(CLAVE_META)
    t.oncomplete = () => resolve({ items: items.result as unknown[], meta: meta.result as MetaCatalogo | undefined })
    t.onerror = t.onabort = () => reject(t.error)
  })
}

/** Reemplaza todo el catálogo en una sola transacción (o se guarda completo o no se toca). */
function escribirBD(bd: IDBDatabase, items: Abreviatura[], meta: MetaCatalogo): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = bd.transaction([ALMACEN_ABREVIATURAS, ALMACEN_META], 'readwrite')
    const almacen = t.objectStore(ALMACEN_ABREVIATURAS)
    almacen.clear()
    items.forEach((a) => almacen.put(a))
    t.objectStore(ALMACEN_META).put(meta)
    t.oncomplete = () => resolve()
    t.onerror = t.onabort = () => reject(t.error)
  })
}

let carga: Promise<void> | null = null

async function cargar(): Promise<void> {
  const bd = await abrirBD()
  if (!bd) return
  try {
    const { items, meta } = await leerBD(bd)
    const guardadas = normalizar(items as Array<{ sigla?: unknown; expansion?: unknown }>)
    // Se conserva lo guardado si viene de la API o si coincide con la lista empaquetada actual.
    if (meta && guardadas.length > 0 && (meta.origen === 'api' || meta.firma === FIRMA_LOCAL)) {
      aplicar(guardadas, { version: meta.version, origen: meta.origen, actualizadoEn: meta.actualizadoEn, enIndexedDB: true })
      return
    }
    const nueva: MetaCatalogo = { clave: CLAVE_META, version: VERSION_CATALOGO_LOCAL, origen: 'local', firma: FIRMA_LOCAL, actualizadoEn: new Date().toISOString() }
    await escribirBD(bd, LOCAL, nueva)
    aplicar(LOCAL, { version: nueva.version, origen: 'local', actualizadoEn: nueva.actualizadoEn, enIndexedDB: true })
  } catch {
    /* IndexedDB falló a mitad de camino: se sigue con la lista en memoria (local o ya sincronizada). */
  }
}

/**
 * Catálogo de abreviaturas. La primera llamada lo guarda en IndexedDB (si está disponible); las siguientes lo
 * sirven desde la caché en memoria. Nunca rechaza: sin IndexedDB devuelve la lista local empaquetada.
 */
export async function obtenerAbreviaturas(): Promise<Abreviatura[]> {
  carga ??= cargar()
  await carga
  return estado.items
}

/** Versión, origen y fecha del catálogo en uso (para mostrarlo en Ayuda o diagnosticar). */
export const infoCatalogoAbreviaturas = (): Omit<EstadoCatalogoAbreviaturas, 'items'> => ({
  version: estado.version,
  origen: estado.origen,
  actualizadoEn: estado.actualizadoEn,
  enIndexedDB: estado.enIndexedDB,
})

/** Hook: lista vigente; se actualiza sola cuando termina de cargar o sincronizar. Dispara la carga la primera vez. */
export function useAbreviaturas(): Abreviatura[] {
  return useEstadoAbreviaturas().items
}

export function useEstadoAbreviaturas(): EstadoCatalogoAbreviaturas {
  const actual = useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => void oyentes.delete(f)
    },
    () => estado,
    () => estado,
  )
  useEffect(() => {
    void obtenerAbreviaturas()
  }, [])
  return actual
}

// Precarga al arrancar la app: así el catálogo ya está en IndexedDB aunque la persona se quede sin conexión
// antes de abrir un formulario. Solo si el navegador tiene IndexedDB (no en pruebas ni en modo servidor).
if (typeof indexedDB !== 'undefined') void obtenerAbreviaturas()

/* ───────────── Expansión de texto ───────────── */
/** Mayúscula inicial: se conserva si la sigla se escribió "Pa" (no si es "pa" ni "PA" ni una sola letra). */
export function ajustarMayusculas(escrito: string, expansion: string): string {
  const conMayuscula = escrito.length > 1 && escrito[0] === escrito[0]!.toUpperCase() && escrito !== escrito.toUpperCase()
  return conMayuscula ? expansion[0]!.toUpperCase() + expansion.slice(1) : expansion
}

/** Expansión de una palabra suelta; undefined si no es una sigla del catálogo. */
function expandirPalabra(palabra: string): string | undefined {
  const exp = mapa.get(palabra.toLowerCase())
  return exp === undefined ? undefined : ajustarMayusculas(palabra, exp)
}

/**
 * Expande la última palabra del texto si es una sigla y va seguida de un espacio o signo de puntuación
 * (expansión "al escribir"). Devuelve el mismo texto si no hay nada que expandir.
 */
export function expandirAbreviatura(texto: string): string {
  const m = /(^|[\s(¿¡])(\p{L}+)\.?([\s,.;:!?)])$/u.exec(texto)
  if (!m) return texto
  const exp = expandirPalabra(m[2]!)
  if (exp === undefined) return texto
  const inicio = texto.length - (m[0].length - m[1]!.length)
  return texto.slice(0, inicio) + exp + m[3]
}

// Una "palabra" es un trozo entre espacios cuyo núcleo son solo letras (con signos de apertura/cierre alrededor):
// así no se tocan correos, enlaces, números ni "120/80".
const RE_PALABRA = /(?<=^|\s)([¿¡"'“«(]*)(\p{L}+)([.,;:!?)"'”»]*)(?=\s|$)/gu

/** Expande todas las siglas del texto y cuenta cuántas se cambiaron. */
export function expandirAbreviaturasConConteo(texto: string): { texto: string; cambios: number } {
  let cambios = 0
  const resultado = texto.replace(RE_PALABRA, (todo: string, antes: string, palabra: string, despues: string, posicion: number) => {
    const exp = expandirPalabra(palabra)
    if (exp === undefined) return todo
    cambios++
    // "cada sem. por la mañana": el punto es de la abreviatura (sigue minúscula o número) y se quita;
    // "tomó sus meds. Buen ánimo": el punto cierra la oración y se conserva.
    const resto = texto.slice(posicion + todo.length)
    const cierre = despues === '.' && /^\s+(\p{Ll}|\d)/u.test(resto) ? '' : despues
    return antes + exp + cierre
  })
  return { texto: resultado, cambios }
}

/** Expande todas las siglas de un texto ("pa y meds ok" → "presión arterial y medicamentos en buen estado"). */
export const expandirAbreviaturas = (texto: string): string => expandirAbreviaturasConConteo(texto).texto

/**
 * Siglas que empiezan por `prefijo` (sin distinguir mayúsculas), la coincidencia exacta primero y luego las
 * más cortas. Devuelve [] si el prefijo está vacío o no son solo letras.
 */
export function sugerencias(prefijo: string, max = 5): Abreviatura[] {
  const p = prefijo.trim().toLowerCase()
  if (!p || !/^\p{L}+$/u.test(p)) return []
  return estado.items
    .filter((a) => a.sigla.startsWith(p))
    .sort((x, y) => Number(y.sigla === p) - Number(x.sigla === p) || x.sigla.length - y.sigla.length || x.sigla.localeCompare(y.sigla, 'es'))
    .slice(0, Math.max(0, max))
}

/* ───────────── Sincronización con la API (futura) ─────────────
 * Contrato propuesto de `GET /api/v1/catalogos/abreviaturas` (aún no existe; ajustar cuando el backend lo publique):
 *
 *   200 OK  { "version": 3, "actualizadoEn": "2026-11-06T12:00:00Z",
 *             "data": [ { "sigla": "pa", "expansion": "presión arterial", "activa": true }, … ] }
 *
 *  - `version`: entero ≥ 1 que sube con cada cambio del catálogo. Si no es mayor que la guardada, no se hace nada.
 *  - `activa: false` retira una sigla del catálogo.
 *  - Si el backend pagina la colección (CollectionQuery/PaginatedResponse), el `fetcher` debe juntar las páginas
 *    y devolver este mismo formato.
 * El catálogo de la API reemplaza al local; una respuesta vacía o inválida nunca borra lo que ya hay.
 */
export const RUTA_API_ABREVIATURAS = '/api/v1/catalogos/abreviaturas'

export interface AbreviaturaApi {
  sigla: string
  expansion: string
  /** false = la sigla se retiró. Por defecto true. */
  activa?: boolean
}

export interface RespuestaAbreviaturasApi {
  version: number
  actualizadoEn: string
  data: AbreviaturaApi[]
}

export interface OpcionesFetcherAbreviaturas {
  /** Versión del catálogo que ya se tiene (por si el backend responde 304/“sin cambios”). */
  versionActual: number
  signal?: AbortSignal
}

/** Quien hace la petición real (cliente HTTP con la sesión). Devuelve el cuerpo JSON de la respuesta. */
export type FetcherAbreviaturas = (opciones: OpcionesFetcherAbreviaturas) => Promise<unknown>

export type ResultadoSincronizacionAbreviaturas =
  | { ok: true; actualizado: boolean; version: number; total: number }
  | { ok: false; motivo: 'sin-origen' | 'sin-conexion' | 'error-red' | 'respuesta-invalida' }

function leerRespuesta(cuerpo: unknown): RespuestaAbreviaturasApi | null {
  const r = cuerpo as Partial<RespuestaAbreviaturasApi> | null
  if (!r || typeof r !== 'object' || !Array.isArray(r.data)) return null
  if (!Number.isSafeInteger(r.version) || (r.version as number) < 1) return null
  return { version: r.version as number, actualizadoEn: typeof r.actualizadoEn === 'string' ? r.actualizadoEn : new Date().toISOString(), data: r.data as AbreviaturaApi[] }
}

/**
 * Descarga el catálogo de la API (a través de `fetcher`) y lo guarda en IndexedDB y en memoria.
 * Sin `fetcher` no hace ninguna llamada y devuelve `{ ok: false, motivo: 'sin-origen' }`: así se puede cablear
 * hoy (p. ej. al volver la conexión) y activar cuando exista el endpoint.
 */
export async function sincronizarAbreviaturas(fetcher?: FetcherAbreviaturas): Promise<ResultadoSincronizacionAbreviaturas> {
  if (!fetcher) return { ok: false, motivo: 'sin-origen' }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, motivo: 'sin-conexion' }
  await obtenerAbreviaturas()
  let cuerpo: unknown
  try {
    cuerpo = await fetcher({ versionActual: estado.origen === 'api' ? estado.version : 0 })
  } catch {
    return { ok: false, motivo: 'error-red' }
  }
  const respuesta = leerRespuesta(cuerpo)
  if (!respuesta) return { ok: false, motivo: 'respuesta-invalida' }
  if (estado.origen === 'api' && respuesta.version <= estado.version) return { ok: true, actualizado: false, version: estado.version, total: estado.items.length }
  const lista = normalizar(respuesta.data.filter((a) => a && a.activa !== false))
  if (lista.length === 0) return { ok: false, motivo: 'respuesta-invalida' }
  const meta: MetaCatalogo = { clave: CLAVE_META, version: respuesta.version, origen: 'api', firma: '', actualizadoEn: respuesta.actualizadoEn }
  const bd = await abrirBD()
  let guardado = false
  if (bd) {
    try {
      await escribirBD(bd, lista, meta)
      guardado = true
    } catch {
      /* se usa en memoria; se reintentará en la próxima sincronización */
    }
  }
  aplicar(lista, { version: meta.version, origen: 'api', actualizadoEn: meta.actualizadoEn, enIndexedDB: guardado })
  return { ok: true, actualizado: true, version: meta.version, total: lista.length }
}
