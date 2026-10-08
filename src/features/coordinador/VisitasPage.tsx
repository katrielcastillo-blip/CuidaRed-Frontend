import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, CalendarPlus } from 'lucide-react'
import { ButtonLink, EmptyState, SearchInput, Segmented, SelectField } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import type { Visita } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { VisitaCard } from './components/VisitaCard'
import { useOrgData } from './lib/datos'
import styles from './VisitasPage.module.css'

type Tab = 'hoy' | 'proximas' | 'historial'
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'proximas', label: 'Próximas' },
  { value: 'historial', label: 'Historial' },
]
const esTab = (v: string | null): v is Tab => v === 'hoy' || v === 'proximas' || v === 'historial'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const clave = (v: Visita) => `${v.fecha} ${v.horaPautada}`

const VACIO: Record<Tab, { title: string; text: string }> = {
  hoy: { title: 'No hay visitas para hoy', text: 'Programa una visita para que aparezca en la agenda del día.' },
  proximas: { title: 'No hay visitas próximas', text: 'Las visitas programadas a futuro aparecerán aquí.' },
  historial: { title: 'El historial está vacío', text: 'Aquí verás las visitas pasadas y las canceladas.' },
}

/** Pantalla Visitas coord (Figma 491:2943): visitas de toda la organización con KPIs, pestañas, búsqueda y cuidador asignado. */
export function VisitasPage() {
  const { base } = useShell()
  const { visitas, adultoPorId, usuarioPorId, cuidadores } = useOrgData()
  const [params, setParams] = useSearchParams()
  const tab: Tab = esTab(params.get('tab')) ? (params.get('tab') as Tab) : 'hoy'
  const [q, setQ] = useState('')
  const [cuidadorId, setCuidadorId] = useState('')

  const hoy = todayISO()

  const grupos = useMemo(() => {
    const noCanceladas = visitas.filter((v) => v.estado !== 'cancelada')
    return {
      hoy: noCanceladas.filter((v) => v.fecha === hoy).sort((a, b) => clave(a).localeCompare(clave(b))),
      proximas: noCanceladas.filter((v) => v.fecha > hoy).sort((a, b) => clave(a).localeCompare(clave(b))),
      historial: visitas.filter((v) => v.estado === 'cancelada' || v.fecha < hoy).sort((a, b) => clave(b).localeCompare(clave(a))),
    } satisfies Record<Tab, Visita[]>
  }, [visitas, hoy])

  const lista = useMemo(() => {
    const t = norm(q.trim())
    return grupos[tab].filter((v) => {
      if (cuidadorId && v.cuidadorId !== cuidadorId) return false
      if (!t) return true
      const adulto = adultoPorId.get(v.adultoId)
      const cuidador = usuarioPorId.get(v.cuidadorId)
      return norm([adulto ? nombreCompleto(adulto) : '', cuidador ? nombreCompleto(cuidador) : '', v.tipo].join(' ')).includes(t)
    })
  }, [grupos, tab, q, cuidadorId, adultoPorId, usuarioPorId])

  const filtrando = q.trim() !== '' || cuidadorId !== ''
  const opcionesCuidador = useMemo(
    () => [{ value: '', label: 'Todos los cuidadores' }, ...cuidadores.map((c) => ({ value: c.id, label: nombreCompleto(c) }))],
    [cuidadores],
  )
  const programar = `${base}/visitas/programar`

  return (
    <Page
      title="Mis Visitas"
      wide
      actions={
        <div className="only-desktop">
          <ButtonLink to={programar} variant="light" size="sm" icon={<CalendarPlus size={18} aria-hidden />}>
            Programar visita
          </ButtonLink>
        </div>
      }
    >
      {/* ───── KPIs ───── */}
      <section className={styles.kpis} aria-label="Resumen de visitas">
        <div className={`${styles.kpi} ${styles.kpiHoy}`}>
          <span className={styles.kpiLabel}>Visitas Programadas para Hoy</span>
          <span className={styles.kpiValor}>{grupos.hoy.length}</span>
          <CalendarDays size={32} className={styles.kpiIcono} aria-hidden />
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Visitas Próximas</span>
          <span className={styles.kpiValor}>{grupos.proximas.length}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Total de Visitas</span>
          <span className={styles.kpiValor}>{visitas.length}</span>
        </div>
      </section>

      {/* ───── Filtros ───── */}
      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <Segmented
            label="Filtrar visitas"
            value={tab}
            options={TABS}
            onChange={(v) => setParams(v === 'hoy' ? {} : { tab: v }, { replace: true })}
          />
        </div>
        <SearchInput
          className={styles.buscar}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar visitas..."
          aria-label="Buscar visitas"
        />
        <div className={styles.cuidador}>
          <SelectField
            aria-label="Filtrar por cuidador asignado"
            value={cuidadorId}
            onChange={(e) => setCuidadorId(e.target.value)}
            options={opcionesCuidador}
          />
        </div>
      </div>

      {/* ───── Lista ───── */}
      {lista.length === 0 ? (
        <EmptyState
          title={filtrando ? 'Sin resultados' : VACIO[tab].title}
          text={filtrando ? 'Prueba con otro nombre o quita el filtro de cuidador.' : VACIO[tab].text}
        />
      ) : (
        <div className={`grid-auto ${styles.lista}`} role="tabpanel" aria-label={TABS.find((t) => t.value === tab)?.label}>
          {lista.map((v) => (
            <VisitaCard
              key={v.id}
              visita={v}
              adulto={adultoPorId.get(v.adultoId)!}
              cuidador={usuarioPorId.get(v.cuidadorId)}
              to={`${base}/visitas/${v.id}`}
            />
          ))}
        </div>
      )}

      {/* Móvil: botón fijo sobre el bottom-nav, como en el Figma */}
      <div className={`${styles.ctaMovil} only-mobile`}>
        <ButtonLink to={programar} fullWidth>
          Programar visita
        </ButtonLink>
      </div>
    </Page>
  )
}
