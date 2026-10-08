import { useCallback, useMemo, useState } from 'react'
import { ChevronDown, SlidersHorizontal, UserPlus } from 'lucide-react'
import { Button, ButtonLink, ChoicePills, EmptyState, LinkCard, SearchInput, SelectField, Sheet } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import { Page, useShell } from '@/layouts/AppShell'
import type { Usuario } from '@/domain/types'
import { EstadoBadge, MiembroAvatar, RolBadge } from '../components/MiembroUi'
import { normalizar, useMiembros } from '../lib/datos'
import styles from './Miembros.module.css'

type RolFiltro = 'todos' | 'coordinador' | 'cuidador'
type EstadoFiltro = 'todos' | 'activo' | 'inactivo' | 'invitado'
type Orden = 'nombre-asc' | 'nombre-desc' | 'recientes' | 'antiguos'

interface Filtros {
  rol: RolFiltro
  estado: EstadoFiltro
  orden: Orden
}
const INICIAL: Filtros = { rol: 'todos', estado: 'todos', orden: 'nombre-asc' }

const ROLES: Array<{ value: RolFiltro; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'coordinador', label: 'Coordinador' },
  { value: 'cuidador', label: 'Cuidador' },
]
const ESTADOS: Array<{ value: EstadoFiltro; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'invitado', label: 'Invitado' },
]
const ORDENES: Array<{ value: Orden; label: string }> = [
  { value: 'nombre-asc', label: 'Nombre (A-Z)' },
  { value: 'nombre-desc', label: 'Nombre (Z-A)' },
  { value: 'recientes', label: 'Más recientes' },
  { value: 'antiguos', label: 'Más antiguos' },
]

const comparar: Record<Orden, (a: Usuario, b: Usuario) => number> = {
  'nombre-asc': (a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'),
  'nombre-desc': (a, b) => nombreCompleto(b).localeCompare(nombreCompleto(a), 'es'),
  recientes: (a, b) => b.creadoEn.localeCompare(a.creadoEn) || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'),
  antiguos: (a, b) => a.creadoEn.localeCompare(b.creadoEn) || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'),
}

export default function Miembros() {
  const { base } = useShell()
  const miembros = useMiembros()
  const [q, setQ] = useState('')
  const [filtros, setFiltros] = useState<Filtros>(INICIAL)
  const [borrador, setBorrador] = useState<Filtros>(INICIAL)
  const [abierto, setAbierto] = useState(false)

  const hayFiltros = filtros.rol !== 'todos' || filtros.estado !== 'todos' || filtros.orden !== INICIAL.orden

  const lista = useMemo(() => {
    const t = normalizar(q)
    return miembros
      .filter((u) => (filtros.rol === 'todos' ? true : u.rol === filtros.rol))
      .filter((u) => (filtros.estado === 'todos' ? true : u.estado === filtros.estado))
      .filter((u) => !t || normalizar(`${nombreCompleto(u)} ${u.email} ${u.cedula}`).includes(t))
      .sort(comparar[filtros.orden])
  }, [miembros, q, filtros])

  const cerrar = useCallback(() => setAbierto(false), [])
  const abrir = () => {
    setBorrador(filtros)
    setAbierto(true)
  }
  const aplicar = (f: Filtros) => {
    setFiltros(f)
    setAbierto(false)
  }
  const limpiar = () => {
    setQ('')
    setFiltros(INICIAL)
  }

  const nuevo = `${base}/miembros/nuevo`

  return (
    <Page title="Miembros" wide>
      <div className={styles.barra}>
        <SearchInput
          className={styles.buscar}
          placeholder="Buscar miembros..."
          aria-label="Buscar miembros"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className={styles.chips}>
          <ChipSelect
            nombre="Rol"
            valor={filtros.rol}
            opciones={ROLES}
            onChange={(rol) => setFiltros((f) => ({ ...f, rol }))}
          />
          <ChipSelect
            nombre="Estado"
            valor={filtros.estado}
            opciones={ESTADOS}
            onChange={(estado) => setFiltros((f) => ({ ...f, estado }))}
          />
          <button type="button" className={styles.chipFiltros} onClick={abrir} aria-haspopup="dialog">
            Filtros
            <SlidersHorizontal size={16} aria-hidden />
          </button>
        </div>
        <div className={`${styles.agregarEscritorio} only-desktop`}>
          <ButtonLink to={nuevo} size="sm" icon={<UserPlus size={18} aria-hidden />}>
            Agregar miembros
          </ButtonLink>
        </div>
      </div>

      <p className={`${styles.conteo} muted`} aria-live="polite">
        {lista.length} {lista.length === 1 ? 'miembro' : 'miembros'}
      </p>

      {lista.length === 0 ? (
        miembros.length === 0 ? (
          <EmptyState
            title="Aún no hay miembros"
            text="Invita a cuidadores y coordinadores para formar tu red de cuidado."
            action={<ButtonLink to={nuevo}>Agregar miembros</ButtonLink>}
          />
        ) : (
          <EmptyState
            title="Sin resultados"
            text="Prueba con otra búsqueda o limpia los filtros."
            action={
              (q || hayFiltros) && (
                <Button variant="light" size="sm" onClick={limpiar}>
                  Limpiar filtros
                </Button>
              )
            }
          />
        )
      ) : (
        <div className="grid-auto">
          {lista.map((u) => (
            <LinkCard key={u.id} to={`${base}/miembros/${u.id}`}>
              <div className={styles.fila}>
                <MiembroAvatar src={u.avatar} inactivo={u.estado === 'inactivo'} size={48} />
                <div className={styles.datos}>
                  <h3 className={styles.nombre}>{nombreCompleto(u)}</h3>
                  <span className={styles.email}>{u.email}</span>
                </div>
                <div className={styles.estados}>
                  <RolBadge rol={u.rol} inactivo={u.estado === 'inactivo'} />
                  <EstadoBadge estado={u.estado} />
                </div>
              </div>
            </LinkCard>
          ))}
        </div>
      )}

      {/* Móvil: botón fijo sobre la barra de navegación (Figma: «Agregar miembros») */}
      <div className={`${styles.flotante} only-mobile`}>
        <ButtonLink to={nuevo} fullWidth>
          Agregar miembros
        </ButtonLink>
      </div>

      <Sheet
        open={abierto}
        onClose={cerrar}
        title="Filtros"
        footer={
          <>
            <Button variant="light" onClick={() => aplicar(INICIAL)}>
              Limpiar filtros
            </Button>
            <Button onClick={() => aplicar(borrador)}>Aplicar filtros</Button>
          </>
        }
      >
        <ChoicePills label="Rol" value={borrador.rol} options={ROLES} onChange={(rol) => setBorrador((b) => ({ ...b, rol }))} />
        <ChoicePills
          label="Estado"
          value={borrador.estado}
          options={ESTADOS}
          onChange={(estado) => setBorrador((b) => ({ ...b, estado }))}
        />
        <SelectField
          label="Ordenar por"
          value={borrador.orden}
          options={ORDENES}
          onChange={(e) => setBorrador((b) => ({ ...b, orden: e.target.value as Orden }))}
        />
      </Sheet>
    </Page>
  )
}

/** Chip «Rol: Todos ▾» que abre el selector nativo (accesible y cómodo en móvil). */
function ChipSelect<T extends string>({
  nombre,
  valor,
  opciones,
  onChange,
}: {
  nombre: string
  valor: T
  opciones: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  const actual = opciones.find((o) => o.value === valor)
  return (
    <label className={`${styles.chipSelect} ${valor !== 'todos' ? styles.chipActivo : ''}`}>
      <span>
        {nombre}: {actual?.label}
      </span>
      <ChevronDown size={16} aria-hidden />
      <select aria-label={`Filtrar por ${nombre.toLowerCase()}`} value={valor} onChange={(e) => onChange(e.target.value as T)}>
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
