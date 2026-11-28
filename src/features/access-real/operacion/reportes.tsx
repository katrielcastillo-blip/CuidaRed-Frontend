/*
 * reportes.tsx — Reportes estadísticos conectados (RF-08 · CU-12): cuatro tipos, rango de fechas y filtros del
 * contrato, indicadores, gráficos de Chart.js con su tabla de datos, detalle, exportación a CSV (del servidor), PDF y
 * Excel (en el navegador, tras registrar la exportación) y análisis avanzado del plan «reportes_avanzados».
 * Módulo: access-real (ID07).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Sin la funcionalidad `dashboard_metricas` no se consulta nada: se explica el bloqueo. El CSV lo entrega el servidor
 * (auditado); para PDF y Excel primero se registra la exportación y solo si el servidor la acepta se genera el archivo.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseMedical, ChartLine, FileDown, FileSpreadsheet, FileText, HandHelping, Lock, PersonStanding, RefreshCw, SearchX, TriangleAlert } from 'lucide-react'
import { Button, RiesgoBadge, SelectField, TextField } from '@/components/ui'
import { fechaHora } from '@/domain/dates'
import { PanelGrafico } from '@/features/gestion/components/reportes/PanelGrafico'
import type { ImagenGrafico } from '@/features/gestion/components/reportes/tipos'
import { useImagenesGraficos } from '@/features/gestion/components/reportes/useImagenesGraficos'
import { descargarBlob, type AnalisisAvanzado, type TablaReporte } from '@/features/gestion/lib/reportes-comun'
import { cn } from '@/lib/cn'
import {
  descargarCsv,
  filtrosDeRespuesta,
  registrarExportacion,
  RUTA_DE_TIPO,
  rutaAnalisisAvanzado,
  rutaReporte,
  type AnalisisAvanzadoApi,
  type ExportacionApi,
  type FiltrosReporte,
  type FormatoRegistrado,
  type OpcionesReporte,
  type ReporteApi,
  type TipoReporte,
} from '../api/reportes'
import { idRuta, useConexionReal, useDatos } from './controles'
import { EstadoConsulta } from './estado-consulta'
import { mensajeReporte } from './reportes-errores'
import {
  avanzadoSinVisitas,
  construirAvanzado,
  construirReporte,
  contextoDeExportacion,
  describirFiltros,
  errorRango,
  filtrosDeSeleccion,
  hayFiltros,
  hoyRD,
  incluyeFuncionalidad,
  nombreDeArchivo,
  opcionesUbicacion,
  RANGOS,
  reporteAvanzado,
  SELECCION_INICIAL,
  SIN_DATOS,
  TEXTO_RIESGO,
  TIPOS_REPORTE,
  tiposDisponibles,
  type Rango,
  type SeleccionFiltros,
} from './reportes-modelo'
import type { OperacionProps } from './visitas'

const ICONO_TIPO: Record<TipoReporte, typeof PersonStanding> = {
  adultos: PersonStanding,
  visitas: BriefcaseMedical,
  necesidades: HandHelping,
  casos_prioritarios: TriangleAlert,
}
const FILAS_POR_TRAMO = 100
/** La exportación quedó registrada, pero el navegador no pudo armar el archivo (el mensaje ya es para la persona). */
class FalloGeneracion extends Error {}
type Mensaje = { error: boolean; texto: string }
interface TipoNecesidad { tipo_necesidad_id: number; nombre: string }

/* ───────────── Piezas ───────────── */
/** Tabla con desplazamiento propio; muestra las filas por tramos para no pintar miles de filas de una vez. */
function TablaDatos({ tabla, etiqueta, raiz, id }: { tabla: TablaReporte; etiqueta: string; raiz?: string; id: string }) {
  const [visibles, setVisibles] = useState(FILAS_POR_TRAMO)
  const { columnas, filas } = tabla
  const mostradas = filas.slice(0, visibles)
  return <section className="grid grid-cols-1 min-w-0 gap-3" aria-labelledby={id}>
    <h3 id={id} className="text-lg font-bold">{tabla.titulo} <span className="text-sm font-normal text-muted">({filas.length.toLocaleString('es-DO')})</span></h3>
    {filas.length === 0 ? <p role="status" className="rounded-md border border-line-soft bg-surface p-4 text-sm text-ink-2">Sin filas para mostrar.</p>
      : <div className="relative overflow-x-auto rounded-md bg-surface shadow-1" tabIndex={0} role="region" aria-label={`${etiqueta}: desplázate horizontalmente si no ves todas las columnas`}>
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-2">
            <tr>{columnas.map((c) => <th key={c.etiqueta} scope="col" className={cn('whitespace-nowrap px-3 py-3', c.tipo === 'numero' && 'text-right')}>{c.etiqueta}</th>)}</tr>
          </thead>
          <tbody>
            {mostradas.map((fila) => <tr key={fila.id} className="border-t border-line-soft">
              {fila.celdas.map((valor, i) => {
                const columna = columnas[i]
                if (i === 0) {
                  return <th key={i} scope="row" className="min-w-40 px-3 py-1 text-left font-semibold">
                    {fila.adultoId && raiz
                      ? <Link to={`${raiz}/envejecientes?adulto=${idRuta(fila.adultoId)}`} className="inline-flex min-h-12 items-center text-navy hover:underline">{valor}</Link>
                      : valor}
                  </th>
                }
                return <td key={i} className={cn('px-3 py-2', columna?.tipo === 'numero' ? 'whitespace-nowrap text-right tabular-nums' : 'min-w-28')}>
                  {columna?.tipo === 'riesgo' && fila.riesgo ? <RiesgoBadge riesgo={fila.riesgo} />
                    : typeof valor === 'number' ? valor.toLocaleString('es-DO') : valor}
                </td>
              })}
            </tr>)}
          </tbody>
        </table>
      </div>}
    {filas.length > visibles && <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" onClick={() => setVisibles((n) => n + FILAS_POR_TRAMO)}>Mostrar {Math.min(FILAS_POR_TRAMO, filas.length - visibles)} filas más</Button>
      <span className="text-sm text-ink-2">Se muestran {visibles.toLocaleString('es-DO')} de {filas.length.toLocaleString('es-DO')}. El PDF y el Excel incluyen todas.</span>
    </div>}
    {tabla.nota && <p role="note" className="flex items-start gap-2 rounded-md bg-warning-100 p-3 text-sm text-ink"><TriangleAlert size={18} className="mt-0.5 flex-none text-warning-700" aria-hidden /><span>{tabla.nota}</span></p>}
  </section>
}

function Bloqueo({ titulo, texto, cuenta, raiz, id }: { titulo: string; texto: string; cuenta: OperacionProps['cuenta']; raiz: string; id: string }) {
  const prueba = cuenta.estado_suscripcion === 'prueba'
  return <section className="grid grid-cols-1 gap-3 rounded-md border border-dashed border-line bg-surface p-4" aria-labelledby={id} data-testid="bloqueo-plan">
    <div className="flex items-center gap-3">
      <span className="grid size-10 flex-none place-items-center rounded-full bg-warning-100 text-warning-700" aria-hidden><Lock size={20} /></span>
      <h2 id={id} className="font-semibold text-ink">{titulo}</h2>
    </div>
    <p className="text-sm text-ink-2 wrap-anywhere">{texto}{prueba ? ' Tu cuenta está en prueba gratuita y esta funcionalidad no forma parte de ella.' : ''}</p>
    {cuenta.permisos.includes('cuenta:suscripcion') && <div><Link to={`${raiz}/suscripcion`} className="inline-flex min-h-12 items-center font-semibold text-navy underline underline-offset-2">Ver la suscripción de la cuenta</Link></div>}
  </section>
}

/* ───────────── Análisis avanzado ───────────── */
function SeccionAvanzada({ base, token, cuenta, filtros, revision, enLinea, ocupado, ejecutar, nombresFiltro }: {
  base: string; token: string; cuenta: OperacionProps['cuenta']; revision: number; enLinea: boolean
  filtros: FiltrosReporte; ocupado: string | null
  ejecutar: (clave: string, tarea: () => Promise<string>) => void
  nombresFiltro: { municipio?: string }
}) {
  const consulta = useDatos<AnalisisAvanzadoApi>(rutaAnalisisAvanzado(base, filtros), token, revision)
  const datos = consulta.datos
  const analisis = useMemo<AnalisisAvanzado | undefined>(() => (datos ? construirAvanzado(datos) : undefined), [datos])
  const graficos = useMemo(() => (analisis && datos && !datos.vacio ? [analisis.zonas, analisis.tendencias].filter((a) => !a.vacio).map((a) => a.grafico) : []), [analisis, datos])
  const { asegurar } = useImagenesGraficos(graficos)
  const exportar = (formato: FormatoRegistrado) => ejecutar(`avanzado-${formato}`, async () => {
    if (!datos || !analisis) return ''
    const exportacion = await registrarExportacion(token, base, 'analisis_avanzado', formato, filtrosDeRespuesta(datos.filtros))
    const imagenes: Record<string, ImagenGrafico> = formato === 'pdf' ? await asegurar() : {}
    const contexto = contextoDeExportacion({ exportacion, reporte: reporteAvanzado(), filtros: describirFiltros(datos.filtros, null, nombresFiltro), tipoCuenta: cuenta.tipo, imagenes, avanzado: analisis, soloAvanzado: true })
    const archivo = nombreDeArchivo('analisis-avanzado', hoyRD(), formato)
    try {
      if (formato === 'pdf') await (await import('@/features/gestion/components/reportes/exportarPdf')).exportarPdf(contexto, archivo)
      else await (await import('@/features/gestion/components/reportes/exportarExcel')).exportarExcel(contexto, archivo)
    } catch {
      throw new FalloGeneracion(`El registro de la exportación se guardó, pero no se pudo generar el ${formato === 'pdf' ? 'PDF' : 'archivo de Excel'}. Intenta de nuevo.`)
    }
    return `Análisis avanzado descargado en formato ${formato === 'pdf' ? 'PDF' : 'Excel'}.`
  })
  const listo = !!datos && enLinea && ocupado === null
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-prose text-sm text-ink-2 wrap-anywhere">Comparativo por sector y por municipio, y tendencias mensuales de los adultos mayores que cumplen los filtros de ubicación y riesgo.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Exportar el análisis avanzado">
        <Button size="sm" variant="outline" icon={<FileText size={18} aria-hidden />} disabled={!listo} loading={ocupado === 'avanzado-pdf'} onClick={() => exportar('pdf')}>Análisis en PDF</Button>
        <Button size="sm" variant="outline" icon={<FileSpreadsheet size={18} aria-hidden />} disabled={!listo} loading={ocupado === 'avanzado-xlsx'} onClick={() => exportar('xlsx')}>Análisis en Excel</Button>
      </div>
    </div>
    <EstadoConsulta consulta={consulta} />
    {datos && analisis && (datos.vacio
      ? <p role="status" className="flex items-center gap-2 rounded-md bg-surface p-4 text-sm text-ink-2 shadow-1"><ChartLine size={18} className="text-muted" aria-hidden /> No hay datos para el análisis avanzado con los filtros seleccionados.</p>
      : <>
        {avanzadoSinVisitas(datos) && <p role="note" className="rounded-md bg-surface-2 p-3 text-sm text-ink-2" data-testid="aviso-sin-visitas">
          Las visitas no se muestran porque Visitas no está disponible para tu rol o para este tipo de cuenta.
        </p>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
          {!analisis.zonas.vacio && <PanelGrafico g={analisis.zonas.grafico} enLinea={enLinea} />}
          {!analisis.tendencias.vacio && <PanelGrafico g={analisis.tendencias.grafico} enLinea={enLinea} />}
        </div>
        {!analisis.zonas.vacio && <TablaDatos tabla={analisis.zonas.tabla} etiqueta="Comparativo por sector" id="tabla-sectores" />}
        {analisis.municipios && !analisis.municipios.vacio && <TablaDatos tabla={analisis.municipios.tabla} etiqueta="Comparativo por municipio" id="tabla-municipios" />}
        {!analisis.tendencias.vacio && <TablaDatos tabla={analisis.tendencias.tabla} etiqueta="Tendencias mensuales" id="tabla-tendencias" />}
      </>)}
  </>
}

/* ───────────── Pantalla ───────────── */
function ReportesActivos({ base, token, cuenta, planAvanzado }: OperacionProps & { planAvanzado: boolean }) {
  const raiz = `/operacion/${idRuta(cuenta.cuenta_id)}`
  const disponibles = tiposDisponibles(cuenta)
  const [elegido, setElegido] = useState<TipoReporte>(disponibles[0] ?? 'adultos')
  const tipo = disponibles.includes(elegido) ? elegido : (disponibles[0] ?? 'adultos')
  const [hoy] = useState(hoyRD)
  const [seleccion, setSeleccion] = useState<SeleccionFiltros>(SELECCION_INICIAL)
  const [revision, setRevision] = useState(0)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<Mensaje>()
  const enLinea = useConexionReal()
  const set = <K extends keyof SeleccionFiltros>(campo: K, valor: SeleccionFiltros[K]) => setSeleccion((anterior) => ({ ...anterior, [campo]: valor }))
  const errorFechas = errorRango(seleccion.rango, seleccion.desde, seleccion.hasta)
  const filtros = useMemo(() => filtrosDeSeleccion(seleccion, hoy), [seleccion, hoy])

  const consulta = useDatos<ReporteApi>(filtros && rutaReporte(base, tipo, filtros), token, revision)
  const ubicaciones = useDatos<OpcionesReporte>(`${base}/reportes/opciones`, token, revision)
  const categorias = useDatos<TipoNecesidad[]>(tipo === 'necesidades' ? '/catalogos/tipos-necesidad' : null, token)
  const opciones = opcionesUbicacion(ubicaciones.datos)

  const datos = consulta.datos
  const reporte = useMemo(() => (datos ? construirReporte(datos) : undefined), [datos])
  const graficos = useMemo(() => (reporte && !reporte.vacio ? reporte.graficos : []), [reporte])
  const { asegurar } = useImagenesGraficos(graficos)
  const nombresFiltro = {
    municipio: opciones.municipios.find((o) => o.value === datos?.filtros.municipio_cod)?.label,
    categoria: categorias.datos?.find((c) => c.tipo_necesidad_id === datos?.filtros.tipo_necesidad_id)?.nombre,
  }
  const filtrosTexto = datos ? describirFiltros(datos.filtros, datos.campo_fecha, nombresFiltro) : []

  const ejecutar = (clave: string, tarea: () => Promise<string>) => {
    if (ocupado !== null) return
    setOcupado(clave)
    setMensaje(undefined)
    void tarea().then(
      (texto) => { if (texto) setMensaje({ error: false, texto }) },
      (error: unknown) => setMensaje({ error: true, texto: error instanceof FalloGeneracion ? error.message : mensajeReporte(error, 'exportar') }),
    ).finally(() => setOcupado(null))
  }

  const descargar = () => ejecutar('csv', async () => {
    if (!datos) return ''
    const { blob, nombre } = await descargarCsv(token, base, tipo, filtrosDeRespuesta(datos.filtros))
    descargarBlob(nombre ?? nombreDeArchivo(RUTA_DE_TIPO[tipo], hoyRD(), 'csv'), blob)
    return 'Reporte descargado en formato CSV. La descarga quedó registrada en la auditoría.'
  })
  const exportar = (formato: FormatoRegistrado) => ejecutar(formato, async () => {
    if (!datos || !reporte) return ''
    // Primero se registra la exportación: si el servidor la rechaza (permiso, plan o cuenta vencida) no se genera nada.
    const exportacion: ExportacionApi = await registrarExportacion(token, base, tipo, formato, filtrosDeRespuesta(datos.filtros))
    const imagenes: Record<string, ImagenGrafico> = formato === 'pdf' ? await asegurar() : {}
    const contexto = contextoDeExportacion({ exportacion, reporte, filtros: filtrosTexto, tipoCuenta: cuenta.tipo, imagenes })
    const archivo = nombreDeArchivo(RUTA_DE_TIPO[tipo], hoyRD(), formato)
    try {
      if (formato === 'pdf') await (await import('@/features/gestion/components/reportes/exportarPdf')).exportarPdf(contexto, archivo)
      else await (await import('@/features/gestion/components/reportes/exportarExcel')).exportarExcel(contexto, archivo)
    } catch {
      throw new FalloGeneracion(`El registro de la exportación se guardó, pero no se pudo generar el ${formato === 'pdf' ? 'PDF' : 'archivo de Excel'}. Intenta de nuevo.`)
    }
    return `Reporte descargado en formato ${formato === 'pdf' ? 'PDF' : 'Excel'}.`
  })

  const listo = !!datos && enLinea && ocupado === null
  const hayCategoria = tipo === 'necesidades'
  return <section className="grid grid-cols-1 gap-5" aria-label="Reportes y estadísticas">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <p className="max-w-prose text-sm text-ink-2 wrap-anywhere">Consulta indicadores y gráficos de los adultos mayores de la cuenta, con filtros por período, ubicación y riesgo. Los reportes no incluyen cédula, teléfono ni dirección.</p>
      <Button variant="outline" size="sm" icon={<RefreshCw size={18} aria-hidden />} onClick={() => setRevision((n) => n + 1)}>Actualizar</Button>
    </div>

    <section className="grid grid-cols-1 gap-2" aria-labelledby="tipo-reporte">
      <h2 id="tipo-reporte" className="text-base font-semibold text-ink">Tipo de reporte</h2>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="radiogroup" aria-labelledby="tipo-reporte">
        {TIPOS_REPORTE.filter((t) => disponibles.includes(t.value)).map((t) => {
          const Icono = ICONO_TIPO[t.value]
          const activo = tipo === t.value
          return <button key={t.value} type="button" role="radio" aria-checked={activo} onClick={() => setElegido(t.value)}
            className={cn('flex min-h-14 items-center gap-2 rounded-sm border-2 px-3 py-2 text-left text-sm font-semibold leading-tight transition-colors',
              activo ? 'border-navy bg-navy text-white' : 'border-line-soft bg-surface text-ink hover:border-line')}>
            <Icono size={20} className="flex-none" aria-hidden />{t.label}
          </button>
        })}
      </div>
    </section>

    <section className="grid grid-cols-1 gap-3 rounded-md border border-line-soft bg-surface p-3 sm:p-4" aria-label="Filtros del reporte">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField label="Período" value={seleccion.rango} onChange={(event) => set('rango', event.currentTarget.value as Rango)} options={RANGOS} />
        <SelectField label="Municipio" value={seleccion.municipio} onChange={(event) => set('municipio', event.currentTarget.value)}
          options={[{ value: '', label: 'Todos' }, ...opciones.municipios]} />
        <SelectField label="Sector" value={seleccion.zona} onChange={(event) => set('zona', event.currentTarget.value)}
          options={[{ value: '', label: 'Todos' }, ...opciones.sectores]} />
        <SelectField label="Riesgo" value={seleccion.riesgo} onChange={(event) => set('riesgo', event.currentTarget.value as SeleccionFiltros['riesgo'])}
          options={[{ value: '', label: 'Todos' }, ...Object.entries(TEXTO_RIESGO).map(([value, label]) => ({ value, label }))]} />
        {hayCategoria && <SelectField label="Categoría de necesidad" value={seleccion.categoria} onChange={(event) => set('categoria', event.currentTarget.value)}
          options={[{ value: '', label: 'Todas' }, ...(categorias.datos ?? []).map((c) => ({ value: String(c.tipo_necesidad_id), label: c.nombre }))]} />}
      </div>
      {seleccion.rango === 'personalizado' && <div className="grid max-w-md grid-cols-2 gap-3">
        <TextField label="Desde" type="date" max={seleccion.hasta || hoy} value={seleccion.desde} onChange={(event) => set('desde', event.currentTarget.value)} />
        <TextField label="Hasta" type="date" min={seleccion.desde || undefined} max={hoy} value={seleccion.hasta} onChange={(event) => set('hasta', event.currentTarget.value)} error={errorFechas} />
      </div>}
      {ubicaciones.error && <EstadoConsulta consulta={ubicaciones} />}
      {errorFechas && <p role="status" className="text-sm text-ink-2">Corrige el período para consultar y exportar reportes.</p>}
      {tipo === 'visitas' && (seleccion.municipio || seleccion.zona || seleccion.riesgo) &&
        <p className="text-sm text-ink-2 wrap-anywhere">Las visitas institucionales sin expediente se incluyen al filtrar solo por período.</p>}
      {hayFiltros(seleccion) && <div><Button variant="ghost" size="sm" onClick={() => setSeleccion(SELECCION_INICIAL)}>Quitar filtros</Button></div>}
    </section>

    {filtros && <EstadoConsulta consulta={consulta} />}
    {datos && reporte && <section className="grid grid-cols-1 min-w-0 gap-5" aria-labelledby="titulo-reporte" aria-live="polite">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="min-w-0">
          <h2 id="titulo-reporte" className="text-xl font-bold text-navy">{reporte.titulo}</h2>
          <p className="text-sm text-ink-2 wrap-anywhere">{reporte.descripcion}</p>
          <p className="text-xs text-muted wrap-anywhere">{filtrosTexto.join(' · ')} · Datos generados el <time dateTime={datos.generado_en}>{fechaHora(datos.generado_en)}</time></p>
        </div>
        <div className="grid grid-cols-1 gap-2 xl:justify-items-end">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap [&_button]:whitespace-nowrap" role="group" aria-label="Exportar el reporte">
            <Button size="sm" variant="outline" icon={<FileDown size={18} aria-hidden />} disabled={!listo} loading={ocupado === 'csv'} onClick={descargar}>Descargar CSV</Button>
            <Button size="sm" variant="outline" icon={<FileText size={18} aria-hidden />} disabled={!listo} loading={ocupado === 'pdf'} onClick={() => exportar('pdf')}>Exportar PDF</Button>
            <Button size="sm" variant="outline" icon={<FileSpreadsheet size={18} aria-hidden />} disabled={!listo || !planAvanzado} loading={ocupado === 'xlsx'}
              aria-describedby={planAvanzado ? undefined : 'aviso-excel'} onClick={() => exportar('xlsx')}>Exportar Excel</Button>
          </div>
          {!enLinea && <p role="status" className="text-xs text-muted">Sin conexión: las exportaciones necesitan Internet para quedar registradas en la auditoría.</p>}
          {!planAvanzado && <p id="aviso-excel" role="note" className="flex max-w-md items-start gap-2 text-sm text-ink-2">
            <Lock size={16} className="mt-0.5 flex-none text-warning-700" aria-hidden /><span><b className="text-ink">Exportar a Excel:</b> no está incluido en el plan de tu cuenta.</span>
          </p>}
        </div>
      </div>
      {mensaje && <p role={mensaje.error ? 'alert' : 'status'} className={mensaje.error ? 'rounded-md bg-danger-100 p-3 text-danger-700' : 'rounded-md bg-success-100 p-3 text-success-700'}>{mensaje.texto}</p>}

      {reporte.vacio ? <div className="flex flex-col items-center gap-3 rounded-md bg-surface px-4 py-10 text-center shadow-1" role="status">
        <SearchX size={40} className="text-muted" aria-hidden />
        <p className="text-lg font-bold wrap-anywhere">{SIN_DATOS}</p>
        <p className="text-sm text-muted wrap-anywhere">Prueba con otro período o quita algún filtro.</p>
      </div> : <>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]" data-testid="indicadores-reporte">
          {reporte.kpis.map((kpi) => <article key={kpi.etiqueta} className="flex min-w-0 flex-col gap-1 rounded-md bg-surface p-4 shadow-1">
            <h3 className="text-sm font-normal leading-tight text-ink-2 wrap-anywhere">{kpi.etiqueta}</h3>
            <p className={cn('wrap-anywhere font-bold leading-tight', typeof kpi.valor === 'string' && kpi.valor.length > 6 ? 'text-xl' : 'text-[28px]', kpi.peligro ? 'text-danger' : 'text-ink')}>
              {typeof kpi.valor === 'number' ? kpi.valor.toLocaleString('es-DO') : kpi.valor}
            </p>
            {kpi.nota && <p className="text-xs text-muted wrap-anywhere">{kpi.nota}</p>}
          </article>)}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
          {reporte.graficos.map((g) => <PanelGrafico key={`${tipo}-${g.id}`} g={g} enLinea={enLinea} />)}
        </div>
        <TablaDatos key={`${tipo}-${datos.generado_en}`} tabla={reporte.tabla} etiqueta={reporte.tabla.titulo} raiz={raiz} id="tabla-reporte" />
      </>}
    </section>}

    {filtros && <section className="grid grid-cols-1 min-w-0 gap-4" aria-labelledby="titulo-avanzado" data-testid="analisis-avanzado">
      <h2 id="titulo-avanzado" className="text-xl font-bold text-navy">Análisis avanzado</h2>
      {planAvanzado
        ? <SeccionAvanzada base={base} token={token} cuenta={cuenta} filtros={filtros} revision={revision} enLinea={enLinea} ocupado={ocupado} ejecutar={ejecutar} nombresFiltro={nombresFiltro} />
        : <Bloqueo id="avanzado-bloqueado" titulo="Comparativo por sector y tendencias no incluidos en tu plan" cuenta={cuenta} raiz={raiz}
          texto="El análisis avanzado compara los sectores y los municipios lado a lado y muestra la evolución mensual de visitas, necesidades y alertas." />}
    </section>}
  </section>
}

export function Reportes(props: OperacionProps) {
  const { cuenta } = props
  const raiz = `/operacion/${idRuta(cuenta.cuenta_id)}`
  if (tiposDisponibles(cuenta).length === 0) {
    return <p role="alert" className="rounded-md border border-line-soft bg-surface p-4">Tu rol no tiene reportes disponibles en esta cuenta.</p>
  }
  // Sin `dashboard_metricas` no se llama a la API: se explica el bloqueo con el plan de la cuenta.
  if (!incluyeFuncionalidad(cuenta, 'dashboard_metricas')) {
    return <Bloqueo id="reportes-bloqueados" titulo="Los reportes estadísticos no están incluidos en tu plan" cuenta={cuenta} raiz={raiz}
      texto="Los reportes con indicadores, gráficos y exportaciones forman parte de los planes con métricas." />
  }
  return <ReportesActivos {...props} planAvanzado={incluyeFuncionalidad(cuenta, 'reportes_avanzados')} />
}
