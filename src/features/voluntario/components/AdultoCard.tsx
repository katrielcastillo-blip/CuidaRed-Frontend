/*
 * AdultoCard.tsx — Tarjeta de adulto mayor asignado: nombre, riesgo (color + forma), días sin visita y
 * necesidades pendientes, con pie "Ver perfil". El pie queda siempre al fondo para alinear las tarjetas de una fila.
 * Módulo: voluntario (SRS §13.1 Interfaz móvil de campo · §18.4).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, CircleUserRound } from 'lucide-react'
import { nombreCompleto } from '@/domain/auth'
import { IconTile, RiesgoBadge } from '@/components/ui'
import { useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { textoDias, type ResumenAdulto } from '../lib/resumen'

export function AdultoCard({ resumen }: { resumen: ResumenAdulto }) {
  const { base } = useShell()
  const { adulto, pendientes, atrasado } = resumen
  return (
    <Link
      to={`${base}/adultos/${adulto.id}`}
      className="flex flex-col h-full rounded-sm border border-line bg-bg overflow-hidden transition-shadow hover:shadow-1"
      aria-label={`${nombreCompleto(adulto)}, riesgo ${adulto.riesgo}. Última visita: ${textoDias(resumen)}. ${pendientes} necesidad(es) pendiente(s).`}
    >
      <div className="flex-1 p-4">
        <div className="flex items-center gap-3">
          <IconTile>
            <CircleUserRound size={26} strokeWidth={1.7} aria-hidden />
          </IconTile>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-semibold leading-tight text-ink wrap-anywhere">{nombreCompleto(adulto)}</h3>
            <p className="text-sm text-muted truncate">{adulto.zona}</p>
          </div>
          <RiesgoBadge riesgo={adulto.riesgo} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className={cn('flex flex-col gap-0.5 px-3 py-2 rounded-sm', atrasado ? 'bg-danger-100' : 'bg-surface-2/60')}>
            <span className="text-xs text-ink-2">Última visita</span>
            <span className={cn('text-base font-bold', atrasado ? 'text-danger' : 'text-ink')}>{textoDias(resumen)}</span>
          </div>
          <div className={cn('flex flex-col gap-0.5 px-3 py-2 rounded-sm', pendientes ? 'bg-warning-100' : 'bg-surface-2/60')}>
            <span className="text-xs text-ink-2">Necesidades pendientes</span>
            <span className={cn('text-base font-bold', pendientes ? 'text-warning-700' : 'text-ink')}>{pendientes}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 min-h-12 px-4 bg-blue-100 border-t border-navy text-navy text-sm font-semibold">
        <span>Ver perfil</span>
        <ArrowRight size={18} aria-hidden />
      </div>
    </Link>
  )
}
