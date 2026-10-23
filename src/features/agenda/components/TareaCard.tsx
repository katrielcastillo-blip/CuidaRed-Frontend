/*
 * TareaCard.tsx — Tarjeta de una tarea de la agenda (Tarea_agenda): título, adulto mayor, cuidador y tipo de
 * cuidado, fecha y hora programadas, prioridad, estado, indicación relacionada y marcas "requiere evidencia"
 * y "repetitiva". Enlaza al detalle de la tarea.
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, Camera, ClipboardCheck, Pill, Repeat, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import type { Adulto, IndicacionMedica, Tarea } from '@/domain/types'
import { cn } from '@/lib/cn'
import { cuandoTarea, ESTADO_TAREA, PRIORIDAD, tareaAbierta, type InfoCuidador } from '../lib/agenda'

const BORDE = { alta: 'shadow-[inset_4px_0_0_#c0392b]', media: 'shadow-[inset_4px_0_0_#d4880a]', baja: 'shadow-[inset_4px_0_0_#14a085]' }

export function TareaCard({
  tarea,
  adulto,
  cuidador,
  indicacion,
  porValidar = 0,
  to,
}: {
  tarea: Tarea
  adulto?: Adulto
  cuidador?: InfoCuidador
  /** Solo si el usuario puede ver indicaciones médicas de este adulto. */
  indicacion?: IndicacionMedica
  porValidar?: number
  to: string
}) {
  const vencida = tareaAbierta(tarea) && tarea.fechaProgramada < todayISO()
  const estado = ESTADO_TAREA[tarea.estado]
  const prioridad = PRIORIDAD[tarea.prioridad]
  return (
    <Link to={to} className={cn('group flex flex-col gap-3 p-4 rounded-sm border border-line bg-bg transition-shadow hover:shadow-1', BORDE[tarea.prioridad])}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-bold leading-snug text-navy">{cuandoTarea(tarea)}</span>
        <span className="flex flex-wrap justify-end gap-1.5">
          {vencida ? <Badge tone="danger">Vencida</Badge> : <Badge tone={estado.tono}>{estado.label}</Badge>}
        </span>
      </div>

      <h3 className="text-lg font-bold leading-snug text-ink wrap-anywhere">{tarea.titulo}</h3>

      <dl className="flex flex-col gap-1.5 text-sm text-ink-2">
        <div className="flex items-start gap-2">
          <dt className="sr-only">Adulto mayor</dt>
          <UserRound size={18} className="flex-none mt-px text-navy" aria-hidden />
          <dd className="min-w-0 wrap-anywhere font-semibold text-ink">{adulto ? nombreCompleto(adulto) : 'Adulto mayor'}</dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="sr-only">Cuidador</dt>
          <ClipboardCheck size={18} className="flex-none mt-px text-navy" aria-hidden />
          <dd className="min-w-0 wrap-anywhere">
            {cuidador ? (
              <>
                {cuidador.nombre} <span className="text-muted">· {cuidador.tipo}</span>
              </>
            ) : (
              'Cuidador no disponible'
            )}
          </dd>
        </div>
        {indicacion && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Indicación relacionada</dt>
            <Pill size={18} className="flex-none mt-px text-navy" aria-hidden />
            <dd className="min-w-0 wrap-anywhere">{indicacion.titulo}</dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={prioridad.tono}>{prioridad.label}</Badge>
        {tarea.requiereEvidencia && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2">
            <Camera size={16} className="text-navy" aria-hidden /> Requiere evidencia
          </span>
        )}
        {tarea.repetitiva && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2">
            <Repeat size={16} className="text-navy" aria-hidden /> Repetitiva (diaria)
          </span>
        )}
        {porValidar > 0 && <Badge tone="warning">{porValidar === 1 ? '1 evidencia por validar' : `${porValidar} evidencias por validar`}</Badge>}
      </div>

      <span className="mt-auto flex items-center justify-center gap-2 min-h-12 rounded-sm bg-blue-100 border border-blue text-navy text-sm font-bold group-hover:bg-[#d6e8f8]">
        Ver detalle <ArrowRight size={16} aria-hidden />
      </span>
    </Link>
  )
}
