/*
 * Display.tsx — Componentes de presentación: Badge, RiesgoBadge, Avatar, Card, LinkCard, IconTile,
 * StatTile, Datum, InfoRow, Segmented, Chip, EmptyState, Spinner, StepBar, HelpTip.
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useId, useState, type HTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck, CircleHelp, Diamond, TriangleAlert, UserRound } from 'lucide-react'
import type { Riesgo } from '@/domain/types'
import { cn } from '@/lib/cn'

/* ───────────── Badge ───────────── */
export type Tone = 'danger' | 'warning' | 'success' | 'info' | 'neutral' | 'navy'

// Combinaciones con contraste WCAG AA (≥ 4.5:1) para texto de 10–12 px.
const TONOS: Record<Tone, string> = {
  danger: 'bg-danger text-white',
  warning: 'bg-warning-700 text-white',
  success: 'bg-success-700 text-white',
  info: 'bg-info-100 text-navy border border-blue',
  neutral: 'bg-surface-2 text-ink-2',
  navy: 'bg-navy text-blue-100',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-bold tracking-[0.02em] uppercase leading-[15px] whitespace-nowrap',
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
export const RIESGO_VISUAL: Record<Riesgo, { tone: Tone; label: string; Icono: typeof TriangleAlert; color: string }> = {
  alto: { tone: 'danger', label: 'ALTO', Icono: TriangleAlert, color: 'text-riesgo-alto' },
  medio: { tone: 'warning', label: 'MEDIO', Icono: Diamond, color: 'text-riesgo-medio' },
  bajo: { tone: 'success', label: 'BAJO', Icono: CircleCheck, color: 'text-riesgo-bajo' },
}

export function RiesgoBadge({ riesgo }: { riesgo: Riesgo }) {
  const r = RIESGO_VISUAL[riesgo]
  return (
    <Badge tone={r.tone}>
      <r.Icono size={11} strokeWidth={3} aria-hidden />
      <span>
        <span className="sr-only">Riesgo </span>
        {r.label}
      </span>
    </Badge>
  )
}

/* ───────────── Avatar ───────────── */
export function Avatar({ nombre, src, size = 44, ring }: { nombre: string; src?: string; size?: number; ring?: boolean }) {
  const initials = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
  return (
    <span
      className={cn(
        'inline-grid place-items-center flex-none rounded-full bg-blue-100 text-navy font-bold overflow-hidden',
        ring && 'border-[3px] border-white shadow-2',
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
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
      {children ?? <UserRound size={size * 0.5} aria-hidden />}
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
export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <p className="font-bold text-lg">{title}</p>
      {text && <p className="text-muted">{text}</p>}
      {action}
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

/** Barra de progreso de pasos (Registro 1/2). */
export function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div
      className="h-1 rounded-sm bg-surface-2 overflow-hidden"
      role="progressbar"
      aria-label={`Paso ${step} de ${total}`}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
    >
      <span className="block h-full bg-navy rounded-sm transition-[width] duration-200" style={{ width: `${(step / total) * 100}%` }} />
    </div>
  )
}

/**
 * Ayuda en línea (SRS §8.2.2.1.8.2): botón "?" de 48 px que despliega una explicación breve.
 * Funciona con toque (móvil) y con teclado; el texto queda asociado por aria-describedby.
 */
export function HelpTip({ children, label = 'Ayuda' }: { children: ReactNode; label?: string }) {
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className="grid place-items-center size-12 -my-3 rounded-full text-blue hover:bg-blue-100"
        aria-label={label}
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
        onBlur={() => setAbierto(false)}
      >
        <CircleHelp size={20} aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        hidden={!abierto}
        className="absolute z-40 top-full left-1/2 -translate-x-1/2 mt-1 w-[min(280px,80vw)] rounded-md bg-navy text-white text-sm font-normal leading-snug p-3 shadow-2"
      >
        {children}
      </span>
    </span>
  )
}
