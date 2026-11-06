/*
 * ConsultarSolicitud.tsx — "/solicitud-visita": "Consultar mi solicitud". Con el código de seguimiento, el visitante
 * ve el estado de su solicitud de visita y, cuando corresponde (visita autorizada y llegado el día), deja su
 * observación. Página pública, sin sesión.
 * Módulo: auth (Reglas de Negocio V2 §Usuario y §Visita · feedback de PM sobre LOGIN SCREEN).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Privacidad: la consulta solo devuelve el estado, la organización, la fecha/hora y, si aplica, el motivo de
 * rechazo o la observación del propio visitante. Nunca se muestran datos de adultos mayores ni del personal.
 * Prototipo: se ofrece el código de demostración VIS-DEMO-2026 (se quita al integrar el backend).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { CalendarClock, ShieldCheck } from 'lucide-react'
import { Badge, Button, TextareaField, TextField, useToast, type Tone } from '@/components/ui'
import { consultarSolicitud, registrarObservacionVisitante, type EstadoPublicoSolicitud } from '@/domain/api/solicitudes'
import { useEnLinea } from '@/domain/conectividad'
import { fechaLarga, hhmmA12 } from '@/domain/dates'
import { AuthScreen } from '../components/AuthScreen'
import { LogoBadge } from '../components/LogoBadge'
import { Acciones, Aviso, Lead } from '../components/Piezas'
import { errorCodigoSeguimiento, normalizarCodigoEscrito } from '../lib/solicitudVisita'
import { errorTexto } from '../lib/validar'

const CODIGO_DEMO = 'VIS-DEMO-2026'

const TONO_ESTADO: Record<EstadoPublicoSolicitud['estado'], Tone> = {
  pendiente: 'warning',
  autorizada: 'success',
  rechazada: 'danger',
  realizada: 'navy',
  cancelada: 'neutral',
}

/** Qué significa el estado para quien consulta (sin datos de la persona mayor). */
function explicacion(e: EstadoPublicoSolicitud): string {
  switch (e.estado) {
    case 'pendiente':
      return 'Una persona responsable de la organización debe revisarla y autorizarla. Vuelve a consultar con tu código más tarde.'
    case 'autorizada':
      return e.puedeRegistrarObservacion
        ? 'Tu visita fue autorizada. Cuando la termines, cuéntanos cómo te fue.'
        : 'Tu visita fue autorizada. Preséntate en la fecha y hora indicadas. El día de la visita podrás dejar aquí tu observación.'
    case 'rechazada':
      return 'La organización no pudo autorizar esta visita.'
    case 'realizada':
      return 'Gracias por tu visita. Tu observación quedó registrada.'
    case 'cancelada':
      return 'Esta solicitud fue cancelada.'
  }
}

export default function ConsultarSolicitud() {
  const enLinea = useEnLinea()
  const toast = useToast()
  const location = useLocation()
  // Al llegar desde "Solicitud enviada" el código viaja en el estado de la navegación (no en la URL).
  const codigoInicial = (location.state as { codigo?: string } | null)?.codigo ?? ''

  const [codigo, setCodigo] = useState(codigoInicial)
  const [errorCodigo, setErrorCodigo] = useState<string>()
  const [general, setGeneral] = useState<string>()
  const [consultando, setConsultando] = useState(false)
  const [estado, setEstado] = useState<EstadoPublicoSolicitud | null>(null)
  const [observacion, setObservacion] = useState('')
  const [errorObs, setErrorObs] = useState<string>()
  const [guardando, setGuardando] = useState(false)
  const resultado = useRef<HTMLDivElement>(null)

  const consultar = async (valor: string) => {
    const err = errorCodigoSeguimiento(valor)
    setErrorCodigo(err)
    setGeneral(undefined)
    if (err) return
    setConsultando(true)
    try {
      const res = await consultarSolicitud(valor)
      if (res.ok) {
        setEstado(res.valor)
        setObservacion('')
        setErrorObs(undefined)
      } else {
        setEstado(null)
        setGeneral(res.error)
      }
    } catch {
      setEstado(null)
      setGeneral('No pudimos consultar tu solicitud. Inténtalo de nuevo en unos segundos.')
    } finally {
      setConsultando(false)
    }
  }

  // Si el código llega prellenado, se consulta una sola vez al abrir la página.
  const consultaInicial = useRef(false)
  useEffect(() => {
    if (consultaInicial.current || !codigoInicial) return
    consultaInicial.current = true
    void consultar(codigoInicial)
  }, [codigoInicial])

  // El resultado se anuncia y recibe el foco al aparecer.
  useEffect(() => {
    if (estado) resultado.current?.focus()
  }, [estado])

  const enviarCodigo = (e: FormEvent) => {
    e.preventDefault()
    if (!consultando) void consultar(codigo)
  }

  const guardarObservacion = async (e: FormEvent) => {
    e.preventDefault()
    if (guardando || !estado) return
    const err = errorTexto(observacion, 'tu observación', 3, 600)
    setErrorObs(err)
    if (err) return
    setGuardando(true)
    try {
      const res = await registrarObservacionVisitante(codigo, observacion)
      if (res.ok) {
        setEstado(res.valor)
        toast('Observación guardada. ¡Gracias por tu visita!')
      } else {
        const msg = res.errores?.observacion
        if (msg) setErrorObs(msg)
        else setGeneral(res.error)
      }
    } catch {
      setGeneral('No pudimos guardar tu observación. Inténtalo de nuevo en unos segundos.')
    } finally {
      setGuardando(false)
    }
  }

  const otra = () => {
    setEstado(null)
    setCodigo('')
    setGeneral(undefined)
    setErrorCodigo(undefined)
  }

  return (
    <AuthScreen title="Consultar mi solicitud" back="/">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <LogoBadge />

        {!estado && (
          <form className="flex flex-col gap-5" onSubmit={enviarCodigo} noValidate aria-busy={consultando || undefined}>
            <Lead>Escribe el código de seguimiento que recibiste al solicitar tu visita para ver cómo va.</Lead>
            <TextField
              label="Código de seguimiento"
              placeholder="VIS-XXXX-XXXX"
              maxLength={13}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase tracking-widest"
              value={codigo}
              error={errorCodigo}
              hint="Tiene el formato VIS-XXXX-XXXX."
              help="Lo recibiste al enviar la solicitud, en la pantalla «Solicitud enviada». Si lo perdiste, haz una solicitud nueva: por seguridad no podemos recuperarlo."
              onChange={(e) => {
                setCodigo(normalizarCodigoEscrito(e.target.value))
                setErrorCodigo(undefined)
                setGeneral(undefined)
              }}
            />
            {general && <Aviso tono="error">{general}</Aviso>}
            <Acciones>
              <Button type="submit" fullWidth loading={consultando}>
                {consultando ? 'Consultando…' : 'Consultar'}
              </Button>
            </Acciones>

            {/* Prototipo: se quita al integrar el backend (los códigos reales no se publican). */}
            <div className="rounded-sm border border-line-soft bg-surface px-3.5 py-3 text-sm text-ink-2">
              <p>
                Prototipo: prueba con el código de ejemplo <strong className="font-mono text-ink">{CODIGO_DEMO}</strong>.
              </p>
              <Button
                variant="ghost"
                className="-ml-4"
                onClick={() => {
                  setCodigo(CODIGO_DEMO)
                  setErrorCodigo(undefined)
                  setGeneral(undefined)
                }}
              >
                Usar el código de ejemplo
              </Button>
            </div>
          </form>
        )}

        {estado && (
          <div ref={resultado} tabIndex={-1} role="region" aria-label="Estado de tu solicitud" className="flex flex-col gap-5 outline-none">
            <div className="flex flex-col gap-4 rounded-md border border-line-soft bg-surface p-5 shadow-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-muted">Estado de tu solicitud</p>
                <Badge tone={TONO_ESTADO[estado.estado]}>{estado.estadoTexto}</Badge>
              </div>
              <p className="text-pretty text-ink-2" role="status">
                {explicacion(estado)}
              </p>
              <dl className="flex flex-col gap-3 border-t border-line-soft pt-4">
                <div>
                  <dt className="text-sm text-muted">Organización</dt>
                  <dd className="font-semibold text-ink">{estado.organizacion}</dd>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarClock size={20} aria-hidden className="mt-0.5 flex-none text-blue" />
                  <div>
                    <dt className="text-sm text-muted">{estado.estado === 'pendiente' || estado.estado === 'rechazada' ? 'Fecha y hora propuestas' : 'Fecha y hora de la visita'}</dt>
                    <dd className="font-semibold text-ink">
                      {fechaLarga(new Date(`${estado.fechaPropuesta}T00:00:00`))} · {hhmmA12(estado.horaPropuesta)}
                    </dd>
                  </div>
                </div>
                {estado.estado === 'rechazada' && estado.motivoRechazo && (
                  <div>
                    <dt className="text-sm text-muted">Motivo</dt>
                    <dd className="text-ink">{estado.motivoRechazo}</dd>
                  </div>
                )}
                {estado.observacion && (
                  <div>
                    <dt className="text-sm text-muted">Tu observación</dt>
                    <dd className="whitespace-pre-line text-ink">{estado.observacion}</dd>
                  </div>
                )}
              </dl>
            </div>

            {estado.puedeRegistrarObservacion && (
              <form className="flex flex-col gap-4" onSubmit={guardarObservacion} noValidate aria-busy={guardando || undefined}>
                {!enLinea && <Aviso tono="offline">Sin conexión: necesitas internet para guardar tu observación.</Aviso>}
                <TextareaField
                  label="Tu observación"
                  maxLength={600}
                  rows={4}
                  placeholder="Cuéntanos brevemente cómo fue la visita."
                  value={observacion}
                  error={errorObs}
                  hint={`${observacion.length}/600`}
                  help="Cuenta cómo fue la visita: cómo se veía la persona y de qué conversaron. No escribas datos médicos ni información que no quieras compartir."
                  onChange={(e) => {
                    setObservacion(e.target.value)
                    setErrorObs(undefined)
                  }}
                />
                {general && <Aviso tono="error">{general}</Aviso>}
                <Button type="submit" fullWidth loading={guardando} disabled={!enLinea}>
                  {guardando ? 'Guardando…' : 'Guardar observación'}
                </Button>
              </form>
            )}

            {!estado.puedeRegistrarObservacion && general && <Aviso tono="error">{general}</Aviso>}

            <p className="flex gap-2.5 rounded-sm border border-line-soft bg-surface px-3.5 py-3 text-sm leading-snug text-ink-2">
              <ShieldCheck size={18} aria-hidden className="mt-px flex-none text-blue" />
              Por privacidad, aquí no se muestran datos de las personas mayores ni del equipo de la organización.
            </p>

            <Button variant="outline" fullWidth onClick={otra}>
              Consultar otra solicitud
            </Button>
          </div>
        )}
      </div>
    </AuthScreen>
  )
}
