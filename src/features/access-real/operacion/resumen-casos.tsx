/*
 * resumen-casos.tsx — Resumen de casos conectado: indicadores de la cuenta y lista de casos activos con prioridad,
 * estado de atención, filtros, orden y paginación del servidor (CR-162).
 * Módulo: access-real (ID07, RF-07 · CU-11).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownUp, RefreshCw } from 'lucide-react'
import { Badge, Button, Card, EmptyState, HelpTip, RiesgoBadge, SearchInput, SelectField } from '@/components/ui'
import { fechaCorta } from '@/domain/dates'
import type { CasoResumen, IndicadoresResumen, OpcionesReporte } from '../api/reportes'
import { ROL_TEXTO } from '../cuentas-datos'
import { idRuta, Paginador, useDatos, usePagina } from './controles'
import { EstadoConsulta } from './estado-consulta'
import { opcionesUbicacion, textoRiesgo } from './reportes-modelo'
import {
  BUSQUEDA_MAX,
  consultaResumen,
  CRITERIOS_ORDEN,
  ESTADO_ATENCION_TEXTO,
  ESTADO_ATENCION_TONO,
  ESTADOS_ATENCION,
  FILTROS_RESUMEN_INICIALES,
  hayFiltrosResumen,
  PRIORIDAD_TEXTO,
  PRIORIDAD_TONO,
  sentidoDeOrden,
  terminoDeBusqueda,
  textoMotivo,
  textoSeguimiento,
  type CriterioOrden,
  type FiltrosResumen,
} from './resumen-datos'
import type { OperacionProps } from './visitas'

/** Valor que se actualiza `ms` milisegundos después de que deja de cambiar (la búsqueda no consulta con cada letra). */
function useRetardado(valor: string, ms: number) {
  const [retardado, setRetardado] = useState(valor)
  useEffect(() => {
    const temporizador = window.setTimeout(() => setRetardado(valor), ms)
    return () => window.clearTimeout(temporizador)
  }, [valor, ms])
  return retardado
}

const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-DO')} ${n === 1 ? uno : varios}`

function Indicador({ etiqueta, valor, peligro, nota }: { etiqueta: string; valor: number; peligro?: boolean; nota?: string }) {
  return <div className="flex min-w-0 flex-col justify-between gap-1 rounded-md border border-line-soft bg-surface p-3">
    <span className="text-xs font-semibold leading-tight text-ink-2">{etiqueta}</span>
    <span className={peligro && valor > 0 ? 'text-3xl leading-none font-bold text-danger' : 'text-3xl leading-none font-bold text-ink'}>{valor.toLocaleString('es-DO')}</span>
    {nota && <span className="text-xs text-muted">{nota}</span>}
  </div>
}

function Indicadores({ datos }: { datos: IndicadoresResumen }) {
  const alertas = datos.alertas_abiertas
  return <section className="grid grid-cols-1 gap-3" aria-labelledby="indicadores-resumen">
    <div>
      <h2 id="indicadores-resumen" className="text-lg font-semibold text-ink">Indicadores de la cuenta</h2>
      <p className="text-sm text-ink-2 wrap-anywhere">Cubren todos los casos activos al {fechaCorta(datos.fecha_calculo)}; no cambian con los filtros de la lista.</p>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Indicador etiqueta="Casos activos" valor={datos.casos_activos} />
      <Indicador etiqueta="Prioridad alta" valor={datos.por_prioridad.alta} peligro />
      <Indicador etiqueta="Prioridad media" valor={datos.por_prioridad.media} />
      <Indicador etiqueta="Prioridad baja" valor={datos.por_prioridad.baja} />
      {datos.umbral_dias_sin_visita !== null && <Indicador etiqueta={`Más de ${datos.umbral_dias_sin_visita} días sin visita`} valor={datos.seguimiento_vencido} peligro />}
      <Indicador etiqueta="Sin personal asignado" valor={datos.sin_personal_asignado} peligro />
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card tone="info" className="grid grid-cols-1 gap-1" data-testid="indicador-adultos-prioritarios">
        <span className="text-sm font-semibold text-ink-2">Adultos prioritarios</span>
        <strong className="text-3xl leading-none text-danger">{datos.adultos_prioritarios.toLocaleString('es-DO')}</strong>
        <span className="text-sm text-ink-2">Personas con al menos una alerta prioritaria abierta (riesgo alto, medicamentos pendientes o necesidad prioritaria).</span>
      </Card>
      <Card tone="info" className="grid grid-cols-1 gap-1" data-testid="indicador-alertas-abiertas">
        <span className="text-sm font-semibold text-ink-2">Alertas abiertas</span>
        <strong className="text-3xl leading-none text-ink">{alertas.toLocaleString('es-DO')}</strong>
        <span className="text-sm text-ink-2">
          Se cuentan una por una: dos alertas de la misma persona suman dos alertas, pero un solo adulto prioritario.
          {' '}{plural(datos.alertas_pendientes, 'pendiente', 'pendientes')} · {plural(datos.alertas_en_proceso, 'en atención', 'en atención')} · {plural(datos.alertas_prioritarias_abiertas, 'prioritaria', 'prioritarias')}.
        </span>
      </Card>
      <Card tone="info" className="grid grid-cols-1 gap-1">
        <span className="text-sm font-semibold text-ink-2">Necesidades activas</span>
        <strong className="text-3xl leading-none text-ink">{datos.necesidades_activas.toLocaleString('es-DO')}</strong>
        <span className="text-sm text-ink-2">Pendientes o en proceso, de {plural(datos.adultos_con_necesidades_activas, 'adulto', 'adultos')}.</span>
      </Card>
    </div>
  </section>
}

function TarjetaCaso({ caso, raiz }: { caso: CasoResumen; raiz: string }) {
  const { alertas, asignados, seguimiento } = caso
  const personal = [...asignados.cuidadores.map((p) => ({ ...p, rol: 'Cuidador' })), ...asignados.voluntarios.map((p) => ({ ...p, rol: 'Voluntario' }))]
  return <Card className="grid h-full min-w-0 grid-cols-1 content-start gap-3" data-testid="caso-resumen">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-bold wrap-anywhere">
          <Link to={`${raiz}/envejecientes?adulto=${idRuta(caso.envejeciente_id)}`} className="inline-flex min-h-12 items-center text-navy hover:underline">{caso.nombres} {caso.apellidos}</Link>
        </h3>
        <p className="-mt-2 text-sm text-ink-2 wrap-anywhere">{[caso.zona, caso.municipio?.nombre].filter(Boolean).join(' · ') || 'Sin ubicación registrada'}</p>
      </div>
      <div className="flex-none">{caso.riesgo_vigente ? <RiesgoBadge riesgo={caso.riesgo_vigente} /> : <Badge>{textoRiesgo(null)}</Badge>}</div>
    </div>
    <div className="flex flex-wrap gap-1.5">
      <Badge tone={PRIORIDAD_TONO[caso.prioridad]}>Prioridad {PRIORIDAD_TEXTO[caso.prioridad].toLowerCase()}</Badge>
      <Badge tone={ESTADO_ATENCION_TONO[caso.estado_atencion]}>{ESTADO_ATENCION_TEXTO[caso.estado_atencion]}</Badge>
    </div>
    {caso.motivos.length > 0 && <p className="text-xs text-muted wrap-anywhere">{caso.motivos.map(textoMotivo).join(' · ')}</p>}
    <dl className={`grid ${seguimiento ? 'grid-cols-3' : 'grid-cols-2'} gap-2 border-t border-line-soft pt-3 text-center`}>
      <div><dt className="text-xs text-muted">Alertas abiertas</dt><dd className={alertas.abiertas > 0 ? 'text-lg font-bold text-danger' : 'text-lg font-bold'}>{alertas.abiertas}</dd></div>
      <div><dt className="text-xs text-muted">Necesidades activas</dt><dd className="text-lg font-bold wrap-anywhere">{caso.necesidades_activas}</dd></div>
      {seguimiento && <div><dt className="text-xs text-muted">Días sin visita</dt><dd className={seguimiento.vencido ? 'text-lg font-bold text-danger' : 'text-lg font-bold'}>{seguimiento.dias_sin_visita}</dd></div>}
    </dl>
    {alertas.abiertas > 0 && <p className="text-sm text-ink-2 wrap-anywhere">
      {plural(alertas.abiertas, 'alerta abierta', 'alertas abiertas')}: {alertas.pendientes} pendientes, {alertas.en_proceso} en atención, {alertas.prioritarias_abiertas} prioritarias.
    </p>}
    {seguimiento && <p className={seguimiento.vencido ? 'text-sm font-semibold text-danger' : 'text-sm text-ink-2'}>
      {textoSeguimiento(seguimiento)}{seguimiento.vencido ? `. Supera el límite de ${seguimiento.umbral_dias} días.` : ''}
    </p>}
    <p className="text-sm text-ink-2 wrap-anywhere">
      {personal.length === 0 ? <span className="font-semibold text-warning-700">Sin personal asignado</span>
        : <><b className="text-ink">{plural(personal.length, 'persona asignada', 'personas asignadas')}:</b> {personal.map((p) => `${p.nombres} ${p.apellidos} (${p.rol})`).join(', ')}</>}
    </p>
  </Card>
}

export function ResumenCasos({ base, token, cuenta }: OperacionProps) {
  const raiz = `/operacion/${idRuta(cuenta.cuenta_id)}`
  const [revision, setRevision] = useState(0)
  const [filtros, setFiltros] = useState<FiltrosResumen>(FILTROS_RESUMEN_INICIALES)
  const [criterio, setCriterio] = useState<CriterioOrden>('prioridad')
  const [invertido, setInvertido] = useState(false)
  const set = (campo: keyof FiltrosResumen, valor: string) => setFiltros((anterior) => ({ ...anterior, [campo]: valor }))
  const busqueda = useRetardado(filtros.busqueda, 350)
  const consulta = consultaResumen({ ...filtros, busqueda }, criterio, invertido)
  const indicadores = useDatos<IndicadoresResumen>(`${base}/resumen-casos/indicadores`, token, revision)
  const lista = usePagina<CasoResumen>(`${base}/resumen-casos`, token, revision, consulta)
  const universo = useDatos<OpcionesReporte>(`${base}/resumen-casos/opciones`, token, revision)
  const opciones = opcionesUbicacion(universo.datos)
  const personal = (universo.datos?.asignados ?? []).map((p) => ({
    value: p.usuario_id, label: `${p.nombres} ${p.apellidos} · ${ROL_TEXTO[p.rol]}`,
  }))
  const total = lista.datos?.meta.total
  const filtrando = hayFiltrosResumen(filtros)
  const sentido = sentidoDeOrden(criterio, invertido)
  const terminoCorto = filtros.busqueda.trim().length > 0 && !terminoDeBusqueda(filtros.busqueda)
  const estados = ESTADOS_ATENCION.filter((e) => cuenta.tipo === 'organizacion' || e.value !== 'seguimiento_vencido')
  const criterios = CRITERIOS_ORDEN.filter((c) => cuenta.tipo === 'organizacion' || c.value !== 'ultima_visita')

  return <section className="grid grid-cols-1 gap-5" aria-label="Resumen de casos">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <p className="max-w-prose text-sm text-ink-2 wrap-anywhere">Casos activos de la cuenta con su prioridad y su estado de atención. La prioridad combina alertas abiertas, riesgo, seguimiento y necesidades.</p>
      <Button variant="outline" size="sm" icon={<RefreshCw size={18} aria-hidden />} onClick={() => setRevision((n) => n + 1)}>Actualizar</Button>
    </div>

    {(!lista.error || !indicadores.error) && <EstadoConsulta consulta={indicadores} />}
    {indicadores.datos && <Indicadores datos={indicadores.datos} />}

    <section className="grid grid-cols-1 gap-3 rounded-md border border-line-soft bg-surface p-3 sm:p-4" aria-label="Filtros y orden del resumen">
      <label className="grid grid-cols-1 gap-1.5 text-sm font-semibold text-ink">
        Buscar por nombre, sector o municipio
        <SearchInput value={filtros.busqueda} maxLength={BUSQUEDA_MAX} placeholder="Nombre, sector o municipio" aria-label="Buscar por nombre, sector o municipio"
          onChange={(event) => set('busqueda', event.currentTarget.value)} />
      </label>
      {terminoCorto && <p role="status" className="text-sm text-ink-2">Escribe al menos 2 caracteres para buscar.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField label="Estado de atención" value={filtros.estado} onChange={(event) => set('estado', event.currentTarget.value)}
          options={[{ value: '', label: 'Todos' }, ...estados.map((e) => ({ value: e.value, label: e.label }))]} />
        <SelectField label="Prioridad" value={filtros.prioridad} onChange={(event) => set('prioridad', event.currentTarget.value)}
          options={[{ value: '', label: 'Todas' }, ...(['alta', 'media', 'baja'] as const).map((p) => ({ value: p, label: PRIORIDAD_TEXTO[p] }))]} />
        <SelectField label="Riesgo" value={filtros.riesgo} onChange={(event) => set('riesgo', event.currentTarget.value)}
          options={[{ value: '', label: 'Todos' }, { value: 'alto', label: 'Alto' }, { value: 'medio', label: 'Medio' }, { value: 'bajo', label: 'Bajo' }, { value: 'sin_evaluacion', label: textoRiesgo(null) }]} />
        <SelectField label="Municipio" value={filtros.municipio} onChange={(event) => set('municipio', event.currentTarget.value)}
          options={[{ value: '', label: 'Todos' }, ...opciones.municipios]} />
        <SelectField label="Sector" value={filtros.zona} onChange={(event) => set('zona', event.currentTarget.value)}
          options={[{ value: '', label: 'Todos' }, ...opciones.sectores]} />
        <SelectField label="Asignado a" value={filtros.asignado} onChange={(event) => set('asignado', event.currentTarget.value)}
          options={[{ value: '', label: 'Todos' }, { value: 'sin', label: 'Sin personal asignado' }, { value: 'con', label: 'Con personal asignado' }, ...personal]} />
      </div>
      {universo.error && <EstadoConsulta consulta={universo} />}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 sm:max-w-xs">
          <SelectField label="Ordenar por" value={criterio} onChange={(event) => { setCriterio(event.currentTarget.value as CriterioOrden); setInvertido(false) }}
            options={criterios.map((c) => ({ value: c.value, label: c.label }))}
            help={<>{estados.map((e) => <span key={e.value} className="block"><b>{e.label}:</b> {e.descripcion}</span>)}</>} />
        </div>
        <Button variant="outline" size="sm" icon={<ArrowDownUp size={18} aria-hidden />} onClick={() => setInvertido((valor) => !valor)}>
          Orden: {sentido}<span className="sr-only"> (activar para invertir el orden)</span>
        </Button>
        {filtrando && <Button variant="ghost" size="sm" onClick={() => setFiltros(FILTROS_RESUMEN_INICIALES)}>Quitar filtros</Button>}
      </div>
    </section>

    {/* Reintentar vuelve a consultar los indicadores y la lista juntos. */}
    <EstadoConsulta consulta={{ ...lista, reintentar: () => setRevision((n) => n + 1) }} />
    {lista.datos && <p className="flex flex-wrap items-center gap-1 text-sm text-ink-2 wrap-anywhere" aria-live="polite">
      <span data-testid="total-casos">{filtrando ? `${plural(total ?? 0, 'caso coincide', 'casos coinciden')} con los filtros` : plural(total ?? 0, 'caso activo', 'casos activos')} · ordenados por {CRITERIOS_ORDEN.find((c) => c.value === criterio)?.label.toLowerCase()} ({sentido})</span>
      <HelpTip label="Ayuda: estados de atención">
        {estados.map((e) => <span key={e.value} className="block"><b>{e.label}:</b> {e.descripcion}</span>)}
      </HelpTip>
    </p>}
    {lista.datos?.data.length === 0 && (filtrando
      ? <EmptyState title="Ningún caso coincide con los filtros" text="Prueba con otra búsqueda o quita algún filtro."
        action={<Button variant="outline" size="sm" onClick={() => setFiltros(FILTROS_RESUMEN_INICIALES)}>Quitar filtros</Button>} />
      : <EmptyState title="No hay casos activos" text="Cuando haya adultos mayores activos con consentimiento vigente aparecerán aquí con su prioridad y su estado de atención." />)}
    {!!lista.datos?.data.length && <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Casos activos">
      {lista.datos.data.map((caso) => <li key={caso.envejeciente_id} className="min-w-0"><TarjetaCaso caso={caso} raiz={raiz} /></li>)}
    </ul>}
    {lista.datos && <Paginador pagina={lista.pagina} total={lista.datos.meta.totalPages} cambiar={lista.cambiar} />}
  </section>
}
