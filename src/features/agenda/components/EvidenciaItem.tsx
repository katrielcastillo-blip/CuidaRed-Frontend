/*
 * EvidenciaItem.tsx — Una evidencia de una tarea (tabla Evidencias): miniatura (que se amplía al tocarla) o ícono de
 * documento, estado de validación (pendiente · validada · rechazada), fecha, observación, quién la registró, quién y
 * cuándo la revisó y, si fue rechazada, el motivo. Con permiso `evidencias:validar` muestra Validar y Rechazar
 * (el rechazo pide su motivo en un panel).
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState, type ReactNode } from 'react'
import { CircleCheck, CircleX, FileText, Maximize2, MessageSquareWarning } from 'lucide-react'
import { Badge, Button, Sheet } from '@/components/ui'
import type { EvidenciaDetallada, Resultado } from '@/domain/api'
import { esMiniatura, tamanoLegible } from '@/features/visitas/lib/evidencias'
import { ESTADO_EVIDENCIA, fechaHoraBreve } from '../lib/agenda'
import { RechazarEvidenciaSheet } from './RechazarEvidenciaSheet'

export function EvidenciaItem({
  evidencia: e,
  titulo,
  nombreDe,
  puedeValidar,
  enLinea,
  onValidar,
  onRechazar,
  contexto,
}: {
  evidencia: EvidenciaDetallada
  /** Texto alternativo de la miniatura, p. ej. "Evidencia 2". */
  titulo: string
  nombreDe: (usuarioId: string | undefined) => string
  /** El usuario tiene `evidencias:validar` sobre el adulto de la tarea. */
  puedeValidar: boolean
  enLinea: boolean
  onValidar: (e: EvidenciaDetallada) => boolean
  onRechazar: (e: EvidenciaDetallada, motivo: string) => Resultado<unknown>
  /** Contenido extra sobre los datos (en la bandeja: tarea, adulto y cuidador). */
  contexto?: ReactNode
}) {
  const [ampliada, setAmpliada] = useState(false)
  const [rechazando, setRechazando] = useState(false)
  const est = ESTADO_EVIDENCIA[e.estadoValidacion]
  const imagen = esMiniatura(e.archivo)
  const nombre = e.nombreArchivo ?? (imagen ? undefined : e.archivo)
  const detalles = [nombre, e.tamano ? tamanoLegible(e.tamano) : undefined].filter(Boolean).join(' · ')

  return (
    <li className="flex flex-col gap-3 p-3 rounded-sm border border-line bg-bg">
      <div className="flex items-start gap-3">
        {imagen ? (
          <button
            type="button"
            onClick={() => setAmpliada(true)}
            className="group relative flex-none size-20 rounded-sm overflow-hidden border border-line-soft"
            aria-label={`Ampliar ${titulo.toLowerCase()}`}
          >
            <img src={e.archivo} alt={`${titulo}: ${e.observacion ?? 'foto adjunta'}`} className="size-full object-cover" />
            <span className="absolute bottom-0.5 right-0.5 grid place-items-center size-6 rounded-full bg-navy/80 text-white" aria-hidden>
              <Maximize2 size={13} />
            </span>
          </button>
        ) : (
          <span className="grid place-items-center size-20 flex-none rounded-sm bg-surface-2 text-navy" role="img" aria-label="Documento PDF">
            <FileText size={32} aria-hidden />
          </span>
        )}
        <div className="flex flex-col flex-1 min-w-0 gap-1">
          {contexto}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={est.tono}>{est.label}</Badge>
            <span className="text-xs text-muted">{fechaHoraBreve(e.fechaRegistro)}</span>
          </div>
          {detalles && <span className="text-sm font-semibold text-ink wrap-anywhere">{detalles}</span>}
          <p className="text-sm text-ink-2 wrap-anywhere">{e.observacion || <span className="text-muted">Sin observación.</span>}</p>
          <p className="text-xs text-muted">
            Adjuntada por {nombreDe(e.registradaPor)}
            {e.validadaPor && ` · ${e.estadoValidacion === 'rechazada' ? 'Rechazada' : 'Validada'} por ${nombreDe(e.validadaPor)}${e.validadaEn ? ` el ${fechaHoraBreve(e.validadaEn)}` : ''}`}
          </p>
        </div>
      </div>

      {e.estadoValidacion === 'rechazada' && (
        <p className="flex items-start gap-2 p-3 rounded-sm bg-danger-100 border border-danger text-sm text-ink" role="status">
          <MessageSquareWarning size={18} className="flex-none mt-0.5 text-danger" aria-hidden />
          <span className="wrap-anywhere">
            <strong>Motivo del rechazo:</strong> {e.motivoRechazo ?? 'No se indicó el motivo.'}
          </span>
        </p>
      )}

      {puedeValidar && e.estadoValidacion === 'pendiente' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button variant="soft" size="sm" className="flex-1 text-base" disabled={!enLinea} onClick={() => onValidar(e)} icon={<CircleCheck size={18} aria-hidden />}>
              Validar
            </Button>
            <Button variant="danger-soft" size="sm" className="flex-1 text-base" disabled={!enLinea} onClick={() => setRechazando(true)} icon={<CircleX size={18} aria-hidden />}>
              Rechazar
            </Button>
          </div>
          {!enLinea && <p className="text-xs text-muted">Sin conexión: validar o rechazar necesita internet.</p>}
        </div>
      )}

      <Sheet open={ampliada} onClose={() => setAmpliada(false)} title={titulo}>
        <img src={e.archivo} alt={`${titulo}: ${e.observacion ?? 'foto adjunta'}`} className="w-full max-h-[60vh] object-contain rounded-sm bg-surface-2" />
        {e.observacion && <p className="text-sm text-ink-2 wrap-anywhere">{e.observacion}</p>}
      </Sheet>
      <RechazarEvidenciaSheet open={rechazando} onClose={() => setRechazando(false)} enLinea={enLinea} onConfirmar={(motivo) => onRechazar(e, motivo)} />
    </li>
  )
}
