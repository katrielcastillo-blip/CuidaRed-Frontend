/*
 * BandejaEvidencias.tsx — Bandeja "Evidencias por validar" (tabla Evidencias, estado pendiente): las más antiguas
 * primero. Cada evidencia muestra su tarea, el adulto y el cuidador y permite Validar o Rechazar (con motivo).
 * Solo se ofrece a quien tiene el permiso `evidencias:validar`.
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import type { EvidenciaDetallada, Resultado } from '@/domain/api'
import { nombreCompleto } from '@/domain/auth'
import type { Adulto, Tarea } from '@/domain/types'
import { cuandoTarea, type InfoCuidador } from '../lib/agenda'
import { EvidenciaItem } from './EvidenciaItem'

export function BandejaEvidencias({
  evidencias,
  tareas,
  adultoPorId,
  cuidadorPorId,
  nombreDe,
  base,
  enLinea,
  onValidar,
  onRechazar,
}: {
  /** Solo las pendientes de validar. */
  evidencias: EvidenciaDetallada[]
  tareas: Tarea[]
  adultoPorId: Map<string, Adulto>
  cuidadorPorId: Map<string, InfoCuidador>
  nombreDe: (usuarioId: string | undefined) => string
  base: string
  enLinea: boolean
  onValidar: (e: EvidenciaDetallada) => boolean
  onRechazar: (e: EvidenciaDetallada, motivo: string) => Resultado<unknown>
}) {
  if (evidencias.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 pt-4">
        <span className="grid place-items-center size-16 rounded-full bg-success-100 text-success-700">
          <CircleCheck size={32} aria-hidden />
        </span>
        <EmptyState title="No hay evidencias por validar" text="Cuando un cuidador adjunte una evidencia, aparecerá aquí para que la valides o la rechaces." />
      </div>
    )
  }
  const ordenadas = [...evidencias].sort((a, b) => a.fechaRegistro.localeCompare(b.fechaRegistro))
  return (
    <ul className="grid gap-3 md:grid-cols-2 m-0 p-0 list-none" aria-label="Evidencias por validar">
      {ordenadas.map((e) => {
        const t = tareas.find((x) => x.id === e.tareaId)
        const adulto = t ? adultoPorId.get(t.adultoId) : undefined
        const cuidador = t ? cuidadorPorId.get(t.cuidadorId) : undefined
        return (
          <EvidenciaItem
            key={e.id}
            evidencia={e}
            titulo={`Evidencia de «${t?.titulo ?? 'tarea'}»`}
            nombreDe={nombreDe}
            puedeValidar
            enLinea={enLinea}
            onValidar={onValidar}
            onRechazar={onRechazar}
            contexto={
              t && (
                <div className="flex flex-col gap-0.5 mb-1">
                  <Link to={`${base}/agenda/${t.id}`} className="inline-flex items-center min-h-12 -my-3 text-base font-bold leading-snug text-navy underline-offset-2 hover:underline wrap-anywhere">
                    {t.titulo}
                  </Link>
                  <span className="text-sm text-ink-2 wrap-anywhere">
                    {adulto ? nombreCompleto(adulto) : 'Adulto mayor'} · {cuidador?.nombre ?? 'Cuidador'}
                  </span>
                  <span className="text-xs text-muted">Tarea del {cuandoTarea(t).toLowerCase()}</span>
                </div>
              )
            }
          />
        )
      })}
    </ul>
  )
}
