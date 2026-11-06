/*
 * Caja.tsx — Caja informativa con icono para los avisos de plan y suscripción (info, advertencia, sin conexión).
 * Módulo: plan y suscripción.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Info, TriangleAlert, WifiOff } from 'lucide-react'
import { cn } from '@/lib/cn'

const TONOS = {
  info: { caja: 'bg-blue-100 border-blue/40 text-ink-2', icono: 'text-blue', Icono: Info },
  warning: { caja: 'bg-warning-100 border-warning text-ink', icono: 'text-warning-700', Icono: TriangleAlert },
  offline: { caja: 'bg-warning-100 border-warning text-ink', icono: 'text-warning-700', Icono: WifiOff },
}

export function Caja({ tono = 'info', children, className }: { tono?: keyof typeof TONOS; children: ReactNode; className?: string }) {
  const t = TONOS[tono]
  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-md border', t.caja, className)} role={tono === 'info' ? 'note' : 'status'}>
      <t.Icono size={20} className={cn('flex-none mt-0.5', t.icono)} aria-hidden />
      <div className="flex-1 min-w-0 text-sm leading-relaxed">{children}</div>
    </div>
  )
}
