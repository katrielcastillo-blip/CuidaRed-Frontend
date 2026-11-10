/*
 * miembros.tsx — Lista, invitación y perfil de miembros de la cuenta activa (RF-09, RF-11, CR-162).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, ButtonLink, ChoicePills, EmptyState, INPUT, SelectField, Sheet, Spinner, TextField, type Tone } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { PaginatedResponse } from '../../lib/api-contract'
import { Aviso } from '../auth/components/Piezas'
import {
  cambiarRolMiembro,
  desactivarMiembro,
  invitarMiembro,
  listarMiembros,
  obtenerMiembro,
  reactivarMiembro,
  type EstadoMembresia,
  type FiltroMiembros,
  type Miembro,
} from './api/miembros'
import type { CuentaMe, RolCuenta } from './client'
import { puedeGestionarMiembros, ROL_TEXTO, rolesDelTipo, TIPO_TEXTO } from './cuentas-datos'
import { mensajeDeError } from './errores'

const POR_PAGINA = 10
const POR_PAGINA_BUSQUEDA = 100
const ESTADO_TEXTO: Record<EstadoMembresia, string> = { pendiente: 'Invitación pendiente', activa: 'Activa', inactiva: 'Inactiva' }
const ESTADO_TONO: Record<EstadoMembresia, Tone> = { pendiente: 'warning', activa: 'success', inactiva: 'neutral' }
const OPCIONES_ESTADO = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'activa', label: ESTADO_TEXTO.activa },
  { value: 'pendiente', label: ESTADO_TEXTO.pendiente },
  { value: 'inactiva', label: ESTADO_TEXTO.inactiva },
] satisfies Array<{ value: EstadoMembresia | 'todos'; label: string }>
const ORDENES = {
  nombre: { label: 'Nombre (A-Z)', sort: undefined },
  nombreDesc: { label: 'Nombre (Z-A)', sort: ['-nombres', '-apellidos'] },
  recientes: { label: 'Más recientes', sort: ['-fecha_inicio', 'nombres', 'apellidos'] },
  antiguos: { label: 'Más antiguos', sort: ['fecha_inicio', 'nombres', 'apellidos'] },
}

type Filtros = { rol: RolCuenta | 'todos'; estado: EstadoMembresia | 'todos'; orden: keyof typeof ORDENES }
type Accion = 'rol' | 'desactivar' | 'reactivar'
type VistaMiembros = 'lista' | 'invitar' | 'detalle'
type Errores = Record<string, string | undefined>
type Icono = 'avanzar' | 'buscar' | 'correo' | 'desplegar' | 'fecha' | 'filtros' | 'info' | 'perfil' | 'persona' | 'persona-inactiva' | 'telefono' | 'volver'

const FILTROS_INICIALES: Filtros = { rol: 'todos', estado: 'todos', orden: 'nombre' }
const INVITACION_VACIA = { correo: '', cedula: '', nombres: '', apellidos: '', rol: '' as RolCuenta | '' }
const nombreDe = (m: Miembro) => (m.usuario.nombres + ' ' + m.usuario.apellidos).trim()
const correoValido = (correo: string) => correo.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)
const paraBuscar = (valor: string) => valor.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const fechaCorta = (valor: string | null) => valor
  ? new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(valor))
  : 'Sin fecha registrada'

function Imagen({ icono, ancho, alto = ancho }: { icono: Icono; ancho: number; alto?: number }) {
  return <img src={'/figma-miembros/' + icono + '.svg'} alt="" width={ancho} height={alto} className="shrink-0" />
}

function MarcoMiembros({ titulo, volver, children }: { titulo: string; volver: () => void; children: ReactNode }) {
  const encabezado = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    encabezado.current?.focus()
  }, [titulo])

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="bg-navy pt-safe text-white shadow-1">
        <div className="mx-auto flex min-h-[76px] w-full max-w-3xl items-center gap-3 px-4 sm:px-8">
          <button type="button" className="grid size-12 shrink-0 place-items-center rounded-md hover:bg-white/15 focus-visible:outline-white" aria-label="Volver" onClick={volver}>
            <Imagen icono="volver" ancho={30} />
          </button>
          <h1 ref={encabezado} tabIndex={-1} className="text-xl font-bold outline-none">{titulo}</h1>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-[clamp(24px,8.4vw,36px)] pb-[max(32px,calc(var(--safe-bottom)+24px))] pt-8">
        {children}
      </main>
    </div>
  )
}

/** Por contrato el servidor pagina y filtra por rol/estado; la búsqueda textual recorre el conjunto filtrado. */
async function buscarMiembros(token: string, cuentaId: string, filtro: FiltroMiembros, termino: string, vigente: () => boolean) {
  const primera = await listarMiembros(token, cuentaId, { ...filtro, page: 1, limit: POR_PAGINA_BUSQUEDA })
  const filas = [...primera.data]
  for (let pagina = 2; pagina <= primera.meta.totalPages && vigente(); pagina++) {
    const siguiente = await listarMiembros(token, cuentaId, { ...filtro, page: pagina, limit: POR_PAGINA_BUSQUEDA })
    filas.push(...siguiente.data)
  }
  const palabras = paraBuscar(termino).split(/\s+/)
  return filas.filter((miembro) => {
    const texto = paraBuscar(nombreDe(miembro) + ' ' + miembro.usuario.correo)
    return palabras.every((palabra) => texto.includes(palabra))
  })
}

function SelectorRapido<T extends string>({ label, prefijo, opciones, value, onChange }: {
  label: string; prefijo: string; opciones: Array<{ value: T; label: string }>; value: T; onChange: (valor: T) => void
}) {
  return (
    <span className="relative inline-flex min-w-0 items-center">
      <select aria-label={label} className="min-h-12 max-w-full appearance-none rounded-pill border border-line bg-surface px-3 pe-8 text-sm font-semibold text-ink" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {opciones.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.value === 'todos' ? prefijo + ': Todos' : opcion.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2"><Imagen icono="desplegar" ancho={20} alto={21} /></span>
    </span>
  )
}

function Distintivos({ miembro, propia = false }: { miembro: Miembro; propia?: boolean }) {
  return (
    <>
      <Badge tone={miembro.estado === 'inactiva' ? 'neutral' : 'navy'}>{ROL_TEXTO[miembro.rol]}</Badge>
      <Badge tone={ESTADO_TONO[miembro.estado]}>{ESTADO_TEXTO[miembro.estado]}</Badge>
      {miembro.es_titular && <Badge tone="info">Titular</Badge>}
      {propia && <Badge tone="info">Tú</Badge>}
    </>
  )
}

export function PantallaMiembros({ token, cuenta, usuarioId, volver = '/cuenta' }: { token: string; cuenta: CuentaMe | undefined; usuarioId: string; volver?: string }) {
  const navigate = useNavigate()
  if (!cuenta || !puedeGestionarMiembros(cuenta)) {
    return (
      <MarcoMiembros titulo="Miembros" volver={() => navigate(volver)}>
        <Aviso tono="warning">
          {cuenta && !cuenta.acceso_operativo
            ? 'La cuenta no tiene acceso operativo. Puedes revisar su vigencia desde Mi cuenta.'
            : cuenta
              ? 'No tienes permiso para gestionar miembros en ' + cuenta.nombre + '.'
              : 'Selecciona una cuenta con permiso para gestionar miembros.'}
        </Aviso>
          <ButtonLink to={volver} variant="outline">Volver a mi cuenta</ButtonLink>
      </MarcoMiembros>
    )
  }
  return <GestionMiembros key={cuenta.cuenta_id} token={token} cuenta={cuenta} usuarioId={usuarioId} rutaVolver={volver} />
}

function GestionMiembros({ token, cuenta, usuarioId, rutaVolver }: { token: string; cuenta: CuentaMe; usuarioId: string; rutaVolver: string }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const membresiaId = params.get('miembro')
  const vista: VistaMiembros = params.get('vista') === 'invitar' ? 'invitar' : membresiaId ? 'detalle' : 'lista'
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [borrador, setBorrador] = useState<Filtros>(FILTROS_INICIALES)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [recarga, setRecarga] = useState(0)
  const [resultado, setResultado] = useState<{ clave: string; datos?: PaginatedResponse<Miembro>; error?: string }>()
  const [aviso, setAviso] = useState('')
  const { rol, estado, orden } = filtros
  const clave = [cuenta.cuenta_id, rol, estado, orden, pagina, busqueda, recarga].join('|')
  const datos = resultado?.clave === clave ? resultado.datos : undefined
  const error = resultado?.clave === clave ? resultado.error : undefined
  const cargando = !datos && !error
  const meta = datos?.meta
  const roles = rolesDelTipo(cuenta.tipo)
  const opcionesRol: Array<{ value: Filtros['rol']; label: string }> = [{ value: 'todos', label: 'Todos los roles' }, ...roles.map((r) => ({ value: r, label: ROL_TEXTO[r] }))]
  const hayFiltros = rol !== 'todos' || estado !== 'todos' || orden !== 'nombre' || !!busqueda

  useEffect(() => {
    if (vista !== 'lista') return
    let vigente = true
    const filtro = { rol: rol === 'todos' ? undefined : rol, estado: estado === 'todos' ? undefined : estado, sort: ORDENES[orden].sort }
    const cargar = async (): Promise<PaginatedResponse<Miembro>> => {
      if (!busqueda) return listarMiembros(token, cuenta.cuenta_id, { ...filtro, page: pagina, limit: POR_PAGINA })
      const filas = await buscarMiembros(token, cuenta.cuenta_id, filtro, busqueda, () => vigente)
      return {
        data: filas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
        meta: { page: pagina, limit: POR_PAGINA, total: filas.length, totalPages: Math.ceil(filas.length / POR_PAGINA) },
      }
    }
    void cargar().then(
      (respuesta) => { if (vigente) setResultado({ clave, datos: respuesta }) },
      (issue) => { if (vigente) setResultado({ clave, error: mensajeDeError(issue) }) },
    )
    return () => { vigente = false }
  }, [token, cuenta.cuenta_id, vista, rol, estado, orden, pagina, busqueda, clave])

  const mostrar = (id?: string) => {
    setAviso('')
    setParams(id ? { miembro: id } : { vista: 'invitar' })
  }
  const volver = () => setParams({}, { replace: true })
  const alGuardar = (mensaje: string) => {
    setAviso(mensaje)
    setRecarga((valor) => valor + 1)
    volver()
  }
  const aplicarFiltros = (nuevos: Filtros) => {
    setFiltros(nuevos)
    setPagina(1)
    setAviso('')
    setFiltrosAbiertos(false)
  }
  const cerrarFiltros = useCallback(() => setFiltrosAbiertos(false), [])
  const limpiar = () => {
    setTexto('')
    setBusqueda('')
    aplicarFiltros(FILTROS_INICIALES)
  }

  if (vista === 'invitar') return <InvitarMiembro token={token} cuenta={cuenta} volver={volver} alGuardar={alGuardar} />
  if (vista === 'detalle' && membresiaId) return <PerfilMiembro key={membresiaId} token={token} cuenta={cuenta} usuarioId={usuarioId} membresiaId={membresiaId} volver={volver} alGuardar={alGuardar} />

  return (
    <MarcoMiembros titulo="Miembros" volver={() => navigate(rutaVolver)}>
      <div data-testid="pantalla-miembros" className="flex flex-col gap-5">
        <p className="text-sm font-semibold text-muted">{TIPO_TEXTO[cuenta.tipo]} · {cuenta.nombre}</p>
        {aviso && <Aviso tono="info">{aviso}</Aviso>}
        <form role="search" className="relative" onSubmit={(evento) => {
          evento.preventDefault()
          setBusqueda(texto.trim())
          setPagina(1)
          setAviso('')
        }}>
          <label htmlFor="buscar-miembros" className="sr-only">Buscar miembros por nombre o correo</label>
          <input id="buscar-miembros" type="search" className={cn(INPUT, 'rounded-pill pe-14')} value={texto} placeholder="Buscar por nombre o correo" onChange={(e) => setTexto(e.target.value)} />
          <button type="submit" className="absolute inset-y-0 right-1 grid min-w-12 place-items-center rounded-pill hover:bg-blue-100" aria-label="Buscar">
            <Imagen icono="buscar" ancho={26} />
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <SelectorRapido label="Filtrar por rol" prefijo="Rol" opciones={opcionesRol} value={rol} onChange={(valor) => aplicarFiltros({ ...filtros, rol: valor })} />
          <SelectorRapido label="Filtrar por estado" prefijo="Estado" opciones={OPCIONES_ESTADO} value={estado} onChange={(valor) => aplicarFiltros({ ...filtros, estado: valor })} />
          <Button size="sm" className="rounded-pill" icon={<Imagen icono="filtros" ancho={14} alto={15} />} aria-haspopup="dialog" onClick={() => { setBorrador(filtros); setFiltrosAbiertos(true) }}>
            Filtros
          </Button>
        </div>
        {hayFiltros && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">{busqueda ? 'Resultados de búsqueda por «' + busqueda + '»' : 'Filtros aplicados'}</p>
            <Button size="sm" variant="ghost" onClick={limpiar}>Quitar filtros y búsqueda</Button>
          </div>
        )}

        <section aria-label="Personas de la cuenta" aria-busy={cargando} className="flex flex-col gap-4">
          {cargando && <div className="flex items-center gap-3 py-5" role="status"><Spinner /><p>{busqueda ? 'Buscando miembros…' : 'Cargando miembros…'}</p></div>}
          {error && <Aviso tono="error"><p>{error}</p><Button variant="ghost" onClick={() => setRecarga((n) => n + 1)}>Reintentar</Button></Aviso>}
          {datos && datos.data.length === 0 && <EmptyState
            title={meta && meta.total > 0 ? 'No hay personas en esta página' : hayFiltros ? 'No hay resultados' : 'Aún no hay miembros'}
            text={hayFiltros ? 'Prueba con otra búsqueda o cambia los filtros.' : 'Puedes invitar a alguien a la cuenta.'}
            action={meta && meta.total > 0 ? <Button size="sm" variant="outline" onClick={() => setPagina(1)}>Ir a la primera página</Button> : undefined}
          />}
          {datos && datos.data.length > 0 && (
            <ul data-testid="lista-miembros" className="grid gap-4 md:grid-cols-2">
              {datos.data.map((miembro) => {
                const nombre = nombreDe(miembro)
                return (
                  <li key={miembro.membresia_id} className="flex min-w-0 flex-col overflow-hidden rounded-md border border-line bg-bg">
                    <div className="flex flex-1 items-start gap-3 px-4 py-4">
                      <span className={cn('grid size-12 shrink-0 place-items-center rounded-md border', miembro.estado === 'inactiva' ? 'border-line bg-surface-2' : 'border-blue bg-blue-100')}>
                        <Imagen icono={miembro.estado === 'inactiva' ? 'persona-inactiva' : 'persona'} ancho={24} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold leading-snug wrap-anywhere">{nombre}</h2>
                        <p className="mt-1 text-sm text-ink-2 wrap-anywhere">{miembro.usuario.correo}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5"><Distintivos miembro={miembro} propia={usuarioId === miembro.usuario.id} /></div>
                      </div>
                    </div>
                    <button type="button" className="flex min-h-12 w-full items-center justify-end gap-2 border-t border-blue bg-blue-100 px-4 text-sm font-bold text-navy hover:bg-blue-100/70" aria-label={'Ver más de ' + nombre} onClick={() => mostrar(miembro.membresia_id)}>
                      Ver más <Imagen icono="avanzar" ancho={20} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {meta && meta.total > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted" aria-live="polite">{meta.total} {meta.total === 1 ? 'persona' : 'personas'} · Página {meta.page} de {meta.totalPages}</p>
              {meta.totalPages > 1 && <nav aria-label="Páginas de miembros" className="grid grid-cols-2 gap-3">
                <Button size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={pagina >= meta.totalPages} onClick={() => setPagina((p) => p + 1)}>Siguiente</Button>
              </nav>}
            </div>
          )}
        </section>
        <Button fullWidth onClick={() => mostrar()}>Agregar miembros</Button>
      </div>

      <Sheet open={filtrosAbiertos} onClose={cerrarFiltros} title="Filtros" footer={
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="sm" variant="outline" onClick={limpiar}>Limpiar filtros</Button>
          <Button size="sm" onClick={() => aplicarFiltros(borrador)}>Aplicar filtros</Button>
        </div>
      }>
        <ChoicePills<Filtros['rol']> label="Rol" options={opcionesRol.map((o) => o.value === 'todos' ? { ...o, label: 'Todos' } : o)} value={borrador.rol} onChange={(valor) => setBorrador({ ...borrador, rol: valor })} />
        <ChoicePills<Filtros['estado']> label="Estado" options={OPCIONES_ESTADO.map((o) => o.value === 'todos' ? { ...o, label: 'Todos' } : o)} value={borrador.estado} onChange={(valor) => setBorrador({ ...borrador, estado: valor })} />
        <SelectField label="Ordenar por" options={Object.entries(ORDENES).map(([value, opcion]) => ({ value, label: opcion.label }))} value={borrador.orden} onChange={(e) => setBorrador({ ...borrador, orden: e.target.value as Filtros['orden'] })} />
      </Sheet>
    </MarcoMiembros>
  )
}

function InvitarMiembro({ token, cuenta, volver, alGuardar }: { token: string; cuenta: CuentaMe; volver: () => void; alGuardar: (mensaje: string) => void }) {
  const [invitacion, setInvitacion] = useState(INVITACION_VACIA)
  const [errores, setErrores] = useState<Errores>({})
  const [error, setError] = useState('')
  const [invitando, setInvitando] = useState(false)
  const formulario = useRef<HTMLFormElement>(null)

  const cambiar = (campo: keyof typeof INVITACION_VACIA, valor: string) => {
    setInvitacion((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actuales) => ({ ...actuales, [campo]: undefined }))
  }
  const enviar = async (evento: FormEvent) => {
    evento.preventDefault()
    if (invitando) return
    setError('')
    const correo = invitacion.correo.trim().toLowerCase()
    const validos: Errores = {
      nombres: invitacion.nombres.trim() ? undefined : 'Escribe los nombres.',
      apellidos: invitacion.apellidos.trim() ? undefined : 'Escribe los apellidos.',
      correo: correoValido(correo) ? undefined : 'Escribe un correo válido, por ejemplo nombre@correo.com.',
      cedula: /^\d{11}$/.test(invitacion.cedula) ? undefined : 'La cédula debe tener exactamente 11 dígitos.',
      rol: invitacion.rol ? undefined : 'Elige el rol que tendrá en la cuenta.',
    }
    setErrores(validos)
    const invalido = Object.keys(validos).find((campo) => validos[campo])
    if (invalido || !invitacion.rol) {
      if (invalido) formulario.current?.querySelector<HTMLElement>('#invitar-' + invalido)?.focus()
      return
    }
    setInvitando(true)
    try {
      const creado = await invitarMiembro(token, cuenta.cuenta_id, {
        correo, cedula: invitacion.cedula, nombres: invitacion.nombres.trim(), apellidos: invitacion.apellidos.trim(), rol: invitacion.rol,
      })
      alGuardar('Invitación enviada a ' + correo + '. ' + (creado.usuario_existente
        ? 'Verá la invitación al iniciar sesión.'
        : 'Recibirá un código por correo para activar su cuenta.'))
    } catch (issue) {
      setError(mensajeDeError(issue))
    } finally {
      setInvitando(false)
    }
  }

  return (
    <MarcoMiembros titulo="Miembros" volver={() => { if (!invitando) volver() }}>
      <section className="flex w-full max-w-lg flex-col gap-6 self-center" aria-labelledby="agregar-miembro">
        <div className="grid gap-3">
          <h2 id="agregar-miembro" className="text-2xl font-bold">Agregar miembro</h2>
          <p className="text-ink-2">Ingresa los datos para invitar a una persona a {cuenta.nombre}. Podrá ver la cuenta cuando acepte la invitación.</p>
        </div>
        <form ref={formulario} className="grid gap-5" onSubmit={(e) => void enviar(e)} noValidate>
          <TextField id="invitar-nombres" label="Nombres de la persona" required maxLength={100} autoComplete="off" placeholder="Nombres" value={invitacion.nombres} error={errores.nombres} onChange={(e) => cambiar('nombres', e.target.value)} />
          <TextField id="invitar-apellidos" label="Apellidos de la persona" required maxLength={100} autoComplete="off" placeholder="Apellidos" value={invitacion.apellidos} error={errores.apellidos} onChange={(e) => cambiar('apellidos', e.target.value)} />
          <TextField id="invitar-correo" label="Correo electrónico de la persona" required type="email" maxLength={254} autoComplete="off" placeholder="ejemplo@correo.com" value={invitacion.correo} error={errores.correo} onChange={(e) => cambiar('correo', e.target.value)} />
          <TextField id="invitar-cedula" label="Cédula de la persona" required inputMode="numeric" autoComplete="off" placeholder="11 dígitos" value={invitacion.cedula} error={errores.cedula} hint="Escríbela sin guiones. Si la persona ya tiene perfil, debe coincidir con el registro." onChange={(e) => cambiar('cedula', e.target.value.replace(/\D/g, '').slice(0, 11))} />
          <SelectField id="invitar-rol" label="Rol en la cuenta" required placeholder="Selecciona un rol" options={rolesDelTipo(cuenta.tipo).map((rol) => ({ value: rol, label: ROL_TEXTO[rol] }))} value={invitacion.rol} error={errores.rol} onChange={(e) => cambiar('rol', e.target.value)} />
          <p className="flex items-start gap-4 rounded-md bg-blue-100 p-4 text-sm text-ink-2">
            <Imagen icono="info" ancho={20} alto={24} />
            Si ya tiene perfil, verá la invitación al iniciar sesión. Si es una persona nueva, recibirá un código por correo para activar su acceso.
          </p>
          {error && <Aviso tono="error">{error}</Aviso>}
          <div className="grid gap-3">
            <Button type="submit" loading={invitando}>Guardar y enviar invitación</Button>
            <Button variant="outline" disabled={invitando} onClick={volver}>Cancelar</Button>
          </div>
        </form>
      </section>
    </MarcoMiembros>
  )
}

function PerfilMiembro({ token, cuenta, usuarioId, membresiaId, volver, alGuardar }: {
  token: string; cuenta: CuentaMe; usuarioId: string; membresiaId: string; volver: () => void; alGuardar: (mensaje: string) => void
}) {
  const [resultado, setResultado] = useState<{ intento: number; miembro?: Miembro; error?: string }>()
  const [intento, setIntento] = useState(0)
  const [accion, setAccion] = useState<Accion | null>(null)
  const [rolNuevo, setRolNuevo] = useState<RolCuenta | ''>('')
  const [errorAccion, setErrorAccion] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const miembro = resultado?.intento === intento ? resultado.miembro : undefined
  const error = resultado?.intento === intento ? resultado.error : undefined
  const nombre = miembro ? nombreDe(miembro) : ''
  const editable = miembro && miembro.usuario.id !== usuarioId && !miembro.es_titular

  useEffect(() => {
    let vigente = true
    if (!/^[1-9]\d{0,18}$/.test(membresiaId)) return
    void obtenerMiembro(token, cuenta.cuenta_id, membresiaId).then(
      (datos) => { if (vigente) setResultado({ intento, miembro: datos }) },
      (issue) => { if (vigente) setResultado({ intento, error: mensajeDeError(issue) }) },
    )
    return () => { vigente = false }
  }, [token, cuenta.cuenta_id, membresiaId, intento])

  const cerrarAccion = useCallback(() => {
    if (!trabajando) setAccion(null)
  }, [trabajando])
  const abrirAccion = (siguiente: Accion) => {
    setErrorAccion('')
    setRolNuevo('')
    setAccion(siguiente)
  }
  const confirmar = async () => {
    if (!miembro || !editable || !accion || trabajando) return
    if (accion === 'rol' && !rolNuevo) {
      setErrorAccion('Elige el nuevo rol.')
      return
    }
    setTrabajando(true)
    setErrorAccion('')
    try {
      if (accion === 'rol' && rolNuevo) {
        await cambiarRolMiembro(token, cuenta.cuenta_id, miembro.membresia_id, rolNuevo)
        alGuardar('Se cambió el rol de ' + nombre + ' a ' + ROL_TEXTO[rolNuevo] + '.')
      } else if (accion === 'desactivar') {
        await desactivarMiembro(token, cuenta.cuenta_id, miembro.membresia_id)
        alGuardar(miembro.estado === 'pendiente' ? 'Se canceló la invitación a ' + nombre + '.' : nombre + ' ya no tiene acceso a la cuenta.')
      } else if (accion === 'reactivar') {
        await reactivarMiembro(token, cuenta.cuenta_id, miembro.membresia_id)
        alGuardar(nombre + ' volvió a tener acceso a la cuenta.')
      }
    } catch (issue) {
      setErrorAccion(mensajeDeError(issue))
    } finally {
      setTrabajando(false)
    }
  }

  const pendiente = miembro?.estado === 'pendiente'
  const tituloAccion = accion === 'rol' ? 'Cambiar el rol de ' + nombre : accion === 'reactivar' ? 'Reactivar a ' + nombre : (pendiente ? 'Cancelar la invitación a ' : 'Desactivar a ') + nombre
  const idValido = /^[1-9]\d{0,18}$/.test(membresiaId)
  const errorVisible = idValido ? error : 'Esta dirección de miembro no es válida.'

  return (
    <MarcoMiembros titulo="Perfil miembro" volver={() => { if (!trabajando) volver() }}>
      {errorVisible && <Aviso tono="error"><p>{errorVisible}</p>{idValido && <Button variant="ghost" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>}</Aviso>}
      {!miembro && !errorVisible && <div className="flex items-center gap-3 py-5" role="status"><Spinner /><p>Cargando perfil…</p></div>}
      {miembro && (
        <article className="mx-auto grid w-full max-w-lg gap-7">
          <header className="flex flex-col items-center gap-3 text-center">
            <Imagen icono="perfil" ancho={111} />
            <h2 className="text-[28px] font-bold leading-tight text-navy wrap-anywhere">{nombre}</h2>
            <div className="flex flex-wrap justify-center gap-2"><Distintivos miembro={miembro} propia={miembro.usuario.id === usuarioId} /></div>
          </header>
          <section aria-labelledby="informacion-miembro" className="grid gap-3">
            <h3 id="informacion-miembro" className="text-xl font-bold">Información personal</h3>
            <dl className="grid gap-3">
              {([
                { icono: 'correo', titulo: 'Correo electrónico', valor: miembro.usuario.correo, ancho: 24 },
                { icono: 'telefono', titulo: 'Teléfono', valor: miembro.usuario.telefono || 'Sin teléfono registrado', ancho: 24 },
                { icono: 'fecha', titulo: 'Miembro desde', valor: fechaCorta(miembro.fecha_inicio), ancho: 18, alto: 20 },
              ] satisfies Array<{ icono: Icono; titulo: string; valor: string; ancho: number; alto?: number }>).map(({ icono, titulo, valor, ancho, alto }) => (
                <div key={titulo} className="grid gap-2 border-b border-line px-1 py-3">
                  <dt className="font-semibold">{titulo}</dt>
                  <dd className="flex items-center gap-2 text-muted wrap-anywhere"><Imagen icono={icono} ancho={ancho} alto={alto} />{valor}</dd>
                </div>
              ))}
            </dl>
          </section>
          {editable && (
            <section aria-labelledby="acciones-miembro" className="grid gap-3">
              <h3 id="acciones-miembro" className="text-xl font-bold">Acciones rápidas</h3>
              {miembro.estado === 'activa' && <Button variant="outline" onClick={() => abrirAccion('rol')}>Cambiar rol</Button>}
              {miembro.estado !== 'inactiva' && <Button variant="danger-soft" onClick={() => abrirAccion('desactivar')}>{pendiente ? 'Cancelar invitación' : 'Desactivar miembro'}</Button>}
              {miembro.estado === 'inactiva' && <Button onClick={() => abrirAccion('reactivar')}>Reactivar miembro</Button>}
            </section>
          )}
          {miembro.es_titular && <Aviso tono="info">Para cambiar el acceso de la persona titular, primero transfiere la titularidad de la cuenta.</Aviso>}
        </article>
      )}
      <Sheet open={!!accion} onClose={cerrarAccion} title={tituloAccion} footer={
        <>
          <Button size="sm" variant="outline" disabled={trabajando} onClick={cerrarAccion}>Volver</Button>
          <Button size="sm" variant={accion === 'desactivar' ? 'danger' : 'primary'} loading={trabajando} onClick={() => void confirmar()}>
            {accion === 'rol' ? 'Cambiar rol' : accion === 'reactivar' ? 'Reactivar' : pendiente ? 'Cancelar invitación' : 'Desactivar'}
          </Button>
        </>
      }>
        {miembro && accion === 'rol' && <>
          <p>Rol actual de {nombre}: {ROL_TEXTO[miembro.rol]}.</p>
          <SelectField label="Nuevo rol" required placeholder="Elige un rol" options={rolesDelTipo(cuenta.tipo).filter((rol) => rol !== miembro.rol).map((rol) => ({ value: rol, label: ROL_TEXTO[rol] }))} value={rolNuevo} onChange={(e) => { setRolNuevo(e.target.value as RolCuenta); setErrorAccion('') }} />
          <p className="text-sm text-muted">Se quitan las asignaciones del rol anterior. El historial se conserva.</p>
        </>}
        {miembro && accion === 'desactivar' && <p>{pendiente
          ? 'Se cancelará la invitación enviada a ' + miembro.usuario.correo + '.'
          : nombre + ' perderá el acceso a ' + cuenta.nombre + ' de inmediato. Podrás reactivar la membresía después.'}</p>}
        {miembro && accion === 'reactivar' && <p>{nombre} volverá a tener acceso a {cuenta.nombre} como {ROL_TEXTO[miembro.rol]}.</p>}
        {errorAccion && <Aviso tono="error">{errorAccion}</Aviso>}
      </Sheet>
    </MarcoMiembros>
  )
}
