/* Preferencia de avisos Web Push de este navegador · RF-18. © 2026 Equipo CuidaRed – INTEC. */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { api } from '../client'
import { useConexionReal, useDatos } from './controles'

const rutaPush = '/notificaciones-push'

interface ConfiguracionPush {
  habilitado: boolean
  clave_publica: string | null
}

interface Dispositivo {
  registro: ServiceWorkerRegistration
  suscripcion: PushSubscription | null
  activa: boolean
}

function claveDelServidor(clave: string) {
  if (!/^[A-Za-z0-9_-]{87}$/.test(clave)) return undefined
  const bytes = Uint8Array.from(atob(clave.replace(/-/g, '+').replace(/_/g, '/') + '='), (valor) => valor.charCodeAt(0))
  return bytes.length === 65 && bytes[0] === 4 ? bytes : undefined
}

export function NotificacionesPush({ token }: { token: string }) {
  const configuracion = useDatos<ConfiguracionPush>(`${rutaPush}/configuracion`, token)
  const configurada = configuracion.datos !== undefined
  const clave = configuracion.datos?.clave_publica
  const habilitado = configuracion.datos?.habilitado === true && !!clave
  const enLinea = useConexionReal()
  const compatible = window.isSecureContext && 'serviceWorker' in navigator
    && 'PushManager' in window && 'Notification' in window
  const [dispositivo, setDispositivo] = useState<Dispositivo>()
  const [consultaFallida, setConsultaFallida] = useState(false)
  const [revision, setRevision] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ error: boolean; texto: string }>()

  useEffect(() => {
    if (!configurada || !compatible || !enLinea) return
    let vigente = true
    const consultar = async () => {
      try {
        const registro = await navigator.serviceWorker.getRegistration()
        if (!registro?.active) throw new Error('No hay un service worker activo.')
        const suscripcion = await registro.pushManager.getSubscription()
        const activa = suscripcion ? (await api<{ activa: boolean }>(`${rutaPush}/suscripciones/estado`, token,
          'POST', { endpoint: suscripcion.endpoint })).activa === true : false
        if (vigente) {
          setDispositivo({ registro, suscripcion, activa })
          setConsultaFallida(false)
        }
      } catch {
        if (vigente) {
          setDispositivo(undefined)
          setConsultaFallida(true)
        }
      }
    }
    void consultar()
    return () => { vigente = false }
  }, [configurada, habilitado, compatible, enLinea, token, revision])

  const cambiar = async () => {
    if (!dispositivo || guardando || !enLinea || (!habilitado && !dispositivo.activa)) return
    const { activa, registro, suscripcion } = dispositivo
    setGuardando(true)
    setMensaje(undefined)
    try {
      if (activa && suscripcion) {
        await api(`${rutaPush}/suscripciones/revocar`, token, 'POST', { endpoint: suscripcion.endpoint })
        // Con la revocación confirmada, este dispositivo deja de ser elegible aunque el navegador conserve el registro.
        await suscripcion.unsubscribe().catch(() => false)
        setDispositivo({ registro, suscripcion: null, activa: false })
        setMensaje({ error: false, texto: 'Notificaciones de este dispositivo desactivadas.' })
        return
      }

      const applicationServerKey = clave ? claveDelServidor(clave) : undefined
      if (!applicationServerKey) throw new Error('Clave pública de notificaciones inválida.')
      // Llamar directamente desde el botón permite al navegador solicitar el permiso tras el gesto del usuario.
      const nueva = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
      const { keys } = nueva.toJSON()
      if (!keys?.p256dh || !keys.auth) throw new Error('El navegador no devolvió las claves de suscripción.')
      await api(`${rutaPush}/suscripciones`, token, 'POST', { endpoint: nueva.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } })
      setDispositivo({ registro, suscripcion: nueva, activa: true })
      setMensaje({ error: false, texto: 'Notificaciones activadas para este dispositivo.' })
    } catch {
      setMensaje({ error: true, texto: !activa && Notification.permission === 'denied'
        ? 'El navegador bloqueó los avisos. Puedes cambiar el permiso en sus ajustes.'
        : 'No se pudo confirmar el cambio. Inténtalo de nuevo.' })
    } finally {
      setGuardando(false)
    }
  }

  if (!habilitado && !dispositivo?.activa) return null
  const bloqueadas = compatible && Notification.permission === 'denied' && !dispositivo?.activa
  return <section aria-label="Notificaciones en este dispositivo" className="grid grid-cols-1 gap-2 rounded-md border border-line bg-surface p-4">
    <h2 className="font-semibold text-ink">Avisos en este dispositivo</h2>
    <p className="text-sm text-ink-2">{!compatible
      ? 'Este navegador no permite avisos del sistema desde aquí. En iPhone o iPad, abre CuidaRed desde la pantalla de inicio.'
      : bloqueadas ? 'Los avisos están bloqueados en los ajustes de este navegador.'
        : !habilitado ? 'El envío está pausado. Puedes desactivar los avisos en este dispositivo.'
          : dispositivo?.activa ? 'Los avisos están activos para este dispositivo.'
            : 'Activa los avisos para recibirlos aunque CuidaRed esté cerrada.'}</p>
    {mensaje && <p role={mensaje.error ? 'alert' : 'status'} className="text-sm text-ink-2">{mensaje.texto}</p>}
    {compatible && !bloqueadas && (dispositivo
      ? <Button variant="outline" size="sm" className="justify-self-start" disabled={!enLinea} loading={guardando}
        onClick={() => void cambiar()}>{dispositivo.activa ? 'Desactivar notificaciones' : 'Activar notificaciones'}</Button>
      : consultaFallida && <>
        <p role="status" className="text-sm text-ink-2">No se pudo comprobar la disponibilidad de los avisos en este dispositivo.</p>
        <Button variant="outline" size="sm" className="justify-self-start" disabled={!enLinea}
          onClick={() => setRevision((n) => n + 1)}>Volver a comprobar</Button>
      </>)}
  </section>
}
