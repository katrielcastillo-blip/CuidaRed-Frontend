/*
 * portal.tsx — Navegación operativa por cuenta, con autorización consultada al servidor.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, CalendarClock, ChevronRight, Ellipsis, HeartHandshake, House, ListTodo, Settings, Users, UserRound, Wifi, WifiOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PantallaMiembros } from '../miembros'
import { ResumenCuenta } from '../resumen-cuenta'
import { ROL_TEXTO, TIPO_TEXTO } from '../cuentas-datos'
import type { CuentaMe } from '../client'
import { Agenda } from './agenda'
import type { ColaVisitas } from './cola-visitas'
import { Estado, idRuta, useConexionReal, useDatos } from './controles'
import { Envejecientes } from './envejecientes'
import { GestionCuenta } from './gestion-cuenta'
import { Visitas } from './visitas'

type Seccion = {
  id: string
  nombre: string
  titulo: string
  descripcion: string
  icono: LucideIcon
  permiso?: string
}

const secciones: Seccion[] = [
  { id: 'cuenta', nombre: 'Inicio', titulo: 'Datos de cuenta', descripcion: 'Datos y suscripción de la cuenta activa', icono: House },
  { id: 'envejecientes', nombre: 'Adultos', titulo: 'Envejecientes', descripcion: 'Expedientes y seguimiento', icono: HeartHandshake, permiso: 'adultos:ver' },
  { id: 'visitas', nombre: 'Visitas', titulo: 'Mis visitas', descripcion: 'Visitas programadas e historial', icono: CalendarClock, permiso: 'visitas:ver' },
  { id: 'agenda', nombre: 'Agenda', titulo: 'Agenda', descripcion: 'Tareas de cuidado y evidencias', icono: ListTodo, permiso: 'agenda:ver' },
  { id: 'miembros', nombre: 'Miembros', titulo: 'Miembros de la cuenta', descripcion: 'Personas, invitaciones y roles', icono: Users, permiso: 'usuarios:gestionar' },
  { id: 'configuracion', nombre: 'Configuración', titulo: 'Configurar cuenta', descripcion: 'Datos de contacto y preferencias', icono: Settings, permiso: 'organizacion:configurar' },
]
const mas: Seccion = { id: 'mas', nombre: 'Más', titulo: 'Más opciones', descripcion: 'Más módulos de la cuenta', icono: Ellipsis }

function MenuOperativo({ raiz, cuenta, modulos, seccion }: { raiz: string; cuenta: CuentaMe; modulos: Seccion[]; seccion: string }) {
  const orden = cuenta.rol === 'administrador' ? ['cuenta', 'envejecientes', 'miembros']
    : cuenta.rol === 'coordinador' ? ['cuenta', 'envejecientes', 'visitas']
      : ['cuenta', 'envejecientes', 'visitas', 'agenda']
  const favoritos = orden.flatMap((id) => modulos.filter((modulo) => modulo.id === id))
  const adicionales = modulos.filter((modulo) => !orden.includes(modulo.id))
  const claseMovil = 'flex min-h-12 min-w-0 flex-[0_1_96px] flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold'
  const activoEnMas = seccion === 'mas' || adicionales.some((modulo) => modulo.id === seccion)

  return <>
    <nav aria-label="Módulos de la cuenta" className="sticky top-0 hidden h-dvh flex-col gap-2 bg-navy px-3 py-5 text-blue-100 md:flex lg:px-4">
      <Link to={`${raiz}/cuenta`} className="mb-4 flex min-h-12 items-center justify-center rounded-md bg-surface px-2 py-1.5 hover:bg-blue-100" aria-label="CuidaRed, ir al inicio">
        <picture className="min-w-0">
          <source media="(min-width: 1100px)" srcSet="/brand/logo.png" width={517} height={192} />
          <img src="/brand/logosimbolo.png" alt="" width={149} height={178} className="h-9 w-auto max-w-full object-contain lg:h-12" />
        </picture>
      </Link>
      {modulos.map((modulo) => <NavLink key={modulo.id} to={`${raiz}/${modulo.id}`} title={modulo.nombre}
        className={({ isActive }) => cn('flex min-h-12 items-center justify-center gap-3 rounded-md px-3 font-semibold lg:justify-start', isActive ? 'bg-blue-100 text-navy' : 'hover:bg-white/10')}>
        <modulo.icono size={22} aria-hidden />
        <span className="sr-only lg:not-sr-only">{modulo.nombre}</span>
      </NavLink>)}
      <div className="mt-auto hidden border-t border-blue-100/20 px-2 pt-4 lg:block">
        <p className="break-words text-sm font-semibold text-white">{cuenta.nombre}</p>
        <p className="text-xs text-blue-100">{ROL_TEXTO[cuenta.rol]} · {TIPO_TEXTO[cuenta.tipo]}</p>
      </div>
    </nav>
    <nav aria-label="Módulos de la cuenta" className="fixed inset-x-0 bottom-0 z-30 flex justify-center gap-1 bg-navy px-2 pt-2 pb-[calc(8px+var(--safe-bottom))] text-blue-100 shadow-1 md:hidden">
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

export function Portal({ token, usuarioId, cola }: { token: string; usuarioId: string; cola: ColaVisitas }) {
  const { cuentaId, seccion = 'cuenta' } = useParams()
  const [revision, setRevision] = useState(0)
  const enLinea = useConexionReal()
  const contenido = useRef<HTMLElement>(null)
  const base = cuentaId && /^[1-9][0-9]{0,18}$/.test(cuentaId) ? `/cuentas/${idRuta(cuentaId)}` : null
  const raiz = `/operacion/${idRuta(cuentaId ?? '')}`
  const contexto = useDatos<CuentaMe>(base ? `${base}/contexto` : null, token, revision)
  useEffect(() => {
    const actualizar = () => { if (document.visibilityState === 'visible') setRevision((n) => n + 1) }
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
  const visible = secciones.filter((modulo) => !modulo.permiso || (cuenta?.acceso_operativo === true && cuenta.permisos.includes(modulo.permiso)))
  const actual = [...visible, mas].find((modulo) => modulo.id === seccion)
  const props = cuenta && base ? { base, token, cuenta, usuarioId } : undefined
  const titulo = seccion === 'cuenta' ? cuenta?.nombre ?? 'Cuenta de CuidaRed'
    : actual?.id === 'configuracion' && cuenta?.tipo === 'organizacion' ? 'Configurar organización'
      : actual?.titulo ?? 'Cuenta de CuidaRed'
  const IconoConexion = enLinea ? Wifi : WifiOff
  if (props && actual?.id === 'miembros') return <PantallaMiembros token={token} cuenta={props.cuenta} usuarioId={usuarioId} volver={`${raiz}/cuenta`} />

  return <div className={cn('min-h-dvh bg-bg', cuenta && 'md:grid md:grid-cols-[80px_minmax(0,1fr)] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]')}>
    <a href="#contenido-operativo" className="sr-only z-50 rounded-md bg-surface p-3 text-navy focus:not-sr-only focus:fixed focus:left-2 focus:top-2">Saltar al contenido</a>
    {cuenta && <MenuOperativo raiz={raiz} cuenta={cuenta} modulos={visible} seccion={seccion} />}
    <div className="min-w-0 pb-[calc(var(--bottomnav-h)+var(--safe-bottom)+12px)] md:pb-0">
      <header className="bg-navy text-blue-100 shadow-1">
        <div className="mx-auto flex min-h-[var(--appbar-h)] max-w-[calc(var(--content-max)+var(--gutter)*2)] items-center gap-2 px-3 pt-[var(--safe-top)] sm:gap-3 sm:px-[var(--gutter)]">
          {seccion !== 'cuenta' && <Link to={`${raiz}/cuenta`} className="grid size-12 flex-none place-items-center rounded-full hover:bg-white/10" aria-label="Volver">
            <ArrowLeft size={23} aria-hidden />
          </Link>}
          <h1 className="min-w-0 flex-1 break-words py-2 text-lg font-semibold leading-tight sm:text-xl">{titulo}</h1>
          <span role="status" className={cn('inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-semibold', enLinea ? 'bg-white/10 text-blue-100' : 'bg-warning-100 text-ink')}>
            <IconoConexion size={16} aria-hidden /><span className={enLinea ? 'sr-only sm:not-sr-only' : undefined}>{enLinea ? 'En línea' : 'Sin conexión'}</span>
          </span>
          <Link to="/cuenta" className="grid size-12 flex-none place-items-center rounded-full border border-blue-100/40 hover:bg-white/10" aria-label="Mi cuenta">
            <UserRound size={22} aria-hidden />
          </Link>
        </div>
      </header>
      <main ref={contenido} id="contenido-operativo" tabIndex={-1} className="mx-auto grid w-full max-w-[calc(var(--content-max)+var(--gutter)*2)] gap-5 px-[var(--gutter)] py-5 focus:outline-none sm:py-6">
        {!base ? <p role="alert">No se encontró la cuenta.</p> : <Estado consulta={contexto} />}
        {props && <div key={props.cuenta.cuenta_id} className="grid min-w-0 gap-5">
          {!actual && <p role="alert" className="rounded-md border border-line-soft bg-surface p-4">No tienes acceso a este módulo de la cuenta.</p>}
          {actual?.id === 'cuenta' && <>
            <div className="flex items-center gap-3">
              <span className="grid size-12 flex-none place-items-center rounded-md bg-blue-100 text-navy"><Building2 size={23} aria-hidden /></span>
              <div className="min-w-0"><p className="font-semibold text-ink">{TIPO_TEXTO[props.cuenta.tipo]}</p><p className="text-sm text-ink-2">{ROL_TEXTO[props.cuenta.rol]}</p></div>
            </div>
            <ResumenCuenta cuenta={props.cuenta} token={token} mostrarAcciones={false} />
            {visible.length > 1 && <section aria-labelledby="accesos-operativos" className="grid gap-3">
              <h2 id="accesos-operativos" className="text-lg font-semibold text-ink">Accesos rápidos</h2>
              <Accesos raiz={raiz} modulos={visible.filter((modulo) => modulo.id !== 'cuenta')} />
            </section>}
            <GestionCuenta {...props} actualizar={() => setRevision((n) => n + 1)} />
          </>}
          {actual?.id === 'mas' && <Accesos raiz={raiz} modulos={visible} />}
          {actual?.id === 'configuracion' && <GestionCuenta {...props} vista="configuracion" actualizar={() => setRevision((n) => n + 1)} />}
          {actual?.id === 'envejecientes' && <Envejecientes {...props} />}
          {actual?.id === 'visitas' && <Visitas {...props} cola={cola} />}
          {actual?.id === 'agenda' && <Agenda {...props} />}
        </div>}
      </main>
    </div>
  </div>
}
