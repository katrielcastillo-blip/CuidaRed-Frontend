/*
 * VisitasPage.tsx — Agenda de visitas de la organización para el coordinador: pestañas Hoy · Próximas ·
 * Historial, filtros por voluntario responsable y estado, búsqueda (adulto, voluntario o motivo) y registros
 * pendientes de sincronización. Cada visita muestra su motivo (Visit_razon) y los adultos adicionales del
 * hogar (DetalleVisita) (CU-05 · CU-06 · RF-10).
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, CalendarPlus } from 'lucide-react'
import { ButtonLink, EmptyState, SearchInput, Segmented, SelectField } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import type { Adulto, EstadoVisita, Usuario, Visita } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { VisitaCard } from './components/VisitaCard'
import { ESTADO_VISITA, useOrgData } from './lib/datos'

type Tab = 'hoy' | 'proximas' | 'historial'
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'proximas', label: 'Próximas' },
  { value: 'historial', label: 'Historial' },
]
const esTab = (v: string | null): v is Tab => v === 'hoy' || v === 'proximas' || v === 'historial'

const ESTADOS = Object.entries(ESTADO_VISITA).map(([value, e]) => ({ value: value as EstadoVisita, label: e.label }))
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const clave = (v: Visita) => `${v.fecha} ${v.horaPautada}`

const VACIO: Record<Tab, { title: string; text: string }> = {
  hoy: { title: 'No hay visitas para hoy', text: 'Programa una visita para que aparezca en la agenda del día.' },
  proximas: { title: 'No hay visitas próximas', text: 'Las visitas programadas a futuro aparecerán aquí.' },
  historial: { title: 'El historial está vacío', text: 'Aquí verás las visitas pasadas y las canceladas.' },
}

export function VisitasPage() {
  const { base } = useShell()
  const { user, visitas, adultoPorId, usuarioPorId, voluntarios } = useOrgData()
  const [params, setParams] = useSearchParams()
  const tab: Tab = esTab(params.get('tab')) ? (params.get('tab') as Tab) : 'hoy'
  const [q, setQ] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [estado, setEstado] = useState<EstadoVisita | ''>('')

  const hoy = todayISO()

  const grupos = useMemo(() => {
    const noCanceladas = visitas.filter((v) => v.estado !== 'cancelada')
    return {
      hoy: noCanceladas.filter((v) => v.fecha === hoy).sort((a, b) => clave(a).localeCompare(clave(b))),
      proximas: noCanceladas.filter((v) => v.fecha > hoy).sort((a, b) => clave(a).localeCompare(clave(b))),
      historial: visitas.filter((v) => v.estado === 'cancelada' || v.fecha < hoy).sort((a, b) => clave(b).localeCompare(clave(a))),
    } satisfies Record<Tab, Visita[]>
  }, [visitas, hoy])

  const pendientesSync = useMemo(() => visitas.filter((v) => v.pendienteSync).length, [visitas])

  const lista = useMemo(() => {
    const t = norm(q.trim())
    return grupos[tab].filter((v) => {
      if (responsableId && v.cuidadorId !== responsableId) return false
      if (estado && v.estado !== estado) return false
      if (!t) return true
      const adulto = adultoPorId.get(v.adultoId)
      const resp = usuarioPorId.get(v.cuidadorId)
      const otros = v.detallesAdicionales.map((d) => adultoPorId.get(d.adultoId)).filter((a): a is Adulto => !!a)
      return norm([adulto ? nombreCompleto(adulto) : '', ...otros.map(nombreCompleto), resp ? nombreCompleto(resp) : '', v.tipo, v.razon].join(' ')).includes(t)
    })
  }, [grupos, tab, q, responsableId, estado, adultoPorId, usuarioPorId])

  // Voluntarios de la organización + cualquier otro responsable que aparezca en la agenda (p. ej. un coordinador).
  const opcionesResponsable = useMemo(() => {
    const ids = new Set([...voluntarios.map((u) => u.id), ...visitas.map((v) => v.cuidadorId)])
    const personas = [...ids].map((id) => usuarioPorId.get(id)).filter((u): u is Usuario => !!u)
    personas.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'))
    return [{ value: '', label: 'Todos los voluntarios' }, ...personas.map((u) => ({ value: u.id, label: nombreCompleto(u) }))]
  }, [voluntarios, visitas, usuarioPorId])

  const filtrando = q.trim() !== '' || responsableId !== '' || estado !== ''
  const puedeProgramar = puede(user, 'visitas:programar')
  const programar = `${base}/visitas/programar`

  return (
    <Page
      title="Visitas"
      wide
      actions={
        puedeProgramar ? (
          <div className="hidden md:block">
            <ButtonLink to={programar} variant="light" size="sm" icon={<CalendarPlus size={18} aria-hidden />}>
              Programar visita
            </ButtonLink>
          </div>
        ) : undefined
      }
    >
      {/* ───── Indicadores ───── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4" aria-label="Resumen de visitas">
        <div className="relative col-span-2 md:col-span-1 flex flex-col gap-0.5 min-h-[106px] px-5 py-4 rounded-sm bg-teal-100 border border-[#ccdbdd]">
          <span className="text-base font-semibold text-ink">Visitas programadas para hoy</span>
          <span className="text-4xl font-bold leading-tight text-ink">{grupos.hoy.length}</span>
          <CalendarDays size={32} className="absolute right-4 bottom-3 text-success-700" aria-hidden />
        </div>
        <Indicador label="Visitas próximas" valor={grupos.proximas.length} />
        <Indicador label={pendientesSync ? 'Pendientes de sincronizar' : 'Total de visitas'} valor={pendientesSync || visitas.length} />
      </section>

      {/* ───── Filtros ───── */}
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <div className="min-w-0 md:flex-[0_1_380px]">
          <Segmented label="Agenda de visitas" value={tab} options={TABS} onChange={(v) => setParams(v === 'hoy' ? {} : { tab: v }, { replace: true })} />
        </div>
        <SearchInput
          className="min-w-0 md:flex-[1_1_220px]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por adulto, voluntario o motivo..."
          aria-label="Buscar visitas"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:flex-[1_1_420px]">
          <div className="min-w-0 md:flex-1">
            <SelectField
              aria-label="Filtrar por voluntario responsable"
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
              options={opcionesResponsable}
            />
          </div>
          <div className="min-w-0 md:flex-1">
            <SelectField
              aria-label="Filtrar por estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoVisita | '')}
              options={[{ value: '', label: 'Todos los estados' }, ...ESTADOS]}
            />
          </div>
        </div>
      </div>

      {/* ───── Lista ───── */}
      {lista.length === 0 ? (
        <EmptyState
          title={filtrando ? 'Sin resultados' : VACIO[tab].title}
          text={filtrando ? 'Prueba con otro nombre o quita los filtros.' : VACIO[tab].text}
        />
      ) : (
        <div className="grid-auto items-stretch" role="tabpanel" aria-label={TABS.find((t) => t.value === tab)?.label}>
          {lista.map((v) => (
            <VisitaCard
              key={v.id}
              visita={v}
              adulto={adultoPorId.get(v.adultoId)}
              adicionales={v.detallesAdicionales.map((d) => adultoPorId.get(d.adultoId)).filter((a): a is Adulto => !!a)}
              responsable={usuarioPorId.get(v.cuidadorId)}
              to={`${base}/visitas/${v.id}`}
            />
          ))}
        </div>
      )}

      {/* Móvil: botón fijo sobre la barra de navegación inferior */}
      {puedeProgramar && (
        <div className="md:hidden sticky z-[5] bottom-[calc(var(--bottomnav-h)+var(--safe-bottom)+12px)]">
          <ButtonLink to={programar} fullWidth className="shadow-[0_6px_16px_rgba(12,59,110,0.35)]" icon={<CalendarPlus size={22} aria-hidden />}>
            Programar visita
          </ButtonLink>
        </div>
      )}
    </Page>
  )
}

function Indicador({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0 min-h-[78px] md:min-h-[106px] px-4 py-3 md:px-5 md:py-4 rounded-sm bg-teal-100 border border-[#ccdbdd]">
      <span className="text-sm md:text-base font-semibold leading-snug text-ink">{label}</span>
      <span className="text-[2rem] md:text-4xl font-bold leading-tight text-ink">{valor}</span>
    </div>
  )
}
