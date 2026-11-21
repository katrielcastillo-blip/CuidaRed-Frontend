/*
 * IndicacionesLista.tsx — Indicaciones médicas vigentes del envejeciente, de solo lectura (permiso
 * `indicaciones:ver`): tipo, título, descripción, frecuencia u horario, vigencia y documento de respaldo. Siempre
 * va acompañada del aviso "información transcrita, no sustituye al médico". Sin acciones de edición.
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { CalendarRange, Clock, Info, Paperclip, Pill } from 'lucide-react'
import { Badge, EmptyState } from '@/components/ui'
import { AVISO_INDICACIONES, ESTADO_INDICACION, vigenciaTexto } from '../lib/etiquetas'
import type { IndicacionVista } from '../lib/modelos'

export function IndicacionesLista({ indicaciones }: { indicaciones: IndicacionVista[] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 p-3 rounded-sm bg-blue-100 border border-blue text-sm text-ink">
        <Info size={18} className="flex-none mt-0.5 text-navy" aria-hidden />
        <span>{AVISO_INDICACIONES}</span>
      </p>
      {indicaciones.length === 0 ? (
        <EmptyState title="Sin indicaciones vigentes" text="No hay indicaciones médicas vigentes registradas." />
      ) : (
        <ul className="grid-auto m-0 p-0 list-none">
          {indicaciones.map((i) => (
            <li key={i.id} className="flex gap-3 p-4 rounded-sm border border-line bg-bg">
              <Pill size={22} className="flex-none mt-0.5 text-blue" aria-hidden />
              <div className="flex flex-col flex-1 min-w-0 gap-1.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-2">{i.tipo}</span>
                    <strong className="text-base text-ink wrap-anywhere">{i.titulo}</strong>
                  </div>
                  <Badge tone={ESTADO_INDICACION[i.estado].tono}>{ESTADO_INDICACION[i.estado].label}</Badge>
                </div>
                <p className="text-sm text-ink-2 wrap-anywhere">{i.descripcion}</p>
                <p className="flex flex-col gap-1 text-sm text-ink-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={15} className="flex-none" aria-hidden /> {i.frecuenciaHorario}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarRange size={15} className="flex-none" aria-hidden /> {vigenciaTexto(i)}
                  </span>
                  {i.respaldo && (
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <Paperclip size={15} className="flex-none" aria-hidden /> <span className="wrap-anywhere">Respaldo: {i.respaldo}</span>
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
