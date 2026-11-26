/* Bandeja conectada de alertas y casos prioritarios · ID06, RF-04/05/18. © 2026 Equipo CuidaRed – INTEC. */
import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronRight, Icon } from '@/components/icons'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Chip, Datum, IconTile, SelectField, type Tone } from '@/components/ui'
import { fechaHora } from '@/domain/dates'
import { api, ApiError, type CuentaMe } from '../client'
import { recibeAvisosDeAlertas } from '../cuentas-datos'
import { campo, Estado, Formulario, idRuta, Paginador, useConexionReal, useDatos, usePagina } from './controles'
import { NotificacionesPush } from './notificaciones-push'
import type { AdultoNombre, OperacionProps } from './visitas'

const ESTADOS = {
  pendiente: { nombre: 'Pendiente', tono: 'danger' },
  en_proceso: { nombre: 'En atención', tono: 'warning' },
  resuelta: { nombre: 'Resuelta', tono: 'success' },
} satisfies Record<string, { nombre: string; tono: Tone }>

const FUENTES = {
  riesgo: 'Factor de riesgo',
  necesidad: 'Necesidad registrada',
  visita: 'Visita realizada de referencia',
  perfil: 'Alta del expediente',
}

type Bandeja = 'casos' | 'alertas' | 'avisos'

const BANDEJAS: { value: Bandeja; label: string }[] = [
  { value: 'casos', label: 'Casos prioritarios' },
  { value: 'alertas', label: 'Alertas' },
  { value: 'avisos', label: 'Notificaciones' },
]

interface Alerta {
  alerta_envejeciente_id: string
  envejeciente_id: string
  nombres: string
  apellidos: string
  tipo: { codigo: string; nombre: string }
  prioridad: { nombre: string; orden: number }
  descripcion: string | null
  estado: keyof typeof ESTADOS
  fecha_alerta: string
  fecha_atencion: string | null
  accion_tomada: string | null
  atendida_por: string | null
  cierre_automatico: boolean
  fuente: { tipo: keyof typeof FUENTES; referencia_id: string } | null
  es_prioritaria: boolean
}

interface Caso {
  envejeciente_id: string
  nombres: string
  apellidos: string
  fecha_alerta: string
  total_alertas: number
  alertas: Alerta[]
}

interface Notificacion {
  notificacion_id: string
  alerta_envejeciente_id: string | null
  mensaje: string
  estado: 'no_leida' | 'leida' | 'archivada'
  fecha_notificacion: string
  fecha_lectura: string | null
}

interface TipoAlerta { codigo: string; nombre: string }
type PropsBandeja = Pick<OperacionProps, 'base' | 'token'> & { abrir: (id: string) => void; revision: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function EstadoAlerta({ valor }: { valor: Alerta['estado'] }) {
  return <Badge tone={ESTADOS[valor].tono}>{ESTADOS[valor].nombre}</Badge>
}

function TarjetaAlerta({ alerta, abrir, mostrarAdulto }: {
  alerta: Alerta; abrir: (id: string) => void; mostrarAdulto?: boolean
}) {
  return (
    <Card className="grid min-w-0 gap-3 sm:flex sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 gap-3">
        <IconTile size={40}><Bell size={19} aria-hidden /></IconTile>
        <div className="grid min-w-0 flex-1 gap-1">
          <h3 className="font-semibold text-ink wrap-anywhere">{alerta.tipo.nombre}</h3>
          {mostrarAdulto && <p className="text-sm text-ink-2 wrap-anywhere">{alerta.nombres} {alerta.apellidos}</p>}
          <p className="text-xs text-muted"><time dateTime={alerta.fecha_alerta}>{fechaHora(alerta.fecha_alerta)}</time></p>
          <div className="flex flex-wrap gap-1.5">
            <EstadoAlerta valor={alerta.estado} />
            <Badge tone={alerta.es_prioritaria ? 'danger' : 'neutral'}>Prioridad {alerta.prioridad.nombre}</Badge>
          </div>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="justify-self-start" icon={<ChevronRight size={18} aria-hidden />}
        aria-label={`Ver alerta: ${alerta.tipo.nombre}, ${alerta.nombres} ${alerta.apellidos}`}
        onClick={() => abrir(alerta.alerta_envejeciente_id)}>Ver alerta</Button>
    </Card>
  )
}

function DetalleAlerta({ base, token, cuenta, id, revision, cambio }: OperacionProps & { id: string; revision: number; cambio: () => void }) {
  const [gestion, setGestion] = useState<'atender' | 'resolver'>()
  const [aviso, setAviso] = useState('')
  const enLinea = useConexionReal()
  const ruta = `${base}/alertas/${idRuta(id)}`
  const consulta = useDatos<Alerta>(ruta, token, revision)
  const alerta = consulta.datos
  const puedeResolver = (alerta?.estado === 'pendiente' || alerta?.estado === 'en_proceso') &&
    (cuenta.permisos.includes('alertas:gestionar') || cuenta.permisos.includes('alertas:cerrar'))
  const puedeAtender = alerta?.estado === 'pendiente' && cuenta.permisos.includes('alertas:gestionar')
  const guardar = async (accion?: string) => {
    try {
      await api(`${ruta}/${accion ? 'resolver' : 'en-atencion'}`, token, 'POST', accion ? { accion_tomada: accion } : {})
    } catch (error) {
      // El motor puede cerrar la alerta mientras se gestiona: se vuelve a consultar en lugar de mostrar el error de un registro ajeno.
      if (!(error instanceof ApiError) || error.code !== 'INVALID_STATE') throw error
      setGestion(undefined)
      setAviso('La alerta ya no admite ese cambio porque cambió de estado. Se actualizó el detalle.')
      cambio()
      return
    }
    setGestion(undefined)
    setAviso(accion ? 'Alerta resuelta.' : 'Alerta en atención.')
    cambio()
  }
  return <>
    {aviso && <p role="status" className="rounded-sm bg-teal-100 p-3 text-sm font-semibold">{aviso}</p>}
    <Estado consulta={consulta} />
    {alerta && <Card className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold wrap-anywhere">{alerta.tipo.nombre}</h2>
        <EstadoAlerta valor={alerta.estado} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Datum label="Adulto mayor" value={`${alerta.nombres} ${alerta.apellidos}`} />
        <Datum label="Prioridad" value={alerta.prioridad.nombre} />
        <Datum label="Registrada" value={fechaHora(alerta.fecha_alerta)} />
        {alerta.fuente && <Datum label="Fuente" value={FUENTES[alerta.fuente.tipo]} />}
        {alerta.fecha_atencion && <Datum label="Fecha de atención" value={fechaHora(alerta.fecha_atencion)} />}
        {alerta.atendida_por && <Datum label="Atendida por" value={alerta.atendida_por} />}
      </div>
      {alerta.cierre_automatico && <p className="text-sm text-ink-2">La alerta se cerró automáticamente al dejar de cumplirse su causa.</p>}
      {alerta.descripcion && <p className="text-ink-2 whitespace-pre-line wrap-anywhere">{alerta.descripcion}</p>}
      {alerta.accion_tomada && <section className="grid gap-1">
        <h3 className="font-semibold">Acción tomada</h3>
        <p className="text-sm text-ink-2 whitespace-pre-line wrap-anywhere">{alerta.accion_tomada}</p>
      </section>}
      {(puedeResolver || puedeAtender) && !gestion && <div className="flex flex-wrap gap-2">
        {puedeAtender && <Button variant="outline" size="sm" onClick={() => setGestion('atender')} disabled={!enLinea}>Iniciar atención</Button>}
        {puedeResolver && <Button size="sm" onClick={() => setGestion('resolver')} disabled={!enLinea}>Resolver alerta</Button>}
      </div>}
    </Card>}
    {puedeAtender && gestion === 'atender' && <Formulario titulo="Iniciar atención" accion="Confirmar inicio" disabled={!enLinea}
      cancelar={() => setGestion(undefined)} campos={[]} enviar={() => guardar()} />}
    {puedeResolver && gestion === 'resolver' && <Formulario titulo="Resolver alerta" accion="Confirmar resolución" disabled={!enLinea}
      cancelar={() => setGestion(undefined)}
      campos={[{ name: 'accion', type: 'textarea', label: 'Acción tomada', max: 500 }]}
      enviar={async (datos) => {
        const accion = campo(datos, 'accion')
        if (!accion) throw new Error('Describe la acción tomada.')
        await guardar(accion)
      }} />}
  </>
}

function Casos({ base, token, abrir, revision }: PropsBandeja) {
  const consulta = usePagina<Caso>(`${base}/casos-prioritarios`, token, revision)
  return <section className="grid gap-4" aria-label="Casos prioritarios">
    <Estado consulta={consulta} vacio={consulta.datos?.data.length === 0 ? 'Sin casos prioritarios abiertos.' : undefined} />
    {consulta.datos?.data.map((caso) => (
      <section key={caso.envejeciente_id} className="grid gap-2 rounded-md border border-line-soft bg-bg p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold wrap-anywhere">{caso.nombres} {caso.apellidos}</h2>
          <p className="text-sm text-ink-2">{caso.total_alertas} {caso.total_alertas === 1 ? 'alerta abierta' : 'alertas abiertas'}</p>
        </div>
        <ul className="grid gap-2">
          {caso.alertas.map((alerta) => <li key={alerta.alerta_envejeciente_id}><TarjetaAlerta alerta={alerta} abrir={abrir} /></li>)}
        </ul>
      </section>
    ))}
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </section>
}

function ListaAlertas({ base, token, cuenta, abrir, revision, adultoInicial }: PropsBandeja & { cuenta: CuentaMe; adultoInicial?: string }) {
  const puedeVerAdultos = cuenta.permisos.includes('adultos:ver')
  const [estado, fijarEstado] = useState('')
  const [tipo, fijarTipo] = useState('')
  const [adulto, fijarAdulto] = useState(puedeVerAdultos && adultoInicial && UUID.test(adultoInicial) ? adultoInicial : '')
  const tipos = useDatos<TipoAlerta[]>('/catalogos/tipos-alerta', token)
  const adultos = usePagina<AdultoNombre>(puedeVerAdultos ? `${base}/envejecientes` : null, token, 0, { limit: 100, filters: { estado: 'activo' } })
  const opcionesAdulto = adultos.datos?.data ?? []
  // El adulto elegido puede quedar fuera de la página de opciones (enlace desde su expediente): se consulta su nombre aparte.
  const fueraDeLista = adulto !== '' && !opcionesAdulto.some((item) => item.envejeciente_id === adulto)
  const perfil = useDatos<AdultoNombre>(fueraDeLista && adultos.datos ? `${base}/envejecientes/${idRuta(adulto)}` : null, token)
  const consulta = usePagina<Alerta>(`${base}/alertas`, token, revision, {
    filters: { ...(estado && { estado }), ...(tipo && { tipo }), ...(adulto && { envejeciente_id: adulto }) },
  })
  return <section className="grid gap-3" aria-label="Listado de alertas">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <SelectField label="Estado de la alerta" value={estado} onChange={(event) => fijarEstado(event.currentTarget.value)}
        options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(ESTADOS).map(([value, info]) => ({ value, label: info.nombre }))]} />
      <SelectField label="Tipo de alerta" value={tipo} onChange={(event) => fijarTipo(event.currentTarget.value)}
        options={[{ value: '', label: 'Todos los tipos' }, ...(tipos.datos ?? []).map((item) => ({ value: item.codigo, label: item.nombre }))]} />
      {puedeVerAdultos && <SelectField label="Adulto mayor" value={adulto} onChange={(event) => fijarAdulto(event.currentTarget.value)}
        options={[
          { value: '', label: 'Todos los adultos' },
          ...(fueraDeLista ? [{ value: adulto, label: perfil.datos ? `${perfil.datos.nombres} ${perfil.datos.apellidos}` : 'Adulto seleccionado' }] : []),
          ...opcionesAdulto.map((item) => ({ value: item.envejeciente_id, label: `${item.nombres} ${item.apellidos}` })),
        ]} />}
    </div>
    {adultos.datos && adultos.datos.meta.totalPages > 1 &&
      <Paginador pagina={adultos.pagina} total={adultos.datos.meta.totalPages} cambiar={adultos.cambiar} />}
    <Estado consulta={consulta} vacio={consulta.datos?.data.length === 0 ? 'Sin alertas en este listado.' : undefined} />
    {!!consulta.datos?.data.length && <ul className="grid gap-3">
      {consulta.datos.data.map((alerta) => <li key={alerta.alerta_envejeciente_id}><TarjetaAlerta alerta={alerta} abrir={abrir} mostrarAdulto /></li>)}
    </ul>}
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </section>
}

function Notificaciones({ base, token, abrir, revision, cambio }: PropsBandeja & { cambio: () => void }) {
  const [confirmacion, setConfirmacion] = useState(false)
  const [estado, fijarEstado] = useState('')
  const [ocupada, setOcupada] = useState<string>()
  const [error, setError] = useState('')
  const [fechaHoy] = useState(() => new Date())
  const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo' })
  const hoy = formatoDia.format(fechaHoy)
  const enLinea = useConexionReal()
  const consulta = usePagina<Notificacion>(`${base}/notificaciones-alerta`, token, revision, { filters: estado ? { estado } : undefined, sort: ['-fecha_notificacion'] })
  const todas = usePagina<unknown>(estado ? `${base}/notificaciones-alerta` : null, token, revision, { limit: 1 })
  const sinLeer = usePagina<unknown>(estado !== 'no_leida' ? `${base}/notificaciones-alerta` : null, token, revision, { limit: 1, filters: { estado: 'no_leida' } })
  const total = estado ? todas.datos?.meta.total : consulta.datos?.meta.total
  const pendientes = estado === 'no_leida' ? consulta.datos?.meta.total : sinLeer.datos?.meta.total
  const grupos = new Map<string, Notificacion[]>()
  const fechaAyer = formatoDia.format(new Date(fechaHoy.getTime() - 86_400_000))
  for (const aviso of consulta.datos?.data ?? []) {
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo' }).format(new Date(aviso.fecha_notificacion))
    const titulo = dia === hoy ? 'Hoy' : dia === fechaAyer ? 'Ayer' : new Intl.DateTimeFormat('es-DO', { timeZone: 'America/Santo_Domingo', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(aviso.fecha_notificacion))
    grupos.set(titulo, [...(grupos.get(titulo) ?? []), aviso])
  }
  const leer = async (aviso: Notificacion, navegar = false) => {
    if (ocupada) return
    setOcupada(aviso.notificacion_id); setError('')
    try {
      if (aviso.estado === 'no_leida') {
        await api(`${base}/notificaciones-alerta/${idRuta(aviso.notificacion_id)}/leer`, token, 'POST', {})
        setConfirmacion(true); cambio()
      }
      if (navegar && aviso.alerta_envejeciente_id) abrir(aviso.alerta_envejeciente_id)
    } catch { setError('No se pudo actualizar la notificación. Intenta de nuevo.') }
    finally { setOcupada(undefined) }
  }
  return <section className="grid gap-3" aria-label="Notificaciones de alertas">
    <div className="flex flex-wrap gap-2 py-2" role="group" aria-label="Lectura de notificaciones">
      {[{ id: '', texto: `Todas${total === undefined ? '' : ` (${total})`}` }, { id: 'no_leida', texto: `Sin leer${pendientes === undefined ? '' : ` (${pendientes})`}` }, { id: 'leida', texto: 'Leídas' }].map(opcion => <button key={opcion.id} type="button" aria-pressed={estado === opcion.id} onClick={() => fijarEstado(opcion.id)} className={'min-h-12 rounded-pill border px-4 text-sm font-semibold ' + (estado === opcion.id ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink hover:bg-blue-100')}>{opcion.texto}</button>)}
    </div>
    {confirmacion && <p role="status" className="rounded-sm bg-teal-100 p-3 text-sm font-semibold">Notificación marcada como leída.</p>}
    {error && <p role="alert" className="rounded-sm bg-danger-100 p-3 text-sm text-danger">{error}</p>}
    <Estado consulta={consulta} vacio={consulta.datos?.data.length === 0 ? 'Sin notificaciones de alertas.' : undefined} />
    {[...grupos].map(([titulo, avisos]) => <section key={titulo} aria-label={titulo} className="grid gap-3 py-2"><h3 className="text-sm font-semibold text-muted">{titulo}</h3><ul className="grid gap-3">{avisos.map(aviso => {
      const contenido = <><span className="grid size-10 shrink-0 place-items-center rounded-sm bg-danger-100 text-danger"><Bell size={24} aria-hidden /></span><span className="min-w-0 flex-1"><span className="block font-semibold whitespace-pre-line wrap-anywhere">{aviso.estado === 'no_leida' && <span aria-label="Sin leer" className="mr-1 inline-block size-2 rounded-full bg-danger" />}{aviso.mensaje}</span><span className="mt-1 block text-sm text-muted"><time dateTime={aviso.fecha_notificacion}>{fechaHora(aviso.fecha_notificacion)}</time> · <span>{aviso.estado === 'no_leida' ? 'Sin leer' : aviso.estado === 'archivada' ? 'Archivada' : 'Leída'}</span></span>{aviso.fecha_lectura && <span className="mt-1 block text-sm text-muted">Leída el <time dateTime={aviso.fecha_lectura}>{fechaHora(aviso.fecha_lectura)}</time></span>}</span>{aviso.alerta_envejeciente_id && <ChevronRight size={20} className="self-center text-muted" aria-hidden />}</>
      return <li key={aviso.notificacion_id} className={'overflow-hidden rounded-card border ' + (aviso.estado === 'no_leida' ? 'border-primary bg-blue-100' : 'border-line-soft bg-white')}>
        {aviso.alerta_envejeciente_id ? <button type="button" disabled={!enLinea || !!ocupada} aria-label={`Ver alerta: ${aviso.mensaje}`} onClick={() => void leer(aviso, true)} className="flex min-h-24 w-full items-start gap-3 p-4 text-left hover:bg-blue-100/60">{contenido}</button> : <div className="flex min-h-24 items-start gap-3 p-4">{contenido}</div>}
        {aviso.estado === 'no_leida' && <div className="flex justify-end px-3"><button type="button" aria-label="Marcar como leída" title="Marcar como leída" disabled={!enLinea || !!ocupada} onClick={() => void leer(aviso)} className="flex min-h-12 items-center gap-2 rounded-sm px-3 text-sm font-semibold text-navy hover:bg-white/60"><Icon name="mark_email_read" size={20} />Marcar como leída</button></div>}
      </li>
    })}</ul></section>)}
    {consulta.datos?.data.length ? <p className="text-sm text-muted">Al abrir un aviso se marca como leído y se muestra su alerta. Los avisos sin alerta asociada se pueden marcar como leídos aquí.</p> : null}
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </section>
}

export function Alertas({ alLeerAviso, ...props }: OperacionProps & { alLeerAviso: () => void }) {
  const { base, token, cuenta } = props
  const puedeRecibirAvisos = recibeAvisosDeAlertas(cuenta)
  const [parametros, fijarParametros] = useSearchParams()
  // Quien no recibe avisos no tiene bandeja de notificaciones: solo vería una lista vacía.
  const bandejas = BANDEJAS.filter((item) => item.value !== 'avisos' || puedeRecibirAvisos)
  const bandeja = bandejas.find((item) => item.value === parametros.get('bandeja'))?.value ?? 'casos'
  const [id, abrir] = useState<string>()
  const [revision, setRevision] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  const bandejaRef = useRef<HTMLDivElement>(null)
  const anterior = useRef(id)
  useEffect(() => {
    if (id === anterior.current) return
    anterior.current = id
    const destino = id ? panel.current : bandejaRef.current
    destino?.focus({ preventScroll: true })
    destino?.scrollIntoView({ block: 'nearest' })
  }, [id])
  const cambio = () => setRevision((n) => n + 1)
  const listado = { base, token, abrir, revision }
  return <section className="grid gap-4">
    <div ref={bandejaRef} tabIndex={-1} hidden={!!id} className="space-y-4 outline-none">
      {bandeja !== 'avisos' && <div className="flex flex-wrap gap-2" role="group" aria-label="Bandeja de alertas">
        {bandejas.map((item) => <Chip key={item.value} active={bandeja === item.value}
          onClick={() => fijarParametros(item.value === 'casos' ? {} : { bandeja: item.value }, { replace: true })}>{item.label}</Chip>)}
      </div>}
      {bandeja === 'casos' && <Casos {...listado} />}
      {bandeja === 'alertas' && <ListaAlertas {...listado} cuenta={cuenta} adultoInicial={parametros.get('adulto') ?? undefined} />}
      {bandeja === 'avisos' && <>
        <Notificaciones {...listado} cambio={() => { cambio(); alLeerAviso() }} />
        <NotificacionesPush token={token} />
      </>}
    </div>
    {id && <div ref={panel} tabIndex={-1} className="grid gap-3 outline-none">
      <div><Button variant="outline" size="sm" onClick={() => abrir(undefined)}>Volver a la bandeja</Button></div>
      <DetalleAlerta {...props} id={id} revision={revision} cambio={cambio} />
    </div>}
  </section>
}
