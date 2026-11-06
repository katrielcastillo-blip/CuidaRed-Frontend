/*
 * TareasDeHoy.tsx — Tareas de hoy de la agenda del cuidador (Tarea_agenda): hora, título, adulto, prioridad,
 * «requiere evidencia» y estado, con enlace al detalle de cada tarea y a la agenda completa.
 * Módulo: cuidador (RF-08 · agenda de cuidado).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { Camera, CircleCheck, ListTodo } from 'lucide-react'
import { nombreCompleto } from '@/domain/auth'
import { hhmmA12 } from '@/domain/dates'
import type { Adulto, EstadoTarea, Tarea } from '@/domain/types'
import { Badge, type Tone } from '@/components/ui'
import { cn } from '@/lib/cn'
import { prioridad } from '@/features/visitas/lib/dominio'

const ESTADO_TAREA: Record<EstadoTarea, { label: string; tone: Tone }> = {
  pendiente: { label: 'Pendiente', tone: 'warning' },
  en_curso: { label: 'En curso', tone: 'info' },
  completada: { label: 'Completada', tone: 'success' },
  cancelada: { label: 'Cancelada', tone: 'neutral' },
}

export function TareasDeHoy({ tareas, adultoDe, base }: { tareas: Tarea[]; adultoDe: (id: string) => Adulto | undefined; base: string }) {
  const hechas = tareas.filter((t) => t.estado === 'completada').length
  return (
    <section className="flex flex-col gap-3" aria-labelledby="tareas-titulo">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title" id="tareas-titulo">
          Tareas del día{' '}
          {tareas.length > 0 && (
            <span className="text-base font-semibold text-muted">
              ({hechas} de {tareas.length})
            </span>
          )}
        </h2>
        <Link to={`${base}/agenda`} className="inline-flex items-center min-h-12 px-2 text-sm font-semibold text-navy underline underline-offset-4">
          Ver agenda
        </Link>
      </div>
      {tareas.length > 0 ? (
        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {tareas.map((t) => {
            const adulto = adultoDe(t.adultoId)
            const hecha = t.estado === 'completada'
            const est = ESTADO_TAREA[t.estado]
            const prio = prioridad(t.prioridad)
            return (
              <li key={t.id}>
                <Link
                  to={`${base}/agenda/${t.id}`}
                  className={cn('flex flex-col gap-1.5 min-h-12 p-3 rounded-sm border bg-bg transition-shadow hover:shadow-1', hecha ? 'border-line-soft' : 'border-line')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-navy">{hhmmA12(t.horaProgramada)}</span>
                    <Badge tone={est.tone}>
                      {hecha && <CircleCheck size={11} strokeWidth={3} aria-hidden />}
                      {est.label}
                    </Badge>
                  </span>
                  <span className={cn('font-semibold wrap-anywhere', hecha ? 'text-muted line-through' : 'text-ink')}>{t.titulo}</span>
                  <span className="text-sm text-ink-2 wrap-anywhere">{adulto ? nombreCompleto(adulto) : 'Adulto mayor'}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge tone={prio.tone}>Prioridad {prio.label.toLowerCase()}</Badge>
                    {t.requiereEvidencia && (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                        <Camera size={13} aria-hidden /> Requiere evidencia
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <ListTodo size={18} aria-hidden /> No tienes tareas programadas para hoy.
        </p>
      )}
    </section>
  )
}
