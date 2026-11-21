/*
 * Seccion.tsx — Bloques del panel de inicio del coordinador: sección con título y enlace "Ver todas" (Seccion),
 * indicador numérico (Kpi) y acceso rápido (Acceso).
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Seccion({
  id,
  titulo,
  ver,
  nota,
  children,
}: {
  id: string
  titulo: string
  ver?: { to: string; label: string }
  /** Frase breve bajo el título. */
  nota?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 min-w-0">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h2 id={id} className="text-xl font-bold text-ink">
            {titulo}
          </h2>
          {ver && (
            <Link to={ver.to} className="inline-flex items-center gap-1 min-h-12 px-2 text-sm font-bold text-navy hover:underline">
              {ver.label} <ChevronRight size={16} aria-hidden />
            </Link>
          )}
        </div>
        {nota && <p className="-mt-2 text-sm text-muted">{nota}</p>}
      </div>
      {children}
    </section>
  )
}

export function Kpi({
  to,
  icon: Icon,
  label,
  valor,
  nota,
  alerta,
}: {
  to?: string
  icon: LucideIcon
  label: string
  valor: ReactNode
  nota: string
  alerta?: boolean
}) {
  const contenido = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight text-muted wrap-anywhere">{label}</span>
        <Icon size={22} className={cn('flex-none', alerta ? 'text-danger' : 'text-navy')} aria-hidden />
      </span>
      <span className={cn('mt-auto text-[2rem] font-bold leading-none', alerta ? 'text-danger' : 'text-ink')}>{valor}</span>
      <span className="text-xs text-muted">{nota}</span>
    </>
  )
  const clase = 'flex flex-col gap-1.5 min-h-[124px] min-w-0 p-4 rounded-md bg-surface shadow-1'
  return to ? (
    <Link to={to} className={cn(clase, 'transition hover:shadow-2 active:translate-y-px')}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  )
}

export function Acceso({ to, icon: Icon, label, contador }: { to: string; icon: LucideIcon; label: string; contador?: number }) {
  return (
    <Link to={to} className="flex items-center gap-3 min-h-16 p-3 rounded-md bg-surface shadow-1 text-sm font-semibold leading-tight text-ink transition hover:bg-blue-100">
      <span className="grid place-items-center flex-none size-10 rounded-md bg-blue-100 border border-blue text-navy">
        <Icon size={22} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {!!contador && (
        <span className="flex-none inline-grid place-items-center min-w-6 h-6 px-2 rounded-pill bg-warning-700 text-xs font-bold text-white" aria-label={`${contador} pendientes`}>
          {contador > 99 ? '99+' : contador}
        </span>
      )}
    </Link>
  )
}
