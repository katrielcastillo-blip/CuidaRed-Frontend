import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { Page, useShell } from '@/layouts/AppShell'
import { nombreCompleto, useUser } from '@/domain/auth'
import { useDB } from '@/domain/store'
import { hhmmA12 } from '@/domain/dates'
import { Badge, ButtonLink, Card, EmptyState, SearchInput } from '@/components/ui'
import { AdultoCard } from '../components/AdultoCard'
import { InvitacionOverlay } from '../components/InvitacionOverlay'
import {
  ESTADO_VISITA,
  etiquetaDia,
  masRecientesPrimero,
  normaliza,
  RIESGO_ORDEN,
  TIPO_NECESIDAD,
  ultimaVisitaCompletada,
  useAdultosFamilia,
  useEnLinea,
} from '../lib'
import styles from './Dashboard.module.css'

/** Pantalla Dashboard (285:606): saludo, buscador y "Mis Envejecientes". En ≥768 añade KPIs y un panel de actividad. */
export default function Dashboard() {
  const user = useUser()
  const { base } = useShell()
  const enLinea = useEnLinea()
  const adultos = useAdultosFamilia()
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const familias = useDB((s) => s.familias)
  const [q, setQ] = useState('')

  const ordenados = useMemo(
    () =>
      [...adultos].sort(
        (a, b) => RIESGO_ORDEN[a.riesgo] - RIESGO_ORDEN[b.riesgo] || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'),
      ),
    [adultos],
  )
  const visibles = useMemo(() => {
    const t = normaliza(q.trim())
    if (!t) return ordenados
    return ordenados.filter((a) => normaliza(`${nombreCompleto(a)} ${a.cedula}`).includes(t))
  }, [ordenados, q])

  const ids = useMemo(() => new Set(adultos.map((a) => a.id)), [adultos])
  const nombrePorId = useMemo(() => new Map(adultos.map((a) => [a.id, nombreCompleto(a)])), [adultos])
  const necesidadesActivas = useMemo(
    () => necesidades.filter((n) => ids.has(n.adultoId) && n.estado === 'activa').sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)),
    [necesidades, ids],
  )
  const proximas = useMemo(
    () =>
      visitas
        .filter((v) => ids.has(v.adultoId) && (v.estado === 'pendiente' || v.estado === 'en_curso'))
        .sort((a, b) => masRecientesPrimero(b, a)),
    [visitas, ids],
  )
  const verFamilia = user.familiaIds.length > 1
  const nombreFamilia = (id: string) => familias.find((f) => f.id === id)?.nombre

  return (
    // En móvil el header va sin título (Figma); en escritorio, sin avatar en el header, se muestra "Inicio".
    <Page wide leading={<h1 className="only-desktop">Inicio</h1>}>
      <InvitacionOverlay />

      <div className={styles.saludo}>
        <h1>Hola, {user.nombre}</h1>
        <span className={styles.enLinea}>
          <span className={`${styles.punto} ${enLinea ? '' : styles.sinConexion}`} aria-hidden />
          {enLinea ? 'En línea' : 'Sin conexión'}
        </span>
      </div>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiEtiqueta}>Envejecientes</span>
          <span className={styles.kpiValor}>{adultos.length}</span>
        </div>
        <div className={`${styles.kpi} ${styles.kpiInfo}`}>
          <span className={styles.kpiEtiqueta}>Necesidades activas</span>
          <span className={styles.kpiValor}>{necesidadesActivas.length}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiEtiqueta}>Visitas pendientes</span>
          <span className={styles.kpiValor}>{proximas.length}</span>
        </div>
      </div>

      <div className={styles.cuerpo}>
        <section className="stack" aria-labelledby="mis-envejecientes">
          <div className="row-between">
            <h2 id="mis-envejecientes" className="section-title">
              Mis Envejecientes
            </h2>
            <ButtonLink to={`${base}/invitar`} variant="outline" size="sm" icon={<UserPlus size={18} aria-hidden />}>
              Invitar
            </ButtonLink>
          </div>
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar envejeciente" />

          {visibles.length > 0 ? (
            <div className="grid-auto">
              {visibles.map((a) => (
                <AdultoCard
                  key={a.id}
                  adulto={a}
                  ultimaVisita={ultimaVisitaCompletada(visitas, a.id)}
                  familia={verFamilia ? nombreFamilia(a.familiaId) : undefined}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={adultos.length ? 'Sin resultados' : 'Aún no hay envejecientes'}
              text={adultos.length ? `Ningún envejeciente coincide con «${q.trim()}».` : 'Cuando tu familia tenga envejecientes registrados, aparecerán aquí.'}
            />
          )}
        </section>

        <aside className={styles.actividad} aria-label="Actividad reciente">
          <Card className={styles.panel}>
            <h2 className={styles.panelTitulo}>Próximas visitas</h2>
            {proximas.length ? (
              <ul className={styles.lista}>
                {proximas.slice(0, 5).map((v) => (
                  <li key={v.id}>
                    <Link to={`${base}/visitas/${v.id}`} className={styles.fila}>
                      <span className={styles.filaTexto}>
                        <strong>{nombrePorId.get(v.adultoId)}</strong>
                        <small>
                          {etiquetaDia(v.fecha)}, {hhmmA12(v.horaPautada)}
                        </small>
                      </span>
                      <Badge tone={ESTADO_VISITA[v.estado].tono}>{ESTADO_VISITA[v.estado].label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted text-sm">No hay visitas programadas.</p>
            )}
          </Card>

          <Card className={styles.panel}>
            <h2 className={styles.panelTitulo}>Necesidades activas</h2>
            {necesidadesActivas.length ? (
              <ul className={styles.lista}>
                {necesidadesActivas.slice(0, 5).map((n) => (
                  <li key={n.id}>
                    <Link to={`${base}/necesidades/${n.id}`} className={styles.fila}>
                      <span className={styles.filaTexto}>
                        <strong>{TIPO_NECESIDAD[n.tipo].label}</strong>
                        <small>{nombrePorId.get(n.adultoId)}</small>
                      </span>
                      <Badge tone="danger">ACTIVA</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted text-sm">No hay necesidades activas.</p>
            )}
          </Card>
        </aside>
      </div>
    </Page>
  )
}
