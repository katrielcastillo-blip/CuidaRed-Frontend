/*
 * visitas-publicas.tsx — Solicitud y seguimiento de visitas para personas sin cuenta.
 * Módulo: access-real. © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ScanSearch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, TextareaField, TextField, Badge } from '@/components/ui'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import { BienvenidaPresentacion } from '../auth/components/BienvenidaPresentacion'
import { Aviso } from '../auth/components/Piezas'
import { SolicitarVisita, type OrganizacionOpcion, type ResultadoEnvio } from '../auth/components/SolicitarVisita'
import { errorCodigoSeguimiento, normalizarCodigoEscrito, type DatosSolicitud } from '../auth/lib/solicitudVisita'
import { ApiError, apiPublica } from './client'
import { fechaDominicana } from './operacion/visitas-fechas'

const solicitudes = '/solicitudes-visita'
type Organizacion = { cuenta_id: number; nombre: string }
type EstadoSolicitud = {
  organizacion: string
  estado: 'pendiente' | 'autorizada' | 'rechazada' | 'realizada' | 'cancelada'
  estado_texto: string
  fecha: string
  hora: string | null
  hora_fin_programada?: string | null
  reprogramada?: boolean
  motivo_rechazo: string | null
  puede_registrar_observacion: boolean
  observacion: string | null
}
type Catalogo = { datos: OrganizacionOpcion[] } | { mensaje: string; temporal: boolean }

function aviso(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 429) return 'Espera un momento antes de intentar de nuevo.'
  if (error instanceof ApiError && error.status === 422) return 'Revisa los datos que ingresaste y vuelve a intentar.'
  return fallback
}

async function enviarSolicitud(datos: DatosSolicitud, idempotencia?: string): Promise<ResultadoEnvio> {
  try {
    const valor = await apiPublica<{ codigo: string }>(solicitudes, 'POST', {
      cuenta_id: Number(datos.orgId),
      ...(idempotencia ? { idempotencia } : {}),
      nombres: datos.nombres.trim(), apellidos: datos.apellidos.trim(),
      cedula: datos.cedula, telefono: datos.telefono, correo: datos.correo.trim(),
      tipo_visita: datos.tipoVisita ?? 'personal', cantidad_visitantes: Number(datos.cantidadVisitantes ?? 1),
      ...(datos.tipoVisita === 'institucional' ? {
        entidad_visitante: datos.entidadVisitante?.trim(), tipo_entidad: datos.tipoEntidad,
        aporte_previsto: datos.aportePrevisto?.trim() || null,
      } : { persona_a_visitar: datos.personaAVisitar.trim() }),
      fecha_propuesta: datos.fechaPropuesta,
      hora_propuesta: datos.horaPropuesta, motivo: datos.motivo.trim(),
    })
    return { ok: true, valor }
  } catch (error) {
    return { ok: false, error: aviso(error, error instanceof ApiError && error.status === 409
      ? 'La organización ya tiene solicitudes pendientes a tu nombre. Consulta con tu código o contáctala directamente.'
      : 'No pudimos confirmar el envío. Vuelve a intentarlo sin cambiar los datos.') }
  }
}

function FormularioPublico() {
  const [intento, setIntento] = useState(0)
  const [catalogo, setCatalogo] = useState<Catalogo>()
  const recargar = () => {
    setCatalogo(undefined)
    setIntento((valor) => valor + 1)
  }
  useEffect(() => {
    let activo = true
    void apiPublica<Organizacion[]>('/organizaciones')
      .then((datos) => {
        if (activo) setCatalogo({ datos: datos.map(({ cuenta_id, nombre }) => ({ id: String(cuenta_id), nombre })) })
      })
      .catch((error: unknown) => {
        if (!activo) return
        const temporal = !(error instanceof ApiError && error.status === 404)
        setCatalogo({
          temporal,
          mensaje: temporal
            ? aviso(error, 'No pudimos cargar las organizaciones. Vuelve a intentar en un momento.')
            : 'Las solicitudes en línea aún no están habilitadas. Para solicitar una visita, comunícate con la organización.',
        })
      })
    return () => { activo = false }
  }, [intento])

  if (catalogo && 'datos' in catalogo) {
    return <div className="flex min-w-0 flex-col gap-3">
      <SolicitarVisita organizaciones={catalogo.datos} enviar={enviarSolicitud} soloMemoria />
      {catalogo.datos.length === 0 && <Button size="sm" variant="outline" className="self-start" onClick={recargar}>Volver a cargar organizaciones</Button>}
    </div>
  }

  return <div className="flex min-w-0 flex-col gap-3">
    <h3 className="text-xl font-bold text-navy">Solicitar una visita</h3>
    {!catalogo && <p role="status" className="text-ink-2">Cargando organizaciones…</p>}
    {catalogo && 'mensaje' in catalogo && <>
      <Aviso tono="info">{catalogo.mensaje}</Aviso>
      {catalogo.temporal && <Button size="sm" variant="outline" className="self-start" onClick={recargar}>Volver a cargar</Button>}
    </>}
  </div>
}

export function PortadaConectada() {
  return <BienvenidaPresentacion solicitudVisita={<FormularioPublico />} />
}

export function SolicitudVisitaPublica() {
  return <main className="min-h-dvh bg-bg px-5 pt-safe pb-10 font-sans text-sm leading-relaxed text-ink">
    <div className="mx-auto grid max-w-[40rem] gap-3 pt-6 sm:pt-10">
      <Link to="/" className="inline-flex min-h-12 items-center gap-2 justify-self-start font-semibold text-navy underline-offset-4 hover:underline"><ArrowLeft size={18} aria-hidden /> Volver a la portada</Link>
      <h1 className="text-2xl font-bold leading-tight text-navy">Visitas a personas y organizaciones</h1>
      <div className="rounded-md border border-line-soft bg-white p-5 sm:p-8"><FormularioPublico /></div>
      <Link to="/solicitud-visita" className="inline-flex min-h-12 items-center gap-2 justify-self-start font-semibold text-navy underline underline-offset-4">Consultar mi solicitud <ScanSearch size={17} aria-hidden /></Link>
      <Link to="/guias" className="inline-flex min-h-12 items-center justify-self-start font-semibold text-navy underline underline-offset-4">Ver la guía de visitas</Link>
    </div>
  </main>
}

function mensajeEstado(estado: EstadoSolicitud) {
  switch (estado.estado) {
    case 'pendiente': return 'La organización tiene que revisar tu solicitud.'
    case 'autorizada': return estado.reprogramada
      ? 'La organización cambió el horario. Preséntate en la fecha y hora actualizadas.'
      : 'Preséntate en la fecha y hora indicadas. Podrás dejar una observación cuando el equipo registre la visita como realizada.'
    case 'realizada': return estado.observacion ? 'Tu observación quedó registrada.' : 'La organización registró la visita como realizada.'
    case 'rechazada': return 'La organización no autorizó esta solicitud.'
    case 'cancelada': return 'La visita fue cancelada.'
  }
}

function recordatorio(estado: EstadoSolicitud) {
  if (estado.estado !== 'autorizada') return undefined
  if (estado.fecha === fechaDominicana()) return 'Tu cita es hoy.'
  if (estado.fecha === fechaDominicana(1)) return 'Tu cita es mañana.'
}

export function SeguimientoVisita() {
  const [codigo, setCodigo] = useState('')
  const [estado, setEstado] = useState<EstadoSolicitud>()
  const [observacion, setObservacion] = useState('')
  const [errorCodigo, setErrorCodigo] = useState<string>()
  const [errorObs, setErrorObs] = useState<string>()
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const permiteObservacion = estado?.estado === 'realizada' && estado.puede_registrar_observacion && !estado.observacion
  const avisoDeCita = estado && recordatorio(estado)

  async function consultar(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (ocupado) return
    const error = errorCodigoSeguimiento(codigo)
    setErrorCodigo(error)
    setMensaje('')
    if (error) return
    setOcupado(true)
    try {
      setEstado(await apiPublica<EstadoSolicitud>(solicitudes + '/consulta', 'POST', { codigo }))
    } catch (fallo) {
      const texto = fallo instanceof ApiError && fallo.status === 404
        ? 'No encontramos la solicitud. Revisa tu código o verifica si el servicio está habilitado.'
        : aviso(fallo, 'No pudimos consultar tu solicitud. Intenta de nuevo.')
      setMensaje(texto)
      setEstado(undefined)
    } finally {
      setOcupado(false)
    }
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!permiteObservacion || ocupado) return
    const texto = observacion.trim()
    if (texto.length < 3 || texto.length > 600) {
      setErrorObs('Escribe una observación de 3 a 600 caracteres.')
      return
    }
    setOcupado(true)
    setMensaje('')
    try {
      setEstado(await apiPublica<EstadoSolicitud>(solicitudes + '/observacion', 'POST', { codigo, observacion: texto }))
      setObservacion('')
    } catch (error) {
      setMensaje(aviso(error, 'No pudimos guardar la observación. Actualiza el estado de tu solicitud y vuelve a intentar.'))
    } finally {
      setOcupado(false)
    }
  }

  return <main className="min-h-dvh bg-bg px-5 pt-safe pb-10 font-sans text-sm leading-relaxed text-ink">
    <div className="mx-auto max-w-[40rem] pt-6 sm:pt-10">
      <Link to="/" className="inline-flex min-h-12 items-center gap-2 font-semibold text-navy underline-offset-4 hover:underline"><ArrowLeft size={18} aria-hidden /> Volver a la portada</Link>
      <article className="mt-4 flex flex-col gap-5 rounded-md border border-line bg-white p-5 sm:p-8">
        <header>
          <h1 className="text-2xl font-bold leading-tight text-navy">Consultar mi solicitud</h1>
          <p className="mt-2 text-ink-2">Usa el código que recibiste al enviar la solicitud para ver el estado de tu visita.</p>
        </header>
        <form onSubmit={consultar} className="flex min-w-0 flex-col gap-3" aria-busy={ocupado}>
          <TextField label="Código de seguimiento" placeholder="VIS-XXXX-XXXX" maxLength={13}
            autoCapitalize="characters" autoComplete="off" spellCheck={false} value={codigo}
            error={errorCodigo} disabled={ocupado} onChange={(event) => {
              setCodigo(normalizarCodigoEscrito(event.target.value))
              setEstado(undefined)
              setObservacion('')
              setErrorCodigo(undefined)
              setErrorObs(undefined)
              setMensaje('')
            }} />
          <Button size="sm" type="submit" className="self-start" loading={ocupado && !estado} disabled={ocupado} icon={<ScanSearch size={18} aria-hidden />}>
            {estado ? 'Actualizar estado' : 'Consultar solicitud'}
          </Button>
        </form>
        {mensaje && <Aviso tono="error">{mensaje}</Aviso>}
        {estado && <section className="flex flex-col gap-3 border-t border-line pt-4" aria-labelledby="estado-solicitud">
          <h2 id="estado-solicitud" className="text-lg font-bold text-navy">Estado de tu solicitud</h2>
          <div role="status"><Badge tone={estado.estado === 'realizada' ? 'success' : 'navy'}>{estado.estado_texto}</Badge><p className="mt-2 text-ink-2">{mensajeEstado(estado)}</p></div>
          {avisoDeCita && <p className="rounded-sm bg-teal-100 p-3 font-semibold text-navy">{avisoDeCita}</p>}
          <dl className="grid gap-3 rounded-sm bg-bg p-4 sm:grid-cols-2">
            <div><dt className="text-sm text-ink-2">Organización</dt><dd className="font-semibold">{estado.organizacion}</dd></div>
            <div><dt className="text-sm text-ink-2">{estado.estado === 'pendiente' || estado.estado === 'rechazada' ? 'Propuesta' : 'Cita'}</dt><dd className="font-semibold">{fechaCorta(estado.fecha)}{estado.hora && ' · ' + hhmmA12(estado.hora)}{estado.hora_fin_programada && ` – ${hhmmA12(estado.hora_fin_programada)}`}</dd></div>
            {estado.motivo_rechazo && <div className="sm:col-span-2"><dt className="text-sm text-ink-2">Motivo</dt><dd>{estado.motivo_rechazo}</dd></div>}
            {estado.observacion && <div className="sm:col-span-2"><dt className="text-sm text-ink-2">Tu observación</dt><dd className="whitespace-pre-line">{estado.observacion}</dd></div>}
          </dl>
          {permiteObservacion && <form onSubmit={guardar} className="flex flex-col gap-3 border-t border-line pt-3">
            <TextareaField label="Tu observación" rows={4} maxLength={600} value={observacion}
              error={errorObs} help="Puedes compartir cómo fue la visita y alguna sugerencia para próximos encuentros. Evita incluir datos médicos."
              onChange={(event) => { setObservacion(event.target.value); setErrorObs(undefined) }} />
            <Button size="sm" type="submit" className="self-start" disabled={ocupado}>Guardar observación</Button>
          </form>}
        </section>}
      </article>
    </div>
  </main>
}
