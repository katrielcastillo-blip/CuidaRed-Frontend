import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseMedical, CalendarPlus, ClipboardPlus, HeartHandshake, PersonStanding, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { addDays, fechaLarga, toISODate } from '@/domain/dates'
import { Page, useShell } from '@/layouts/AppShell'
import { AlertaCard } from './components/AlertaCard'
import { esAlertaActiva, esUrgente, GRUPO_NECESIDAD, MESES_CORTOS, porcentajes, useOrgData } from './lib/datos'
import styles from './DashboardPage.module.css'

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Pantalla Dashboard coordinador (Figma 487:439). Todo sale del store de la organización. */
export function DashboardPage() {
  const { base } = useShell()
  const { user, adultos, adultoPorId, visitas, alertas, necesidades } = useOrgData()

  const m = useMemo(() => {
    const activas = alertas.filter(esAlertaActiva)
    const prioritarios = activas.filter((a) => a.severidad === 'alta').length
    const recientes = [...alertas].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)).slice(0, 3)

    // Adultos: activos y crecimiento de los últimos 30 días
    const activosAdultos = adultos.filter((a) => a.estado === 'activo')
    const desde = toISODate(addDays(new Date(), -30))
    const nuevos = activosAdultos.filter((a) => a.creadoEn.slice(0, 10) >= desde).length
    const previos = activosAdultos.length - nuevos
    const crecimiento = nuevos > 0 ? Math.round((nuevos / Math.max(previos, 1)) * 100) : 0

    // Necesidades pendientes y urgentes
    const pendientes = necesidades.filter((n) => n.estado === 'activa')
    const urgentes = pendientes.filter((n) => esUrgente(n, adultoPorId)).length

    // Visitas de los últimos 6 meses (mes actual al final)
    const hoy = new Date()
    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1)
      const clave = toISODate(d).slice(0, 7)
      const total = visitas.filter((v) => v.estado !== 'cancelada' && v.fecha.startsWith(clave)).length
      return { clave, label: MESES_CORTOS[d.getMonth()]!, total }
    })
    const maxVisitas = Math.max(...meses.map((x) => x.total), 0)
    const mesTop = maxVisitas > 0 ? meses.reduce((a, b) => (b.total >= a.total ? b : a)).clave : null

    // Tipos de necesidades (Médica · Social · Nutrición)
    const conteo = { medica: 0, social: 0, nutricion: 0 }
    for (const n of necesidades) conteo[GRUPO_NECESIDAD[n.tipo]]++
    const [pMed, pSoc, pNut] = porcentajes([conteo.medica, conteo.social, conteo.nutricion])
    const tipos = [
      { clave: 'medica', label: 'Médica', n: conteo.medica, pct: pMed! },
      { clave: 'social', label: 'Social', n: conteo.social, pct: pSoc! },
      { clave: 'nutricion', label: 'Nutrición', n: conteo.nutricion, pct: pNut! },
    ]

    return { activas: activas.length, prioritarios, recientes, totalAdultos: activosAdultos.length, crecimiento, pendientes: pendientes.length, urgentes, meses, maxVisitas, mesTop, tipos, totalNecesidades: necesidades.length }
  }, [adultos, adultoPorId, visitas, alertas, necesidades])

  const resumenMeses = m.meses.map((x) => `${x.label} ${x.total}`).join(', ')

  return (
    <Page title="Dashboard" wide>
      <div className={styles.dash}>
        <header className={styles.hero}>
          <h2 className={styles.saludo}>Hola, {user.nombre}</h2>
          <p className={styles.fecha}>{fechaLarga()}</p>
        </header>

        {/* ───── KPIs ───── */}
        <section className={styles.kpis} aria-label="Resumen general">
          <Link to={`${base}/alertas`} className={`${styles.kpi} ${styles.kpiAlertas}`}>
            <span className={styles.alertasLabel}>Alertas Activas</span>
            <span className={styles.alertasValor}>{m.activas}</span>
          </Link>

          <Link to={`${base}/adultos`} className={`${styles.kpi} ${styles.kpiBlanco}`}>
            <span className={styles.kpiTop}>
              <PersonStanding size={24} className={styles.kpiIcon} aria-hidden />
              {m.crecimiento > 0 && (
                <span className={styles.pill} title="Crecimiento en los últimos 30 días">
                  +{m.crecimiento}%
                </span>
              )}
            </span>
            <span className={styles.kpiLabel}>Adultos Mayores</span>
            <span className={styles.kpiValor}>{m.totalAdultos}</span>
          </Link>

          <div className={`${styles.kpi} ${styles.kpiBlanco}`}>
            <span className={styles.kpiTopSplit}>
              <span className={styles.kpiLabel}>Necesidades Pendientes</span>
              <BriefcaseMedical size={22} className={styles.kpiIcon} aria-hidden />
            </span>
            <span className={styles.kpiValor}>{m.pendientes}</span>
            <span className={styles.kpiNota}>{m.urgentes} urgente{m.urgentes === 1 ? '' : 's'}</span>
          </div>

          <Link to={`${base}/alertas`} className={`${styles.kpi} ${styles.kpiPrior}`}>
            <span className={styles.priorTexto}>
              <strong>Casos Prioritarios</strong>
              <span>
                {pad2(m.prioritarios)} {m.prioritarios === 1 ? 'Pendiente' : 'Pendientes'}
              </span>
            </span>
            <ArrowRight size={20} className={styles.priorFlecha} aria-hidden />
          </Link>
        </section>

        <div className={styles.panels}>
          {/* ───── Estadísticas ───── */}
          <section className={styles.stats} aria-labelledby="dash-estadisticas">
            <div className={styles.secHead}>
              <h2 id="dash-estadisticas" className={styles.secTitle}>Estadísticas</h2>
              <Link to={`${base}/reportes`} className={styles.verTodo}>
                Ver todo
              </Link>
            </div>

            <div className={styles.charts}>
              <article className={styles.panel}>
                <h3 className={styles.panelTitle}>Visitas por Mes</h3>
                <div className={styles.plot} role="img" aria-label={`Visitas por mes: ${resumenMeses}`}>
                  {m.meses.map((x) => {
                    const top = x.clave === m.mesTop
                    const alto = m.maxVisitas > 0 ? Math.max((x.total / m.maxVisitas) * 78, 3) : 3
                    return (
                      <div key={x.clave} className={styles.col} title={`${x.label}: ${x.total} visitas`}>
                        <span className={`${styles.barVal} ${top ? styles.barValTop : ''}`}>{x.total > 0 ? x.total : ''}</span>
                        <span className={`${styles.bar} ${top ? styles.barTop : ''}`} style={{ height: `${alto}%` }} />
                      </div>
                    )
                  })}
                </div>
                <div className={styles.meses} aria-hidden>
                  {m.meses.map((x) => (
                    <span key={x.clave}>{x.label}</span>
                  ))}
                </div>
              </article>

              <article className={styles.panel}>
                <h3 className={styles.panelTitle}>Tipos de Necesidades</h3>
                {m.totalNecesidades === 0 ? (
                  <p className="muted">Aún no hay necesidades registradas.</p>
                ) : (
                  <>
                    <div className={styles.segbar} role="img" aria-label={m.tipos.map((t) => `${t.label} ${t.pct}%`).join(', ')}>
                      {m.tipos.map((t) => (
                        <span key={t.clave} className={styles[`seg_${t.clave}`]} style={{ flexGrow: t.n }} />
                      ))}
                    </div>
                    <ul className={styles.legend}>
                      {m.tipos.map((t) => (
                        <li key={t.clave}>
                          <span className={`${styles.dot} ${styles[`seg_${t.clave}`]}`} aria-hidden />
                          <span className={styles.legendLabel}>{t.label}</span>
                          <span className={styles.legendPct}>{t.pct}%</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </article>
            </div>
          </section>

          {/* ───── Alertas recientes ───── */}
          <section className={styles.alertas} aria-labelledby="dash-alertas">
            <div className={styles.secHead}>
              <h2 id="dash-alertas" className={styles.secTitle}>Alertas Recientes</h2>
              <Link to={`${base}/alertas`} className={styles.verTodo}>
                Ver todas
              </Link>
            </div>
            {m.recientes.length === 0 ? (
              <EmptyState title="Sin alertas" text="No hay alertas registradas en tu organización." />
            ) : (
              <div className={styles.alertaList}>
                {m.recientes.map((a) => (
                  <AlertaCard key={a.id} alerta={a} adulto={adultoPorId.get(a.adultoId)!} to={`${base}/alertas/${a.id}`} />
                ))}
              </div>
            )}
          </section>

          {/* ───── Acciones rápidas ───── */}
          <section className={styles.acciones} aria-labelledby="dash-acciones">
            <h2 id="dash-acciones" className={styles.secTitle}>Acciones rápidas</h2>
            <div className={styles.accionesGrid}>
              <Accion to={`${base}/visitas/programar`} icon={CalendarPlus} label="Programar visita" />
              <Accion to={`${base}/visitas/nueva`} icon={ClipboardPlus} label="Registrar visita" />
              <Accion to={`${base}/necesidades/nueva`} icon={HeartHandshake} label="Registrar necesidad" />
              <Accion to={`${base}/adultos/nuevo`} icon={UserPlus} label="Agregar adulto" />
            </div>
          </section>
        </div>
      </div>
    </Page>
  )
}

function Accion({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} className={styles.accion}>
      <span className={styles.accionIcono}>
        <Icon size={22} aria-hidden />
      </span>
      <span>{label}</span>
    </Link>
  )
}
