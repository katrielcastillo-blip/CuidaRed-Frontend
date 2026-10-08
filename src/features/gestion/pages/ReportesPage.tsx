import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  BriefcaseMedical,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Download,
  FileSpreadsheet,
  FileText,
  MapPin,
  PersonStanding,
  ShieldAlert,
  Tags,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { useToast } from '@/components/ui'
import { useUser, useSession } from '@/domain/auth'
import { fechaCorta, fechaLarga, todayISO } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Riesgo, TipoNecesidad } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { FilaFiltros, FilterChip } from '../components/FilterChip'
import { RIESGO_TEXTO, TIPO_NECESIDAD_TEXTO } from '../lib/formato'
import { useVolver } from '../lib/navegacion'
import {
  calcularReporte,
  descargarArchivo,
  describirFiltros,
  FILTROS_INICIALES,
  RANGOS,
  reporteCSV,
  type Delta,
  type FiltrosReporte,
  type Rango,
  type Reporte,
} from '../lib/reportes'
import { zonasEnUso } from '../lib/zonas'
import styles from './ReportesPage.module.css'

function Variacion({ delta, anterior }: { delta: Delta | null; anterior: string }) {
  if (!delta) return <span className={styles.subNeutro}>Acumulado total</span>
  const sube = delta.diff >= 0
  const texto = delta.pct !== null ? `${sube ? '+' : ''}${delta.pct}%` : `${sube ? '+' : ''}${delta.diff}`
  return (
    <span className={sube ? styles.subSube : styles.subBaja}>
      {sube ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
      {texto} vs {anterior}
    </span>
  )
}

function Kpi({ etiqueta, valor, icono, tono, children }: { etiqueta: string; valor: number; icono: ReactNode; tono?: 'peligro'; children?: ReactNode }) {
  return (
    <article className={styles.kpi}>
      <div className={styles.kpiTop}>
        <h3>{etiqueta}</h3>
        <span className={`${styles.kpiIcono} ${tono === 'peligro' ? styles.kpiPeligro : ''}`} aria-hidden>
          {icono}
        </span>
      </div>
      <p className={`${styles.kpiValor} ${tono === 'peligro' ? styles.valorPeligro : ''}`}>{valor.toLocaleString('es-DO')}</p>
      <div className={styles.kpiSub}>{children}</div>
    </article>
  )
}

function GraficoVisitas({ r }: { r: Reporte }) {
  const max = Math.max(1, ...r.visitasPorMes.map((m) => m.total))
  const mesActual = r.visitasPorMes.find((m) => m.actual)
  const resumen = r.visitasPorMes.map((m) => `${m.etiqueta}: ${m.total}`).join(', ')
  return (
    <section className={styles.panel} aria-labelledby="g-visitas">
      <div className={styles.panelTop}>
        <div>
          <h2 id="g-visitas" className={styles.panelTitulo}>
            Visitas por Mes
          </h2>
          <p className={styles.panelSub}>Últimos 6 meses</p>
        </div>
        <strong className={styles.total}>{r.visitasSemestre}</strong>
      </div>
      <div className={styles.grafico} role="img" aria-label={`Visitas realizadas por mes. ${resumen}`}>
        <div className={styles.plot}>
          {r.visitasPorMes.map((m, i) => {
            const p = (m.total / max) * 86
            const tono = m.actual ? styles.barActual : i === 4 ? styles.barPrevio : styles.barBase
            return (
              <div key={m.clave} className={styles.col}>
                <span className={`${styles.valorBarra} ${m.actual ? styles.valorActual : ''}`} style={{ bottom: `calc(${p}% + 4px)` }}>
                  {m.total}
                </span>
                <span className={`${styles.barra} ${tono}`} style={{ height: `${m.total > 0 ? Math.max(p, 3) : 0}%` }} />
              </div>
            )
          })}
        </div>
        <div className={styles.meses}>
          {r.visitasPorMes.map((m) => (
            <span key={m.clave} className={m.actual ? styles.mesActual : undefined}>
              {m.etiqueta}
            </span>
          ))}
        </div>
      </div>
      <p className={styles.leyenda}>
        <i aria-hidden /> Mes en curso{mesActual ? ` (${mesActual.etiqueta})` : ''}
      </p>
    </section>
  )
}

function Categorias({ r }: { r: Reporte }) {
  return (
    <section className={`${styles.panel} ${styles.panelAzul}`} aria-labelledby="g-cat">
      <div className={styles.panelTop}>
        <h2 id="g-cat" className={styles.panelTitulo}>
          Distribución por Categoría
        </h2>
        <span className={styles.solicitudes}>
          <b>{r.solicitudes}</b> {r.solicitudes === 1 ? 'Solicitud' : 'Solicitudes'}
        </span>
      </div>
      <div className={styles.apilada} role="img" aria-label={`Distribución de necesidades por categoría. ${r.categorias.map((c) => `${c.etiqueta} ${c.pct}%`).join(', ')}`}>
        {r.solicitudes > 0 ? (
          r.categorias.filter((c) => c.total > 0).map((c) => <span key={c.tipo} className={styles[`cat_${c.tipo}`]} style={{ flexGrow: c.total }} />)
        ) : (
          <span className={styles.vacia} />
        )}
      </div>
      {r.solicitudes === 0 && <p className={styles.panelSub}>No hay necesidades registradas con estos filtros.</p>}
      <ul className={styles.categorias}>
        {r.categorias.map((c) => (
          <li key={c.tipo}>
            <i className={styles[`cat_${c.tipo}`]} aria-hidden />
            <span className={styles.catNombre}>{c.etiqueta}</span>
            <span className={styles.catPct}>{c.pct}%</span>
            <span className={styles.catN}>({c.total})</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Riesgos({ r }: { r: Reporte }) {
  return (
    <section className={styles.panel} aria-labelledby="g-riesgo">
      <div>
        <h2 id="g-riesgo" className={styles.panelTitulo}>
          Adultos por Nivel de Riesgo
        </h2>
        <p className={styles.panelSub}>Clasificación por Nivel de Riesgo Social</p>
      </div>
      <ul className={styles.riesgos}>
        {r.riesgo.map((x) => (
          <li key={x.nivel}>
            <div className={styles.riesgoTop}>
              <span className={`${styles.riesgoNombre} ${styles[`n_${x.nivel}`]}`}>
                <i aria-hidden /> {x.etiqueta} ({x.pct}%)
              </span>
              <span className={styles.riesgoN}>
                {x.total} {x.total === 1 ? 'adulto' : 'adultos'}
              </span>
            </div>
            <div className={styles.pista} role="img" aria-label={`${x.etiqueta}: ${x.pct}%`}>
              <span className={styles[`b_${x.nivel}`]} style={{ width: `${x.pct}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Exportar: PDF = imprimir el resumen ejecutivo (window.print) · hoja de cálculo = CSV generado en el cliente. */
function ExportarPanel({ r, filtros, organizacion }: { r: Reporte; filtros: FiltrosReporte; organizacion: string }) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(true)
  const imprimir = () => {
    const titulo = document.title
    document.title = `Reporte CuidaRed ${todayISO()}`
    window.print()
    document.title = titulo
  }
  const descargar = () => {
    descargarArchivo(`reporte-cuidared-${todayISO()}.csv`, reporteCSV(r, filtros, organizacion))
    toast('Hoja de cálculo descargada')
  }
  return (
    <section className={styles.exportar} aria-labelledby="exportar">
          <button type="button" className={styles.exportarBtn} aria-expanded={abierto} aria-controls="formatos" onClick={() => setAbierto((a) => !a)}>
            <Download size={20} aria-hidden />
            <span id="exportar">Exportar Reporte</span>
            <ChevronDown size={20} aria-hidden className={abierto ? styles.girado : undefined} />
          </button>
          {abierto && (
            <div id="formatos" className={styles.formatos}>
              <p className={styles.formatoTitulo}>SELECCIONAR FORMATO</p>
              <button type="button" className={styles.formato} onClick={imprimir}>
                <span className={`${styles.formatoIcono} ${styles.pdf}`} aria-hidden>
                  <FileText size={22} />
                </span>
                <span className={styles.formatoTexto}>
                  <strong>Documento PDF (.pdf)</strong>
                  <small>Resumen ejecutivo listo para imprimir</small>
                </span>
                <ArrowRight size={18} aria-hidden />
              </button>
              <button type="button" className={styles.formato} onClick={descargar}>
                <span className={`${styles.formatoIcono} ${styles.hoja}`} aria-hidden>
                  <FileSpreadsheet size={22} />
                </span>
                <span className={styles.formatoTexto}>
                  <strong>Hoja de cálculo (.csv)</strong>
                  <small>Datos brutos tabulados y métricas</small>
                </span>
                <ArrowRight size={18} aria-hidden />
              </button>
            </div>
          )}
    </section>
  )
}

/** Reportes y Estadísticas (Figma 479:2093 admin · 487:2006 coordinador). Todo se calcula del store con los filtros. */
export default function ReportesPage() {
  const { base } = useShell()
  const user = useUser()
  const { org } = useSession()
  const { back } = useVolver(`${base}/mas`)
  const adultos = useDB((s) => s.adultos)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const alertas = useDB((s) => s.alertas)
  const [filtros, setFiltros] = useState<FiltrosReporte>(FILTROS_INICIALES)
  const set = <K extends keyof FiltrosReporte>(k: K, v: FiltrosReporte[K]) => setFiltros((f) => ({ ...f, [k]: v }))

  const zonas = useMemo(() => zonasEnUso(adultos.filter((a) => a.orgId === user.orgId)), [adultos, user.orgId])
  const r = useMemo(
    () => calcularReporte({ adultos, visitas, necesidades, alertas }, user.orgId, filtros),
    [adultos, visitas, necesidades, alertas, user.orgId, filtros],
  )
  const rango = RANGOS.find((x) => x.value === filtros.rango)!
  const orgNombre = org?.nombre ?? 'CuidaRed'

  // Marca el documento mientras se está en esta pantalla (el CSS de impresión oculta la app y muestra el resumen).
  useEffect(() => {
    document.documentElement.dataset.imprimirReporte = '1'
    return () => {
      delete document.documentElement.dataset.imprimirReporte
    }
  }, [])

  return (
    <Page title="Reportes y Estadísticas" back={back} hideAvatar wide>
      <FilaFiltros>
        <FilterChip<Rango>
          etiqueta="Rango"
          icono={<CalendarDays size={16} aria-hidden />}
          value={filtros.rango}
          onChange={(v) => set('rango', v)}
          opciones={RANGOS.map((x) => ({ value: x.value, label: x.label }))}
        />
        <FilterChip
          etiqueta="Zona"
          icono={<MapPin size={16} aria-hidden />}
          value={filtros.zona}
          onChange={(v) => set('zona', v)}
          opciones={[{ value: '', label: 'Todas' }, ...zonas.map((z) => ({ value: z, label: z }))]}
        />
        <FilterChip<'' | Riesgo>
          etiqueta="Riesgo"
          icono={<ShieldAlert size={16} aria-hidden />}
          value={filtros.riesgo}
          onChange={(v) => set('riesgo', v)}
          opciones={[
            { value: '', label: 'Todos' },
            { value: 'alto', label: 'Alto' },
            { value: 'medio', label: 'Medio' },
            { value: 'bajo', label: 'Bajo' },
          ]}
        />
        <FilterChip<'' | TipoNecesidad>
          etiqueta="Categoría"
          icono={<Tags size={16} aria-hidden />}
          value={filtros.categoria}
          onChange={(v) => set('categoria', v)}
          opciones={[{ value: '', label: 'Todas' }, ...(Object.keys(TIPO_NECESIDAD_TEXTO) as TipoNecesidad[]).map((t) => ({ value: t, label: TIPO_NECESIDAD_TEXTO[t] }))]}
        />
      </FilaFiltros>

      <div className={styles.kpis}>
        <Kpi etiqueta="Adultos Registrados" valor={r.adultosRegistrados} icono={<PersonStanding size={18} />}>
          {r.adultosNuevos === null ? (
            <span className={styles.subNeutro}>Total registrado</span>
          ) : (
            <span className={styles.subSube}>
              <TrendingUp size={14} aria-hidden />+{r.adultosNuevos} {rango.sufijo}
            </span>
          )}
        </Kpi>
        <Kpi etiqueta="Visitas Realizadas" valor={r.visitasRealizadas} icono={<BriefcaseMedical size={18} />}>
          <Variacion delta={r.visitasDelta} anterior={rango.anterior} />
        </Kpi>
        <Kpi etiqueta="Necesidades Atendidas" valor={r.necesidadesAtendidas} icono={<CircleCheck size={18} />}>
          <Variacion delta={r.necesidadesDelta} anterior={rango.anterior} />
        </Kpi>
        <Kpi etiqueta="Casos Prioritarios" valor={r.casosPrioritarios} icono={<TriangleAlert size={18} />} tono="peligro">
          {r.casosPrioritarios > 0 ? (
            <span className={styles.urgente}>
              <i aria-hidden /> Atención Urgente
            </span>
          ) : (
            <span className={styles.subNeutro}>Sin casos urgentes</span>
          )}
        </Kpi>
      </div>

      <div className={styles.graficos}>
        <div className={styles.colA}>
          <GraficoVisitas r={r} />
          <Riesgos r={r} />
        </div>
        <div className={styles.colB}>
          <Categorias r={r} />
          <ExportarPanel r={r} filtros={filtros} organizacion={orgNombre} />
        </div>
      </div>

      {/* Resumen ejecutivo: solo visible al imprimir / guardar como PDF (el resto de la app se oculta) */}
      {createPortal(<ResumenImpreso r={r} filtros={filtros} organizacion={orgNombre} />, document.body)}
    </Page>
  )
}

function ResumenImpreso({ r, filtros, organizacion }: { r: Reporte; filtros: FiltrosReporte; organizacion: string }) {
  return (
    <div className={styles.imprimir} aria-hidden>
      <h1>Reporte de gestión · CuidaRed</h1>
      <p>
        {organizacion} · Generado el {fechaLarga()}
      </p>
      <p className={styles.imprimirFiltros}>{describirFiltros(filtros).join(' · ')}</p>

      <h2>Resumen</h2>
      <table>
        <tbody>
          <tr>
            <th>Adultos registrados</th>
            <td>{r.adultosRegistrados}</td>
            <th>Visitas realizadas</th>
            <td>{r.visitasRealizadas}</td>
          </tr>
          <tr>
            <th>Necesidades atendidas</th>
            <td>{r.necesidadesAtendidas}</td>
            <th>Casos prioritarios</th>
            <td>{r.casosPrioritarios}</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.imprimirColumnas}>
        <div>
          <h2>Visitas por mes</h2>
          <table>
            <tbody>
              {r.visitasPorMes.map((m) => (
                <tr key={m.clave}>
                  <th>{m.etiqueta}</th>
                  <td>{m.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Necesidades por categoría</h2>
          <table>
            <tbody>
              {r.categorias.map((c) => (
                <tr key={c.tipo}>
                  <th>{c.etiqueta}</th>
                  <td>
                    {c.total} ({c.pct}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Adultos por nivel de riesgo</h2>
          <table>
            <tbody>
              {r.riesgo.map((x) => (
                <tr key={x.nivel}>
                  <th>{x.etiqueta}</th>
                  <td>
                    {x.total} ({x.pct}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2>Detalle de adultos</h2>
      <table className={styles.imprimirDetalle}>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Cédula</th>
            <th>Zona</th>
            <th>Riesgo</th>
            <th>Última visita</th>
            <th>Necesidades activas</th>
          </tr>
        </thead>
        <tbody>
          {r.adultos.map((a) => (
            <tr key={a.id}>
              <td>{a.nombre}</td>
              <td>{a.cedula}</td>
              <td>{a.zona}</td>
              <td>{RIESGO_TEXTO[a.riesgo]}</td>
              <td>{a.ultimaVisita ? fechaCorta(a.ultimaVisita) : 'Sin visitas'}</td>
              <td>{a.necesidadesActivas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
