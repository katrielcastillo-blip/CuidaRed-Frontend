/*
 * sync-logica.spec.ts — Pruebas unitarias de la lógica pura del cliente de sincronización (RF-10 · CU-14):
 * idempotencia por clave de cliente, orden de envío, Last-Write-Wins, lotes, reintentos con espera exponencial
 * y datos mínimos de la cola (RS-018).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import {
  aplicarLote,
  aplicarOperacion,
  claveDe,
  compararOperaciones,
  dividirEnLotes,
  esClaveSensible,
  esperaReintento,
  ESPERA_BASE_MS,
  ESPERA_MAX_MS,
  MAX_CLAVES_APLICADAS,
  MAX_INTENTOS,
  minimizarDatos,
  normalizarOperacion,
  nuevoUUID,
  ordenarCola,
  proximoReintentoMs,
  registrarFallo,
  resolverLWW,
  seleccionarParaEnvio,
  yaAplicadas,
  type OpCola,
} from '../../src/domain/sync'
import type { DB, Necesidad, Usuario, Visita } from '../../src/domain/types'

/* ───────────── Datos de prueba ───────────── */
const T0 = Date.parse('2026-10-22T15:00:00.000Z')
const iso = (ms: number) => new Date(T0 + ms).toISOString()

function necesidad(p: Partial<Necesidad> = {}): Necesidad {
  return { id: 'n-1', adultoId: 'a-1', registradaPor: 'u-1', tipo: 'medicamentos', descripcion: 'Losartán', recurrente: false, prioridad: 'alta', estado: 'pendiente', creadaEn: iso(-86_400_000), historial: [], actualizadoEn: iso(-86_400_000), ...p }
}

function visita(p: Partial<Visita> = {}): Visita {
  return { id: 'v-1', adultoId: 'a-1', cuidadorId: 'u-1', razon: 'Seguimiento', tipo: 'Visita de Seguimiento', fecha: '2026-10-22', horaPautada: '10:00', estado: 'completada', detallesAdicionales: [], checklist: [], evidencias: [], actualizadoEn: iso(-1000), ...p }
}

let secuencia = 0
/** Operación pendiente con lo mínimo; `datos.actualizadoEn` y `actualizadoEn` coinciden, como al encolar. */
function op(p: Partial<OpCola> & { datos?: Visita | Necesidad } = {}): OpCola {
  const n = ++secuencia
  const datos = p.datos ?? visita({ id: `v-${n}`, actualizadoEn: iso(n) })
  return {
    id: `op-${n}`,
    usuarioId: 'u-1',
    entidad: 'adultoId' in datos && 'cuidadorId' in datos ? 'visita' : 'necesidad',
    tipo: 'crear',
    registroId: datos.id,
    baseActualizadoEn: null,
    actualizadoEn: datos.actualizadoEn,
    creadaEn: datos.actualizadoEn,
    intentos: 0,
    claveCliente: `clave-${n}`,
    orden: n,
    ...p,
    datos,
  }
}

const aplicable = (o: OpCola) => ({ registroId: o.registroId, datos: o.datos, baseActualizadoEn: o.baseActualizadoEn, actualizadoEn: o.actualizadoEn, claveCliente: claveDe(o) })

const usuario = { id: 'u-1', rol: 'voluntario', nombre: 'Carlos', apellido: 'Ruiz', estado: 'activo', orgId: 'org' } as unknown as Usuario

function servidor(p: Partial<DB> = {}): DB {
  return { visitas: [], necesidades: [], usuarios: [usuario], adultos: [], auditoria: [], ...p } as unknown as DB
}

const SIEMPRE_VALIDA = () => null

/* ───────────── Last-Write-Wins ───────────── */
test.describe('Last-Write-Wins (marcas de tiempo UTC)', () => {
  test('gana la modificación más reciente', () => {
    expect(resolverLWW(iso(2000), iso(1000))).toBe('local')
    expect(resolverLWW(iso(1000), iso(2000))).toBe('servidor')
  })

  test('con marcas iguales gana el servidor (resultado estable)', () => {
    expect(resolverLWW(iso(500), iso(500))).toBe('servidor')
    // Mismo instante escrito con y sin milisegundos
    expect(resolverLWW('2026-10-22T15:00:00Z', '2026-10-22T15:00:00.000Z')).toBe('servidor')
  })

  test('compara instantes, no cadenas', () => {
    // "…T15:00:00Z" sería mayor que "…T15:00:00.500Z" como texto ('Z' > '.'), pero es 500 ms anterior.
    expect(resolverLWW('2026-10-22T15:00:00Z', '2026-10-22T15:00:00.500Z')).toBe('servidor')
    expect(resolverLWW('2026-10-22T15:00:01Z', '2026-10-22T15:00:00.500Z')).toBe('local')
  })

  test('una marca ilegible pierde frente a una válida', () => {
    expect(resolverLWW('no-es-fecha', iso(0))).toBe('servidor')
    expect(resolverLWW(iso(0), 'no-es-fecha')).toBe('local')
  })

  test('conflicto: se conserva la versión local si es más reciente', () => {
    const enServidor = necesidad({ estado: 'satisfecha', actualizadoEn: iso(1000) })
    const local = op({ datos: necesidad({ estado: 'en_proceso', actualizadoEn: iso(2000) }), baseActualizadoEn: iso(-86_400_000) })
    const r = aplicarOperacion([enServidor], aplicable(local), new Set())
    expect(r.veredicto).toBe('conflicto')
    expect(r.gana).toBe('local')
    expect(r.servidorActualizadoEn).toBe(iso(1000))
    expect(r.lista).toHaveLength(1)
    expect(r.lista[0]).toMatchObject({ estado: 'en_proceso', actualizadoEn: iso(2000) })
  })

  test('conflicto: se conserva la versión del servidor si es más reciente', () => {
    const enServidor = necesidad({ estado: 'satisfecha', actualizadoEn: iso(3000) })
    const local = op({ datos: necesidad({ estado: 'en_proceso', actualizadoEn: iso(2000) }), baseActualizadoEn: iso(-86_400_000) })
    const r = aplicarOperacion([enServidor], aplicable(local), new Set())
    expect(r.veredicto).toBe('conflicto')
    expect(r.gana).toBe('servidor')
    expect(r.lista[0]).toMatchObject({ estado: 'satisfecha', actualizadoEn: iso(3000) })
  })

  test('sin cambios en el servidor desde la versión base no hay conflicto', () => {
    const base = iso(-86_400_000)
    const local = op({ datos: necesidad({ estado: 'en_proceso', actualizadoEn: iso(2000) }), tipo: 'actualizar', baseActualizadoEn: base })
    const r = aplicarOperacion([necesidad({ actualizadoEn: base })], aplicable(local), new Set())
    expect(r.veredicto).toBe('aplicada')
    expect(r.gana).toBeUndefined()
    expect(r.lista[0]!.estado).toBe('en_proceso')
  })
})

/* ───────────── Idempotencia ───────────── */
test.describe('Idempotencia por clave de cliente', () => {
  test('crear: reenviar la misma operación no duplica el registro', () => {
    const o = op()
    const claves = new Set<string>()
    const primera = aplicarOperacion<Visita | Necesidad>([], aplicable(o), claves)
    expect(primera.veredicto).toBe('aplicada')
    expect(primera.lista).toHaveLength(1)
    claves.add(claveDe(o))
    const segunda = aplicarOperacion(primera.lista, aplicable(o), claves)
    expect(segunda.veredicto).toBe('duplicada')
    expect(segunda.lista).toHaveLength(1)
    expect(segunda.lista).toEqual(primera.lista)
  })

  test('sin clave anotada, un registro idéntico ya presente tampoco se duplica ni cuenta como conflicto', () => {
    // Ejemplo: el servidor aplicó la operación pero el dispositivo se cerró antes de anotarlo.
    const o = op()
    const r = aplicarOperacion([o.datos], aplicable(o), new Set())
    expect(r.veredicto).toBe('duplicada')
    expect(r.gana).toBeUndefined()
    expect(r.lista).toHaveLength(1)
  })

  test('un reintento con la clave ya procesada no pisa lo que cambió después en el servidor', () => {
    const o = op({ datos: necesidad({ actualizadoEn: iso(1000) }), baseActualizadoEn: null })
    const masNueva = necesidad({ estado: 'satisfecha', actualizadoEn: iso(9000) })
    const r = aplicarOperacion([masNueva], aplicable(o), new Set([claveDe(o)]))
    expect(r.veredicto).toBe('duplicada')
    expect(r.lista[0]).toEqual(masNueva)
  })

  test('el resultado de un conflicto es definitivo: al reintentar no se vuelve a evaluar', () => {
    const o = op({ datos: necesidad({ estado: 'en_proceso', actualizadoEn: iso(2000) }), baseActualizadoEn: iso(-86_400_000) })
    const servidor0 = [necesidad({ estado: 'satisfecha', actualizadoEn: iso(3000) })]
    const claves = new Set<string>()
    const r1 = aplicarOperacion(servidor0, aplicable(o), claves)
    expect(r1.gana).toBe('servidor')
    claves.add(claveDe(o))
    const r2 = aplicarOperacion(r1.lista, aplicable(o), claves)
    expect(r2.veredicto).toBe('duplicada')
    expect(r2.lista).toEqual(r1.lista)
  })

  test('no modifica la lista recibida', () => {
    const original = [necesidad({ actualizadoEn: iso(0) })]
    const copia = structuredClone(original)
    aplicarOperacion(original, aplicable(op({ datos: necesidad({ id: 'n-2', actualizadoEn: iso(5) }) })), new Set())
    expect(original).toEqual(copia)
  })

  test('aplicarLote: reenviar el mismo lote deja los mismos registros y no repite la auditoría', () => {
    const lote = [op(), op(), op({ datos: necesidad({ id: 'n-x', actualizadoEn: iso(7) }) })]
    const db = servidor()
    const a = aplicarLote(db, lote, { usuario, validar: SIEMPRE_VALIDA })
    expect(a.sincronizados).toBe(3)
    expect(a.duplicados).toBe(0)
    expect(db.visitas).toHaveLength(2)
    expect(db.necesidades).toHaveLength(1)
    const auditoria = db.auditoria.length

    const b = aplicarLote(db, lote, { usuario, validar: SIEMPRE_VALIDA })
    expect(b.sincronizados).toBe(3) // el servidor ya las tiene: se confirman para que salgan de la cola
    expect(b.duplicados).toBe(3)
    expect(b.confirmados).toEqual(a.confirmados)
    expect(db.visitas).toHaveLength(2)
    expect(db.necesidades).toHaveLength(1)
    expect(db.auditoria).toHaveLength(auditoria)
  })

  test('aplicarLote anota las claves procesadas y recuerda solo las últimas MAX_CLAVES_APLICADAS', () => {
    const db = servidor()
    aplicarLote(db, [op(), op()], { usuario, validar: SIEMPRE_VALIDA, ahora: iso(0) })
    const tabla = (db as unknown as { syncClaves: Array<{ clave: string; registroId: string; en: string }> }).syncClaves
    expect(tabla).toHaveLength(2)
    expect(tabla[0]).toMatchObject({ en: iso(0) })
    ;(db as unknown as { syncClaves: unknown[] }).syncClaves = Array.from({ length: MAX_CLAVES_APLICADAS }, (_, i) => ({ clave: `vieja-${i}`, registroId: 'x', en: iso(0) }))
    aplicarLote(db, [op()], { usuario, validar: SIEMPRE_VALIDA })
    const recortada = (db as unknown as { syncClaves: Array<{ clave: string }> }).syncClaves
    expect(recortada).toHaveLength(MAX_CLAVES_APLICADAS)
    expect(recortada[0]!.clave).toBe('vieja-1') // la más antigua salió
    expect(recortada.at(-1)!.clave).toMatch(/^clave-/)
  })

  test('yaAplicadas detecta lo que el servidor ya procesó (se limpia del dispositivo)', () => {
    const a = op()
    const b = op()
    const legado = { ...op(), claveCliente: undefined } // fila heredada: su clave es su id
    expect(yaAplicadas([a, b, legado], new Set([claveDe(a), legado.id])).map((x) => x.id)).toEqual([a.id, legado.id])
  })
})

/* ───────────── Orden de envío ───────────── */
test.describe('Orden de envío', () => {
  test('se envía en orden de captura (creadaEn)', () => {
    const tarde = op({ creadaEn: iso(3000) })
    const temprano = op({ creadaEn: iso(1000) })
    const medio = op({ creadaEn: iso(2000) })
    expect(ordenarCola([tarde, temprano, medio]).map((x) => x.id)).toEqual([temprano.id, medio.id, tarde.id])
  })

  test('con la misma marca de tiempo desempata el número de captura y, si falta, el id', () => {
    const a = op({ creadaEn: iso(1000), orden: 10 })
    const b = op({ creadaEn: iso(1000), orden: 11 })
    expect(compararOperaciones(a, b)).toBeLessThan(0)
    expect(compararOperaciones(b, a)).toBeGreaterThan(0)
    const x = { ...op({ creadaEn: iso(1000) }), id: 'op-a', orden: undefined }
    const y = { ...op({ creadaEn: iso(1000) }), id: 'op-b', orden: undefined }
    expect(ordenarCola([y, x]).map((o) => o.id)).toEqual(['op-a', 'op-b'])
    expect(compararOperaciones(x, x)).toBe(0)
  })

  test('ordenarCola no modifica la cola original', () => {
    const cola = [op({ creadaEn: iso(2000) }), op({ creadaEn: iso(1000) })]
    const ids = cola.map((o) => o.id)
    ordenarCola(cola)
    expect(cola.map((o) => o.id)).toEqual(ids)
  })

  test('aplicarLote procesa en orden de captura aunque lleguen desordenadas', () => {
    const db = servidor()
    const segunda = op({ creadaEn: iso(2000), datos: visita({ id: 'v-segunda', actualizadoEn: iso(2000) }) })
    const primera = op({ creadaEn: iso(1000), datos: visita({ id: 'v-primera', actualizadoEn: iso(1000) }) })
    const r = aplicarLote(db, [segunda, primera], { usuario, validar: SIEMPRE_VALIDA })
    expect(r.confirmados).toEqual([primera.id, segunda.id])
    expect(db.visitas.map((v) => v.id)).toEqual(['v-primera', 'v-segunda'])
  })

  test('dos ediciones del mismo registro en un lote: gana la más reciente (LWW)', () => {
    const base = visita({ id: 'v-dup', actualizadoEn: iso(0) })
    const db = servidor({ visitas: [base] })
    const vieja = op({ datos: visita({ id: 'v-dup', observaciones: 'primera', actualizadoEn: iso(1000) }), tipo: 'actualizar', baseActualizadoEn: iso(0), creadaEn: iso(1000) })
    const nueva = op({ datos: visita({ id: 'v-dup', observaciones: 'segunda', actualizadoEn: iso(2000) }), tipo: 'actualizar', baseActualizadoEn: iso(0), creadaEn: iso(2000) })
    aplicarLote(db, [nueva, vieja], { usuario, validar: SIEMPRE_VALIDA })
    expect(db.visitas).toHaveLength(1)
    expect(db.visitas[0]!.observaciones).toBe('segunda')
  })
})

/* ───────────── Lotes y errores ───────────── */
test.describe('Lotes y errores', () => {
  test('dividirEnLotes reparte la cola en lotes del tamaño pedido', () => {
    expect(dividirEnLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(dividirEnLotes([], 25)).toEqual([])
    expect(dividirEnLotes([1, 2, 3], 0)).toEqual([[1], [2], [3]])
    expect(dividirEnLotes(Array.from({ length: 60 }, (_, i) => i)).map((l) => l.length)).toEqual([25, 25, 10])
  })

  test('una operación rechazada no detiene a las demás y queda como fallida', () => {
    const db = servidor()
    const buena = op()
    const mala = op()
    const otra = op()
    const r = aplicarLote(db, [buena, mala, otra], { usuario, validar: (_d, o) => (o.id === mala.id ? 'El perfil del adulto mayor ya no existe.' : null) })
    expect(r.confirmados).toEqual([buena.id, otra.id])
    expect(r.fallidos.get(mala.id)).toBe('El perfil del adulto mayor ya no existe.')
    expect(r.errores).toEqual([{ registroId: mala.registroId, entidad: 'visita', motivo: 'El perfil del adulto mayor ya no existe.' }])
    expect(r.sincronizados).toBe(2)
    expect(db.visitas.map((v) => v.id)).toEqual([buena.registroId, otra.registroId])
    expect(db.auditoria.some((a) => a.accion === 'sync.error' && a.registroId === mala.registroId)).toBe(true)
  })

  test('si el servidor no responde, ninguna operación se aplica ni se anota', () => {
    const db = servidor()
    const r = aplicarLote(db, [op(), op()], { usuario, fallo: 'El servidor no respondió.' })
    expect(r.confirmados).toEqual([])
    expect(r.fallidos.size).toBe(2)
    expect(db.visitas).toEqual([])
    // Reintentar después sigue siendo posible (la clave no se anotó)
    const lote = [op()]
    aplicarLote(db, lote, { usuario, fallo: 'El servidor no respondió.' })
    expect(aplicarLote(db, lote, { usuario, validar: SIEMPRE_VALIDA }).duplicados).toBe(0)
    expect(db.visitas).toHaveLength(1)
  })

  test('el conflicto se audita con las dos marcas UTC y se cuenta como sincronizado', () => {
    const db = servidor({ necesidades: [necesidad({ estado: 'satisfecha', actualizadoEn: iso(3000) })] })
    const local = op({ datos: necesidad({ estado: 'en_proceso', actualizadoEn: iso(2000) }), tipo: 'actualizar', baseActualizadoEn: iso(-86_400_000) })
    const r = aplicarLote(db, [local], { usuario, validar: SIEMPRE_VALIDA })
    expect(r.conflictos).toEqual([{ registroId: 'n-1', entidad: 'necesidad', gana: 'servidor' }])
    expect(r.sincronizados).toBe(1)
    const a = db.auditoria.find((x) => x.accion === 'sync.conflicto')
    expect(a?.detalle).toContain(`local ${iso(2000)} · servidor ${iso(3000)}`)
    expect(a?.detalle).toContain('se conservó la versión del servidor')
    expect(db.necesidades[0]!.estado).toBe('satisfecha')
  })
})

/* ───────────── Reintentos con espera exponencial ───────────── */
test.describe('Reintentos con espera exponencial', () => {
  test('la espera se duplica en cada fallo y tiene tope', () => {
    expect(esperaReintento(1)).toBe(ESPERA_BASE_MS)
    expect(esperaReintento(2)).toBe(ESPERA_BASE_MS * 2)
    expect(esperaReintento(3)).toBe(ESPERA_BASE_MS * 4)
    expect(esperaReintento(4)).toBe(ESPERA_BASE_MS * 8)
    expect(esperaReintento(40)).toBe(ESPERA_MAX_MS)
    for (let n = 1; n < 12; n++) expect(esperaReintento(n + 1)).toBeGreaterThanOrEqual(esperaReintento(n))
  })

  test('la variación aleatoria suma como máximo un 20 % y nunca pasa el tope', () => {
    expect(esperaReintento(1, 0.5)).toBe(Math.round(ESPERA_BASE_MS * 1.1))
    expect(esperaReintento(1, 5)).toBeLessThanOrEqual(Math.round(ESPERA_BASE_MS * 1.2))
    expect(esperaReintento(40, 0.9)).toBe(ESPERA_MAX_MS)
  })

  test('registrarFallo suma un intento, guarda el motivo y programa el próximo reintento', () => {
    const o = registrarFallo(op(), 'Sin respuesta', T0)
    expect(o.intentos).toBe(1)
    expect(o.ultimoError).toBe('Sin respuesta')
    expect(o.proximoIntentoEn).toBe(new Date(T0 + ESPERA_BASE_MS).toISOString())
    const o2 = registrarFallo(o, 'Sin respuesta', T0 + 20_000)
    expect(o2.intentos).toBe(2)
    expect(o2.proximoIntentoEn).toBe(new Date(T0 + 20_000 + ESPERA_BASE_MS * 2).toISOString())
  })

  test(`tras ${MAX_INTENTOS} fallos la operación queda detenida y ya no tiene próximo reintento`, () => {
    let o = op()
    for (let i = 0; i < MAX_INTENTOS; i++) o = registrarFallo(o, 'Sin respuesta', T0)
    expect(o.intentos).toBe(MAX_INTENTOS)
    expect(o.proximoIntentoEn).toBeUndefined()
    expect(seleccionarParaEnvio([o], T0 + 24 * 3_600_000)).toEqual([])
    expect(seleccionarParaEnvio([o], T0, { incluirDetenidas: true })).toEqual([o])
  })

  test('seleccionarParaEnvio respeta la espera de cada operación y ordena', () => {
    const lista = op({ creadaEn: iso(3000) })
    const esperando = registrarFallo(op({ creadaEn: iso(1000) }), 'x', T0)
    const sinEspera = op({ creadaEn: iso(2000) })
    const ahora = T0 + 1000
    expect(seleccionarParaEnvio([lista, esperando, sinEspera], ahora).map((o) => o.id)).toEqual([sinEspera.id, lista.id])
    expect(seleccionarParaEnvio([lista, esperando, sinEspera], T0 + ESPERA_BASE_MS).map((o) => o.id)).toEqual([esperando.id, sinEspera.id, lista.id])
    // Al recuperar la conexión se ignoran las esperas
    expect(seleccionarParaEnvio([lista, esperando, sinEspera], ahora, { sinEspera: true }).map((o) => o.id)).toEqual([esperando.id, sinEspera.id, lista.id])
  })

  test('proximoReintentoMs devuelve la espera más corta pendiente', () => {
    const a = registrarFallo(op(), 'x', T0) // +15 s
    const b = registrarFallo(registrarFallo(op(), 'x', T0), 'x', T0) // +30 s
    expect(proximoReintentoMs([b, a], T0)).toBe(ESPERA_BASE_MS)
    expect(proximoReintentoMs([b, a], T0 + ESPERA_BASE_MS + 1)).toBe(ESPERA_BASE_MS * 2 - ESPERA_BASE_MS - 1)
    expect(proximoReintentoMs([op()], T0)).toBeNull()
    expect(proximoReintentoMs([a], T0 + 10 * ESPERA_BASE_MS)).toBeNull()
  })
})

/* ───────────── Datos mínimos de la cola (RS-018) ───────────── */
test.describe('Datos mínimos y sin credenciales', () => {
  test('reconoce claves de credenciales y de sesión', () => {
    for (const k of ['password', 'passwordHash', 'contraseña', 'token', 'access_token', 'refreshToken', 'secret', 'apiKey', 'api_key', 'jwt', 'sesion', 'session', 'cookie', 'authorization', 'credenciales'])
      expect(esClaveSensible(k), k).toBe(true)
    for (const k of ['observaciones', 'adultoId', 'checklist', 'descripcion', 'historial', 'estado', 'actualizadoEn'])
      expect(esClaveSensible(k), k).toBe(false)
  })

  test('minimizarDatos elimina claves sensibles (en cualquier nivel) y las marcas de la vista', () => {
    const sucio = { ...visita({ observaciones: 'Todo bien' }), pendienteSync: true, token: 'abc', detallesAdicionales: [{ adultoId: 'a-2', observacion: 'ok', estadoAdulto: 'estable', passwordHash: 'x' }], extra: { sesion: { id: 1 }, nota: 'n' } }
    const limpio = minimizarDatos(sucio) as unknown as Record<string, unknown>
    expect(limpio).not.toHaveProperty('pendienteSync')
    expect(limpio).not.toHaveProperty('token')
    expect(JSON.stringify(limpio)).not.toMatch(/passwordHash|sesion|"token"/)
    expect(limpio.observaciones).toBe('Todo bien')
    expect(limpio.detallesAdicionales).toEqual([{ adultoId: 'a-2', observacion: 'ok', estadoAdulto: 'estable' }]) // el estado de cada adulto viaja en la cola
    expect(limpio.extra).toEqual({ nota: 'n' })
    expect(sucio.token).toBe('abc') // no modifica el original
  })

  test('normalizarOperacion completa una fila heredada con clave de cliente y la depura', () => {
    const heredada = {
      id: 'op-viejo', usuarioId: 'u-1', entidad: 'necesidad', tipo: 'crear', registroId: 'n-9',
      datos: { ...necesidad({ id: 'n-9' }), pendienteSync: true, accessToken: 'zzz' },
      baseActualizadoEn: null, actualizadoEn: iso(0), creadaEn: iso(0), intentos: 2, sesion: { token: 'abc' }, passwordHash: 'h',
    }
    const n = normalizarOperacion(heredada)!
    expect(n.claveCliente).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(n.intentos).toBe(2)
    expect(JSON.stringify(n)).not.toMatch(/accessToken|passwordHash|sesion|pendienteSync/)
    expect(Object.keys(n).sort()).toEqual(
      ['actualizadoEn', 'baseActualizadoEn', 'claveCliente', 'creadaEn', 'datos', 'entidad', 'id', 'intentos', 'orden', 'proximoIntentoEn', 'registroId', 'tipo', 'ultimoError', 'usuarioId'],
    )
  })

  test('normalizarOperacion es idempotente y descarta filas inválidas', () => {
    const n1 = normalizarOperacion({ id: 'op-1', usuarioId: 'u-1', entidad: 'visita', tipo: 'actualizar', registroId: 'v-1', datos: visita(), baseActualizadoEn: iso(0), actualizadoEn: iso(5), creadaEn: iso(1), intentos: 0 })!
    expect(normalizarOperacion(n1)).toEqual(n1)
    for (const mala of [null, undefined, 5, 'x', {}, { id: 'a' }, { id: 'a', usuarioId: 'u', registroId: 'r', entidad: 'otra', datos: {} }, { id: 'a', usuarioId: 'u', registroId: 'r', entidad: 'visita', datos: null }])
      expect(normalizarOperacion(mala)).toBeNull()
  })

  test('nuevoUUID genera UUID v4 distintos', () => {
    const ids = new Set(Array.from({ length: 50 }, nuevoUUID))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
