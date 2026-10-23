/*
 * ActividadCard.tsx — Tarjeta de solo lectura para el historial de visitas y las necesidades del adulto
 * mayor: fecha · estado / título / detalle / datos extra (prioridad, cantidad, motivo…) / "Ver detalle".
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Badge, LinkCard, type Tone } from '@/components/ui'

export function ActividadCard({
  to,
  fecha,
  titulo,
  detalle,
  estado,
  pendienteSync,
  extra,
}: {
  to: string
  fecha: string
  titulo: string
  detalle?: string
  estado: { label: string; tono: Tone }
  pendienteSync?: boolean
  /** Datos adicionales bajo el detalle. */
  extra?: ReactNode
}) {
  return (
    <LinkCard to={to} footer="Ver detalle">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink-2">{fecha}</span>
        <Badge tone={estado.tono}>{estado.label}</Badge>
      </div>
      <p className="mt-1 text-lg font-bold text-ink">{titulo}</p>
      {detalle && <p className="text-sm text-ink-2 line-clamp-2">{detalle}</p>}
      {extra && <div className="flex flex-col gap-1.5 mt-2 text-sm text-ink-2">{extra}</div>}
      {pendienteSync && (
        <span className="inline-block mt-2">
          <Badge tone="warning">Pendiente de sincronización</Badge>
        </span>
      )}
    </LinkCard>
  )
}
