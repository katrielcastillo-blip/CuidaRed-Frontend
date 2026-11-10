/*
 * MonitoreoVisitas.tsx — Monitoreo de visitas del coordinador: visitas realizadas y pendientes de hoy, adultos con
 * más días sin visita REALIZADA frente al umbral de la cuenta (RF-05) y adultos sin personal asignado
 * (cuidadores o voluntarios).
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { CalendarPlus, CircleCheck, UserRoundCog } from 'lucide-react'
import { ButtonLink, EmptyState, RiesgoBadge } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import type { Adulto } from '@/domain/types'
import { cn } from '@/lib/cn'
import type { AdultoSinVisita } from '../lib/datos'

interface Hoy {
  total: number
  realizadas: number
  pendientes: number
}

export function MonitoreoVisitas({
  hoy,
  monitoreo,
  umbral,
  sinAsignar,
  base,
  puedeProgramar,
  puedeAsignar,
}: {
  hoy: Hoy
  /** Adultos activos ordenados de más a menos días sin visita realizada. */
  monitoreo: AdultoSinVisita[]
  umbral: number
  sinAsignar: Adulto[]
  base: string
  puedeProgramar: boolean
  puedeAsignar: boolean
}) {
  const pct = hoy.total ? Math.round((hoy.realizadas / hoy.total) * 100) : 0
  const superan = monitoreo.filter((x) => x.supera).length
  const lista = monitoreo.slice(0, 5)

  return (
    <div className="flex flex-col gap-5">
      {/* ───── Hoy: realizadas y pendientes ───── */}
      <div className="flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5 px-3 py-2 rounded-sm bg-teal-100 border border-[#ccdbdd]">
            <span className="text-sm font-semibold text-ink">Realizadas hoy</span>
            <span className="text-[2rem] font-bold leading-tight text-success-700">{hoy.realizadas}</span>
          </div>
          <div className={cn('flex flex-col gap-0.5 px-3 py-2 rounded-sm border', hoy.pendientes > 0 ? 'bg-warning-100 border-warning' : 'bg-surface-2 border-line-soft')}>
            <span className="text-sm font-semibold text-ink">Pendientes hoy</span>
            <span className={cn('text-[2rem] font-bold leading-tight', hoy.pendientes > 0 ? 'text-warning-700' : 'text-ink')}>{hoy.pendientes}</span>
          </div>
        </div>
        {hoy.total === 0 ? (
          <p className="text-sm text-muted">No hay visitas programadas para hoy.</p>
        ) : (
          <>
            <div
              className="h-2.5 rounded-pill bg-surface-2 overflow-hidden"
              role="progressbar"
              aria-label="Visitas de hoy realizadas"
              aria-valuemin={0}
              aria-valuemax={hoy.total}
              aria-valuenow={hoy.realizadas}
              aria-valuetext={`${hoy.realizadas} de ${hoy.total} realizadas`}
            >
              <span className="block h-full rounded-pill bg-success-700 transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-muted">
              {hoy.realizadas} de {hoy.total} {hoy.total === 1 ? 'visita realizada' : 'visitas realizadas'} ({pct}%).{' '}
              <Link to={`${base}/visitas`} className="font-bold text-navy hover:underline">
                Ver agenda de hoy
              </Link>
            </p>
          </>
        )}
      </div>

      {/* ───── Días sin visita realizada frente al umbral ───── */}
      <div className="flex flex-col gap-2">
        <h3 className="flex flex-wrap items-baseline justify-between gap-x-3 text-base font-bold text-ink">
          Más días sin visita realizada
          <span className="text-sm font-semibold text-muted">Umbral de alerta: {umbral} días</span>
        </h3>
        <p className="-mt-1 text-sm text-muted">
          {superan === 0
            ? 'Ningún adulto supera el umbral. Estos son los que llevan más días.'
            : `${superan} ${superan === 1 ? 'adulto supera' : 'adultos superan'} el umbral. Solo cuentan las visitas realizadas, no las programadas.`}
        </p>
        {lista.length === 0 ? (
          <EmptyState title="Sin adultos activos" text="Registra un adulto mayor para empezar el seguimiento." />
        ) : (
          <ul className="flex flex-col rounded-md border border-line-soft bg-surface divide-y divide-line-soft">
            {lista.map(({ adulto, dias, conVisitas, supera }) => {
              const proporcion = Math.min(100, Math.round((dias / umbral) * 100))
              return (
                <li key={adulto.id} className="flex items-center gap-2 pr-2">
                  <Link to={`${base}/adultos/${adulto.id}`} className="flex flex-1 min-w-0 flex-col gap-1.5 min-h-16 px-4 py-2.5 hover:bg-blue-100/50">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="text-base text-ink truncate">{nombreCompleto(adulto)}</strong>
                      <RiesgoBadge riesgo={adulto.riesgo} />
                    </span>
                    <span
                      className="h-2 rounded-pill bg-surface-2 overflow-hidden"
                      role="img"
                      aria-label={`${dias} de ${umbral} días del umbral`}
                    >
                      <span
                        className={cn('block h-full rounded-pill', supera ? 'bg-danger' : proporcion >= 75 ? 'bg-warning-700' : 'bg-navy')}
                        style={{ width: `${Math.max(proporcion, 4)}%` }}
                      />
                    </span>
                    <span className={cn('text-sm font-semibold', supera ? 'text-danger' : 'text-muted')}>
                      {dias} {dias === 1 ? 'día' : 'días'} {conVisitas ? 'sin visita realizada' : 'sin ninguna visita realizada'}
                      {supera && ' · Supera el umbral'}
                    </span>
                  </Link>
                  {puedeProgramar && supera && (
                    <ButtonLink
                      to={`${base}/visitas/programar?adulto=${adulto.id}`}
                      variant="light"
                      size="sm"
                      icon={<CalendarPlus size={18} aria-hidden />}
                      aria-label={`Programar visita para ${nombreCompleto(adulto)}`}
                    >
                      <span className="hidden sm:inline">Programar</span>
                    </ButtonLink>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ───── Sin personal asignado ───── */}
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          Sin personal asignado
          <span
            className={cn('inline-grid place-items-center min-w-6 h-6 px-2 rounded-pill text-xs font-bold', sinAsignar.length ? 'bg-warning-700 text-white' : 'bg-surface-2 text-muted')}
            aria-label={`${sinAsignar.length} adultos sin personal asignado`}
          >
            {sinAsignar.length}
          </span>
        </h3>
        {sinAsignar.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <CircleCheck size={18} className="flex-none" aria-hidden />
            Todos los adultos activos tienen un cuidador o voluntario asignado.
          </p>
        ) : (
          <>
            <p className="-mt-1 text-sm text-muted">Adultos activos que no tienen ningún cuidador ni voluntario asignado.</p>
            <ul className="flex flex-col rounded-md border border-line-soft bg-surface divide-y divide-line-soft">
              {sinAsignar.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-center gap-2 pr-2">
                  <Link to={`${base}/adultos/${a.id}`} className="flex flex-1 min-w-0 items-center gap-3 min-h-14 px-4 py-2 hover:bg-blue-100/50">
                    <span className="flex flex-col flex-1 min-w-0 gap-1">
                      <strong className="text-base text-ink truncate">{nombreCompleto(a)}</strong>
                      <span className="text-sm text-muted truncate">{a.zona}</span>
                    </span>
                    <RiesgoBadge riesgo={a.riesgo} />
                  </Link>
                  {puedeAsignar && (
                    <ButtonLink
                      to={`${base}/adultos/${a.id}`}
                      variant="light"
                      size="sm"
                      icon={<UserRoundCog size={18} aria-hidden />}
                      aria-label={`Asignar personal a ${nombreCompleto(a)}`}
                    >
                      <span className="hidden sm:inline">Asignar</span>
                    </ButtonLink>
                  )}
                </li>
              ))}
            </ul>
            {sinAsignar.length > 4 && (
              <Link to={`${base}/adultos`} className="inline-flex items-center min-h-12 px-1 text-sm font-bold text-navy hover:underline">
                {sinAsignar.length - 4 === 1 ? 'Hay 1 adulto más' : `Hay ${sinAsignar.length - 4} adultos más`}: revisa la lista de Adultos
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  )
}
