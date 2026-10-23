/*
 * ResumenPage.tsx — Módulo de resumen de seguimiento (RF-07 · CU-11): vista consolidada de los casos
 * activos con su prioridad y estado de atención, ordenada por defecto por prioridad, con selector de orden
 * (estado, fecha de última visita, nivel de riesgo), filtros por municipio y sector y opción de agrupar por
 * estado. Muestra la ubicación y los voluntarios asignados (Vinculo) de cada caso. Se actualiza en tiempo
 * real (useDB). Tarjetas en móvil y tabla en escritorio. La lógica vive en lib/resumen.ts.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bell, CalendarX, HandHelping, Info, MapPin, OctagonAlert, TriangleAlert, UserX } from 'lucide-react'
import { EmptyState, HelpTip, RiesgoBadge, SelectField, Switch } from '@/components/ui'
import { useUser } from '@/domain/auth'
import { fechaCorta } from '@/domain/dates'
import { adultosVisibles } from '@/domain/permisos'
import { configOrg } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { FilaFiltros, FilterChip } from '../components/FilterChip'
import { plural } from '../lib/formato'
import { enUbicacion, municipiosEnUso, sectoresEnUso } from '../lib/ubicacion'
import { useVolver } from '../lib/navegacion'
import {
  agruparPorEstado,
  casosResumen,
  CRITERIOS_ORDEN,
  ESTADO_ATENCION_TEXTO,
  ESTADOS_ATENCION,
  indicadoresResumen,
  ordenarCasos,
  PRIORIDAD_TEXTO,
  type CasoResumen,
  type CriterioOrden,
  type EstadoAtencion,
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

const textoVisita = (c: CasoResumen) =>
  c.ultimaVisita ? `${fechaCorta(c.ultimaVisita)} · ${c.diasSinVisita === 0 ? 'hoy' : `hace ${plural(c.diasSinVisita, 'día', 'días')}`}` : `Nunca visitado (${plural(c.diasSinVisita, 'día', 'días')} registrado)`

function Kpi({ etiqueta, valor, peligro }: { etiqueta: string; valor: number; peligro?: boolean }) {
  return (
    <div className="flex flex-col justify-between gap-1 min-h-[76px] p-3 rounded-md bg-surface shadow-1">
      <span className="text-xs font-semibold text-ink-2 leading-tight">{etiqueta}</span>
      <span className={cn('text-[28px] font-bold leading-none', peligro && valor > 0 ? 'text-danger' : 'text-ink')}>{valor}</span>
    </div>
  )
}

function Tarjeta({ c, base }: { c: CasoResumen; base: string }) {
  return (
    <li data-testid="caso-resumen">
      <Link to={`${base}/adultos/${c.id}`} className={cn('flex flex-col gap-3 h-full p-4 rounded-md border-l-4 bg-surface shadow-1 hover:shadow-2 transition-shadow', PRIORIDAD_VISUAL[c.prioridad].borde)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0 leading-tight">
            <strong className="text-base font-bold wrap-anywhere">{c.nombre}</strong>
            <small className="text-xs text-muted">{c.zona}</small>
            {c.voluntarios === 0 && (
              <small className="inline-flex items-center gap-1 text-xs font-semibold text-warning-700">
                <UserX size={13} aria-hidden /> Sin voluntario asignado
              </small>
            )}
          </div>
          <RiesgoBadge riesgo={c.riesgo} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <PrioridadBadge prioridad={c.prioridad} />
          <EstadoBadge estado={c.estado} />
        </div>
        <p className="text-xs text-muted">{c.motivos.join(' · ')}</p>
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
          <span className="text-ink-2">Última visita: {textoVisita(c)}</span>
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
            <th scope="col" className="px-4 py-3">Caso</th>
            <th scope="col" className="px-3 py-3">Prioridad</th>
            <th scope="col" className="px-3 py-3">Estado de atención</th>
            <th scope="col" className="px-3 py-3">Riesgo</th>
            <th scope="col" className="px-3 py-3">Última visita</th>
            <th scope="col" className="px-3 py-3 text-center">Necesidades</th>
            <th scope="col" className="px-3 py-3 text-center">Alertas</th>
          </tr>
        </thead>
        <tbody>
          {casos.map((c) => (
            <tr key={c.id} data-testid="caso-resumen" className="border-t border-line-soft hover:bg-blue-100/50">
              <th scope="row" className={cn('px-4 py-2 text-left font-normal border-l-4', PRIORIDAD_VISUAL[c.prioridad].borde)}>
                <Link to={`${base}/adultos/${c.id}`} className="flex flex-col justify-center min-h-12 font-semibold text-navy hover:underline">
                  {c.nombre}
                  <small className="text-xs font-normal text-ink-2">{c.zona}</small>
                  <small className="text-xs font-normal text-muted">{c.motivos.join(' · ')}</small>
                </Link>
              </th>
              <td className="px-3 py-2">
                <PrioridadBadge prioridad={c.prioridad} />
              </td>
              <td className="px-3 py-2">
                <EstadoBadge estado={c.estado} />
              </td>
              <td className="px-3 py-2">
                <RiesgoBadge riesgo={c.riesgo} />
              </td>
              <td className={cn('px-3 py-2 whitespace-nowrap', c.visitaVencida && 'text-danger font-semibold')}>
                {c.ultimaVisita ? fechaCorta(c.ultimaVisita) : 'Nunca'}
                <span className="block text-xs">{plural(c.diasSinVisita, 'día', 'días')} sin visita</span>
              </td>
              <td className="px-3 py-2 text-center">
                <span className="inline-flex items-center gap-1">
                  {c.necesidadesPendientes > 0 && <HandHelping size={14} className="text-warning-700" aria-hidden />}
                  {c.necesidadesPendientes}
                </span>
              </td>
              <td className={cn('px-3 py-2 text-center', c.alertasAbiertas > 0 && 'text-danger font-bold')}>
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

export default function ResumenPage() {
  const { base } = useShell()
  const user = useUser()
  const { back } = useVolver(`${base}/mas`)
  const adultos = useDB((s) => s.adultos)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const alertas = useDB((s) => s.alertas)
  const vinculos = useDB((s) => s.vinculos)
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  const [municipio, setMunicipio] = useState('')
  const [sector, setSector] = useState('')
  const [criterio, setCriterio] = useState<CriterioOrden>('prioridad')
  const [agrupar, setAgrupar] = useState(false)
  const umbral = configOrg({ catalogos, configuracion }, user.orgId).diasSinVisitaAlerta

  const visibles = useMemo(() => adultosVisibles(user, adultos).filter((a) => a.estado === 'activo' && !a.anonimizado), [user, adultos])
  const municipios = useMemo(() => municipiosEnUso(catalogos, visibles), [catalogos, visibles])
  const sectores = useMemo(() => sectoresEnUso(visibles, municipio || undefined), [visibles, municipio])
  // Se recalcula en cuanto cambia cualquier perfil, visita, necesidad, alerta o vínculo (tiempo real).
  const casos = useMemo(
    () => casosResumen({ visitas, necesidades, alertas, vinculos, catalogos }, visibles.filter((a) => enUbicacion(a, municipio, sector)), { umbral }),
    [visitas, necesidades, alertas, vinculos, catalogos, visibles, municipio, sector, umbral],
  )
  const ordenados = useMemo(() => ordenarCasos(casos, criterio), [casos, criterio])
  const grupos = useMemo(() => agruparPorEstado(ordenados), [ordenados])
  const kpi = indicadoresResumen(casos)

  return (
    <Page title="Resumen de seguimiento" back={back} hideAvatar wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi etiqueta="Casos activos" valor={kpi.activos} />
        <Kpi etiqueta="Prioridad alta" valor={kpi.prioridadAlta} peligro />
        <Kpi etiqueta="Alertas pendientes" valor={kpi.alertasPendientes} peligro />
        <Kpi etiqueta={`Más de ${umbral} días sin visita`} valor={kpi.visitaVencida} peligro />
        <Kpi etiqueta="Necesidades pendientes" valor={kpi.necesidadesPendientes} />
      </div>

      <div className="flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:w-72">
          <SelectField
            label="Ordenar por"
            value={criterio}
            onChange={(e) => setCriterio(e.target.value as CriterioOrden)}
            options={CRITERIOS_ORDEN}
            help={
              <>
                <b>Prioridad:</b> Alta = alerta prioritaria o de emergencia abierta, o riesgo alto · Media = alerta de seguimiento o necesidad abierta, necesidades pendientes o riesgo medio ·
                Baja = resto. <b>Fecha de última visita:</b> primero los que llevan más días sin visita.
              </>
            }
          />
        </div>
        <Switch checked={agrupar} onChange={setAgrupar} label={<span className="font-semibold">Agrupar por estado de atención</span>} />
      </div>

      <FilaFiltros>
        <FilterChip
          etiqueta="Municipio"
          icono={<MapPin size={16} aria-hidden />}
          value={municipio}
          onChange={(m) => {
            setMunicipio(m)
            setSector('')
          }}
          opciones={[{ value: '', label: 'Todos' }, ...municipios]}
        />
        <FilterChip etiqueta="Sector" value={sector} onChange={setSector} opciones={[{ value: '', label: 'Todos' }, ...sectores.map((z) => ({ value: z, label: z }))]} />
      </FilaFiltros>

      <p className="flex flex-wrap items-center gap-1 -my-2 text-sm text-ink-2" aria-live="polite">
        {plural(casos.length, 'caso activo', 'casos activos')} · ordenados por {CRITERIOS_ORDEN.find((c) => c.value === criterio)?.label.toLowerCase()}
        <HelpTip label="Ayuda: estados de atención">
          {ESTADOS_ATENCION.map((e) => (
            <span key={e.value} className="block">
              <b>{e.label}:</b> {e.descripcion}
            </span>
          ))}
        </HelpTip>
      </p>

      {casos.length === 0 ? (
        <EmptyState title="No hay casos activos" text="Cuando registres perfiles de adultos mayores activos aparecerán aquí con su prioridad y estado." />
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
