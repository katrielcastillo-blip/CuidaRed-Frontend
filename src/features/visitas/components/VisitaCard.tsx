/*
 * VisitaCard.tsx — Tarjeta de visita: icono de calendario, adulto, hora y fecha, motivo (Visit_razon), adultos
 * adicionales del hogar (DetalleVisita), estado y "Ver más".
 * Módulo: visitas (RF-02 · CU-06).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { nombreCompleto } from '@/domain/auth'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import type { Adulto, Visita } from '@/domain/types'
import { Badge, IconTile } from '@/components/ui'
import { ESTADO_VISITA, estadoAdulto, fechaHoraVisita } from '../lib/dominio'
import { SyncBadge } from './Comun'

/** `mostrarAdulto={false}` (perfil del adulto) usa la fecha como título, porque el adulto ya es obvio. */
export function VisitaCard({ visita, adulto, to, mostrarAdulto = true }: { visita: Visita; adulto?: Adulto; to: string; mostrarAdulto?: boolean }) {
  const estado = ESTADO_VISITA[visita.estado]
  const resultado = visita.estado === 'completada' && visita.estadoAdulto ? estadoAdulto(visita.estadoAdulto) : null
  return (
    <Link to={to} className="group flex flex-col gap-3 p-4 rounded-sm border border-line bg-bg transition-shadow hover:shadow-1">
      <div className="flex items-center gap-4">
        <IconTile>
          <CalendarDays size={24} aria-hidden />
        </IconTile>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-semibold text-ink wrap-anywhere">{mostrarAdulto && adulto ? nombreCompleto(adulto) : fechaCorta(visita.fecha)}</h3>
            <Badge tone={estado.tone} className="mt-1">
              {estado.badge}
            </Badge>
          </div>
          <p className="text-base font-semibold text-ink">{mostrarAdulto ? fechaHoraVisita(visita) : hhmmA12(visita.horaPautada)}</p>
          <p className="text-xs text-muted">
            {visita.razon?.trim() || visita.tipo}
            {resultado && ` · ${resultado.label}`}
            {visita.detallesAdicionales.length > 0 && ` · +${visita.detallesAdicionales.length} adulto${visita.detallesAdicionales.length === 1 ? '' : 's'} del hogar`}
          </p>
          {visita.pendienteSync && (
            <span className="mt-1">
              <SyncBadge />
            </span>
          )}
        </div>
      </div>
      <span className="flex items-center justify-center gap-2 min-h-12 rounded-sm border border-blue bg-blue-100 text-navy text-sm font-semibold group-hover:bg-[#d6e8f8]">
        Ver más
        <ArrowRight size={18} aria-hidden />
      </span>
    </Link>
  )
}
