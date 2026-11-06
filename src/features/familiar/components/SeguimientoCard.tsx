/*
 * SeguimientoCard.tsx — Tarjeta de seguimiento de un envejeciente autorizado (Mis envejecientes): tipo de
 * vínculo, estado general del seguimiento (días sin visita · RF-05), última visita realizada con el estado en
 * que encontraron al adulto, próxima visita con su motivo y necesidades abiertas con estado y prioridad
 * (CU-06 · CU-08). Solo lectura; no muestra riesgo ni datos sensibles (la familia no tiene `adultos:ver-sensible`).
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { CalendarCheck, CalendarClock, CircleAlert, CircleCheck } from 'lucide-react'
import { Badge, IconTile, LinkCard } from '@/components/ui'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import { useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { ESTADO_ADULTO_VISITA, ESTADO_NECESIDAD, etiquetaDia, haceDias, PRIORIDAD, TIPO_NECESIDAD } from '../lib/etiquetas'
import type { EnvejecienteTarjeta } from '../lib/modelos'

export function SeguimientoCard({ e }: { e: EnvejecienteTarjeta }) {
  const { base } = useShell()
  const { seguimiento: s, necesidadesAbiertas: abiertas } = e
  const { ultimaVisita: ultima, proximaVisita: proxima } = s
  const estadoUltima = ultima?.estadoAdulto ? ESTADO_ADULTO_VISITA[ultima.estadoAdulto] : undefined

  return (
    <LinkCard to={`${base}/adultos/${e.id}`} footer="Ver perfil y seguimiento">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <IconTile />
          <div className="flex flex-col flex-1 min-w-0">
            <h3 className="text-xl font-semibold leading-tight text-ink wrap-anywhere">{e.nombre}</h3>
            <span className="text-sm text-muted">
              {e.edad} años{e.vinculo ? ` · Tu vínculo: ${e.vinculo}` : ''}
            </span>
          </div>
        </div>

        {/* Estado general del seguimiento */}
        <p
          className={cn(
            'flex items-start gap-2 px-3 py-2 rounded-sm text-sm font-semibold',
            s.atrasado ? 'bg-danger-100 text-danger' : 'bg-success-100 text-success-700',
          )}
        >
          {s.atrasado ? <CircleAlert size={18} className="flex-none mt-px" aria-hidden /> : <CircleCheck size={18} className="flex-none mt-px" aria-hidden />}
          <span>
            {s.atrasado
              ? `${s.diasSinContacto} días sin visita. El equipo de la cuenta ya fue avisado para programar una.`
              : s.conVisitas
                ? 'Seguimiento al día: recibió visita recientemente.'
                : 'Aún no tiene visitas registradas.'}
          </span>
        </p>

        <dl className="grid grid-cols-2 gap-3">
          <div className="flex gap-2 min-w-0">
            <CalendarCheck size={20} className="flex-none mt-0.5 text-navy" aria-hidden />
            <div className="min-w-0">
              <dt className="text-xs text-ink">Última visita realizada</dt>
              <dd className="text-base font-bold text-ink">{ultima ? etiquetaDia(ultima.fecha) : 'Sin visitas'}</dd>
              {ultima && <dd className="text-xs text-muted">{haceDias(s.diasSinContacto)}</dd>}
              {ultima?.visitante && <dd className="text-xs text-ink-2 wrap-anywhere">Visitante: {ultima.visitante}</dd>}
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

        {estadoUltima && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
            Estado en la última visita:
            <Badge tone={estadoUltima.tono}>{estadoUltima.label}</Badge>
          </p>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink">
            Necesidades abiertas <span className="text-muted font-normal">({s.necesidadesAbiertasTotal})</span>
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
              {s.necesidadesAbiertasTotal > 3 && <li className="text-xs text-muted">y {s.necesidadesAbiertasTotal - 3} más…</li>}
            </ul>
          )}
        </div>
      </div>
    </LinkCard>
  )
}
