/*
 * cola-visitas.ts — Capturas locales y sincronización de visitas autorizadas.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../client'
import { eliminarCaptura, guardarCaptura, leerCapturas, type CapturaVisita, type OperacionVisita } from './capturas-visita-db'

type Captura = CapturaVisita
type Resultado = { id_cliente: string; resultado: 'aplicada' | 'conflicto' | 'duplicada' | 'rechazada'; gana?: 'local' | 'servidor'; motivo?: string }

export function useColaVisitas(usuarioId: string | undefined, token: string | undefined) {
  const estado = useRef<{ usuarioId?: string; capturas: Captura[]; enviando: boolean; cargada: boolean }>({ capturas: [], enviando: false, cargada: false })
  const [vista, setVista] = useState<{ usuarioId?: string; capturas: Captura[]; mensaje?: string; revision: number }>({ capturas: [], revision: 0 })
  const publicar = useCallback((actual: typeof estado.current, mensaje?: string) => {
    if (actual !== estado.current) return
    setVista((anterior) => ({ usuarioId: actual.usuarioId, capturas: [...actual.capturas], mensaje, revision: anterior.revision + 1 }))
  }, [])
  const enviar = useCallback(async () => {
    const actual = estado.current
    if (!token || !usuarioId || actual.usuarioId !== usuarioId || actual.enviando || !actual.cargada || !navigator.onLine) return
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
          await Promise.all(lote.map((c) => {
            const resultado = porId.get(c.operacion.id_cliente)
            if (resultado?.motivo === 'VISIT_EVIDENCE_PENDING') return
            return resultado?.resultado === 'rechazada'
              ? guardarCaptura(usuarioId, { ...c, rechazada: true })
              : eliminarCaptura(usuarioId, c.operacion.id_cliente)
          }))
          actual.capturas = actual.capturas.flatMap((c) => {
            const resultado = porId.get(c.operacion.id_cliente)
            if (!resultado) return [c]
            if (resultado.motivo === 'VISIT_EVIDENCE_PENDING') {
              mensaje = 'Una captura espera la revisión de sus evidencias. Se enviará después de la validación.'
              return [c]
            }
            if (resultado.resultado === 'rechazada') return [{ ...c, rechazada: true }]
            if (resultado.resultado === 'conflicto' && resultado.gana === 'servidor') mensaje = 'El servidor conservó su versión de una visita.'
            return []
          })
        } catch (error) {
          if (error instanceof ApiError && error.code === 'ACCOUNT_DISABLED') {
            const ids = new Set(lote.map((captura) => captura.operacion.id_cliente))
            await Promise.all(lote.map((c) => guardarCaptura(usuarioId, { ...c, rechazada: true })))
            actual.capturas = actual.capturas.map((captura) => ids.has(captura.operacion.id_cliente)
              ? { ...captura, rechazada: true } : captura)
            mensaje = 'La cuenta está deshabilitada. Las visitas pendientes fueron rechazadas al sincronizar.'
          } else {
            mensaje ||= 'Quedan visitas pendientes. Revisa el acceso a la cuenta o la conexión.'
          }
        }
      }
      publicar(actual, mensaje || (actual.capturas.length ? 'Quedan capturas por revisar.' : 'Visitas sincronizadas.'))
    } catch {
      publicar(actual, 'No pudimos actualizar las capturas de este dispositivo. Se reintentará la sincronización.')
    } finally {
      actual.enviando = false
    }
  }, [token, usuarioId, publicar])

  useEffect(() => {
    if (estado.current.usuarioId === usuarioId) return
    const actual = { usuarioId, capturas: [] as Captura[], enviando: false, cargada: false }
    estado.current = actual
    if (!usuarioId) return
    void leerCapturas(usuarioId).then((capturas) => {
      actual.capturas = capturas.sort((a, b) => a.operacion.actualizado_en.localeCompare(b.operacion.actualizado_en)
        || a.operacion.tipo.localeCompare(b.operacion.tipo))
      actual.cargada = true
      publicar(actual)
      void enviar()
    }).catch(() => publicar(actual, 'No pudimos abrir el almacenamiento de visitas de este dispositivo.'))
  }, [usuarioId, publicar, enviar])

  useEffect(() => {
    const reanudar = () => { void enviar() }
    window.addEventListener('online', reanudar)
    const timer = window.setInterval(reanudar, 30_000)
    reanudar()
    return () => { window.clearInterval(timer); window.removeEventListener('online', reanudar) }
  }, [enviar])

  const agregar = async (cuentaId: string, visitaId: string, version: string, tipo: OperacionVisita['tipo'], datos: object) => {
    const actual = estado.current
    if (!usuarioId || actual.usuarioId !== usuarioId) throw new Error('Vuelve a iniciar sesión.')
    if (!actual.cargada) throw new Error('El almacenamiento de visitas todavía no está disponible.')
    if (actual.capturas.some((c) => c.cuentaId === cuentaId && c.operacion.registro_id === visitaId && c.operacion.tipo === tipo)) {
      throw new Error('Esta acción ya está en la cola de la visita.')
    }
    const captura: Captura = { cuentaId, operacion: {
      id_cliente: crypto.randomUUID(), entidad: 'visita', tipo, registro_id: visitaId, datos,
      actualizado_en: new Date().toISOString(), base_actualizado_en: new Date(version).toISOString(),
    } }
    try { await guardarCaptura(usuarioId, captura) } catch {
      throw new Error('No pudimos guardar en este dispositivo. Conserva el formulario abierto y vuelve a intentar.')
    }
    actual.capturas.push(captura)
    publicar(actual, 'Captura guardada en este dispositivo y pendiente de sincronización.')
    void enviar()
  }

  const reintentar = () => {
    void enviar()
  }
  const quitarRechazadas = async (cuentaId: string) => {
    const actual = estado.current
    if (actual.enviando || !usuarioId || actual.usuarioId !== usuarioId) return
    try {
      await Promise.all(actual.capturas.filter((c) => c.cuentaId === cuentaId && c.rechazada)
        .map((c) => eliminarCaptura(usuarioId, c.operacion.id_cliente)))
      actual.capturas = actual.capturas.filter((c) => c.cuentaId !== cuentaId || !c.rechazada)
      publicar(actual)
    } catch { publicar(actual, 'No pudimos descartar las capturas. Vuelve a intentar.') }
  }
  return { agregar, reintentar, quitarRechazadas, ...(vista.usuarioId === usuarioId ? vista : { capturas: [], revision: 0, mensaje: undefined }) }
}

export type ColaVisitas = ReturnType<typeof useColaVisitas>
