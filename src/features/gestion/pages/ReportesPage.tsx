/*
 * ReportesPage.tsx — Reportes y estadísticas (RF-08 · CU-12): el usuario elige el tipo de reporte (adultos mayores
 * registrados, visitas realizadas, necesidades frecuentes, casos prioritarios), aplica filtros de fecha (rango
 * predefinido o desde/hasta), municipio, sector, riesgo y categoría de necesidad, y consulta indicadores, gráficos
 * de Chart.js (cada uno con aria-label y tabla de datos) y una tabla de detalle. Exporta a CSV, PDF (jsPDF) e imprime
 * (window.print()); con el plan «reportes_avanzados» también exporta a Excel y muestra el comparativo por zona y las
 * tendencias; si el plan no los incluye, lo explica en línea. Cada exportación queda en auditoría.
 * Sin datos: "No existen datos disponibles para este reporte con los filtros seleccionados".
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BriefcaseMedical, CalendarDays, FileDown, FileSpreadsheet, FileText, HandHelping, Map as MapaIcono, MapPin, PersonStanding, Printer, SearchX, ShieldAlert, Tags, TriangleAlert } from 'lucide-react'
import { Button, RiesgoBadge, TextField, useToast } from '@/components/ui'
import { auditarExportacion } from '@/domain/api'
import { nombreCompleto, ROL_LABEL, useUser } from '@/domain/auth'
import { fechaHora, todayISO } from '@/domain/dates'
import { adultosVisibles } from '@/domain/permisos'
import { TIPO_CUENTA_LABEL } from '@/domain/planes'
import { useDB } from '@/domain/store'
import type { Riesgo, TipoNecesidad } from '@/domain/types'
import { useFuncionalidad, usePlanCuenta } from '@/domain/usePlan'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { FilaFiltros, FilterChip } from '../components/FilterChip'
import { AvisoPlan } from '../components/reportes/AvisoPlan'
import { HojaImpresa } from '../components/reportes/HojaImpresa'
import { PanelGrafico } from '../components/reportes/PanelGrafico'
import { SeccionAvanzada } from '../components/reportes/SeccionAvanzada'
import type { ContextoExportacion, ImagenGrafico } from '../components/reportes/tipos'
import { useAvisoPlan } from '../components/reportes/useAvisoPlan'
import { useActualizadoEn } from '../components/reportes/useActualizadoEn'
import { useImagenesGraficos } from '../components/reportes/useImagenesGraficos'
import { TIPO_NECESIDAD_TEXTO } from '../lib/formato'
import { useVolver } from '../lib/navegacion'
import {
  analisisAvanzado,
  descargarArchivo,
  describirFiltros,
  errorRango,
  FILTROS_INICIALES,
  generarReporte,
  graficosDelReporte,
  hayFiltrosReporte,
  RANGOS,
  reporteCSV,
  SIN_DATOS,
  TIPOS_REPORTE,
  type FiltrosReporte,
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

/** Deja que React pinte (imágenes de los gráficos en la hoja) antes de abrir el diálogo de impresión. */
const siguienteCuadro = () => new Promise<void>((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok())))

type Exportacion = 'pdf' | 'excel' | 'imprimir'

export default function ReportesPage() {
  const { base } = useShell()
  const user = useUser()
  const { org, plan, enPrueba, tipo: tipoCuenta } = usePlanCuenta()
  const incluyeAvanzados = useFuncionalidad('reportes_avanzados')
  const avisoPlan = useAvisoPlan('reportes_avanzados')
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
  const [ocupado, setOcupado] = useState<Exportacion | null>(null)
  const set = <K extends keyof FiltrosReporte>(k: K, v: FiltrosReporte[K]) => setFiltros((f) => ({ ...f, [k]: v }))

  // Solo los adultos de la cuenta activa que el usuario puede consultar (rol + alcance).
  const visibles = useMemo(() => adultosVisibles(user, adultos), [user, adultos])
  const municipios = useMemo(() => municipiosEnUso(catalogos, visibles), [catalogos, visibles])
  const sectores = useMemo(() => sectoresEnUso(visibles, filtros.municipio || undefined), [visibles, filtros.municipio])
  const errorFechas = errorRango(filtros)
  // Si el rango personalizado es incoherente, se mantiene el último reporte válido (sin filtrar por fecha).
  const efectivos = useMemo(() => (errorFechas ? { ...filtros, desde: '', hasta: '' } : filtros), [errorFechas, filtros])
  const datos = useMemo(() => ({ visitas, necesidades, alertas, usuarios, vinculos, catalogos }), [visitas, necesidades, alertas, usuarios, vinculos, catalogos])
  const r = useMemo(() => generarReporte(datos, visibles, efectivos), [datos, visibles, efectivos])
  const avanzado = useMemo(() => analisisAvanzado(datos, visibles, efectivos), [datos, visibles, efectivos])
  // Los extras del plan «reportes_avanzados» entran en pantalla, PDF, Excel e impresión solo si el plan los incluye.
  const avanzadoIncluido = incluyeAvanzados ? avanzado : null
  const graficos = useMemo(() => graficosDelReporte(r, avanzadoIncluido), [r, avanzadoIncluido])
  const { imagenes, asegurar } = useImagenesGraficos(graficos)

  const orgNombre = org?.nombre ?? 'CuidaRed'
  const generado = useActualizadoEn(r)
  const filtrosTexto = useMemo(() => describirFiltros(efectivos, catalogos), [efectivos, catalogos])
  const cuenta = `${orgNombre} · Cuenta ${TIPO_CUENTA_LABEL[tipoCuenta]} · ${plan ? `Plan ${plan.nombre}` : enPrueba ? 'Prueba gratuita' : 'Sin plan'}`
  const contexto = (imgs: Record<string, ImagenGrafico>, cuando: Date): ContextoExportacion => ({
    reporte: r,
    filtros: filtrosTexto,
    cuenta,
    generadoPor: `${nombreCompleto(user)} (${ROL_LABEL[user.rol]})`,
    generado: cuando,
    avanzado: avanzadoIncluido,
    avisoAvanzado: avisoPlan.texto,
    imagenes: imgs,
  })

  // Al imprimir solo se ve la hoja del reporte: se oculta la app mientras esta pantalla está abierta.
  useEffect(() => {
    const root = document.getElementById('root')
    root?.classList.add('print:hidden')
    return () => root?.classList.remove('print:hidden')
  }, [])

  const hoy = todayISO()
  const imprimir = async () => {
    setOcupado('imprimir')
    try {
      await asegurar()
      await siguienteCuadro()
      const titulo = document.title
      document.title = `Reporte CuidaRed - ${r.titulo} - ${hoy}`
      auditarExportacion(user, `Reporte "${r.titulo}" (impresión)`)
      window.print()
      document.title = titulo
    } finally {
      setOcupado(null)
    }
  }
  const exportarCSV = () => {
    descargarArchivo(`reporte-${filtros.tipo}-${hoy}.csv`, reporteCSV(r, efectivos, catalogos, orgNombre, new Date(), avanzadoIncluido))
    auditarExportacion(user, `Reporte "${r.titulo}" (CSV)`)
    toast('Reporte descargado en formato CSV')
  }
  const exportarPDF = async () => {
    setOcupado('pdf')
    try {
      const imgs = await asegurar()
      const { exportarPdf } = await import('../components/reportes/exportarPdf')
      await exportarPdf(contexto(imgs, new Date()), `reporte-${filtros.tipo}-${hoy}.pdf`)
      auditarExportacion(user, `Reporte "${r.titulo}" (PDF)`)
      toast('Reporte descargado en formato PDF')
    } catch {
      toast('No se pudo generar el PDF. Intenta de nuevo.', 'error')
    } finally {
      setOcupado(null)
    }
  }
  const exportarExcel = async () => {
    if (!incluyeAvanzados) return
    setOcupado('excel')
    try {
      const { exportarExcel: generarExcel } = await import('../components/reportes/exportarExcel')
      await generarExcel(contexto({}, new Date()), `reporte-${filtros.tipo}-${hoy}.xlsx`)
      auditarExportacion(user, `Reporte "${r.titulo}" (Excel)`)
      toast('Reporte descargado en formato Excel')
    } catch {
      toast('No se pudo generar el archivo de Excel. Intenta de nuevo.', 'error')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Page title="Reportes y estadísticas" back={back} hideAvatar wide>
      {/* 1 · Tipo de reporte */}
      <section className="flex flex-col gap-2 no-print" aria-labelledby="tipo-reporte">
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
      <section className="flex flex-col gap-3 min-w-0 no-print" aria-label="Filtros del reporte">
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
          {hayFiltrosReporte(filtros) && (
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
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 id="titulo-reporte" className="text-xl font-bold text-navy">
              {r.titulo}
            </h2>
            <p className="text-sm text-ink-2">{r.descripcion}</p>
            <p className="text-xs text-muted">
              {filtrosTexto.join(' · ')} · Datos actualizados: {fechaHora(generado.toISOString())}
            </p>
          </div>
          <div className="flex flex-col gap-2 no-print xl:items-end">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&_button]:whitespace-nowrap" role="group" aria-label="Exportar el reporte">
              <Button size="sm" variant="outline" icon={<FileDown size={18} aria-hidden />} onClick={exportarCSV} disabled={r.vacio}>
                Exportar CSV
              </Button>
              <Button size="sm" variant="outline" icon={<FileText size={18} aria-hidden />} onClick={exportarPDF} disabled={r.vacio} loading={ocupado === 'pdf'}>
                Exportar PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<FileSpreadsheet size={18} aria-hidden />}
                onClick={exportarExcel}
                disabled={r.vacio || !incluyeAvanzados}
                loading={ocupado === 'excel'}
                aria-describedby={incluyeAvanzados ? undefined : 'aviso-plan-excel'}
              >
                Exportar Excel
              </Button>
              <Button size="sm" variant="outline" icon={<Printer size={18} aria-hidden />} onClick={imprimir} disabled={r.vacio} loading={ocupado === 'imprimir'}>
                Imprimir
              </Button>
            </div>
            {!incluyeAvanzados && <AvisoPlan funcionalidad="reportes_avanzados" que="Exportar a Excel" id="aviso-plan-excel" className="max-w-md" />}
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
                <PanelGrafico key={`${r.tipo}-${g.id}`} g={g} />
              ))}
            </div>
            <TablaReporte r={r} base={base} />
          </>
        )}
      </section>

      {/* 4 · Análisis avanzado (plan «reportes_avanzados») */}
      <SeccionAvanzada incluido={incluyeAvanzados} analisis={avanzado} sinDatos={r.vacio} />

      {createPortal(<HojaImpresa ctx={contexto(imagenes, generado)} />, document.body)}
    </Page>
  )
}
