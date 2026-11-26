/*
 * portal.tsx — Navegación operativa por cuenta, con autorización consultada al servidor.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, Bell, CalendarClock, ChartColumn, ChevronDown, ChevronRight, ClipboardList, Ellipsis, HandHelping, HeartHandshake, House, Inbox, ListTodo, ScrollText, Settings, Users, UserRound, Wifi, WifiOff } from '@/components/icons'
import type { LucideIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { useLogo } from '@/lib/marca'
import { MiembrosEnPanel } from '../miembros'
import { ResumenCuenta } from '../resumen-cuenta'
import { puedeConsultarSuscripcion, recibeAvisosDeAlertas, ROL_TEXTO, TIPO_TEXTO } from '../cuentas-datos'
import type { CuentaMe, Profile } from '../client'
import { InicioOperativo } from './inicio-operativo'
import { Agenda } from './agenda'
import { Alertas } from './alertas'
import { AuditoriaCuenta } from './auditoria'
import type { ColaOperaciones } from './cola-operaciones'
import { Estado, idRuta, useConexionReal, useDatos, usePagina } from './controles'
import { Envejecientes } from './envejecientes'
import { GestionCuenta } from './gestion-cuenta'
import { Necesidades } from './necesidades'
import { Reportes } from './reportes'
import { ResumenCasos } from './resumen-casos'
import { SolicitudesVisita } from './solicitudes-visita'
import { SuscripcionCuenta } from './suscripcion'
import { Visitas } from './visitas'

type Seccion = {
  id: string
  nombre: string
  titulo: string
  descripcion: string
  icono: LucideIcon
  permiso?: string
  soloOrganizacion?: boolean
}

const secciones: Seccion[] = [
  { id: 'cuenta', nombre: 'Inicio', titulo: 'Datos de cuenta', descripcion: 'Datos y suscripción de la cuenta activa', icono: House },
  { id: 'envejecientes', nombre: 'Adultos', titulo: 'Envejecientes', descripcion: 'Expedientes y seguimiento', icono: HeartHandshake, permiso: 'adultos:ver' },
  { id: 'visitas', nombre: 'Visitas', titulo: 'Mis visitas', descripcion: 'Visitas programadas e historial', icono: CalendarClock, permiso: 'visitas:ver', soloOrganizacion: true },
  { id: 'agenda', nombre: 'Agenda', titulo: 'Agenda', descripcion: 'Tareas de cuidado y evidencias', icono: ListTodo, permiso: 'agenda:ver' },
  { id: 'necesidades', nombre: 'Necesidades', titulo: 'Necesidades', descripcion: 'Necesidades activas y su seguimiento', icono: HandHelping, permiso: 'necesidades:ver' },
  { id: 'alertas', nombre: 'Alertas', titulo: 'Alertas', descripcion: 'Casos prioritarios y notificaciones', icono: Bell, permiso: 'alertas:ver' },
  { id: 'resumen', nombre: 'Resumen', titulo: 'Resumen de casos', descripcion: 'Casos activos, prioridad y estado de atención', icono: ClipboardList, permiso: 'resumen:ver' },
  { id: 'reportes', nombre: 'Reportes', titulo: 'Reportes y estadísticas', descripcion: 'Indicadores, gráficos y exportaciones', icono: ChartColumn, permiso: 'reportes:ver' },
  { id: 'miembros', nombre: 'Miembros', titulo: 'Miembros de la cuenta', descripcion: 'Personas, invitaciones y roles', icono: Users, permiso: 'usuarios:gestionar' },
  { id: 'configuracion', nombre: 'Configuración', titulo: 'Configurar cuenta', descripcion: 'Datos de contacto y preferencias', icono: Settings, permiso: 'organizacion:configurar' },
  { id: 'solicitudes-visita', nombre: 'Solicitudes', titulo: 'Solicitudes de visita', descripcion: 'Revisar solicitudes recibidas', icono: Inbox, permiso: 'visitas:autorizar', soloOrganizacion: true },
  { id: 'auditoria', nombre: 'Auditoría', titulo: 'Auditoría', descripcion: 'Actividad registrada en la cuenta', icono: ScrollText, permiso: 'auditoria:ver' },
]
const mas: Seccion = { id: 'mas', nombre: 'Más', titulo: 'Más opciones', descripcion: 'Más módulos de la cuenta', icono: Ellipsis }

function ArbolModulos({ raiz, modulos, actual, oscuro = true }: { raiz: string; modulos: Seccion[]; actual: string; oscuro?: boolean }) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  const hijos: Record<string, string> = { 'solicitudes-visita': 'visitas', resumen: 'reportes' }
  const padres = secciones.filter(m => !hijos[m.id] && (modulos.some(p => p.id === m.id) || modulos.some(p => hijos[p.id] === m.id)))
  const clase = (activo: boolean) => cn('flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-left font-semibold', oscuro ? 'justify-center lg:justify-start' : 'bg-white', activo ? (oscuro ? 'bg-blue-100 text-navy' : 'bg-blue-100 text-primary') : (oscuro ? 'hover:bg-white/10' : 'text-ink hover:bg-blue-100'))
  return <div className="grid min-w-0 gap-1">{padres.map(padre => {
    const secundarios = modulos.filter(m => hijos[m.id] === padre.id)
    const permitido = modulos.some(m => m.id === padre.id)
    const seleccionado = actual === padre.id || secundarios.some(m => m.id === actual)
    const abierto = abiertos[padre.id] ?? seleccionado
    const id = `submenu-${oscuro ? 'lateral' : 'mas'}-${padre.id}`
    const etiqueta = <><padre.icono size={24} aria-hidden /><span className={oscuro ? 'sr-only lg:not-sr-only' : undefined}>{padre.nombre}</span></>
    return <div key={padre.id} className="min-w-0">
      <div className={cn('flex min-w-0 items-center gap-1', oscuro && 'flex-wrap lg:flex-nowrap')}>
        {permitido ? <NavLink title={padre.nombre} to={`${raiz}/${padre.id}`} onClick={() => setAbiertos(a => ({ ...a, [padre.id]: true }))} className={({ isActive }) => clase(isActive)}>{etiqueta}</NavLink>
          : <button type="button" className={clase(seleccionado)} onClick={() => setAbiertos(a => ({ ...a, [padre.id]: !abierto }))} aria-expanded={abierto} aria-controls={id}>{etiqueta}</button>}
        {secundarios.length > 0 && <button type="button" aria-label={`${abierto ? 'Contraer' : 'Desplegar'} opciones de ${padre.nombre}`} aria-expanded={abierto} aria-controls={id} onClick={() => setAbiertos(a => ({ ...a, [padre.id]: !abierto }))} className={cn('grid size-12 shrink-0 place-items-center rounded-sm', oscuro ? 'hover:bg-white/10' : 'text-navy hover:bg-blue-100')}><ChevronDown size={20} className={abierto ? 'rotate-180' : ''} aria-hidden /></button>}
      </div>
      {secundarios.length > 0 && <div id={id} hidden={!abierto} className={cn('grid gap-1', oscuro ? 'border-white/25 lg:ml-3 lg:border-l lg:pl-2' : 'ml-3 border-l border-line-soft pl-2')}>{secundarios.map(hijo => <NavLink key={hijo.id} title={hijo.nombre} to={`${raiz}/${hijo.id}`} className={({ isActive }) => clase(isActive)}><hijo.icono size={20} aria-hidden /><span className={oscuro ? 'sr-only lg:not-sr-only text-sm' : 'text-sm'}>{hijo.nombre}</span></NavLink>)}</div>}
    </div>
  })}</div>
}

function MenuOperativo({ raiz, cuenta, modulos, seccion }: { raiz: string; cuenta: CuentaMe; modulos: Seccion[]; seccion: string }) {
  const logo = useLogo()
  const isotipo = useLogo('isotipo')
  const orden = cuenta.rol === 'administrador' ? ['cuenta', 'envejecientes', 'miembros']
    : cuenta.rol === 'coordinador' ? ['cuenta', 'envejecientes', 'visitas']
      : ['cuenta', 'envejecientes', 'visitas', 'agenda']
  const favoritos = orden.flatMap((id) => modulos.filter((modulo) => modulo.id === id))
  const adicionales = modulos.filter((modulo) => !orden.includes(modulo.id))
  const claseMovil = 'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-sm font-semibold leading-tight wrap-anywhere [&>span]:max-w-full'
  const activoEnMas = seccion === 'mas' || adicionales.some((modulo) => modulo.id === seccion)

  return <>
    <nav aria-label="Módulos de la cuenta" className="sticky top-0 hidden h-dvh flex-col gap-1 overflow-y-auto bg-navy px-3 py-5 text-blue-100 md:flex lg:px-4">
      <Link to={`${raiz}/cuenta`} className="mb-4 flex min-h-12 items-center justify-center rounded-md bg-surface px-2 py-1.5 hover:bg-blue-100" aria-label="CuidaRed, ir al inicio">
        <picture className="min-w-0">
          <source media="(min-width: 1100px)" srcSet={logo} width={517} height={192} />
          <img src={isotipo} alt="" width={149} height={178} className="h-9 w-auto max-w-full object-contain lg:h-12" />
        </picture>
      </Link>
      <ArbolModulos raiz={raiz} modulos={modulos} actual={seccion} />
      <div className="mt-auto hidden border-t border-blue-100/20 px-2 pt-4 lg:block">
        <p className="break-words text-sm font-semibold text-white">{cuenta.nombre}</p>
        <p className="text-xs text-blue-100">{ROL_TEXTO[cuenta.rol]} · {TIPO_TEXTO[cuenta.tipo]}</p>
      </div>
    </nav>
    <nav aria-label="Módulos de la cuenta" className="fixed inset-x-0 bottom-0 z-30 flex justify-center gap-2 border-t border-white/15 bg-navy px-2 pt-2 pb-[calc(8px+var(--safe-bottom))] text-blue-100 shadow-1 md:hidden">
      {favoritos.map((modulo) => <NavLink key={modulo.id} to={`${raiz}/${modulo.id}`}
        className={({ isActive }) => cn(claseMovil, isActive ? 'bg-blue-100/15 text-white' : 'hover:bg-white/10')}>
        <modulo.icono size={22} aria-hidden />
        <span>{modulo.nombre}</span>
      </NavLink>)}
      {adicionales.length > 0 && <Link to={`${raiz}/mas`} aria-current={activoEnMas ? 'location' : undefined}
        className={cn(claseMovil, activoEnMas ? 'bg-blue-100/15 text-white' : 'hover:bg-white/10')}>
        <Ellipsis size={22} aria-hidden />
        <span>Más</span>
      </Link>}
    </nav>
  </>
}

function Accesos({ raiz, modulos }: { raiz: string; modulos: Seccion[] }) {
  return <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2">
    {modulos.map((modulo) => <li key={modulo.id} className="min-w-0">
      <Link to={`${raiz}/${modulo.id}`} className="flex h-full min-h-16 items-center gap-3 rounded-md border border-line-soft bg-surface p-3 hover:border-blue">
        <span className="grid size-11 flex-none place-items-center rounded-md bg-blue-100 text-navy"><modulo.icono size={21} aria-hidden /></span>
        <span className="flex min-w-0 flex-1 flex-col"><strong className="text-ink">{modulo.titulo}</strong><span className="text-sm text-ink-2">{modulo.descripcion}</span></span>
        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
      </Link>
    </li>)}
  </ul>
}

export function Portal({ token, usuarioId, cola, perfil }: { token: string; usuarioId: string; cola: ColaOperaciones; perfil: Pick<Profile, 'nombres' | 'apellidos'> }) {
  const { cuentaId, seccion = 'cuenta' } = useParams()
  const { key: navegacion, search } = useLocation()
  const [revision, setRevision] = useState(0)
  const [fechaInicio, setFechaInicio] = useState(() => new Date())
  const actualizarContexto = useCallback(() => setRevision((n) => n + 1), [])
  const enLinea = useConexionReal()
  const contenido = useRef<HTMLElement>(null)
  const base = cuentaId && /^[1-9][0-9]{0,18}$/.test(cuentaId) ? `/cuentas/${idRuta(cuentaId)}` : null
  const raiz = `/operacion/${idRuta(cuentaId ?? '')}`
  const contexto = useDatos<CuentaMe>(base ? `${base}/contexto` : null, token, revision)
  useEffect(() => {
    const actualizar = () => { if (document.visibilityState === 'visible') { setRevision((n) => n + 1); setFechaInicio(new Date()) } }
    const timer = window.setInterval(actualizar, 30_000)
    window.addEventListener('focus', actualizar)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', actualizar)
    }
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
    contenido.current?.focus({ preventScroll: true })
  }, [cuentaId, seccion])
  const cuenta = contexto.datos
  const visible = secciones.filter((modulo) =>
    (!modulo.soloOrganizacion || cuenta?.tipo === 'organizacion') &&
    (!modulo.permiso || (cuenta?.acceso_operativo === true && cuenta.permisos.includes(modulo.permiso))))
  const actual = [...visible, mas].find((modulo) => modulo.id === seccion)
  const suscripcion = seccion === 'suscripcion' && puedeConsultarSuscripcion(cuenta)
  // La campana solo se muestra a quien recibe avisos de alertas (ver `recibeAvisosDeAlertas`); el resto tendría un contador siempre en cero.
  const mostrarAvisos = !!cuenta && recibeAvisosDeAlertas(cuenta) && visible.some((modulo) => modulo.id === 'alertas')
  const avisos = usePagina<unknown>(base && mostrarAvisos ? `${base}/notificaciones-alerta` : null, token, revision,
    { limit: 1, filters: { estado: 'no_leida' } })
  const pendientes = avisos.datos?.meta.total ?? 0
  const props = cuenta && base ? { base, token, cuenta, usuarioId } : undefined
  const titulo = seccion === 'cuenta' ? cuenta?.nombre ?? 'Cuenta de CuidaRed'
    : suscripcion ? 'Suscripción y pagos'
      : actual?.id === 'configuracion' && cuenta?.tipo === 'organizacion' ? 'Configurar organización'
      : seccion === 'alertas' && new URLSearchParams(search).get('bandeja') === 'avisos' ? 'Notificaciones' : actual?.titulo ?? 'Cuenta de CuidaRed'
  const IconoConexion = enLinea ? Wifi : WifiOff
  const esInicio = seccion === 'cuenta'
  const iniciales = (perfil.nombres.charAt(0) + perfil.apellidos.charAt(0)).toLocaleUpperCase('es')

  return <div className={cn('min-h-dvh bg-bg', cuenta && 'md:grid md:grid-cols-[80px_minmax(0,1fr)] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]')}>
    <a href="#contenido-operativo" className="sr-only z-50 rounded-md bg-surface p-3 text-navy focus:not-sr-only focus:fixed focus:left-2 focus:top-2">Saltar al contenido</a>
    {cuenta && <MenuOperativo raiz={raiz} cuenta={cuenta} modulos={visible} seccion={seccion} />}
    <div className="min-w-0 pb-[calc(var(--bottomnav-h)+var(--safe-bottom)+12px)] md:pb-0">
      <header className={cn('cabecera-pwa bg-navy text-blue-100', esInicio ? 'rounded-b-[1.75rem] border-b-4 border-teal pb-5 sm:pb-7' : 'shadow-1')}>
        <div className="cabecera-pwa-fila mx-auto flex min-h-[var(--appbar-h)] max-w-[calc(var(--content-max)+var(--gutter)*2)] items-center gap-2 px-3 pt-[var(--safe-top)] sm:gap-3 sm:px-[var(--gutter)]">
          {seccion !== 'cuenta' && <Link to={`${raiz}/cuenta`} className="grid size-12 flex-none place-items-center rounded-full hover:bg-white/10" aria-label="Volver">
            <ArrowLeft size={23} aria-hidden />
          </Link>}
          <h1 className="cabecera-pwa-titulo min-w-0 flex-1 break-words py-2 text-base font-semibold leading-snug text-white sm:text-lg">{titulo}</h1>
          <span role="status" className={cn('inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-semibold lg:h-[48px] lg:px-3', esInicio ? 'h-[48px] min-w-[48px]' : 'h-[32px] min-w-[32px]', enLinea ? 'bg-white/10 text-blue-100' : 'bg-warning-100 text-ink')}>
            <IconoConexion size={24} className={!esInicio ? 'text-[20px] lg:text-[24px]' : undefined} aria-hidden /><span className="sr-only lg:not-sr-only">{enLinea ? 'En línea' : 'Sin conexión'}</span>
          </span>
          {mostrarAvisos && <Link to={`${raiz}/alertas?bandeja=avisos`}
            className="relative grid size-[48px] flex-none place-items-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label={pendientes > 0 ? `Notificaciones, ${pendientes} sin leer` : 'Notificaciones'} title="Notificaciones">
            <Bell size={22} aria-hidden />
            {pendientes > 0 && <span aria-hidden className="absolute top-0.5 right-0 min-w-5 rounded-full bg-danger px-1 text-center text-xs leading-5 font-bold text-white">
              {pendientes > 99 ? '99+' : pendientes}
            </span>}
          </Link>}
          <Link to="/cuenta" className="grid size-[48px] flex-none place-items-center rounded-full border-2 border-blue bg-blue-100 font-semibold text-navy hover:bg-white" aria-label="Mi cuenta">
            {iniciales || <UserRound size={22} aria-hidden />}
          </Link>
        </div>
        {esInicio && <div className="mx-auto grid max-w-[calc(var(--content-max)+var(--gutter)*2)] gap-1 px-[var(--gutter)] pt-2">
          <h2 className="text-[1.625rem] font-bold leading-tight text-white sm:text-3xl">Hola{perfil.nombres ? ', ' + perfil.nombres.split(' ')[0] : ''}</h2>
          <p className="text-sm text-blue-100 sm:text-base">{new Intl.DateTimeFormat('es-DO', { timeZone: 'America/Santo_Domingo', weekday: 'long', day: 'numeric', month: 'long' }).format(fechaInicio)}</p>
        </div>}
      </header>
      <main ref={contenido} id="contenido-operativo" tabIndex={-1} className="mx-auto grid min-w-0 w-full max-w-[calc(var(--content-max)+var(--gutter)*2)] gap-5 px-[var(--gutter)] py-5 wrap-anywhere focus:outline-none sm:py-6">
        {!base ? <p role="alert">No se encontró la cuenta.</p> : <Estado consulta={contexto} />}
        {props && <div key={props.cuenta.cuenta_id} className="grid min-w-0 grid-cols-1 gap-5">
          {!actual && !suscripcion && <p role="alert" className="rounded-md border border-line-soft bg-surface p-4">No tienes acceso a este módulo de la cuenta.</p>}
          {actual?.id === 'cuenta' && <>
            <ResumenCuenta cuenta={props.cuenta} token={token} mostrarAcciones={false} compacto />
            <InicioOperativo {...props} revision={revision} />
            {visible.length > 1 && <section aria-labelledby="accesos-operativos" className="grid gap-3">
              <h2 id="accesos-operativos" className="text-lg font-semibold text-ink">Accesos rápidos</h2>
              <Accesos raiz={raiz} modulos={visible.filter((modulo) => modulo.id !== 'cuenta')} />
            </section>}
            <GestionCuenta {...props} actualizar={() => setRevision((n) => n + 1)} />
          </>}
          {actual?.id === 'mas' && <ArbolModulos raiz={raiz} modulos={visible} actual={seccion} oscuro={false} />}
          {actual?.id === 'miembros' && <MiembrosEnPanel token={token} cuenta={props.cuenta} usuarioId={usuarioId} volver={`${raiz}/cuenta`} />}
          {actual?.id === 'configuracion' && <GestionCuenta {...props} vista="configuracion" actualizar={() => setRevision((n) => n + 1)} />}
          {actual?.id === 'envejecientes' && <Envejecientes {...props} cola={cola} />}
          {actual?.id === 'visitas' && <Visitas {...props} cola={cola} />}
          {actual?.id === 'agenda' && <Agenda {...props} />}
          {actual?.id === 'necesidades' && <Necesidades {...props} cola={cola} />}
          {actual?.id === 'alertas' && <Alertas key={navegacion} {...props} alLeerAviso={() => setRevision((n) => n + 1)} />}
          {actual?.id === 'resumen' && <ResumenCasos {...props} />}
          {actual?.id === 'reportes' && <Reportes {...props} />}
          {actual?.id === 'solicitudes-visita' && <SolicitudesVisita {...props} />}
          {actual?.id === 'auditoria' && <AuditoriaCuenta {...props} />}
          {suscripcion && <SuscripcionCuenta {...props} actualizarContexto={actualizarContexto} />}
        </div>}
      </main>
    </div>
  </div>
}
