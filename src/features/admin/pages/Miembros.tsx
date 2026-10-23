/*
 * Miembros.tsx — Gestión de usuarios: lista de cuentas de la organización con búsqueda y filtros por rol
 * (Administrador, Coordinador, Voluntario, Familiar responsable), estado y orden.
 * Módulo: admin (RF-09 · CU-13 paso 1 · SRS §13.1 "bandejas de administración de usuarios").
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, KeyRound, SlidersHorizontal, UserPlus } from 'lucide-react'
import { Button, ButtonLink, ChoicePills, EmptyState, LinkCard, SearchInput, SelectField, Sheet } from '@/components/ui'
import { nombreCompleto, useUser } from '@/domain/auth'
import { ROLES } from '@/domain/catalogos'
import type { Rol, Usuario } from '@/domain/types'
import { cn } from '@/lib/cn'
import { Page, useShell } from '@/layouts/AppShell'
import { EstadoBadge, MiembroAvatar, RolBadge } from '../components/MiembroUi'
import { normalizar, useUsuariosOrg } from '../lib/datos'

type RolFiltro = 'todos' | Rol
type EstadoFiltro = 'todos' | 'activo' | 'inactivo' | 'invitado'
type Orden = 'nombre-asc' | 'nombre-desc' | 'recientes' | 'antiguos'

interface Filtros {
  rol: RolFiltro
  estado: EstadoFiltro
  orden: Orden
}
const INICIAL: Filtros = { rol: 'todos', estado: 'todos', orden: 'nombre-asc' }

const ROLES_FILTRO: Array<{ value: RolFiltro; label: string }> = [{ value: 'todos', label: 'Todos' }, ...ROLES]
const ESTADOS: Array<{ value: EstadoFiltro; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'activo', label: 'Activo' },
  { value: 'invitado', label: 'Invitado' },
  { value: 'inactivo', label: 'Inactivo' },
]
const ORDENES: Array<{ value: Orden; label: string }> = [
  { value: 'nombre-asc', label: 'Nombre (A-Z)' },
  { value: 'nombre-desc', label: 'Nombre (Z-A)' },
  { value: 'recientes', label: 'Más recientes' },
  { value: 'antiguos', label: 'Más antiguos' },
]

const porNombre = (a: Usuario, b: Usuario) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es')
const comparar: Record<Orden, (a: Usuario, b: Usuario) => number> = {
  'nombre-asc': porNombre,
  'nombre-desc': (a, b) => porNombre(b, a),
  recientes: (a, b) => b.creadoEn.localeCompare(a.creadoEn) || porNombre(a, b),
  antiguos: (a, b) => a.creadoEn.localeCompare(b.creadoEn) || porNombre(a, b),
}

const esRolFiltro = (v: string | null): v is RolFiltro => !!v && ROLES_FILTRO.some((r) => r.value === v)

export default function Miembros() {
  const { base } = useShell()
  const yo = useUser()
  const usuarios = useUsuariosOrg()
  const [params] = useSearchParams()
  const rolInicial = params.get('rol')
  const [q, setQ] = useState('')
  const [filtros, setFiltros] = useState<Filtros>(() => ({ ...INICIAL, rol: esRolFiltro(rolInicial) ? rolInicial : 'todos' }))
  const [borrador, setBorrador] = useState<Filtros>(INICIAL)
  const [abierto, setAbierto] = useState(false)

  const hayFiltros = filtros.rol !== 'todos' || filtros.estado !== 'todos' || filtros.orden !== INICIAL.orden

  const lista = useMemo(() => {
    const t = normalizar(q)
    return usuarios
      .filter((u) => filtros.rol === 'todos' || u.rol === filtros.rol)
      .filter((u) => filtros.estado === 'todos' || u.estado === filtros.estado)
      .filter((u) => !t || normalizar(`${nombreCompleto(u)} ${u.email} ${u.cedula} ${u.telefono}`).includes(t))
      .sort(comparar[filtros.orden])
  }, [usuarios, q, filtros])

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
    <Page title="Usuarios" wide>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-4">
        <SearchInput
          className="md:flex-[1_1_280px] md:max-w-[420px]"
          placeholder="Buscar por nombre, correo o cédula..."
          aria-label="Buscar usuarios"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <ChipSelect nombre="Rol" valor={filtros.rol} opciones={ROLES_FILTRO} onChange={(rol) => setFiltros((f) => ({ ...f, rol }))} />
          <ChipSelect nombre="Estado" valor={filtros.estado} opciones={ESTADOS} onChange={(estado) => setFiltros((f) => ({ ...f, estado }))} />
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 min-h-12 px-4 rounded-pill border border-navy bg-navy text-white text-sm font-bold whitespace-nowrap hover:bg-navy-700"
            onClick={abrir}
            aria-haspopup="dialog"
          >
            Más filtros
            <SlidersHorizontal size={16} aria-hidden />
          </button>
        </div>
        <div className="hidden md:flex gap-3 md:ml-auto">
          <ButtonLink to={`${base}/roles`} variant="light" size="sm" icon={<KeyRound size={18} aria-hidden />}>
            Roles y permisos
          </ButtonLink>
          <ButtonLink to={nuevo} size="sm" icon={<UserPlus size={18} aria-hidden />}>
            Agregar usuario
          </ButtonLink>
        </div>
      </div>

      <p className="-mt-2 text-sm text-muted" aria-live="polite">
        {lista.length} {lista.length === 1 ? 'usuario' : 'usuarios'}
        {hayFiltros || q ? ` de ${usuarios.length}` : ''}
      </p>

      {lista.length === 0 ? (
        usuarios.length === 0 ? (
          <EmptyState
            title="Aún no hay usuarios"
            text="Invita a coordinadores, voluntarios y familiares para formar tu red de cuidado."
            action={<ButtonLink to={nuevo}>Agregar usuario</ButtonLink>}
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
        <ul className="grid-auto">
          {lista.map((u) => (
            <li key={u.id} className="min-w-0">
              <LinkCard to={`${base}/miembros/${u.id}`} footer={u.id === yo.id ? 'Tu cuenta · Ver más' : 'Ver más'}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
                  <MiembroAvatar src={u.avatar} inactivo={u.estado === 'inactivo'} size={48} />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h3 className="text-xl font-semibold leading-tight text-ink wrap-anywhere">{nombreCompleto(u)}</h3>
                    <span className="text-xs text-ink-2 wrap-anywhere">{u.email}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <RolBadge rol={u.rol} inactivo={u.estado === 'inactivo'} />
                    <EstadoBadge estado={u.estado} />
                  </div>
                </div>
              </LinkCard>
            </li>
          ))}
        </ul>
      )}

      {/* Móvil: botón fijo sobre la barra de navegación */}
      <div className="md:hidden sticky z-[5] bottom-[calc(var(--bottomnav-h)+var(--safe-bottom)+12px)] mt-2 drop-shadow-[0_4px_10px_rgba(12,59,110,0.25)]">
        <ButtonLink to={nuevo} fullWidth icon={<UserPlus size={22} aria-hidden />}>
          Agregar usuario
        </ButtonLink>
      </div>

      <Sheet
        open={abierto}
        onClose={cerrar}
        title="Filtros"
        footer={
          <>
            <Button variant="light" onClick={() => aplicar(INICIAL)}>
              Limpiar
            </Button>
            <Button onClick={() => aplicar(borrador)}>Aplicar</Button>
          </>
        }
      >
        <SelectField label="Rol" value={borrador.rol} options={ROLES_FILTRO} onChange={(e) => setBorrador((b) => ({ ...b, rol: e.target.value as RolFiltro }))} />
        <ChoicePills label="Estado" value={borrador.estado} options={ESTADOS} onChange={(estado) => setBorrador((b) => ({ ...b, estado }))} />
        <SelectField label="Ordenar por" value={borrador.orden} options={ORDENES} onChange={(e) => setBorrador((b) => ({ ...b, orden: e.target.value as Orden }))} />
      </Sheet>
    </Page>
  )
}

/** Chip «Rol: Todos ▾» con el selector nativo superpuesto (accesible y cómodo en móvil). */
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
  const activo = valor !== 'todos'
  return (
    <label
      className={cn(
        'relative inline-flex items-center justify-center gap-1.5 min-h-12 px-4 rounded-pill border text-sm font-bold whitespace-nowrap cursor-pointer',
        'focus-within:outline-3 focus-within:outline-blue focus-within:outline-offset-2',
        activo ? 'bg-blue-100 border-navy text-navy' : 'bg-surface-2 border-line text-ink hover:bg-[#d6dde8]',
      )}
    >
      <span>
        {nombre}: {actual?.label}
      </span>
      <ChevronDown size={16} aria-hidden />
      <select
        aria-label={`Filtrar por ${nombre.toLowerCase()}`}
        className="absolute inset-0 size-full opacity-0 cursor-pointer text-base"
        value={valor}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
