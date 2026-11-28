/*
 * AuthScreen.tsx — Esqueleto de las pantallas públicas (inicio de sesión, activación, recuperación, avisos legales).
 * Módulo: auth.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *  - Móvil: pantalla completa fiel al Figma (encabezado con degradado + hoja redondeada, 16 px de margen lateral).
 *  - ≥768 px: el diseño es solo de teléfono, así que el contenido se centra en una columna de ~520 px (encabezado
 *    incluido, dentro de la misma tarjeta) sobre el fondo de círculos.
 *  - Sin título (inicio de sesión): pantalla "plana" con los círculos del Figma detrás del formulario.
 */
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { EncabezadoPublico, Icono } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Circulos } from './Circulos'

type Volver = string | true | (() => void)

interface Props {
  /** Con título: encabezado con degradado + hoja (registro, recuperar…). Sin título: pantalla "plana" (login). */
  title?: string
  /** string → ruta · true → historial (o /inicio si se entró directo) · función → acción propia. */
  back?: Volver
  /** registro: azul → navy (Figma Crear cuenta/Términos) · auth: azul → verde (Figma Recuperar contraseña). */
  gradient?: 'registro' | 'auth'
  /** Textos legales: columna más ancha. */
  wide?: boolean
  /** Acceso visible a la portada desde los recorridos de acceso y registro (al pie de la hoja). */
  homeLink?: boolean
  children: ReactNode
}

export function AuthScreen({ title, back, gradient = 'registro', wide, homeLink, children }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const retorno = (location.state as { retornoPortada?: unknown } | null)?.retornoPortada
  const portada = typeof retorno === 'string' && /^\/(?:#[a-z][a-z0-9-]*)?$/.test(retorno) ? retorno : '/'

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
      <div className="relative z-[1] mx-auto flex min-h-dvh w-full flex-col md:items-center md:justify-center md:px-6 md:py-10">
        <section
          className={cn(
            'flex w-full min-w-0 flex-1 flex-col',
            'md:flex-none md:overflow-hidden md:rounded-[28px] md:bg-bg md:shadow-[0_28px_60px_-16px_rgba(12,59,110,0.32),0_4px_14px_rgba(12,59,110,0.1)]',
            wide ? 'md:max-w-[760px]' : 'md:max-w-[520px]',
          )}
        >
          {conCabecera && (
            <EncabezadoPublico
              titulo={title}
              tono={gradient === 'auth' ? 'verde' : 'azul'}
              onVolver={back !== undefined ? volver : undefined}
            />
          )}
          <div
            className={cn(
              'relative flex flex-1 flex-col px-4 md:px-10',
              conCabecera
                ? '-mt-8 rounded-t-[32px] bg-bg pb-[max(32px,calc(var(--safe-bottom)+24px))] pt-6 md:pb-10'
                : 'pb-[max(24px,calc(var(--safe-bottom)+16px))] pt-[calc(min(100vw,100vh)/428*215)] md:pb-10 md:pt-11',
              wide && 'md:px-[clamp(40px,6vw,72px)]',
            )}
          >
            {children}
            {homeLink && (
              <nav aria-label="Navegación pública" className="mt-4 flex justify-center">
                <Link
                  to={portada}
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-sm px-3 text-cuerpo font-semibold text-navy underline underline-offset-[3px] hover:bg-blue-100 focus-visible:outline-blue"
                >
                  <Icono nombre="arrow_back" tamano={20} /> Volver a la portada
                </Link>
              </nav>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
