/*
 * AlertasPage.tsx — Bandeja de alertas (CU-09 · CU-10 · RF-04 · RF-05): ordenada por urgencia
 * (Alta → Media → Baja) y fecha, con la urgencia diferenciada por color + icono + texto, filtros por
 * estado, tipo (catálogo Alertas) y prioridad (catálogo Prioridad), búsqueda y contadores. Las alertas de
 * "NECESIDAD ATRASADA" (Env_Necesidad.Umbral_alerta) muestran la necesidad que las originó. Solo muestra las
 * alertas al alcance del usuario (alertasVisibles).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellDot, Clock, Cpu, HandHelping } from 'lucide-react'
import { EmptyState, SearchInput } from '@/components/ui'
import { alertasVisibles } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { relativo } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { EstadoAlerta, Prioridad, TipoAlerta } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { FilaFiltros, FilterChip } from '../components/FilterChip'
import { EstadoAlertaBadge, UrgenciaBadge, URGENCIA_VISUAL } from '../components/Piezas'
import { necesidadDeAlerta, nombreCatalogo } from '../lib/datos'
import { nombreAdulto, norm, PESO_SEVERIDAD, plural, TIPO_NECESIDAD_TEXTO } from '../lib/formato'
import { ubicacionCorta } from '../lib/ubicacion'
import { useVolver } from '../lib/navegacion'

type FiltroEstado = 'abiertas' | EstadoAlerta | 'todas'

const CONTADORES: Array<{ value: FiltroEstado; label: string; clase: string }> = [
  { value: 'pendiente', label: 'Pendientes', clase: 'text-danger' },
  { value: 'en_atencion', label: 'En atención', clase: 'text-warning-700' },
  { value: 'atendida', label: 'Atendidas', clase: 'text-success-700' },
]

export default function AlertasPage() {
  const { base } = useShell()
  const user = useUser()
  const { back } = useVolver(`${base}/mas`)
  const alertas = useDB((s) => s.alertas)
  const adultos = useDB((s) => s.adultos)
  const necesidades = useDB((s) => s.necesidades)
  const catalogos = useDB((s) => s.catalogos)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('abiertas')
  const [tipo, setTipo] = useState<'' | TipoAlerta>('')
  const [prioridad, setPrioridad] = useState<'' | Prioridad>('')

  const visibles = useMemo(() => alertasVisibles({ alertas, adultos }, user), [alertas, adultos, user])
  const adultoPorId = useMemo(() => new Map(adultos.map((a) => [a.id, a])), [adultos])

  const conteo = useMemo(
    () => ({
      pendiente: visibles.filter((a) => a.estado === 'pendiente').length,
      en_atencion: visibles.filter((a) => a.estado === 'en_atencion').length,
      atendida: visibles.filter((a) => a.estado === 'atendida').length,
      altaAbiertas: visibles.filter((a) => a.severidad === 'alta' && a.estado !== 'atendida').length,
      sinLeer: visibles.filter((a) => a.estado !== 'atendida' && !a.leidaPor.includes(user.id)).length,
    }),
    [visibles, user.id],
  )

  const lista = useMemo(() => {
    const t = norm(q)
    return visibles
      .filter((al) => (estado === 'todas' ? true : estado === 'abiertas' ? al.estado !== 'atendida' : al.estado === estado))
      .filter((al) => !tipo || al.tipo === tipo)
      .filter((al) => !prioridad || al.severidad === prioridad)
      .filter((al) => {
        if (!t) return true
        const a = adultoPorId.get(al.adultoId)
        return norm(`${a ? nombreAdulto(a) : ''} ${al.categoria} ${al.titulo} ${al.descripcion} ${nombreCatalogo(catalogos.alertas, al.tipo)}`).includes(t)
      })
      .sort((x, y) => PESO_SEVERIDAD[x.severidad] - PESO_SEVERIDAD[y.severidad] || y.creadaEn.localeCompare(x.creadaEn))
  }, [visibles, adultoPorId, q, estado, tipo, prioridad, catalogos.alertas])

  return (
    <Page title="Alertas" back={back} hideAvatar wide>
      {/* Contadores: también filtran por estado */}
      <div className="grid grid-cols-3 gap-2 md:max-w-xl" role="group" aria-label="Filtrar por estado">
        {CONTADORES.map((c) => {
          const activo = estado === c.value
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={activo}
              onClick={() => setEstado(activo ? 'abiertas' : c.value)}
              className={cn(
                'flex flex-col items-start justify-between gap-1 min-h-[68px] px-3 py-2 rounded-sm border text-left transition-colors',
                activo ? 'border-navy bg-blue-100' : 'border-line-soft bg-surface hover:border-line',
              )}
            >
              <span className="text-xs font-semibold text-ink-2">{c.label}</span>
              <span className={cn('text-2xl font-bold leading-none', c.clase)}>{conteo[c.value as EstadoAlerta]}</span>
            </button>
          )
        })}
      </div>

      <SearchInput className="max-w-[560px]" placeholder="Buscar por adulto o tipo" aria-label="Buscar alertas" value={q} onChange={(e) => setQ(e.target.value)} />

      <FilaFiltros>
        <FilterChip<FiltroEstado>
          etiqueta="Estado"
          value={estado}
          onChange={setEstado}
          neutro="abiertas"
          opciones={[
            { value: 'abiertas', label: 'Abiertas' },
            { value: 'pendiente', label: 'Pendiente' },
            { value: 'en_atencion', label: 'En atención' },
            { value: 'atendida', label: 'Atendida' },
            { value: 'todas', label: 'Todas' },
          ]}
        />
        <FilterChip<'' | TipoAlerta>
          etiqueta="Tipo"
          value={tipo}
          onChange={setTipo}
          opciones={[{ value: '', label: 'Todos' }, ...catalogos.alertas.map((t) => ({ value: t.id, label: t.nombre }))]}
        />
        <FilterChip<'' | Prioridad>
          etiqueta="Prioridad"
          value={prioridad}
          onChange={setPrioridad}
          opciones={[{ value: '', label: 'Todas' }, ...catalogos.prioridades.map((p) => ({ value: p.id, label: p.nombre }))]}
        />
      </FilaFiltros>

      <div className="flex flex-wrap items-center justify-between gap-2 -my-2 text-sm text-ink-2" aria-live="polite">
        <span>
          Mostrando <b className="text-ink">{plural(lista.length, 'alerta', 'alertas')}</b> · de prioridad Alta a Baja
        </span>
        {conteo.altaAbiertas > 0 && (
          <span className="px-3 py-1 rounded-pill bg-danger-100 text-danger text-xs font-bold">
            {conteo.altaAbiertas === 1 ? '1 alerta de prioridad Alta abierta' : `${conteo.altaAbiertas} alertas de prioridad Alta abiertas`}
          </span>
        )}
      </div>

      {lista.length === 0 ? (
        <EmptyState title="Sin alertas" text={visibles.length === 0 ? 'No hay alertas registradas.' : 'Ninguna alerta coincide con la búsqueda o los filtros.'} />
      ) : (
        <ul className="grid-auto" aria-label="Alertas">
          {lista.map((al) => {
            const a = adultoPorId.get(al.adultoId)
            const v = URGENCIA_VISUAL[al.severidad]
            const nueva = al.estado !== 'atendida' && !al.leidaPor.includes(user.id)
            const nec = necesidadDeAlerta(al, necesidades)
            return (
              <li key={al.id}>
                <Link
                  to={`${base}/alertas/${al.id}`}
                  className={cn(
                    'flex flex-col gap-3 h-full p-4 rounded-md border-l-4 bg-surface shadow-1 transition-shadow hover:shadow-2',
                    v.borde,
                    al.estado === 'atendida' && 'opacity-80',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('grid place-items-center size-10 flex-none rounded-full', v.icono)} aria-hidden>
                      <v.Icono size={20} />
                    </span>
                    <div className="flex flex-col flex-1 min-w-0 leading-tight">
                      <strong className="text-base font-bold wrap-anywhere">{a ? nombreAdulto(a) : 'Adulto no disponible'}</strong>
                      <small className="text-xs text-muted">
                        {nombreCatalogo(catalogos.alertas, al.tipo)}
                        {a ? ` · ${ubicacionCorta(catalogos, a)}` : ''}
                      </small>
                    </div>
                    <span className="inline-flex items-center gap-1 flex-none text-[11px] text-muted whitespace-nowrap">
                      <Clock size={13} aria-hidden />
                      {relativo(al.creadaEn)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{al.categoria}</p>
                    <p className="text-sm font-semibold text-ink">{al.titulo}</p>
                    <p className="text-sm leading-normal text-ink-2 line-clamp-2">{al.descripcion}</p>
                    {nec && (
                      <p className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold text-navy">
                        <HandHelping size={14} aria-hidden /> Necesidad: {nec.catalogoId ? nombreCatalogo(catalogos.necesidades, nec.catalogoId) : TIPO_NECESIDAD_TEXTO[nec.tipo]} · enlace en el detalle
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-surface-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <UrgenciaBadge severidad={al.severidad} />
                      <EstadoAlertaBadge estado={al.estado} />
                      {nueva && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue">
                          <BellDot size={14} aria-hidden /> Nueva
                        </span>
                      )}
                      {al.generadaPor === 'sistema' && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted" title="Generada automáticamente">
                          <Cpu size={13} aria-hidden /> Automática
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 flex-none min-h-12 text-sm font-bold text-navy">
                      Ver <ArrowRight size={16} aria-hidden />
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Page>
  )
}
