/*
 * Piezas.tsx — Piezas compartidas por los formularios públicos y de cuenta: avisos, acciones, casilla de
 * aceptación de términos y lista en vivo de requisitos de contraseña.
 * Módulo: auth (SRS §8.2.2.3.5 b: política de contraseñas robustas · Ley 172-13: consentimiento).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, CircleAlert, Info, TriangleAlert, WifiOff, X } from 'lucide-react'
import { Checkbox } from '@/components/ui'
import { REGLAS_PASSWORD } from '@/domain/seguridad'
import { cn } from '@/lib/cn'

/* ───────────── Avisos ───────────── */
type TonoAviso = 'error' | 'info' | 'warning' | 'offline'

const TONO_AVISO: Record<TonoAviso, { clase: string; Icono: typeof Info }> = {
  error: { clase: 'border-danger bg-danger-100 text-danger font-semibold', Icono: CircleAlert },
  info: { clase: 'border-blue bg-blue-100 text-navy', Icono: Info },
  warning: { clase: 'border-warning bg-warning-100 text-warning-700', Icono: TriangleAlert },
  offline: { clase: 'border-warning bg-warning-100 text-warning-700 font-semibold', Icono: WifiOff },
}

/** Recuadro de aviso con icono (error, información, advertencia o sin conexión). */
export function Aviso({ tono = 'info', icono, children, className }: { tono?: TonoAviso; icono?: ReactNode; children: ReactNode; className?: string }) {
  const { clase, Icono } = TONO_AVISO[tono]
  return (
    <div
      className={cn('flex items-start gap-2.5 rounded-sm border px-3.5 py-3 text-sm leading-snug', clase, className)}
      role={tono === 'error' ? 'alert' : 'status'}
    >
      <span className="mt-px flex-none" aria-hidden>
        {icono ?? <Icono size={18} />}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Botones al pie del formulario (abajo del todo en móvil, como en el Figma). */
export function Acciones({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-3.5 pt-6 [&>a]:text-[clamp(16px,4.67vw,20px)] [&>button]:text-[clamp(16px,4.67vw,20px)]">{children}</div>
}

/** Párrafo introductorio centrado. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-pretty text-center leading-normal text-ink-2">{children}</p>
}

/** Enlace de texto subrayado con área táctil de 48 px. */
export const ENLACE = 'inline-flex min-h-12 items-center font-semibold text-[#002a70] underline underline-offset-[3px] hover:text-navy'

/** "¿Ya tienes una cuenta? Iniciar sesión". */
export function YaTienesCuenta() {
  return (
    <p className="text-center text-ink-2">
      ¿Ya tienes una cuenta?{' '}
      <Link to="/inicio" className={ENLACE}>
        Iniciar sesión
      </Link>
    </p>
  )
}

/** Casilla obligatoria de aceptación de Términos y Política de Privacidad (consentimiento informado). */
export function CasillaLegal({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Checkbox
        checked={checked}
        aria-invalid={!!error || undefined}
        onChange={(e) => onChange(e.target.checked)}
        className="leading-snug"
        label={
          <>
            He leído y acepto los <Link to="/terminos">Términos y Condiciones</Link> y la <Link to="/privacidad">Política de Privacidad</Link> de CuidaRed.
          </>
        }
      />
      {error && <Aviso tono="error">{error}</Aviso>}
    </div>
  )
}

/**
 * Requisitos de la contraseña con ✓/✗ en vivo (política de contraseñas robustas). Incluye, si se pasa
 * `confirmar`, la comprobación de que ambas contraseñas coinciden.
 */
export function RequisitosPassword({ password, confirmar, id }: { password: string; confirmar?: string; id?: string }) {
  const reglas: Array<{ id: string; texto: string; ok: boolean }> = REGLAS_PASSWORD.map((r) => ({ id: r.id, texto: r.texto, ok: r.ok(password) }))
  if (confirmar !== undefined) reglas.push({ id: 'coinciden', texto: 'Ambas contraseñas coinciden', ok: !!confirmar && confirmar === password })
  const cumplidas = reglas.filter((r) => r.ok).length
  return (
    <div id={id} className="rounded-sm border border-line-soft bg-surface px-3.5 py-3">
      <p className="mb-1.5 text-sm font-semibold text-ink">
        Tu contraseña debe tener:
        <span className="sr-only" aria-live="polite">
          {` ${cumplidas} de ${reglas.length} requisitos cumplidos.`}
        </span>
      </p>
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {reglas.map((r) => (
          <li key={r.id} className={cn('flex items-center gap-2 text-sm', r.ok ? 'text-success-700' : 'text-ink-2')}>
            <span
              className={cn('grid size-5 flex-none place-items-center rounded-full', r.ok ? 'bg-success-700 text-white' : 'bg-surface-2 text-muted')}
              aria-hidden
            >
              {r.ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
            </span>
            <span>
              {r.texto}
              <span className="sr-only">{r.ok ? ' (cumplido)' : ' (pendiente)'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
