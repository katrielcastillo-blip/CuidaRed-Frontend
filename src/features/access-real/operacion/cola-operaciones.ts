/*
 * cola-operaciones.ts — Capturas autorizadas durante la sesión de la pestaña.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../client'

type Entrada = { registro_id: string; datos: object } & (
  | { entidad: 'visita'; tipo: 'iniciar' | 'registrar'; base_actualizado_en: string }
  | { entidad: 'necesidad'; tipo: 'registrar'; base_actualizado_en?: never }
  | { entidad: 'necesidad'; tipo: 'cambiar_estado'; base_actualizado_en: string }
)
type Operacion = Entrada & { id_cliente: string; actualizado_en: string }
type Entidad = Entrada['entidad']

type Captura = { cuentaId: string; operacion: Operacion; rechazada?: true }
type Resultado = {
  id_cliente: string
  resultado: 'aplicada' | 'conflicto' | 'duplicada' | 'rechazada'
  resultado_original?: string
  gana?: 'local' | 'servidor'
  motivo?: string | null
}
const RESULTADOS = new Set(['aplicada', 'conflicto', 'duplicada', 'rechazada'])

const claveAviso = (cuentaId: string, entidad: Entidad) => `${cuentaId}/${entidad}`

export function useColaOperaciones(usuarioId: string | undefined, token: string | undefined) {
  const estado = useRef<{ usuarioId?: string; capturas: Captura[]; enviando: boolean }>({ capturas: [], enviando: false })
  const [vista, setVista] = useState<{ usuarioId?: string; capturas: Captura[]; avisos: Record<string, string>; revision: number }>({ capturas: [], avisos: {}, revision: 0 })
  const publicar = useCallback((actual: typeof estado.current, avisos: Record<string, string> = {}) => {
    if (actual !== estado.current) return
    setVista((anterior) => ({
      usuarioId: actual.usuarioId, capturas: [...actual.capturas], revision: anterior.revision + 1,
      avisos: { ...(anterior.usuarioId === actual.usuarioId ? anterior.avisos : {}), ...avisos },
    }))
  }, [])
  useEffect(() => {
    if (estado.current.usuarioId !== usuarioId) estado.current = { usuarioId, capturas: [], enviando: false }
  }, [usuarioId])

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
          actual.capturas = actual.capturas.flatMap((c) => {
            const resultado = porId.get(c.operacion.id_cliente)
            if (!resultado) return [c]
            const { entidad } = c.operacion
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
        } catch {
          for (const entidad of new Set(lote.map((c) => c.operacion.entidad))) {
            avisar(cuentaId, entidad, 'Quedan capturas pendientes. Revisa el acceso a la cuenta o la conexión.')
          }
        }
      }
      publicar(actual, Object.fromEntries([...mensajes].map(([clave, avisos]) => [
        clave, [...avisos].join(' ') || 'Capturas sincronizadas.',
      ])))
    } finally {
      actual.enviando = false
    }
  }, [token, usuarioId, publicar])

  useEffect(() => {
    const reanudar = () => { void enviar() }
    window.addEventListener('online', reanudar)
    const timer = window.setInterval(reanudar, 30_000)
    reanudar()
    return () => { window.clearInterval(timer); window.removeEventListener('online', reanudar) }
  }, [enviar])

  const agregar = (cuentaId: string, entrada: Entrada) => {
    const actual = estado.current
    if (!usuarioId || actual.usuarioId !== usuarioId) throw new Error('Vuelve a iniciar sesión.')
    if (actual.capturas.some((c) => c.cuentaId === cuentaId && c.operacion.entidad === entrada.entidad
      && c.operacion.registro_id === entrada.registro_id && c.operacion.tipo === entrada.tipo)) {
      throw new Error('Esta acción ya está pendiente de sincronización.')
    }
    actual.capturas.push({ cuentaId, operacion: {
      ...entrada, id_cliente: crypto.randomUUID(), actualizado_en: new Date().toISOString(),
    } })
    publicar(actual, { [claveAviso(cuentaId, entrada.entidad)]: 'Captura pendiente de sincronización en esta pestaña.' })
    void enviar()
  }

  const reintentar = (cuentaId: string, entidad: Entidad) => {
    if (estado.current.enviando) return
    estado.current.capturas = estado.current.capturas.map((c) => c.cuentaId === cuentaId && c.operacion.entidad === entidad
      ? { cuentaId, operacion: c.operacion }
      : c)
    void enviar(cuentaId, entidad)
  }
  const quitarRechazadas = (cuentaId: string, entidad: Entidad) => {
    if (estado.current.enviando) return
    estado.current.capturas = estado.current.capturas.filter((c) => c.cuentaId !== cuentaId || c.operacion.entidad !== entidad || !c.rechazada)
    publicar(estado.current, { [claveAviso(cuentaId, entidad)]: 'Se descartaron las capturas rechazadas.' })
  }
  const propia = vista.usuarioId === usuarioId
  const mensaje = (cuentaId: string, entidad: Entidad) => propia ? vista.avisos[claveAviso(cuentaId, entidad)] : undefined
  return { agregar, reintentar, quitarRechazadas, mensaje, capturas: propia ? vista.capturas : [], revision: propia ? vista.revision : 0 }
}

export type ColaOperaciones = ReturnType<typeof useColaOperaciones>
