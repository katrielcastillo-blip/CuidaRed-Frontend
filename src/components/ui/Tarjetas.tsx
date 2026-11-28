/*
 * Tarjetas.tsx — Tarjeta KPI (Figma «Tarjeta KPI») y Fila de lista (Figma «Fila de lista»).
 * Ambas pueden ser enlace (`to`), botón (`onClick`) o contenido estático. Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Icono, type NombreIcono } from './Icono'

/* ───────────── Tarjeta KPI ───────────── */
export type TonoKpi = 'rojo' | 'azul' | 'ambar' | 'verde'

const KPI: Record<TonoKpi, { caja: string; icono: string; baldosa: string }> = {
  rojo: { caja: 'bg-danger-100 border-danger', icono: 'text-danger', baldosa: 'bg-danger-100' },
  azul: { caja: 'bg-blue-100 border-blue-principal', icono: 'text-blue-principal', baldosa: 'bg-blue-100' },
  ambar: { caja: 'bg-warning-100 border-warning', icono: 'text-warning-700', baldosa: 'bg-warning-100' },
  verde: { caja: 'bg-teal-100 border-teal', icono: 'text-success-700', baldosa: 'bg-teal-100' },
}

/**
 * `tinte`: tarjeta de color con borde (estilo original del kit). `panel`: tarjeta blanca de los paneles de gestión
 * (Figma «Inicio v3»): cifra y etiqueta a la izquierda y baldosa de 40 px teñida según la métrica arriba a la derecha.
 */
export type VarianteKpi = 'tinte' | 'panel'

/**
 * Cifra grande con etiqueta y detalle. Toda la tarjeta es tocable: con `to` enlaza a una lista filtrada
 * (p. ej. «alertas críticas»). El mensaje no depende del color: lleva ícono, cifra y texto.
 */
export function TarjetaKpi({
  tono,
  icono,
  valor,
  etiqueta,
  detalle,
  variante = 'tinte',
  to,
  onClick,
  className,
}: {
  tono: TonoKpi
  icono: NombreIcono
  valor: ReactNode
  etiqueta: string
  /** En `panel` el detalle solo se anuncia a lectores de pantalla (el diseño muestra cifra y etiqueta). */
  detalle?: string
  variante?: VarianteKpi
  to?: string
  onClick?: () => void
  className?: string
}) {
  const t = KPI[tono]
  const panel = variante === 'panel'
  const clases = cn(
    panel
      ? 'grid min-h-24 min-w-0 grid-cols-[minmax(0,1fr)_auto] content-start items-start gap-x-2 rounded-2xl bg-surface p-4 text-left shadow-1'
      : 'flex min-h-[132px] min-w-0 flex-col items-start gap-1 rounded-2xl border p-4 text-left',
    !panel && t.caja,
    (to || onClick) && (panel ? 'transition hover:bg-blue-100/40 active:translate-y-px' : 'transition hover:brightness-[.97] active:translate-y-px'),
    className,
  )
  const contenido = panel ? (
    <>
      <span className="min-w-0 text-pantalla text-ink wrap-anywhere">{valor}</span>
      <span className={cn('grid size-10 flex-none place-items-center rounded-[10px]', t.baldosa, t.icono)} aria-hidden>
        <Icono nombre={icono} tamano={24} />
      </span>
      <span className="col-span-2 min-w-0 text-ayuda text-muted wrap-anywhere">{etiqueta}</span>
      {detalle && <span className="sr-only">{detalle}</span>}
    </>
  ) : (
    <>
      <span className={cn('mb-1 grid size-10 flex-none place-items-center rounded-[10px] bg-surface', t.icono)} aria-hidden>
        <Icono nombre={icono} tamano={24} />
      </span>
      <span className="text-pantalla text-ink">{valor}</span>
      <span className="text-cuerpo font-semibold text-ink wrap-anywhere">{etiqueta}</span>
      {detalle && <span className="text-ayuda text-muted wrap-anywhere">{detalle}</span>}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={clases}>
        {contenido}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clases}>
        {contenido}
      </button>
    )
  }
  return <div className={clases}>{contenido}</div>
}

/* ───────────── Fila de lista ───────────── */
/** Fila con ícono en baldosa de 40 px, título, descripción y flecha. Mide al menos 56 px de alto. */
export function FilaLista({
  icono,
  titulo,
  descripcion,
  to,
  onClick,
  derecha,
  className,
}: {
  icono: NombreIcono | ReactNode
  titulo: string
  descripcion?: string
  to?: string
  onClick?: () => void
  /** Sustituye a la flecha (p. ej. un chip de estado). */
  derecha?: ReactNode
  className?: string
}) {
  const accionable = !!(to || onClick)
  const clases = cn('flex min-h-14 w-full min-w-0 items-center gap-3 py-2 text-left', accionable && 'rounded-md hover:bg-blue-100/50', className)
  const contenido = (
    <>
      <span className="grid size-10 flex-none place-items-center rounded-md bg-blue-100 text-navy" aria-hidden>
        {typeof icono === 'string' ? <Icono nombre={icono as NombreIcono} tamano={24} /> : icono}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-cuerpo font-semibold text-ink wrap-anywhere">{titulo}</span>
        {descripcion && <span className="text-ayuda text-muted wrap-anywhere">{descripcion}</span>}
      </span>
      {derecha ?? (accionable && <Icono nombre="chevron_right" tamano={24} className="flex-none text-muted" />)}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={clases}>
        {contenido}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clases}>
        {contenido}
      </button>
    )
  }
  return <div className={clases}>{contenido}</div>
}
