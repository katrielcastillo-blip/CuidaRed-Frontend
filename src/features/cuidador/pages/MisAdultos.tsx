import { useMemo, useState } from 'react'
import { useSession } from '@/domain/auth'
import { useDB } from '@/domain/store'
import { EmptyState, SearchInput } from '@/components/ui'
import { Page } from '@/layouts/AppShell'
import { normalizar } from '@/features/visitas/lib/dominio'
import { AdultoCard } from '../components/AdultoCard'
import styles from './MisAdultos.module.css'

/** Mis Adultos Mayores (Figma 358:2707): buscador por nombre o cédula y tarjetas con riesgo, cédula y zona. */
export function MisAdultos() {
  const { user } = useSession()
  const adultos = useDB((s) => s.adultos)
  const [q, setQ] = useState('')

  const mios = useMemo(
    () =>
      adultos
        .filter((a) => a.estado === 'activo' && !!user && a.cuidadorIds.includes(user.id))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [adultos, user],
  )

  const visibles = useMemo(() => {
    const t = normalizar(q)
    if (!t) return mios
    const digitos = t.replace(/\D/g, '')
    return mios.filter(
      (a) =>
        normalizar(`${a.nombre} ${a.apellido}`).includes(t) ||
        normalizar(a.cedula).includes(t) ||
        (digitos.length > 0 && a.cedula.replace(/\D/g, '').includes(digitos)),
    )
  }, [mios, q])

  return (
    <Page title="Mis Adultos Mayores" wide>
      <div className={styles.buscador}>
        <SearchInput placeholder="Buscar..." aria-label="Buscar por nombre o cédula" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {visibles.length > 0 ? (
        <div className={styles.rejilla}>
          {visibles.map((a) => (
            <AdultoCard key={a.id} adulto={a} dato={{ label: 'Zona', value: a.zona }} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={q ? 'Sin resultados' : 'Sin adultos asignados'}
          text={q ? `No hay adultos que coincidan con «${q}».` : 'Cuando te asignen adultos mayores aparecerán aquí.'}
        />
      )}
    </Page>
  )
}
