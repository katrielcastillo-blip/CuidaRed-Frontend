/*
 * HistorialSeccion.tsx — Historial consolidado del adulto mayor (CU-06 · RF-3.4): una sola línea de tiempo con
 *   Visitas      realizadas, canceladas y de visitante externo (Visita + RegistroVisita + DetalleVisita).
 *   Necesidades  registro y cada cambio de estado (Env_Necesidad + historial).
 *   Alertas      generación y acciones tomadas (AlertaEnvejeciente).
 *   Riesgos      factores registrados y su estado (Env_Riesgo).
 * Ordenada por fecha, con filtros por tipo y por rango de fechas. Cada tipo se incluye solo si el rol tiene el
 * permiso de consulta (visitas:ver, necesidades:ver, alertas:ver, adultos:ver-sensible): sin permiso ni se
 * calcula ni se muestra. Reutilizable desde el área del cuidador: los permisos se resuelven aquí con `puede()`;
 * las propiedades `ver*` y `sensible` solo permiten RESTRINGIR aún más.
 * Módulo: gestión (reutilizable por cualquier área).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, CalendarClock, ClipboardCheck, HandHelping, ShieldAlert, type LucideIcon } from 'lucide-react'
import { Badge, Button, EmptyState, RiesgoBadge, TextField } from '@/components/ui'
import { useUser } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import {
  construirHistorial,
  errorRango,
  FILTRO_VACIO,
  filtrarHistorial,
  PERIODO_TEXTO,
  PERIODOS,
  TIPO_EVENTO_TEXTO,
  type EventoHistorial,
  type FiltroHistorial,
  type Periodo,
  type TipoEvento,
} from '../../lib/historial'
import { plural } from '../../lib/formato'
import { FilaFiltros, FilterChip } from '../FilterChip'
import { Seccion, UrgenciaBadge } from '../Piezas'

/** Eventos que se muestran antes de «Ver más». */
const PAGINA = 10

const VISUAL: Record<TipoEvento, { Icono: LucideIcon; punto: string; nombre: string }> = {
  visita: { Icono: ClipboardCheck, punto: 'bg-blue-100 text-navy', nombre: 'Visita' },
  necesidad: { Icono: HandHelping, punto: 'bg-teal-100 text-success-700', nombre: 'Necesidad' },
  alerta: { Icono: BellRing, punto: 'bg-warning-100 text-warning-700', nombre: 'Alerta' },
  riesgo: { Icono: ShieldAlert, punto: 'bg-danger-100 text-danger', nombre: 'Riesgo' },
}

function Evento({ e, base }: { e: EventoHistorial; base: string }) {
  const v = VISUAL[e.tipo]
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0" data-tipo={e.tipo}>
      <span className={cn('relative z-10 grid place-items-center size-9 flex-none rounded-full border-2 border-bg', v.punto)} aria-hidden>
        <v.Icono size={18} />
      </span>
      <article className="flex flex-col flex-1 min-w-0 gap-1.5 p-3 rounded-sm border border-line-soft bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <span className="text-xs text-muted">
            <b className="font-bold uppercase tracking-wide text-ink-2">{v.nombre}</b> · {e.cuando}
          </span>
          <span className="flex flex-wrap justify-end gap-1">
            {e.pendienteSync && <Badge tone="warning">Pendiente de sincronización</Badge>}
            {e.severidad && <UrgenciaBadge severidad={e.severidad} />}
            {e.nivel && <RiesgoBadge riesgo={e.nivel} />}
            <Badge tone={e.tono}>{e.estado}</Badge>
          </span>
        </div>
        <h3 className="text-base font-bold text-ink wrap-anywhere">{e.titulo}</h3>
        {e.detalle && <p className="text-sm text-ink-2 wrap-anywhere">{e.detalle}</p>}
        {e.extras.length > 0 && <p className="text-xs text-muted wrap-anywhere">{e.extras.join(' · ')}</p>}
        {e.autor && <p className="text-xs text-muted">Registrado por {e.autor}</p>}
        {e.ruta && (
          <Link to={`${base}/${e.ruta}`} className="inline-flex items-center gap-1.5 self-start min-h-12 -mb-2 text-sm font-semibold text-navy underline-offset-2 hover:underline">
            Ver detalle <ArrowRight size={16} aria-hidden />
          </Link>
        )}
      </article>
    </li>
  )
}

export function HistorialSeccion({
  adulto,
  base,
  verVisitas = true,
  verNecesidades = true,
  verAlertas = true,
  sensible = true,
  className,
}: {
  adulto: Adulto
  /** Base de rutas del rol; por defecto, la del área actual (`useShell().base`). */
  base?: string
  /** Restricciones adicionales a los permisos del usuario (nunca los amplían). */
  verVisitas?: boolean
  verNecesidades?: boolean
  verAlertas?: boolean
  sensible?: boolean
  className?: string
}) {
  const user = useUser()
  const shell = useShell()
  const raiz = base ?? shell.base
  const adultos = useDB((s) => s.adultos)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const alertas = useDB((s) => s.alertas)
  const riesgos = useDB((s) => s.riesgos)
  const usuarios = useDB((s) => s.usuarios)
  const catalogos = useDB((s) => s.catalogos)
  const [filtro, setFiltro] = useState<FiltroHistorial>(FILTRO_VACIO)
  const [masAntiguosPrimero, setMasAntiguosPrimero] = useState(false)
  const [mostrar, setMostrar] = useState(PAGINA)

  // Permisos resueltos con puede(): sin permiso, el tipo de evento ni se calcula.
  const pVisitas = verVisitas && puede(user, 'visitas:ver', adulto)
  const pNecesidades = verNecesidades && puede(user, 'necesidades:ver', adulto)
  const pAlertas = verAlertas && puede(user, 'alertas:ver', adulto)
  const pRiesgos = sensible && puede(user, 'adultos:ver-sensible', adulto)
  const pObs = pRiesgos

  const eventos = useMemo(
    () =>
      construirHistorial(
        adulto,
        { adultos, visitas, necesidades, alertas, riesgos, usuarios, catalogos },
        { visitas: pVisitas, necesidades: pNecesidades, alertas: pAlertas, riesgos: pRiesgos, observaciones: pObs },
      ),
    [adulto, adultos, visitas, necesidades, alertas, riesgos, usuarios, catalogos, pVisitas, pNecesidades, pAlertas, pRiesgos, pObs],
  )

  const porTipo = useMemo(() => {
    const c: Record<TipoEvento, number> = { visita: 0, necesidad: 0, alerta: 0, riesgo: 0 }
    for (const e of eventos) c[e.tipo]++
    return c
  }, [eventos])
  const habilitado: Record<TipoEvento, boolean> = { visita: pVisitas, necesidad: pNecesidades, alerta: pAlertas, riesgo: pRiesgos }
  const tiposPermitidos = (Object.keys(VISUAL) as TipoEvento[]).filter((t) => habilitado[t])

  const error = errorRango(filtro)
  const filtrados = useMemo(() => {
    const lista = filtrarHistorial(eventos, filtro)
    return masAntiguosPrimero ? [...lista].reverse() : lista
  }, [eventos, filtro, masAntiguosPrimero])

  if (tiposPermitidos.length === 0) return null

  const cambiar = (parcial: Partial<FiltroHistorial>) => {
    setFiltro((f) => ({ ...f, ...parcial }))
    setMostrar(PAGINA)
  }
  const hayFiltros = filtro.tipo !== '' || filtro.periodo !== 'todo' || masAntiguosPrimero
  const limpiar = () => {
    setFiltro(FILTRO_VACIO)
    setMasAntiguosPrimero(false)
    setMostrar(PAGINA)
  }
  const visibles = filtrados.slice(0, mostrar)
  const realizadas = pVisitas ? eventos.filter((e) => e.realizada).length : 0

  return (
    <Seccion titulo="Historial consolidado" id="historial" className={className}>
      <p className="text-sm text-muted -mt-2">
        Línea de tiempo con {tiposPermitidos.map((t) => TIPO_EVENTO_TEXTO[t].toLowerCase()).join(', ')} del adulto mayor. Solo se incluye lo que tu rol puede consultar.
      </p>

      <FilaFiltros>
        <FilterChip<'' | TipoEvento>
          etiqueta="Tipo"
          value={filtro.tipo}
          onChange={(tipo) => cambiar({ tipo })}
          opciones={[{ value: '', label: `Todos (${eventos.length})` }, ...tiposPermitidos.map((t) => ({ value: t, label: `${TIPO_EVENTO_TEXTO[t]} (${porTipo[t]})` }))]}
        />
        <FilterChip<Periodo>
          etiqueta="Período"
          value={filtro.periodo}
          onChange={(periodo) => cambiar({ periodo, desde: '', hasta: '' })}
          neutro="todo"
          opciones={PERIODOS.map((p) => ({ value: p, label: PERIODO_TEXTO[p] }))}
        />
        <FilterChip<'recientes' | 'antiguos'>
          etiqueta="Orden"
          value={masAntiguosPrimero ? 'antiguos' : 'recientes'}
          onChange={(o) => {
            setMasAntiguosPrimero(o === 'antiguos')
            setMostrar(PAGINA)
          }}
          opciones={[
            { value: 'recientes', label: 'Más recientes primero' },
            { value: 'antiguos', label: 'Más antiguos primero' },
          ]}
        />
      </FilaFiltros>

      {filtro.periodo === 'personalizado' && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Desde" type="date" max={filtro.hasta || todayISO()} value={filtro.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
          <TextField label="Hasta" type="date" min={filtro.desde || undefined} max={todayISO()} value={filtro.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} error={error} />
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-1 text-sm text-ink-2" aria-live="polite">
        Mostrando {visibles.length} de {plural(filtrados.length, 'evento', 'eventos')}
        {hayFiltros && (
          <>
            {' · '}
            <button type="button" className="min-h-12 px-2 font-semibold text-navy underline underline-offset-2" onClick={limpiar}>
              Limpiar filtros
            </button>
          </>
        )}
      </p>

      {filtrados.length === 0 ? (
        <EmptyState title={eventos.length === 0 ? 'Aún no hay registros' : 'Sin registros para estos filtros'} text={eventos.length === 0 ? 'Cuando haya visitas, necesidades, alertas o riesgos aparecerán aquí.' : 'Prueba con otro tipo o período.'} />
      ) : (
        <ol className="relative flex flex-col before:absolute before:left-[17px] before:top-4 before:bottom-4 before:w-0.5 before:bg-line-soft" aria-label="Línea de tiempo del adulto mayor">
          {visibles.map((e) => (
            <Evento key={e.id} e={e} base={raiz} />
          ))}
        </ol>
      )}

      {filtrados.length > mostrar && (
        <Button variant="outline" size="sm" onClick={() => setMostrar((m) => m + PAGINA)}>
          Ver más ({filtrados.length - mostrar} restantes)
        </Button>
      )}
      {pVisitas && eventos.some((e) => e.tipo === 'visita') && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <CalendarClock size={14} aria-hidden /> {plural(realizadas, 'visita realizada', 'visitas realizadas')} en total.
        </p>
      )}
    </Seccion>
  )
}
