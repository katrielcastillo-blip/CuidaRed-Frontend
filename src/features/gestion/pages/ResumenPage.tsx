/*
 * ResumenPage.tsx — Módulo de Seguimiento (RF-07 · CU-11): vista consolidada de los casos activos de la
 * cuenta con su prioridad (riesgo + alertas abiertas) y su estado de atención. Se ordena por prioridad (por
 * defecto), estado, fecha de la última visita realizada o nivel de riesgo, en ambos sentidos; se filtra por
 * estado, prioridad, riesgo, municipio, sector y personal asignado, y se busca por nombre o ubicación. Cuenta el
 * personal asignado (cuidadores y voluntarios) y se actualiza solo (useDB reactivo; el store también recarga
 * cuando otra pestaña cambia los datos). Tarjetas en móvil y tabla en escritorio; la lógica vive en lib/resumen.ts.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownUp, ArrowRight, Bell, CalendarX, CircleAlert, HandHelping, Info, ListFilter, MapPin, OctagonAlert, ShieldAlert, TriangleAlert, UserCheck, Users, UserX } from 'lucide-react'
import { Button, EmptyState, HelpTip, RiesgoBadge, SearchInput, SelectField, Switch } from '@/components/ui'
import { useUser } from '@/domain/auth'
import { fechaCorta, hora12 } from '@/domain/dates'
import { adultosVisibles } from '@/domain/permisos'
import { configOrg, nombreUsuario } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Riesgo } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { FilaFiltros, FilterChip } from '../components/FilterChip'
import { useActualizadoEn } from '../components/reportes/useActualizadoEn'
import { plural, RIESGO_TEXTO } from '../lib/formato'
import { municipiosEnUso, sectoresEnUso } from '../lib/ubicacion'
import { useVolver } from '../lib/navegacion'
import {
  agruparPorEstado,
  ASIGNACION_CON_PERSONAL,
  ASIGNACION_SIN_PERSONAL,
  casosResumen,
  CRITERIOS_ORDEN,
  detallePersonal,
  ESTADO_ATENCION_TEXTO,
  ESTADOS_ATENCION,
  filtrarCasos,
  FILTROS_RESUMEN_INICIALES,
  hayFiltrosResumen,
  indicadoresResumen,
  ordenarCasos,
  PRIORIDAD_TEXTO,
  SENTIDO_ORDEN,
  type CasoResumen,
  type CriterioOrden,
  type EstadoAtencion,
  type FiltrosResumen,
  type Prioridad,
} from '../lib/resumen'

const PRIORIDAD_VISUAL: Record<Prioridad, { Icono: typeof Info; clase: string; borde: string }> = {
  alta: { Icono: OctagonAlert, clase: 'bg-danger text-white', borde: 'border-l-danger' },
  media: { Icono: TriangleAlert, clase: 'bg-warning-700 text-white', borde: 'border-l-warning' },
  baja: { Icono: Info, clase: 'bg-info-100 text-navy border border-blue', borde: 'border-l-blue' },
}

const ESTADO_CLASE: Record<EstadoAtencion, string> = {
  alerta_pendiente: 'bg-danger-100 text-danger',
  en_atencion: 'bg-warning-100 text-warning-700',
  visita_vencida: 'bg-warning-100 text-warning-700',
  necesidades: 'bg-blue-100 text-navy',
  al_dia: 'bg-success-100 text-success-700',
}

function PrioridadBadge({ prioridad }: { prioridad: Prioridad }) {
  const v = PRIORIDAD_VISUAL[prioridad]
  return (
    <span data-testid="prioridad-caso" className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[11px] font-bold uppercase leading-4 whitespace-nowrap', v.clase)}>
      <v.Icono size={12} strokeWidth={3} aria-hidden />
      Prioridad {PRIORIDAD_TEXTO[prioridad]}
    </span>
  )
}

function EstadoBadge({ estado }: { estado: EstadoAtencion }) {
  return <span data-testid="estado-atencion" className={cn('inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-semibold whitespace-nowrap', ESTADO_CLASE[estado])}>{ESTADO_ATENCION_TEXTO[estado]}</span>
}

/** "02/11/2026 · hace 4 días" o "Aún sin visitas realizadas". */
const textoVisita = (c: CasoResumen) =>
  c.ultimaVisita ? `${fechaCorta(c.ultimaVisita)} · ${c.diasSinVisita === 0 ? 'hoy' : `hace ${plural(c.diasSinVisita, 'día', 'días')}`}` : `Aún sin visitas realizadas (registrado hace ${plural(c.diasSinVisita, 'día', 'días')})`

function Kpi({ etiqueta, valor, peligro }: { etiqueta: string; valor: number; peligro?: boolean }) {
  return (
    <div className="flex flex-col justify-between gap-1 min-h-[76px] p-3 rounded-md bg-surface shadow-1">
      <span className="text-xs font-semibold text-ink-2 leading-tight">{etiqueta}</span>
      <span className={cn('text-[28px] font-bold leading-none', peligro && valor > 0 ? 'text-danger' : 'text-ink')}>{valor}</span>
    </div>
  )
}

/** Personal asignado: cantidad y desglose, o aviso si el caso no tiene a nadie. */
function Personal({ c, compacto }: { c: CasoResumen; compacto?: boolean }) {
  if (c.personal === 0)
    return (
      <span data-testid="personal-asignado" data-personal="0" className="inline-flex items-center gap-1 text-xs font-semibold text-warning-700">
        <UserX size={14} aria-hidden /> Sin personal asignado
      </span>
    )
  return (
    <span data-testid="personal-asignado" data-personal={c.personal} className="inline-flex flex-wrap items-center gap-x-1.5 text-xs text-ink-2">
      <Users size={14} className="flex-none text-navy" aria-hidden />
      <b className="text-ink whitespace-nowrap">{compacto ? `${c.personal} ${c.personal === 1 ? 'asignado' : 'asignados'}` : plural(c.personal, 'persona asignada', 'personas asignadas')}</b>
      {!compacto && <span className="text-muted">({detallePersonal(c)})</span>}
    </span>
  )
}

function Tarjeta({ c, base }: { c: CasoResumen; base: string }) {
  return (
    <li data-testid="caso-resumen">
      <Link to={`${base}/adultos/${c.id}`} className={cn('flex flex-col gap-3 h-full p-4 rounded-md border-l-4 bg-surface shadow-1 hover:shadow-2 transition-shadow', PRIORIDAD_VISUAL[c.prioridad].borde)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0 leading-tight">
            <strong className="text-base font-bold wrap-anywhere">{c.nombre}</strong>
            <small className="text-xs text-muted">{c.zona}</small>
          </div>
          <RiesgoBadge riesgo={c.riesgo} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <PrioridadBadge prioridad={c.prioridad} />
          <EstadoBadge estado={c.estado} />
        </div>
        <p className="text-xs text-muted">{c.motivos.join(' · ')}</p>
        <Personal c={c} />
        <dl className="grid grid-cols-3 gap-2 pt-3 border-t border-surface-2 text-center">
          <div className={cn('flex flex-col gap-0.5', c.visitaVencida && 'text-danger')}>
            <dt className="text-[11px] text-muted">Días sin visita</dt>
            <dd className="text-lg font-bold inline-flex items-center justify-center gap-1">
              {c.visitaVencida && <CalendarX size={16} aria-hidden />}
              {c.diasSinVisita}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] text-muted">Necesidades</dt>
            <dd className="text-lg font-bold">{c.necesidadesPendientes}</dd>
          </div>
          <div className={cn('flex flex-col gap-0.5', c.alertasAbiertas > 0 && 'text-danger')}>
            <dt className="text-[11px] text-muted">Alertas abiertas</dt>
            <dd className="text-lg font-bold">{c.alertasAbiertas}</dd>
          </div>
        </dl>
        <span className="flex items-center justify-between gap-2 min-h-12 -mb-2 text-sm">
          <span className="text-ink-2">Última visita realizada: {textoVisita(c)}</span>
          <ArrowRight size={18} className="text-navy flex-none" aria-hidden />
        </span>
      </Link>
    </li>
  )
}

function Tabla({ casos, base }: { casos: CasoResumen[]; base: string }) {
  return (
    <div className="relative overflow-x-auto rounded-md bg-surface shadow-1">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-2">
          <tr>
            <th scope="col" className="px-3 py-3">Caso</th>
            <th scope="col" className="px-2 py-3">Prioridad</th>
            <th scope="col" className="px-2 py-3">Estado de atención</th>
            <th scope="col" className="px-2 py-3">Riesgo</th>
            <th scope="col" className="px-2 py-3">Última visita realizada</th>
            <th scope="col" className="px-2 py-3">Personal asignado</th>
            <th scope="col" className="px-2 py-3 text-center">Necesidades</th>
            <th scope="col" className="px-2 py-3 text-center">Alertas</th>
          </tr>
        </thead>
        <tbody>
          {casos.map((c) => (
            <tr key={c.id} data-testid="caso-resumen" className="border-t border-line-soft hover:bg-blue-100/50">
              <th scope="row" className={cn('min-w-44 px-3 py-2 text-left font-normal border-l-4', PRIORIDAD_VISUAL[c.prioridad].borde)}>
                <Link to={`${base}/adultos/${c.id}`} className="flex flex-col justify-center min-h-12 font-semibold text-navy hover:underline">
                  {c.nombre}
                  <small className="text-xs font-normal text-ink-2">{c.zona}</small>
                  <small className="text-xs font-normal text-muted">{c.motivos.join(' · ')}</small>
                </Link>
              </th>
              <td className="px-2 py-2">
                <PrioridadBadge prioridad={c.prioridad} />
              </td>
              <td className="px-2 py-2">
                <EstadoBadge estado={c.estado} />
              </td>
              <td className="px-2 py-2">
                <RiesgoBadge riesgo={c.riesgo} />
              </td>
              <td className={cn('px-2 py-2 whitespace-nowrap', c.visitaVencida && 'text-danger font-semibold')}>
                {c.ultimaVisita ? fechaCorta(c.ultimaVisita) : 'Nunca'}
                <span className="block text-xs">{c.ultimaVisita ? `${plural(c.diasSinVisita, 'día', 'días')} sin visita` : 'Sin visitas realizadas'}</span>
              </td>
              <td className="min-w-28 px-2 py-2">
                <div className="flex flex-col gap-0.5">
                  <Personal c={c} compacto />
                  {c.personal > 0 && <span className="text-xs text-muted">{detallePersonal(c)}</span>}
                </div>
              </td>
              <td className="px-2 py-2 text-center">
                <span className="inline-flex items-center gap-1">
                  {c.necesidadesPendientes > 0 && <HandHelping size={14} className="text-warning-700" aria-hidden />}
                  {c.necesidadesPendientes}
                </span>
              </td>
              <td className={cn('px-2 py-2 text-center', c.alertasAbiertas > 0 && 'text-danger font-bold')}>
                <span className="inline-flex items-center gap-1">
                  {c.alertasAbiertas > 0 && <Bell size={14} aria-hidden />}
                  {c.alertasAbiertas}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Lista({ casos, base }: { casos: CasoResumen[]; base: string }) {
  return (
    <>
      <ul className="grid-auto lg:hidden" aria-label="Casos activos">
        {casos.map((c) => (
          <Tarjeta key={c.id} c={c} base={base} />
        ))}
      </ul>
      <div className="hidden lg:block">
        <Tabla casos={casos} base={base} />
      </div>
    </>
  )
}

/** Si el valor elegido ya no existe entre las opciones (cambió en otra pestaña), se trata como «todos». */
const valorVigente = (valor: string, opciones: Array<{ value: string }>) => (opciones.some((o) => o.value === valor) ? valor : '')

export default function ResumenPage() {
  const { base } = useShell()
  const user = useUser()
  const { back } = useVolver(`${base}/mas`)
  const adultos = useDB((s) => s.adultos)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const alertas = useDB((s) => s.alertas)
  const vinculos = useDB((s) => s.vinculos)
  const usuarios = useDB((s) => s.usuarios)
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  const [filtros, setFiltros] = useState<FiltrosResumen>(FILTROS_RESUMEN_INICIALES)
  const [criterio, setCriterio] = useState<CriterioOrden>('prioridad')
  const [invertir, setInvertir] = useState(false)
  const [agrupar, setAgrupar] = useState(false)
  const set = <K extends keyof FiltrosResumen>(k: K, v: FiltrosResumen[K]) => setFiltros((f) => ({ ...f, [k]: v }))
  const umbral = configOrg({ catalogos, configuracion }, user.orgId).diasSinVisitaAlerta

  // Solo los adultos de la cuenta activa que el usuario puede consultar (rol + alcance).
  const visibles = useMemo(() => adultosVisibles(user, adultos).filter((a) => a.estado === 'activo' && !a.anonimizado), [user, adultos])
  // Se recalcula en cuanto cambia cualquier perfil, visita, necesidad, alerta, vínculo (cuidadores y voluntarios)
  // o usuario (tiempo real, también cuando otra pestaña modifica los datos).
  const todos = useMemo(
    () => casosResumen({ visitas, necesidades, alertas, vinculos, usuarios, catalogos }, visibles, { umbral }),
    [visitas, necesidades, alertas, vinculos, usuarios, catalogos, visibles, umbral],
  )
  const actualizado = useActualizadoEn(todos)

  const municipios = useMemo(() => municipiosEnUso(catalogos, visibles), [catalogos, visibles])
  const municipio = valorVigente(filtros.municipio, municipios)
  const sectores = useMemo(() => sectoresEnUso(visibles, municipio || undefined), [visibles, municipio])
  const personas = useMemo(() => {
    const ids = new Set(todos.flatMap((c) => c.personalIds))
    return usuarios
      .filter((u) => ids.has(u.id))
      .map((u) => ({
        value: u.id,
        label: `${nombreUsuario(usuarios, u.id)} · ${vinculos.some((v) => v.usuarioId === u.id && v.tipoVinculoId === 'cuidador_asignado') ? 'Cuidador' : 'Voluntario'}`,
      }))
      .sort((x, y) => x.label.localeCompare(y.label, 'es'))
  }, [todos, usuarios, vinculos])
  const opcionesAsignacion = useMemo(
    () => [{ value: '', label: 'Todos' }, { value: ASIGNACION_SIN_PERSONAL, label: 'Sin personal asignado' }, { value: ASIGNACION_CON_PERSONAL, label: 'Con personal asignado' }, ...personas],
    [personas],
  )
  const efectivos = useMemo<FiltrosResumen>(
    () => ({ ...filtros, municipio, sector: valorVigente(filtros.sector, sectores.map((z) => ({ value: z }))), asignacion: valorVigente(filtros.asignacion, opcionesAsignacion) }),
    [filtros, municipio, sectores, opcionesAsignacion],
  )

  const casos = useMemo(() => filtrarCasos(todos, efectivos), [todos, efectivos])
  const ordenados = useMemo(() => ordenarCasos(casos, criterio, invertir), [casos, criterio, invertir])
  const grupos = useMemo(() => agruparPorEstado(ordenados), [ordenados])
  const kpi = indicadoresResumen(todos)
  const sentido = SENTIDO_ORDEN[criterio][invertir ? 1 : 0]
  const criterioTexto = CRITERIOS_ORDEN.find((c) => c.value === criterio)?.label.toLowerCase()
  const filtrando = hayFiltrosResumen(efectivos)

  return (
    <Page title="Resumen de seguimiento" back={back} hideAvatar wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi etiqueta="Casos activos" valor={kpi.activos} />
        <Kpi etiqueta="Prioridad alta" valor={kpi.prioridadAlta} peligro />
        <Kpi etiqueta="Alertas pendientes" valor={kpi.alertasPendientes} peligro />
        <Kpi etiqueta={`Más de ${umbral} días sin visita`} valor={kpi.visitaVencida} peligro />
        <Kpi etiqueta="Necesidades pendientes" valor={kpi.necesidadesPendientes} />
        <Kpi etiqueta="Sin personal asignado" valor={kpi.sinPersonal} peligro />
      </div>

      <div className="flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1">
        <SearchInput
          value={filtros.busqueda}
          onChange={(e) => set('busqueda', e.target.value)}
          placeholder="Buscar por nombre o sector"
          aria-label="Buscar casos por nombre, sector o municipio"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="sm:w-72">
            <SelectField
              label="Ordenar por"
              value={criterio}
              onChange={(e) => {
                setCriterio(e.target.value as CriterioOrden)
                setInvertir(false)
              }}
              options={CRITERIOS_ORDEN}
              help={
                <>
                  <b>Prioridad:</b> Alta = alerta prioritaria o de emergencia abierta, o riesgo alto · Media = alerta de seguimiento o necesidad abierta, necesidades pendientes o riesgo medio ·
                  Baja = resto. A igual prioridad se ordena por estado, alertas abiertas y riesgo. <b>Fecha de última visita:</b> cuenta solo las visitas realizadas; primero quienes llevan más
                  tiempo sin visita o nunca fueron visitados.
                </>
              }
            />
          </div>
          <Button size="sm" variant="outline" icon={<ArrowDownUp size={18} aria-hidden />} onClick={() => setInvertir((v) => !v)} className="whitespace-nowrap">
            Orden: {sentido}
            <span className="sr-only"> (activar para invertir el orden)</span>
          </Button>
          <Switch checked={agrupar} onChange={setAgrupar} label={<span className="font-semibold">Agrupar por estado de atención</span>} />
        </div>
      </div>

      <FilaFiltros>
        <FilterChip<'' | EstadoAtencion>
          etiqueta="Estado"
          icono={<ListFilter size={16} aria-hidden />}
          value={efectivos.estado}
          onChange={(v) => set('estado', v)}
          opciones={[{ value: '', label: 'Todos' }, ...ESTADOS_ATENCION.map((e) => ({ value: e.value, label: e.label }))]}
        />
        <FilterChip<'' | Prioridad>
          etiqueta="Prioridad"
          icono={<CircleAlert size={16} aria-hidden />}
          value={efectivos.prioridad}
          onChange={(v) => set('prioridad', v)}
          opciones={[{ value: '', label: 'Todas' }, ...(Object.keys(PRIORIDAD_TEXTO) as Prioridad[]).map((p) => ({ value: p, label: PRIORIDAD_TEXTO[p] }))]}
        />
        <FilterChip<'' | Riesgo>
          etiqueta="Riesgo"
          icono={<ShieldAlert size={16} aria-hidden />}
          value={efectivos.riesgo}
          onChange={(v) => set('riesgo', v)}
          opciones={[{ value: '', label: 'Todos' }, ...(Object.keys(RIESGO_TEXTO) as Riesgo[]).map((r) => ({ value: r, label: RIESGO_TEXTO[r] }))]}
        />
        <FilterChip
          etiqueta="Municipio"
          icono={<MapPin size={16} aria-hidden />}
          value={municipio}
          onChange={(m) => setFiltros((f) => ({ ...f, municipio: m, sector: '' }))}
          opciones={[{ value: '', label: 'Todos' }, ...municipios]}
        />
        <FilterChip etiqueta="Sector" value={efectivos.sector} onChange={(v) => set('sector', v)} opciones={[{ value: '', label: 'Todos' }, ...sectores.map((z) => ({ value: z, label: z }))]} />
        <FilterChip etiqueta="Asignado a" icono={<UserCheck size={16} aria-hidden />} value={efectivos.asignacion} onChange={(v) => set('asignacion', v)} opciones={opcionesAsignacion} />
        {filtrando && (
          <button type="button" className="min-h-12 px-2 text-sm font-semibold text-navy underline underline-offset-2" onClick={() => setFiltros(FILTROS_RESUMEN_INICIALES)}>
            Quitar filtros
          </button>
        )}
      </FilaFiltros>

      <p className="flex flex-wrap items-center gap-x-1 -my-2 text-sm text-ink-2" aria-live="polite">
        <span>
          {filtrando ? `${casos.length} de ${plural(todos.length, 'caso activo', 'casos activos')}` : plural(casos.length, 'caso activo', 'casos activos')} · ordenados por {criterioTexto} ({sentido})
        </span>
        <HelpTip label="Ayuda: estados de atención">
          {ESTADOS_ATENCION.map((e) => (
            <span key={e.value} className="block">
              <b>{e.label}:</b> {e.descripcion}
            </span>
          ))}
        </HelpTip>
        <span className="text-xs text-muted">· Actualizado a las {hora12(actualizado)}</span>
      </p>

      {todos.length === 0 ? (
        <EmptyState title="No hay casos activos" text="Cuando registres perfiles de adultos mayores activos aparecerán aquí con su prioridad y estado." />
      ) : casos.length === 0 ? (
        <EmptyState title="Ningún caso coincide con la búsqueda" text="Prueba con otro nombre o quita algún filtro." />
      ) : agrupar ? (
        grupos.map((g) => (
          <section key={g.value} className="flex flex-col gap-3" aria-labelledby={`grupo-${g.value}`}>
            <h2 id={`grupo-${g.value}`} className="flex items-center gap-2 text-lg font-bold">
              <EstadoBadge estado={g.value} />
              <span className="text-sm font-normal text-ink-2">{plural(g.casos.length, 'caso', 'casos')}</span>
            </h2>
            <Lista casos={g.casos} base={base} />
          </section>
        ))
      ) : (
        <Lista casos={ordenados} base={base} />
      )}
    </Page>
  )
}
