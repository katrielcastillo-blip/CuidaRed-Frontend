/*
 * cola-operaciones.ts — Sincronización de visitas persistentes y necesidades de la pestaña.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../client'
import { eliminarCaptura, guardarCaptura, leerCapturas } from './capturas-visita-db'

type Entrada = { registro_id: string; datos: object } & (
  | { entidad: 'visita'; tipo: 'iniciar' | 'registrar'; base_actualizado_en: string }
  | { entidad: 'necesidad'; tipo: 'registrar'; base_actualizado_en?: never }
  | { entidad: 'necesidad'; tipo: 'cambiar_estado'; base_actualizado_en: string }
)
type Operacion = Entrada & { id_cliente: string; actualizado_en: string }
type Entidad = Entrada['entidad']

type Captura = { cuentaId: string; operacion: Operacion; rechazada?: true }
type EstadoCola = { usuarioId?: string; capturas: Captura[]; enviando: boolean; cargadaVisitas: boolean; guardando: Set<string> }
type Resultado = {
  id_cliente: string
  resultado: 'aplicada' | 'conflicto' | 'duplicada' | 'rechazada'
  resultado_original?: string
  gana?: 'local' | 'servidor'
  motivo?: string | null
}
const RESULTADOS = new Set(['aplicada', 'conflicto', 'duplicada', 'rechazada'])

const claveAviso = (cuentaId: string, entidad: Entidad) => `${cuentaId}/${entidad}`
const claveOperacion = (cuentaId: string, operacion: Entrada) => `${cuentaId}/${operacion.entidad}/${operacion.registro_id}/${operacion.tipo}`

async function guardarSiEsVisita(usuarioId: string, captura: Captura) {
  const { operacion } = captura
  if (operacion.entidad === 'visita') await guardarCaptura(usuarioId, { ...captura, operacion })
}

async function eliminarSiEsVisita(usuarioId: string, captura: Captura) {
  if (captura.operacion.entidad === 'visita') await eliminarCaptura(usuarioId, captura.operacion.id_cliente)
}

export function useColaOperaciones(usuarioId: string | undefined, token: string | undefined) {
  const estado = useRef<EstadoCola>({ capturas: [], enviando: false, cargadaVisitas: false, guardando: new Set() })
  const [vista, setVista] = useState<{ usuarioId?: string; capturas: Captura[]; avisos: Record<string, string>; revision: number }>({ capturas: [], avisos: {}, revision: 0 })
  const publicar = useCallback((actual: typeof estado.current, avisos: Record<string, string> = {}) => {
    if (actual !== estado.current) return
    setVista((anterior) => ({
      usuarioId: actual.usuarioId, capturas: [...actual.capturas], revision: anterior.revision + 1,
      avisos: { ...(anterior.usuarioId === actual.usuarioId ? anterior.avisos : {}), ...avisos },
    }))
  }, [])
  const enviar = useCallback(async (soloCuenta?: string, soloEntidad?: Entidad) => {
    const actual = estado.current
    if (!token || !usuarioId || actual.usuarioId !== usuarioId || actual.enviando || !navigator.onLine) return
    const disponibles = actual.capturas.filter((c) => !c.rechazada && (!soloCuenta || c.cuentaId === soloCuenta)
      && (!soloEntidad || c.operacion.entidad === soloEntidad))
    if (!disponibles.length) return
    actual.enviando = true
    const mensajes = new Map<string, Set<string>>()
    const avisar = (cuentaId: string, entidad: Entidad, mensaje: string) => {
      const clave = claveAviso(cuentaId, entidad)
      const previos = mensajes.get(clave) ?? new Set<string>()
      previos.add(mensaje)
      mensajes.set(clave, previos)
    }
    try {
      for (const cuentaId of new Set(disponibles.map((c) => c.cuentaId))) {
        if (actual !== estado.current) return
        const lote = disponibles.filter((c) => c.cuentaId === cuentaId).slice(0, 25)
        try {
          const { resultados } = await api<{ resultados: Resultado[] }>(
            `/cuentas/${encodeURIComponent(cuentaId)}/sync`, token, 'POST',
            { operaciones: lote.map((c) => c.operacion) },
          )
          if (!Array.isArray(resultados) || resultados.some((r) => !r || !RESULTADOS.has(r.resultado))) {
            throw new Error('Confirmación inválida')
          }
          const porId = new Map(resultados.map((r) => [r.id_cliente, r]))
          if (resultados.length !== lote.length || porId.size !== lote.length || lote.some((c) => !porId.has(c.operacion.id_cliente))) {
            throw new Error('Confirmación incompleta')
          }
          await Promise.all(lote.map((c) => {
            const r = porId.get(c.operacion.id_cliente)
            if (r?.motivo === 'VISIT_EVIDENCE_PENDING' && c.operacion.entidad === 'visita') return
            return r?.resultado === 'rechazada'
              ? guardarSiEsVisita(usuarioId, { ...c, rechazada: true })
              : eliminarSiEsVisita(usuarioId, c)
          }))
          actual.capturas = actual.capturas.flatMap((c) => {
            const resultado = porId.get(c.operacion.id_cliente)
            if (!resultado) return [c]
            const { entidad } = c.operacion
            if (entidad === 'visita' && resultado.motivo === 'VISIT_EVIDENCE_PENDING') {
              avisar(cuentaId, entidad, 'Una captura espera la revisión de sus evidencias. Se enviará después de la validación.')
              return [c]
            }
            if (resultado.resultado === 'rechazada') {
              avisar(cuentaId, entidad, 'Hay capturas rechazadas que puedes reintentar o descartar.')
              if (resultado.motivo === 'PLAN_LIMIT_REACHED') avisar(cuentaId, entidad, 'Se alcanzó el límite del plan de la cuenta.')
              return [{ ...c, rechazada: true }]
            }
            if (resultado.resultado === 'conflicto' || resultado.resultado_original === 'conflicto') {
              if (resultado.gana === 'servidor') avisar(cuentaId, entidad, `El servidor conservó su versión de una ${entidad}.`)
              if (resultado.gana === 'local') avisar(cuentaId, entidad, `Tu captura prevaleció en un conflicto de ${entidad}.`)
            }
            if (!mensajes.has(claveAviso(cuentaId, entidad))) mensajes.set(claveAviso(cuentaId, entidad), new Set())
            return []
          })
        } catch (error) {
          const deshabilitada = error instanceof ApiError && error.code === 'ACCOUNT_DISABLED'
          if (deshabilitada) {
            const ids = new Set(lote.map((c) => c.operacion.id_cliente))
            await Promise.all(lote.map((c) => guardarSiEsVisita(usuarioId, { ...c, rechazada: true })))
            actual.capturas = actual.capturas.map((c) => ids.has(c.operacion.id_cliente) ? { ...c, rechazada: true } : c)
          }
          for (const entidad of new Set(lote.map((c) => c.operacion.entidad))) {
            avisar(cuentaId, entidad, deshabilitada
              ? 'La cuenta está deshabilitada. Las capturas del lote fueron rechazadas al sincronizar.'
              : 'Quedan capturas pendientes. Revisa el acceso a la cuenta o la conexión.')
          }
        }
      }
      publicar(actual, Object.fromEntries([...mensajes].map(([clave, avisos]) => [
        clave, [...avisos].join(' ') || 'Capturas sincronizadas.',
      ])))
    } catch {
      for (const { cuentaId, operacion } of disponibles) {
        avisar(cuentaId, operacion.entidad, 'No pudimos actualizar las capturas de este dispositivo. Se reintentará la sincronización.')
      }
      publicar(actual, Object.fromEntries([...mensajes].map(([clave, avisos]) => [clave, [...avisos].join(' ')])))
    } finally {
      actual.enviando = false
    }
  }, [token, usuarioId, publicar])

  useEffect(() => {
    if (estado.current.usuarioId === usuarioId) return
    const actual: EstadoCola = { usuarioId, capturas: [], enviando: false, cargadaVisitas: false, guardando: new Set() }
    estado.current = actual
    if (!usuarioId) return

    void leerCapturas(usuarioId).then((capturas) => {
      if (estado.current !== actual) return
      actual.capturas.push(...capturas.sort((a, b) => a.operacion.actualizado_en.localeCompare(b.operacion.actualizado_en)
        || a.operacion.tipo.localeCompare(b.operacion.tipo)))
      actual.cargadaVisitas = true
      publicar(actual)
      void enviar()
    }).catch(() => publicar(actual))
  }, [usuarioId, publicar, enviar])

  useEffect(() => {
    const reanudar = () => { void enviar() }
    window.addEventListener('online', reanudar)
    const timer = window.setInterval(reanudar, 30_000)
    reanudar()
    return () => { window.clearInterval(timer); window.removeEventListener('online', reanudar) }
  }, [enviar])

  const agregar = async (cuentaId: string, entrada: Entrada) => {
    const actual = estado.current
    if (!usuarioId || actual.usuarioId !== usuarioId) throw new Error('Vuelve a iniciar sesión.')
    if (entrada.entidad === 'visita' && !actual.cargadaVisitas) throw new Error('El almacenamiento de visitas todavía no está disponible.')
    const clave = claveOperacion(cuentaId, entrada)
    if (actual.guardando.has(clave) || actual.capturas.some((c) => claveOperacion(c.cuentaId, c.operacion) === clave)) {
      throw new Error('Esta acción ya está pendiente de sincronización.')
    }
    const captura: Captura = { cuentaId, operacion: {
      ...entrada, id_cliente: crypto.randomUUID(), actualizado_en: new Date().toISOString(),
    } }
    if (entrada.entidad === 'visita') {
      actual.guardando.add(clave)
      try {
        await guardarSiEsVisita(usuarioId, captura)
      } catch {
        throw new Error('No pudimos guardar en este dispositivo. Conserva el formulario abierto y vuelve a intentar.')
      } finally {
        actual.guardando.delete(clave)
      }
    }
    actual.capturas.push(captura)
    publicar(actual, { [claveAviso(cuentaId, entrada.entidad)]: entrada.entidad === 'visita'
      ? 'Captura guardada en este dispositivo y pendiente de sincronización.'
      : 'Captura pendiente de sincronización en esta pestaña.' })
    void enviar()
  }

  const reintentar = async (cuentaId: string, entidad: Entidad) => {
    const actual = estado.current
    if (!usuarioId || actual.usuarioId !== usuarioId || actual.enviando) return
    const clave = claveAviso(cuentaId, entidad)
    const reanudadas = actual.capturas.filter((c) => c.rechazada && c.cuentaId === cuentaId && c.operacion.entidad === entidad)
    actual.enviando = true
    try {
      await Promise.all(reanudadas.map(({ operacion }) => guardarSiEsVisita(usuarioId, { cuentaId, operacion })))
      const ids = new Set(reanudadas.map((c) => c.operacion.id_cliente))
      actual.capturas = actual.capturas.map((c) => ids.has(c.operacion.id_cliente) ? { cuentaId, operacion: c.operacion } : c)
    } catch {
      publicar(actual, { [clave]: 'No pudimos actualizar las capturas. Vuelve a intentar.' })
      return
    } finally {
      actual.enviando = false
    }
    void enviar(cuentaId, entidad)
  }
  const quitarRechazadas = async (cuentaId: string, entidad: Entidad) => {
    const actual = estado.current
    if (!usuarioId || actual.usuarioId !== usuarioId || actual.enviando) return
    const clave = claveAviso(cuentaId, entidad)
    const descartadas = actual.capturas.filter((c) => c.rechazada && c.cuentaId === cuentaId && c.operacion.entidad === entidad)
    actual.enviando = true
    try {
      await Promise.all(descartadas.map((c) => eliminarSiEsVisita(usuarioId, c)))
      const ids = new Set(descartadas.map((c) => c.operacion.id_cliente))
      actual.capturas = actual.capturas.filter((c) => !ids.has(c.operacion.id_cliente))
      publicar(actual, { [clave]: 'Se descartaron las capturas rechazadas.' })
    } catch {
      publicar(actual, { [clave]: 'No pudimos descartar las capturas. Vuelve a intentar.' })
    } finally {
      actual.enviando = false
    }
  }
  const propia = vista.usuarioId === usuarioId
  const mensaje = (cuentaId: string, entidad: Entidad) => propia ? vista.avisos[claveAviso(cuentaId, entidad)] : undefined
  const sincronizar = () => enviar()
  return { agregar, reintentar, quitarRechazadas, sincronizar, mensaje, capturas: propia ? vista.capturas : [], revision: propia ? vista.revision : 0 }
}

export type ColaOperaciones = ReturnType<typeof useColaOperaciones>
