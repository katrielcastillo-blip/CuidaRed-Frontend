/*
 * SolicitudesPorAutorizar.tsx — Tarjeta del inicio del coordinador: "Solicitudes de visita por autorizar" con el
 * contador de pendientes, la solicitud más próxima y acceso a la bandeja (V2 · visitas:autorizar). La muestra
 * solo quien puede autorizar; el contenido no incluye datos de adultos mayores (aún no están confirmados).
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, UserRoundPlus } from 'lucide-react'
import { fechaCorta } from '@/domain/dates'
import type { SolicitudVisita } from '@/domain/types'
import { cn } from '@/lib/cn'
import { horaPautada12 } from '../lib/datos'
import { nombreVisitante } from '../solicitudes/lib/solicitudes'

export function SolicitudesPorAutorizar({ pendientes, to }: { pendientes: SolicitudVisita[]; to: string }) {
  const n = pendientes.length
  // La que tiene la fecha propuesta más cercana es la más urgente de revisar.
  const proxima = [...pendientes].sort((a, b) => `${a.fechaPropuesta} ${a.horaPropuesta}`.localeCompare(`${b.fechaPropuesta} ${b.horaPropuesta}`))[0]
  return (
    <Link
      to={to}
      className={cn(
        'group flex flex-col gap-4 p-4 rounded-md border transition hover:shadow-2 active:translate-y-px md:flex-row md:items-center md:gap-5 md:p-5',
        n > 0 ? 'bg-warning-100 border-warning' : 'bg-surface border-line-soft shadow-1',
      )}
    >
      <div className="flex items-center gap-4 min-w-0 md:flex-1">
        <span
          className={cn('grid place-items-center flex-none size-16 rounded-md text-4xl font-bold leading-none', n > 0 ? 'bg-warning-700 text-white' : 'bg-surface-2 text-muted')}
          aria-label={`${n} ${n === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`}
        >
          {n}
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-lg font-bold leading-snug text-ink">Solicitudes de visita por autorizar</h2>
          {proxima ? (
            <p className="text-sm text-ink-2 wrap-anywhere">
              <strong className="text-ink">{nombreVisitante(proxima)}</strong> quiere visitar a {proxima.personaAVisitar} el{' '}
              <span className="whitespace-nowrap">
                {fechaCorta(proxima.fechaPropuesta)} · {horaPautada12(proxima.horaPropuesta)}
              </span>
              {n > 1 && `. Hay ${n - 1} ${n - 1 === 1 ? 'solicitud más' : 'solicitudes más'} por revisar.`}
            </p>
          ) : (
            <p className="text-sm text-muted">No hay solicitudes pendientes. Cuando una persona pida visitar a alguien, la verás aquí.</p>
          )}
        </div>
      </div>
      <span
        className={cn(
          'flex items-center justify-center gap-2 min-h-12 px-5 rounded-sm border text-sm font-bold md:flex-none',
          n > 0 ? 'bg-navy border-transparent text-white group-hover:bg-navy-700' : 'bg-blue-100 border-blue text-navy group-hover:bg-[#d6e8f8]',
        )}
      >
        <UserRoundPlus size={18} aria-hidden />
        {n > 0 ? 'Revisar solicitudes' : 'Ver solicitudes'}
        <ArrowRight size={16} aria-hidden />
      </span>
    </Link>
  )
}
