/*
 * AuthScreen.tsx — Esqueleto de las pantallas públicas (inicio de sesión, activación, recuperación, avisos legales).
 * Módulo: auth.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *  - Móvil: acceso compacto y cabecera con los colores del proyecto, respetando las áreas seguras.
 *  - ≥768 px: tarjeta centrada (~460 px) sobre el fondo de círculos.
 *  - ≥1100 px: panel de marca a la izquierda.
 */
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, BellRing, HeartHandshake, Users } from '@/components/icons'
import { cn } from '@/lib/cn'
import { useLogo } from '@/lib/marca'
import { Circulos } from './Circulos'
import { LogoBadge } from './LogoBadge'

type Volver = string | true | (() => void)

interface Props {
  /** Con título: cabecera con degradado + tarjeta (registro, recuperar…). Sin título: pantalla "plana" (login). */
  title?: string
  /** string → ruta · true → historial (o /inicio si se entró directo) · función → acción propia. */
  back?: Volver
  /** registro: azul → navy (Figma Registrarse/Términos) · auth: azul → verde (Figma Recuperar/Restablecer). */
  gradient?: 'registro' | 'auth'
  /** Textos legales: tarjeta más ancha y sin panel de marca. */
  wide?: boolean
  /** Acceso visible a la portada desde los recorridos de acceso y registro. */
  homeLink?: boolean
  /** Ajusta las pantallas de acceso a la altura disponible sin recortar su contenido. */
  fitViewport?: boolean
  /** Nombre accesible de la flecha del encabezado. */
  backLabel?: string
  children: ReactNode
}

export function AuthScreen({ title, back, gradient = 'registro', wide, homeLink, fitViewport, backLabel = 'Volver', children }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const retorno = (location.state as { retornoPortada?: unknown } | null)?.retornoPortada
  const portada = typeof retorno === 'string' && /^\/(?:#[a-z][a-z0-9-]*)?$/.test(retorno) ? retorno : '/'
  const logo = useLogo()

  const volver = () => {
    if (typeof back === 'function') return back()
    if (typeof back === 'string') return navigate(back)
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/inicio')
  }

  const conCabecera = title !== undefined
  const enlacePortada = homeLink && !conCabecera

  return (
    <div className="relative isolate min-h-dvh overflow-clip bg-bg">
      <Circulos compacto={fitViewport} />
      {enlacePortada && <nav aria-label="Navegación pública" className={cn('relative z-[2] mx-auto flex w-full max-w-[1180px] items-center px-5 pt-[var(--safe-top)] md:px-6', fitViewport ? 'min-h-[calc(56px_+_var(--safe-top))]' : 'min-h-16')}>
        <Link to={portada} aria-label="Volver a la portada" title="Volver a la portada" className="inline-flex size-12 items-center justify-center rounded-sm text-navy hover:bg-blue-100 focus-visible:outline-blue">
          <ArrowLeft size={22} aria-hidden />
        </Link>
      </nav>}
      <div
        className={cn(
          'relative z-[1] flex flex-col',
          enlacePortada ? (fitViewport ? 'min-h-[calc(100dvh_-_56px_-_var(--safe-top))]' : 'min-h-[calc(100dvh_-_64px)]') : 'min-h-dvh',
          'md:items-center md:justify-center md:px-6',
          fitViewport ? 'md:py-2' : 'md:py-10',
          'lg:mx-auto lg:w-full lg:max-w-[1180px] lg:flex-row lg:gap-[clamp(56px,7vw,120px)]',
        )}
      >
        {!wide && (
          <aside
            className={cn('hidden lg:flex lg:max-w-[480px] lg:flex-1 lg:basis-0 lg:flex-col lg:rounded-[28px] lg:bg-white/95 lg:shadow-[0_12px_40px_-16px_rgba(12,59,110,0.25)]', fitViewport
              ? 'lg:gap-[clamp(12px,2dvh,24px)] lg:p-[clamp(24px,4dvh,40px)]'
              : 'lg:gap-6 lg:p-10')}
            aria-label="CuidaRed"
          >
            <img src={logo} alt="CuidaRed · Seguimiento Comunitario" width={517} height={192} className="h-auto w-[min(100%,340px)]" />
            <p className="text-xl font-semibold leading-[1.45] text-navy">
              Una red que conecta a organizaciones, voluntarios y familias para acompañar a los adultos mayores de tu comunidad.
            </p>
            <ul className={cn('flex flex-col text-ink-2', fitViewport ? 'gap-[clamp(8px,1.5dvh,14px)]' : 'gap-3.5')}>
              <li className="flex items-center gap-3">
                <HeartHandshake size={22} className="flex-none text-teal" aria-hidden /> Visitas de seguimiento y necesidades al día
              </li>
              <li className="flex items-center gap-3">
                <BellRing size={22} className="flex-none text-teal" aria-hidden /> Alertas de riesgo para actuar a tiempo
              </li>
              <li className="flex items-center gap-3">
                <Users size={22} className="flex-none text-teal" aria-hidden /> Familias y voluntarios siempre conectados
              </li>
            </ul>
            <p className="text-sm text-muted">Proyecto académico del Instituto Tecnológico de Santo Domingo (INTEC).</p>
          </aside>
        )}

        <section
          className={cn(
            'flex w-full min-w-0 flex-1 flex-col',
            'md:flex-none md:overflow-hidden md:rounded-[28px] md:bg-bg md:shadow-[0_28px_60px_-16px_rgba(12,59,110,0.32),0_4px_14px_rgba(12,59,110,0.1)]',
            wide ? 'md:max-w-[860px] lg:flex-[0_1_860px]' : 'md:max-w-auth lg:flex-[0_0_460px]',
          )}
        >
          {conCabecera && (
            <header
              className={cn(
                'relative text-white',
                fitViewport ? 'grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2 px-4 pb-3 pt-[max(12px,var(--safe-top))] md:pt-3' : 'flex flex-col items-center px-[var(--gutter)] pb-[71px] pt-[calc(var(--safe-top)+41px)] md:px-7 md:pt-7',
                gradient === 'auth' ? 'bg-grad-auth' : 'bg-[linear-gradient(180deg,#378add_0%,#0c3b6e_150%)]',
              )}
            >
              {back !== undefined && (
                <button
                  type="button"
                  className="-ml-2 grid size-12 place-items-center self-start rounded-full text-white transition hover:bg-white/15 focus-visible:outline-white"
                  onClick={volver}
                  aria-label={backLabel}
                >
                  <ArrowLeft size={28} />
                </button>
              )}
              <h1 className={cn('text-balance text-center font-bold leading-tight text-white', fitViewport ? 'col-start-2 text-[22px]' : 'mt-1 text-[28px]')}>{title}</h1>
              {fitViewport && <span className="grid size-12 place-items-center rounded-md bg-white"><LogoBadge className="max-md:mb-0 max-md:h-10 max-md:w-auto md:mb-0 md:h-10 md:w-auto" /></span>}
            </header>
          )}
          <div
            className={cn(
              'relative flex flex-1 flex-col px-[clamp(24px,8.4vw,36px)]',
              conCabecera && !fitViewport
                ? '-mt-[46px] rounded-t-[46px] bg-bg pb-[max(32px,calc(var(--safe-bottom)+24px))] pt-6'
                : fitViewport
                  ? 'pb-[max(16px,calc(var(--safe-bottom)+12px))] pt-4'
                  : 'pb-[max(24px,calc(var(--safe-bottom)+16px))] pt-[max(calc(min(100vw,100vh)/428*262),clamp(40px,calc(100dvh_-_640px),263px))]',
              fitViewport && conCabecera ? 'md:px-6' : 'md:px-10',
              fitViewport ? '[--field-gap:6px] [&_label]:text-sm [&_form_button]:min-h-12 [&_form_button]:text-base md:py-[clamp(16px,2.5dvh,32px)]' : 'md:pb-10',
              !conCabecera && !fitViewport && 'md:pt-11',
              wide && 'md:px-[clamp(40px,6vw,72px)]',
            )}
          >
            {children}
          </div>
        </section>
      </div>
    </div>
  )
}
