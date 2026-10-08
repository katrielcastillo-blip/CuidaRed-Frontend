import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bell, CalendarX, CircleCheck, ClipboardCheck, Clock, HandHelping, HeartPulse, ShieldAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { EmptyState, SearchInput } from '@/components/ui'
import { relativo } from '@/domain/dates'
import { useUser } from '@/domain/auth'
import { useDB } from '@/domain/store'
import type { Alerta, SeveridadAlerta } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { FilaFiltros, FilterChip } from '../components/FilterChip'
import { CategoriaPill, SeveridadPill } from '../components/Piezas'
import { nombreAdulto, norm, PESO_SEVERIDAD, plural } from '../lib/formato'
import { useVolver } from '../lib/navegacion'
import styles from './AlertasPage.module.css'

const ICONO_CATEGORIA: Record<string, LucideIcon> = {
  'EMERGENCIA MÉDICA': HeartPulse,
  'SIN VISITA': CalendarX,
  SEGUIMIENTO: ClipboardCheck,
  'RIESGO ALTO': ShieldAlert,
  NECESIDAD: HandHelping,
}

type Estado = '' | Alerta['estado']

/** Alertas (Figma 443:3977 admin · 487:1646 coordinador). */
export default function AlertasPage() {
  const { base } = useShell()
  const user = useUser()
  const { back } = useVolver(`${base}/mas`)
  const alertas = useDB((s) => s.alertas)
  const adultos = useDB((s) => s.adultos)
  const [q, setQ] = useState('')
  const [prioridad, setPrioridad] = useState<'' | SeveridadAlerta>('')
  const [estado, setEstado] = useState<Estado>('')

  const adultoPorId = useMemo(() => new Map(adultos.filter((a) => a.orgId === user.orgId).map((a) => [a.id, a])), [adultos, user.orgId])

  const lista = useMemo(() => {
    const t = norm(q)
    return alertas
      .filter((al) => adultoPorId.has(al.adultoId))
      .filter((al) => !prioridad || al.severidad === prioridad)
      .filter((al) => !estado || al.estado === estado)
      .filter((al) => {
        if (!t) return true
        const a = adultoPorId.get(al.adultoId)!
        return norm(`${nombreAdulto(a)} ${al.categoria} ${al.titulo} ${al.descripcion}`).includes(t)
      })
      .sort(
        (x, y) =>
          Number(x.estado === 'atendida') - Number(y.estado === 'atendida') ||
          PESO_SEVERIDAD[x.severidad] - PESO_SEVERIDAD[y.severidad] ||
          y.creadaEn.localeCompare(x.creadaEn),
      )
  }, [alertas, adultoPorId, q, prioridad, estado])

  const activas = lista.filter((al) => al.estado !== 'atendida').length
  const criticas = lista.filter((al) => al.severidad === 'alta' && al.estado === 'pendiente').length

  return (
    <Page title="Alertas" back={back} hideAvatar wide>
      <SearchInput className={styles.buscador} placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />

      <FilaFiltros>
        <FilterChip
          etiqueta="Prioridad"
          value={prioridad}
          onChange={setPrioridad}
          opciones={[
            { value: '', label: 'Todos' },
            { value: 'alta', label: 'Alta' },
            { value: 'media', label: 'Media' },
            { value: 'baja', label: 'Baja' },
          ]}
        />
        <FilterChip
          etiqueta="Estado"
          value={estado}
          onChange={setEstado}
          opciones={[
            { value: '', label: 'Todos' },
            { value: 'pendiente', label: 'Pendiente' },
            { value: 'en_atencion', label: 'En atención' },
            { value: 'atendida', label: 'Atendida' },
          ]}
        />
      </FilaFiltros>

      <div className={styles.resumen} aria-live="polite">
        <span className={styles.conteo}>
          <i className={styles.punto} aria-hidden />
          Mostrando <b>{plural(activas, 'alerta', 'alertas')}</b> {activas === 1 ? 'activa' : 'activas'}
        </span>
        {criticas > 0 && <span className={styles.criticas}>{criticas === 1 ? '1 Crítica pendiente' : `${criticas} Críticas pendientes`}</span>}
      </div>

      {lista.length === 0 ? (
        <EmptyState title="Sin alertas" text="No hay alertas que coincidan con la búsqueda o los filtros." />
      ) : (
        <div className="grid-auto">
          {lista.map((al) => {
            const a = adultoPorId.get(al.adultoId)!
            const Icono = ICONO_CATEGORIA[al.categoria] ?? Bell
            return (
              <Link key={al.id} to={`${base}/alertas/${al.id}`} className={`${styles.tarjeta} ${styles[`sev_${al.severidad}`]} ${al.estado === 'atendida' ? styles.atendida : ''}`}>
                <div className={styles.cabecera}>
                  <span className={styles.icono} aria-hidden>
                    <Icono size={20} />
                  </span>
                  <div className={styles.quien}>
                    <strong>{nombreAdulto(a)}</strong>
                    <small>{a.zona}</small>
                  </div>
                  <span className={styles.hora}>
                    <Clock size={13} aria-hidden />
                    {relativo(al.creadaEn)}
                  </span>
                </div>
                <p className={styles.texto}>{al.descripcion}</p>
                <div className={styles.pie}>
                  <div className={styles.etiquetas}>
                    <SeveridadPill severidad={al.severidad} />
                    <CategoriaPill>{al.categoria}</CategoriaPill>
                    {al.estado === 'atendida' && (
                      <span className={styles.estadoOk}>
                        <CircleCheck size={14} aria-hidden /> Atendida
                      </span>
                    )}
                    {al.estado === 'en_atencion' && <span className={styles.estadoEn}>En atención</span>}
                  </div>
                  <span className={styles.mas}>
                    Ver más <ArrowRight size={16} aria-hidden />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Page>
  )
}
