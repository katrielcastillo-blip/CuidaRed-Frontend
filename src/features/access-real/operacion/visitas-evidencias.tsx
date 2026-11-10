/*
 * Evidencias privadas de visitas y tareas conectadas · RF-02, RF-16, RS-013.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useId, useState } from 'react'
import { ExternalLink, FileText, Paperclip } from 'lucide-react'
import { Badge, Button, Card, IconTile, TextareaField, type Tone } from '@/components/ui'
import { api, getClient } from '../client'
import { campo, Estado, Formulario, useConexionReal, useDatos } from './controles'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024
const ESTADOS: Record<string, { texto: string; tono: Tone }> = {
  pendiente: { texto: 'Por validar', tono: 'warning' },
  validada: { texto: 'Validada', tono: 'success' },
  rechazada: { texto: 'Rechazada', tono: 'danger' },
}

interface Evidencia {
  evidencia_id: string
  nombre_archivo: string | null
  estado_validacion?: string
  motivo_rechazo?: string | null
  observacion?: string | null
  es_historica?: boolean
  url_descarga: string | null
}

export function Evidencias({ ruta, token, puedeAdjuntar, tarea = false, validar, revision, refrescar }: {
  ruta: string
  token: string
  puedeAdjuntar: boolean
  tarea?: boolean
  validar?: (id: string, aceptar: boolean, motivo?: string) => Promise<void>
  revision: number
  refrescar: () => void
}) {
  const enLinea = useConexionReal()
  const consulta = useDatos<Evidencia[]>(`${ruta}/evidencias`, token, revision)
  const [mostrarCarga, setMostrarCarga] = useState(false)
  const [rechazar, setRechazar] = useState<string>()
  const idArchivo = useId()
  const adjuntar = async (datos: FormData) => {
    const archivo = datos.get('archivo')
    if (!(archivo instanceof File) || archivo.size < 1 || archivo.size > MAX_BYTES || !TIPOS.includes(archivo.type)) {
      throw new Error('Elige un archivo JPG, PNG, WebP o PDF de hasta 5 MB.')
    }
    const meta = { nombre_archivo: archivo.name, tipo_mime: archivo.type, tamano_bytes: archivo.size }
    const destino = await api<{ ruta: string; bucket: string; token?: string }>(`${ruta}/evidencias/subida`, token, 'POST', meta)
    const storage = getClient().storage.from(destino.bucket)
    const opciones = { contentType: archivo.type, upsert: false }
    const subida = tarea && destino.token
      ? await storage.uploadToSignedUrl(destino.ruta, destino.token, archivo, opciones)
      : await storage.upload(destino.ruta, archivo, opciones)
    if (subida.error) throw new Error('No se pudo subir el archivo. Comprueba tu conexión e intenta otra vez.')
    const observacion = tarea ? campo(datos, 'observacion') : ''
    await api(`${ruta}/evidencias`, token, 'POST', { ...meta, ruta: destino.ruta, ...(observacion ? { observacion } : {}) })
    setMostrarCarga(false)
    refrescar()
  }
  return (
    <section className="grid gap-3" aria-label="Evidencias privadas">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">Evidencias</h3>
        {puedeAdjuntar && !mostrarCarga && (
          <Button variant="outline" size="sm" icon={<Paperclip size={18} aria-hidden />} disabled={!enLinea} onClick={() => setMostrarCarga(true)}>
            Adjuntar evidencia
          </Button>
        )}
      </div>
      {puedeAdjuntar && !enLinea && <p className="text-sm text-ink-2">Conéctate a internet para adjuntar archivos.</p>}
      {puedeAdjuntar && mostrarCarga && (
        <Formulario titulo="Adjuntar evidencia privada" campos={[]} accion="Adjuntar archivo" enviar={adjuntar} disabled={!enLinea}
          cancelar={() => setMostrarCarga(false)}>
          <div className="grid gap-3 md:col-span-2">
            <label className="grid gap-1 text-sm font-semibold" htmlFor={idArchivo}>
              Archivo
              <input id={idArchivo} name="archivo" type="file" accept={TIPOS.join(',')} required aria-describedby={`${idArchivo}-ayuda`}
                className="min-h-12 w-full min-w-0 rounded-sm border border-line bg-bg p-2 text-sm file:mr-2 file:rounded-sm file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:font-semibold file:text-navy" />
            </label>
            <p id={`${idArchivo}-ayuda`} className="text-sm text-muted">JPG, PNG, WebP o PDF. Máximo 5 MB por archivo.</p>
            {tarea && <TextareaField label="Observación (opcional)" name="observacion" maxLength={300} rows={3} />}
          </div>
        </Formulario>
      )}
      <Estado consulta={consulta} vacio={consulta.datos?.length === 0 ? 'Aún no hay evidencias adjuntas.' : undefined} />
      {!!consulta.datos?.length && <ul className="grid gap-2">
        {consulta.datos.map((archivo) => {
          const estado = ESTADOS[archivo.estado_validacion ?? '']
          const puedeValidar = validar && !archivo.es_historica && archivo.estado_validacion === 'pendiente'
          return <li key={archivo.evidencia_id}>
            <Card className="grid gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <IconTile size={40}><FileText size={20} aria-hidden /></IconTile>
                <p className="min-w-0 flex-1 font-semibold wrap-anywhere">{archivo.nombre_archivo || 'Evidencia histórica'}</p>
                {estado && <Badge tone={estado.tono}>{estado.texto}</Badge>}
              </div>
              {archivo.observacion && <p className="text-sm text-ink-2 whitespace-pre-line">{archivo.observacion}</p>}
              {archivo.motivo_rechazo && <p className="text-sm text-danger-700">Motivo de rechazo: {archivo.motivo_rechazo}</p>}
              {archivo.url_descarga
                ? <a href={archivo.url_descarga} rel="noreferrer" target="_blank" className="inline-flex min-h-12 items-center gap-2 self-start text-sm font-semibold text-navy underline underline-offset-4">
                    Abrir archivo privado <ExternalLink size={16} aria-hidden />
                  </a>
                : <p className="text-sm text-muted">{archivo.es_historica ? 'Archivo histórico disponible para consulta de sus datos.' : 'El archivo no está disponible para abrir.'}</p>}
              {puedeValidar && <>
                <Formulario titulo="Revisar evidencia" campos={[]} accion="Validar" disabled={!enLinea}
                  enviar={() => validar(archivo.evidencia_id, true)}>
                  <Button variant="danger-soft" size="sm" disabled={!enLinea} onClick={() => setRechazar(archivo.evidencia_id)}>Rechazar evidencia</Button>
                </Formulario>
                {rechazar === archivo.evidencia_id && <Formulario titulo="Motivo de rechazo" accion="Confirmar rechazo" disabled={!enLinea}
                  cancelar={() => setRechazar(undefined)}
                  campos={[{ name: 'motivo', label: 'Motivo', type: 'textarea', min: 5, max: 200 }]}
                  enviar={async (datos) => {
                    const motivo = campo(datos, 'motivo')
                    if (motivo.length < 5) throw new Error('Describe el motivo con al menos 5 caracteres.')
                    await validar(archivo.evidencia_id, false, motivo)
                    setRechazar(undefined)
                  }} />}
              </>}
            </Card>
          </li>
        })}
      </ul>}
    </section>
  )
}
