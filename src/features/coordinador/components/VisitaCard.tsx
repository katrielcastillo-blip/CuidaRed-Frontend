/*
 * VisitaCard.tsx — Tarjeta de la agenda de visitas del coordinador: adulto principal y adultos adicionales del
 * hogar (DetalleVisita), hora y fecha, motivo (Visit_razon), voluntario responsable, estado y marca
 * "Pendiente de sincronización" (CU-05 · CU-06 · RF-10).
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Users } from 'lucide-react'
import { Badge, IconTile } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import type { Adulto, Usuario, Visita } from '@/domain/types'
import { cuandoVisita, ESTADO_VISITA } from '../lib/datos'

export function VisitaCard({
  visita,
  adulto,
  adicionales = [],
  responsable,
  to,
}: {
  visita: Visita
  adulto?: Adulto
  /** Otros adultos atendidos en la misma visita (filas adicionales de DetalleVisita). */
  adicionales?: Adulto[]
  responsable?: Usuario
  to: string
}) {
  const vencida = visita.estado === 'pendiente' && visita.fecha < todayISO()
  const estado = ESTADO_VISITA[visita.estado]
  return (
    <Link to={to} className="group flex flex-col gap-3 p-4 rounded-sm border border-line bg-bg transition-shadow hover:shadow-1">
      <div className="flex items-start gap-3">
        <IconTile size={48}>
          <CalendarDays size={24} aria-hidden />
        </IconTile>
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex-1 min-w-0 text-base font-bold leading-snug text-ink wrap-anywhere">{adulto ? nombreCompleto(adulto) : 'Adulto mayor'}</h3>
            <span className="mt-0.5 flex-none">
              {vencida ? <Badge tone="danger">Vencida</Badge> : <Badge tone={estado.tono}>{estado.label}</Badge>}
            </span>
          </div>
          <p className="text-base font-bold leading-snug text-ink">{cuandoVisita(visita)}</p>
          <p className="text-sm font-semibold text-ink-2 wrap-anywhere">
            <span className="sr-only">Motivo: </span>
            {visita.razon || visita.tipo}
          </p>
          {adicionales.length > 0 && (
            <p className="flex items-start gap-1.5 text-sm text-muted wrap-anywhere">
              <Users size={16} className="flex-none mt-0.5 text-navy" aria-hidden />
              <span>También: {adicionales.map(nombreCompleto).join(', ')}</span>
            </p>
          )}
          <p className="text-sm text-muted">Responsable: {responsable ? nombreCompleto(responsable) : 'Sin asignar'}</p>
          {visita.pendienteSync && (
            <span className="mt-1">
              <Badge tone="warning">Pendiente de sincronización</Badge>
            </span>
          )}
        </div>
      </div>
      <span className="mt-auto flex items-center justify-center gap-2 min-h-12 rounded-sm bg-blue-100 border border-blue text-navy text-sm font-bold group-hover:bg-[#d6e8f8]">
        Ver detalle <ArrowRight size={16} aria-hidden />
      </span>
    </Link>
  )
}
