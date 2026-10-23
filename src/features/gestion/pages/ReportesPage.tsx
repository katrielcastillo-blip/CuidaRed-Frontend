/*
 * ReportesPage.tsx — Reportes estadísticos básicos (RF-08 · CU-12): el usuario elige el tipo de reporte
 * (adultos mayores registrados, visitas realizadas, necesidades frecuentes, casos prioritarios), aplica
 * filtros opcionales de fecha (rango predefinido o desde/hasta), municipio, sector, riesgo y categoría, y consulta KPIs, gráficos
 * accesibles (barras con texto) y una tabla. Exporta a CSV y a una versión imprimible (PDF con
 * window.print()). Sin datos: "No existen datos disponibles para este reporte con los filtros seleccionados".
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { CalendarDays, FileSpreadsheet, HandHelping, Map as MapaIcono, MapPin, PersonStanding, Printer, ShieldAlert, Tags, TriangleAlert, BriefcaseMedical, SearchX } from 'lucide-react'
import { Button, RiesgoBadge, TextField, useToast } from '@/components/ui'
import { auditarExportacion } from '@/domain/api'
import { useSession, useUser } from '@/domain/auth'
import { fechaHora, fechaLarga, todayISO } from '@/domain/dates'
import { adultosVisibles } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import type { Catalogos, Riesgo, TipoNecesidad } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { FilaFiltros, FilterChip } from '../components/FilterChip'
import { TIPO_NECESIDAD_TEXTO } from '../lib/formato'
import { useVolver } from '../lib/navegacion'
import {
  descargarArchivo,
  describirFiltros,
  errorRango,
  FILTROS_INICIALES,
  generarReporte,
  RANGOS,
  reporteCSV,
  SIN_DATOS,
  TIPOS_REPORTE,
  type FiltrosReporte,
  type Grafico,
  type Rango,
  type Reporte,
  type TipoReporte,
} from '../lib/reportes'
import { municipiosEnUso, sectoresEnUso } from '../lib/ubicacion'

const ICONO_TIPO: Record<TipoReporte, typeof PersonStanding> = {
  adultos: PersonStanding,
  visitas: BriefcaseMedical,
  necesidades: HandHelping,
  prioritarios: TriangleAlert,
}

const COLOR_RIESGO: Record<Riesgo, string> = { alto: 'bg-riesgo-alto', medio: 'bg-riesgo-medio', bajo: 'bg-riesgo-bajo' }

/** Barras horizontales: cada fila muestra etiqueta, total y porcentaje en texto (accesible sin ver el color). */
function BarrasH({ g }: { g: Grafico }) {
  const max = Math.max(1, ...g.barras.map((b) => b.valor))
  if (g.barras.every((b) => b.valor === 0)) return <p className="text-sm text-muted">Sin registros para mostrar.</p>
  return (
    <ul className="flex flex-col gap-3">
      {g.barras.map((b) => (
        <li key={b.etiqueta} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 min-w-0 font-semibold text-ink">
              {b.riesgo ? <RiesgoBadge riesgo={b.riesgo} /> : <span className="wrap-anywhere">{b.etiqueta}</span>}
            </span>
            <span className="flex-none text-ink-2">
              <b className="text-ink">{b.valor}</b> {b.valor === 1 ? g.unidad[0] : g.unidad[1]} · {b.pct}%
            </span>
          </div>
          <div className="h-3 rounded-pill bg-surface-2 overflow-hidden" aria-hidden>
            <span className={cn('block h-full rounded-pill', b.riesgo ? COLOR_RIESGO[b.riesgo] : 'bg-navy')} style={{ width: `${(b.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Columnas por mes con el valor escrito encima de cada barra. */
function BarrasV({ g }: { g: Grafico }) {
  const max = Math.max(1, ...g.barras.map((b) => b.valor))
  return (
    <div className="flex flex-col gap-1.5">
      <ul
        className="grid gap-1 h-44 border-b border-line-soft bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(25%-1px),#e3e8f0_calc(25%-1px),#e3e8f0_25%)]"
        style={{ gridTemplateColumns: `repeat(${g.barras.length}, minmax(0, 1fr))` }}
      >
        {g.barras.map((b, i) => {
          const actual = i === g.barras.length - 1
          const p = (b.valor / max) * 82
          return (
            <li key={b.etiqueta + i} className="relative flex items-end justify-center h-full">
              <span className="sr-only">
                {b.etiqueta}: {b.valor} {b.valor === 1 ? g.unidad[0] : g.unidad[1]}
              </span>
              <span aria-hidden className={cn('absolute left-1/2 -translate-x-1/2 text-xs', actual ? 'font-bold text-navy' : 'text-ink-2')} style={{ bottom: `calc(${p}% + 4px)` }}>
                {b.valor}
              </span>
              <span aria-hidden className={cn('block w-[min(34px,72%)] rounded-t-[5px]', actual ? 'bg-navy' : 'bg-blue')} style={{ height: `${b.valor > 0 ? Math.max(p, 3) : 0}%` }} />
            </li>
          )
        })}
      </ul>
      <div className="grid gap-1 text-center text-[11px] text-muted" style={{ gridTemplateColumns: `repeat(${g.barras.length}, minmax(0, 1fr))` }} aria-hidden>
        {g.barras.map((b, i) => (
          <span key={b.etiqueta + i} className={cn('truncate', i === g.barras.length - 1 && 'font-bold text-navy')}>
            {b.etiqueta}
          </span>
        ))}
      </div>
    </div>
  )
}

function PanelGrafico({ g }: { g: Grafico }) {
  return (
    <figure className="flex flex-col gap-4 min-w-0 m-0 p-4 rounded-md bg-surface shadow-1">
      <figcaption>
        <h3 className="text-lg font-bold text-ink">{g.titulo}</h3>
        {g.descripcion && <p className="text-sm text-muted">{g.descripcion}</p>}
      </figcaption>
      {g.forma === 'v' ? <BarrasV g={g} /> : <BarrasH g={g} />}
    </figure>
  )
}

function TablaReporte({ r, base }: { r: Reporte; base: string }) {
  const { columnas, filas, titulo } = r.tabla
  return (
    <section className="flex flex-col gap-3 min-w-0" aria-labelledby="tabla-reporte">
      <h3 id="tabla-reporte" className="text-lg font-bold">
        {titulo} <span className="text-sm font-normal text-muted">({filas.length})</span>
      </h3>
      <div className="relative overflow-x-auto rounded-md bg-surface shadow-1" tabIndex={0} aria-label={`${titulo}: desplázate horizontalmente si no ves todas las columnas`}>
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-2">
            <tr>
              {columnas.map((c) => (
                <th key={c.etiqueta} scope="col" className={cn('px-3 py-3 whitespace-nowrap', c.tipo === 'numero' && 'text-right')}>
                  {c.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-line-soft">
                {f.celdas.map((v, i) => {
                  const c = columnas[i]!
                  if (i === 0 && f.adultoId && r.tipo !== 'visitas')
                    return (
                      <th key={i} scope="row" className="px-3 py-1 text-left font-semibold whitespace-nowrap">
                        <Link to={`${base}/adultos/${f.adultoId}`} className="inline-flex items-center min-h-12 text-navy hover:underline">
                          {v}
                        </Link>
                      </th>
                    )
                  return (
                    <td key={i} className={cn('px-3 py-2 whitespace-nowrap', c.tipo === 'numero' && 'text-right tabular-nums', i === 0 && 'font-semibold')}>
                      {c.tipo === 'riesgo' && f.riesgo ? <RiesgoBadge riesgo={f.riesgo} /> : v}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Hoja imprimible (PDF): solo visible al imprimir; el resto de la app se oculta con print:hidden. */
function HojaImpresa({ r, filtros, cat, organizacion }: { r: Reporte; filtros: FiltrosReporte; cat: Pick<Catalogos, 'municipios'>; organizacion: string }) {
  return (
    <div className="hidden print:block p-6 text-[12px] text-black bg-white" aria-hidden>
      <h1 className="text-xl font-bold">CuidaRed · {r.titulo}</h1>
      <p>
        {organizacion} · Generado el {fechaLarga()} · {fechaHora(new Date().toISOString())}
      </p>
      <p className="mt-1 text-[11px]">{describirFiltros(filtros, cat).join(' · ')}</p>
      {r.vacio ? (
        <p className="mt-4 font-semibold">{SIN_DATOS}</p>
      ) : (
        <>
          <h2 className="mt-4 mb-1 text-sm font-bold">Indicadores</h2>
          <table className="w-full border-collapse [&_td]:border [&_th]:border [&_td]:border-gray-400 [&_th]:border-gray-400 [&_td]:px-2 [&_th]:px-2 [&_td]:py-1 [&_th]:py-1">
            <tbody>
              {r.kpis.map((k) => (
                <tr key={k.etiqueta}>
                  <th className="text-left">{k.etiqueta}</th>
                  <td>
                    {k.valor} {k.nota ? `(${k.nota})` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-4">
            {r.graficos.map((g) => (
              <div key={g.id} className="break-inside-avoid">
                <h2 className="mt-4 mb-1 text-sm font-bold">{g.titulo}</h2>
                <table className="w-full border-collapse [&_td]:border [&_th]:border [&_td]:border-gray-400 [&_th]:border-gray-400 [&_td]:px-2 [&_th]:px-2 [&_td]:py-1 [&_th]:py-1">
                  <tbody>
                    {g.barras.map((b) => (
                      <tr key={b.etiqueta}>
                        <th className="text-left">{b.etiqueta}</th>
                        <td>
                          {b.valor} ({b.pct}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <h2 className="mt-4 mb-1 text-sm font-bold">{r.tabla.titulo}</h2>
          <table className="w-full border-collapse [&_td]:border [&_th]:border [&_td]:border-gray-400 [&_th]:border-gray-400 [&_td]:px-2 [&_th]:px-2 [&_td]:py-1 [&_th]:py-1">
            <thead>
              <tr>
                {r.tabla.columnas.map((c) => (
                  <th key={c.etiqueta} className="text-left">
                    {c.etiqueta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.tabla.filas.map((f) => (
                <tr key={f.id} className="break-inside-avoid">
                  {f.celdas.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="mt-6 text-[10px]">© 2026 Equipo CuidaRed – INTEC. Documento de uso interno: contiene datos personales protegidos por la Ley 172-13.</p>
    </div>
  )
}

export default function ReportesPage() {
  const { base } = useShell()
  const user = useUser()
  const { org } = useSession()
  const toast = useToast()
  const { back } = useVolver(`${base}/mas`)
  const adultos = useDB((s) => s.adultos)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const alertas = useDB((s) => s.alertas)
  const usuarios = useDB((s) => s.usuarios)
  const vinculos = useDB((s) => s.vinculos)
  const catalogos = useDB((s) => s.catalogos)
  const [filtros, setFiltros] = useState<FiltrosReporte>(FILTROS_INICIALES)
  const set = <K extends keyof FiltrosReporte>(k: K, v: FiltrosReporte[K]) => setFiltros((f) => ({ ...f, [k]: v }))

  const visibles = useMemo(() => adultosVisibles(user, adultos), [user, adultos])
  const municipios = useMemo(() => municipiosEnUso(catalogos, visibles), [catalogos, visibles])
  const sectores = useMemo(() => sectoresEnUso(visibles, filtros.municipio || undefined), [visibles, filtros.municipio])
  const errorFechas = errorRango(filtros)
  // Si el rango personalizado es incoherente, se mantiene el último reporte válido (sin filtrar por fecha).
  const efectivos = useMemo(() => (errorFechas ? { ...filtros, desde: '', hasta: '' } : filtros), [errorFechas, filtros])
  const r = useMemo(
    () => generarReporte({ visitas, necesidades, alertas, usuarios, vinculos, catalogos }, visibles, efectivos),
    [visitas, necesidades, alertas, usuarios, vinculos, catalogos, visibles, efectivos],
  )
  const orgNombre = org?.nombre ?? 'CuidaRed'
  const generado = useMemo(() => (r ? new Date().toISOString() : ''), [r])

  // Al imprimir solo se ve la hoja del reporte: se oculta la app mientras esta pantalla está abierta.
  useEffect(() => {
    const root = document.getElementById('root')
    root?.classList.add('print:hidden')
    return () => root?.classList.remove('print:hidden')
  }, [])

  const imprimir = () => {
    const titulo = document.title
    document.title = `Reporte CuidaRed - ${r.titulo} - ${todayISO()}`
    auditarExportacion(user, `Reporte "${r.titulo}" (impresión/PDF)`)
    window.print()
    document.title = titulo
  }
  const exportarCSV = () => {
    descargarArchivo(`reporte-${filtros.tipo}-${todayISO()}.csv`, reporteCSV(r, efectivos, catalogos, orgNombre))
    auditarExportacion(user, `Reporte "${r.titulo}" (CSV)`)
    toast('Reporte descargado en formato CSV')
  }

  return (
    <Page title="Reportes y estadísticas" back={back} hideAvatar wide>
      {/* 1 · Tipo de reporte */}
      <section className="flex flex-col gap-2" aria-labelledby="tipo-reporte">
        <h2 id="tipo-reporte" className="text-base font-semibold text-ink">
          Tipo de reporte
        </h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="radiogroup" aria-labelledby="tipo-reporte">
          {TIPOS_REPORTE.map((t) => {
            const Icono = ICONO_TIPO[t.value]
            const activo = filtros.tipo === t.value
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => set('tipo', t.value)}
                className={cn(
                  'flex items-center gap-2 min-h-14 px-3 py-2 rounded-sm border-2 text-left text-sm font-semibold leading-tight transition-colors',
                  activo ? 'border-navy bg-navy text-white' : 'border-line-soft bg-surface text-ink hover:border-line',
                )}
              >
                <Icono size={20} className="flex-none" aria-hidden />
                {t.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* 2 · Filtros opcionales */}
      <section className="flex flex-col gap-3 min-w-0" aria-label="Filtros del reporte">
        <FilaFiltros>
          <FilterChip<Rango>
            etiqueta="Período"
            icono={<CalendarDays size={16} aria-hidden />}
            value={filtros.rango}
            onChange={(v) => set('rango', v)}
            opciones={RANGOS.map((x) => ({ value: x.value, label: x.label }))}
          />
          <FilterChip
            etiqueta="Municipio"
            icono={<MapaIcono size={16} aria-hidden />}
            value={filtros.municipio}
            onChange={(v) => setFiltros((f) => ({ ...f, municipio: v, sector: '' }))}
            opciones={[{ value: '', label: 'Todos' }, ...municipios]}
          />
          <FilterChip
            etiqueta="Sector"
            icono={<MapPin size={16} aria-hidden />}
            value={filtros.sector}
            onChange={(v) => set('sector', v)}
            opciones={[{ value: '', label: 'Todos' }, ...sectores.map((z) => ({ value: z, label: z }))]}
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
          {filtros.tipo === 'necesidades' && (
            <FilterChip<'' | TipoNecesidad>
              etiqueta="Categoría"
              icono={<Tags size={16} aria-hidden />}
              value={filtros.categoria}
              onChange={(v) => set('categoria', v)}
              opciones={[{ value: '', label: 'Todas' }, ...(Object.keys(TIPO_NECESIDAD_TEXTO) as TipoNecesidad[]).map((t) => ({ value: t, label: TIPO_NECESIDAD_TEXTO[t] }))]}
            />
          )}
          {(filtros.rango !== 'todo' || filtros.municipio || filtros.sector || filtros.riesgo || filtros.categoria) && (
            <button type="button" className="min-h-12 px-2 text-sm font-semibold text-navy underline underline-offset-2" onClick={() => setFiltros((f) => ({ ...FILTROS_INICIALES, tipo: f.tipo }))}>
              Quitar filtros
            </button>
          )}
        </FilaFiltros>
        {filtros.rango === 'personalizado' && (
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <TextField label="Desde" type="date" max={filtros.hasta || todayISO()} value={filtros.desde} onChange={(e) => set('desde', e.target.value)} />
            <TextField label="Hasta" type="date" min={filtros.desde || undefined} max={todayISO()} value={filtros.hasta} onChange={(e) => set('hasta', e.target.value)} error={errorFechas} />
          </div>
        )}
      </section>

      {/* 3 · Reporte */}
      <section className="flex flex-col gap-5 min-w-0" aria-labelledby="titulo-reporte" aria-live="polite">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="titulo-reporte" className="text-xl font-bold text-navy">
              {r.titulo}
            </h2>
            <p className="text-sm text-ink-2">{r.descripcion}</p>
            <p className="text-xs text-muted">
              {describirFiltros(efectivos, catalogos).join(' · ')} · Datos actualizados: {fechaHora(generado)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-none [&_button]:whitespace-nowrap">
            <Button size="sm" variant="outline" icon={<FileSpreadsheet size={18} aria-hidden />} onClick={exportarCSV} disabled={r.vacio}>
              Exportar CSV
            </Button>
            <Button size="sm" variant="outline" icon={<Printer size={18} aria-hidden />} onClick={imprimir} disabled={r.vacio}>
              Imprimir / PDF
            </Button>
          </div>
        </div>

        {r.vacio ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center rounded-md bg-surface shadow-1" role="status">
            <SearchX size={40} className="text-muted" aria-hidden />
            <p className="text-lg font-bold">{SIN_DATOS}</p>
            <p className="text-sm text-muted">Prueba con otro período o quita algún filtro.</p>
          </div>
        ) : (
          <>
            <div className={cn('grid grid-cols-2 gap-3', r.kpis.length === 6 ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]')}>
              {r.kpis.map((k) => (
                <article key={k.etiqueta} className="flex flex-col gap-1 min-w-0 p-4 rounded-md bg-surface shadow-1">
                  <h3 className="text-sm font-normal leading-tight text-ink-2">{k.etiqueta}</h3>
                  <p className={cn('font-bold leading-tight break-words', typeof k.valor === 'string' && k.valor.length > 6 ? 'text-xl' : 'text-[28px]', k.peligro ? 'text-danger' : 'text-ink')}>
                    {typeof k.valor === 'number' ? k.valor.toLocaleString('es-DO') : k.valor}
                  </p>
                  {k.nota && <p className="text-xs text-muted">{k.nota}</p>}
                </article>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              {r.graficos.map((g) => (
                <PanelGrafico key={g.id} g={g} />
              ))}
            </div>
            <TablaReporte r={r} base={base} />
          </>
        )}
      </section>

      {createPortal(<HojaImpresa r={r} filtros={efectivos} cat={catalogos} organizacion={orgNombre} />, document.body)}
    </Page>
  )
}
