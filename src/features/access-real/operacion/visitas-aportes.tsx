/* Observaciones y fotografías del visitante, separadas del informe del equipo. © 2026 Equipo CuidaRed – INTEC. */
import { FileImage, MessageSquareText } from '@/components/icons'
import { Estado, useDatos } from './controles'
type Foto = { evidencia_id: string; nombre_archivo: string; url_descarga: string; fecha: string }
export function AportesVisitante({
  ruta,
  token,
  revision,
  observacion,
}: {
  ruta: string
  token: string
  revision: number
  observacion?: string | null
}) {
  const fotos = useDatos<Foto[]>(ruta + '/evidencias-visitante', token, revision)
  return (
    <section
      className="grid gap-3 rounded-md border border-line-soft bg-surface p-4"
      aria-label="Aportes del visitante"
    >
      <h3 className="flex items-center gap-2 font-semibold text-navy">
        <MessageSquareText size={19} aria-hidden />
        Observaciones del visitante
      </h3>
      <p className="whitespace-pre-wrap break-words text-sm text-ink-2">
        {observacion || 'El visitante todavía no ha agregado observaciones.'}
      </p>
      <Estado consulta={fotos} />
      {!!fotos.datos?.length && (
        <ul className="grid gap-2">
          {fotos.datos.map((f) => (
            <li key={f.evidencia_id}>
              <a
                className="flex min-h-12 items-center gap-2 rounded-sm border border-line-soft px-3 text-sm font-semibold text-navy underline underline-offset-4"
                href={f.url_descarga}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileImage size={19} aria-hidden />
                {f.nombre_archivo}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        Aportes externos. No sustituyen el registro de cuidado ni la confirmación de la organización.
      </p>
    </section>
  )
}
