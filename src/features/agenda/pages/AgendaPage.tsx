/*
 * AgendaPage.tsx — Agenda de cuidado (tabla Tarea_agenda): tareas visibles según rol y alcance
 * (tareasVisibles), pestañas Hoy · Próximas · Completadas y filtros por adulto, cuidador y prioridad.
 * Cada tarjeta muestra título, adulto, cuidador (usuario del perfil Cuidador + Tipo_Cuidado), fecha y hora,
 * prioridad, estado, indicación relacionada y las marcas "requiere evidencia" y "repetitiva".
 * Quien tiene "agenda:gestionar" ve el botón "Nueva tarea".
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, CalendarPlus } from 'lucide-react'
import { ButtonLink, EmptyState, Segmented, SelectField } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import type { Prioridad, Tarea } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { TareaCard } from '../components/TareaCard'
import { claveTarea, PRIORIDADES, tareaAbierta, useAgenda } from '../lib/agenda'

type Tab = 'hoy' | 'proximas' | 'completadas'
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'proximas', label: 'Próximas' },
  { value: 'completadas', label: 'Completadas' },
]
const esTab = (v: string | null): v is Tab => v === 'hoy' || v === 'proximas' || v === 'completadas'

const VACIO: Record<Tab, { title: string; text: string }> = {
  hoy: { title: 'No hay tareas para hoy', text: 'Las tareas programadas para hoy (y las atrasadas) aparecerán aquí.' },
  proximas: { title: 'No hay tareas próximas', text: 'Las tareas programadas para los próximos días aparecerán aquí.' },
  completadas: { title: 'Aún no hay tareas cerradas', text: 'Aquí verás las tareas completadas y las canceladas.' },
}

export default function AgendaPage() {
  const { base } = useShell()
  const { user, tareas, evidencias, adultoPorId, cuidadorPorId, indicacionPorId, miCuidador, veIndicacion } = useAgenda()
  const [params, setParams] = useSearchParams()
  const tab: Tab = esTab(params.get('tab')) ? (params.get('tab') as Tab) : 'hoy'
  const [adultoId, setAdultoId] = useState(params.get('adulto') ?? '')
  const [cuidadorId, setCuidadorId] = useState('')
  const [prioridad, setPrioridad] = useState<Prioridad | ''>('')

  const hoy = todayISO()
  const gestiona = puede(user, 'agenda:gestionar')
  const valida = puede(user, 'evidencias:validar')

  const grupos = useMemo(() => {
    const asc = (a: Tarea, b: Tarea) => claveTarea(a).localeCompare(claveTarea(b))
    return {
      // Hoy: las del día (cualquier estado salvo canceladas) + las atrasadas que siguen abiertas.
      hoy: tareas.filter((t) => (t.fechaProgramada === hoy && t.estado !== 'cancelada') || (t.fechaProgramada < hoy && tareaAbierta(t))).sort(asc),
      proximas: tareas.filter((t) => t.fechaProgramada > hoy && tareaAbierta(t)).sort(asc),
      completadas: tareas.filter((t) => !tareaAbierta(t)).sort((a, b) => claveTarea(b).localeCompare(claveTarea(a))),
    } satisfies Record<Tab, Tarea[]>
  }, [tareas, hoy])

  const porValidar = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of evidencias) if (e.estadoValidacion === 'pendiente') m.set(e.tareaId, (m.get(e.tareaId) ?? 0) + 1)
    return m
  }, [evidencias])
  const totalPorValidar = useMemo(() => [...porValidar.values()].reduce((a, b) => a + b, 0), [porValidar])

  const lista = useMemo(
    () =>
      grupos[tab].filter(
        (t) => (!adultoId || t.adultoId === adultoId) && (!cuidadorId || t.cuidadorId === cuidadorId) && (!prioridad || t.prioridad === prioridad),
      ),
    [grupos, tab, adultoId, cuidadorId, prioridad],
  )

  // Opciones de filtro: solo adultos y cuidadores que aparecen en la agenda visible.
  const opcionesAdulto = useMemo(() => {
    const ids = [...new Set(tareas.map((t) => t.adultoId))]
    const lista = ids.map((id) => adultoPorId.get(id)).filter((a) => !!a)
    lista.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'))
    return [{ value: '', label: 'Todos los adultos' }, ...lista.map((a) => ({ value: a.id, label: nombreCompleto(a) }))]
  }, [tareas, adultoPorId])
  const opcionesCuidador = useMemo(() => {
    const ids = [...new Set(tareas.map((t) => t.cuidadorId))]
    const lista = ids.map((id) => cuidadorPorId.get(id)).filter((c) => !!c)
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    return [{ value: '', label: 'Todos los cuidadores' }, ...lista.map((c) => ({ value: c.cuidador.id, label: `${c.nombre} · ${c.tipo}` }))]
  }, [tareas, cuidadorPorId])

  const filtrando = adultoId !== '' || cuidadorId !== '' || prioridad !== ''
  const mias = miCuidador ? grupos.hoy.filter((t) => t.cuidadorId === miCuidador.id && tareaAbierta(t)).length : 0
  const nueva = `${base}/agenda/nueva${adultoId ? `?adulto=${adultoId}` : ''}`

  return (
    <Page
      title="Agenda"
      wide
      actions={
        gestiona ? (
          <div className="hidden md:block">
            <ButtonLink to={nueva} variant="light" size="sm" icon={<CalendarPlus size={18} aria-hidden />}>
              Nueva tarea
            </ButtonLink>
          </div>
        ) : undefined
      }
    >
      <p className="text-sm text-muted">
        Tareas de cuidado programadas para cada adulto mayor.{' '}
        {gestiona ? 'Asígnalas a un cuidador y revisa sus evidencias.' : 'Inicia y completa las tareas asignadas a ti y adjunta la evidencia cuando se pida.'}
      </p>

      {/* ───── Indicadores ───── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4" aria-label="Resumen de la agenda">
        <div className="relative col-span-2 md:col-span-1 flex flex-col gap-0.5 min-h-[96px] px-5 py-4 rounded-sm bg-teal-100 border border-[#ccdbdd]">
          <span className="text-base font-semibold text-ink">{miCuidador ? 'Tus tareas abiertas de hoy' : 'Tareas para hoy'}</span>
          <span className="text-4xl font-bold leading-tight text-ink">{miCuidador ? mias : grupos.hoy.filter(tareaAbierta).length}</span>
          <CalendarCheck size={32} className="absolute right-4 bottom-3 text-success-700" aria-hidden />
        </div>
        <Indicador label="Próximas" valor={grupos.proximas.length} />
        <Indicador
          label={valida ? 'Evidencias por validar' : 'Completadas'}
          valor={valida ? totalPorValidar : grupos.completadas.filter((t) => t.estado === 'completada').length}
          alerta={valida && totalPorValidar > 0}
        />
      </section>

      {/* ───── Pestañas y filtros ───── */}
      <div className="flex flex-col gap-3">
        <div className="min-w-0 md:max-w-[480px]">
          <Segmented label="Agenda de tareas" value={tab} options={TABS} onChange={(v) => setParams(v === 'hoy' ? {} : { tab: v }, { replace: true })} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SelectField aria-label="Filtrar por adulto mayor" value={adultoId} onChange={(e) => setAdultoId(e.target.value)} options={opcionesAdulto} />
          <SelectField aria-label="Filtrar por cuidador" value={cuidadorId} onChange={(e) => setCuidadorId(e.target.value)} options={opcionesCuidador} />
          <SelectField
            aria-label="Filtrar por prioridad"
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as Prioridad | '')}
            options={[
              { value: '', label: 'Todas las prioridades' },
              ...PRIORIDADES.map((p) => ({ value: p.value, label: `Prioridad ${p.label.toLowerCase()}` })),
            ]}
          />
        </div>
      </div>

      {/* ───── Lista ───── */}
      {lista.length === 0 ? (
        <EmptyState
          title={filtrando ? 'Sin resultados' : VACIO[tab].title}
          text={filtrando ? 'Ninguna tarea coincide con los filtros. Prueba a quitarlos.' : VACIO[tab].text}
          action={
            gestiona && !filtrando && tab !== 'completadas' ? (
              <div className="mt-3">
                <ButtonLink to={nueva} variant="outline" size="sm" icon={<CalendarPlus size={18} aria-hidden />}>
                  Nueva tarea
                </ButtonLink>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="grid-auto items-stretch" role="tabpanel" aria-label={TABS.find((t) => t.value === tab)?.label}>
          {lista.map((t) => (
            <TareaCard
              key={t.id}
              tarea={t}
              adulto={adultoPorId.get(t.adultoId)}
              cuidador={cuidadorPorId.get(t.cuidadorId)}
              indicacion={t.indicacionId && veIndicacion(t) ? indicacionPorId.get(t.indicacionId) : undefined}
              porValidar={valida ? porValidar.get(t.id) : 0}
              to={`${base}/agenda/${t.id}`}
            />
          ))}
        </div>
      )}

      {/* Móvil: botón fijo sobre la barra de navegación inferior */}
      {gestiona && (
        <div className="md:hidden sticky z-[5] bottom-[calc(var(--bottomnav-h)+var(--safe-bottom)+12px)]">
          <ButtonLink to={nueva} fullWidth className="shadow-[0_6px_16px_rgba(12,59,110,0.35)]" icon={<CalendarPlus size={22} aria-hidden />}>
            Nueva tarea
          </ButtonLink>
        </div>
      )}
    </Page>
  )
}

function Indicador({ label, valor, alerta }: { label: string; valor: number; alerta?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-0.5 min-w-0 min-h-[78px] md:min-h-[96px] px-4 py-3 md:px-5 md:py-4 rounded-sm border ${alerta ? 'bg-warning-100 border-warning' : 'bg-teal-100 border-[#ccdbdd]'}`}
    >
      <span className="text-sm md:text-base font-semibold leading-snug text-ink">{label}</span>
      <span className="text-[2rem] md:text-4xl font-bold leading-tight text-ink">{valor}</span>
    </div>
  )
}
