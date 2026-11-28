/*
 * notificaciones.tsx — Pantalla «Notificaciones» (Figma 03): avisos de alertas de la cuenta agrupados por día (Hoy, Ayer,
 * Anteriores). Tocar una tarjeta marca el aviso como leído y abre la alerta. No hay ruta para «marcar todas como leídas»
 * en el servidor, así que ese botón no existe.
 * Usa el mismo endpoint que la bandeja de avisos de Alertas: `${base}/notificaciones-alerta`.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso, Chip, Icono } from '@/components/ui'
import { diasCalendario, fechaHora, hora12 } from '@/domain/dates'
import { cn } from '@/lib/cn'
import { api, ApiError } from '../../client'
import { mensajeDeError } from '../../errores'
import { Estado, idRuta, Paginador, useConexionReal, usePagina } from '../controles'

interface Notificacion {
  notificacion_id: string
  alerta_envejeciente_id: string | null
  mensaje: string
  estado: 'no_leida' | 'leida' | 'archivada'
  fecha_notificacion: string
  fecha_lectura: string | null
}

type Grupo = 'Hoy' | 'Ayer' | 'Anteriores'
const GRUPOS: Grupo[] = ['Hoy', 'Ayer', 'Anteriores']

const grupoDe = (iso: string): Grupo => {
  const dias = diasCalendario(iso)
  return dias <= 0 ? 'Hoy' : dias === 1 ? 'Ayer' : 'Anteriores'
}

/** «Hace 10 min» · «Hace 3 horas» (hoy), «Ayer, 04:15 p.m.» o la fecha completa. */
function cuando(iso: string, grupo: Grupo) {
  if (grupo === 'Ayer') return `Ayer, ${hora12(iso)}`
  if (grupo === 'Anteriores') return fechaHora(iso)
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutos < 1) return 'Hace un momento'
  if (minutos < 60) return `Hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
}

/** El servidor manda un solo texto: la primera línea es el título y el resto, el detalle. */
function partes(mensaje: string) {
  const [titulo = '', ...resto] = mensaje.split('\n').map((linea) => linea.trim()).filter(Boolean)
  return { titulo, detalle: resto.join(' ') }
}

const esSeguimiento = (mensaje: string) => /seguimiento/i.test(mensaje)

function Tarjeta({ aviso, grupo, ocupada, abrir }: { aviso: Notificacion; grupo: Grupo; ocupada: boolean; abrir: (aviso: Notificacion) => void }) {
  const sinLeer = aviso.estado === 'no_leida'
  const { titulo, detalle } = partes(aviso.mensaje)
  const seguimiento = esSeguimiento(aviso.mensaje)
  const accionable = sinLeer || !!aviso.alerta_envejeciente_id
  const clases = cn('flex w-full min-w-0 items-start gap-3 rounded-md border p-3 text-start',
    sinLeer ? 'border-2 border-navy bg-blue-100 p-[11px]' : 'border-surface-2 bg-surface',
    accionable && 'hover:brightness-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-principal')
  const contenido = <>
    <span aria-hidden className={cn('grid size-11 flex-none place-items-center rounded-md', seguimiento ? 'bg-warning-100 text-warning-700' : 'bg-danger-100 text-danger')}>
      <Icono nombre={seguimiento ? 'schedule' : 'notifications_active'} />
    </span>
    <span className="grid min-w-0 flex-1 gap-0.5">
      <span className="flex items-center gap-2 text-cuerpo font-semibold text-ink">
        {sinLeer && <span aria-hidden className="size-2.5 flex-none rounded-full bg-danger" />}
        <span className="min-w-0 whitespace-pre-line wrap-anywhere">{titulo}</span>
      </span>
      {detalle && <span className="text-ayuda text-ink-2 wrap-anywhere">{detalle}</span>}
      <span className="text-ayuda text-muted">
        <time dateTime={aviso.fecha_notificacion}>{cuando(aviso.fecha_notificacion, grupo)}</time>
        {sinLeer && <> · <span className="font-semibold text-ink-2">Sin leer</span></>}
        {!sinLeer && aviso.estado === 'archivada' && ' · Archivada'}
      </span>
    </span>
    {accionable && aviso.alerta_envejeciente_id && <Icono nombre="chevron_right" className="mt-2.5 flex-none text-muted" />}
  </>
  if (!accionable) return <div className={clases}>{contenido}</div>
  return <button type="button" className={clases} disabled={ocupada} aria-busy={ocupada || undefined} onClick={() => abrir(aviso)}>
    {contenido}
  </button>
}

export function PantallaNotificaciones({ base, token, raiz, revision, alCambiar }: {
  base: string
  token: string
  raiz: string
  revision: number
  /** Avisa al portal para que actualice el contador de la campana. */
  alCambiar: () => void
}) {
  const navigate = useNavigate()
  const [soloSinLeer, fijarSoloSinLeer] = useState(false)
  const [local, setLocal] = useState(0)
  const [abriendo, setAbriendo] = useState<string>()
  const [error, setError] = useState<string>()
  const enLinea = useConexionReal()
  const ruta = `${base}/notificaciones-alerta`
  const consulta = usePagina<Notificacion>(ruta, token, revision + local, { filters: soloSinLeer ? { estado: 'no_leida' } : undefined })
  const conteoTodas = usePagina<unknown>(ruta, token, revision + local, { limit: 1 })
  const conteoSinLeer = usePagina<unknown>(ruta, token, revision + local, { limit: 1, filters: { estado: 'no_leida' } })
  const avisos = [...(consulta.datos?.data ?? [])].sort((a, b) => b.fecha_notificacion.localeCompare(a.fecha_notificacion))
  const grupos = GRUPOS.map((grupo) => ({ grupo, items: avisos.filter((aviso) => grupoDe(aviso.fecha_notificacion) === grupo) })).filter((item) => item.items.length > 0)

  // Tocar un aviso lo marca como leído y abre la alerta. Si no se pudo marcar, igual se abre la alerta.
  const abrir = async (aviso: Notificacion) => {
    if (abriendo) return
    setAbriendo(aviso.notificacion_id)
    setError(undefined)
    let falloAlMarcar: string | undefined
    if (aviso.estado === 'no_leida') {
      try {
        await api(`${ruta}/${idRuta(aviso.notificacion_id)}/leer`, token, 'POST', {})
        setLocal((n) => n + 1)
        alCambiar()
      } catch (issue) {
        falloAlMarcar = issue instanceof ApiError ? mensajeDeError(issue) : 'No se pudo marcar como leída.'
      }
    }
    setAbriendo(undefined)
    if (aviso.alerta_envejeciente_id) navigate(`${raiz}/alertas?alerta=${encodeURIComponent(aviso.alerta_envejeciente_id)}`)
    else if (falloAlMarcar) setError(falloAlMarcar)
  }

  const cuenta = (total: number | undefined) => (total === undefined ? '' : ` (${total})`)
  return <section className="grid grid-cols-1 gap-4" aria-label="Notificaciones de alertas">
    <div role="group" aria-label="Filtro de notificaciones" className="flex flex-wrap gap-2">
      <Chip active={!soloSinLeer} onClick={() => fijarSoloSinLeer(false)}>{`Todas${cuenta(conteoTodas.datos?.meta.total)}`}</Chip>
      <Chip active={soloSinLeer} onClick={() => fijarSoloSinLeer(true)}>{`Sin leer${cuenta(conteoSinLeer.datos?.meta.total)}`}</Chip>
    </div>
    {!enLinea && consulta.datos && <Aviso tipo="advertencia" icono="wifi_off">Sin conexión. Abrir una notificación no la marcará como leída hasta que vuelva Internet. Lo demás lo puedes seguir consultando.</Aviso>}
    {error && <Aviso tipo="error">{error}</Aviso>}
    <Estado consulta={consulta} vacio={consulta.datos?.data.length === 0 ? (soloSinLeer ? 'No tienes notificaciones sin leer.' : 'Sin notificaciones de alertas.') : undefined} />
    {grupos.map(({ grupo, items }) => <section key={grupo} aria-label={grupo} className="grid gap-2">
      <h2 className="text-cuerpo font-semibold text-muted">{grupo}</h2>
      <ul className="grid grid-cols-1 gap-3">
        {items.map((aviso) => <li key={aviso.notificacion_id}>
          <Tarjeta aviso={aviso} grupo={grupo} ocupada={abriendo === aviso.notificacion_id} abrir={(item) => { void abrir(item) }} />
        </li>)}
      </ul>
    </section>)}
    {consulta.datos && consulta.datos.data.length > 0 && <p className="text-center text-ayuda text-muted">Al abrir una notificación se marca como leída y te lleva a la alerta.</p>}
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </section>
}
