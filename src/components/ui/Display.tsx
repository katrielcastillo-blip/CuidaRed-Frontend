/*
 * Display.tsx — Componentes de presentación: Badge, RiesgoBadge, Avatar, Card, LinkCard, IconTile,
 * StatTile, Datum, InfoRow, Segmented, Chip, EmptyState, Spinner, StepBar, ProgresoRegistro, HelpTip.
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck, Diamond, TriangleAlert } from 'lucide-react'
import type { Riesgo } from '@/domain/types'
import { cn } from '@/lib/cn'
import { Icono, type NombreIcono } from './Icono'

/* ───────────── Badge ───────────── */
export type Tone = 'danger' | 'warning' | 'success' | 'info' | 'neutral' | 'navy'

// Figma «Chip»: Alta (danger) · Media (warning) · Baja (success) · Info · Neutro. Fondo pálido, borde de color y texto con
// contraste WCAG AA (≥ 4.5:1) para 12 px (el ámbar y el verde llevan texto oscuro; el gris, ink-2 en vez de #64748B).
const TONOS: Record<Tone, string> = {
  danger: 'bg-danger-100 border-danger text-danger',
  warning: 'bg-warning-100 border-warning text-ink',
  success: 'bg-teal-100 border-teal text-ink',
  info: 'bg-blue-100 border-blue-principal text-blue-principal',
  neutral: 'bg-surface-2 border-surface-2 text-ink-2',
  navy: 'bg-navy border-navy text-blue-100',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1 px-2.5 py-1 rounded-pill border text-etiqueta uppercase whitespace-nowrap',
        TONOS[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Nivel de riesgo con color Y forma (SRS §18.4): se reconoce sin leer el texto.
 *   ALTO = triángulo rojo · MEDIO = rombo ámbar · BAJO = círculo verde.
 */
// `Icono` (Lucide) se conserva solo por compatibilidad con pantallas que aún lo usan; el kit usa `icono` (Material).
export const RIESGO_VISUAL: Record<
  Riesgo,
  { tone: Tone; label: string; Icono: typeof TriangleAlert; icono: NombreIcono; color: string }
> = {
  alto: { tone: 'danger', label: 'ALTO', Icono: TriangleAlert, icono: 'warning', color: 'text-riesgo-alto' },
  medio: { tone: 'warning', label: 'MEDIO', Icono: Diamond, icono: 'diamond', color: 'text-riesgo-medio' },
  bajo: { tone: 'success', label: 'BAJO', Icono: CircleCheck, icono: 'check_circle', color: 'text-riesgo-bajo' },
}

export function RiesgoBadge({ riesgo }: { riesgo: Riesgo }) {
  const r = RIESGO_VISUAL[riesgo]
  return (
    <Badge tone={r.tone}>
      <Icono nombre={r.icono} tamano={14} />
      <span>
        <span className="sr-only">Riesgo </span>
        {r.label}
      </span>
    </Badge>
  )
}

/* ───────────── Avatar ───────────── */
/** Avatar con iniciales. Figma: Pequeño 40 px · Grande 72 px (las demás medidas escalan la letra). */
export function Avatar({ nombre, src, size = 40, ring }: { nombre: string; src?: string; size?: number; ring?: boolean }) {
  const initials = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
  return (
    <span
      className={cn(
        'inline-grid place-items-center flex-none rounded-full bg-blue-100 text-navy font-semibold overflow-hidden border-2 border-blue',
        ring && 'border-white border-[3px] shadow-2',
      )}
      style={{ width: size, height: size, fontSize: size >= 64 ? 20 : Math.max(12, Math.round(size * 0.4)) }}
      aria-hidden={!src ? undefined : true}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials}
    </span>
  )
}

/* ───────────── Card ───────────── */
const CARD_TONO = {
  default: 'bg-bg',
  muted: 'bg-surface-2',
  info: 'bg-blue-100 border-navy',
}

export function Card({
  children,
  tone = 'default',
  padded = true,
  className,
  ...rest
}: {
  children: ReactNode
  tone?: 'default' | 'muted' | 'info'
  padded?: boolean
  className?: string
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-sm border border-line', CARD_TONO[tone], padded && 'p-4', className)} {...rest}>
      {children}
    </div>
  )
}

/** Tarjeta con pie "Ver más →" que enlaza (patrón de tarjetaEnvejeciente / visita). */
export function LinkCard({ to, children, footer = 'Ver más' }: { to: string; children: ReactNode; footer?: string }) {
  return (
    <Link to={to} className="flex flex-col h-full rounded-sm border border-line bg-bg overflow-hidden transition-shadow hover:shadow-1">
      <div className="p-4 flex-1">{children}</div>
      <div className="flex items-center justify-end gap-2 min-h-12 px-4 bg-blue-100 border-t border-navy text-navy text-xs font-semibold">
        <span>{footer}</span>
        <ArrowRight size={18} aria-hidden />
      </div>
    </Link>
  )
}

/* ───────────── IconTile / StatTile ───────────── */
export function IconTile({ children, size = 48 }: { children?: ReactNode; size?: number }) {
  return (
    <span
      className="inline-grid place-items-center flex-none rounded-md bg-blue-100 border border-blue text-navy"
      style={{ width: size, height: size }}
    >
      {children ?? <Icono nombre="person" tamano={Math.round(size * 0.5)} />}
    </span>
  )
}

const STAT_TONO = { default: 'bg-bg', danger: 'bg-[#f6d7d2]', info: 'bg-blue-100' }

export function StatTile({ label, value, tone = 'default' }: { label: string; value: ReactNode; tone?: 'default' | 'danger' | 'info' }) {
  return (
    <div className={cn('flex flex-col justify-between gap-1 px-3 py-2 min-h-[65px] rounded-sm', STAT_TONO[tone])}>
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className="self-end text-[2rem] font-bold leading-[1.1]">{value}</span>
    </div>
  )
}

/* ───────────── Datos ───────────── */
/** Par etiqueta/valor (Cédula · 001-…). */
export function Datum({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-ink">{label}</span>
      <span className="text-base font-bold text-ink wrap-anywhere">{value}</span>
    </div>
  )
}

/** Fila de perfil con icono, etiqueta y valor, con línea inferior (Información personal). */
export function InfoRow({ icon, label, value, action }: { icon?: ReactNode; label: string; value: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-3 pb-2 border-b border-line-soft text-muted">
        {icon}
        <span className="flex-1 min-w-0 text-sm text-muted wrap-anywhere">{value}</span>
        {action}
      </div>
    </div>
  )
}

/* ───────────── Navegación local ───────────── */
/** Pestañas segmentadas (Hoy · Próximas · Historial / Necesidades · Visitas). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  label?: string
}) {
  return (
    <div className="flex gap-2" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={cn(
            'flex-1 min-h-12 px-3 rounded-sm border text-sm font-semibold',
            value === o.value ? 'bg-navy text-white border-navy' : 'bg-surface-2 text-ink-2 border-line-soft',
          )}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Filtro tipo chip (con valor seleccionado). */
export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active ?? false}
      className={cn(
        'inline-flex items-center gap-1.5 min-h-12 px-4 rounded-pill border text-sm font-semibold whitespace-nowrap',
        active ? 'bg-navy border-navy text-white' : 'bg-surface border-line-soft text-ink-2',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/* ───────────── Estados ───────────── */
/**
 * Patrón «lista vacía» (Figma 10): tarjeta blanca con ícono en círculo azul, título, texto de ayuda y, si aplica,
 * el botón de la acción que llena la lista. El ícono es decorativo; el mensaje lo dan el título y el texto.
 */
export function EmptyState({ title, text, action, icono = 'inbox', className }: { title: string; text?: string; action?: ReactNode; icono?: NombreIcono; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-8 text-center shadow-1', className)}>
      <span className="grid size-[72px] flex-none place-items-center rounded-full bg-blue-100 text-blue-principal" aria-hidden>
        <Icono nombre={icono} tamano={36} />
      </span>
      <p className="text-tarjeta font-semibold text-ink wrap-anywhere">{title}</p>
      {text && <p className="max-w-prose text-cuerpo text-muted wrap-anywhere">{text}</p>}
      {action && <div className="mt-2 flex w-full max-w-sm flex-col [&>*]:w-full">{action}</div>}
    </div>
  )
}

export function Spinner() {
  return (
    <span
      className="inline-block size-7 rounded-full border-[3px] border-blue border-r-transparent animate-spin"
      role="status"
      aria-label="Cargando"
    />
  )
}

/**
 * Barra de progreso de pasos segmentada (un segmento por paso, 6 px, azul principal / gris). Es un `progressbar`
 * accesible; el texto «Paso X de N» lo pone el formulario (o usa `ProgresoRegistro`, que lo incluye).
 */
export function StepBar({ step, total, className }: { step: number; total: number; className?: string }) {
  return (
    <div
      className={cn('flex gap-1.5 overflow-hidden', className)}
      role="progressbar"
      aria-label={`Paso ${step} de ${total}`}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-valuetext={`Paso ${step} de ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('h-1.5 min-w-px flex-1 rounded-[3px] transition-colors duration-200', i < step ? 'bg-blue-principal' : 'bg-surface-2')} />
      ))}
    </div>
  )
}

/** Figma «Progreso del registro»: texto «Paso X de N» (14 px, gris) y barra segmentada. */
export function ProgresoRegistro({ paso, total, className }: { paso: number; total: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="text-ayuda text-muted" aria-live="polite">
        Paso {paso} de {total}
      </p>
      <StepBar step={paso} total={total} />
    </div>
  )
}

/**
 * Ayuda en línea (SRS §8.2.2.1.8.2): botón "?" de 48 px que despliega una explicación breve.
 * Funciona con toque (móvil) y con teclado; el texto queda asociado por aria-describedby.
 */
export function HelpTip({ children, label = 'Ayuda' }: { children: ReactNode; label?: string }) {
  const [abierto, setAbierto] = useState(false)
  // Desplazamiento horizontal para que la burbuja no quede cortada en el borde de pantallas estrechas.
  const [ajuste, setAjuste] = useState(0)
  const burbuja = useRef<HTMLSpanElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!abierto || !burbuja.current) return
    const r = burbuja.current.getBoundingClientRect()
    const margen = 8
    const ancho = document.documentElement.clientWidth
    if (r.left < margen) setAjuste(margen - r.left)
    else if (r.right > ancho - margen) setAjuste(ancho - margen - r.right)
  }, [abierto])

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className="grid place-items-center size-12 -my-3 rounded-full text-blue hover:bg-blue-100"
        aria-label={label}
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => {
          setAjuste(0)
          setAbierto((v) => !v)
        }}
        onBlur={() => setAbierto(false)}
        onKeyDown={(e) => {
          // Esc cierra la ayuda (WCAG 1.4.13) sin cerrar el panel que la contiene.
          if (e.key !== 'Escape' || !abierto) return
          e.stopPropagation()
          setAbierto(false)
        }}
      >
        <Icono nombre="help" tamano={24} />
      </button>
      <span
        ref={burbuja}
        id={id}
        role="tooltip"
        hidden={!abierto}
        style={ajuste ? { marginLeft: ajuste } : undefined}
        className="absolute z-40 top-full left-1/2 -translate-x-1/2 mt-1 w-[min(280px,80vw)] max-h-[min(60vh,22rem)] overflow-y-auto rounded-md bg-navy text-white text-sm font-normal leading-snug p-3 shadow-2"
      >
        {children}
      </span>
    </span>
  )
}
