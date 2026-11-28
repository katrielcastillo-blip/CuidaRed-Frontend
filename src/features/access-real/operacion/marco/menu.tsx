/*
 * menu.tsx — Menú lateral (tablet y escritorio), barra inferior con pestañas por rol y hoja «Más».
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useId, useRef, useState, type Ref } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Icono } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useLogo } from '@/lib/marca'
import { ROL_TEXTO, TIPO_TEXTO } from '../../cuentas-datos'
import type { CuentaMe } from '../../client'
import type { Seccion } from './modulos'
import type { NombreIcono } from '@/components/ui'
import { useCapa } from './use-capa'

/** Entradas de cuenta que no son módulos con permiso: la suscripción y los datos de la cuenta (ver `datosCuentaAparte`). */
const ENTRADA_SUSCRIPCION = { nombre: 'Plan y pago', icono: 'credit_card' as const, sufijo: 'suscripcion' }
const ENTRADA_DATOS_CUENTA = { nombre: 'Datos de cuenta', icono: 'badge' as const, sufijo: 'datos-cuenta' }

export function MenuLateral({ raiz, cuenta, modulos, conSuscripcion = false, conDatosCuenta = false }: {
  raiz: string
  cuenta: CuentaMe
  modulos: Seccion[]
  conSuscripcion?: boolean
  conDatosCuenta?: boolean
}) {
  const extras = [...(conSuscripcion ? [ENTRADA_SUSCRIPCION] : []), ...(conDatosCuenta ? [ENTRADA_DATOS_CUENTA] : [])]
  const logo = useLogo()
  const isotipo = useLogo('isotipo')
  return <nav aria-label="Módulos de la cuenta" className="sticky top-0 hidden h-dvh flex-col gap-2 overflow-y-auto bg-navy px-3 py-5 text-blue-100 md:flex lg:px-4">
    <Link to={`${raiz}/cuenta`} className="mb-4 flex min-h-12 items-center justify-center rounded-md bg-surface px-2 py-1.5 hover:bg-blue-100" aria-label="CuidaRed, ir al inicio">
      <picture className="min-w-0">
        <source media="(min-width: 1100px)" srcSet={logo} width={517} height={192} />
        <img src={isotipo} alt="" width={149} height={178} className="h-9 w-auto max-w-full object-contain lg:h-12" />
      </picture>
    </Link>
    {modulos.map((modulo) => <NavLink key={modulo.id} to={`${raiz}/${modulo.id}`} title={modulo.nombre}
      className={({ isActive }) => cn('flex min-h-12 items-center justify-center gap-3 rounded-md px-3 lg:justify-start', isActive ? 'bg-white/20 text-white' : 'hover:bg-white/10')}>
      <Icono nombre={modulo.icono} />
      <span className="sr-only text-cuerpo font-semibold lg:not-sr-only">{modulo.nombre}</span>
    </NavLink>)}
    {extras.map((extra) => <NavLink key={extra.sufijo} to={`${raiz}/${extra.sufijo}`} title={extra.nombre}
      className={({ isActive }) => cn('flex min-h-12 items-center justify-center gap-3 rounded-md px-3 lg:justify-start', isActive ? 'bg-white/20 text-white' : 'hover:bg-white/10')}>
      <Icono nombre={extra.icono} />
      <span className="sr-only text-cuerpo font-semibold lg:not-sr-only">{extra.nombre}</span>
    </NavLink>)}
    <div className="mt-auto hidden border-t border-blue-100/20 px-2 pt-4 lg:block">
      <p className="break-words text-ayuda font-semibold text-white">{cuenta.nombre}</p>
      <p className="text-ayuda text-blue-100">{ROL_TEXTO[cuenta.rol]} · {TIPO_TEXTO[cuenta.tipo]}</p>
    </div>
  </nav>
}

const PESTANA = 'flex min-h-12 min-w-0 max-w-28 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-nav'

export function BarraInferior({ raiz, pestanas, hayMas, masActivo, masAbierto, alAbrirMas, masRef }: {
  raiz: string
  pestanas: Seccion[]
  hayMas: boolean
  masActivo: boolean
  masAbierto: boolean
  alAbrirMas: () => void
  masRef: Ref<HTMLButtonElement>
}) {
  return <nav aria-label="Módulos de la cuenta" className="fixed inset-x-0 bottom-0 z-30 box-border flex h-[calc(var(--bottomnav-h)+var(--safe-bottom))] justify-center gap-1 bg-navy px-2 pt-2 pb-[calc(8px+var(--safe-bottom))] shadow-1 md:hidden">
    {pestanas.map((modulo) => <NavLink key={modulo.id} to={`${raiz}/${modulo.id}`}
      className={({ isActive }) => cn(PESTANA, isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10')}>
      <Icono nombre={modulo.icono} />
      <span className="max-w-full truncate">{modulo.nombre}</span>
    </NavLink>)}
    {hayMas && <button ref={masRef} type="button" onClick={alAbrirMas} aria-haspopup="dialog" aria-expanded={masAbierto}
      className={cn(PESTANA, masActivo || masAbierto ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10')}>
      <Icono nombre="more_horiz" />
      <span>Más</span>
    </button>}
  </nav>
}

const IDS_SEGUIMIENTO = ['visitas', 'agenda', 'necesidades', 'alertas', 'resumen', 'solicitudes-visita']
const IDS_ADMINISTRACION = ['reportes', 'auditoria', 'configuracion', 'datos-cuenta', 'miembros', 'suscripcion']
const TONO_SEGUIMIENTO = 'bg-blue-100 text-navy'
const TONO_CUENTA = 'bg-teal-100 text-teal'

type Entrada = { id: string; nombre: string; icono: NombreIcono; ruta: string }

/**
 * Hoja inferior «Más» (Figma 02): módulos restantes agrupados en Seguimiento, Administración y Cuenta (Mi perfil y
 * Cerrar sesión). En el coordinador, Reportes va en Seguimiento. En pantallas anchas se muestra como diálogo centrado.
 */
export function HojaMas({ abierta, cerrar, raiz, modulos, conSuscripcion, conDatosCuenta = false, alElegir, rol, esOrganizacion, alCerrarSesion }: {
  abierta: boolean
  cerrar: () => void
  raiz: string
  modulos: Seccion[]
  conSuscripcion: boolean
  /** «Datos de cuenta»: para quien tiene panel de gestión pero no puede abrir Configuración. */
  conDatosCuenta?: boolean
  alElegir: () => void
  rol?: CuentaMe['rol']
  /** En una organización «Configuración» se llama «Organización» (Figma). */
  esOrganizacion?: boolean
  /** Cierra la sesión con el cierre de la app (revoca la sesión en el servidor). */
  alCerrarSesion: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const titulo = useId()
  const [cerrando, setCerrando] = useState(false)
  useCapa(abierta, cerrar, panel)
  if (!abierta) return null
  const entradas: Entrada[] = [...modulos.map((modulo) => ({
    id: modulo.id, nombre: modulo.id === 'configuracion' && esOrganizacion ? 'Organización' : modulo.nombre, icono: modulo.icono, ruta: `${raiz}/${modulo.id}`,
  })), ...(conSuscripcion ? [{ id: 'suscripcion', nombre: ENTRADA_SUSCRIPCION.nombre, icono: ENTRADA_SUSCRIPCION.icono, ruta: `${raiz}/suscripcion` }] : []),
  ...(conDatosCuenta ? [{ id: 'datos-cuenta', nombre: ENTRADA_DATOS_CUENTA.nombre, icono: ENTRADA_DATOS_CUENTA.icono, ruta: `${raiz}/datos-cuenta` }] : [])]
  const reportesEnSeguimiento = rol === 'coordinador'
  const seguimiento = reportesEnSeguimiento ? [...IDS_SEGUIMIENTO, 'reportes'] : IDS_SEGUIMIENTO
  const administracion = reportesEnSeguimiento ? IDS_ADMINISTRACION.filter((id) => id !== 'reportes') : IDS_ADMINISTRACION
  const deGrupo = (ids: readonly string[]) => ids.flatMap((id) => entradas.filter((entrada) => entrada.id === id))
  const grupos: { titulo: string; tono: string; items: Entrada[] }[] = [
    { titulo: 'Seguimiento', tono: TONO_SEGUIMIENTO, items: deGrupo(seguimiento) },
    { titulo: 'Administración', tono: TONO_CUENTA, items: deGrupo(administracion) },
  ]
  const sueltos = entradas.filter((entrada) => !grupos.some((grupo) => grupo.items.some((item) => item.id === entrada.id)))
  if (sueltos.length) grupos[0]!.items.push(...sueltos)
  const cerrarSesion = () => {
    setCerrando(true)
    alCerrarSesion()
  }
  const celda = 'flex h-24 w-full flex-col items-center gap-1.5 rounded-md px-0.5 py-1 text-center hover:bg-blue-100/50'
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 animate-fade md:items-center md:p-6" onMouseDown={(event) => event.target === event.currentTarget && cerrar()}>
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titulo}
      className="flex max-h-[85dvh] w-full max-w-[430px] flex-col rounded-t-lg bg-surface pb-safe shadow-2 outline-none animate-up md:rounded-lg md:animate-pop">
      <div className="flex flex-none items-center justify-between gap-3 px-5 pt-5 pb-2">
        <h2 id={titulo} className="min-w-0 text-seccion text-ink">Más opciones</h2>
        <button type="button" onClick={cerrar} aria-label="Cerrar" className="grid size-12 flex-none place-items-center rounded-full bg-bg text-ink hover:bg-surface-2">
          <Icono nombre="close" />
        </button>
      </div>
      <div className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain px-4 pt-2 pb-5">
        {grupos.filter((grupo) => grupo.items.length > 0).map((grupo) => <section key={grupo.titulo} aria-label={grupo.titulo} className="grid gap-2">
          <h3 className="text-cuerpo font-semibold text-muted">{grupo.titulo}</h3>
          <ul className="grid auto-rows-fr grid-cols-4 gap-x-1 gap-y-3">
            {grupo.items.map((item) => <li key={item.id} className="min-w-0">
              <Link to={item.ruta} onClick={alElegir} className={celda}>
                <span className={`grid size-12 flex-none place-items-center rounded-md ${grupo.tono}`}><Icono nombre={item.icono} /></span>
                <span className="max-w-full text-nav [overflow-wrap:normal] hyphens-auto text-ink">{item.nombre}</span>
              </Link>
            </li>)}
          </ul>
        </section>)}
        <section aria-label="Cuenta" className="grid gap-2">
          <h3 className="text-cuerpo font-semibold text-muted">Cuenta</h3>
          <ul className="grid auto-rows-fr grid-cols-4 gap-x-1 gap-y-3">
            <li className="min-w-0">
              <Link to="/cuenta" onClick={alElegir} className={celda}>
                <span className={`grid size-12 flex-none place-items-center rounded-md ${TONO_CUENTA}`}><Icono nombre="person" /></span>
                <span className="max-w-full text-nav [overflow-wrap:normal] hyphens-auto text-ink">Mi perfil</span>
              </Link>
            </li>
            <li className="min-w-0">
              <button type="button" onClick={cerrarSesion} disabled={cerrando} aria-busy={cerrando || undefined} className={`${celda} disabled:opacity-55`}>
                <span className="grid size-12 flex-none place-items-center rounded-md bg-danger-100 text-danger"><Icono nombre="logout" /></span>
                <span className="max-w-full text-nav [overflow-wrap:normal] hyphens-auto font-semibold text-danger">Cerrar sesión</span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
}
