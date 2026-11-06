/*
 * MisAdultos.tsx — Adultos mayores asignados al cuidador en su cuenta activa (solo los asignados: RBAC por
 * alcance, RF-09), con buscador por nombre o cédula, filtros por riesgo, alertas abiertas y días sin visita,
 * riesgo (color + forma), necesidades pendientes y alertas. Los filtros viajan en la URL (?riesgo=alto&alertas=1).
 * Módulo: cuidador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, Clock } from 'lucide-react'
import type { Riesgo } from '@/domain/types'
import { Button, Chip, EmptyState, SearchInput, Segmented } from '@/components/ui'
import { Page } from '@/layouts/AppShell'
import { AdultoCard } from '../components/AdultoCard'
import { filtrarAdultos, useMisAdultos, useUmbralSinVisita } from '../lib/resumen'

type FiltroRiesgo = Riesgo | 'todos'
const NIVELES: Riesgo[] = ['alto', 'medio', 'bajo']

export function MisAdultos() {
  const mios = useMisAdultos()
  const umbral = useUmbralSinVisita()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')

  const riesgo: FiltroRiesgo = NIVELES.find((n) => n === params.get('riesgo')) ?? 'todos'
  const conAlertas = params.get('alertas') === '1'
  const atrasados = params.get('atrasados') === '1'
  const cambiar = (clave: string, valor: string | null) =>
    setParams(
      (previo) => {
        const nuevo = new URLSearchParams(previo)
        if (valor) nuevo.set(clave, valor)
        else nuevo.delete(clave)
        return nuevo
      },
      { replace: true },
    )

  const visibles = useMemo(() => filtrarAdultos(mios, { q, riesgo, conAlertas, atrasados }), [mios, q, riesgo, conAlertas, atrasados])
  const totalAlertas = useMemo(() => mios.filter((r) => r.alertas > 0).length, [mios])
  const totalAtrasados = useMemo(() => mios.filter((r) => r.atrasado).length, [mios])
  const filtrando = !!q.trim() || riesgo !== 'todos' || conAlertas || atrasados
  const limpiar = () => {
    setQ('')
    setParams({}, { replace: true })
  }

  return (
    <Page title="Mis adultos mayores" wide>
      <div className="flex flex-col gap-4">
        <div className="w-full max-w-[520px]">
          <SearchInput placeholder="Buscar por nombre o cédula" aria-label="Buscar por nombre o cédula" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {mios.length > 0 && (
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            <div className="w-full md:max-w-[400px]">
              <Segmented<FiltroRiesgo>
                label="Filtrar por riesgo"
                value={riesgo}
                onChange={(v) => cambiar('riesgo', v === 'todos' ? null : v)}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'alto', label: 'Alto' },
                  { value: 'medio', label: 'Medio' },
                  { value: 'bajo', label: 'Bajo' },
                ]}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip active={conAlertas} onClick={() => cambiar('alertas', conAlertas ? null : '1')}>
                <Bell size={16} aria-hidden /> Con alertas ({totalAlertas})
              </Chip>
              <Chip active={atrasados} onClick={() => cambiar('atrasados', atrasados ? null : '1')}>
                <Clock size={16} aria-hidden /> Más de {umbral} días sin visita ({totalAtrasados})
              </Chip>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 -mt-3" aria-live="polite">
        <p className="text-sm text-ink-2">
          {filtrando ? `${visibles.length} de ${mios.length} adultos` : `${mios.length} adulto${mios.length === 1 ? '' : 's'} asignado${mios.length === 1 ? '' : 's'}`} · ordenados por riesgo y días sin
          visita
        </p>
        {filtrando && (
          <Button variant="ghost" onClick={limpiar}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {visibles.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]">
          {visibles.map((r) => (
            <AdultoCard key={r.adulto.id} resumen={r} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={filtrando ? 'Sin resultados' : 'Sin adultos asignados'}
          text={filtrando ? 'Ningún adulto asignado coincide con la búsqueda y los filtros elegidos.' : 'Cuando el coordinador te asigne adultos mayores aparecerán aquí.'}
          action={
            filtrando ? (
              <Button variant="outline" size="sm" onClick={limpiar}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      )}
    </Page>
  )
}
