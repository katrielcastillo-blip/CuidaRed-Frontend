/*
 * cola-visitas.ts — Capturas de visitas autorizadas durante la sesión de la pestaña.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../client'

interface Operacion {
  id_cliente: string
  entidad: 'visita'
  tipo: 'iniciar' | 'registrar'
  registro_id: string
  datos: object
  actualizado_en: string
  base_actualizado_en: string
}

type Captura = { cuentaId: string; operacion: Operacion; rechazada?: true }
type Resultado = { id_cliente: string; resultado: 'aplicada' | 'conflicto' | 'duplicada' | 'rechazada'; gana?: 'local' | 'servidor' }

export function useColaVisitas(usuarioId: string | undefined, token: string | undefined) {
  const estado = useRef<{ usuarioId?: string; capturas: Captura[]; enviando: boolean }>({ capturas: [], enviando: false })
  const [vista, setVista] = useState<{ usuarioId?: string; capturas: Captura[]; mensaje?: string; revision: number }>({ capturas: [], revision: 0 })
  const publicar = useCallback((actual: typeof estado.current, mensaje?: string) => {
    if (actual !== estado.current) return
    setVista((anterior) => ({ usuarioId: actual.usuarioId, capturas: [...actual.capturas], mensaje, revision: anterior.revision + 1 }))
  }, [])
  useEffect(() => {
    if (estado.current.usuarioId !== usuarioId) estado.current = { usuarioId, capturas: [], enviando: false }
  }, [usuarioId])

  const enviar = useCallback(async () => {
    const actual = estado.current
    if (!token || !usuarioId || actual.usuarioId !== usuarioId || actual.enviando || !navigator.onLine) return
    const primera = actual.capturas.find((c) => !c.rechazada)
    if (!primera) return
    actual.enviando = true
    let mensaje = ''
    try {
      for (const cuentaId of new Set(actual.capturas.filter((c) => !c.rechazada).map((c) => c.cuentaId))) {
        if (actual !== estado.current) return
        const lote = actual.capturas.filter((c) => c.cuentaId === cuentaId && !c.rechazada).slice(0, 25)
        try {
          const { resultados } = await api<{ resultados: Resultado[] }>(
            `/cuentas/${encodeURIComponent(cuentaId)}/sync`, token, 'POST',
            { operaciones: lote.map((c) => c.operacion) },
          )
          const porId = new Map(resultados.map((r) => [r.id_cliente, r]))
          if (porId.size !== lote.length || lote.some((c) => !porId.has(c.operacion.id_cliente))) throw new Error('Confirmación incompleta')
          actual.capturas = actual.capturas.flatMap((c) => {
            const resultado = porId.get(c.operacion.id_cliente)
            if (!resultado) return [c]
            if (resultado.resultado === 'rechazada') return [{ ...c, rechazada: true }]
            if (resultado.resultado === 'conflicto' && resultado.gana === 'servidor') mensaje = 'El servidor conservó su versión de una visita.'
            return []
          })
        } catch {
          mensaje ||= 'Quedan visitas pendientes. Revisa el acceso a la cuenta o la conexión.'
        }
      }
      publicar(actual, mensaje || (actual.capturas.length ? 'Quedan capturas por revisar.' : 'Visitas sincronizadas.'))
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

  const agregar = (cuentaId: string, visitaId: string, version: string, tipo: Operacion['tipo'], datos: object) => {
    const actual = estado.current
    if (!usuarioId || actual.usuarioId !== usuarioId) throw new Error('Vuelve a iniciar sesión.')
    if (actual.capturas.some((c) => c.cuentaId === cuentaId && c.operacion.registro_id === visitaId && c.operacion.tipo === tipo)) {
      throw new Error('Esta acción ya está en la cola de la visita.')
    }
    actual.capturas.push({ cuentaId, operacion: {
      id_cliente: crypto.randomUUID(), entidad: 'visita', tipo, registro_id: visitaId, datos,
      actualizado_en: new Date().toISOString(), base_actualizado_en: new Date(version).toISOString(),
    } })
    publicar(actual, 'Captura pendiente de sincronización en esta pestaña.')
    void enviar()
  }

  const reintentar = () => {
    if (estado.current.enviando) return
    estado.current.capturas = estado.current.capturas.map((c) => ({ cuentaId: c.cuentaId, operacion: c.operacion }))
    void enviar()
  }
  const quitarRechazadas = (cuentaId: string) => {
    if (estado.current.enviando) return
    estado.current.capturas = estado.current.capturas.filter((c) => c.cuentaId !== cuentaId || !c.rechazada)
    publicar(estado.current)
  }
  return { agregar, reintentar, quitarRechazadas, ...(vista.usuarioId === usuarioId ? vista : { capturas: [], revision: 0, mensaje: undefined }) }
}

export type ColaVisitas = ReturnType<typeof useColaVisitas>
