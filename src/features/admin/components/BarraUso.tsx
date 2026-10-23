/*
 * BarraUso.tsx — Barra de uso de un límite del plan (Plan.Limite_Envejecientes / Limite_Usuarios): verde,
 * ámbar desde el 80 % y roja si se excede (con texto, no solo color).
 * Módulo: admin (modelo de datos V3.0).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

export function BarraUso({ etiqueta, usado, limite, excede }: { etiqueta: string; usado: number; limite: number; excede: boolean }) {
  const pct = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 100
  const tono = excede ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success-700'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">{etiqueta}</span>
        <span className={cn('font-bold whitespace-nowrap', excede ? 'text-danger' : 'text-ink')}>
          {usado} / {limite}
        </span>
      </div>
      <div
        className="h-3 rounded-pill bg-surface-2 overflow-hidden"
        role="meter"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={limite}
        aria-valuenow={usado}
        aria-valuetext={`${usado} de ${limite}`}
      >
        <div className={cn('h-full rounded-pill transition-[width] duration-300', tono)} style={{ width: `${Math.max(pct, usado > 0 ? 3 : 0)}%` }} />
      </div>
      {excede && (
        <span className="flex items-center gap-1 text-xs font-semibold text-danger">
          <TriangleAlert size={14} aria-hidden /> Límite excedido en {usado - limite}
        </span>
      )}
    </div>
  )
}
