/* capturas-visita-db.ts — Persistencia de capturas offline por usuario. © 2026 Equipo CuidaRed – INTEC. */
export type OperacionVisita = {
  id_cliente: string
  entidad: 'visita'
  tipo: 'iniciar' | 'registrar'
  registro_id: string
  datos: object
  actualizado_en: string
  base_actualizado_en: string
}

export type CapturaVisita = { cuentaId: string; operacion: OperacionVisita; rechazada?: true }
type Fila = CapturaVisita & { usuarioId: string }
const almacen = 'capturas'

async function operar<T>(modo: IDBTransactionMode, solicitar: (store: IDBObjectStore) => IDBRequest<T>) {
  const base = await new Promise<IDBDatabase>((resolver, rechazar) => {
    const abrir = indexedDB.open('cuidared-capturas-visita', 1)
    abrir.onupgradeneeded = () => abrir.result.createObjectStore(almacen, { keyPath: ['usuarioId', 'operacion.id_cliente'] }).createIndex('porUsuario', 'usuarioId')
    abrir.onsuccess = () => resolver(abrir.result)
    abrir.onerror = () => rechazar(abrir.error)
  })
  try {
    return await new Promise<T>((resolver, rechazar) => {
      const transaccion = base.transaction(almacen, modo)
      transaccion.onabort = () => rechazar(transaccion.error)
      const peticion = solicitar(transaccion.objectStore(almacen))
      transaccion.oncomplete = () => resolver(peticion.result)
    })
  } finally { base.close() }
}

export const leerCapturas = (usuarioId: string) => operar<Fila[]>('readonly', (store) => store.index('porUsuario').getAll(usuarioId))
export const guardarCaptura = (usuarioId: string, captura: CapturaVisita) => operar('readwrite', (store) => store.put({ ...captura, usuarioId }))
export const eliminarCaptura = (usuarioId: string, id: string) => operar('readwrite', (store) => store.delete([usuarioId, id]))
