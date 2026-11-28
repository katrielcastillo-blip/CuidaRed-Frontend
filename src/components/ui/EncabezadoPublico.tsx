/*
 * EncabezadoPublico.tsx — Encabezado con degradado de las pantallas públicas (Figma «Encabezado»): flecha de regreso
 * de 48×48 a la izquierda y título grande centrado. Tono azul (general) o verde (recuperar contraseña). Sin ícono de
 * inicio (se eliminó por redundante). Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Icono } from './Icono'

export type TonoEncabezado = 'azul' | 'verde'

const BOTON_VOLVER = 'grid size-12 flex-none place-items-center rounded-full text-white hover:bg-white/15 focus-visible:outline-white'

export function EncabezadoPublico({
  titulo,
  tono = 'azul',
  volver,
  onVolver,
  etiquetaVolver = 'Volver',
  children,
  className,
}: {
  titulo: string
  tono?: TonoEncabezado
  /** Ruta a la que regresa la flecha (enlace). */
  volver?: string
  /** Alternativa a `volver`: acción al tocar la flecha (p. ej. paso anterior de un formulario). */
  onVolver?: () => void
  /** Texto accesible de la flecha. */
  etiquetaVolver?: string
  /** Contenido extra bajo el título. */
  children?: ReactNode
  className?: string
}) {
  const flecha = <Icono nombre="arrow_back" tamano={24} />
  return (
    <header
      className={cn(
        'flex w-full flex-col items-center gap-2 px-2 pb-14 pt-[max(12px,var(--safe-top))] text-white',
        tono === 'verde' ? 'bg-grad-encabezado-verde' : 'bg-grad-encabezado',
        className,
      )}
    >
      <div className="flex min-h-12 w-full items-start justify-between">
        {volver ? (
          <Link to={volver} className={BOTON_VOLVER} aria-label={etiquetaVolver}>
            {flecha}
          </Link>
        ) : onVolver ? (
          <button type="button" onClick={onVolver} className={BOTON_VOLVER} aria-label={etiquetaVolver}>
            {flecha}
          </button>
        ) : null}
      </div>
      <h1 className="w-full px-2 text-center text-pantalla wrap-anywhere">{titulo}</h1>
      {children}
    </header>
  )
}
