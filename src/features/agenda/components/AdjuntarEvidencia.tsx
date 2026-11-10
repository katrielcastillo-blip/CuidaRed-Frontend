/*
 * AdjuntarEvidencia.tsx — Bloque "Agregar evidencia" de una tarea: botones "Tomar foto" y "Elegir archivo" (JPG, PNG,
 * WEBP o PDF de hasta 5 MB, RS-013), vista previa del archivo ya preparado (las imágenes se reducen a ≤ 1600 px),
 * observación opcional y guardado. La evidencia nace en estado "por validar". Lo escrito en la observación no se
 * pierde si se cierra la pantalla (useBorrador). Requiere conexión.
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState } from 'react'
import { FileText, Upload, WifiOff, X } from 'lucide-react'
import { Button, TextareaField, useToast } from '@/components/ui'
import { MAX_OBSERVACION_EVIDENCIA, registrarEvidencia } from '@/domain/api'
import type { Tarea, Usuario } from '@/domain/types'
import { AdjuntarArchivo } from '@/features/visitas/components/AdjuntarArchivo'
import { esMiniatura, tamanoLegible, type EvidenciaProcesada } from '@/features/visitas/lib/evidencias'
import { useBorrador } from '@/lib/useBorrador'

export function AdjuntarEvidencia({ tarea, user, enLinea, restantes }: { tarea: Pick<Tarea, 'id' | 'requiereEvidencia'>; user: Usuario; enLinea: boolean; restantes: number }) {
  const toast = useToast()
  const [{ observacion }, setBorrador, descartar] = useBorrador(`evidencia:${tarea.id}:${user.id}`, { observacion: '' })
  const [archivo, setArchivo] = useState<EvidenciaProcesada | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [errores, setErrores] = useState<{ archivo?: string; observacion?: string }>({})

  const guardar = () => {
    if (!archivo) return
    const r = registrarEvidencia(user, tarea.id, archivo.archivo, observacion, { nombre: archivo.nombre, tipo: archivo.tipo, tamano: archivo.tamano })
    if (!r.ok) {
      setErrores((r.errores as typeof errores | undefined) ?? {})
      toast(r.error, 'error')
      return
    }
    descartar()
    setBorrador({ observacion: '' })
    setArchivo(null)
    setErrores({})
    toast(tarea.requiereEvidencia ? 'Evidencia guardada. Quedó por validar; la tarea se completará cuando la coordinación la valide.' : 'Evidencia guardada. Quedó por validar.', 'ok')
  }

  return (
    <div className="flex flex-col gap-4 p-4 rounded-sm bg-blue-100 border border-blue">
      <h3 className="flex items-center gap-2 text-base font-bold text-ink">
        <Upload size={20} className="text-navy" aria-hidden /> Agregar evidencia
      </h3>

      {archivo ? (
        <div className="flex items-center gap-3 p-2 rounded-sm bg-bg border border-line-soft">
          {esMiniatura(archivo.archivo) ? (
            <img src={archivo.archivo} alt="Vista previa de la evidencia" className="size-16 flex-none rounded-sm object-cover" />
          ) : (
            <span className="grid place-items-center size-16 flex-none rounded-sm bg-surface-2 text-navy" role="img" aria-label="Documento PDF">
              <FileText size={28} aria-hidden />
            </span>
          )}
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-semibold text-ink wrap-anywhere">{archivo.nombre}</span>
            <span className="text-xs text-muted">
              {archivo.tipo === 'application/pdf' ? 'PDF' : 'Imagen'} · {tamanoLegible(archivo.tamano)}
              {archivo.reducida && archivo.ancho && archivo.alto ? ` · reducida a ${archivo.ancho}×${archivo.alto} px (${tamanoLegible(archivo.reducida.size)})` : ''}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="flex-none px-3" onClick={() => setArchivo(null)} aria-label="Quitar archivo" icon={<X size={18} aria-hidden />}>
            Quitar
          </Button>
        </div>
      ) : (
        <AdjuntarArchivo
          restantes={restantes}
          disabled={!enLinea || restantes <= 0}
          motivoDeshabilitado={restantes <= 0 ? 'La tarea ya tiene el máximo de evidencias. Se liberan al rechazarse alguna.' : undefined}
          error={errores.archivo}
          onProcesando={setProcesando}
          onArchivos={([a]) => {
            if (a) {
              setArchivo(a)
              setErrores((x) => ({ ...x, archivo: undefined }))
            }
          }}
        />
      )}

      <TextareaField
        label="Observación"
        className="min-h-[96px] bg-bg"
        maxLength={MAX_OBSERVACION_EVIDENCIA}
        placeholder="Ej.: Tomó la tableta a las 8:05 a.m."
        value={observacion}
        onChange={(e) => {
          setBorrador({ observacion: e.target.value })
          setErrores((x) => ({ ...x, observacion: undefined }))
        }}
        error={errores.observacion}
        hint={`Opcional · ${observacion.length}/${MAX_OBSERVACION_EVIDENCIA}`}
        help="Describe brevemente lo que muestra la evidencia. La coordinación la revisará y la marcará como validada o rechazada."
      />

      {!enLinea && (
        <p role="status" className="flex items-start gap-2 text-sm text-ink">
          <WifiOff size={18} className="flex-none mt-0.5 text-warning-700" aria-hidden />
          Sin conexión: adjuntar una evidencia necesita internet. Inténtalo al recuperar la conexión.
        </p>
      )}
      <Button onClick={guardar} disabled={!enLinea || !archivo || procesando} icon={<Upload size={20} aria-hidden />}>
        Guardar evidencia
      </Button>
    </div>
  )
}
