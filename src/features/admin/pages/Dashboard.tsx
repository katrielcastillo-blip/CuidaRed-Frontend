import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseMedical, PersonStanding, TrendingUp } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { fechaLarga } from '@/domain/dates'
import { useUser } from '@/domain/auth'
import { Page, useShell } from '@/layouts/AppShell'
import type { SeveridadAlerta } from '@/domain/types'
import { hace, nombreCorto, pad2 } from '../lib/datos'
import { useResumen, type AlertaReciente } from '../lib/resumen'
import styles from './Dashboard.module.css'

const SEVERIDAD: Record<SeveridadAlerta, { label: string; cls: string; barra: string }> = {
  alta: { label: 'ALTA', cls: 'sevAlta', barra: 'barraAlta' },
  media: { label: 'MEDIA', cls: 'sevMedia', barra: 'barraMedia' },
  baja: { label: 'BAJA', cls: 'sevBaja', barra: 'barraBaja' },
}

export default function Dashboard() {
  const user = useUser()
  const { base } = useShell()
  const r = useResumen()

  const maxVisitas = Math.max(0, ...r.visitasPorMes.map((m) => m.total))
  const totalVisitas = r.visitasPorMes.reduce((a, m) => a + m.total, 0)
  const iMax = maxVisitas > 0 ? r.visitasPorMes.findIndex((m) => m.total === maxVisitas) : -1

  return (
    <Page title="Dashboard" wide>
      <header className={styles.saludo}>
        <h2 className={styles.hola}>Hola, {user.nombre}</h2>
        <p className={styles.fecha}>{fechaLarga()}</p>
      </header>

      {/* Alertas activas + KPIs */}
      <section className={styles.tiles} aria-label="Resumen">
        <Link to={`${base}/alertas`} className={styles.alertTile}>
          <span className={styles.alertLabel}>Alertas Activas</span>
          <span className={styles.alertValue}>{r.alertasActivas}</span>
        </Link>

        <Link to={`${base}/adultos`} className={styles.kpi}>
          <span className={styles.kpiHead}>
            <PersonStanding size={24} className={styles.kpiIcon} aria-hidden />
            {r.tendenciaAdultos !== null && (
              <span className={styles.trend} title="Altas de los últimos 30 días">
                <TrendingUp size={12} aria-hidden />+{r.tendenciaAdultos}%
              </span>
            )}
          </span>
          <span className={styles.kpiLabel}>Adultos Mayores</span>
          <span className={styles.kpiValue}>{r.adultos}</span>
        </Link>

        <Link to={`${base}/miembros`} className={styles.kpi}>
          <span className={styles.kpiHead}>
            <BriefcaseMedical size={24} className={styles.kpiIcon} aria-hidden />
          </span>
          <span className={styles.kpiLabel}>Cuidadores</span>
          <span className={styles.kpiValue}>{r.cuidadores}</span>
          <span className={styles.kpiNote}>
            {r.solicitudesPendientes > 0 ? `${r.solicitudesPendientes} sol. pendientes` : 'Sin sol. pendientes'}
          </span>
        </Link>

        <Link to={`${base}/adultos`} className={styles.prioritarios}>
          <span className={styles.prioTitulo}>Casos Prioritarios</span>
          <span className={styles.prioTexto}>
            {pad2(r.prioritarios)} con riesgo alto
          </span>
        </Link>
      </section>

      <div className={styles.columnas}>
        {/* Estadísticas */}
        <section className={styles.seccion} aria-labelledby="h-estadisticas">
          <div className="row-between">
            <h2 id="h-estadisticas" className="section-title">
              Estadísticas
            </h2>
            <Link to={`${base}/reportes`} className={styles.verTodo}>
              Ver todo
            </Link>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitulo}>Visitas por Mes</h3>
              {totalVisitas === 0 ? (
                <p className="muted text-sm">Aún no hay visitas registradas en los últimos 6 meses.</p>
              ) : null}
              <div
                className={styles.barras}
                role="img"
                aria-label={`Visitas por mes: ${r.visitasPorMes.map((m) => `${m.etiqueta} ${m.total}`).join(', ')}`}
              >
                {r.visitasPorMes.map((m, i) => (
                  <div key={m.clave} className={styles.col} title={`${m.etiqueta}: ${m.total} visitas`}>
                    <span className={`${styles.valor} ${i === iMax ? styles.valorTop : ''}`}>{m.total}</span>
                    <span className={styles.barraZona}>
                      <span
                        className={`${styles.barra} ${i === iMax ? styles.barraTop : ''}`}
                        style={{ '--p': maxVisitas ? m.total / maxVisitas : 0 } as CSSProperties}
                      />
                    </span>
                    <span className={styles.mes}>{m.etiqueta}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.panel}>
              <h3 className={styles.panelTitulo}>Tipos de Necesidades</h3>
              {r.tiposNecesidad.length === 0 ? (
                <p className="muted text-sm">Aún no hay necesidades registradas.</p>
              ) : (
                <>
                  <div
                    className={styles.segmentos}
                    role="img"
                    aria-label={`Tipos de necesidades: ${r.tiposNecesidad.map((t) => `${t.etiqueta} ${t.pct}%`).join(', ')}`}
                  >
                    {r.tiposNecesidad.map((t) => (
                      <span key={t.tipo} style={{ flexGrow: t.total, background: t.color }} />
                    ))}
                  </div>
                  <ul className={styles.leyenda}>
                    {r.tiposNecesidad.map((t) => (
                      <li key={t.tipo}>
                        <span className={styles.leyendaNombre}>
                          <i style={{ background: t.color }} aria-hidden />
                          {t.etiqueta}
                        </span>
                        <span className={styles.pct}>{t.pct}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Alertas recientes */}
        <section className={styles.seccion} aria-labelledby="h-alertas">
          <div className="row-between">
            <h2 id="h-alertas" className="section-title">
              Alertas Recientes
            </h2>
            <Link to={`${base}/alertas`} className={styles.verTodo}>
              Ver todo
            </Link>
          </div>
          {r.alertasRecientes.length === 0 ? (
            <p className="muted">No hay alertas registradas.</p>
          ) : (
            <ul className={styles.alertas}>
              {r.alertasRecientes.map((x, i) => (
                <li key={x.alerta.id} className={i === 3 ? styles.soloAncho : undefined}>
                  <AlertaCard x={x} to={`${base}/alertas/${x.alerta.id}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  )
}

function AlertaCard({ x, to }: { x: AlertaReciente; to: string }) {
  const sev = SEVERIDAD[x.alerta.severidad]
  const atendida = x.alerta.estado === 'atendida'
  return (
    <Link to={to} className={`${styles.alerta} ${styles[sev.barra]} ${atendida ? styles.atendida : ''}`}>
      <div className={styles.alertaHead}>
        <Avatar nombre={`${x.adulto.nombre} ${x.adulto.apellido}`} src={x.adulto.foto} size={48} />
        <div className={styles.alertaQuien}>
          <strong>{nombreCorto(x.adulto)}</strong>
          <span>Adulto Mayor</span>
        </div>
        <time className={styles.alertaHace} dateTime={x.alerta.creadaEn}>
          {hace(x.alerta.creadaEn)}
        </time>
      </div>
      <p className={styles.alertaTexto}>{x.alerta.descripcion}</p>
      <div className={styles.chips}>
        <span className={`${styles.chip} ${styles[sev.cls]}`}>{sev.label}</span>
        <span className={`${styles.chip} ${x.alerta.severidad === 'baja' ? styles.catBaja : styles.cat}`}>{x.alerta.categoria}</span>
        {atendida && <span className={`${styles.chip} ${styles.catAtendida}`}>ATENDIDA</span>}
      </div>
    </Link>
  )
}
