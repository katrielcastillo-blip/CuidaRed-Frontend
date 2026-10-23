/*
 * AdultoHeader.tsx — Cabecera con el adulto mayor (icono, nombre, riesgo y enlace al perfil) de los
 * formularios y detalles de visitas y necesidades.
 * Módulo: visitas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleUserRound } from 'lucide-react'
import { nombreCompleto } from '@/domain/auth'
import type { Adulto } from '@/domain/types'
import { IconTile, RiesgoBadge } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 *  - badge="debajo": el chip de riesgo va bajo el nombre (formularios).
 *  - badge="final": el chip va al extremo derecho (detalle de visita).
 *  - compacto: versión baja para los formularios móviles (RF-06: completables con un solo desplazamiento).
 *  - enlace: texto y ruta del enlace al perfil.
 */
export function AdultoHeader({
  adulto,
  badge = 'debajo',
  enlace,
  compacto,
  children,
}: {
  adulto: Adulto
  badge?: 'debajo' | 'final'
  enlace?: { to: string; texto: string }
  compacto?: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <IconTile size={compacto ? 48 : 63}>
        <CircleUserRound size={compacto ? 30 : 43} strokeWidth={1.6} aria-hidden />
      </IconTile>
      <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
        <h2 className={cn('font-semibold leading-tight text-ink wrap-anywhere', compacto ? 'text-xl' : 'text-2xl')}>{nombreCompleto(adulto)}</h2>
        <div className="flex flex-wrap items-center gap-x-3">
          {badge === 'debajo' && <RiesgoBadge riesgo={adulto.riesgo} />}
          {enlace && (
            <Link
              to={enlace.to}
              className="inline-flex items-center min-h-12 -my-3 text-sm font-semibold text-navy underline underline-offset-4 hover:text-blue"
            >
              {enlace.texto}
            </Link>
          )}
        </div>
        {children}
      </div>
      {badge === 'final' && <RiesgoBadge riesgo={adulto.riesgo} />}
    </div>
  )
}
