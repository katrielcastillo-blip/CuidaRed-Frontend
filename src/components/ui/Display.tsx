import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, UserRound } from 'lucide-react'
import type { Riesgo } from '@/domain/types'
import styles from './Display.module.css'

/* ───────────── Badge ───────────── */
type Tone = 'danger' | 'warning' | 'success' | 'info' | 'neutral' | 'navy'

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[`tone_${tone}`]}`}>{children}</span>
}

const RIESGO: Record<Riesgo, { tone: Tone; label: string }> = {
  alto: { tone: 'danger', label: 'ALTO' },
  medio: { tone: 'warning', label: 'MEDIO' },
  bajo: { tone: 'success', label: 'BAJO' },
}
/** Chip de nivel de riesgo (ALTO rojo · MEDIO ámbar · BAJO verde). */
export function RiesgoBadge({ riesgo }: { riesgo: Riesgo }) {
  const r = RIESGO[riesgo]
  return <Badge tone={r.tone}>{r.label}</Badge>
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
      className={`${styles.avatar} ${ring ? styles.ring : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden={!src ? undefined : true}
    >
      {src ? <img src={src} alt="" /> : initials}
    </span>
  )
}

/* ───────────── Card ───────────── */
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
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.card} ${styles[`card_${tone}`]} ${padded ? styles.padded : ''} ${className ?? ''}`} {...rest}>
      {children}
    </div>
  )
}

/** Tarjeta con pie "Ver más →" que enlaza (patrón de tarjetaEnvejeciente / visita). */
export function LinkCard({ to, children, footer = 'Ver más' }: { to: string; children: ReactNode; footer?: string }) {
  return (
    <Link to={to} className={styles.linkCard}>
      <div className={styles.linkCardBody}>{children}</div>
      <div className={styles.linkCardFoot}>
        <span>{footer}</span>
        <ArrowRight size={18} aria-hidden />
      </div>
    </Link>
  )
}

/* ───────────── IconTile / StatTile ───────────── */
export function IconTile({ children, size = 48 }: { children?: ReactNode; size?: number }) {
  return (
    <span className={styles.iconTile} style={{ width: size, height: size }}>
      {children ?? <UserRound size={size * 0.5} aria-hidden />}
    </span>
  )
}

export function StatTile({ label, value, tone = 'default' }: { label: string; value: ReactNode; tone?: 'default' | 'danger' | 'info' }) {
  return (
    <div className={`${styles.stat} ${styles[`stat_${tone}`]}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  )
}

/* ───────────── Datos ───────────── */
/** Par etiqueta/valor (Cédula · 001-…). */
export function Datum({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.datum}>
      <span className={styles.datumLabel}>{label}</span>
      <span className={styles.datumValue}>{value}</span>
    </div>
  )
}

/** Fila de perfil con icono, etiqueta y valor, con línea inferior (Información personal). */
export function InfoRow({ icon, label, value, action }: { icon?: ReactNode; label: string; value: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <div className={styles.infoLine}>
        {icon}
        <span className={styles.infoValue}>{value}</span>
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
    <div className={styles.segmented} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`${styles.seg} ${value === o.value ? styles.segOn : ''}`}
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
    <button type="button" className={`${styles.chip} ${active ? styles.chipOn : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

/* ───────────── Estados ───────────── */
export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  )
}

export function Spinner() {
  return <span className={styles.spinner} role="status" aria-label="Cargando" />
}

/** Barra de progreso de pasos (Registro 1/2). */
export function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div className={styles.stepbar} role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
      <span style={{ width: `${(step / total) * 100}%` }} />
    </div>
  )
}
