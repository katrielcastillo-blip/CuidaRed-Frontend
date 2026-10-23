/*
 * AppShell.tsx — Esqueleto responsive de las áreas autenticadas y cabecera de cada pantalla (<Page>).
 * Módulo: layouts.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *  - Móvil (<768px): barra superior de marca + contenido a ancho completo + bottom-nav navy fijo.
 *  - Tablet (768–1099px): sidebar compacto de iconos. Escritorio (≥1100px): sidebar completo.
 *  - Todas las pantallas: logo arriba a la izquierda; usuario y rol arriba a la derecha; indicador
 *    permanente de conexión y registros pendientes (SRS §18.3 y §18.4). Pie de página en escritorio.
 */
import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { logout, nombreCompleto, ROL_LABEL, useSession } from '@/domain/auth'
import { pendientesDelUsuario } from '@/domain/sync'
import { Avatar, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { BarraSuperior } from './BarraSuperior'
import { PieDePagina } from './PieDePagina'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** true → activo solo con coincidencia exacta (p. ej. el Inicio del rol). */
  end?: boolean
  /** Contador opcional (alertas sin atender…). */
  badge?: number
}

interface ShellCtx {
  base: string
  perfilPath: string
}
const Ctx = createContext<ShellCtx>({ base: '/', perfilPath: '/' })
/** Base del rol actual ("/voluntario", "/admin"…) y ruta de su perfil. */
export const useShell = () => useContext(Ctx)

function Contador({ n, className }: { n?: number; className?: string }) {
  if (!n) return null
  return (
    <span className={cn('min-w-5 h-5 px-1 grid place-items-center rounded-full bg-danger text-white text-[11px] font-bold leading-none', className)} aria-label={`${n} sin atender`}>
      {n > 99 ? '99+' : n}
    </span>
  )
}

export function AppShell({ nav, base, perfilPath }: { nav: NavItem[]; base: string; perfilPath: string }) {
  const { user, org } = useSession()
  const navigate = useNavigate()
  const toast = useToast()

  const salir = () => {
    const pendientes = pendientesDelUsuario().length
    logout()
    if (pendientes) toast(`Tienes ${pendientes} registro(s) sin sincronizar guardados en este dispositivo. Se enviarán cuando vuelvas a iniciar sesión con conexión.`, 'info')
    navigate('/inicio', { replace: true })
  }

  return (
    <Ctx.Provider value={{ base, perfilPath }}>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:bg-white focus:text-navy focus:p-3 focus:rounded-md">
        Saltar al contenido
      </a>
      <div className="min-h-dvh md:grid md:grid-cols-[88px_1fr] lg:grid-cols-[var(--sidebar-w)_1fr]">
        <aside
          className="no-print hidden md:flex sticky top-0 h-dvh self-start flex-col gap-6 px-2 py-5 items-center bg-navy text-blue-100 lg:items-stretch lg:px-4 lg:py-6"
          aria-label="Navegación principal"
        >
          <Link to={base} className="flex items-center gap-3 px-2 text-white" aria-label="CuidaRed, inicio">
            <img src="/favicon.svg" alt="" width={36} height={36} />
            <span className="hidden lg:flex flex-col leading-tight">
              <strong className="text-xl">CuidaRed</strong>
              <small className="text-[11px] opacity-80">Seguimiento Comunitario</small>
            </span>
          </Link>
          <nav className="flex flex-col gap-1 flex-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                title={n.label}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center justify-center gap-3 min-h-12 w-14 rounded-md font-semibold transition-colors lg:w-auto lg:justify-start lg:px-3',
                    isActive ? 'bg-blue-100 text-navy' : 'text-blue-100 hover:bg-white/10',
                  )
                }
              >
                <n.icon size={22} aria-hidden />
                <span className="sr-only lg:not-sr-only">{n.label}</span>
                <Contador n={n.badge} className="absolute -top-1 -right-1 lg:static lg:ml-auto" />
              </NavLink>
            ))}
          </nav>
          {user && (
            <div className="flex items-center justify-center gap-2 pt-4 border-t border-blue-100/20">
              <Link to={perfilPath} className="flex items-center gap-3 flex-1 min-w-0" aria-label="Mi perfil">
                <Avatar nombre={nombreCompleto(user)} src={user.avatar} size={40} />
                <span className="hidden lg:flex flex-col min-w-0 leading-tight">
                  <strong className="text-sm text-white truncate">{nombreCompleto(user)}</strong>
                  <small className="text-xs opacity-80 truncate">
                    {ROL_LABEL[user.rol]}
                    {org ? ` · ${org.nombre}` : ''}
                  </small>
                </span>
              </Link>
              <button
                type="button"
                className="hidden lg:grid size-12 place-items-center rounded-full text-blue-100 hover:bg-white/10"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                onClick={salir}
              >
                <LogOut size={20} />
              </button>
            </div>
          )}
        </aside>

        <div className="min-w-0 flex flex-col min-h-dvh pb-[calc(var(--bottomnav-h)+var(--safe-bottom)+24px)] md:pb-0">
          <BarraSuperior />
          <div id="contenido" className="flex-1 flex flex-col">
            <Outlet />
          </div>
          <PieDePagina />
        </div>

        <nav
          className="md:hidden fixed inset-x-0 bottom-0 z-30 flex justify-center gap-1 min-h-[calc(var(--bottomnav-h)+var(--safe-bottom))] px-2 pt-2 pb-[calc(8px+var(--safe-bottom))] bg-navy shadow-[0_-1px_4px_rgba(100,116,139,0.42)] no-print"
          aria-label="Navegación principal"
        >
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'relative flex-[0_1_96px] min-w-0 flex flex-col items-center justify-center gap-1 rounded-md text-blue-100 text-xs font-semibold',
                  isActive ? 'opacity-100 bg-blue-100/15' : 'opacity-80',
                )
              }
            >
              <n.icon size={24} aria-hidden />
              <span className="truncate max-w-full">{n.label}</span>
              <Contador n={n.badge} className="absolute top-0 right-[calc(50%-22px)]" />
            </NavLink>
          ))}
        </nav>
      </div>
    </Ctx.Provider>
  )
}

/**
 * Cabecera navy de cada pantalla (header del Figma) + contenedor del contenido.
 *  - back: muestra flecha ← (true = navigate(-1); string = ruta concreta).
 *  - leading: reemplaza el título (p. ej. selector "▾ Flia. Rodríguez").
 *  - actions: botones a la derecha; por defecto, avatar que lleva al perfil (solo móvil).
 *  - wide: permite contenido más ancho en escritorio (dashboards, listas en rejilla).
 */
export function Page({
  title,
  back,
  leading,
  actions,
  hideAvatar,
  wide,
  children,
}: {
  title?: string
  back?: boolean | string
  leading?: ReactNode
  actions?: ReactNode
  hideAvatar?: boolean
  wide?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const { perfilPath } = useShell()
  const { user } = useSession()
  const ancho = wide ? 'max-w-[calc(var(--content-max)+var(--gutter)*2)]' : 'max-w-[calc(var(--content-max)*0.62+var(--gutter)*2)]'
  return (
    <>
      <header className="bg-navy text-blue-100 shadow-1 no-print">
        <div className={cn('flex items-center gap-2 min-h-[var(--appbar-h)] mx-auto pr-3', back ? 'pl-2' : 'pl-[var(--gutter)]', ancho)}>
          {back && (
            <button
              type="button"
              className="size-12 grid place-items-center flex-none rounded-full text-blue-100 hover:bg-white/10"
              aria-label="Volver"
              onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div className="flex-1 min-w-0 flex items-center">{leading ?? <h1 className="text-xl font-semibold text-blue-100 truncate">{title}</h1>}</div>
          {actions}
          {!hideAvatar && user && (
            <Link to={perfilPath} className="flex-none rounded-full md:hidden" aria-label="Mi perfil">
              <Avatar nombre={nombreCompleto(user)} src={user.avatar} size={40} ring />
            </Link>
          )}
        </div>
      </header>
      <main className={cn('flex flex-col gap-6 w-full mx-auto px-[var(--gutter)] pt-6 pb-6', ancho)}>{children}</main>
    </>
  )
}
