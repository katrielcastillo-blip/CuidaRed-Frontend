/*
 * AdjuntarArchivo.tsx — Botones "Tomar foto" (cámara trasera) y "Elegir archivo" para adjuntar evidencias.
 * Valida cada archivo según RS-013 (JPG, PNG, WEBP o PDF de hasta 5 MB), reduce las imágenes en el cliente y avisa
 * con mensajes claros cuando un archivo no es válido. Lo usan el registro de visitas y las tareas de la agenda.
 * Módulo: visitas (compartido con agenda).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { Camera, CircleAlert, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui'
import { ACCEPT_EVIDENCIA, AYUDA_LIMITES_EVIDENCIA, prepararEvidencias, type EvidenciaProcesada } from '../lib/evidencias'

export function AdjuntarArchivo({
  onArchivos,
  onProcesando,
  multiple = false,
  restantes,
  disabled,
  motivoDeshabilitado,
  error,
  compacto,
}: {
  /** Recibe solo los archivos válidos, ya preparados. */
  onArchivos: (archivos: EvidenciaProcesada[]) => void
  /** Avisa cuando empieza y termina el procesamiento (para bloquear el envío del formulario). */
  onProcesando?: (procesando: boolean) => void
  /** Permite elegir varios archivos a la vez (solo con "Elegir archivo"). */
  multiple?: boolean
  /** Cuántos archivos más caben; los sobrantes se descartan con un aviso. */
  restantes?: number
  disabled?: boolean
  /** Por qué no se puede adjuntar (se muestra bajo los botones). */
  motivoDeshabilitado?: string
  /** Error externo (p. ej. del servicio) que se muestra junto a los botones. */
  error?: string
  /** Oculta el texto de límites bajo los botones (quien lo usa los explica en otro lugar, p. ej. en una ayuda "?"). */
  compacto?: boolean
}) {
  const idMensaje = useId()
  const camara = useRef<HTMLInputElement>(null)
  const archivo = useRef<HTMLInputElement>(null)
  const [procesando, setProcesando] = useState(false)
  const [errores, setErrores] = useState<string[]>([])

  const elegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setProcesando(true)
    onProcesando?.(true)
    try {
      const { validas, errores: malos } = await prepararEvidencias(files)
      const cupo = restantes ?? Infinity
      const aceptadas = validas.slice(0, cupo)
      if (validas.length > aceptadas.length) malos.push(`Solo caben ${cupo} archivo${cupo === 1 ? '' : 's'} más: se descartaron ${validas.length - aceptadas.length}.`)
      setErrores(malos)
      if (aceptadas.length > 0) onArchivos(aceptadas)
    } finally {
      setProcesando(false)
      onProcesando?.(false)
    }
  }

  const bloqueado = disabled || procesando
  const mensajes = error ? [error, ...errores] : errores

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="sm" disabled={bloqueado} loading={procesando} onClick={() => camara.current?.click()} icon={<Camera size={20} aria-hidden />}>
          Tomar foto
        </Button>
        <Button variant="outline" size="sm" disabled={bloqueado} onClick={() => archivo.current?.click()} icon={<Paperclip size={20} aria-hidden />}>
          Elegir archivo
        </Button>
      </div>
      <input ref={camara} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={elegir} />
      <input ref={archivo} type="file" accept={ACCEPT_EVIDENCIA} multiple={multiple} className="sr-only" tabIndex={-1} aria-hidden onChange={elegir} />

      <div id={idMensaje} aria-live="polite">
        {mensajes.length > 0 ? (
          <ul className="flex flex-col gap-1 m-0 p-0 list-none">
            {mensajes.map((m) => (
              <li key={m} className="flex items-start gap-1.5 text-sm text-danger" role="alert">
                <CircleAlert size={16} className="mt-0.5 flex-none" aria-hidden />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        ) : procesando ? (
          <p className="text-sm text-muted">Procesando la imagen…</p>
        ) : motivoDeshabilitado ? (
          <p className="text-sm font-semibold text-warning-700">{motivoDeshabilitado}</p>
        ) : compacto ? null : (
          <p className="text-sm text-muted">{AYUDA_LIMITES_EVIDENCIA}</p>
        )}
      </div>
    </div>
  )
}
