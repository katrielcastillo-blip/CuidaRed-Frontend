/*
 * Visitas conectadas: programación, registro autorizado e historial · RF-02, RF-10.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect,useState } from 'react'
import { ArrowLeft, CalendarDays, CalendarPlus, CircleUserRound, Frown, Meh, Smile, WifiOff, X } from '@/components/icons'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Checkbox, CheckboxGroup, IconTile, Segmented, SelectField, TextareaField, TextField, type Tone } from '@/components/ui'
import { ASPECTOS_VISITA } from '@/domain/catalogos'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import { fechasDeSerie, MAX_OCURRENCIAS, type Repeticion } from '@/domain/recurrencia'
import { DIAS_SEMANA } from '@/features/agenda/lib/fechas'
import type { CollectionQuery } from '@/lib/api-contract'
import { api, type CuentaMe, type RolCuenta } from '../client'
import { campo, Estado, Formulario, idRuta, Paginador, useConexionReal, useDatos, usePagina, type Campo } from './controles'
import type { ColaOperaciones } from './cola-operaciones'
import { Evidencias } from './visitas-evidencias'
import { VentanaVisita } from './calendario-visitas'
import { CalendarioEquipo } from './calendario-equipo'
import { SolicitudesExternas } from './solicitudes-externas'
import { fechaDominicana, leerVentana } from './visitas-fechas'
import { avisoPerfilCuidador, responsablesVisita } from './visitas-responsables'
import { ContactoVisitante,type ContactoProgramado } from './contacto-visitante'
import { ConfirmarVisita } from './confirmar-visita'
import { AportesVisitante } from './visitas-aportes'

export interface AdultoNombre { envejeciente_id: string; nombres: string; apellidos: string }
export interface Candidato { usuario_id: string; membresia_id: string; cuidador_id: string | null; nombre: string; rol: RolCuenta }
export interface OperacionProps { base: string; token: string; cuenta: CuentaMe; usuarioId: string }

interface Persona { usuario_id: string; nombres?: string; apellidos?: string }
interface Visita {
  tipo_visita?: 'personal' | 'institucional'
  entidad_visitante?: string | null
  cantidad_visitantes?: number | null
  aporte_previsto?: string | null
  informe_general?: string | null
  visita_id: string
  fecha: string
  hora_programada: string | null
  hora_fin_programada?: string | null
  fecha_realizacion?: string | null
  registro_campo_en?:string|null
  confirmada_en?:string|null
  confirmacion_notas?:string|null
  puede_confirmar_realizacion?:boolean
  observacion_visitante?:string|null
  reprogramada_en?: string | null
  pendiente_autorizacion?: boolean
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
  visitante?: { nombre: string } | null
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
const aspectosVisita = [...ASPECTOS_VISITA, { value: 'caidas', label: 'Caídas' }]
const fechaEfectiva = new Intl.DateTimeFormat('es-DO', { timeZone: 'America/Santo_Domingo', dateStyle: 'medium', timeStyle: 'short' })

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
          <button type="button" aria-label={`Quitar ${opcion.etiqueta}`} className="inline-flex min-h-12 max-w-full items-center gap-2 rounded-pill bg-blue-100 px-3 text-left text-sm font-semibold text-navy hover:bg-blue-200"
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

function Programar({ base, token, cuenta,usuarioId, listo, volver }: Pick<OperacionProps, 'base' | 'token' | 'cuenta'|'usuarioId'> & { listo: (visita: Visita, cantidad?: number) => void; volver: () => void }) {
  const adultos = usePagina<AdultoNombre>(`${base}/envejecientes`, token, 0, { filters: { estado: 'activo' } })
  const personas = usePagina<Candidato>(`${base}/candidatos/visita`, token)
  const { disponibles, faltanPerfiles } = responsablesVisita(personas.datos?.data)
  const [seleccionAdultos, setAdultos] = useState<Opcion[]>([])
  const [seleccionPersonas, setPersonas] = useState<Opcion[]>([{id:usuarioId,etiqueta:'Yo coordino la visita'}])
  const [paso,setPaso]=useState<'contacto'|'agenda'>('contacto')
  const [contacto,setContacto]=useState<ContactoProgramado>({tipo:'personal',nombre:'',correo:'',cantidad:1})
  const institucional=contacto.tipo==='institucional'
  const [frecuencia, setFrecuencia] = useState<Repeticion>('ninguna')
  const [dias, setDias] = useState<string[]>([])
  const recurrentes = cuenta.funcionalidades?.includes('visitas_recurrentes')
  const enLinea = useConexionReal()
  const campos: Campo[] = [
    { name: 'razon', label: 'Motivo de la visita', min: 3, max: 120 },
    { name: 'notas', label: 'Notas (opcional)', type: 'textarea', optional: true, max: 300 },
  ]
  const prepararPagina = (consulta: typeof adultos | typeof personas) =>
    consulta.datos && { pagina: consulta.pagina, total: consulta.datos.meta.totalPages, cambiar: consulta.cambiar }

  return <><div hidden={paso!=='contacto'}><ContactoVisitante valor={contacto} cambiar={setContacto} continuar={()=>setPaso('agenda')} disabled={!enLinea}/></div><div hidden={paso!=='agenda'}>
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-sm bg-blue-100 p-3 text-sm"><p><strong>{institucional?contacto.entidad:contacto.nombre}</strong><br/>{contacto.correo} · {contacto.cantidad} visitante(s)</p><Button size="sm" variant="ghost" onClick={()=>setPaso('contacto')}>Editar visitante</Button></div>
  <Formulario titulo="Paso 2 de 2 · Horario y coordinación" campos={campos} tamanoAccion="sm" accion={frecuencia === 'ninguna' ? 'Programar y autorizar visita' : 'Programar y autorizar serie'} cancelar={volver} disabled={!enLinea}
    submitDisabled={(!institucional && !seleccionAdultos.length) || !seleccionPersonas.length}
    enviar={async (datos) => {
      if ((!institucional && !seleccionAdultos.length) || !seleccionPersonas.length) throw new Error('Selecciona la persona a visitar y un responsable de la organización.')
      const { fecha, hora, hora_fin_programada } = leerVentana(datos)
      const entrada = {
        fecha, hora_programada: hora, hora_fin_programada, razon: campo(datos, 'razon'),
        notas: campo(datos, 'notas') || undefined, envejeciente_ids: seleccionAdultos.map((adulto) => adulto.id),
        participante_ids: seleccionPersonas.map((persona) => persona.id),
        visitante_externo:{...contacto,nombre:contacto.nombre.trim(),correo:contacto.correo.trim(),telefono:contacto.telefono||undefined,entidad:contacto.entidad?.trim()||undefined,aporte:contacto.aporte?.trim()||undefined},
      }
      if (frecuencia === 'ninguna') {
        listo(await api<Visita>(`${base}/visitas`, token, 'POST', { ...entrada, autorizar: true }))
        return
      }
      const hasta = campo(datos, 'hasta')
      const diasSemana = dias.map(Number)
      const fechas = fechasDeSerie({ fechaProgramada: entrada.fecha, fechaFin: hasta, repeticion: frecuencia, diasSemana })
      if (!fechas.length || fechas.length > MAX_OCURRENCIAS) {
        throw new Error(`Elige un intervalo de 1 a ${MAX_OCURRENCIAS} visitas.`)
      }
      const serie = await api<{ visitas: Visita[] }>(`${base}/visitas/recurrentes`, token, 'POST', {
        ...entrada,
        repeticion: { frecuencia, hasta, ...(frecuencia === 'semanal' ? { dias_semana: diasSemana.map((dia) => dia || 7) } : {}) },
      })
      const primera = serie.visitas[0]
      if (!primera) throw new Error('No se recibió la serie programada.')
      listo(primera, serie.visitas.length)
    }}>
    <VentanaVisita base={base} token={token} />
    {recurrentes && <>
      <SelectField label="Repetición" value={frecuencia} onChange={(event) => setFrecuencia(event.target.value as Repeticion)}
        options={[{ value: 'ninguna', label: 'No se repite' }, { value: 'diaria', label: 'Diaria' }, { value: 'semanal', label: 'Semanal' }]} />
      {frecuencia !== 'ninguna' && <TextField label="Se repite hasta" type="date" name="hasta" min={fechaDominicana()} required
        hint={`Máximo ${MAX_OCURRENCIAS} visitas.`} />}
      {frecuencia === 'semanal' && <CheckboxGroup label="Días de la semana"
        options={DIAS_SEMANA.map((dia) => ({ value: String(dia.value), label: dia.largo }))} value={dias} onChange={setDias} />}
    </>}
    <div className="grid gap-2">
      <Estado consulta={adultos} vacio={!institucional && adultos.datos?.data.length === 0 ? 'Sin adultos activos disponibles.' : undefined} />
      {institucional && <p className="text-sm text-muted">Puedes registrar una actividad para la organización sin elegir una persona específica. Al confirmar su realización se podrán identificar quienes participaron.</p>}
      <SeleccionMultiple titulo={institucional?'Personas previstas (opcional)':'Adultos de la visita'} opciones={adultos.datos?.data.map((adulto) => ({ id: adulto.envejeciente_id, etiqueta: nombre(adulto) })) ?? []}
        seleccionadas={seleccionAdultos} maximo={4} pagina={prepararPagina(adultos)} cambiar={setAdultos} />
    </div>
    <div className="grid gap-2">
      <Estado consulta={personas} />
      {faltanPerfiles && <p className="text-sm text-ink-2">{avisoPerfilCuidador}</p>}
      <SeleccionMultiple titulo="Responsables de la organización" opciones={[{id:usuarioId,etiqueta:'Yo coordino la visita'},...disponibles.filter(p=>p.rol==='cuidador' && p.usuario_id!==usuarioId).map((persona) => ({ id: persona.usuario_id, etiqueta: persona.nombre }))]}
        seleccionadas={seleccionPersonas} maximo={3} pagina={prepararPagina(personas)} cambiar={setPersonas} />
    </div>
    <p className="text-sm text-muted md:col-span-2">La visita quedará autorizada en el calendario. El visitante recibirá el horario y un código de seguimiento por correo cuando el servicio de correo esté activo.</p>
  </Formulario></div></>
}

function RegistroVisita({ visita, voluntario, enviar, volver, deshabilitado }: {
  visita: Visita; voluntario: boolean; enviar: (datos: object) => Promise<void>; volver: () => void; deshabilitado: boolean
}) {
  const [checklist, setChecklist] = useState<string[]>([])
  return <Formulario titulo="Registrar realización" campos={[]} accion="Registrar visita" cancelar={volver} disabled={deshabilitado}
    enviar={async (datos) => {
      if (visita.tipo_visita === 'institucional') {
        await enviar({ detalles: [], observacion_general: campo(datos, 'observacion_general') })
        return
      }
      const detalles = visita.adultos.map((adulto) => ({
        envejeciente_id: adulto.envejeciente_id,
        ...(!voluntario ? { estado_general: campo(datos, `estado-${adulto.envejeciente_id}`) } : {}),
        observacion: campo(datos, `observacion-${adulto.envejeciente_id}`),
      }))
      if (detalles.some((detalle) => detalle.observacion.length < 3)) throw new Error('Escribe una observación de al menos 3 caracteres por adulto.')
      await enviar({ detalles, ...(checklist.length ? { checklist } : {}) })
    }}>
    <div className="grid gap-4 md:col-span-2">
      {visita.tipo_visita === 'institucional' && <TextareaField label="Informe de la visita institucional" name="observacion_general"
        required minLength={3} maxLength={1000} rows={4} placeholder="Registra la actividad realizada, la participación y el aporte recibido." />}
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
      {visita.tipo_visita !== 'institucional' && <CheckboxGroup label="Aspectos verificados (opcional)" options={aspectosVisita} value={checklist} onChange={setChecklist} />}
    </div>
  </Formulario>
}

function TarjetaVisita({ visita, abrir }: { visita: Visita; abrir: () => void }) {
  const titular = visita.adultos[0]
  const estado = visita.puede_confirmar_realizacion ? {texto:'Confirmar realización',tono:'warning' as const} : visita.registro_campo_en && visita.estado==='en_curso' ? {texto:'Pendiente de confirmación',tono:'warning' as const} : visita.estado === 'programada' && visita.pendiente_autorizacion ? { texto: 'Pendiente de autorización', tono: 'warning' as const } : ESTADOS[visita.estado]
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
  const estado = visita.estado === 'programada' && visita.pendiente_autorizacion ? { texto: 'Pendiente de autorización', tono: 'warning' as const } : ESTADOS[enCurso ? 'en_curso' : visita.estado]
  const quienes = visita.participantes.map(nombre).filter(Boolean).join(', ')
  return <Card className="grid gap-3 bg-bg">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xl font-bold wrap-anywhere">{visita.razon}</h3>
      <Badge tone={estado.tono}>{estado.texto}</Badge>
    </div>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      <div><dt className="text-muted">Fecha</dt><dd className="font-semibold">{fechaCorta(visita.fecha)}</dd></div>
      <div><dt className="text-muted">Horario pautado</dt><dd className="font-semibold">{hora(visita.hora_programada)}{visita.hora_fin_programada && ` – ${hora(visita.hora_fin_programada)}`}</dd></div>
      {visita.fecha_realizacion && <div><dt className="text-muted">Realizada el</dt><dd className="font-semibold">{fechaEfectiva.format(new Date(visita.fecha_realizacion))}</dd></div>}
      {visita.hora_inicio && <div><dt className="text-muted">Hora de inicio</dt><dd className="font-semibold">{hora(visita.hora_inicio)}</dd></div>}
      {visita.hora_fin && <div><dt className="text-muted">Hora de fin</dt><dd className="font-semibold">{hora(visita.hora_fin)}</dd></div>}
      {quienes && <div className="col-span-full"><dt className="text-muted">Equipo responsable</dt><dd className="font-semibold wrap-anywhere">{quienes}</dd></div>}
      {visita.entidad_visitante && <div className="col-span-full"><dt className="text-muted">Institución o grupo visitante</dt><dd className="font-semibold wrap-anywhere">{visita.entidad_visitante}</dd></div>}
      {visita.cantidad_visitantes != null && <div><dt className="text-muted">Visitantes previstos</dt><dd className="font-semibold">{visita.cantidad_visitantes}</dd></div>}
      {visita.visitante && <div className="col-span-full"><dt className="text-muted">Visitante externo</dt><dd className="font-semibold wrap-anywhere">{visita.visitante.nombre}</dd></div>}
    </dl>
    {visita.notas && <p className="rounded-sm bg-blue-100 p-3 text-sm whitespace-pre-line"><strong>Notas</strong><br />{visita.notas}</p>}
    {visita.aporte_previsto && <p className="text-sm whitespace-pre-line"><strong>Actividad o aporte previsto</strong><br />{visita.aporte_previsto}</p>}
    {visita.informe_general && <p className="text-sm whitespace-pre-line"><strong>Informe de la visita institucional</strong><br />{visita.informe_general}</p>}
    {visita.confirmada_en && <p className={`rounded-sm p-3 text-sm ${visita.estado === 'completada' ? 'bg-success-100 text-success-700' : 'bg-bg text-ink-2'}`}><strong>{visita.estado === 'completada' ? 'Realización verificada por la organización' : 'Se confirmó que la visita no se realizó'}</strong><br/>{visita.confirmacion_notas}</p>}
    {visita.registro_campo_en && visita.estado==='en_curso' && <p className="rounded-sm bg-blue-100 p-3 text-sm">Registro de campo recibido. La organización debe confirmar si la visita se realizó después del horario programado.</p>}
    {visita.motivo_cancelacion && <p className="rounded-sm bg-danger-100 p-3 text-sm"><strong>Motivo de cancelación:</strong> {visita.motivo_cancelacion}</p>}
    {!!visita.checklist?.length && <p className="text-sm"><strong>Aspectos verificados:</strong> {aspectosVisita.filter((opcion) => visita.checklist?.includes(opcion.value)).map(({ label }) => label).join(', ')}</p>}
  </Card>
}

export function Visitas({ base, token, cuenta, usuarioId, cola }: OperacionProps & { cola: ColaOperaciones }) {
  const [params, setParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const [vista, setVista] = useState<Vista>('hoy')
  const [historial, setHistorial] = useState('completada')
  const [diaCalendario, setDiaCalendario] = useState(fechaDominicana)
  const [aviso, setAviso] = useState('')
  const enLinea = useConexionReal()
  const id = params.get('visita')
  const accion = params.get('accion')
  const puedeProgramar = permite(cuenta, 'visitas:programar') && permite(cuenta, 'visitas:autorizar')
  const puedeRevisarSolicitudes = cuenta.tipo === 'organizacion' && permite(cuenta, 'visitas:autorizar')
  const viendoSolicitudes = !id && ['solicitudes','rechazadas'].includes(accion??'') && puedeRevisarSolicitudes
  const viendoCalendario = !id && accion === 'calendario' && puedeRevisarSolicitudes
  const programando = accion === 'programar' && puedeProgramar
  const actualizar = () => setRevision((r) => r + 1)
  const recarga = revision + cola.revision
  const hoy = fechaDominicana()
  const manana = fechaDominicana(1)
  const mostrandoListado = !id && !programando && !viendoSolicitudes && !viendoCalendario
  const rutaListado = `${base}/visitas`
  const ruta = id ? `${base}/visitas/${idRuta(id)}` : null
  const filtrosHoy = { desde: hoy, hasta: hoy }
  const filtrosProximas = { desde: manana, estado: 'programada' }
  const historialAbierto = historial === 'programada' || historial === 'en_curso'
  const consulta: Omit<CollectionQuery, 'page'> = vista === 'historial'
    ? { filters: { estado: historial, ...(historialAbierto ? { hasta: fechaDominicana(-1) } : {}) }, sort: ['-fecha_evento'] }
    : { filters: vista === 'hoy' ? filtrosHoy : filtrosProximas, sort: ['fecha', 'hora_programada'] }
  const listado = usePagina<Visita>(rutaListado, token, recarga, consulta)
  const total = usePagina<Visita>(mostrandoListado ? rutaListado : null, token, recarga, { limit: 1 })
  const hoyProgramadas = usePagina<Visita>(mostrandoListado ? rutaListado : null, token, recarga, { limit: 1, filters: { ...filtrosHoy, estado: 'programada' } })
  const proximas = usePagina<Visita>(mostrandoListado && vista !== 'proximas' ? rutaListado : null, token, recarga, { limit: 1, filters: filtrosProximas })
  const detalle = useDatos<Visita>(ruta, token, recarga)
  // El listado ya contiene la autorización, los participantes y los adultos visibles.
  // Solo sirve como respaldo durante la desconexión y no incluye observaciones clínicas.
  const visita = detalle.datos ?? (!enLinea && permite(cuenta, 'sync:usar')
    ? listado.datos?.data.find((item) => item.visita_id === id && (item.estado === 'programada' || item.estado === 'en_curso'))
    : undefined)
  const pendientes = cola.capturas.filter((captura) => captura.cuentaId === cuenta.cuenta_id && captura.operacion.entidad === 'visita')
  const accionesPendientes = pendientes.filter((captura) => captura.operacion.registro_id === id)
  const enCurso = visita?.estado === 'en_curso' || accionesPendientes.some((captura) => !captura.rechazada && captura.operacion.tipo === 'iniciar')
  const registroPendiente = accionesPendientes.some((captura) => captura.operacion.tipo === 'registrar')
  const abierta = visita?.estado === 'programada' || visita?.estado === 'en_curso'
  const reprogramando = accion === 'reprogramar' && puedeProgramar && visita?.estado === 'programada'
  const participante = visita?.participantes.some((persona) => persona.usuario_id === usuarioId) === true
  const autorizada = !!visita?.autorizada_por && !!visita.hora_programada && participante
  const puedeRegistrar = permite(cuenta, 'visitas:registrar') && autorizada
  const puedeCapturar = enLinea || permite(cuenta, 'sync:usar')
  const registrando = accion === 'registrar' && abierta && enCurso && puedeRegistrar && !registroPendiente && !visita?.registro_campo_en
  const confirmando=accion==='confirmar' && visita?.puede_confirmar_realizacion && puedeRevisarSolicitudes
  useEffect(()=>{const recargar=()=>setRevision(r=>r+1);const timer=window.setInterval(()=>{if(navigator.onLine)recargar()},30000);window.addEventListener('focus',recargar);return()=>{clearInterval(timer);window.removeEventListener('focus',recargar)}},[])
  const abrir = (visitaId: string, panel?: string) => setParams({ visita: visitaId, ...(panel ? { accion: panel } : {}) })
  const volver = () => setParams({})
  const cambiarVista = (nueva: Vista) => { setVista(nueva); setAviso('') }
  const enviar = async (tipo: 'iniciar' | 'registrar', datos: object = {}) => {
    if (!visita || !ruta || !puedeRegistrar) return
    if (!navigator.onLine && permite(cuenta, 'sync:usar')) {
      await cola.agregar(cuenta.cuenta_id, {
        entidad: 'visita', registro_id: visita.visita_id, tipo, datos,
        base_actualizado_en: new Date(visita.fecha_actualizacion).toISOString(),
      })
    } else {
      await api(`${ruta}/${tipo}`, token, 'POST', datos)
      actualizar()
    }
    if (tipo === 'registrar') abrir(visita.visita_id)
  }

  return <section className="grid gap-4" aria-label="Visitas y seguimiento">
    {(pendientes.length > 0 || cola.mensaje(cuenta.cuenta_id, 'visita')) && <div className="grid gap-2 rounded-sm border border-blue bg-blue-100 p-3" role="status">
      <p className="text-sm font-semibold">{pendientes.length} pendiente(s) en esta cuenta. {cola.mensaje(cuenta.cuenta_id, 'visita')}</p>
      {pendientes.length > 0 && <p className="text-sm">Las capturas se guardan en este dispositivo y se sincronizan al recuperar la conexión.</p>}
      {pendientes.length > 0 && <Button size="sm" variant="outline" disabled={!enLinea} onClick={() => cola.reintentar(cuenta.cuenta_id, 'visita')}>Reintentar sincronización</Button>}
      {pendientes.some((captura) => captura.rechazada) && <Button size="sm" variant="outline" onClick={() => cola.quitarRechazadas(cuenta.cuenta_id, 'visita')}>Descartar capturas rechazadas</Button>}
    </div>}
    {aviso && <p className="rounded-sm bg-teal-100 p-3 text-sm font-semibold" role="status">{aviso}</p>}
    {viendoSolicitudes && <SolicitudesExternas base={base} token={token}
      usuarioId={usuarioId} inicial={accion==='rechazadas'?'rechazada':'pendiente'}
      volver={volver} abrirVisita={(visitaId) => { actualizar(); abrir(visitaId) }} />}
    {viendoCalendario && <>
      <Button variant="ghost" className="justify-self-start" onClick={volver}>Volver a visitas</Button>
      <CalendarioEquipo base={base} token={token} fecha={diaCalendario} cambiarFecha={setDiaCalendario} abrir={abrir} />
    </>}
    {(id || programando) && <Button size="sm" variant="ghost" className="justify-self-start" icon={<ArrowLeft size={18} aria-hidden />}
      onClick={() => id && (registrando || reprogramando || confirmando || accion === 'cancelar') ? abrir(id) : volver()}>{registrando || reprogramando || confirmando || accion === 'cancelar' ? 'Volver al detalle' : 'Volver a visitas'}</Button>}
    {programando && <Programar base={base} token={token} cuenta={cuenta} usuarioId={usuarioId} volver={volver} listo={(creada, cantidad) => {
      actualizar()
      setAviso(cantidad ? `${cantidad} visita(s) programada(s) con sus participantes autorizados.` : 'Visita programada y autorizada. El aviso al visitante quedó preparado para su envío.')
      setVista(creada.fecha === hoy ? 'hoy' : 'proximas')
      abrir(creada.visita_id)
    }} />}
    {mostrandoListado && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">Mis visitas</h2>
        <div className="flex flex-wrap gap-2">
          {puedeRevisarSolicitudes && <Button size="sm" variant="outline" onClick={() => setParams({ accion: 'solicitudes' })}>Solicitudes externas</Button>}
          {puedeRevisarSolicitudes && <Button size="sm" variant="outline" onClick={() => setParams({ accion: 'calendario' })}>Calendario de visitas</Button>}
          {puedeProgramar && <Button size="sm" disabled={!enLinea} icon={<CalendarPlus size={20} aria-hidden />} onClick={() => setParams({ accion: 'programar' })}>Programar visita</Button>}
        </div>
      </div>
      <ResumenVisitas hoy={hoyProgramadas.datos?.meta.total} proximas={(vista === 'proximas' ? listado : proximas).datos?.meta.total} total={total.datos?.meta.total} />
      <Segmented label="Período de visitas" options={VISTAS} value={vista} onChange={cambiarVista} />
      {vista === 'historial' && <SelectField label="Estado del historial" value={historial} onChange={(evento) => setHistorial(evento.currentTarget.value)} options={[
        { value: 'completada', label: 'Completadas' }, { value: 'cancelada', label: 'Canceladas' },
        { value: 'programada', label: 'Programadas de fechas anteriores' }, { value: 'en_curso', label: 'En curso de fechas anteriores' },
      ]} />}
      {vista==='historial' && puedeRevisarSolicitudes && <Button variant="outline" onClick={()=>setParams({accion:'rechazadas'})}>Ver solicitudes rechazadas</Button>}
      <Estado consulta={listado} vacio={listado.datos?.data.length === 0 ? 'No hay visitas en este período.' : undefined} />
      <div className="grid gap-3 sm:grid-cols-2">
        {listado.datos?.data.map((item) => <TarjetaVisita key={item.visita_id} visita={item} abrir={() => abrir(item.visita_id)} />)}
      </div>
      {listado.datos && <Paginador pagina={listado.pagina} total={listado.datos.meta.totalPages} cambiar={listado.cambiar} />}
    </>}
    {id && !visita && <Estado consulta={detalle} />}
    {visita && ruta && <section key={visita.visita_id} className="grid gap-4">
      <h2 className="text-xl font-bold">{registrando ? 'Registrar visita' : 'Detalle de visita'}</h2>
      {!enLinea && <p className="flex items-center gap-2 rounded-sm bg-blue-100 p-3 text-sm"><WifiOff size={18} aria-hidden /> {puedeCapturar ? 'Sin conexión. Las capturas autorizadas se enviarán al reconectar.' : 'Conéctate a internet para registrar cambios.'}</p>}
      <DatosVisita visita={visita} enCurso={enCurso} />
      {visita.visitante && <AportesVisitante ruta={ruta} token={token} revision={recarga} observacion={visita.observacion_visitante}/>}
      {confirmando ? <ConfirmarVisita base={base} token={token} institucional={visita.tipo_visita==='institucional'} cancelar={()=>abrir(visita.visita_id)} guardar={async datos=>{
        await api(`${ruta}/confirmar-realizacion`,token,'POST',datos);actualizar();abrir(visita.visita_id);setAviso('Confirmación guardada. El seguimiento se actualiza únicamente para las personas que participaron.')
      }}/> : visita.puede_confirmar_realizacion && puedeRevisarSolicitudes && <Button disabled={!enLinea} onClick={()=>abrir(visita.visita_id,'confirmar')}>Confirmar si se realizó</Button>}
      {reprogramando && <Formulario titulo="Reprogramar visita" campos={[]} accion="Confirmar nuevo horario" cancelar={() => abrir(visita.visita_id)} disabled={!enLinea}
        enviar={async (datos) => {
          await api(`${ruta}/reprogramar`, token, 'POST', leerVentana(datos))
          actualizar(); abrir(visita.visita_id); setAviso('Nuevo horario guardado.')
        }}>
        <VentanaVisita base={base} token={token} inicial={{ fecha: visita.fecha, inicio: visita.hora_programada, fin: visita.hora_fin_programada }} excluir={visita.visita_id} />
      </Formulario>}
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
        <Evidencias ruta={ruta} token={token} puedeAdjuntar={cuenta.rol === 'cuidador' && visita.estado === 'en_curso' && puedeRegistrar && !registroPendiente} revision={recarga} refrescar={actualizar}
          validar={cuenta.rol === 'coordinador' && permite(cuenta, 'evidencias:validar') ? async (evidencia, aceptar, motivo) => {
            await api(`${ruta}/evidencias/${idRuta(evidencia)}/revision`, token, 'POST', aceptar ? {} : { motivo })
            actualizar()
          } : undefined} />}
      {!reprogramando && !confirmando && (registrando ? <RegistroVisita visita={visita} voluntario={cuenta.rol === 'voluntario'} deshabilitado={!puedeCapturar}
        enviar={(datos) => enviar('registrar', datos)} volver={() => abrir(visita.visita_id)} />
        : <>
          {visita.estado === 'programada' && visita.pendiente_autorizacion && puedeRevisarSolicitudes && accion !== 'cancelar' &&
            <Formulario titulo="Autorizar visita programada" campos={[]} accion="Autorizar visita" disabled={!enLinea} enviar={async () => {
              await api(`${ruta}/autorizar`, token, 'POST', {})
              actualizar(); setAviso('Visita autorizada. El equipo responsable ya puede verla.')
            }} />}
          {visita.estado === 'programada' && puedeProgramar && !reprogramando && accion !== 'cancelar' && <Button size="sm" variant="outline" disabled={!enLinea} onClick={() => abrir(visita.visita_id, 'reprogramar')}>Reprogramar visita</Button>}
          {puedeRegistrar && abierta && !enCurso && <Formulario titulo="Iniciar visita autorizada" campos={[]} accion="Iniciar visita"
            disabled={!puedeCapturar || accionesPendientes.some((captura) => captura.operacion.tipo === 'iniciar')} enviar={() => enviar('iniciar')} />}
          {puedeRegistrar && abierta && enCurso && !registroPendiente && !visita.registro_campo_en && (visita.adultos.length > 0 || visita.tipo_visita === 'institucional') &&
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
        </>)}
    </section>}
  </section>
}

export { Evidencias } from './visitas-evidencias'
