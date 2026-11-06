/*
 * AutorizarForm.tsx — Autorizar una solicitud de visita: quien autoriza ve lo que escribió el visitante, confirma
 * el adulto mayor entre los activos de la cuenta y ajusta fecha y hora (prellenadas con lo propuesto). Usa el
 * servicio autorizarSolicitud (comprueba visitas:autorizar y crea la visita programada con el visitante).
 * Requiere conexión. El borrador se conserva si se cierra la pantalla (SRS §8.2.2.1.22).
 * Módulo: coordinador · solicitudes de visita.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { CircleCheck, MessageSquareQuote, WifiOff } from 'lucide-react'
import { AvisoBorrador, Button, RiesgoBadge, SelectField, TextField, requerido, useFormulario, useToast } from '@/components/ui'
import { autorizarSolicitud } from '@/domain/api/solicitudes'
import { nombreCompleto } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { todayISO } from '@/domain/dates'
import type { Adulto, SolicitudVisita, Usuario } from '@/domain/types'
import { coincideConTexto } from '../lib/solicitudes'

interface Datos {
  adultoId: string
  fecha: string
  hora: string
}

export function AutorizarForm({
  solicitud: s,
  user,
  adultos,
  onCancelar,
  onAutorizada,
}: {
  solicitud: SolicitudVisita
  user: Usuario
  /** Adultos activos de la cuenta entre los que confirmar la visita. */
  adultos: Adulto[]
  onCancelar: () => void
  /** Se llama tras autorizar, con el adulto confirmado, para mostrar el mensaje de éxito. */
  onAutorizada: (adulto: Adulto) => void
}) {
  const toast = useToast()
  const enLinea = useEnLinea()
  const hoy = todayISO()
  const propuestaVencida = s.fechaPropuesta < hoy

  const f = useFormulario<Datos>({
    clave: `solicitud-autorizar:${user.id}:${s.id}`,
    // Prellenado con lo propuesto por el visitante (si esa fecha ya pasó, se parte de hoy).
    inicial: { adultoId: '', fecha: propuestaVencida ? hoy : s.fechaPropuesta, hora: s.horaPropuesta },
    campos: ['adultoId', 'fecha', 'hora'],
    reglas: {
      adultoId: requerido('Confirma a qué adulto mayor corresponde la visita.'),
      fecha: (v) => (!v ? 'Indica la fecha.' : v < hoy ? 'La fecha no puede ser anterior a hoy.' : undefined),
      hora: requerido('Indica la hora.'),
    },
  })

  // Los adultos que coinciden con lo escrito por el visitante van primero (solo es una sugerencia).
  const opciones = useMemo(() => {
    const coinciden = new Set(adultos.filter((a) => coincideConTexto(a, s.personaAVisitar)).map((a) => a.id))
    return [...adultos]
      .sort((a, b) => Number(coinciden.has(b.id)) - Number(coinciden.has(a.id)))
      .map((a) => ({ value: a.id, label: coinciden.has(a.id) ? `${nombreCompleto(a)} · coincide con lo escrito` : nombreCompleto(a) }))
  }, [adultos, s.personaAVisitar])

  const elegido = adultos.find((a) => a.id === f.valores.adultoId)

  const enviar = f.enviar((v) => {
    const r = autorizarSolicitud(user, s.id, v)
    if (!r.ok) {
      if (!r.errores) toast(r.error, 'error')
      return r
    }
    if (elegido) onAutorizada(elegido)
    return r
  })

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <AvisoBorrador formulario={f} />

      {!enLinea && (
        <div role="status" className="flex items-start gap-3 p-4 rounded-sm bg-warning-100 border border-warning text-sm text-ink">
          <WifiOff size={20} className="flex-none mt-0.5 text-warning-700" aria-hidden />
          <p>
            <strong>Sin conexión.</strong> Autorizar una visita necesita internet para avisar al visitante. Lo que escribiste se conserva.
          </p>
        </div>
      )}

      <figure className="flex items-start gap-3 m-0 p-4 rounded-sm bg-blue-100 border border-blue">
        <MessageSquareQuote size={22} className="flex-none mt-0.5 text-navy" aria-hidden />
        <figcaption className="flex flex-col gap-1 min-w-0 text-sm text-ink-2">
          <span className="font-semibold text-navy">El visitante escribió que quiere visitar a:</span>
          <q className="text-base font-bold text-ink wrap-anywhere">{s.personaAVisitar}</q>
        </figcaption>
      </figure>

      <SelectField
        label="Adulto mayor a visitar"
        required
        placeholder="Selecciona el adulto mayor"
        options={opciones}
        help="La persona escribió un nombre libre y no ve perfiles. Aquí confirmas con quién se corresponde en tu lista de adultos activos."
        hint={adultos.length === 0 ? 'No hay adultos activos en la cuenta.' : undefined}
        {...f.campo('adultoId')}
      />
      {elegido && (
        <p className="flex flex-wrap items-center gap-2 -mt-2 text-sm text-muted">
          <RiesgoBadge riesgo={elegido.riesgo} />
          <span>{elegido.zona}</span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
        <TextField
          label="Fecha"
          type="date"
          required
          min={hoy}
          hint={propuestaVencida ? 'La fecha propuesta ya pasó.' : 'Propuesta por el visitante.'}
          {...f.campo('fecha')}
        />
        <TextField label="Hora" type="time" required hint="Propuesta por el visitante." {...f.campo('hora')} />
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" fullWidth loading={f.enviando} disabled={!enLinea || adultos.length === 0} icon={<CircleCheck size={22} aria-hidden />}>
          Autorizar visita
        </Button>
        <Button variant="outline" fullWidth onClick={onCancelar} disabled={f.enviando}>
          Cancelar
        </Button>
        {!enLinea ? (
          <p className="text-sm text-muted text-center">Botón deshabilitado: necesitas conexión a internet.</p>
        ) : (
          <p className="text-sm text-muted text-center">Se programa la visita y el visitante verá el resultado con su código de seguimiento.</p>
        )}
      </div>
    </form>
  )
}
