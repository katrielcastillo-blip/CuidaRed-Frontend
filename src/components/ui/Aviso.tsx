/*
 * Aviso.tsx — Aviso de estado (Figma «Aviso»): Info, Error, Éxito y Advertencia. Siempre ícono + color + texto
 * (nunca solo color). Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icono, type NombreIcono } from './Icono'

export type TipoAviso = 'info' | 'error' | 'exito' | 'advertencia'

const TIPOS: Record<TipoAviso, { caja: string; color: string; texto: string; icono: NombreIcono }> = {
  info: { caja: 'bg-blue-100 border-blue-principal', color: 'text-blue-principal', texto: 'text-ink', icono: 'info' },
  error: { caja: 'bg-danger-100 border-danger', color: 'text-danger', texto: 'text-danger', icono: 'error' },
  exito: { caja: 'bg-teal-100 border-teal', color: 'text-success-700', texto: 'text-ink', icono: 'check_circle' },
  advertencia: { caja: 'bg-warning-100 border-warning', color: 'text-warning-700', texto: 'text-ink', icono: 'warning' },
}

/**
 * Recuadro de aviso. El error se anuncia como `alert`; el resto como `status`.
 * `icono` permite cambiar el ícono (p. ej. sin conexión) sin perder el color del tipo.
 */
export function Aviso({
  tipo = 'info',
  icono,
  children,
  className,
  role,
}: {
  tipo?: TipoAviso
  icono?: NombreIcono | ReactNode
  children: ReactNode
  className?: string
  role?: 'alert' | 'status' | 'none'
}) {
  const t = TIPOS[tipo]
  const glifo = icono === undefined ? t.icono : icono
  return (
    <div
      className={cn('flex items-start gap-3 rounded-md border px-4 py-3.5 text-cuerpo', t.caja, t.texto, className)}
      role={role === 'none' ? undefined : (role ?? (tipo === 'error' ? 'alert' : 'status'))}
    >
      <span className={cn('flex-none', t.color)} aria-hidden>
        {typeof glifo === 'string' ? <Icono nombre={glifo as NombreIcono} tamano={24} /> : glifo}
      </span>
      <div className="min-w-0 flex-1 wrap-anywhere">{children}</div>
    </div>
  )
}
