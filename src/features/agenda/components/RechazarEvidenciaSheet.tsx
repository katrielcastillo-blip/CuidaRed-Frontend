/*
 * RechazarEvidenciaSheet.tsx — Panel para rechazar una evidencia: el motivo es obligatorio (el cuidador lo ve y lo
 * recibe como notificación para saber qué corregir). El error se muestra junto al campo y lo escrito no se pierde.
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState } from 'react'
import { WifiOff } from 'lucide-react'
import { Button, Sheet, TextareaField } from '@/components/ui'
import { MAX_MOTIVO_RECHAZO, type Resultado } from '@/domain/api'

const MIN_MOTIVO = 5

export function RechazarEvidenciaSheet({
  open,
  onClose,
  onConfirmar,
  enLinea,
}: {
  open: boolean
  onClose: () => void
  /** Rechaza con el motivo; si el servicio lo rechaza, el error aparece en el campo. */
  onConfirmar: (motivo: string) => Resultado<unknown>
  enLinea: boolean
}) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string>()

  const cerrar = () => {
    setError(undefined)
    onClose()
  }

  const confirmar = () => {
    if (motivo.trim().length < MIN_MOTIVO) {
      setError(`Indica el motivo del rechazo (mínimo ${MIN_MOTIVO} caracteres) para que el cuidador sepa qué corregir.`)
      return
    }
    const r = onConfirmar(motivo)
    if (r.ok) {
      setMotivo('')
      cerrar()
    } else setError(r.errores?.motivo ?? r.error)
  }

  return (
    <Sheet
      open={open}
      onClose={cerrar}
      title="Rechazar evidencia"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={cerrar}>
            Volver
          </Button>
          <Button variant="danger" size="sm" disabled={!enLinea} onClick={confirmar}>
            Rechazar evidencia
          </Button>
        </>
      }
    >
      <TextareaField
        label="Motivo del rechazo"
        required
        maxLength={MAX_MOTIVO_RECHAZO}
        className="min-h-[104px]"
        placeholder="Ej.: La foto salió borrosa; vuelve a tomarla con buena luz."
        value={motivo}
        onChange={(e) => {
          setMotivo(e.target.value)
          setError(undefined)
        }}
        error={error}
        hint={`${motivo.length}/${MAX_MOTIVO_RECHAZO}`}
        help="El cuidador recibe este motivo en una notificación y lo ve en la tarea, que vuelve a pendiente hasta que adjunte otra evidencia."
      />
      {!enLinea && (
        <p role="status" className="flex items-start gap-2 text-sm text-ink">
          <WifiOff size={18} className="flex-none mt-0.5 text-warning-700" aria-hidden />
          Sin conexión: rechazar una evidencia necesita internet.
        </p>
      )}
    </Sheet>
  )
}
