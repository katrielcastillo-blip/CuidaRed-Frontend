/*
 * RechazarForm.tsx — No autorizar una solicitud de visita: el motivo es obligatorio y lo verá el visitante al
 * consultar su código de seguimiento. Usa el servicio rechazarSolicitud (comprueba visitas:autorizar y audita).
 * Requiere conexión. El borrador se conserva si se cierra la pantalla (SRS §8.2.2.1.22).
 * Módulo: coordinador · solicitudes de visita.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Ban, WifiOff } from 'lucide-react'
import { AvisoBorrador, Button, TextareaField, useFormulario, useToast } from '@/components/ui'
import { rechazarSolicitud } from '@/domain/api/solicitudes'
import { useEnLinea } from '@/domain/conectividad'
import type { SolicitudVisita, Usuario } from '@/domain/types'
import { errorTexto } from '@/domain/validacion'

const MAX_MOTIVO = 300

export function RechazarForm({
  solicitud: s,
  user,
  onCancelar,
  onRechazada,
}: {
  solicitud: SolicitudVisita
  user: Usuario
  onCancelar: () => void
  /** Se llama tras rechazar, para mostrar el mensaje de éxito. */
  onRechazada: () => void
}) {
  const toast = useToast()
  const enLinea = useEnLinea()

  const f = useFormulario<{ motivo: string }>({
    clave: `solicitud-rechazar:${user.id}:${s.id}`,
    inicial: { motivo: '' },
    reglas: { motivo: (v) => errorTexto(v, 'el motivo', 3, MAX_MOTIVO) },
  })

  const enviar = f.enviar((v) => {
    const r = rechazarSolicitud(user, s.id, v.motivo)
    if (!r.ok) {
      if (!r.errores) toast(r.error, 'error')
      return r
    }
    onRechazada()
    return r
  })

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <AvisoBorrador formulario={f} />

      {!enLinea && (
        <div role="status" className="flex items-start gap-3 p-4 rounded-sm bg-warning-100 border border-warning text-sm text-ink">
          <WifiOff size={20} className="flex-none mt-0.5 text-warning-700" aria-hidden />
          <p>
            <strong>Sin conexión.</strong> Responder una solicitud necesita internet para avisar al visitante. Lo que escribiste se conserva.
          </p>
        </div>
      )}

      <TextareaField
        label="Motivo para el visitante"
        required
        maxLength={MAX_MOTIVO}
        placeholder="Ej.: Por ahora no recibimos visitas externas en esa fecha. Puedes enviar una nueva solicitud para la semana próxima."
        help="El visitante verá este mensaje al consultar su solicitud con el código de seguimiento. No incluyas datos de salud ni información privada del adulto mayor."
        hint={`${f.valores.motivo.length}/${MAX_MOTIVO}. Lo verá el visitante.`}
        {...f.campo('motivo')}
      />

      <div className="flex flex-col gap-3">
        <Button type="submit" variant="danger" fullWidth loading={f.enviando} disabled={!enLinea} icon={<Ban size={22} aria-hidden />}>
          No autorizar la visita
        </Button>
        <Button variant="outline" fullWidth onClick={onCancelar} disabled={f.enviando}>
          Cancelar
        </Button>
        {!enLinea && <p className="text-sm text-muted text-center">Botón deshabilitado: necesitas conexión a internet.</p>}
      </div>
    </form>
  )
}
