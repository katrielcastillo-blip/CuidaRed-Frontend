/*
 * Nota.tsx — Caja informativa (nota de invitación, umbrales, privacidad) y aviso de "sin conexión".
 * Módulo: admin.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Info, TriangleAlert, WifiOff } from 'lucide-react'
import { cn } from '@/lib/cn'

const TONOS = {
  info: { caja: 'bg-blue-100 border-blue/40 text-ink-2', icono: 'text-blue', Icono: Info },
  warning: { caja: 'bg-warning-100 border-warning text-ink', icono: 'text-warning-700', Icono: TriangleAlert },
}

/** Caja informativa con icono. */
export function Nota({ children, tono = 'info', className }: { children: ReactNode; tono?: keyof typeof TONOS; className?: string }) {
  const t = TONOS[tono]
  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-md border', t.caja, className)} role="note">
      <t.Icono size={20} className={cn('flex-none mt-0.5', t.icono)} aria-hidden />
      <div className="flex-1 min-w-0 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

/** Aviso que explica por qué las acciones de administración están deshabilitadas sin conexión. */
export function AvisoSinConexion({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-md border border-warning bg-warning-100 text-ink" role="status">
      <WifiOff size={20} className="flex-none mt-0.5 text-warning-700" aria-hidden />
      <p className="flex-1 min-w-0 text-sm leading-relaxed">
        <strong>Sin conexión.</strong>{' '}
        {children ?? 'La gestión de usuarios y la configuración necesitan internet para aplicarse en todos los dispositivos. Podrás guardar cuando vuelva la conexión.'}
      </p>
    </div>
  )
}
