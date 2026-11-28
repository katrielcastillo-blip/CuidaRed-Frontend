/*
 * expediente-ui.tsx — Piezas visuales compartidas por el expediente del adulto mayor (envejecientes, seguimiento e informe):
 * panel de filas, fila de dato con ícono, indicador de nivel de riesgo y de estado (siempre ícono + texto), pestañas del perfil.
 * Módulo: access-real (ID03).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { HTMLAttributes, ReactNode } from 'react'
import { Avatar, Icono, RIESGO_VISUAL, type NombreIcono } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Riesgo } from '@/domain/types'

export type EstadoAdulto = 'activo' | 'inactivo' | 'fallecido'
export const ESTADO_ADULTO: Record<EstadoAdulto, string> = { activo: 'Activo', inactivo: 'Inactivo', fallecido: 'Fallecido' }
const ESTADO_VISUAL: Record<EstadoAdulto, { icono: NombreIcono; color: string }> = {
  activo: { icono: 'check_circle', color: 'text-success-700' },
  inactivo: { icono: 'pause_circle', color: 'text-muted' },
  fallecido: { icono: 'cancel', color: 'text-ink-2' },
}

/** Estado del expediente: ícono + texto (nunca solo color). */
export function IndicadorEstado({ estado }: { estado: EstadoAdulto }) {
  const v = ESTADO_VISUAL[estado]
  return <span className="inline-flex items-center gap-1.5"><Icono nombre={v.icono} tamano={16} className={cn('flex-none', v.color)} />{ESTADO_ADULTO[estado]}</span>
}

/** Nivel de riesgo: ícono (triángulo · rombo · círculo, SRS §18.4) + texto. `texto` sustituye a «Riesgo alto». */
export function IndicadorNivel({ nivel, texto }: { nivel: Riesgo; texto?: string }) {
  const v = RIESGO_VISUAL[nivel]
  return <span className="inline-flex items-center gap-1.5"><Icono nombre={v.icono} tamano={16} className={cn('flex-none', v.color)} />{texto ?? `Riesgo ${nivel}`}</span>
}

/** Recuadro blanco de filas separadas por líneas (Figma «Fila de lista»). */
export function Panel({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return <div className={cn('divide-y divide-surface-2 overflow-hidden rounded-2xl border border-surface-2 bg-surface px-4', className)} {...rest}>{children}</div>
}

/** Título de bloque dentro de una pantalla (20/28). */
export function TituloBloque({ id, children }: { id?: string; children: ReactNode }) {
  return <h3 id={id} className="text-seccion text-ink wrap-anywhere">{children}</h3>
}

export type TonoFila = 'azul' | 'verde' | 'ambar' | 'rojo' | 'gris'
const TONO_FILA: Record<TonoFila, string> = {
  azul: 'bg-blue-100 text-blue-principal',
  verde: 'bg-teal-100 text-success-700',
  ambar: 'bg-warning-100 text-warning-700',
  rojo: 'bg-danger-100 text-danger',
  gris: 'bg-bg border border-surface-2 text-muted',
}

/**
 * Fila de dato del perfil: ficha con ícono, etiqueta pequeña y valor en negrita. Con `onClick` es un botón con flecha
 * (el nombre accesible lo da `etiqueta` + `valor`).
 */
export function FilaDato({ icono, tono = 'gris', etiqueta, valor, onClick, derecha }: {
  icono: NombreIcono
  tono?: TonoFila
  etiqueta: string
  valor: ReactNode
  onClick?: () => void
  derecha?: ReactNode
}) {
  const contenido = <>
    <span className={cn('grid size-10 flex-none place-items-center rounded-md', TONO_FILA[tono])} aria-hidden><Icono nombre={icono} tamano={22} /></span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-ayuda text-muted wrap-anywhere">{etiqueta}</span>
      <span className="text-cuerpo font-bold text-ink wrap-anywhere">{valor}</span>
    </span>
    {derecha}
    {onClick && <Icono nombre="chevron_right" tamano={24} className="flex-none text-muted" />}
  </>
  const base = 'flex min-h-14 w-full min-w-0 items-center gap-3 py-3 text-left'
  return onClick
    ? <button type="button" onClick={onClick} className={cn(base, 'hover:bg-blue-100/40')}>{contenido}</button>
    : <div className={base}>{contenido}</div>
}

/** Pestañas del perfil (Resumen · Historial · Necesidades · Riesgo): contenedor con borde y pestaña activa en azul claro. */
export function PestanasPerfil<T extends string>({ valor, alCambiar, opciones, etiqueta }: {
  valor: T
  alCambiar: (valor: T) => void
  opciones: Array<{ value: T; label: string }>
  etiqueta: string
}) {
  return <div role="tablist" aria-label={etiqueta} className="flex gap-1 overflow-x-auto rounded-2xl border border-surface-2 bg-surface p-1">
    {opciones.map((o) => <button key={o.value} type="button" role="tab" aria-selected={valor === o.value} id={`pestana-${o.value}`}
      aria-controls={`panel-${o.value}`} onClick={() => alCambiar(o.value)}
      className={cn('min-h-12 flex-1 whitespace-nowrap rounded-xl px-2 text-[13px] font-semibold sm:px-3 sm:text-ayuda font-semibold', valor === o.value ? 'bg-blue-100 text-navy' : 'text-ink-2 hover:bg-blue-100/40')}>
      {o.label}
    </button>)}
  </div>
}

/** Fila con avatar de iniciales (contactos, personas asignables, familiares). */
export function CabezaPersona({ nombre, detalle, extra }: { nombre: string; detalle?: ReactNode; extra?: ReactNode }) {
  return <>
    <span aria-hidden className="flex-none"><Avatar nombre={nombre} size={48} /></span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex flex-wrap items-center gap-x-2 text-cuerpo font-semibold text-ink wrap-anywhere">{nombre}{extra}</span>
      {detalle && <span className="text-ayuda text-muted wrap-anywhere">{detalle}</span>}
    </span>
  </>
}
