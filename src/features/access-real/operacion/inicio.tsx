/*
 * inicio.tsx — Pantalla Inicio del modo conectado (Figma «Inicio»): saludo, aviso de prueba o de cuenta sin acceso y
 * panel de gestión del Administrador y del Coordinador (Figma «Inicio v3»: termina en las alertas o los pendientes).
 * Los demás roles (y una cuenta sin acceso operativo) conservan accesos rápidos, suscripción y datos de la cuenta;
 * en el panel de gestión esos bloques viven en Más, Configuración («Organización») y «Datos de cuenta».
 * Todas las cifras y listas vienen de la API (conteos de `meta.total` con `limit: 1`); un dato que el servidor no
 * entrega o que el rol no puede ver se omite, nunca se inventa. Cada módulo se consulta solo si el usuario lo ve.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Aviso, Button, EmptyState, FilaLista, Icono, TarjetaKpi } from '@/components/ui'
import { cn } from '@/lib/cn'
import { hhmmA12 } from '@/domain/dates'
import { obtenerSuscripcion, type Suscripcion } from '../api/cuentas'
import type { CasoResumen, IndicadoresResumen } from '../api/reportes'
import type { CuentaMe } from '../client'
import { puedeConsultarSuscripcion, suscripcionTexto, tienePanelGestion } from '../cuentas-datos'
import { useConexionReal, useDatos, usePagina } from './controles'
import { GestionCuenta } from './gestion-cuenta'
import type { Seccion } from './marco/modulos'
import { fechaDominicana } from './visitas-fechas'

const ZONA = 'America/Santo_Domingo'
const TARJETA = 'rounded-2xl bg-surface shadow-1'
const ENLACE_TEXTO = 'inline-flex min-h-12 items-center rounded-md px-2 text-cuerpo font-semibold text-blue-principal underline underline-offset-4 hover:bg-blue-100'

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** «Domingo 22 de noviembre» en hora dominicana. */
function fechaDeHoy() {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA })
    .formatToParts(new Date()).map(({ type, value }) => [type, value]))
  return mayuscula(`${partes.weekday} ${partes.day} de ${partes.month}`)
}

/** «Hace 10 min», «Hace 2 h», «Hace 3 días». */
function hace(iso: string) {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutos < 1) return 'Hace un momento'
  if (minutos < 60) return `Hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `Hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

/** «14:00» → { hora: '2:00', sufijo: 'p. m.' } (bloque de hora de la lista de eventos). */
function partesHora(hhmm: string) {
  const [texto, ...resto] = hhmmA12(hhmm).split(' ')
  return { hora: (texto ?? '').replace(/^0/, ''), sufijo: resto.join(' ').replace('a.m.', 'a. m.').replace('p.m.', 'p. m.') }
}

const nombreCompleto = (persona?: { nombres?: string; apellidos?: string }) => [persona?.nombres, persona?.apellidos].filter(Boolean).join(' ')

/* ───────────── Saludo ───────────── */

function Saludo({ nombreUsuario }: { nombreUsuario: string }) {
  const primero = nombreUsuario.trim().split(/\s+/)[0]
  // En móvil el saludo continúa el degradado de la barra superior hasta los bordes de la pantalla (pseudoelemento absoluto,
  // así el contenido no se sale de su contenedor); desde tablet es un encabezado de contenido sin fondo.
  return <div className="relative isolate pb-7 pt-3 text-white before:absolute before:bottom-0 before:left-[calc(var(--gutter)*-1)] before:right-[calc(var(--gutter)*-1)] before:top-[-20px] before:-z-10 before:rounded-b-[32px] before:bg-[linear-gradient(180deg,#0c3b6e_0%,#1e5ca0_68%,#14a085_100%)] sm:before:top-[-24px] md:pb-0 md:pt-0 md:text-ink md:before:hidden">
    <h2 className="text-pantalla wrap-anywhere">{primero ? `Hola, ${primero}` : 'Hola'}</h2>
    <p className="text-cuerpo text-white md:text-muted">{fechaDeHoy()}</p>
  </div>
}

/* ───────────── Prueba gratuita o cuenta sin acceso ───────────── */

function AvisoSuscripcion({ cuenta, token, raiz }: { cuenta: CuentaMe; token: string; raiz: string }) {
  const [suscripcion, setSuscripcion] = useState<Suscripcion>()
  const [ahora] = useState(() => Date.now())
  const enPrueba = cuenta.estado_suscripcion === 'prueba'
  useEffect(() => {
    if (!enPrueba) return
    let vigente = true
    obtenerSuscripcion(token, cuenta.cuenta_id).then((datos) => vigente && setSuscripcion(datos), () => {})
    return () => { vigente = false }
  }, [enPrueba, token, cuenta.cuenta_id])
  const verPlanes = puedeConsultarSuscripcion(cuenta) && <Link to={`${raiz}/suscripcion`} className={cn(ENLACE_TEXTO, 'flex-none')}>Ver planes</Link>

  if (cuenta.acceso_operativo === false || cuenta.estado_suscripcion === 'vencida') {
    return <Aviso tipo="advertencia">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <p className="min-w-0">Esta cuenta no tiene acceso operativo. Puedes consultar sus datos y acceder a la suscripción según tu rol.</p>
        {verPlanes}
      </div>
    </Aviso>
  }
  if (!enPrueba) return null

  const fin = suscripcion?.prueba.vigente && suscripcion.prueba.fecha_fin ? new Date(suscripcion.prueba.fecha_fin) : undefined
  const dias = fin ? Math.ceil((fin.getTime() - ahora) / 86_400_000) : undefined
  const titulo = dias === undefined ? 'Estás en prueba gratuita'
    : dias <= 0 ? 'Tu prueba termina hoy'
      : `Te quedan ${dias} ${dias === 1 ? 'día' : 'días'} de prueba`
  const termina = fin ? `Termina el ${new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'long', timeZone: ZONA }).format(fin)}` : undefined
  return <div role="status" className={cn(TARJETA, 'flex items-center gap-3 p-4')}>
    <span className="flex-none text-blue-principal" aria-hidden><Icono nombre="info" /></span>
    <div className="min-w-0 flex-1">
      <p className="text-cuerpo font-semibold text-ink wrap-anywhere">{titulo}</p>
      {termina && <p className="text-ayuda text-muted">{termina}</p>}
    </div>
    {verPlanes}
  </div>
}

/* ───────────── Piezas del panel ───────────── */

function Bloque({ id, titulo, enlace, children }: { id: string; titulo: string; enlace?: { to: string; texto: string }; children: ReactNode }) {
  return <section aria-labelledby={id} className="grid min-w-0 content-start gap-3">
    <div className="flex min-h-12 items-center justify-between gap-3">
      <h2 id={id} className="text-seccion text-ink">{titulo}</h2>
      {enlace && <Link to={enlace.to} className={ENLACE_TEXTO}>{enlace.texto}</Link>}
    </div>
    {children}
  </section>
}

function Cuenta({ valor, unidad }: { valor: number; unidad: string }) {
  return <span className="grid h-8 min-w-8 flex-none place-items-center rounded-full bg-bg px-2 text-cuerpo font-semibold text-ink">
    {valor}<span className="sr-only"> {unidad}</span>
  </span>
}

function Pendiente({ icono, titulo, descripcion, valor, unidad, to }: { icono: Parameters<typeof FilaLista>[0]['icono']; titulo: string; descripcion: string; valor: number; unidad: string; to: string }) {
  return <li className="py-1">
    <FilaLista icono={icono} titulo={titulo} descripcion={descripcion} to={to}
      derecha={<><Cuenta valor={valor} unidad={unidad} /><Icono nombre="chevron_right" className="flex-none text-muted" /></>} />
  </li>
}

const LISTA = cn(TARJETA, 'divide-y divide-surface-2 px-4')

interface AlertaFila {
  alerta_envejeciente_id: string
  nombres: string
  apellidos: string
  tipo: { nombre: string }
  prioridad: { nombre: string }
  descripcion: string | null
  fecha_alerta: string
}
interface CasoPrioritario { alertas: AlertaFila[] }

function ListaAlertas({ alertas, raiz }: { alertas: AlertaFila[]; raiz: string }) {
  if (alertas.length === 0) return <EmptyState icono="check_circle" title="Sin alertas por atender" text="Cuando haya una alerta pendiente aparecerá aquí." />
  return <ul className={LISTA}>
    {alertas.map((alerta) => <li key={alerta.alerta_envejeciente_id}>
      <Link to={`${raiz}/alertas?alerta=${alerta.alerta_envejeciente_id}`} className="flex min-h-14 items-center gap-3 py-3">
        <Icono nombre="warning" tamano={20} className="flex-none text-danger" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-cuerpo font-semibold text-ink wrap-anywhere">{alerta.nombres} {alerta.apellidos}</span>
          <span className="text-ayuda text-muted wrap-anywhere">{alerta.descripcion || alerta.tipo.nombre}</span>
          <span className="text-ayuda text-muted">{hace(alerta.fecha_alerta)} · Prioridad {alerta.prioridad.nombre.toLowerCase()}</span>
        </span>
        <Icono nombre="chevron_right" className="flex-none text-muted" />
      </Link>
    </li>)}
  </ul>
}

/* ───────────── Eventos de hoy y de mañana (visitas y tareas) ───────────── */

interface VisitaDia {
  visita_id: string
  fecha: string
  hora_programada: string | null
  razon: string
  estado: 'programada' | 'en_curso' | 'completada' | 'cancelada'
  participantes: { nombres?: string; apellidos?: string }[]
  adultos: { nombres: string; apellidos: string }[]
}
interface TareaDia {
  tarea_id: string
  titulo: string
  fecha_programada: string
  hora_programada: string | null
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'cancelada'
  envejeciente_nombre: string
  cuidador_nombre: string
}
interface Evento { clave: string; tipo: 'Visita' | 'Tarea'; titulo: string; detalle: string; estado: string; fecha: string; hora: string | null; to: string }

const ESTADO_EVENTO: Record<string, string> = { programada: 'Programada', en_curso: 'En curso', pendiente: 'Pendiente', en_progreso: 'En curso' }

function ListaEventos({ eventos, hoy }: { eventos: Evento[]; hoy: string }) {
  if (eventos.length === 0) return <EmptyState icono="event" title="Sin eventos próximos" text="Las visitas y tareas de hoy y de mañana aparecerán aquí." />
  return <ul className={LISTA}>
    {eventos.map((evento) => {
      const hora = evento.hora ? partesHora(evento.hora) : undefined
      const esHoy = evento.fecha === hoy
      return <li key={evento.clave}>
        <Link to={evento.to} className="flex min-h-14 items-center gap-3 py-3">
          <span className={cn('grid size-14 flex-none place-content-center rounded-md text-center text-ayuda font-semibold leading-tight',
            !esHoy ? 'bg-surface-2 text-ink-2' : evento.tipo === 'Visita' ? 'bg-blue-100 text-blue-principal' : 'bg-warning-100 text-ink')}>
            {hora ? <><span className="text-tarjeta">{hora.hora}</span><span>{hora.sufijo}</span></> : <span>Sin hora</span>}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-cuerpo font-semibold text-ink wrap-anywhere">{evento.tipo} · {evento.titulo}</span>
            <span className="text-ayuda text-muted wrap-anywhere">{evento.detalle}</span>
            <span className="text-ayuda text-ink-2">{esHoy ? '' : 'Mañana · '}{evento.estado}</span>
          </span>
          <Icono nombre="chevron_right" className="flex-none text-muted" />
        </Link>
      </li>
    })}
  </ul>
}

/* ───────────── Monitoreo de visitas ───────────── */

function Monitoreo({ casos, raiz, sinPersonal }: { casos: CasoResumen[]; raiz: string; sinPersonal: number }) {
  return <ul className={LISTA}>
    {casos.map((caso) => {
      const s = caso.seguimiento!
      const proporcion = Math.min(1, s.dias_sin_visita / Math.max(1, s.umbral_dias))
      const dias = `${s.dias_sin_visita} ${s.dias_sin_visita === 1 ? 'día' : 'días'}`
      return <li key={caso.envejeciente_id}>
        <Link to={`${raiz}/envejecientes?adulto=${caso.envejeciente_id}`} className="flex min-h-14 items-center gap-3 py-3">
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-cuerpo font-semibold text-ink wrap-anywhere">{caso.nombres} {caso.apellidos}</span>
            <span className="h-2 overflow-hidden rounded-pill bg-surface-2" aria-hidden>
              <span className={cn('block h-full rounded-pill', s.vencido ? 'bg-danger' : proporcion >= 0.7 ? 'bg-warning' : 'bg-teal')} style={{ width: `${Math.max(4, proporcion * 100)}%` }} />
            </span>
            <span className={cn('text-ayuda wrap-anywhere', s.vencido ? 'font-semibold text-danger' : 'text-ink-2')}>
              {s.vencido ? `${dias} · superó el umbral` : `${s.dias_sin_visita} de ${s.umbral_dias} días`}
            </span>
          </span>
          <Icono nombre="chevron_right" className="flex-none text-muted" />
        </Link>
      </li>
    })}
    {sinPersonal > 0 && <Pendiente icono="warning" titulo={`${sinPersonal} ${sinPersonal === 1 ? 'adulto sin personal asignado' : 'adultos sin personal asignado'}`}
      descripcion="No tienen cuidador ni voluntario" valor={sinPersonal} unidad="sin personal" to={`${raiz}/resumen`} />}
  </ul>
}

/* ───────────── Panel de gestión (Administrador y Coordinador) ───────────── */

/** Módulos que alimentan el panel de gestión; sin ninguno el Inicio no tiene panel y conserva los accesos rápidos. */
const MODULOS_PANEL = ['resumen', 'envejecientes', 'necesidades', 'alertas', 'visitas', 'solicitudes-visita']

function PanelGestion({ base, token, cuenta, raiz, visible, revision }: { base: string; token: string; cuenta: CuentaMe; raiz: string; visible: Seccion[]; revision: number }) {
  const tiene = (id: string) => visible.some((modulo) => modulo.id === id)
  const coordinador = cuenta.rol === 'coordinador'
  const organizacion = cuenta.tipo === 'organizacion'
  const enLinea = useConexionReal()
  const hoy = fechaDominicana()
  const manana = fechaDominicana(1)
  const ruta = (id: string, sufijo: string) => (tiene(id) ? `${base}/${sufijo}` : null)

  const indicadores = useDatos<IndicadoresResumen>(ruta('resumen', 'resumen-casos/indicadores'), token, revision)
  const adultos = usePagina<unknown>(ruta('envejecientes', 'envejecientes'), token, revision, { limit: 1, filters: { estado: 'activo' } })
  const necesidades = usePagina<unknown>(ruta('necesidades', 'necesidades'), token, revision, { limit: 1, filters: { activas: true } })
  // Sin el permiso del resumen no hay indicadores: las alertas abiertas son las pendientes más las que están en atención.
  const sinIndicadores = tiene('alertas') && !tiene('resumen')
  const pendientes = usePagina<unknown>(sinIndicadores ? `${base}/alertas` : null, token, revision, { limit: 1, filters: { estado: 'pendiente' } })
  const enAtencion = usePagina<unknown>(sinIndicadores ? `${base}/alertas` : null, token, revision, { limit: 1, filters: { estado: 'en_proceso' } })
  const visitas = usePagina<VisitaDia>(ruta('visitas', 'visitas'), token, revision, { limit: 50, filters: { desde: hoy, hasta: manana }, sort: ['fecha', 'hora_programada'] })
  const tareas = usePagina<TareaDia>(coordinador ? ruta('agenda', 'tareas') : null, token, revision, { limit: 50, filters: { desde: hoy, hasta: manana } })
  const solicitudes = usePagina<unknown>(ruta('solicitudes-visita', 'solicitudes-visita'), token, revision, { limit: 1, filters: { estado: 'pendiente' } })
  const urgentes = usePagina<CasoPrioritario>(!coordinador ? ruta('alertas', 'casos-prioritarios') : null, token, revision, { limit: 3 })
  const activas = usePagina<AlertaFila>(coordinador ? ruta('alertas', 'alertas') : null, token, revision, { limit: 3, filters: { estado: 'pendiente' }, sort: ['-fecha_alerta'] })
  const monitoreo = usePagina<CasoResumen>(coordinador && organizacion ? ruta('resumen', 'resumen-casos') : null, token, revision, { limit: 3, sort: ['ultima_visita'] })

  const consultas = [indicadores, adultos, necesidades, pendientes, enAtencion, visitas, tareas, solicitudes, urgentes, activas, monitoreo]
  const hayDatos = consultas.some((consulta) => consulta.datos !== undefined)
  const fallidas = consultas.filter((consulta) => consulta.error)
  const algunaActiva = MODULOS_PANEL.some(tiene)

  const alertasAbiertas = indicadores.datos?.alertas_abiertas
    ?? (pendientes.datos && enAtencion.datos ? pendientes.datos.meta.total + enAtencion.datos.meta.total : undefined)
  const visitasDelDia = visitas.datos?.data.filter((visita) => visita.fecha === hoy && visita.estado !== 'cancelada')
  const visitasHechas = visitasDelDia?.filter((visita) => visita.estado === 'completada').length ?? 0
  const solicitudesPendientes = solicitudes.datos?.meta.total
  const sinVisita = organizacion ? indicadores.datos?.seguimiento_vencido : undefined
  const umbral = indicadores.datos?.umbral_dias_sin_visita ?? null
  const sinPersonal = indicadores.datos?.sin_personal_asignado ?? 0

  const eventos: Evento[] = [
    ...(visitas.datos?.data ?? []).filter((visita) => visita.estado === 'programada' || visita.estado === 'en_curso').map((visita): Evento => ({
      clave: `v-${visita.visita_id}`, tipo: 'Visita', titulo: visita.razon,
      detalle: [nombreCompleto(visita.adultos[0]), nombreCompleto(visita.participantes[0])].filter(Boolean).join(' · '),
      estado: ESTADO_EVENTO[visita.estado] ?? visita.estado, fecha: visita.fecha, hora: visita.hora_programada, to: `${raiz}/visitas?visita=${visita.visita_id}`,
    })),
    ...(tareas.datos?.data ?? []).filter((tarea) => tarea.estado === 'pendiente' || tarea.estado === 'en_progreso').map((tarea): Evento => ({
      clave: `t-${tarea.tarea_id}`, tipo: 'Tarea', titulo: tarea.titulo, detalle: [tarea.envejeciente_nombre, tarea.cuidador_nombre].filter(Boolean).join(' · '),
      estado: ESTADO_EVENTO[tarea.estado] ?? tarea.estado, fecha: tarea.fecha_programada, hora: tarea.hora_programada, to: `${raiz}/agenda?tarea=${tarea.tarea_id}`,
    })),
  ].sort((a, b) => `${a.fecha} ${a.hora ?? '99:99'}`.localeCompare(`${b.fecha} ${b.hora ?? '99:99'}`)).slice(0, 3)
  const hayEventos = tiene('visitas') || (coordinador && tiene('agenda'))
  const casosMonitoreo = (monitoreo.datos?.data ?? []).filter((caso) => caso.seguimiento)
  const alertasUrgentes = (urgentes.datos?.data ?? []).flatMap((caso) => caso.alertas).slice(0, 3)

  if (!algunaActiva) return null
  const kpis = <>
    {alertasAbiertas !== undefined && <TarjetaKpi variante="panel" tono="rojo" icono="notifications_active" valor={alertasAbiertas} etiqueta="Alertas abiertas" to={`${raiz}/alertas`} />}
    {adultos.datos && <TarjetaKpi variante="panel" tono="azul" icono="elderly" valor={adultos.datos.meta.total} etiqueta="Adultos activos" to={`${raiz}/envejecientes`} />}
    {necesidades.datos && <TarjetaKpi variante="panel" tono="ambar" icono="volunteer_activism" valor={necesidades.datos.meta.total} etiqueta="Necesidades" detalle="Activas" to={`${raiz}/necesidades`} />}
    {visitasDelDia && <TarjetaKpi variante="panel" tono="verde" icono="calendar_month" valor={visitasDelDia.length === 0 ? 0 : `${visitasHechas}/${visitasDelDia.length}`}
      etiqueta="Visitas de hoy" detalle={visitasDelDia.length === 0 ? 'Ninguna programada' : `${visitasHechas} ${visitasHechas === 1 ? "completada" : "completadas"} de ${visitasDelDia.length}`} to={`${raiz}/visitas`} />}
  </>
  const hayKpis = alertasAbiertas !== undefined || !!adultos.datos || !!necesidades.datos || !!visitasDelDia
  const conAlertas = tiene('alertas') && (urgentes.datos || activas.datos)
  const otrosPendientes = sinVisita !== undefined || solicitudesPendientes !== undefined || (sinPersonal > 0 && !coordinador)

  return <>
    {!enLinea && <Aviso tipo="advertencia" icono="wifi_off">
      {hayDatos ? 'Sin conexión. Se muestran los últimos datos consultados.' : 'Sin conexión. El resumen se mostrará cuando vuelva Internet.'}
    </Aviso>}
    {enLinea && !hayDatos && fallidas.length > 0 && <Aviso tipo="advertencia">
      <p>No se pudo consultar el resumen. Comprueba tu conexión.</p>
      <Button variant="ghost" className="-ms-4" onClick={() => fallidas.forEach((consulta) => consulta.reintentar())}>Reintentar</Button>
    </Aviso>}
    {enLinea && !hayDatos && fallidas.length === 0 && <p role="status" className="text-ayuda text-muted">Consultando el resumen…</p>}

    {hayKpis && <Bloque id="inicio-resumen" titulo="Resumen de hoy">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{kpis}</div>
    </Bloque>}

    {!coordinador && <div className="grid items-start gap-5 lg:grid-cols-2">
      {otrosPendientes && <Bloque id="inicio-pendientes" titulo="Otros pendientes">
        <ul className={LISTA}>
          {sinVisita !== undefined && <Pendiente icono="schedule" titulo="Adultos sin visita reciente"
            descripcion={umbral ? `Más de ${umbral} días sin contacto` : 'Superaron el límite de días sin visita'} valor={sinVisita} unidad="adultos" to={`${raiz}/resumen`} />}
          {solicitudesPendientes !== undefined && <Pendiente icono="inbox" titulo="Solicitudes de visita"
            descripcion={solicitudesPendientes > 0 ? 'Esperan tu revisión' : 'No hay solicitudes pendientes'} valor={solicitudesPendientes} unidad="solicitudes" to={`${raiz}/solicitudes-visita`} />}
          {sinPersonal > 0 && <Pendiente icono="warning" titulo="Adultos sin personal asignado"
            descripcion="No tienen cuidador ni voluntario" valor={sinPersonal} unidad="adultos" to={`${raiz}/resumen`} />}
        </ul>
      </Bloque>}
      {conAlertas && urgentes.datos && <Bloque id="inicio-alertas" titulo="Alertas urgentes" enlace={{ to: `${raiz}/alertas`, texto: 'Ver todas' }}>
        <ListaAlertas alertas={alertasUrgentes} raiz={raiz} />
      </Bloque>}
    </div>}

    {coordinador && <>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {conAlertas && activas.datos && <Bloque id="inicio-alertas" titulo="Alertas activas" enlace={{ to: `${raiz}/alertas`, texto: 'Ver todas' }}>
          <ListaAlertas alertas={activas.datos.data} raiz={raiz} />
        </Bloque>}
        {hayEventos && (visitas.datos || tareas.datos) && <Bloque id="inicio-eventos" titulo="Próximos eventos"
          enlace={{ to: `${raiz}/${tiene('agenda') ? 'agenda' : 'visitas'}`, texto: 'Ver agenda' }}>
          <ListaEventos eventos={eventos} hoy={hoy} />
        </Bloque>}
        {(casosMonitoreo.length > 0 || sinPersonal > 0) && <Bloque id="inicio-monitoreo" titulo="Monitoreo de visitas">
          {umbral && <p className="-mt-2 text-ayuda text-muted">Días sin visita contra el umbral de {umbral} días.</p>}
          <Monitoreo casos={casosMonitoreo} raiz={raiz} sinPersonal={sinPersonal} />
        </Bloque>}
        {solicitudesPendientes !== undefined && <Bloque id="inicio-autorizar" titulo="Por autorizar">
          <ul className={LISTA}>
            <Pendiente icono="inbox" titulo="Solicitudes de visita" descripcion={solicitudesPendientes > 0 ? 'Esperan tu revisión' : 'No hay solicitudes pendientes'}
              valor={solicitudesPendientes} unidad="solicitudes" to={`${raiz}/solicitudes-visita`} />
          </ul>
        </Bloque>}
      </div>
    </>}
  </>
}

/* ───────────── Accesos rápidos ───────────── */

function Accesos({ raiz, modulos }: { raiz: string; modulos: Seccion[] }) {
  return <Bloque id="accesos-operativos" titulo="Accesos rápidos">
    <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {modulos.map((modulo) => <li key={modulo.id} className="min-w-0">
        <Link to={`${raiz}/${modulo.id}`} className={cn(TARJETA, 'flex h-full min-h-16 items-center gap-3 p-3 hover:bg-blue-100/50')}>
          <span className="grid size-10 flex-none place-items-center rounded-md bg-blue-100 text-navy"><Icono nombre={modulo.icono} /></span>
          <span className="flex min-w-0 flex-1 flex-col"><strong className="text-cuerpo text-ink">{modulo.titulo}</strong><span className="text-ayuda text-muted">{modulo.descripcion}</span></span>
          <Icono nombre="chevron_right" className="flex-none text-muted" />
        </Link>
      </li>)}
    </ul>
  </Bloque>
}

/* ───────────── Inicio ───────────── */

export function Inicio({ base, token, cuenta, usuarioId, raiz, visible, nombreUsuario, revision, actualizar }: {
  base: string
  token: string
  cuenta: CuentaMe
  usuarioId: string
  raiz: string
  visible: Seccion[]
  nombreUsuario: string
  revision: number
  actualizar: () => void
}) {
  // Sin ningún módulo de panel visible (p. ej. permisos mínimos) no habría nada que mostrar: se conserva el Inicio completo.
  const panel = tienePanelGestion(cuenta) && visible.some((modulo) => MODULOS_PANEL.includes(modulo.id))
  const modulos = visible.filter((modulo) => modulo.id !== 'cuenta')
  return <>
    <Saludo nombreUsuario={nombreUsuario} />
    <AvisoSuscripcion cuenta={cuenta} token={token} raiz={raiz} />
    {panel && <PanelGestion base={base} token={token} cuenta={cuenta} raiz={raiz} visible={visible} revision={revision} />}
    {!panel && visible.length > 1 && <Accesos raiz={raiz} modulos={modulos} />}
    {!panel && puedeConsultarSuscripcion(cuenta) && <Bloque id="inicio-suscripcion" titulo="Suscripción">
      <div className={cn(TARJETA, 'px-4 py-1')}>
        <FilaLista icono="credit_card" titulo="Ver suscripción y pagos" descripcion={suscripcionTexto(cuenta.estado_suscripcion)} to={`${raiz}/suscripcion`} />
      </div>
    </Bloque>}
    {!panel && <GestionCuenta base={base} token={token} cuenta={cuenta} usuarioId={usuarioId} actualizar={actualizar} />}
  </>
}
