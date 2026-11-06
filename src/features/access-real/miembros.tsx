/*
 * miembros.tsx — Gestión de miembros de la cuenta activa: lista paginada con filtros, invitaciones, cambio de rol y
 * desactivación o reactivación con confirmación.
 * Módulo: access-real (fase 2 · RF-09, RF-11, CR-162).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Solo se muestra si la cuenta activa tiene `usuarios:gestionar` (Coordinador en Familia, Administrador en
 * Organización); sin ese permiso no se consulta nada. La interfaz oculta lo que no corresponde, pero quien decide es el
 * servidor, y sus rechazos (plan lleno, titular protegido, último gestor…) se muestran con un mensaje claro sin perder
 * lo escrito. Todo se recarga al cambiar de cuenta activa (la lista se monta con la cuenta como clave).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Avatar, Badge, Button, ButtonLink, EmptyState, SelectField, Sheet, Spinner, TextField, type Tone } from '@/components/ui'
import type { PaginatedResponse } from '../../lib/api-contract'
import { AuthScreen } from '../auth/components/AuthScreen'
import { Aviso } from '../auth/components/Piezas'
import {
  cambiarRolMiembro,
  desactivarMiembro,
  invitarMiembro,
  listarMiembros,
  reactivarMiembro,
  type EstadoMembresia,
  type Miembro,
} from './api/miembros'
import type { CuentaMe, RolCuenta } from './client'
import { puedeGestionarMiembros, ROL_TEXTO, rolesDelTipo, TIPO_TEXTO } from './cuentas-datos'
import { mensajeDeError } from './errores'

const POR_PAGINA = 10

const ESTADO_TEXTO: Record<EstadoMembresia, string> = { pendiente: 'Invitación pendiente', activa: 'Activa', inactiva: 'Inactiva' }
const ESTADO_TONO: Record<EstadoMembresia, Tone> = { pendiente: 'warning', activa: 'success', inactiva: 'neutral' }

type Accion = { tipo: 'rol' | 'desactivar' | 'reactivar'; miembro: Miembro }
type Errores = Record<string, string | undefined>

const nombreDe = (m: Miembro) => `${m.usuario.nombres} ${m.usuario.apellidos}`.trim()
const correoValido = (correo: string) => correo.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)
const INVITACION_VACIA = { correo: '', cedula: '', nombres: '', apellidos: '', rol: '' as RolCuenta | '' }

/* ───────────── Pantalla (con la comprobación de permiso) ───────────── */

export function PantallaMiembros({ token, cuenta, usuarioId }: { token: string; cuenta: CuentaMe | undefined; usuarioId: string }) {
  if (!cuenta || !puedeGestionarMiembros(cuenta)) {
    return (
      <AuthScreen title="Miembros" back="/cuenta">
        <div className="flex flex-col gap-4">
          <Aviso tono="warning">
            {cuenta
              ? `No tienes permiso para gestionar miembros en ${cuenta.nombre}. Pide a quien administra la cuenta que lo haga.`
              : 'Todavía no perteneces a ninguna cuenta con permiso para gestionar miembros.'}
          </Aviso>
          <ButtonLink to="/cuenta" variant="outline">
            Volver a mi cuenta
          </ButtonLink>
        </div>
      </AuthScreen>
    )
  }
  return <ListaMiembros key={cuenta.cuenta_id} token={token} cuenta={cuenta} usuarioId={usuarioId} />
}

/* ───────────── Lista, filtros e invitación ───────────── */

function ListaMiembros({ token, cuenta, usuarioId }: { token: string; cuenta: CuentaMe; usuarioId: string }) {
  const roles = rolesDelTipo(cuenta.tipo)
  const [rol, setRol] = useState<RolCuenta | ''>('')
  const [estado, setEstado] = useState<EstadoMembresia | ''>('')
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState<PaginatedResponse<Miembro> | null>(null)
  const [errorLista, setErrorLista] = useState('')
  const [recarga, setRecarga] = useState(0)
  // "Cargando" se deriva de qué consulta terminó, sin cambiar estados al empezar el efecto.
  const consulta = `${cuenta.cuenta_id}|${rol}|${estado}|${pagina}|${recarga}`
  const [consultaTerminada, setConsultaTerminada] = useState('')
  const cargando = consultaTerminada !== consulta
  const [aviso, setAviso] = useState('')

  const [invitando, setInvitando] = useState(false)
  const [formAbierto, setFormAbierto] = useState(false)
  const [invitacion, setInvitacion] = useState(INVITACION_VACIA)
  const [erroresInv, setErroresInv] = useState<Errores>({})
  const [falloInv, setFalloInv] = useState('')

  const [accion, setAccion] = useState<Accion | null>(null)
  const [rolNuevo, setRolNuevo] = useState<RolCuenta | ''>('')
  const [errorAccion, setErrorAccion] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    let vigente = true
    listarMiembros(token, cuenta.cuenta_id, { page: pagina, limit: POR_PAGINA, rol: rol || undefined, estado: estado || undefined })
      .then((respuesta) => {
        if (!vigente) return
        setDatos(respuesta)
        setErrorLista('')
      })
      .catch((issue) => vigente && setErrorLista(mensajeDeError(issue)))
      .finally(() => vigente && setConsultaTerminada(`${cuenta.cuenta_id}|${rol}|${estado}|${pagina}|${recarga}`))
    return () => {
      vigente = false
    }
  }, [token, cuenta.cuenta_id, rol, estado, pagina, recarga])

  const recargar = () => setRecarga((n) => n + 1)
  const cerrarAccion = useCallback(() => setAccion(null), [])
  const abrirAccion = (siguiente: Accion) => {
    setErrorAccion('')
    setRolNuevo('')
    setAccion(siguiente)
  }

  /* Invitar */

  const cambiarInvitacion = (campo: keyof typeof INVITACION_VACIA, valor: string) => {
    setInvitacion((actual) => ({ ...actual, [campo]: valor }))
    setErroresInv((actuales) => ({ ...actuales, [campo]: undefined }))
  }

  const invitar = async (evento: FormEvent) => {
    evento.preventDefault()
    if (invitando) return
    setFalloInv('')
    const correo = invitacion.correo.trim().toLowerCase()
    const validos: Errores = {
      correo: correoValido(correo) ? undefined : 'Escribe un correo válido, por ejemplo nombre@correo.com.',
      cedula: /^\d{11}$/.test(invitacion.cedula) ? undefined : 'La cédula debe tener exactamente 11 dígitos.',
      nombres: invitacion.nombres.trim() ? undefined : 'Escribe los nombres.',
      apellidos: invitacion.apellidos.trim() ? undefined : 'Escribe los apellidos.',
      rol: invitacion.rol ? undefined : 'Elige el rol que tendrá en la cuenta.',
    }
    setErroresInv(validos)
    if (Object.values(validos).some(Boolean) || !invitacion.rol) return
    setInvitando(true)
    try {
      const creado = await invitarMiembro(token, cuenta.cuenta_id, {
        correo,
        cedula: invitacion.cedula,
        nombres: invitacion.nombres.trim(),
        apellidos: invitacion.apellidos.trim(),
        rol: invitacion.rol,
      })
      setAviso(
        creado?.usuario_existente === false
          ? `Invitación enviada a ${correo}. Recibirá un código por correo para activar su cuenta.`
          : `Invitación enviada a ${correo}. Verá la invitación al iniciar sesión.`,
      )
      setInvitacion(INVITACION_VACIA)
      setFormAbierto(false)
      recargar()
    } catch (issue) {
      setFalloInv(mensajeDeError(issue))
    } finally {
      setInvitando(false)
    }
  }

  /* Cambiar rol, desactivar y reactivar (con confirmación) */

  const confirmar = async () => {
    if (!accion || trabajando) return
    const { tipo, miembro } = accion
    if (tipo === 'rol' && !rolNuevo) {
      setErrorAccion('Elige el nuevo rol.')
      return
    }
    setTrabajando(true)
    setErrorAccion('')
    try {
      if (tipo === 'rol' && rolNuevo) {
        await cambiarRolMiembro(token, cuenta.cuenta_id, miembro.membresia_id, rolNuevo)
        setAviso(`Se cambió el rol de ${nombreDe(miembro)} a ${ROL_TEXTO[rolNuevo]}.`)
      } else if (tipo === 'desactivar') {
        await desactivarMiembro(token, cuenta.cuenta_id, miembro.membresia_id)
        setAviso(miembro.estado === 'pendiente' ? `Se canceló la invitación a ${nombreDe(miembro)}.` : `${nombreDe(miembro)} ya no tiene acceso a la cuenta.`)
      } else if (tipo === 'reactivar') {
        await reactivarMiembro(token, cuenta.cuenta_id, miembro.membresia_id)
        setAviso(`${nombreDe(miembro)} volvió a tener acceso a la cuenta.`)
      }
      setAccion(null)
      recargar()
    } catch (issue) {
      setErrorAccion(mensajeDeError(issue))
    } finally {
      setTrabajando(false)
    }
  }

  const alCambiarFiltro = (cambio: () => void) => {
    cambio()
    setPagina(1)
    setAviso('')
  }

  const filas = datos?.data ?? []
  const meta = datos?.meta
  const miembroAccion = accion?.miembro
  const nombreAccion = miembroAccion ? nombreDe(miembroAccion) : ''
  const tituloAccion =
    accion?.tipo === 'rol'
      ? `Cambiar el rol de ${nombreAccion}`
      : accion?.tipo === 'reactivar'
        ? `Reactivar a ${nombreAccion}`
        : miembroAccion?.estado === 'pendiente'
          ? `Cancelar la invitación a ${nombreAccion}`
          : `Desactivar a ${nombreAccion}`

  return (
    <AuthScreen title="Miembros" back="/cuenta" wide>
      <div className="flex flex-col gap-5" data-testid="pantalla-miembros">
        <p className="text-ink-2">
          Personas de <strong>{cuenta.nombre}</strong> ({TIPO_TEXTO[cuenta.tipo]}). Tu rol: {ROL_TEXTO[cuenta.rol]}.
        </p>
        {aviso && <Aviso tono="info">{aviso}</Aviso>}

        {/* Invitar */}
        <section aria-labelledby="titulo-invitar" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="titulo-invitar" className="text-base font-semibold text-ink">
              Invitar a una persona
            </h2>
            <Button size="sm" variant={formAbierto ? 'outline' : 'primary'} aria-expanded={formAbierto} aria-controls="form-invitar" onClick={() => setFormAbierto((abierto) => !abierto)}>
              {formAbierto ? 'Ocultar el formulario' : 'Invitar'}
            </Button>
          </div>
          {formAbierto && (
            <form id="form-invitar" className="flex flex-col gap-4 rounded-md border border-line-soft bg-surface p-4" onSubmit={(e) => void invitar(e)} noValidate>
              <p className="text-sm text-muted">
                Si la persona ya tiene cuenta en CuidaRed verá la invitación al iniciar sesión; si es nueva, recibirá un código por correo para activar su cuenta.
              </p>
              <TextField
                label="Correo electrónico de la persona"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                value={invitacion.correo}
                error={erroresInv.correo}
                onChange={(e) => cambiarInvitacion('correo', e.target.value)}
              />
              <TextField
                label="Cédula de la persona"
                required
                inputMode="numeric"
                autoComplete="off"
                value={invitacion.cedula}
                error={erroresInv.cedula}
                hint="11 dígitos, sin guiones."
                onChange={(e) => cambiarInvitacion('cedula', e.target.value.replace(/\D/g, '').slice(0, 11))}
              />
              <TextField
                label="Nombres de la persona"
                required
                maxLength={100}
                autoComplete="off"
                value={invitacion.nombres}
                error={erroresInv.nombres}
                onChange={(e) => cambiarInvitacion('nombres', e.target.value)}
              />
              <TextField
                label="Apellidos de la persona"
                required
                maxLength={100}
                autoComplete="off"
                value={invitacion.apellidos}
                error={erroresInv.apellidos}
                onChange={(e) => cambiarInvitacion('apellidos', e.target.value)}
              />
              <SelectField
                label="Rol en la cuenta"
                required
                placeholder="Elige un rol"
                options={roles.map((r) => ({ value: r, label: ROL_TEXTO[r] }))}
                value={invitacion.rol}
                error={erroresInv.rol}
                onChange={(e) => cambiarInvitacion('rol', e.target.value)}
              />
              {falloInv && <Aviso tono="error">{falloInv}</Aviso>}
              <Button type="submit" loading={invitando}>
                Enviar invitación
              </Button>
            </form>
          )}
        </section>

        {/* Filtros */}
        <section aria-labelledby="titulo-lista" className="flex flex-col gap-4">
          <h2 id="titulo-lista" className="text-base font-semibold text-ink">
            Personas de la cuenta
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Filtrar por rol"
              options={[{ value: '', label: 'Todos los roles' }, ...roles.map((r) => ({ value: r, label: ROL_TEXTO[r] }))]}
              value={rol}
              onChange={(e) => alCambiarFiltro(() => setRol(e.target.value as RolCuenta | ''))}
            />
            <SelectField
              label="Filtrar por estado"
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'activa', label: ESTADO_TEXTO.activa },
                { value: 'pendiente', label: ESTADO_TEXTO.pendiente },
                { value: 'inactiva', label: ESTADO_TEXTO.inactiva },
              ]}
              value={estado}
              onChange={(e) => alCambiarFiltro(() => setEstado(e.target.value as EstadoMembresia | ''))}
            />
          </div>

          {errorLista && !cargando && (
            <Aviso tono="error">
              <p>{errorLista}</p>
              <Button variant="ghost" className="-ml-4" onClick={recargar}>
                Reintentar
              </Button>
            </Aviso>
          )}
          {cargando && !datos && (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}
          {datos && filas.length === 0 && (
            <EmptyState
              title={meta && meta.total > 0 ? 'No hay personas en esta página' : 'No hay personas con esos filtros'}
              text={meta && meta.total > 0 ? undefined : 'Cambia los filtros o invita a alguien a la cuenta.'}
              action={
                meta && meta.total > 0 ? (
                  <Button size="sm" variant="outline" onClick={() => setPagina(1)}>
                    Ir a la primera página
                  </Button>
                ) : undefined
              }
            />
          )}
          {filas.length > 0 && (
            <ul className="flex flex-col gap-3" data-testid="lista-miembros" aria-busy={cargando}>
              {filas.map((miembro) => {
                const nombre = nombreDe(miembro)
                const propia = miembro.usuario.id === usuarioId
                return (
                  <li key={miembro.membresia_id} className="flex flex-col gap-3 rounded-md border border-line-soft bg-surface p-4 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Avatar nombre={nombre} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <strong className="wrap-anywhere text-ink">{nombre}</strong>
                        <span className="break-all text-sm text-muted">{miembro.usuario.correo}</span>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone="navy">{ROL_TEXTO[miembro.rol]}</Badge>
                          <Badge tone={ESTADO_TONO[miembro.estado]}>{ESTADO_TEXTO[miembro.estado]}</Badge>
                          {miembro.es_titular && <Badge tone="info">Titular</Badge>}
                          {propia && <Badge tone="info">Tú</Badge>}
                        </div>
                      </div>
                    </div>
                    {!propia && (
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {miembro.estado === 'activa' && (
                          <Button size="sm" variant="outline" aria-label={`Cambiar rol de ${nombre}`} onClick={() => abrirAccion({ tipo: 'rol', miembro })}>
                            Cambiar rol
                          </Button>
                        )}
                        {(miembro.estado === 'activa' || miembro.estado === 'pendiente') && (
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`${miembro.estado === 'pendiente' ? 'Cancelar invitación de' : 'Desactivar a'} ${nombre}`}
                            onClick={() => abrirAccion({ tipo: 'desactivar', miembro })}
                          >
                            {miembro.estado === 'pendiente' ? 'Cancelar invitación' : 'Desactivar'}
                          </Button>
                        )}
                        {miembro.estado === 'inactiva' && (
                          <Button size="sm" variant="outline" aria-label={`Reactivar a ${nombre}`} onClick={() => abrirAccion({ tipo: 'reactivar', miembro })}>
                            Reactivar
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {meta && meta.total > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted" aria-live="polite">
                {meta.total} {meta.total === 1 ? 'persona' : 'personas'} · Página {meta.page} de {meta.totalPages}
              </p>
              {meta.totalPages > 1 && (
                <nav aria-label="Páginas de miembros" className="grid grid-cols-2 gap-3">
                  <Button size="sm" variant="outline" disabled={pagina <= 1 || cargando} onClick={() => setPagina((p) => p - 1)}>
                    Anterior
                  </Button>
                  <Button size="sm" variant="outline" disabled={pagina >= meta.totalPages || cargando} onClick={() => setPagina((p) => p + 1)}>
                    Siguiente
                  </Button>
                </nav>
              )}
            </div>
          )}
        </section>
      </div>

      <Sheet
        open={!!accion}
        onClose={cerrarAccion}
        title={tituloAccion}
        footer={
          <>
            <Button size="sm" variant="outline" disabled={trabajando} onClick={cerrarAccion}>
              Volver
            </Button>
            <Button size="sm" variant={accion?.tipo === 'desactivar' ? 'danger' : 'primary'} loading={trabajando} onClick={() => void confirmar()}>
              {accion?.tipo === 'rol' ? 'Cambiar rol' : accion?.tipo === 'reactivar' ? 'Reactivar' : miembroAccion?.estado === 'pendiente' ? 'Cancelar invitación' : 'Desactivar'}
            </Button>
          </>
        }
      >
        {miembroAccion && accion?.tipo === 'rol' && (
          <>
            <p className="text-ink-2">
              Rol actual de <strong>{nombreAccion}</strong>: {ROL_TEXTO[miembroAccion.rol]}.
            </p>
            <SelectField
              label="Nuevo rol"
              required
              placeholder="Elige un rol"
              options={roles.filter((r) => r !== miembroAccion.rol).map((r) => ({ value: r, label: ROL_TEXTO[r] }))}
              value={rolNuevo}
              onChange={(e) => {
                setRolNuevo(e.target.value as RolCuenta)
                setErrorAccion('')
              }}
            />
            <p className="text-sm text-muted">Al cambiar el rol se quitan las asignaciones propias del rol anterior. El historial se conserva.</p>
          </>
        )}
        {miembroAccion && accion?.tipo === 'desactivar' && (
          <p className="text-ink-2">
            {miembroAccion.estado === 'pendiente' ? (
              <>Se cancelará la invitación enviada a {miembroAccion.usuario.correo}.</>
            ) : (
              <>
                <strong>{nombreAccion}</strong> perderá el acceso a {cuenta.nombre} de inmediato. Podrás reactivarla después.
              </>
            )}
          </p>
        )}
        {miembroAccion && accion?.tipo === 'reactivar' && (
          <p className="text-ink-2">
            <strong>{nombreAccion}</strong> volverá a tener acceso a {cuenta.nombre} como {ROL_TEXTO[miembroAccion.rol]}.
          </p>
        )}
        {errorAccion && <Aviso tono="error">{errorAccion}</Aviso>}
      </Sheet>
    </AuthScreen>
  )
}
