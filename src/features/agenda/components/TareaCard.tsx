/*
 * TareaCard.tsx — Tarjeta de una tarea de la agenda (Tarea_agenda): hora (o fecha y hora), título, adulto mayor,
 * cuidador y tipo de cuidado, prioridad, estado, indicación relacionada, situación de la evidencia (sin adjuntar ·
 * por validar · validada · rechazada, con el motivo) y las marcas "se repite" y "requiere evidencia". Toda la tarjeta
 * enlaza al detalle; las acciones rápidas (iniciar, completar, adjuntar…) las recibe de la pantalla según el permiso.
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Camera, ClipboardCheck, Pill, Repeat, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { EvidenciaDetallada } from '@/domain/api'
import { nombreCompleto } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import type { Adulto, IndicacionMedica, Tarea } from '@/domain/types'
import { cn } from '@/lib/cn'
import { cuandoTarea, ESTADO_TAREA, horaTarea, PRIORIDAD, rechazoVigente, situacionEvidencia, tareaAbierta, type InfoCuidador } from '../lib/agenda'

const BORDE = { alta: 'shadow-[inset_4px_0_0_#c0392b]', media: 'shadow-[inset_4px_0_0_#d4880a]', baja: 'shadow-[inset_4px_0_0_#14a085]' }

const TEXTO_EVIDENCIA = {
  sin_evidencia: { label: 'Falta evidencia', tono: 'warning' },
  pendiente: { label: 'Evidencia por validar', tono: 'info' },
  validada: { label: 'Evidencia validada', tono: 'success' },
  rechazada: { label: 'Evidencia rechazada', tono: 'danger' },
} as const

export function TareaCard({
  tarea,
  adulto,
  cuidador,
  indicacion,
  evidencias = [],
  porValidar = 0,
  soloHora,
  acciones,
  to,
}: {
  tarea: Tarea
  adulto?: Adulto
  cuidador?: InfoCuidador
  /** Solo si el usuario puede ver indicaciones médicas de este adulto. */
  indicacion?: IndicacionMedica
  /** Evidencias de la tarea (para mostrar su situación y, si se rechazó, el motivo). */
  evidencias?: EvidenciaDetallada[]
  /** Evidencias pendientes que el usuario puede validar. */
  porValidar?: number
  /** En la vista por día la fecha sobra: solo se muestra la hora. */
  soloHora?: boolean
  /** Botones de acción rápida (iniciar, completar…). Quedan fuera del enlace de la tarjeta. */
  acciones?: ReactNode
  to: string
}) {
  const vencida = tareaAbierta(tarea) && tarea.fechaProgramada < todayISO()
  const estado = ESTADO_TAREA[tarea.estado]
  const prioridad = PRIORIDAD[tarea.prioridad]
  const situacion = situacionEvidencia(evidencias)
  const rechazo = tarea.requiereEvidencia && tareaAbierta(tarea) ? rechazoVigente(evidencias) : undefined
  const ev = TEXTO_EVIDENCIA[situacion]
  return (
    <article className={cn('relative flex flex-col gap-3 p-4 rounded-sm border border-line bg-bg transition-shadow hover:shadow-1 focus-within:shadow-1', BORDE[tarea.prioridad])}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-bold leading-snug text-navy">{soloHora ? horaTarea(tarea.horaProgramada) : cuandoTarea(tarea)}</span>
        <span className="flex flex-wrap justify-end gap-1.5">
          {vencida ? <Badge tone="danger">Vencida</Badge> : <Badge tone={estado.tono}>{estado.label}</Badge>}
        </span>
      </div>

      <h3 className="text-lg font-bold leading-snug text-ink wrap-anywhere">
        <Link
          to={to}
          className="after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-3 focus-visible:after:outline-blue focus-visible:after:rounded-sm"
        >
          {tarea.titulo}
        </Link>
      </h3>

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
          <Badge tone={ev.tono}>
            <Camera size={11} strokeWidth={3} aria-hidden /> {ev.label}
          </Badge>
        )}
        {tarea.repetitiva && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2">
            <Repeat size={16} className="text-navy" aria-hidden /> Se repite
          </span>
        )}
        {porValidar > 0 && <Badge tone="warning">{porValidar === 1 ? '1 evidencia por validar' : `${porValidar} evidencias por validar`}</Badge>}
      </div>

      {rechazo && (
        <p className="p-2.5 rounded-sm bg-danger-100 border border-danger text-sm text-ink wrap-anywhere">
          <strong>Evidencia rechazada:</strong> {rechazo.motivoRechazo ?? 'adjunta una nueva evidencia.'}
        </p>
      )}

      {acciones ? (
        <div className="relative z-[1] flex flex-wrap gap-2 mt-auto [&>*]:flex-1 [&>*]:basis-36">{acciones}</div>
      ) : (
        <span className="mt-auto flex items-center justify-center gap-2 min-h-12 rounded-sm bg-blue-100 border border-blue text-navy text-sm font-bold" aria-hidden>
          Ver detalle <ArrowRight size={16} aria-hidden />
        </span>
      )}
    </article>
  )
}
