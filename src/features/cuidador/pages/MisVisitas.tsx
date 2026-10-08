import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useSession } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import { useDB } from '@/domain/store'
import { EmptyState, Segmented } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { VisitaCard } from '@/features/visitas/components/VisitaCard'
import { porFechaAsc, porFechaDesc } from '@/features/visitas/lib/dominio'
import styles from './MisVisitas.module.css'

type Pestana = 'hoy' | 'proximas' | 'historial'

const VACIOS: Record<Pestana, { titulo: string; texto: string }> = {
  hoy: { titulo: 'Sin visitas para hoy', texto: 'No tienes visitas programadas para hoy.' },
  proximas: { titulo: 'Sin visitas próximas', texto: 'No hay visitas programadas para los próximos días.' },
  historial: { titulo: 'Sin historial', texto: 'Aún no has completado visitas.' },
}

/** Mis Visitas (Figma 358:2447): KPIs y pestañas Hoy | Próximas | Historial. */
export function MisVisitas() {
  const { user } = useSession()
  const { base } = useShell()
  const visitas = useDB((s) => s.visitas)
  const adultos = useDB((s) => s.adultos)
  const [pestana, setPestana] = useState<Pestana>('hoy')

  const { hoy, proximas, historial, total } = useMemo(() => {
    const dia = todayISO()
    const mias = visitas.filter((v) => v.cuidadorId === user?.id)
    return {
      hoy: mias.filter((v) => v.fecha === dia && v.estado !== 'cancelada').sort(porFechaAsc),
      proximas: mias.filter((v) => v.fecha > dia && (v.estado === 'pendiente' || v.estado === 'en_curso')).sort(porFechaAsc),
      historial: mias.filter((v) => v.estado === 'completada' || v.estado === 'cancelada' || v.fecha < dia).sort(porFechaDesc),
      total: mias.length,
    }
  }, [visitas, user?.id])

  const lista = pestana === 'hoy' ? hoy : pestana === 'proximas' ? proximas : historial

  return (
    <Page title="Mis Visitas" wide>
      <section className={styles.kpis} aria-label="Resumen de visitas">
        <div className={`${styles.kpi} ${styles.principal}`}>
          <span className={styles.etiqueta}>Visitas Programadas para Hoy</span>
          <span className={styles.valor}>{hoy.length}</span>
          <CalendarDays size={36} className={styles.icono} aria-hidden />
        </div>
        <div className={styles.kpi}>
          <span className={styles.etiqueta}>Visitas Próximas</span>
          <span className={styles.valor}>{proximas.length}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.etiqueta}>Total de Visitas</span>
          <span className={styles.valor}>{total}</span>
        </div>
      </section>

      <div className={styles.pestanas}>
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

      {lista.length > 0 ? (
        <div className={styles.rejilla}>
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
