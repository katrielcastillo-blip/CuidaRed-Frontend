/* Bandeja conectada de alertas y casos prioritarios · ID06, RF-04/05/18. © 2026 Equipo CuidaRed – INTEC. */
import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Chip, Datum, IconTile, SelectField, type Tone } from '@/components/ui'
import { fechaHora } from '@/domain/dates'
import { api } from '../client'
import { campo, Estado, Formulario, idRuta, Paginador, useConexionReal, useDatos, usePagina } from './controles'
import type { OperacionProps } from './visitas'

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
    await api(`${ruta}/${accion ? 'resolver' : 'en-atencion'}`, token, 'POST', accion ? { accion_tomada: accion } : {})
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

function ListaAlertas({ base, token, abrir, revision }: PropsBandeja) {
  const [estado, fijarEstado] = useState('')
  const [tipo, fijarTipo] = useState('')
  const tipos = useDatos<TipoAlerta[]>('/catalogos/tipos-alerta', token)
  const consulta = usePagina<Alerta>(`${base}/alertas`, token, revision, {
    filters: { ...(estado && { estado }), ...(tipo && { tipo }) },
  })
  return <section className="grid gap-3" aria-label="Listado de alertas">
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField label="Estado de la alerta" value={estado} onChange={(event) => fijarEstado(event.currentTarget.value)}
        options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(ESTADOS).map(([value, info]) => ({ value, label: info.nombre }))]} />
      <SelectField label="Tipo de alerta" value={tipo} onChange={(event) => fijarTipo(event.currentTarget.value)}
        options={[{ value: '', label: 'Todos los tipos' }, ...(tipos.datos ?? []).map((item) => ({ value: item.codigo, label: item.nombre }))]} />
    </div>
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
  const enLinea = useConexionReal()
  const consulta = usePagina<Notificacion>(`${base}/notificaciones-alerta`, token, revision, { filters: estado ? { estado } : undefined })
  return <section className="grid gap-3" aria-label="Notificaciones de alertas">
    <div className="max-w-sm">
      <SelectField label="Lectura de notificaciones" value={estado} onChange={(event) => fijarEstado(event.currentTarget.value)}
        options={[{ value: '', label: 'Todas' }, { value: 'no_leida', label: 'Sin leer' }, { value: 'leida', label: 'Leídas' }, { value: 'archivada', label: 'Archivadas' }]} />
    </div>
    {confirmacion && <p role="status" className="rounded-sm bg-teal-100 p-3 text-sm font-semibold">Notificación marcada como leída.</p>}
    <Estado consulta={consulta} vacio={consulta.datos?.data.length === 0 ? 'Sin notificaciones de alertas.' : undefined} />
    {consulta.datos?.data.map((aviso) => (
      <Card key={aviso.notificacion_id} className="grid gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold whitespace-pre-line wrap-anywhere">{aviso.mensaje}</p>
          <Badge tone={aviso.estado === 'no_leida' ? 'info' : 'neutral'}>
            {aviso.estado === 'no_leida' ? 'Sin leer' : aviso.estado === 'archivada' ? 'Archivada' : 'Leída'}
          </Badge>
        </div>
        <time className="text-sm text-muted" dateTime={aviso.fecha_notificacion}>{fechaHora(aviso.fecha_notificacion)}</time>
        {aviso.fecha_lectura && <p className="text-sm text-ink-2">Leída el <time dateTime={aviso.fecha_lectura}>{fechaHora(aviso.fecha_lectura)}</time></p>}
        {aviso.alerta_envejeciente_id && <div><Button variant="ghost" size="sm" onClick={() => {
          if (aviso.alerta_envejeciente_id) abrir(aviso.alerta_envejeciente_id)
        }}>Ver alerta</Button></div>}
        {aviso.estado === 'no_leida' && <Formulario titulo="Lectura de la notificación" campos={[]} accion="Marcar como leída"
          disabled={!enLinea} exito="" enviar={async () => {
            await api(`${base}/notificaciones-alerta/${idRuta(aviso.notificacion_id)}/leer`, token, 'POST', {})
            setConfirmacion(true)
            cambio()
          }} />}
      </Card>
    ))}
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </section>
}

export function Alertas({ alLeerAviso, ...props }: OperacionProps & { alLeerAviso: () => void }) {
  const { base, token } = props
  const [parametros, fijarParametros] = useSearchParams()
  const bandeja = BANDEJAS.find((item) => item.value === parametros.get('bandeja'))?.value ?? 'casos'
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
      <div className="flex flex-wrap gap-2" role="group" aria-label="Bandeja de alertas">
        {BANDEJAS.map((item) => <Chip key={item.value} active={bandeja === item.value}
          onClick={() => fijarParametros(item.value === 'casos' ? {} : { bandeja: item.value }, { replace: true })}>{item.label}</Chip>)}
      </div>
      {bandeja === 'casos' && <Casos {...listado} />}
      {bandeja === 'alertas' && <ListaAlertas {...listado} />}
      {bandeja === 'avisos' && <Notificaciones {...listado} cambio={() => { cambio(); alLeerAviso() }} />}
    </div>
    {id && <div ref={panel} tabIndex={-1} className="grid gap-3 outline-none">
      <div><Button variant="outline" size="sm" onClick={() => abrir(undefined)}>Volver a la bandeja</Button></div>
      <DetalleAlerta {...props} id={id} revision={revision} cambio={cambio} />
    </div>}
  </section>
}
