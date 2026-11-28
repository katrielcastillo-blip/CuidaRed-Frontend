/*
 * SelectorAdultos.tsx — Casillas con los adultos mayores activos de la cuenta (con búsqueda) para elegir a cuáles
 * tendrá acceso un miembro: «familiar responsable» (permiso explícito), «cuidador asignado» o «voluntario asignado».
 * Módulo: admin (RF-09 · CU-13 · Reglas de Negocio V2 §Vínculo y §Familiar).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { CheckboxGroup, SearchInput } from '@/components/ui'
import { nombreCompleto, useSession } from '@/domain/auth'
import { nombreMunicipio } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import { cn } from '@/lib/cn'
import { normalizar } from '../lib/datos'

/** Cuántos adultos hacen falta para mostrar el buscador. */
const MIN_PARA_BUSCAR = 6

export function SelectorAdultos({
  valor,
  onChange,
  titulo,
  error,
  hint,
  help,
  deshabilitado,
}: {
  valor: string[]
  onChange: (ids: string[]) => void
  /** Etiqueta del grupo («Adultos mayores que puede ver»). */
  titulo: string
  error?: string
  hint?: string
  help?: ReactNode
  deshabilitado?: boolean
}) {
  const { org } = useSession()
  const adultos = useDB((s) => s.adultos)
  const catalogos = useDB((s) => s.catalogos)
  const [busqueda, setBusqueda] = useState('')

  /** Adultos activos de la cuenta; los ya marcados siempre aparecen, aunque no coincidan con la búsqueda. */
  const delaCuenta = useMemo(
    () =>
      adultos
        .filter((a) => a.orgId === org?.id && (valor.includes(a.id) || (a.estado === 'activo' && !a.anonimizado)))
        .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es')),
    [adultos, org, valor],
  )
  const opciones = useMemo(() => {
    const q = normalizar(busqueda)
    return delaCuenta
      .filter((a) => !q || valor.includes(a.id) || normalizar(`${nombreCompleto(a)} ${a.cedula} ${a.zona}`).includes(q))
      .map((a) => ({ value: a.id, label: `${nombreCompleto(a)} · ${[a.zona, nombreMunicipio(catalogos, a.municipioCod)].filter(Boolean).join(', ')}` }))
  }, [delaCuenta, catalogos, busqueda, valor])

  if (delaCuenta.length === 0) {
    return <p className="p-4 rounded-md bg-surface-2 text-sm text-ink-2">Aún no hay adultos mayores activos en la cuenta. Registra uno para poder darle acceso a este miembro.</p>
  }

  return (
    <div className={cn('flex flex-col gap-3 min-w-0', deshabilitado && 'opacity-60')}>
      {delaCuenta.length >= MIN_PARA_BUSCAR && (
        <SearchInput aria-label="Buscar adulto mayor por nombre, cédula o sector" placeholder="Buscar adulto mayor…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      )}
      <fieldset disabled={deshabilitado} className="min-w-0 border-0 p-0 m-0">
        <CheckboxGroup
          label={`${titulo} (${valor.length} seleccionado${valor.length === 1 ? '' : 's'})`}
          columns={1}
          options={opciones}
          value={valor}
          error={error}
          hint={opciones.length === 0 ? 'No hay adultos mayores que coincidan con la búsqueda.' : hint}
          help={help}
          onChange={onChange}
        />
      </fieldset>
    </div>
  )
}
