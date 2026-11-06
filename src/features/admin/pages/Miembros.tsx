/*
 * Miembros.tsx — Miembros de la cuenta activa: lista a partir de las membresías (rol y estado en ESTA cuenta) con
 * búsqueda y filtros por rol, estado y orden. En una Organización la gestiona el Administrador; en una cuenta Familia,
 * el Coordinador. Muestra el uso del límite de usuarios del plan (el voluntario ocasional no cuenta).
 * Módulo: admin (RF-09 · CU-13 paso 1 · SRS §13.1 "bandejas de administración de usuarios").
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, KeyRound, SlidersHorizontal, UserPlus } from 'lucide-react'
import { Button, ButtonLink, ChoicePills, EmptyState, LinkCard, SearchInput, SelectField, Sheet } from '@/components/ui'
import { usoDeCuenta } from '@/domain/api'
import { nombreCompleto, ROL_LABEL, useSession, useUser } from '@/domain/auth'
import { puede } from '@/domain/permisos'
import { tipoDeCuenta, TIPO_CUENTA_LABEL } from '@/domain/planes'
import { VINCULO_DE_ROL } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Rol } from '@/domain/types'
import { cn } from '@/lib/cn'
import { Page, useShell } from '@/layouts/AppShell'
import { BarraUso } from '../components/BarraUso'
import { EstadoBadge, MiembroAvatar, RolBadge } from '../components/MiembroUi'
import { normalizar, useMiembros, type Miembro } from '../lib/datos'
import { rolesDeTipo } from '../lib/permisos'

type RolFiltro = 'todos' | Rol
type EstadoFiltro = 'todos' | 'activo' | 'inactivo' | 'invitado'
type Orden = 'nombre-asc' | 'nombre-desc' | 'recientes' | 'antiguos'

interface Filtros {
  rol: RolFiltro
  estado: EstadoFiltro
  orden: Orden
}
const INICIAL: Filtros = { rol: 'todos', estado: 'todos', orden: 'nombre-asc' }

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

const porNombre = (a: Miembro, b: Miembro) => nombreCompleto(a.usuario).localeCompare(nombreCompleto(b.usuario), 'es')
const comparar: Record<Orden, (a: Miembro, b: Miembro) => number> = {
  'nombre-asc': porNombre,
  'nombre-desc': (a, b) => porNombre(b, a),
  recientes: (a, b) => b.membresia.fechaInicio.localeCompare(a.membresia.fechaInicio) || porNombre(a, b),
  antiguos: (a, b) => a.membresia.fechaInicio.localeCompare(b.membresia.fechaInicio) || porNombre(a, b),
}

export default function Miembros() {
  const { base } = useShell()
  const yo = useUser()
  const { org } = useSession()
  const miembros = useMiembros()
  const adultos = useDB((s) => s.adultos)
  const usuarios = useDB((s) => s.usuarios)
  const membresias = useDB((s) => s.membresias)
  const catalogos = useDB((s) => s.catalogos)
  const vinculos = useDB((s) => s.vinculos)
  const [params] = useSearchParams()
  const tipo = tipoDeCuenta(org)
  const roles = useMemo(() => rolesDeTipo(tipo), [tipo])
  const rolesFiltro = useMemo<Array<{ value: RolFiltro; label: string }>>(() => [{ value: 'todos', label: 'Todos' }, ...roles.map((r) => ({ value: r, label: ROL_LABEL[r] }))], [roles])

  const rolInicial = params.get('rol')
  const [q, setQ] = useState('')
  const [filtros, setFiltros] = useState<Filtros>(() => ({ ...INICIAL, rol: roles.includes(rolInicial as Rol) ? (rolInicial as Rol) : 'todos' }))
  const [borrador, setBorrador] = useState<Filtros>(INICIAL)
  const [abierto, setAbierto] = useState(false)

  const hayFiltros = filtros.rol !== 'todos' || filtros.estado !== 'todos' || filtros.orden !== INICIAL.orden
  const gestiona = puede(yo, 'usuarios:gestionar')

  /** Adultos de la cuenta a los que tiene acceso cada miembro con el vínculo de su rol (familiar, cuidador o voluntario). */
  const accesos = useMemo(() => {
    const propios = new Set(adultos.filter((a) => a.orgId === org?.id).map((a) => a.id))
    const mapa = new Map<string, number>()
    for (const v of vinculos) {
      if (!propios.has(v.adultoId)) continue
      const clave = `${v.usuarioId}|${v.tipoVinculoId}`
      mapa.set(clave, (mapa.get(clave) ?? 0) + 1)
    }
    return mapa
  }, [adultos, vinculos, org])

  const uso = useMemo(() => usoDeCuenta({ adultos, usuarios, membresias, catalogos }, org), [adultos, usuarios, membresias, catalogos, org])

  const lista = useMemo(() => {
    const t = normalizar(q)
    return miembros
      .filter((m) => filtros.rol === 'todos' || m.rol === filtros.rol)
      .filter((m) => filtros.estado === 'todos' || m.estado === filtros.estado)
      .filter((m) => !t || normalizar(`${nombreCompleto(m.usuario)} ${m.usuario.email} ${m.usuario.cedula} ${m.usuario.telefono}`).includes(t))
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
  const etiquetaCuenta = `Cuenta ${TIPO_CUENTA_LABEL[tipo]}${org ? ` · ${org.nombre}` : ''}`

  return (
    <Page title="Miembros" wide>
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted wrap-anywhere">{etiquetaCuenta}</p>
        <p className="text-sm text-ink-2">
          {tipo === 'familia'
            ? 'Como coordinador gestionas quién accede a la cuenta y qué adultos mayores puede ver cada persona.'
            : 'Gestiona quién accede a la organización, su rol y los adultos mayores que puede ver cada persona.'}
        </p>
      </header>

      <section className="flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1 md:max-w-xl" aria-label="Uso del límite de usuarios del plan">
        <BarraUso etiqueta="Usuarios del plan" usado={uso.usuarios} limite={uso.limites.usuarios} excede={uso.excedeUsuarios} />
        <p className="text-xs text-muted">
          {tipo === 'organizacion' && (
            <>
              {uso.voluntarios > 0 ? `${uso.voluntarios} ${uso.voluntarios === 1 ? 'voluntario ocasional no cuenta' : 'voluntarios ocasionales no cuentan'} ` : 'Los voluntarios ocasionales no cuentan '}
              para este límite: registran visitas sin plan propio.{' '}
            </>
          )}
          {tipo === 'familia' && 'Cuenta a todas las personas con acceso a la cuenta. '}
          {puede(yo, 'cuenta:suscripcion') && (
            <Link to={`${base}/suscripcion`} className="font-bold text-navy hover:underline">
              Ver plan
            </Link>
          )}
        </p>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-4">
        <SearchInput
          className="md:flex-[1_1_280px] md:max-w-[420px]"
          placeholder="Buscar por nombre, correo o cédula..."
          aria-label="Buscar miembros"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <ChipSelect nombre="Rol" valor={filtros.rol} opciones={rolesFiltro} onChange={(rol) => setFiltros((f) => ({ ...f, rol }))} />
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
          {gestiona && (
            <ButtonLink to={nuevo} size="sm" icon={<UserPlus size={18} aria-hidden />}>
              Agregar miembro
            </ButtonLink>
          )}
        </div>
      </div>

      <p className="-mt-2 text-sm text-muted" aria-live="polite">
        {lista.length} {lista.length === 1 ? 'miembro' : 'miembros'}
        {hayFiltros || q ? ` de ${miembros.length}` : ''}
      </p>

      {lista.length === 0 ? (
        miembros.length === 0 ? (
          <EmptyState
            title="Aún no hay miembros"
            text="Invita a coordinadores, cuidadores, voluntarios y familiares para formar tu red de cuidado."
            action={<ButtonLink to={nuevo}>Agregar miembro</ButtonLink>}
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
          {lista.map(({ usuario: u, rol, estado }) => {
            const n = accesos.get(`${u.id}|${VINCULO_DE_ROL[rol]}`) ?? 0
            const conAcceso = !!VINCULO_DE_ROL[rol] && estado !== 'inactivo'
            return (
              <li key={u.id} className="min-w-0">
                <LinkCard to={`${base}/miembros/${u.id}`} footer={u.id === yo.id ? 'Tu cuenta · Ver más' : 'Ver más'}>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
                    <MiembroAvatar src={u.avatar} inactivo={estado === 'inactivo'} size={48} />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <h3 className="text-xl font-semibold leading-tight text-ink wrap-anywhere">{nombreCompleto(u)}</h3>
                      <span className="text-xs text-ink-2 wrap-anywhere">{u.email}</span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <RolBadge rol={rol} inactivo={estado === 'inactivo'} />
                      <EstadoBadge estado={estado} />
                    </div>
                  </div>
                  {conAcceso && (
                    <p className={cn('mt-3 text-xs font-semibold', n === 0 ? 'text-warning-700' : 'text-ink-2')}>
                      {n === 0
                        ? rol === 'familiar'
                          ? 'Sin autorización: no ve ningún adulto mayor'
                          : 'Sin adultos mayores asignados'
                        : rol === 'familiar'
                          ? `Puede ver ${n} ${n === 1 ? 'adulto mayor' : 'adultos mayores'}`
                          : `${n} ${n === 1 ? 'adulto mayor asignado' : 'adultos mayores asignados'}`}
                    </p>
                  )}
                </LinkCard>
              </li>
            )
          })}
        </ul>
      )}

      {/* Móvil: botón fijo sobre la barra de navegación */}
      {gestiona && (
        <div className="md:hidden sticky z-[5] bottom-[calc(var(--bottomnav-h)+var(--safe-bottom)+12px)] mt-2 drop-shadow-[0_4px_10px_rgba(12,59,110,0.25)]">
          <ButtonLink to={nuevo} fullWidth icon={<UserPlus size={22} aria-hidden />}>
            Agregar miembro
          </ButtonLink>
        </div>
      )}

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
        <SelectField label="Rol" value={borrador.rol} options={rolesFiltro} onChange={(e) => setBorrador((b) => ({ ...b, rol: e.target.value as RolFiltro }))} />
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
