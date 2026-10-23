/*
 * MisAdultos.tsx — Adultos mayores asignados al voluntario (solo los asignados: RBAC por alcance, RF-09),
 * con buscador por nombre o cédula, riesgo (color + forma), días sin visita y necesidades pendientes.
 * Módulo: voluntario.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { EmptyState, SearchInput } from '@/components/ui'
import { Page } from '@/layouts/AppShell'
import { normalizar } from '@/features/visitas/lib/dominio'
import { AdultoCard } from '../components/AdultoCard'
import { useMisAdultos } from '../lib/resumen'

export function MisAdultos() {
  const mios = useMisAdultos()
  const [q, setQ] = useState('')

  const visibles = useMemo(() => {
    const t = normalizar(q)
    if (!t) return mios
    const digitos = t.replace(/\D/g, '')
    return mios.filter(
      ({ adulto: a }) =>
        normalizar(`${a.nombre} ${a.apellido}`).includes(t) ||
        normalizar(a.cedula).includes(t) ||
        (digitos.length > 0 && a.cedula.replace(/\D/g, '').includes(digitos)),
    )
  }, [mios, q])

  return (
    <Page title="Mis adultos mayores" wide>
      <div className="w-full max-w-[520px]">
        <SearchInput placeholder="Buscar por nombre o cédula" aria-label="Buscar por nombre o cédula" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="-mt-3 text-sm text-ink-2">
        {mios.length} adulto{mios.length === 1 ? '' : 's'} asignado{mios.length === 1 ? '' : 's'} · ordenados por riesgo y días sin visita
      </p>

      {visibles.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]">
          {visibles.map((r) => (
            <AdultoCard key={r.adulto.id} resumen={r} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={q ? 'Sin resultados' : 'Sin adultos asignados'}
          text={q ? `No hay adultos que coincidan con «${q}».` : 'Cuando el coordinador te asigne adultos mayores aparecerán aquí.'}
        />
      )}
    </Page>
  )
}
