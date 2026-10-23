/*
 * SeguimientoCard.tsx — Estado del seguimiento de un adulto mayor para su familiar responsable: tipo de
 * vínculo (Tipo_vinculo), última visita y días transcurridos (RF-05), próxima visita con su motivo (Visit_razon)
 * y necesidades abiertas con estado y prioridad (CU-06 · CU-08). Solo lectura. El nivel de riesgo solo se
 * muestra si el usuario puede ver datos sensibles.
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { CalendarCheck, CalendarClock, CircleAlert, CircleCheck } from 'lucide-react'
import { Badge, IconTile, LinkCard, RiesgoBadge } from '@/components/ui'
import { nombreCompleto, useUser } from '@/domain/auth'
import { edad, fechaCorta, hhmmA12 } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import type { Adulto, Necesidad, Visita } from '@/domain/types'
import { useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { ESTADO_NECESIDAD, etiquetaDia, haceDias, PRIORIDAD, TIPO_NECESIDAD } from '../lib'

export interface Seguimiento {
  adulto: Adulto
  ultima?: Visita
  /** Días calendario desde la última visita (o desde el registro si no hay visitas). */
  dias: number
  conVisitas: boolean
  proxima?: Visita
  abiertas: Necesidad[]
}

export function SeguimientoCard({ s, umbral, vinculo }: { s: Seguimiento; umbral: number; vinculo?: string }) {
  const { base } = useShell()
  const user = useUser()
  const { adulto, ultima, dias, conVisitas, proxima, abiertas } = s
  const atrasado = dias > umbral

  return (
    <LinkCard to={`${base}/adultos/${adulto.id}`} footer="Ver historial y necesidades">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <IconTile />
          <div className="flex flex-col flex-1 min-w-0">
            <h3 className="text-xl font-semibold leading-tight text-ink wrap-anywhere">{nombreCompleto(adulto)}</h3>
            <span className="text-sm text-muted">
              {edad(adulto.fechaNacimiento)} años{vinculo ? ` · Tu vínculo: ${vinculo}` : ''}
            </span>
          </div>
          {puede(user, 'adultos:ver-sensible', adulto) && <RiesgoBadge riesgo={adulto.riesgo} />}
        </div>

        {/* Estado general del seguimiento */}
        <p
          className={cn(
            'flex items-start gap-2 px-3 py-2 rounded-sm text-sm font-semibold',
            atrasado ? 'bg-danger-100 text-danger' : 'bg-success-100 text-success-700',
          )}
        >
          {atrasado ? <CircleAlert size={18} className="flex-none mt-px" aria-hidden /> : <CircleCheck size={18} className="flex-none mt-px" aria-hidden />}
          <span>
            {atrasado
              ? `${dias} días sin visita. La organización ya fue avisada para programar una.`
              : conVisitas
                ? 'Seguimiento al día: recibió visita recientemente.'
                : 'Aún no tiene visitas registradas.'}
          </span>
        </p>

        <dl className="grid grid-cols-2 gap-3">
          <div className="flex gap-2 min-w-0">
            <CalendarCheck size={20} className="flex-none mt-0.5 text-navy" aria-hidden />
            <div className="min-w-0">
              <dt className="text-xs text-ink">Última visita</dt>
              <dd className="text-base font-bold text-ink">{ultima ? etiquetaDia(ultima.fecha) : 'Sin visitas'}</dd>
              {ultima && <dd className="text-xs text-muted">{haceDias(dias)}</dd>}
            </div>
          </div>
          <div className="flex gap-2 min-w-0">
            <CalendarClock size={20} className="flex-none mt-0.5 text-navy" aria-hidden />
            <div className="min-w-0">
              <dt className="text-xs text-ink">Próxima visita</dt>
              <dd className="text-base font-bold text-ink">{proxima ? etiquetaDia(proxima.fecha) : 'Sin programar'}</dd>
              {proxima && <dd className="text-xs text-muted">{hhmmA12(proxima.horaPautada)}</dd>}
              {proxima?.razon && <dd className="text-xs text-ink-2 line-clamp-2">{proxima.razon}</dd>}
            </div>
          </div>
        </dl>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink">
            Necesidades abiertas <span className="text-muted font-normal">({abiertas.length})</span>
          </p>
          {abiertas.length === 0 ? (
            <p className="text-sm text-muted">No hay necesidades pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {abiertas.slice(0, 3).map((n) => {
                const Icono = TIPO_NECESIDAD[n.tipo].icon
                const est = ESTADO_NECESIDAD[n.estado]
                return (
                  <li key={n.id} className="flex items-center gap-2 text-sm text-ink">
                    <Icono size={18} className="flex-none text-navy" aria-hidden />
                    <span className="flex-1 min-w-0 truncate">
                      {TIPO_NECESIDAD[n.tipo].label} <span className="text-muted">· {fechaCorta(n.creadaEn)}</span>
                    </span>
                    {n.estado === 'pendiente' && n.prioridad === 'alta' && <Badge tone={PRIORIDAD.alta.tono}>Alta</Badge>}
                    <Badge tone={est.tono}>{est.label}</Badge>
                  </li>
                )
              })}
              {abiertas.length > 3 && <li className="text-xs text-muted">y {abiertas.length - 3} más…</li>}
            </ul>
          )}
        </div>
      </div>
    </LinkCard>
  )
}
