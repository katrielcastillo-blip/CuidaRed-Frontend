/*
 * NecesidadCard.tsx — Tarjeta de necesidad: fecha y hora, categoría, necesidad del catálogo, cantidad, prioridad,
 * recurrente, adulto, estado y pie "Ver más".
 * Módulo: visitas (RF-03 · CU-08).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { nombreCompleto } from '@/domain/auth'
import { fechaCorta, hora12 } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Adulto, Necesidad } from '@/domain/types'
import { Badge, LinkCard } from '@/components/ui'
import { prioridad, tipoNecesidad, vistaNecesidad } from '../lib/dominio'
import { SyncBadge } from './Comun'

export function NecesidadCard({ necesidad, adulto, to }: { necesidad: Necesidad; adulto?: Adulto; to: string }) {
  const estado = vistaNecesidad(necesidad)
  const tipo = tipoNecesidad(necesidad.tipo)
  const catalogo = useDB((s) => s.catalogos.necesidades)
  const nombreCatalogo = catalogo.find((c) => c.id === necesidad.catalogoId)?.nombre
  const prio = prioridad(necesidad.prioridad)
  const detalle = [
    nombreCatalogo,
    necesidad.cantidad ? `${necesidad.cantidad} ${necesidad.unidad ?? ''}`.trim() : '',
    `Prioridad ${prio.label.toLowerCase()}`,
    necesidad.recurrente ? 'Recurrente' : '',
  ].filter(Boolean)
  return (
    <LinkCard to={to}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs text-muted">
          {fechaCorta(necesidad.creadaEn)} · {hora12(necesidad.creadaEn)}
        </span>
        <Badge tone={estado.tone}>{estado.badge}</Badge>
      </div>
      <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
        <tipo.icon size={20} className="text-blue flex-none" aria-hidden />
        {tipo.label}
      </h3>
      <p className="text-xs font-semibold text-ink-2">{detalle.join(' · ')}</p>
      <p className="text-sm text-ink-2 line-clamp-2">{necesidad.descripcion}</p>
      {adulto && <p className="text-sm text-muted">{nombreCompleto(adulto)}</p>}
      {necesidad.pendienteSync && (
        <div className="mt-2">
          <SyncBadge />
        </div>
      )}
    </LinkCard>
  )
}
