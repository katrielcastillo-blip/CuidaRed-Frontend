/*
 * barras.tsx — Barra superior (pantallas principales), barra secundaria (resto) y acciones de cabecera.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import type { MouseEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icono } from '@/components/ui'
import { iniciales } from './modulos'

const BOTON_BASE = 'relative grid size-11 flex-none place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
const BOTON_REDONDO = `${BOTON_BASE} bg-white/[.14] text-white hover:bg-white/25`
const BOTON_AVISO = `${BOTON_BASE} bg-warning-100 text-ink`

export type DatosCabecera = {
  raiz: string
  enLinea: boolean
  /** La campana solo existe para quien recibe avisos de alertas. */
  mostrarAvisos: boolean
  pendientes: number
  nombreUsuario: string
}

export function AccionesCabecera({ raiz, enLinea, mostrarAvisos, pendientes, nombreUsuario }: DatosCabecera) {
  return <div className="flex flex-none items-center gap-2">
    <Link to={`${raiz}/conexion`} className={enLinea ? BOTON_REDONDO : BOTON_AVISO}
      aria-label={`Conexión y sincronización: ${enLinea ? 'en línea' : 'sin conexión'}`} title="Conexión y sincronización">
      <Icono nombre={enLinea ? 'cloud_done' : 'cloud_off'} />
    </Link>
    {mostrarAvisos && <Link to={`${raiz}/notificaciones`} className={BOTON_REDONDO} title="Notificaciones"
      aria-label={pendientes > 0 ? `Notificaciones, ${pendientes} sin leer` : 'Notificaciones'}>
      <Icono nombre="notifications" />
      {pendientes > 0 && <span aria-hidden className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-navy bg-danger px-1 text-[11px] leading-none font-bold text-white">
        {pendientes > 99 ? '99+' : pendientes}
      </span>}
    </Link>}
    {/* Por ahora «Mi perfil» es la pantalla existente de la cuenta de la persona (/cuenta). */}
    <Link to="/cuenta" aria-label="Mi cuenta" title="Mi perfil"
      className="grid size-11 flex-none place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-blue-100 text-ayuda font-semibold text-navy">{iniciales(nombreUsuario)}</span>
    </Link>
    <span role="status" className="sr-only">{enLinea ? '' : 'Sin conexión'}</span>
  </div>
}

/** Vuelve a Inicio o, en las pantallas que se abren desde cualquier parte, a la pantalla anterior. */
export function EnlaceVolver({ destino, historial, accion }: { destino: string; historial?: boolean; accion?: () => void }) {
  const navigate = useNavigate()
  const { key } = useLocation()
  const volver = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (accion) {
      event.preventDefault()
      accion()
      return
    }
    if (!historial || key === 'default') return
    event.preventDefault()
    navigate(-1)
  }
  return <Link to={destino} onClick={volver} aria-label="Volver"
    className="grid size-12 flex-none place-items-center rounded-full text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
    <Icono nombre="arrow_back" />
  </Link>
}

const TITULO = 'min-w-0 flex-1 truncate text-tarjeta text-white'

/** Móvil, pantallas principales: nombre de la cuenta y acciones. */
export function BarraSuperior({ titulo, ...datos }: DatosCabecera & { titulo: string }) {
  return <header className="bg-navy pt-[var(--safe-top)] shadow-1 md:hidden">
    <div className="flex min-h-16 items-center gap-2 ps-4 pe-2">
      <h1 className={TITULO}>{titulo}</h1>
      <AccionesCabecera {...datos} />
    </div>
  </header>
}

/** Móvil, pantallas secundarias: volver y título, sin barra inferior. */
export function BarraSecundaria({ titulo, destino, historial, accion }: { titulo: string; destino: string; historial?: boolean; accion?: () => void }) {
  return <header className="bg-grad-encabezado pt-[var(--safe-top)] shadow-1 md:hidden">
    <div className="flex min-h-16 items-center gap-1 ps-2 pe-4">
      <EnlaceVolver destino={destino} historial={historial} accion={accion} />
      <h1 className={TITULO}>{titulo}</h1>
    </div>
  </header>
}

/** Tablet y escritorio: una sola cabecera de contenido con las acciones de la barra superior. */
export function CabeceraEscritorio({ titulo, volver, ...datos }: DatosCabecera & { titulo: string; volver?: ReactNode }) {
  return <header className="hidden bg-navy shadow-1 md:block">
    <div className="mx-auto flex min-h-[var(--appbar-h)] max-w-[calc(var(--content-max)+var(--gutter)*2)] items-center gap-3 px-[var(--gutter)]">
      {volver}
      <h1 className={TITULO}>{titulo}</h1>
      <AccionesCabecera {...datos} />
    </div>
  </header>
}
