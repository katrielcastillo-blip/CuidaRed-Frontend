/*
 * AuthScreen.tsx — Esqueleto de las pantallas públicas (inicio de sesión, activación, recuperación, avisos legales).
 * Módulo: auth.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *  - Móvil: pantalla completa fiel al Figma (cabecera con degradado + tarjeta redondeada).
 *  - ≥768 px: tarjeta centrada (~460 px) sobre el fondo de círculos.
 *  - ≥1100 px: panel de marca a la izquierda.
 */
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BellRing, HeartHandshake, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Circulos } from './Circulos'

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
  children: ReactNode
}

export function AuthScreen({ title, back, gradient = 'registro', wide, children }: Props) {
  const navigate = useNavigate()

  const volver = () => {
    if (typeof back === 'function') return back()
    if (typeof back === 'string') return navigate(back)
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/inicio')
  }

  const conCabecera = title !== undefined

  return (
    <div className="relative isolate min-h-dvh overflow-clip bg-bg">
      <Circulos />
      <div
        className={cn(
          'relative z-[1] flex min-h-dvh flex-col',
          'md:items-center md:justify-center md:px-6 md:py-10',
          'lg:mx-auto lg:w-full lg:max-w-[1180px] lg:flex-row lg:gap-[clamp(56px,7vw,120px)]',
        )}
      >
        {!wide && (
          <aside
            className="hidden lg:flex lg:max-w-[480px] lg:flex-1 lg:basis-0 lg:flex-col lg:gap-6 lg:rounded-[28px] lg:bg-white/95 lg:p-10 lg:shadow-[0_12px_40px_-16px_rgba(12,59,110,0.25)]"
            aria-label="CuidaRed"
          >
            <img src="/brand/logo.png" alt="CuidaRed · Seguimiento Comunitario" width={517} height={192} className="h-auto w-[min(100%,340px)]" />
            <p className="text-xl font-semibold leading-[1.45] text-navy">
              Una red que conecta a organizaciones, voluntarios y familias para acompañar a los adultos mayores de tu comunidad.
            </p>
            <ul className="flex flex-col gap-3.5 text-ink-2">
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
                'relative flex flex-col items-center px-[var(--gutter)] pb-[71px] pt-[calc(var(--safe-top)+41px)] text-white md:px-7 md:pt-7',
                gradient === 'auth' ? 'bg-grad-auth' : 'bg-[linear-gradient(180deg,#378add_0%,#0c3b6e_150%)]',
              )}
            >
              {back !== undefined && (
                <button
                  type="button"
                  className="-ml-2 grid size-12 place-items-center self-start rounded-full text-white transition hover:bg-white/15 focus-visible:outline-white"
                  onClick={volver}
                  aria-label="Volver"
                >
                  <ArrowLeft size={28} />
                </button>
              )}
              <h1 className="mt-1 text-balance text-center text-[28px] font-bold leading-tight text-white">{title}</h1>
            </header>
          )}
          <div
            className={cn(
              'relative flex flex-1 flex-col px-[clamp(24px,8.4vw,36px)]',
              conCabecera
                ? '-mt-[46px] rounded-t-[46px] bg-bg pb-[max(32px,calc(var(--safe-bottom)+24px))] pt-6'
                : 'pb-[max(24px,calc(var(--safe-bottom)+16px))] pt-[max(calc(min(100vw,100vh)/428*262),clamp(40px,calc(100dvh_-_640px),263px))]',
              'md:px-10 md:pb-10',
              !conCabecera && 'md:pt-11',
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
