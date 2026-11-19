/* Registro y consulta de necesidades conectadas · ID05, RF-03/RF-10. © 2026 Equipo CuidaRed – INTEC. */
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, HandHelping, Plus } from 'lucide-react'
import { Badge, Button, Card, Checkbox, Datum, IconTile, SelectField, TextField, TextareaField, type Tone } from '@/components/ui'
import { UNIDADES } from '@/domain/catalogos'
import { fechaHora } from '@/domain/dates'
import { api, ApiError } from '../client'
import type { ColaOperaciones } from './cola-operaciones'
import { campo, Estado, Formulario, idRuta, Paginador, useConexionReal, useDatos, usePagina } from './controles'
import type { AdultoNombre, OperacionProps } from './visitas'

const ESTADOS = {
  pendiente: { nombre: 'Pendiente', tono: 'warning' },
  en_proceso: { nombre: 'En proceso', tono: 'info' },
  resuelta: { nombre: 'Resuelta', tono: 'success' },
  cancelada: { nombre: 'Cancelada', tono: 'neutral' },
} satisfies Record<string, { nombre: string; tono: Tone }>

interface Necesidad {
  envejeciente_necesidad_id: string
  envejeciente_id: string
  envejeciente_nombre: string
  envejeciente_estado: 'activo' | 'inactivo' | 'fallecido'
  necesidad_id: number
  necesidad_nombre: string
  tipo_necesidad_id: number
  tipo_necesidad_nombre: string
  prioridad_id: number
  prioridad: string
  estado: keyof typeof ESTADOS
  descripcion: string | null
  cantidad: number | null
  unidad_medida: string | null
  fecha_necesidad: string
  fecha_actualizacion: string
  usuario_responsable_id: string | null
  responsable: string | null
  indicacion_medica_id: string | null
  fecha_resolucion: string | null
  motivo_resolucion: string | null
  es_recurrente: boolean
}

interface EventoNecesidad {
  necesidad_evento_id: string
  fecha: string
  actor: string | null
  estado_anterior: Necesidad['estado'] | null
  estado: Necesidad['estado']
  prioridad: string
  prioridad_anterior: string | null
  responsable_anterior: string | null
  responsable: string | null
  motivo: string | null
}

interface TipoNecesidad { tipo_necesidad_id: number; nombre: string }
interface ItemNecesidad { necesidad_id: number; nombre: string; tipo_necesidad_id: number }
interface Prioridad { prioridad_id: number; nombre: string }
interface Responsable { usuario_id: string; nombre: string }
interface Indicacion { indicacion_medica_id: string; titulo: string; estado: 'activa' | 'suspendida' | 'finalizada' }
const ESTADO_INDICACION = { activa: 'Activa', suspendida: 'Suspendida', finalizada: 'Finalizada' }
interface ExpedienteNecesidad { adultoId?: string; adultoActivo?: boolean }

const OPCIONES_ESTADO = Object.entries(ESTADOS).map(([value, info]) => ({ value, label: info.nombre }))
const TRANSICIONES: Record<Necesidad['estado'], Necesidad['estado'][]> = {
  pendiente: ['en_proceso', 'resuelta', 'cancelada'],
  en_proceso: ['resuelta', 'cancelada'],
  resuelta: [],
  cancelada: [],
}

function EstadoNecesidad({ valor }: { valor: Necesidad['estado'] }) {
  return <Badge tone={ESTADOS[valor].tono}>{ESTADOS[valor].nombre}</Badge>
}

function HistorialNecesidad({ ruta, token, revision }: { ruta: string; token: string; revision: number }) {
  const consulta = usePagina<EventoNecesidad>(`${ruta}/historial`, token, revision)
  return <section className="grid gap-2" aria-label="Historial de la necesidad">
    <h3 className="font-semibold">Historial de la necesidad</h3>
    <Estado consulta={consulta} vacio={consulta.datos?.data.length === 0 ? 'Sin cambios registrados.' : undefined} />
    {!!consulta.datos?.data.length && <ol className="grid gap-2">
      {consulta.datos.data.map((evento) => (
        <li key={evento.necesidad_evento_id}>
          <Card className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <EstadoNecesidad valor={evento.estado} />
              <span className="text-sm text-ink-2">{evento.prioridad_anterior && evento.prioridad_anterior !== evento.prioridad
                ? `Prioridad: ${evento.prioridad_anterior} → ${evento.prioridad}` : `Prioridad ${evento.prioridad}`}</span>
            </div>
            {!!(evento.responsable_anterior || evento.responsable) && evento.responsable_anterior !== evento.responsable &&
              <p className="text-sm text-ink-2 wrap-anywhere">Responsable: {evento.responsable ?? 'Sin asignar'}</p>}
            <div className="flex flex-wrap gap-x-2 text-sm text-muted">
              <time dateTime={evento.fecha}>{fechaHora(evento.fecha)}</time>
              {evento.actor && <span className="wrap-anywhere">· {evento.actor}</span>}
            </div>
            {evento.motivo && <p className="text-sm whitespace-pre-line wrap-anywhere">{evento.motivo}</p>}
          </Card>
        </li>
      ))}
    </ol>}
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </section>
}

function DetalleNecesidad({ base, token, cuenta, id, reciente, cola, revision, cambio, adultoActivo }: OperacionProps & {
  id: string; reciente?: Necesidad; cola: ColaOperaciones; revision: number; cambio: () => void; adultoActivo?: boolean
}) {
  const [gestion, fijarGestion] = useState<'prioridad' | 'estado'>()
  const [estado, fijarEstado] = useState('')
  const enLinea = useConexionReal()
  const ruta = `${base}/necesidades/${idRuta(id)}`
  const consulta = useDatos<Necesidad>(ruta, token, revision)
  const puedeSinConexion = cuenta.permisos.includes('sync:usar')
  const necesidad = consulta.datos ?? (!enLinea && !consulta.error && puedeSinConexion ? reciente : undefined)
  if (!necesidad) return <Estado consulta={consulta} />

  const pendiente = cola.capturas.some((c) => c.cuentaId === cuenta.cuenta_id
    && c.operacion.entidad === 'necesidad' && c.operacion.registro_id === id)
  const puedeEditar = adultoActivo !== false && cuenta.permisos.includes('necesidades:actualizar')
    && necesidad.envejeciente_estado === 'activo' && TRANSICIONES[necesidad.estado].length > 0 && !pendiente
  const cierre = estado === 'resuelta' || estado === 'cancelada'
  const cerrar = () => { fijarGestion(undefined); fijarEstado('') }
  return <>
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted wrap-anywhere">{necesidad.tipo_necesidad_nombre}</p>
          <h2 className="text-xl font-bold wrap-anywhere">{necesidad.necesidad_nombre}</h2>
        </div>
        <EstadoNecesidad valor={necesidad.estado} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Datum label="Adulto mayor" value={necesidad.envejeciente_nombre} />
        <Datum label="Prioridad" value={necesidad.prioridad} />
        <Datum label="Registrada" value={fechaHora(necesidad.fecha_necesidad)} />
        <Datum label="Responsable" value={necesidad.responsable ?? 'Sin asignar'} />
        {necesidad.cantidad !== null && <Datum label="Cantidad" value={`${necesidad.cantidad} ${necesidad.unidad_medida ?? ''}`.trim()} />}
        {necesidad.fecha_resolucion && <Datum label="Fecha de resolución" value={fechaHora(necesidad.fecha_resolucion)} />}
        {necesidad.indicacion_medica_id && <Datum label="Indicación médica" value="Vinculada al expediente" />}
        {necesidad.es_recurrente && <Datum label="Recurrencia" value="Recurrente" />}
      </div>
      {necesidad.descripcion && <section className="grid gap-1">
        <h3 className="font-semibold">Descripción</h3>
        <p className="text-sm text-ink-2 whitespace-pre-line wrap-anywhere">{necesidad.descripcion}</p>
      </section>}
      {necesidad.motivo_resolucion && <section className="grid gap-1">
        <h3 className="font-semibold">Motivo de resolución</h3>
        <p className="text-sm text-ink-2 whitespace-pre-line wrap-anywhere">{necesidad.motivo_resolucion}</p>
      </section>}
      {necesidad.envejeciente_estado !== 'activo' &&
        <p className="text-sm text-ink-2">Los cambios requieren un expediente activo.</p>}
      {puedeEditar && !gestion && <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={!enLinea} onClick={() => fijarGestion('prioridad')}>Editar prioridad y responsable</Button>
        <Button size="sm" disabled={!enLinea && !puedeSinConexion} onClick={() => fijarGestion('estado')}>Cambiar estado</Button>
      </div>}
    </Card>
    {puedeEditar && gestion === 'prioridad' && <EditarNecesidad base={base} token={token} ruta={ruta} necesidad={necesidad}
      cancelar={cerrar} guardada={() => { cerrar(); cambio() }} />}
    {puedeEditar && gestion === 'estado' && <Formulario titulo="Cambiar estado de la necesidad" accion="Confirmar estado"
      disabled={!enLinea && !puedeSinConexion} submitDisabled={!estado} cancelar={cerrar} campos={[]}
      enviar={async (datos) => {
        const motivo = campo(datos, 'motivo')
        if (cierre && motivo.length < 3) throw new Error('Escribe el motivo del cierre.')
        const cuerpo = { estado, ...(cierre && { motivo }) }
        if (!navigator.onLine) {
          await cola.agregar(cuenta.cuenta_id, {
            entidad: 'necesidad', tipo: 'cambiar_estado', registro_id: id, datos: cuerpo,
            base_actualizado_en: new Date(necesidad.fecha_actualizacion).toISOString(),
          })
        } else {
          await api(`${ruta}/estado`, token, 'POST', cuerpo)
        }
        cerrar()
        cambio()
      }}>
      <SelectField label="Nuevo estado" required value={estado} placeholder="Selecciona el estado"
        options={TRANSICIONES[necesidad.estado].map((value) => ({ value, label: ESTADOS[value].nombre }))}
        onChange={(event) => fijarEstado(event.currentTarget.value)} />
      {cierre && <TextareaField label="Motivo del cierre" name="motivo" required minLength={3} maxLength={500} />}
    </Formulario>}
    <HistorialNecesidad ruta={ruta} token={token} revision={revision} />
  </>
}

function TarjetaNecesidad({ necesidad, abrir }: { necesidad: Necesidad; abrir: (id: string) => void }) {
  return (
    <Card className="grid h-full min-w-0 gap-3 sm:flex sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconTile size={40}><HandHelping size={20} aria-hidden /></IconTile>
        <div className="grid min-w-0 gap-1">
          <p className="text-xs text-muted wrap-anywhere">{necesidad.tipo_necesidad_nombre}</p>
          <h3 className="font-semibold text-ink wrap-anywhere">{necesidad.necesidad_nombre}</h3>
          <p className="text-sm text-ink-2 wrap-anywhere">{necesidad.envejeciente_nombre}</p>
          <div className="flex flex-wrap gap-1.5">
            <EstadoNecesidad valor={necesidad.estado} />
            <Badge>Prioridad {necesidad.prioridad}</Badge>
          </div>
          <time dateTime={necesidad.fecha_necesidad} className="text-xs text-muted">{fechaHora(necesidad.fecha_necesidad)}</time>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="justify-self-start" icon={<ChevronRight size={18} aria-hidden />} aria-label={`Ver necesidad: ${necesidad.necesidad_nombre}, ${necesidad.envejeciente_nombre}`}
        onClick={() => abrir(necesidad.envejeciente_necesidad_id)}>Ver necesidad</Button>
    </Card>
  )
}

function Responsables({ base, token, adulto, inicial }: Pick<OperacionProps, 'base' | 'token'> & { adulto: string; inicial?: Responsable }) {
  const [responsable, fijar] = useState(inicial)
  const consulta = usePagina<Responsable>(`${base}/envejecientes/${idRuta(adulto)}/necesidades/candidatos`, token, 0, { sort: ['nombre'] })
  const disponibles = consulta.datos?.data ?? []
  const opciones = responsable && !disponibles.some((item) => item.usuario_id === responsable.usuario_id)
    ? [responsable, ...disponibles] : disponibles
  return <div className="grid gap-2">
    <Estado consulta={consulta} />
    <SelectField label="Responsable (opcional)" name="responsable" value={responsable?.usuario_id ?? ''}
      onChange={(event) => fijar(opciones.find((item) => item.usuario_id === event.currentTarget.value))}
      options={[{ value: '', label: 'Sin asignar' }, ...opciones.map((item) => ({ value: item.usuario_id, label: item.nombre }))]} />
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </div>
}

function Indicaciones({ base, token, adulto }: Pick<OperacionProps, 'base' | 'token'> & { adulto: string }) {
  const [indicacion, fijar] = useState<Indicacion>()
  const consulta = usePagina<Indicacion>(`${base}/envejecientes/${idRuta(adulto)}/indicaciones`, token)
  const disponibles = consulta.datos?.data ?? []
  const opciones = indicacion && !disponibles.some((item) => item.indicacion_medica_id === indicacion.indicacion_medica_id)
    ? [indicacion, ...disponibles] : disponibles
  return <div className="grid gap-2">
    <Estado consulta={consulta} />
    <SelectField label="Indicación médica (opcional)" name="indicacion" value={indicacion?.indicacion_medica_id ?? ''}
      onChange={(event) => fijar(opciones.find((item) => item.indicacion_medica_id === event.currentTarget.value))}
      options={[{ value: '', label: 'Sin indicación vinculada' }, ...opciones.map((item) => ({
        value: item.indicacion_medica_id, label: `${item.titulo} · ${ESTADO_INDICACION[item.estado]}`,
      }))]} />
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </div>
}

function EditarNecesidad({ base, token, ruta, necesidad, cancelar, guardada }: Pick<OperacionProps, 'base' | 'token'> & {
  ruta: string; necesidad: Necesidad; cancelar: () => void; guardada: () => void
}) {
  const enLinea = useConexionReal()
  const prioridades = useDatos<Prioridad[]>('/catalogos/prioridades', token)
  const responsable = necesidad.usuario_responsable_id ? {
    usuario_id: necesidad.usuario_responsable_id,
    nombre: necesidad.responsable ?? 'Responsable actual',
  } : undefined
  return <Formulario titulo="Prioridad y responsable" campos={[]} accion="Guardar cambios" cancelar={cancelar}
    disabled={!enLinea} submitDisabled={!prioridades.datos?.length}
    enviar={async (datos) => {
      const prioridad = Number(campo(datos, 'prioridad'))
      const usuario = campo(datos, 'responsable') || null
      const cuerpo = {
        ...(prioridad !== necesidad.prioridad_id && { prioridad_id: prioridad }),
        ...(usuario !== necesidad.usuario_responsable_id && { usuario_responsable_id: usuario }),
      }
      if (!Object.keys(cuerpo).length) throw new Error('Cambia la prioridad o el responsable antes de guardar.')
      await api(ruta, token, 'PATCH', cuerpo)
      guardada()
    }}>
    <Estado consulta={prioridades} vacio={prioridades.datos?.length === 0 ? 'No hay prioridades disponibles.' : undefined} />
    {!!prioridades.datos?.length && <SelectField label="Prioridad" name="prioridad" required defaultValue={String(necesidad.prioridad_id)}
      options={prioridades.datos.map((item) => ({ value: String(item.prioridad_id), label: item.nombre }))} />}
    <Responsables base={base} token={token} adulto={necesidad.envejeciente_id} inicial={responsable} />
  </Formulario>
}

function RegistrarNecesidad({ base, token, cuenta, cola, adultoId, cancelar, registrada, adultos, tipos, items, prioridades }: OperacionProps & {
  cola: ColaOperaciones; adultoId?: string; cancelar: () => void; registrada: (nueva?: Necesidad) => void
  adultos: ReturnType<typeof usePagina<AdultoNombre>>
  tipos: ReturnType<typeof useDatos<TipoNecesidad[]>>
  items: ReturnType<typeof useDatos<ItemNecesidad[]>>
  prioridades: ReturnType<typeof useDatos<Prioridad[]>>
}) {
  const [adulto, fijarAdulto] = useState<AdultoNombre>()
  const [tipo, fijarTipo] = useState('')
  const [necesidad, fijarNecesidad] = useState('')
  const [prioridad, fijarPrioridad] = useState('')
  const [cantidad, fijarCantidad] = useState('')
  const [unidadSeleccionada, fijarUnidad] = useState('')
  const enLinea = useConexionReal()
  const necesidades = items.datos?.filter((item) => String(item.tipo_necesidad_id) === tipo)
  const opcionesAdulto = adultos.datos?.data ?? []
  const adultosVisibles = adulto && !opcionesAdulto.some((item) => item.envejeciente_id === adulto.envejeciente_id)
    ? [adulto, ...opcionesAdulto] : opcionesAdulto
  const id = adultoId ?? adulto?.envejeciente_id
  return <Formulario titulo="Registrar necesidad" campos={[]} accion="Registrar necesidad" cancelar={cancelar}
    disabled={!enLinea && !cuenta.permisos.includes('sync:usar')}
    submitDisabled={!id || !necesidad || !prioridad}
    enviar={async (datos) => {
      if (!id) return
      const descripcion = campo(datos, 'descripcion')
      if (descripcion.length < 5) throw new Error('Describe la necesidad en al menos 5 caracteres.')
      const unidad = unidadSeleccionada === 'otra' ? campo(datos, 'otra_unidad') : unidadSeleccionada
      const numero = Number(cantidad)
      const responsable = campo(datos, 'responsable')
      const indicacion = campo(datos, 'indicacion')
      const cuerpo = {
        necesidad_id: Number(necesidad),
        prioridad_id: Number(prioridad),
        descripcion,
        ...(cantidad && { cantidad: numero, unidad_medida: unidad }),
        ...(responsable && { usuario_responsable_id: responsable }),
        ...(indicacion && { indicacion_medica_id: indicacion }),
        ...(datos.has('recurrente') && { es_recurrente: true }),
      }
      if (cantidad && !(numero > 0 && numero <= 10000)) throw new Error('Indica una cantidad mayor que 0 y de hasta 10 000.')
      if (cantidad && !unidad) throw new Error('Indica la unidad de medida.')
      if (!navigator.onLine) {
        await cola.agregar(cuenta.cuenta_id, {
          entidad: 'necesidad', tipo: 'registrar', registro_id: crypto.randomUUID(),
          datos: { ...cuerpo, envejeciente_id: id },
        })
        registrada()
      } else {
        const nueva = await api<Necesidad>(`${base}/envejecientes/${idRuta(id)}/necesidades`, token, 'POST', cuerpo).catch((error: unknown) => {
          if (error instanceof ApiError && error.code === 'CONNECTION_UNAVAILABLE') {
            throw new Error('No se pudo confirmar el registro. Revisa tu conexión y comprueba si aparece en el listado antes de volver a enviarlo.')
          }
          throw error
        })
        registrada(nueva)
      }
    }}>
    {!adultoId && <>
      <Estado consulta={adultos} vacio={adultos.datos?.data.length === 0 ? 'Sin expedientes activos disponibles.' : undefined} />
      {adultos.datos && <>
        <SelectField label="Adulto mayor" required placeholder="Selecciona el expediente"
          value={adulto?.envejeciente_id ?? ''} onChange={(event) => fijarAdulto(adultosVisibles.find((item) => item.envejeciente_id === event.currentTarget.value))}
          options={adultosVisibles.map((item) => ({ value: item.envejeciente_id, label: `${item.nombres} ${item.apellidos}` }))} />
        <Paginador pagina={adultos.pagina} total={adultos.datos.meta.totalPages} cambiar={adultos.cambiar} />
      </>}
    </>}
    <Estado consulta={tipos} vacio={tipos.datos?.length === 0 ? 'El catálogo de categorías no tiene opciones.' : undefined} />
    {tipos.datos && <SelectField label="Categoría de la necesidad" required placeholder="Selecciona la categoría" value={tipo}
      onChange={(event) => { fijarTipo(event.currentTarget.value); fijarNecesidad('') }}
      options={tipos.datos.map((item) => ({ value: String(item.tipo_necesidad_id), label: item.nombre }))} />}
    {tipo && <Estado consulta={items} vacio={necesidades?.length === 0 ? 'Esta categoría no tiene necesidades disponibles.' : undefined} />}
    {tipo && necesidades && <SelectField label="Necesidad del catálogo" required placeholder="Selecciona la necesidad" value={necesidad}
      onChange={(event) => fijarNecesidad(event.currentTarget.value)}
      options={necesidades.map((item) => ({ value: String(item.necesidad_id), label: item.nombre }))} />}
    <Estado consulta={prioridades} vacio={prioridades.datos?.length === 0 ? 'No hay prioridades disponibles.' : undefined} />
    {prioridades.datos && <SelectField label="Prioridad" required placeholder="Selecciona la prioridad" value={prioridad}
      onChange={(event) => fijarPrioridad(event.currentTarget.value)}
      options={prioridades.datos.map((item) => ({ value: String(item.prioridad_id), label: item.nombre }))} />}
    <TextareaField label="Descripción" name="descripcion" required minLength={5} maxLength={500} rows={2}
      abreviaturas procesarAbreviaturas={false} hint="Admite abreviaturas." />
    <details className="rounded-sm border border-line-soft px-3 sm:col-span-2"
      onInvalid={(event) => { event.currentTarget.open = true }}>
      <summary className="min-h-12 cursor-pointer py-3 font-semibold">Datos opcionales</summary>
      <div className="grid gap-3 pb-3 sm:grid-cols-2">
        <TextField label="Cantidad (opcional)" type="number" value={cantidad} step="any" inputMode="decimal"
          hint="Si indicas una cantidad, selecciona su unidad."
          onChange={(event) => {
            const valor = event.currentTarget.value
            fijarCantidad(valor)
            if (!valor) fijarUnidad('')
          }} />
        {cantidad && <SelectField label="Unidad de medida" required placeholder="Selecciona la unidad" value={unidadSeleccionada}
          options={[...UNIDADES.map((value) => ({ value, label: value })), { value: 'otra', label: 'Otra unidad' }]}
          onChange={(event) => fijarUnidad(event.currentTarget.value)} />}
        {cantidad && unidadSeleccionada === 'otra' && <TextField label="Otra unidad de medida" name="otra_unidad" required maxLength={64} />}
        {id && <Responsables key={`responsables-${id}`} base={base} token={token} adulto={id} />}
        {id && cuenta.permisos.includes('indicaciones:ver') && <Indicaciones key={`indicaciones-${id}`} base={base} token={token} adulto={id} />}
        <Checkbox label="Es recurrente" name="recurrente" />
      </div>
    </details>
  </Formulario>
}

function ListaNecesidades({ base, token, adultoId, abrir, revision }: Pick<OperacionProps, 'base' | 'token'> & {
  adultoId?: string; abrir: (necesidad: Necesidad) => void; revision: number
}) {
  const [estado, fijarEstado] = useState('activas')
  const [prioridad, fijarPrioridad] = useState('')
  const [tipo, fijarTipo] = useState('')
  const [orden, fijarOrden] = useState('-fecha_necesidad')
  const tipos = useDatos<TipoNecesidad[]>('/catalogos/tipos-necesidad', token)
  const prioridades = useDatos<Prioridad[]>('/catalogos/prioridades', token)
  const consulta = usePagina<Necesidad>(`${base}/necesidades`, token, revision, {
    sort: [orden],
    filters: {
      ...(adultoId && { envejeciente_id: adultoId }),
      ...(estado === 'activas' ? { activas: true } : estado ? { estado } : {}),
      ...(prioridad && { prioridad_id: prioridad }),
      ...(tipo && { tipo_necesidad_id: tipo }),
    },
  })

  return <section className="grid gap-3" aria-label="Listado de necesidades">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SelectField label="Estado de la necesidad" value={estado} onChange={(event) => fijarEstado(event.currentTarget.value)}
        options={[{ value: 'activas', label: 'Activas' }, { value: '', label: 'Todos los estados' }, ...OPCIONES_ESTADO]} />
      <SelectField label="Tipo de necesidad" value={tipo} onChange={(event) => fijarTipo(event.currentTarget.value)}
        options={[{ value: '', label: 'Todos los tipos' }, ...(tipos.datos ?? []).map((item) => ({ value: String(item.tipo_necesidad_id), label: item.nombre }))]} />
      <SelectField label="Prioridad" value={prioridad} onChange={(event) => fijarPrioridad(event.currentTarget.value)}
        options={[{ value: '', label: 'Todas las prioridades' }, ...(prioridades.datos ?? []).map((item) => ({ value: String(item.prioridad_id), label: item.nombre }))]} />
      <SelectField label="Orden" value={orden} onChange={(event) => fijarOrden(event.currentTarget.value)}
        options={[{ value: '-fecha_necesidad', label: 'Más recientes primero' }, { value: 'prioridad', label: 'Mayor prioridad primero' }]} />
    </div>
    <Estado consulta={consulta} vacio={consulta.datos?.data.length === 0 ? 'Sin necesidades que coincidan con los filtros.' : undefined} />
    {!!consulta.datos?.data.length && <ul className="grid gap-3 lg:grid-cols-2">
      {consulta.datos.data.map((necesidad) => <li key={necesidad.envejeciente_necesidad_id} className="min-w-0">
        <TarjetaNecesidad necesidad={necesidad} abrir={() => abrir(necesidad)} />
      </li>)}
    </ul>}
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </section>
}

export function Necesidades({ adultoId, adultoActivo, cola, ...props }: OperacionProps & ExpedienteNecesidad & { cola: ColaOperaciones }) {
  const { base, token, cuenta } = props
  const [detalle, abrir] = useState<Necesidad>()
  const [registrar, mostrarRegistro] = useState(false)
  const [revisionLocal, actualizar] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const revision = revisionLocal + cola.revision
  const enLinea = useConexionReal()
  const puedeRegistrar = cuenta.permisos.includes('necesidades:registrar') && (!adultoId || adultoActivo)
  const tipos = useDatos<TipoNecesidad[]>(puedeRegistrar ? '/catalogos/tipos-necesidad' : null, token)
  const items = useDatos<ItemNecesidad[]>(puedeRegistrar ? '/catalogos/necesidades' : null, token)
  const prioridades = useDatos<Prioridad[]>(puedeRegistrar ? '/catalogos/prioridades' : null, token)
  const adultos = usePagina<AdultoNombre>(puedeRegistrar && !adultoId ? `${base}/envejecientes` : null,
    token, 0, { filters: { estado: 'activo' } })
  const puedeRegistrarOffline = cuenta.permisos.includes('sync:usar')
    && !!tipos.datos?.length && !!items.datos?.length && !!prioridades.datos?.length
    && (!!adultoId || !!adultos.datos?.data.length)
  const pendientes = cola.capturas.filter((item) => item.cuentaId === cuenta.cuenta_id && item.operacion.entidad === 'necesidad')
  const mensaje = cola.mensaje(cuenta.cuenta_id, 'necesidad')
  const cambio = () => actualizar((n) => n + 1)
  const vista = detalle ? 'detalle' : registrar ? 'registro' : 'lista'
  const vistaAnterior = useRef(vista)
  useEffect(() => {
    if (vista === vistaAnterior.current) return
    vistaAnterior.current = vista
    const destino = vista === 'lista' ? lista.current : panel.current
    destino?.focus({ preventScroll: true })
    destino?.scrollIntoView({ block: 'nearest' })
  }, [vista])

  return <section className="grid gap-3">
    {(pendientes.length > 0 || mensaje) && <div className="grid gap-2 rounded-sm border border-blue bg-blue-100 p-3">
      <p role="status" className="text-sm font-semibold">{pendientes.length} necesidad(es) pendiente(s) de sincronización. {mensaje}</p>
      {pendientes.length > 0 && <>
        <p className="text-sm">Las capturas se conservan mientras esta pestaña siga abierta.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!enLinea} onClick={() => cola.reintentar(cuenta.cuenta_id, 'necesidad')}>Reintentar sincronización</Button>
          {pendientes.some((captura) => captura.rechazada) && <Button size="sm" variant="outline" onClick={() => cola.quitarRechazadas(cuenta.cuenta_id, 'necesidad')}>Descartar capturas rechazadas</Button>}
        </div>
      </>}
    </div>}
    <div ref={lista} tabIndex={-1} hidden={vista !== 'lista'} className="space-y-3 outline-none">
      {puedeRegistrar && <Button size="sm" icon={<Plus size={18} aria-hidden />} disabled={!enLinea && !puedeRegistrarOffline} onClick={() => mostrarRegistro(true)}>
        Registrar necesidad
      </Button>}
      {puedeRegistrar && !enLinea && !puedeRegistrarOffline &&
        <p className="text-sm text-ink-2">Conéctate para consultar expedientes y catálogos antes de registrar sin conexión.</p>}
      <ListaNecesidades base={base} token={token} adultoId={adultoId} abrir={abrir} revision={revision} />
    </div>
    {vista !== 'lista' && <div ref={panel} tabIndex={-1} className="grid gap-3 outline-none">
      {registrar && puedeRegistrar && <RegistrarNecesidad {...props} cola={cola} adultoId={adultoId}
        adultos={adultos} tipos={tipos} items={items} prioridades={prioridades}
        cancelar={() => mostrarRegistro(false)} registrada={(nueva) => {
          mostrarRegistro(false)
          cambio()
          abrir(nueva)
        }} />}
      {detalle && <>
        <div><Button variant="outline" size="sm" onClick={() => abrir(undefined)}>Volver a necesidades</Button></div>
        <DetalleNecesidad {...props} id={detalle.envejeciente_necesidad_id} reciente={detalle} cola={cola}
          adultoActivo={adultoActivo} revision={revision} cambio={cambio} />
      </>}
    </div>}
  </section>
}
