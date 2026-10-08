import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge, ButtonLink, Datum, EmptyState, IconTile, LinkCard, RiesgoBadge, SearchInput } from '@/components/ui'
import { useUser } from '@/domain/auth'
import { useDB } from '@/domain/store'
import type { Riesgo } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { FilaFiltros, FilterChip } from '../components/FilterChip'
import { nombreAdulto, norm, plural } from '../lib/formato'
import { zonasEnUso } from '../lib/zonas'
import styles from './AdultosPage.module.css'

type EstadoFiltro = 'activo' | 'inactivo' | 'todos'

/** Adultos Mayores (Figma 408:1081 admin · 487:1213 coordinador): búsqueda, filtros y tarjetas. */
export default function AdultosPage() {
  const { base } = useShell()
  const user = useUser()
  const todos = useDB((s) => s.adultos)
  const [q, setQ] = useState('')
  const [riesgo, setRiesgo] = useState<'' | Riesgo>('')
  const [zona, setZona] = useState('')
  const [estado, setEstado] = useState<EstadoFiltro>('activo')

  const deLaOrg = useMemo(() => todos.filter((a) => a.orgId === user.orgId), [todos, user.orgId])
  const zonas = useMemo(() => zonasEnUso(deLaOrg), [deLaOrg])
  // El filtro de estado solo aparece si existe algún adulto desactivado (o si ya hay un estado elegido).
  const hayInactivos = estado !== 'activo' || deLaOrg.some((a) => a.estado === 'inactivo')

  const lista = useMemo(() => {
    const t = norm(q)
    return deLaOrg
      .filter((a) => (estado === 'todos' ? true : a.estado === estado))
      .filter((a) => !riesgo || a.riesgo === riesgo)
      .filter((a) => !zona || a.zona === zona)
      .filter((a) => !t || norm(`${nombreAdulto(a)} ${a.cedula} ${a.zona} ${a.municipio}`).includes(t))
      .sort((x, y) => nombreAdulto(x).localeCompare(nombreAdulto(y), 'es'))
  }, [deLaOrg, q, riesgo, zona, estado])

  const hayFiltros = q !== '' || riesgo !== '' || zona !== '' || estado !== 'activo'
  const limpiar = () => {
    setQ('')
    setRiesgo('')
    setZona('')
    setEstado('activo')
  }

  return (
    <Page title="Adultos Mayores" wide>
      <div className={styles.barra}>
        <SearchInput className={styles.buscador} placeholder="Buscar adultos..." aria-label="Buscar adultos" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="only-desktop">
          <ButtonLink to={`${base}/adultos/nuevo`} icon={<Plus size={20} aria-hidden />}>
            Agregar adulto mayor
          </ButtonLink>
        </div>
      </div>

      <FilaFiltros>
        <FilterChip
          etiqueta="Riesgo"
          value={riesgo}
          onChange={setRiesgo}
          opciones={[
            { value: '', label: 'Todos' },
            { value: 'alto', label: 'Alto' },
            { value: 'medio', label: 'Medio' },
            { value: 'bajo', label: 'Bajo' },
          ]}
        />
        <FilterChip etiqueta="Zona" value={zona} onChange={setZona} opciones={[{ value: '', label: 'Todos' }, ...zonas.map((z) => ({ value: z, label: z }))]} />
        {hayInactivos && (
          <FilterChip
            etiqueta="Estado"
            value={estado}
            neutro="activo"
            onChange={setEstado}
            opciones={[
              { value: 'activo', label: 'Activos' },
              { value: 'inactivo', label: 'Inactivos' },
              { value: 'todos', label: 'Todos' },
            ]}
          />
        )}
      </FilaFiltros>

      <p className={styles.conteo} aria-live="polite">
        {plural(lista.length, 'adulto mayor', 'adultos mayores')}
        {hayFiltros && (
          <>
            {' · '}
            <button type="button" className={styles.limpiar} onClick={limpiar}>
              Limpiar filtros
            </button>
          </>
        )}
      </p>

      {lista.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          text={deLaOrg.length === 0 ? 'Aún no hay adultos mayores registrados.' : 'Ningún adulto coincide con la búsqueda o los filtros.'}
          action={
            deLaOrg.length === 0 ? (
              <ButtonLink to={`${base}/adultos/nuevo`}>Agregar adulto mayor</ButtonLink>
            ) : (
              <button type="button" className={styles.limpiar} onClick={limpiar}>
                Limpiar filtros
              </button>
            )
          }
        />
      ) : (
        <div className="grid-auto">
          {lista.map((a) => (
            <LinkCard key={a.id} to={`${base}/adultos/${a.id}`}>
              <div className={styles.cabecera}>
                <IconTile size={48} />
                <h2 className={styles.nombre}>{nombreAdulto(a)}</h2>
                <div className={styles.badges}>
                  {a.estado === 'inactivo' && <Badge tone="neutral">Inactivo</Badge>}
                  <RiesgoBadge riesgo={a.riesgo} />
                </div>
              </div>
              <div className={styles.datos}>
                <Datum label="Cédula" value={a.cedula} />
                <Datum label="Zona" value={a.zona} />
              </div>
            </LinkCard>
          ))}
        </div>
      )}

      <div className="only-mobile">
        <ButtonLink to={`${base}/adultos/nuevo`} fullWidth>
          Agregar adulto mayor
        </ButtonLink>
      </div>
    </Page>
  )
}
