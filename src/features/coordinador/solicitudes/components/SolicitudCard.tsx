/*
 * SolicitudCard.tsx — Tarjeta de una solicitud de visita: visitante, a quién quiere visitar (texto que escribió),
 * fecha y hora propuestas y estado. Las pendientes se resaltan e invitan a decidir.
 * Módulo: coordinador · solicitudes de visita.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, UserRound } from 'lucide-react'
import { Badge, IconTile } from '@/components/ui'
import { ESTADO_SOLICITUD } from '@/domain/api/solicitudes'
import { fechaCorta } from '@/domain/dates'
import type { SolicitudVisita } from '@/domain/types'
import { cn } from '@/lib/cn'
import { horaPautada12 } from '../../lib/datos'
import { cuandoRecibida, nombreVisitante, TONO_SOLICITUD } from '../lib/solicitudes'

export function SolicitudCard({ solicitud: s, to }: { solicitud: SolicitudVisita; to: string }) {
  const pendiente = s.estado === 'pendiente'
  return (
    <Link
      to={to}
      className={cn(
        'group flex flex-col gap-3 p-4 rounded-sm border bg-bg transition-shadow hover:shadow-1',
        pendiente ? 'border-warning shadow-[inset_4px_0_0_#9a6400]' : 'border-line',
      )}
    >
      <div className="flex items-start gap-3">
        <IconTile size={48}>
          <UserRound size={24} aria-hidden />
        </IconTile>
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex-1 min-w-0 text-base font-bold leading-snug text-ink wrap-anywhere">{nombreVisitante(s)}</h3>
            <span className="mt-0.5 flex-none">
              <Badge tone={TONO_SOLICITUD[s.estado]}>{ESTADO_SOLICITUD[s.estado]}</Badge>
            </span>
          </div>
          <p className="text-sm text-ink-2 wrap-anywhere">
            <span className="font-semibold">Quiere visitar a:</span> {s.personaAVisitar}
          </p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <CalendarDays size={16} className="flex-none text-navy" aria-hidden />
            <span>
              <span className="sr-only">Fecha propuesta: </span>
              {fechaCorta(s.fechaPropuesta)} · {horaPautada12(s.horaPropuesta)}
            </span>
          </p>
          <p className="text-xs text-muted">Recibida {cuandoRecibida(s.creadaEn)}</p>
        </div>
      </div>
      <span
        className={cn(
          'mt-auto flex items-center justify-center gap-2 min-h-12 rounded-sm border text-sm font-bold',
          pendiente ? 'bg-navy border-transparent text-white group-hover:bg-navy-700' : 'bg-blue-100 border-blue text-navy group-hover:bg-[#d6e8f8]',
        )}
      >
        {pendiente ? 'Revisar y decidir' : 'Ver detalle'} <ArrowRight size={16} aria-hidden />
      </span>
    </Link>
  )
}
