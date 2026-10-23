/*
 * MisVisitas.tsx — Visitas del voluntario: resumen y pestañas Hoy · Próximas · Historial (RF-02 · CU-06).
 * Módulo: voluntario.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { CalendarDays, ClipboardPlus } from 'lucide-react'
import { useUser } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import { ButtonLink, EmptyState, Segmented } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { VisitaCard } from '@/features/visitas/components/VisitaCard'
import { porFechaAsc, porFechaDesc } from '@/features/visitas/lib/dominio'

type Pestana = 'hoy' | 'proximas' | 'historial'

const VACIOS: Record<Pestana, { titulo: string; texto: string }> = {
  hoy: { titulo: 'Sin visitas para hoy', texto: 'No tienes visitas programadas para hoy.' },
  proximas: { titulo: 'Sin visitas próximas', texto: 'No hay visitas programadas para los próximos días.' },
  historial: { titulo: 'Sin historial', texto: 'Aún no has completado visitas.' },
}

const KPI = 'flex flex-col gap-0.5 min-h-20 px-4 py-3 rounded-sm border border-line bg-teal-100'

export function MisVisitas() {
  const user = useUser()
  const { base } = useShell()
  const visitas = useDB((s) => s.visitas)
  const adultos = useDB((s) => s.adultos)
  const [pestana, setPestana] = useState<Pestana>('hoy')

  const { hoy, proximas, historial } = useMemo(() => {
    const dia = todayISO()
    const mias = visitas.filter((v) => v.cuidadorId === user.id)
    return {
      hoy: mias.filter((v) => v.fecha === dia && v.estado !== 'cancelada').sort(porFechaAsc),
      proximas: mias.filter((v) => v.fecha > dia && (v.estado === 'pendiente' || v.estado === 'en_curso')).sort(porFechaAsc),
      historial: mias.filter((v) => v.fecha < dia || (v.fecha === dia && v.estado === 'cancelada')).sort(porFechaDesc),
    }
  }, [visitas, user.id])
  const completadas = useMemo(() => visitas.filter((v) => v.cuidadorId === user.id && v.estado === 'completada').length, [visitas, user.id])

  const lista = pestana === 'hoy' ? hoy : pestana === 'proximas' ? proximas : historial

  return (
    <Page title="Mis visitas" wide>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr] md:gap-4" aria-label="Resumen de visitas">
        <div className={cn(KPI, 'col-span-2 md:col-span-1 grid grid-cols-[1fr_auto] items-end min-h-[106px] px-5')}>
          <span className="col-span-2 self-start text-base font-semibold text-ink">Visitas para hoy</span>
          <span className="text-[2.5rem] font-bold leading-tight text-ink">{hoy.length}</span>
          <CalendarDays size={36} className="text-success-700" aria-hidden />
        </div>
        <div className={KPI}>
          <span className="text-sm font-semibold text-ink">Próximas</span>
          <span className="text-3xl font-bold leading-tight text-ink">{proximas.length}</span>
        </div>
        <div className={KPI}>
          <span className="text-sm font-semibold text-ink">Completadas</span>
          <span className="text-3xl font-bold leading-tight text-ink">{completadas}</span>
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-[440px]">
          <Segmented<Pestana>
            label="Filtrar visitas"
            value={pestana}
            onChange={setPestana}
            options={[
              { value: 'hoy', label: 'Hoy' },
              { value: 'proximas', label: 'Próximas' },
              { value: 'historial', label: 'Historial' },
            ]}
          />
        </div>
        {puede(user, 'visitas:registrar') && (
          <ButtonLink variant="soft" size="sm" to={`${base}/visitas/nueva`} icon={<ClipboardPlus size={20} aria-hidden />}>
            Registrar visita
          </ButtonLink>
        )}
      </div>

      {lista.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]" role="tabpanel">
          {lista.map((v) => (
            <VisitaCard key={v.id} visita={v} adulto={adultos.find((a) => a.id === v.adultoId)} to={`${base}/visitas/${v.id}`} />
          ))}
        </div>
      ) : (
        <EmptyState title={VACIOS[pestana].titulo} text={VACIOS[pestana].texto} />
      )}
    </Page>
  )
}
