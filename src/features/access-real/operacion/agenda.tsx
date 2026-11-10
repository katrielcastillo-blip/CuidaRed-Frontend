/*
 * Agenda de cuidado y evidencias conectadas · RF-16, RS-013.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { ArrowLeft, CalendarDays, CalendarPlus, ClipboardCheck, Repeat, UserRound, WifiOff } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Checkbox, CheckboxGroup, ChoicePills, IconTile, SelectField, TextField, type Tone } from '@/components/ui'
import { MAX_OCURRENCIAS, fechasDeSerie, type Repeticion } from '@/domain/recurrencia'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import { VistaPreviaSerie } from '@/features/agenda/components/RepeticionCampos'
import { sumarDias } from '@/features/agenda/lib/fechas'
import { api } from '../client'
import { campo, Estado, Formulario, idRuta, Paginador, useConexionReal, useDatos, usePagina } from './controles'
import type { AdultoNombre, Candidato, OperacionProps } from './visitas'
import { Evidencias } from './visitas-evidencias'
import { fechaDominicana } from './visitas-fechas'

interface Tarea {
  tarea_id: string
  envejeciente_id: string
  envejeciente_nombre: string
  cuidador_id: string
  cuidador_nombre: string
  indicacion_medica_id?: string | null
  indicacion_titulo?: string | null
  prioridad_id?: number
  prioridad?: string
  titulo: string
  fecha_programada: string
  hora_programada: string | null
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'cancelada'
  requiere_evidencia: boolean
  es_repetitiva: boolean
  es_historica?: boolean
  motivo_cancelacion?: string | null
  ultimo_motivo_rechazo?: string | null
  evidencias: { validadas: number; pendientes?: number; rechazadas?: number }
}

type Opcion = { value: string; label: string }
const ESTADOS: Record<Tarea['estado'], { texto: string; tono: Tone }> = {
  pendiente: { texto: 'Pendiente', tono: 'warning' },
  en_progreso: { texto: 'En progreso', tono: 'info' },
  completada: { texto: 'Completada', tono: 'success' },
  cancelada: { texto: 'Cancelada', tono: 'neutral' },
}
const PRIORIDADES: Record<string, Tone> = { alta: 'danger', media: 'warning', baja: 'success' }
const REPETICIONES: Array<{ value: Repeticion; label: string }> = [
  { value: 'ninguna', label: 'No se repite' }, { value: 'diaria', label: 'Diaria' }, { value: 'semanal', label: 'Semanal' },
]
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((label, i) => ({ label, value: String(i + 1) }))
type Alcance = 'esta' | 'siguientes'
const ALCANCES: Array<{ value: Alcance; label: string }> = [
  { value: 'esta', label: 'Solo esta tarea' }, { value: 'siguientes', label: 'Esta y las siguientes' },
]
const abierta = (tarea: Tarea) => tarea.estado === 'pendiente' || tarea.estado === 'en_progreso'
const fechaHora = (tarea: Tarea) => `${fechaCorta(tarea.fecha_programada)} · ${tarea.hora_programada ? hhmmA12(tarea.hora_programada) : 'Sin hora fija'}`

function SelectorPaginado({ label, opciones, seleccion, elegir, consulta, required, vacio, opcionVacia = 'Todos' }: {
  label: string
  opciones: Opcion[]
  seleccion: Opcion | undefined
  elegir: (opcion: Opcion | undefined) => void
  consulta: ReturnType<typeof usePagina>
  required?: boolean
  vacio?: string
  opcionVacia?: string
}) {
  const actuales = seleccion && !opciones.some((opcion) => opcion.value === seleccion.value) ? [seleccion, ...opciones] : opciones
  return <div className="grid min-w-0 gap-2">
    <SelectField label={label} value={seleccion?.value ?? ''} onChange={(evento) => elegir(actuales.find((opcion) => opcion.value === evento.currentTarget.value))}
      options={required ? actuales : [{ value: '', label: opcionVacia }, ...actuales]} required={required}
      disabled={required && (!!consulta.error || !consulta.datos || actuales.length === 0)}
      placeholder={required ? 'Selecciona una opción' : undefined} />
    <Estado consulta={consulta} vacio={opciones.length === 0 ? vacio : undefined} />
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </div>
}

const opcionAdulto = (adulto: AdultoNombre) => ({ value: adulto.envejeciente_id, label: `${adulto.nombres} ${adulto.apellidos}` })
const opcionCuidador = (cuidador: Candidato) => ({ value: cuidador.cuidador_id ?? '', label: cuidador.nombre })
type Indicacion = { indicacion_medica_id: string; titulo: string }

function ResponsableTarea({ base, token, adulto, cuidador, indicacion, cambiarCuidador, cambiarIndicacion, puedeVerIndicaciones }: Pick<OperacionProps, 'base' | 'token'> & {
  adulto: Opcion | undefined
  cuidador: Opcion | undefined
  indicacion: Opcion | undefined
  cambiarCuidador: (opcion: Opcion | undefined) => void
  cambiarIndicacion: (opcion: Opcion | undefined) => void
  puedeVerIndicaciones: boolean
}) {
  const rutaAdulto = adulto ? `${base}/envejecientes/${idRuta(adulto.value)}` : null
  const asignaciones = useDatos<{ cuidadores: { usuario_id: string }[] }>(rutaAdulto ? `${rutaAdulto}/asignaciones` : null, token)
  const cuidadores = usePagina<Candidato>(rutaAdulto ? `${base}/candidatos/agenda` : null, token)
  const indicaciones = usePagina<Indicacion>(rutaAdulto && puedeVerIndicaciones ? `${rutaAdulto}/indicaciones` : null, token, 0, { filters: { estado: 'activa' } })
  if (!adulto) return <p className="text-sm text-muted md:col-span-2">Selecciona el adulto mayor para ver sus cuidadores e indicaciones disponibles.</p>
  const disponibles = new Set(asignaciones.datos?.cuidadores.map(({ usuario_id }) => usuario_id))
  return <>
    <div className="grid gap-2">
      <SelectorPaginado label="Cuidador asignado" required seleccion={cuidador} elegir={cambiarCuidador} consulta={cuidadores}
        opciones={cuidadores.datos?.data.filter((candidato) => candidato.cuidador_id && disponibles.has(candidato.usuario_id)).map(opcionCuidador) ?? []}
        vacio={asignaciones.datos ? 'No hay cuidadores asignados disponibles en esta página.' : undefined} />
      <Estado consulta={asignaciones} />
    </div>
    {puedeVerIndicaciones && <SelectorPaginado label="Indicación médica (opcional)" seleccion={indicacion} elegir={cambiarIndicacion}
      consulta={indicaciones} opciones={indicaciones.datos?.data.map((dato) => ({ value: dato.indicacion_medica_id, label: dato.titulo })) ?? []}
      vacio="No hay indicaciones activas en esta página." opcionVacia="Sin indicación médica" />}
  </>
}

function FormularioTarea({ base, token, cuenta, tarea, listo, volver }: Pick<OperacionProps, 'base' | 'token' | 'cuenta'> & {
  tarea?: Tarea; listo: (tareas: Tarea[]) => void; volver: () => void
}) {
  const hoy = fechaDominicana()
  const adultos = usePagina<AdultoNombre>(tarea ? null : `${base}/envejecientes`, token, 0, { filters: { estado: 'activo' } })
  const prioridades = useDatos<{ prioridad_id: number; nombre: string }[]>('/catalogos/prioridades', token)
  const [adulto, setAdulto] = useState<Opcion | undefined>(tarea ? { value: tarea.envejeciente_id, label: tarea.envejeciente_nombre } : undefined)
  const [cuidador, setCuidador] = useState<Opcion | undefined>(tarea ? { value: tarea.cuidador_id, label: tarea.cuidador_nombre } : undefined)
  const [indicacion, setIndicacion] = useState<Opcion | undefined>(tarea?.indicacion_medica_id ? { value: tarea.indicacion_medica_id, label: tarea.indicacion_titulo ?? 'Indicación actual' } : undefined)
  const [prioridadId, setPrioridadId] = useState(tarea?.prioridad_id ? String(tarea.prioridad_id) : '')
  const [repeticion, setRepeticion] = useState<Repeticion>('ninguna')
  const [dias, setDias] = useState<string[]>([])
  const [fecha, setFecha] = useState(tarea?.fecha_programada ?? hoy)
  const [hora, setHora] = useState(tarea?.hora_programada ?? '')
  const [hasta, setHasta] = useState('')
  const [alcance, setAlcance] = useState<Alcance>('esta')
  const enLinea = useConexionReal()
  const puedeVerIndicaciones = cuenta.permisos.includes('indicaciones:ver')
  const valores = { fechaProgramada: fecha, horaProgramada: hora, repeticion, diasSemana: dias.map((dia) => Number(dia) % 7), fechaFin: hasta }
  const fechas = fechasDeSerie(valores)

  return <Formulario titulo={tarea ? 'Editar tarea' : 'Nueva tarea de cuidado'} campos={[]} accion={tarea ? 'Guardar cambios' : 'Crear tarea'} cancelar={volver}
    disabled={!enLinea} submitDisabled={!adulto || !cuidador || !prioridadId} enviar={async (datos) => {
      const titulo = campo(datos, 'titulo')
      if (titulo.length < 3) throw new Error('Escribe un título de al menos 3 caracteres.')
      if (!adulto || !cuidador) throw new Error('Selecciona el adulto mayor y su cuidador asignado.')
      const prioridad = Number(prioridadId)
      if (fecha !== tarea?.fecha_programada && alcance === 'esta' && fecha < hoy) throw new Error('La fecha programada debe ser hoy o después.')
      if (!tarea && repeticion !== 'ninguna' && (!fechas.length || fechas.length > MAX_OCURRENCIAS || hasta > sumarDias(fecha, 730))) {
        throw new Error('Revisa los días y la fecha de fin. Puedes crear hasta 60 tareas en un plazo de 730 días.')
      }
      const indicacionId = indicacion?.value ?? null
      const horaProgramada = hora || null
      const requiereEvidencia = datos.has('requiere_evidencia')
      const datosComunes = {
        titulo, cuidador_id: cuidador.value, prioridad_id: prioridad, hora_programada: horaProgramada,
        requiere_evidencia: requiereEvidencia,
        ...(puedeVerIndicaciones ? { indicacion_medica_id: indicacionId } : {}),
      }
      if (tarea) {
        const cambios = {
          ...(titulo !== tarea.titulo ? { titulo } : {}),
          ...(cuidador.value !== tarea.cuidador_id ? { cuidador_id: cuidador.value } : {}),
          ...(prioridad !== tarea.prioridad_id ? { prioridad_id: prioridad } : {}),
          ...(horaProgramada !== tarea.hora_programada ? { hora_programada: horaProgramada } : {}),
          ...(requiereEvidencia !== tarea.requiere_evidencia ? { requiere_evidencia: requiereEvidencia } : {}),
          ...(puedeVerIndicaciones && indicacionId !== (tarea.indicacion_medica_id ?? null) ? { indicacion_medica_id: indicacionId } : {}),
          ...(alcance === 'esta' && fecha !== tarea.fecha_programada ? { fecha_programada: fecha } : {}),
        }
        if (!Object.keys(cambios).length) throw new Error('Modifica al menos un campo antes de guardar.')
        await api(`${base}/tareas/${idRuta(tarea.tarea_id)}`, token, 'PATCH', {
          ...cambios, alcance,
        })
        listo([])
      } else {
        const resultado = await api<{ tareas: Tarea[] }>(`${base}/tareas`, token, 'POST', {
          ...datosComunes, envejeciente_id: adulto.value, fecha_programada: fecha,
          ...(repeticion === 'ninguna' ? {} : { repeticion: { frecuencia: repeticion, hasta, ...(repeticion === 'semanal' ? { dias_semana: dias.map(Number) } : {}) } }),
        })
        listo(resultado.tareas)
      }
    }}>
    <TextField label="Título de la tarea" name="titulo" required minLength={3} maxLength={80} defaultValue={tarea?.titulo} />
    <div className="grid gap-2">
      <SelectField label="Prioridad" required value={prioridadId} onChange={(evento) => setPrioridadId(evento.currentTarget.value)}
        placeholder="Selecciona la prioridad" options={prioridades.datos?.map((dato) => ({ value: String(dato.prioridad_id), label: dato.nombre })) ?? []} />
      <Estado consulta={prioridades} />
    </div>
    {tarea ? <p className="rounded-sm bg-blue-100 p-3 text-sm md:col-span-2"><strong>Adulto mayor:</strong> {tarea.envejeciente_nombre}</p>
      : <SelectorPaginado label="Adulto mayor" required opciones={adultos.datos?.data.map(opcionAdulto) ?? []} seleccion={adulto}
          consulta={adultos} vacio="No hay adultos activos en esta página." elegir={(opcion) => { setAdulto(opcion); setCuidador(undefined); setIndicacion(undefined) }} />}
    <ResponsableTarea base={base} token={token} adulto={adulto} cuidador={cuidador} indicacion={indicacion} cambiarCuidador={setCuidador}
      cambiarIndicacion={setIndicacion} puedeVerIndicaciones={puedeVerIndicaciones} />
    {tarea?.es_repetitiva && <div className="md:col-span-2">
      <ChoicePills label="Aplicar cambios a" options={ALCANCES} value={alcance} onChange={setAlcance} />
    </div>}
    <TextField label="Fecha programada" type="date" required min={tarea && tarea.fecha_programada < hoy ? tarea.fecha_programada : hoy}
      value={fecha} disabled={alcance === 'siguientes'} onChange={(evento) => setFecha(evento.currentTarget.value)}
      hint={alcance === 'siguientes' ? 'Para cambiar la fecha, aplica los cambios solo a esta tarea.' : undefined} />
    <TextField label="Hora (opcional)" type="time" value={hora} onChange={(evento) => setHora(evento.currentTarget.value)} />
    <Checkbox name="requiere_evidencia" label="Requiere evidencia para completar" defaultChecked={tarea?.requiere_evidencia} className="md:col-span-2" />
    {!tarea && <div className="grid gap-3 md:col-span-2">
      <ChoicePills label="Repetición" options={REPETICIONES} value={repeticion} onChange={setRepeticion} />
      {repeticion === 'semanal' && <CheckboxGroup label="Días de la semana" required options={DIAS} value={dias} onChange={setDias} />}
      {repeticion !== 'ninguna' && <TextField label="Se repite hasta" type="date" required min={fecha} max={fecha ? sumarDias(fecha, 730) : undefined}
        value={hasta} onChange={(evento) => setHasta(evento.currentTarget.value)} hint="La fecha final se incluye. Máximo 60 tareas." />}
      {repeticion !== 'ninguna' && <VistaPreviaSerie valores={valores} nombreCuidador={cuidador?.label} />}
    </div>}
  </Formulario>
}

function EstadoTarea({ tarea }: { tarea: Tarea }) {
  const estado = ESTADOS[tarea.estado]
  const prioridad = tarea.prioridad?.toLowerCase()
  return <div className="flex flex-wrap gap-1.5">
    <Badge tone={estado.tono}>{estado.texto}</Badge>
    {tarea.prioridad && <Badge tone={PRIORIDADES[prioridad ?? ''] ?? 'neutral'}>Prioridad {prioridad}</Badge>}
    {tarea.es_historica && <Badge tone="neutral">Histórica</Badge>}
    {!tarea.es_historica && abierta(tarea) && tarea.fecha_programada < fechaDominicana() && <Badge tone="danger">Vencida</Badge>}
    {tarea.es_repetitiva && <Badge tone="info"><Repeat size={14} aria-hidden /> Repetitiva</Badge>}
    {tarea.requiere_evidencia && <Badge tone={tarea.evidencias.validadas ? 'success' : tarea.evidencias.pendientes ? 'info' : 'warning'}>
      {tarea.evidencias.validadas ? 'Evidencia validada' : tarea.evidencias.pendientes ? 'Evidencia por validar' : 'Requiere evidencia'}
    </Badge>}
  </div>
}

function TarjetaTarea({ tarea, abrir }: { tarea: Tarea; abrir: () => void }) {
  return <Card className="grid gap-3 bg-bg">
    <div className="flex items-start gap-3">
      <IconTile><ClipboardCheck size={24} aria-hidden /></IconTile>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold wrap-anywhere">{tarea.titulo}</h3>
        <p className="text-sm font-semibold text-navy">{fechaHora(tarea)}</p>
        {tarea.envejeciente_nombre && <p className="text-sm text-muted">{tarea.envejeciente_nombre}</p>}
      </div>
    </div>
    <EstadoTarea tarea={tarea} />
    <Button variant="light" size="sm" fullWidth aria-label={`Ver detalle: ${tarea.titulo}`} onClick={abrir}>Ver detalle</Button>
  </Card>
}

export function Agenda({ base, token, cuenta }: OperacionProps) {
  const [params, setParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const [fecha, setFecha] = useState('')
  const [estado, setEstado] = useState('')
  const [adultoFiltro, setAdultoFiltro] = useState<Opcion>()
  const [cuidadorFiltro, setCuidadorFiltro] = useState<Opcion>()
  const [alcanceCancelacion, setAlcanceCancelacion] = useState<Alcance>('esta')
  const [aviso, setAviso] = useState('')
  const enLinea = useConexionReal()
  const gestionar = cuenta.permisos.includes('agenda:gestionar')
  const ejecutar = cuenta.permisos.includes('agenda:ejecutar')
  const validar = cuenta.permisos.includes('evidencias:validar')
  const id = params.get('tarea')
  const panel = params.get('accion')
  const nueva = panel === 'nueva' && gestionar
  const enListado = !id && !nueva
  const listado = usePagina<Tarea>(enListado ? `${base}/tareas` : null, token, revision, { filters: {
    ...(fecha ? { desde: fecha, hasta: fecha } : {}), ...(estado ? { estado } : {}),
    ...(adultoFiltro ? { envejeciente_id: adultoFiltro.value } : {}), ...(cuidadorFiltro ? { cuidador_id: cuidadorFiltro.value } : {}),
  } })
  const adultos = usePagina<AdultoNombre>(enListado && gestionar ? `${base}/envejecientes` : null, token)
  const cuidadores = usePagina<Candidato>(enListado && gestionar ? `${base}/candidatos/agenda` : null, token)
  const ruta = id ? `${base}/tareas/${idRuta(id)}` : null
  const consulta = useDatos<Tarea>(ruta, token, revision)
  const tarea = consulta.datos
  const editable = tarea && !tarea.es_historica && gestionar && tarea.estado === 'pendiente'
  const operativa = tarea && !tarea.es_historica && abierta(tarea)
  const editando = panel === 'editar' && editable
  const cancelando = panel === 'cancelar' && operativa && gestionar
  const refrescar = () => setRevision((actual) => actual + 1)
  const abrir = (tareaId: string, accion?: string) => setParams({ tarea: tareaId, ...(accion ? { accion } : {}) })
  const volver = () => setParams({})
  const post = async (path: string, datos?: object) => {
    await api(path, token, 'POST', datos)
    refrescar()
  }

  return <section className="grid gap-4" aria-label="Agenda de cuidado">
    {!enLinea && <p className="flex items-center gap-2 rounded-sm bg-blue-100 p-3 text-sm"><WifiOff size={18} aria-hidden /> Conéctate a internet para guardar cambios en la agenda.</p>}
    {aviso && <p className="rounded-sm bg-teal-100 p-3 text-sm font-semibold" role="status">{aviso}</p>}
    {!enListado && <Button variant="ghost" size="sm" className="justify-self-start" icon={<ArrowLeft size={18} aria-hidden />}
      onClick={() => id && (editando || cancelando) ? abrir(id) : volver()}>{editando || cancelando ? 'Volver al detalle' : 'Volver a la agenda'}</Button>}
    {enListado && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Agenda de cuidado</h2>
        {gestionar && <Button size="sm" disabled={!enLinea} icon={<CalendarPlus size={20} aria-hidden />} onClick={() => setParams({ accion: 'nueva' })}>Nueva tarea</Button>}
      </div>
      <Card className="grid gap-3 bg-bg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Filtrar tareas</h3>
          <Button size="sm" variant="ghost" disabled={!fecha && !estado && !adultoFiltro && !cuidadorFiltro} onClick={() => {
            setFecha(''); setEstado(''); setAdultoFiltro(undefined); setCuidadorFiltro(undefined)
          }}>Limpiar filtros</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <TextField label="Fecha programada" type="date" value={fecha} onChange={(evento) => setFecha(evento.currentTarget.value)} />
            <Button variant="light" size="sm" icon={<CalendarDays size={18} aria-hidden />} onClick={() => setFecha(fechaDominicana())}>Hoy</Button>
          </div>
          <SelectField label="Estado" value={estado} onChange={(evento) => setEstado(evento.currentTarget.value)} options={[
            { value: '', label: 'Todos los estados' }, ...Object.entries(ESTADOS).map(([value, dato]) => ({ value, label: dato.texto })),
          ]} />
          {gestionar && <>
            <SelectorPaginado label="Filtrar por adulto mayor" opciones={adultos.datos?.data.map(opcionAdulto) ?? []} seleccion={adultoFiltro} consulta={adultos} elegir={setAdultoFiltro} />
            <SelectorPaginado label="Filtrar por cuidador" opciones={cuidadores.datos?.data.filter((item) => item.cuidador_id).map(opcionCuidador) ?? []} seleccion={cuidadorFiltro} consulta={cuidadores} elegir={setCuidadorFiltro} />
          </>}
        </div>
      </Card>
      <Estado consulta={listado} vacio={listado.datos?.data.length === 0 ? 'No hay tareas para estos filtros.' : undefined} />
      {listado.datos && listado.datos.meta.total > 0 && <p className="text-sm font-semibold text-muted" role="status">{listado.datos.meta.total} {listado.datos.meta.total === 1 ? 'tarea' : 'tareas'}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {listado.datos?.data.map((item) => <TarjetaTarea key={item.tarea_id} tarea={item} abrir={() => abrir(item.tarea_id)} />)}
      </div>
      {listado.datos && <Paginador pagina={listado.pagina} total={listado.datos.meta.totalPages} cambiar={listado.cambiar} />}
    </>}
    {nueva && <FormularioTarea base={base} token={token} cuenta={cuenta} volver={volver} listo={(creadas) => {
      refrescar()
      setAviso(creadas.length > 1 ? `${creadas.length} tareas guardadas en la agenda.` : 'Tarea guardada en la agenda.')
      if (creadas[0]) abrir(creadas[0].tarea_id)
      else volver()
    }} />}
    {id && <Estado consulta={consulta} />}
    {tarea && ruta && <section key={tarea.tarea_id} className="grid gap-4">
      <Card className="grid gap-3 bg-bg">
        <h2 className="text-xl font-bold wrap-anywhere">{tarea.titulo}</h2>
        <EstadoTarea tarea={tarea} />
        <p className="text-sm font-semibold text-navy">{fechaHora(tarea)}</p>
        <dl className="grid gap-2 text-sm">
          {tarea.envejeciente_nombre && <div className="flex items-center gap-2"><UserRound size={18} aria-hidden /><dt className="font-semibold">Adulto mayor:</dt><dd>{tarea.envejeciente_nombre}</dd></div>}
          {tarea.cuidador_nombre && <div className="flex items-center gap-2"><ClipboardCheck size={18} aria-hidden /><dt className="font-semibold">Cuidador:</dt><dd>{tarea.cuidador_nombre}</dd></div>}
          {tarea.indicacion_titulo && <div><dt className="inline font-semibold">Indicación médica:</dt> <dd className="inline">{tarea.indicacion_titulo}</dd></div>}
        </dl>
        {tarea.es_historica && <p className="text-sm text-muted">Esta tarea histórica está disponible para consulta.</p>}
        {tarea.motivo_cancelacion && <p className="rounded-sm bg-danger-100 p-3 text-sm"><strong>Motivo de cancelación:</strong> {tarea.motivo_cancelacion}</p>}
        {tarea.ultimo_motivo_rechazo && <p className="rounded-sm bg-danger-100 p-3 text-sm"><strong>Evidencia rechazada:</strong> {tarea.ultimo_motivo_rechazo}</p>}
      </Card>
      {editando ? <FormularioTarea base={base} token={token} cuenta={cuenta} tarea={tarea}
        volver={() => abrir(tarea.tarea_id)} listo={() => { refrescar(); abrir(tarea.tarea_id) }} />
        : cancelando ? <Formulario titulo="Cancelar tarea" accion="Confirmar cancelación" cancelar={() => abrir(tarea.tarea_id)} disabled={!enLinea}
          campos={[{ name: 'motivo', label: 'Motivo', type: 'textarea', min: 3, max: 300 }]} enviar={async (datos) => {
            await post(`${ruta}/cancelar`, { motivo: campo(datos, 'motivo'), alcance: alcanceCancelacion })
            abrir(tarea.tarea_id)
          }}>
          {tarea.es_repetitiva && <ChoicePills label="Aplicar cancelación a" options={ALCANCES} value={alcanceCancelacion} onChange={setAlcanceCancelacion} />}
        </Formulario> : <>
          {gestionar && operativa && <div className="flex flex-wrap gap-2">
            {editable && <Button size="sm" variant="outline" disabled={!enLinea} onClick={() => abrir(tarea.tarea_id, 'editar')}>Editar tarea</Button>}
            <Button size="sm" variant="danger-soft" disabled={!enLinea} onClick={() => { setAlcanceCancelacion('esta'); abrir(tarea.tarea_id, 'cancelar') }}>Cancelar tarea</Button>
          </div>}
          {ejecutar && operativa && tarea.estado === 'pendiente' && <Formulario titulo="Iniciar tarea" accion="Iniciar" campos={[]} disabled={!enLinea}
            enviar={() => post(`${ruta}/iniciar`)} />}
          {ejecutar && operativa && (tarea.requiere_evidencia && tarea.evidencias.validadas === 0
            ? <p className="rounded-sm border border-blue bg-blue-100 p-3 text-sm" role="status">Para completar esta tarea hace falta una evidencia validada.</p>
            : <Formulario titulo="Completar tarea" accion="Completar" campos={[]} disabled={!enLinea} enviar={() => post(`${ruta}/completar`)} />)}
          <Evidencias ruta={ruta} token={token} puedeAdjuntar={!!(ejecutar && operativa)} tarea revision={revision} refrescar={refrescar}
            validar={validar && operativa ? (evidencia, aceptar, motivo) => post(`${base}/evidencias/${idRuta(evidencia)}/${aceptar ? 'validar' : 'rechazar'}`, motivo ? { motivo } : undefined) : undefined} />
        </>}
    </section>}
  </section>
}
