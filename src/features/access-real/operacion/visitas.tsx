/*
 * Visitas conectadas: programación, registro autorizado e historial · RF-02, RF-10.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { ArrowLeft, CalendarDays, CalendarPlus, CircleUserRound, Frown, Meh, Smile, WifiOff, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Checkbox, CheckboxGroup, IconTile, Segmented, SelectField, TextareaField, type Tone } from '@/components/ui'
import { ASPECTOS_VISITA } from '@/domain/catalogos'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import type { CollectionQuery } from '@/lib/api-contract'
import { api, type CuentaMe, type RolCuenta } from '../client'
import { campo, Estado, Formulario, idRuta, Paginador, useConexionReal, useDatos, usePagina, type Campo } from './controles'
import type { ColaVisitas } from './cola-visitas'
import { Evidencias } from './visitas-evidencias'
import { fechaDominicana } from './visitas-fechas'

export interface AdultoNombre { envejeciente_id: string; nombres: string; apellidos: string }
export interface Candidato { usuario_id: string; membresia_id: string; cuidador_id: string | null; nombre: string; rol: RolCuenta }
export interface OperacionProps { base: string; token: string; cuenta: CuentaMe; usuarioId: string }

interface Persona { usuario_id: string; nombres?: string; apellidos?: string }
interface Visita {
  visita_id: string
  fecha: string
  hora_programada: string | null
  hora_inicio?: string | null
  hora_fin?: string | null
  razon: string
  notas?: string | null
  estado: 'programada' | 'en_curso' | 'completada' | 'cancelada'
  motivo_cancelacion?: string | null
  checklist?: string[]
  fecha_actualizacion: string
  autorizada_por: Persona | null
  participantes: Persona[]
  adultos: (AdultoNombre & { observacion?: string | null; estado_general?: string | null })[]
}

type Vista = 'hoy' | 'proximas' | 'historial'
const VISTAS: Array<{ value: Vista; label: string }> = [
  { value: 'hoy', label: 'Hoy' }, { value: 'proximas', label: 'Próximas' }, { value: 'historial', label: 'Historial' },
]
const ESTADOS: Record<Visita['estado'], { texto: string; tono: Tone }> = {
  programada: { texto: 'Programada', tono: 'info' },
  en_curso: { texto: 'En curso', tono: 'warning' },
  completada: { texto: 'Completada', tono: 'success' },
  cancelada: { texto: 'Cancelada', tono: 'danger' },
}
const RESULTADOS = [
  { value: 'estable', label: 'Estable', Icono: Smile },
  { value: 'requiere_atencion', label: 'Requiere atención', Icono: Meh },
  { value: 'situacion_critica', label: 'Situación crítica', Icono: Frown },
]
const permite = (cuenta: CuentaMe, permiso: string) => cuenta.permisos.includes(permiso)
const nombre = (persona: { nombres?: string; apellidos?: string }) => [persona.nombres, persona.apellidos].filter(Boolean).join(' ')
const hora = (valor: string | null | undefined) => valor ? hhmmA12(valor) : 'Sin hora'

type Opcion = { id: string; etiqueta: string }
type PaginaOpciones = Pick<ReturnType<typeof usePagina>, 'pagina' | 'cambiar'> & { total: number }

function SeleccionMultiple({ titulo, opciones, seleccionadas, maximo, pagina, cambiar }: {
  titulo: string; opciones: Opcion[]; seleccionadas: Opcion[]; maximo: number; pagina?: PaginaOpciones
  cambiar: (opciones: Opcion[]) => void
}) {
  return (
    <fieldset className="grid min-w-0 gap-2 rounded-sm border border-line-soft bg-bg p-3">
      <legend className="px-1 text-sm font-semibold">{titulo} ({seleccionadas.length}/{maximo})</legend>
      {!!seleccionadas.length && <ul aria-label={`${titulo} seleccionados`} className="flex flex-wrap gap-1.5">
        {seleccionadas.map((opcion) => <li key={opcion.id} className="min-w-0 max-w-full">
          <button type="button" aria-label={`Quitar ${opcion.etiqueta}`} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-pill bg-blue-100 px-3 text-left text-sm font-semibold text-navy hover:bg-blue-200"
            onClick={() => cambiar(seleccionadas.filter((seleccionada) => seleccionada.id !== opcion.id))}>
            <span className="wrap-anywhere">{opcion.etiqueta}</span><X size={16} className="shrink-0" aria-hidden />
          </button>
        </li>)}
      </ul>}
      {opciones.map((opcion) => {
        const marcada = seleccionadas.some((seleccionada) => seleccionada.id === opcion.id)
        return <Checkbox key={opcion.id} label={opcion.etiqueta} checked={marcada}
          disabled={!marcada && seleccionadas.length >= maximo}
          onChange={() => cambiar(marcada ? seleccionadas.filter((seleccionada) => seleccionada.id !== opcion.id) : [...seleccionadas, opcion])} />
      })}
      {pagina && <Paginador pagina={pagina.pagina} total={pagina.total} cambiar={pagina.cambiar} />}
    </fieldset>
  )
}

function Programar({ base, token, listo, volver }: Pick<OperacionProps, 'base' | 'token'> & { listo: (visita: Visita) => void; volver: () => void }) {
  const adultos = usePagina<AdultoNombre>(`${base}/envejecientes`, token, 0, { filters: { estado: 'activo' } })
  const personas = usePagina<Candidato>(`${base}/candidatos/visita`, token)
  const [seleccionAdultos, setAdultos] = useState<Opcion[]>([])
  const [seleccionPersonas, setPersonas] = useState<Opcion[]>([])
  const enLinea = useConexionReal()
  const campos: Campo[] = [
    { name: 'fecha', label: 'Fecha de visita', type: 'date', min: fechaDominicana() },
    { name: 'hora', label: 'Hora de visita', type: 'time', hint: 'Hora de República Dominicana.' },
    { name: 'razon', label: 'Motivo de la visita', min: 3, max: 120 },
    { name: 'notas', label: 'Notas (opcional)', type: 'textarea', optional: true, max: 300 },
  ]
  const prepararPagina = (consulta: typeof adultos | typeof personas) =>
    consulta.datos && { pagina: consulta.pagina, total: consulta.datos.meta.totalPages, cambiar: consulta.cambiar }

  return <Formulario titulo="Programar y autorizar visita" campos={campos} accion="Programar visita" cancelar={volver} disabled={!enLinea}
    submitDisabled={!seleccionAdultos.length || !seleccionPersonas.length}
    enviar={async (datos) => {
      if (!seleccionAdultos.length || !seleccionPersonas.length) throw new Error('Selecciona al menos un adulto y una persona visitante.')
      const visita = await api<Visita>(`${base}/visitas`, token, 'POST', {
        fecha: campo(datos, 'fecha'), hora_programada: campo(datos, 'hora'), razon: campo(datos, 'razon'),
        notas: campo(datos, 'notas') || undefined, envejeciente_ids: seleccionAdultos.map((adulto) => adulto.id),
        participante_ids: seleccionPersonas.map((persona) => persona.id),
      })
      listo(visita)
    }}>
    <div className="grid gap-2">
      <Estado consulta={adultos} vacio={adultos.datos?.data.length === 0 ? 'Sin adultos activos disponibles.' : undefined} />
      <SeleccionMultiple titulo="Adultos de la visita" opciones={adultos.datos?.data.map((adulto) => ({ id: adulto.envejeciente_id, etiqueta: nombre(adulto) })) ?? []}
        seleccionadas={seleccionAdultos} maximo={4} pagina={prepararPagina(adultos)} cambiar={setAdultos} />
    </div>
    <div className="grid gap-2">
      <Estado consulta={personas} vacio={personas.datos?.data.length === 0 ? 'Sin participantes disponibles.' : undefined} />
      <SeleccionMultiple titulo="Visitantes autorizados" opciones={personas.datos?.data.map((persona) => ({ id: persona.usuario_id, etiqueta: persona.nombre })) ?? []}
        seleccionadas={seleccionPersonas} maximo={3} pagina={prepararPagina(personas)} cambiar={setPersonas} />
    </div>
    <p className="text-sm text-muted md:col-span-2">Selecciona al menos un adulto y un visitante. Al programar la visita, autorizas a esas personas a registrarla.</p>
  </Formulario>
}

function RegistroVisita({ visita, voluntario, enviar, volver, deshabilitado }: {
  visita: Visita; voluntario: boolean; enviar: (datos: object) => Promise<void>; volver: () => void; deshabilitado: boolean
}) {
  const [checklist, setChecklist] = useState<string[]>([])
  return <Formulario titulo="Registrar realización" campos={[]} accion="Registrar visita" cancelar={volver} disabled={deshabilitado}
    enviar={async (datos) => {
      const detalles = visita.adultos.map((adulto) => ({
        envejeciente_id: adulto.envejeciente_id,
        ...(!voluntario ? { estado_general: campo(datos, `estado-${adulto.envejeciente_id}`) } : {}),
        observacion: campo(datos, `observacion-${adulto.envejeciente_id}`),
      }))
      if (detalles.some((detalle) => detalle.observacion.length < 3)) throw new Error('Escribe una observación de al menos 3 caracteres por adulto.')
      await enviar({ detalles, ...(checklist.length ? { checklist } : {}) })
    }}>
    <div className="grid gap-4 md:col-span-2">
      {visita.adultos.map((adulto) => <section key={adulto.envejeciente_id} className="grid gap-4">
        <div className="flex items-center gap-3">
          <IconTile size={56}><CircleUserRound size={32} aria-hidden /></IconTile>
          <h4 className="text-xl font-bold wrap-anywhere">{nombre(adulto)}</h4>
        </div>
        {!voluntario && <fieldset className="min-w-0">
          <legend className="mb-2 font-semibold">Estado en la visita de {nombre(adulto)}</legend>
          <div className="grid grid-cols-3 gap-2">
            {RESULTADOS.map(({ value, label, Icono }) => <label key={value} className="flex min-h-[76px] min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-blue bg-bg p-1.5 text-center text-xs font-semibold leading-tight has-checked:border-navy has-checked:bg-navy has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue sm:text-sm">
              <input type="radio" className="sr-only" name={`estado-${adulto.envejeciente_id}`} value={value} required />
              <Icono size={22} aria-hidden /> <span>{label}</span>
            </label>)}
          </div>
        </fieldset>}
        <div className="rounded-sm bg-blue-100 p-3">
          <TextareaField label={`Observación de ${nombre(adulto)}`} name={`observacion-${adulto.envejeciente_id}`}
            required minLength={3} maxLength={1000} rows={4} placeholder="Describe lo observado durante la visita" />
        </div>
      </section>)}
      {!voluntario && <CheckboxGroup label="Aspectos verificados (opcional)" options={ASPECTOS_VISITA} value={checklist} onChange={setChecklist} />}
    </div>
  </Formulario>
}

function TarjetaVisita({ visita, abrir }: { visita: Visita; abrir: () => void }) {
  const titular = visita.adultos[0]
  const estado = ESTADOS[visita.estado]
  return <Card className="grid gap-3 bg-bg">
    <div className="flex items-start gap-3">
      <IconTile><CalendarDays size={24} aria-hidden /></IconTile>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold wrap-anywhere">{titular ? nombre(titular) : visita.razon}</h3>
        <p className="text-sm font-semibold">{hora(visita.hora_programada)} · {fechaCorta(visita.fecha)}</p>
        {titular && <p className="text-sm text-muted wrap-anywhere">{visita.razon}</p>}
        {visita.adultos.length > 1 && <p className="text-sm text-muted">+{visita.adultos.length - 1} en la visita</p>}
      </div>
      <Badge tone={estado.tono}>{estado.texto}</Badge>
    </div>
    <Button variant="light" size="sm" fullWidth aria-label={`Ver más: ${visita.razon}${titular ? ` · ${nombre(titular)}` : ''}`} onClick={abrir}>Ver más</Button>
  </Card>
}

function ResumenVisitas({ hoy, proximas, total }: { hoy?: number; proximas?: number; total?: number }) {
  return <dl className="grid grid-cols-2 gap-2" aria-label="Resumen de visitas">
    <div className="col-span-2 flex items-end justify-between gap-2 rounded-sm border border-line bg-teal-100 px-4 py-3">
      <div>
        <dt className="text-sm font-semibold sm:text-base">Visitas programadas para hoy</dt>
        <dd className="text-4xl font-bold leading-tight">{hoy ?? '—'}</dd>
      </div>
      <CalendarDays className="shrink-0 text-success-700" size={28} aria-hidden />
    </div>
    <div className="rounded-sm border border-line bg-teal-100 px-4 py-3">
      <dt className="text-sm font-semibold">Visitas próximas</dt><dd className="text-3xl font-bold">{proximas ?? '—'}</dd>
    </div>
    <div className="rounded-sm border border-line bg-teal-100 px-4 py-3">
      <dt className="text-sm font-semibold">Total de visitas</dt><dd className="text-3xl font-bold">{total ?? '—'}</dd>
    </div>
  </dl>
}

function DatosVisita({ visita, enCurso }: { visita: Visita; enCurso: boolean }) {
  const estado = ESTADOS[enCurso ? 'en_curso' : visita.estado]
  const quienes = visita.participantes.map(nombre).filter(Boolean).join(', ')
  return <Card className="grid gap-3 bg-bg">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xl font-bold wrap-anywhere">{visita.razon}</h3>
      <Badge tone={estado.tono}>{estado.texto}</Badge>
    </div>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      <div><dt className="text-muted">Fecha</dt><dd className="font-semibold">{fechaCorta(visita.fecha)}</dd></div>
      <div><dt className="text-muted">Hora pautada</dt><dd className="font-semibold">{hora(visita.hora_programada)}</dd></div>
      {visita.hora_inicio && <div><dt className="text-muted">Hora de inicio</dt><dd className="font-semibold">{hora(visita.hora_inicio)}</dd></div>}
      {visita.hora_fin && <div><dt className="text-muted">Hora de fin</dt><dd className="font-semibold">{hora(visita.hora_fin)}</dd></div>}
      {quienes && <div className="col-span-full"><dt className="text-muted">Visitantes</dt><dd className="font-semibold wrap-anywhere">{quienes}</dd></div>}
    </dl>
    {visita.notas && <p className="rounded-sm bg-blue-100 p-3 text-sm whitespace-pre-line"><strong>Notas</strong><br />{visita.notas}</p>}
    {visita.motivo_cancelacion && <p className="rounded-sm bg-danger-100 p-3 text-sm"><strong>Motivo de cancelación:</strong> {visita.motivo_cancelacion}</p>}
    {!!visita.checklist?.length && <p className="text-sm"><strong>Aspectos verificados:</strong> {ASPECTOS_VISITA.filter((opcion) => visita.checklist?.includes(opcion.value)).map(({ label }) => label).join(', ')}</p>}
  </Card>
}

export function Visitas({ base, token, cuenta, usuarioId, cola }: OperacionProps & { cola: ColaVisitas }) {
  const [params, setParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const [vista, setVista] = useState<Vista>('hoy')
  const [historial, setHistorial] = useState('completada')
  const [aviso, setAviso] = useState('')
  const enLinea = useConexionReal()
  const id = params.get('visita')
  const accion = params.get('accion')
  const puedeProgramar = permite(cuenta, 'visitas:programar') && permite(cuenta, 'visitas:autorizar')
  const programando = accion === 'programar' && puedeProgramar
  const actualizar = () => setRevision((r) => r + 1)
  const recarga = revision + cola.revision
  const hoy = fechaDominicana()
  const manana = fechaDominicana(1)
  const rutaListado = id || programando ? null : `${base}/visitas`
  const ruta = id ? `${base}/visitas/${idRuta(id)}` : null
  const filtrosHoy = { desde: hoy, hasta: hoy }
  const filtrosProximas = { desde: manana, estado: 'programada' }
  const consulta: Omit<CollectionQuery, 'page'> = vista === 'historial'
    ? { filters: { estado: historial } }
    : { filters: vista === 'hoy' ? filtrosHoy : filtrosProximas, sort: ['fecha', 'hora_programada'] }
  const listado = usePagina<Visita>(rutaListado, token, recarga, consulta)
  const total = usePagina<Visita>(rutaListado, token, recarga, { limit: 1 })
  const hoyProgramadas = usePagina<Visita>(rutaListado, token, recarga, { limit: 1, filters: { ...filtrosHoy, estado: 'programada' } })
  const proximas = usePagina<Visita>(vista === 'proximas' ? null : rutaListado, token, recarga, { limit: 1, filters: filtrosProximas })
  const detalle = useDatos<Visita>(ruta, token, recarga)
  const visita = detalle.datos
  const pendientes = cola.capturas.filter((captura) => captura.cuentaId === cuenta.cuenta_id)
  const accionesPendientes = pendientes.filter((captura) => captura.operacion.registro_id === id)
  const enCurso = visita?.estado === 'en_curso' || accionesPendientes.some((captura) => !captura.rechazada && captura.operacion.tipo === 'iniciar')
  const registroPendiente = accionesPendientes.some((captura) => captura.operacion.tipo === 'registrar')
  const abierta = visita?.estado === 'programada' || visita?.estado === 'en_curso'
  const participante = visita?.participantes.some((persona) => persona.usuario_id === usuarioId) === true
  const autorizada = !!visita?.autorizada_por && !!visita.hora_programada && participante
  const puedeRegistrar = permite(cuenta, 'visitas:registrar') && autorizada
  const puedeCapturar = enLinea || permite(cuenta, 'sync:usar')
  const registrando = accion === 'registrar' && abierta && enCurso && puedeRegistrar && !registroPendiente
  const abrir = (visitaId: string, panel?: string) => setParams({ visita: visitaId, ...(panel ? { accion: panel } : {}) })
  const volver = () => setParams({})
  const cambiarVista = (nueva: Vista) => { setVista(nueva); setAviso('') }
  const enviar = async (tipo: 'iniciar' | 'registrar', datos: object = {}) => {
    if (!visita || !ruta || !puedeRegistrar) return
    if (!navigator.onLine && permite(cuenta, 'sync:usar')) {
      cola.agregar(cuenta.cuenta_id, visita.visita_id, visita.fecha_actualizacion, tipo, datos)
    } else {
      await api(`${ruta}/${tipo}`, token, 'POST', datos)
      actualizar()
    }
    if (tipo === 'registrar') abrir(visita.visita_id)
  }

  return <section className="grid gap-4" aria-label="Visitas y seguimiento">
    {(pendientes.length > 0 || cola.mensaje) && <div className="grid gap-2 rounded-sm border border-blue bg-blue-100 p-3" role="status">
      <p className="text-sm font-semibold">{pendientes.length} pendiente(s) en esta cuenta. {cola.mensaje}</p>
      {pendientes.length > 0 && <p className="text-sm">Las capturas se conservan mientras esta pestaña siga abierta.</p>}
      {pendientes.length > 0 && <Button size="sm" variant="outline" disabled={!enLinea} onClick={cola.reintentar}>Reintentar sincronización</Button>}
      {pendientes.some((captura) => captura.rechazada) && <Button size="sm" variant="outline" onClick={() => cola.quitarRechazadas(cuenta.cuenta_id)}>Descartar capturas rechazadas</Button>}
    </div>}
    {aviso && <p className="rounded-sm bg-teal-100 p-3 text-sm font-semibold" role="status">{aviso}</p>}
    {(id || programando) && <Button size="sm" variant="ghost" className="justify-self-start" icon={<ArrowLeft size={18} aria-hidden />}
      onClick={() => id && (registrando || accion === 'cancelar') ? abrir(id) : volver()}>{registrando || accion === 'cancelar' ? 'Volver al detalle' : 'Volver a visitas'}</Button>}
    {programando && <Programar base={base} token={token} volver={volver} listo={(creada) => {
      actualizar(); setAviso('Visita programada y participantes autorizados.'); setVista(creada.fecha === hoy ? 'hoy' : 'proximas'); abrir(creada.visita_id)
    }} />}
    {rutaListado && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">Mis visitas</h2>
        {puedeProgramar && <Button size="sm" disabled={!enLinea} icon={<CalendarPlus size={20} aria-hidden />} onClick={() => setParams({ accion: 'programar' })}>Programar visita</Button>}
      </div>
      <ResumenVisitas hoy={hoyProgramadas.datos?.meta.total} proximas={(vista === 'proximas' ? listado : proximas).datos?.meta.total} total={total.datos?.meta.total} />
      <Segmented label="Período de visitas" options={VISTAS} value={vista} onChange={cambiarVista} />
      {vista === 'historial' && <SelectField label="Estado del historial" value={historial} onChange={(evento) => setHistorial(evento.currentTarget.value)} options={[
        { value: 'completada', label: 'Completadas' }, { value: 'cancelada', label: 'Canceladas' },
      ]} />}
      <Estado consulta={listado} vacio={listado.datos?.data.length === 0 ? 'No hay visitas en este período.' : undefined} />
      <div className="grid gap-3 sm:grid-cols-2">
        {listado.datos?.data.map((item) => <TarjetaVisita key={item.visita_id} visita={item} abrir={() => abrir(item.visita_id)} />)}
      </div>
      {listado.datos && <Paginador pagina={listado.pagina} total={listado.datos.meta.totalPages} cambiar={listado.cambiar} />}
    </>}
    {id && <Estado consulta={detalle} />}
    {visita && ruta && <section key={visita.visita_id} className="grid gap-4">
      <h2 className="text-xl font-bold">{registrando ? 'Registrar visita' : 'Detalle de visita'}</h2>
      {!enLinea && <p className="flex items-center gap-2 rounded-sm bg-blue-100 p-3 text-sm"><WifiOff size={18} aria-hidden /> {puedeCapturar ? 'Sin conexión. Las capturas autorizadas se enviarán al reconectar.' : 'Conéctate a internet para registrar cambios.'}</p>}
      <DatosVisita visita={visita} enCurso={enCurso} />
      {!registrando && visita.adultos.map((adulto) => <Card key={adulto.envejeciente_id} className="grid gap-2 bg-bg">
        <div className="flex items-center gap-3">
          <IconTile><CircleUserRound size={27} aria-hidden /></IconTile>
          <div className="min-w-0">
            <h3 className="font-bold wrap-anywhere">{nombre(adulto)}</h3>
            {adulto.estado_general && <p className="text-sm">{RESULTADOS.find((resultado) => resultado.value === adulto.estado_general)?.label}</p>}
          </div>
        </div>
        {adulto.observacion && <p className="text-sm text-ink-2 whitespace-pre-line wrap-anywhere">{adulto.observacion}</p>}
      </Card>)}
      {(visita.estado === 'en_curso' || visita.estado === 'completada') && (puedeRegistrar || permite(cuenta, 'visitas:autorizar')) &&
        <Evidencias ruta={ruta} token={token} puedeAdjuntar={puedeRegistrar && !registroPendiente} revision={recarga} refrescar={actualizar} />}
      {registrando ? <RegistroVisita visita={visita} voluntario={cuenta.rol === 'voluntario'} deshabilitado={!puedeCapturar}
        enviar={(datos) => enviar('registrar', datos)} volver={() => abrir(visita.visita_id)} />
        : <>
          {puedeRegistrar && abierta && !enCurso && <Formulario titulo="Iniciar visita autorizada" campos={[]} accion="Iniciar visita"
            disabled={!puedeCapturar || accionesPendientes.some((captura) => captura.operacion.tipo === 'iniciar')} enviar={() => enviar('iniciar')} />}
          {puedeRegistrar && abierta && enCurso && !registroPendiente && visita.adultos.length > 0 &&
            <Button size="sm" disabled={!puedeCapturar} onClick={() => abrir(visita.visita_id, 'registrar')}>Registrar realización</Button>}
          {abierta && permite(cuenta, 'visitas:programar') && (accion === 'cancelar'
            ? <Formulario titulo="Cancelar visita" accion="Confirmar cancelación" cancelar={() => abrir(visita.visita_id)} disabled={!enLinea}
                campos={[{ name: 'motivo', label: 'Motivo de cancelación', type: 'textarea', min: 3, max: 300 }]}
                enviar={async (datos) => {
                  await api(`${ruta}/cancelar`, token, 'POST', { motivo: campo(datos, 'motivo') })
                  actualizar()
                  abrir(visita.visita_id)
                }} />
            : <Button size="sm" variant="danger-soft" disabled={!enLinea} onClick={() => abrir(visita.visita_id, 'cancelar')}>Cancelar visita</Button>)}
        </>}
    </section>}
  </section>
}

export { Evidencias } from './visitas-evidencias'
