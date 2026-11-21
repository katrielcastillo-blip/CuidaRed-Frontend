/*
 * PerfilMiembro.tsx — Perfil de un miembro de la cuenta activa: datos (tabla Usuario), historial de membresías de ESTA
 * cuenta (Membresia: rol, estado, inicio y fin), acceso a adultos mayores (Vinculo: «Adultos mayores que puede ver»
 * del Familiar con permiso explícito, o los asignados al Cuidador y al Voluntario), perfil de cuidador (Cuidador),
 * permisos efectivos del rol, actividad reciente (auditoría) y acciones: editar datos, cambiar rol, desactivar/reactivar
 * (se conserva el historial) y cancelar una invitación pendiente.
 * Módulo: admin (RF-09 · CU-13 · SRS §8.2.2.1.3 Auditabilidad · §8.2.2.3.5 b "invalidar usuarios desactivados").
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Check, ChevronRight, HandHeart, IdCard, Mail, Pencil, Phone, Trash2, UserCheck, UserCog, UserRound, UserX } from 'lucide-react'
import { Badge, Button, ButtonLink, EmptyState, InfoRow, Sheet, SuccessOverlay, useToast } from '@/components/ui'
import { actualizarUsuario, cambiarEstadoUsuario, cambiarRolMiembro, eliminarUsuario, estadoEnCuenta, membresiaEnCuenta } from '@/domain/api'
import { nombreCompleto, useSession, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, fechaHora } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { tipoDeCuenta } from '@/domain/planes'
import { cuidadorDeUsuario, membresiasDe, VINCULO_DE_ROL } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Rol, Usuario } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { operacionTexto, ResultadoBadge } from '../components/AuditoriaUi'
import { AccesosAdultos } from '../components/AccesosAdultos'
import { EstadoBadge, MiembroAvatarGrande, RolBadge, rolTexto } from '../components/MiembroUi'
import { AvisoSinConexion, Nota } from '../components/Nota'
import { ReenviarInvitacion } from '../components/CodigoActivacion'
import { RolSelector } from '../components/RolSelector'
import { UsuarioCampos, type CamposUsuario, type ErroresUsuario } from '../components/UsuarioCampos'
import { hace } from '../lib/datos'
import { alcanceDeRol, permisosDeRol, rolesDeTipo } from '../lib/permisos'
import { EditarCuidador, PerfilCuidador } from '../components/CuidadorUi'

type Dialogo = 'datos' | 'rol' | 'estado' | 'cancelar' | 'cuidador' | null

const TARJETA = 'flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1'
const H2 = 'text-xl font-bold text-ink'

export default function PerfilMiembro() {
  const { usuarioId } = useParams()
  const { base } = useShell()
  const yo = useUser()
  const { org } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const usuarios = useDB((s) => s.usuarios)
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  const membresias = useDB((s) => s.membresias)
  const cuidadores = useDB((s) => s.cuidadores)
  const auditoria = useDB((s) => s.auditoria)

  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [cancelada, setCancelada] = useState(false)
  /** Copia para seguir pintando el perfil mientras se muestra «Invitación cancelada». */
  const [copia, setCopia] = useState<{ usuario: Usuario; rol: Rol } | null>(null)

  const tipo = tipoDeCuenta(org)
  /** La persona y su membresía en ESTA cuenta: quien no pertenece a la cuenta activa no se puede abrir (CU-13). */
  const encontrado = useMemo(() => {
    const usuario = usuarios.find((u) => u.id === usuarioId)
    const membresia = usuario ? membresiaEnCuenta(membresias, usuario.id, yo.orgId) : undefined
    return usuario && membresia ? { usuario, membresia } : null
  }, [usuarios, membresias, usuarioId, yo.orgId])
  const u = encontrado?.usuario ?? copia?.usuario ?? null
  const rol: Rol | null = encontrado?.membresia.rol ?? copia?.rol ?? null
  const estado = encontrado ? estadoEnCuenta(encontrado.usuario, encontrado.membresia) : 'invitado'

  /** Adultos de la cuenta con el vínculo de acceso de su rol (familiar, cuidador o voluntario). */
  const aCargo = useMemo(() => {
    const tipoVinculo = rol ? VINCULO_DE_ROL[rol] : undefined
    if (!u || !tipoVinculo) return 0
    const propios = new Set(adultos.filter((a) => a.orgId === yo.orgId).map((a) => a.id))
    return vinculos.filter((v) => v.usuarioId === u.id && v.tipoVinculoId === tipoVinculo && propios.has(v.adultoId)).length
  }, [vinculos, adultos, u, rol, yo.orgId])
  const historial = useMemo(() => (u ? membresiasDe(membresias, u.id).filter((m) => m.orgId === yo.orgId) : []), [membresias, u, yo.orgId])
  const cuidador = useMemo(() => (u ? cuidadorDeUsuario(cuidadores, u.id) : undefined), [cuidadores, u])
  const actividad = useMemo(
    () => (u ? auditoria.filter((e) => e.orgId === yo.orgId && (e.usuarioId === u.id || (e.entidad === 'usuario' && e.registroId === u.id))).slice(0, 8) : []),
    [auditoria, u, yo.orgId],
  )
  const permisos = useMemo(() => (rol ? permisosDeRol(rol, tipo) : []), [rol, tipo])

  const volverALista = `${base}/miembros`
  const cerrar = useCallback(() => setDialogo(null), [])

  if (!u || !rol) {
    return (
      <Page title="Perfil de miembro" back={volverALista}>
        <EmptyState
          title="Miembro no encontrado"
          text="Esta persona no pertenece a la cuenta activa o el enlace no es válido."
          action={<ButtonLink to={volverALista}>Volver a miembros</ButtonLink>}
        />
      </Page>
    )
  }

  const nombre = nombreCompleto(u)
  const esYo = u.id === yo.id
  const esTitular = org?.usuarioTitularId === u.id
  /** Los datos personales son de la persona: solo se editan desde su cuenta principal. */
  const propia = u.orgId === yo.orgId
  const inactivo = estado === 'inactivo'
  const desactivar = !inactivo
  const bloqueo = !enLinea ? 'Necesitas conexión para esta acción.' : esYo ? 'No puedes desactivar ni cambiar el rol de tu propia cuenta.' : esTitular ? 'La persona titular de la cuenta no puede cambiar de rol ni desactivarse.' : undefined
  const tieneAcceso = !!VINCULO_DE_ROL[rol]

  const cambiarEstado = () => {
    const r = cambiarEstadoUsuario(yo, u.id, desactivar ? 'inactivo' : 'activo')
    setDialogo(null)
    if (!r.ok) return toast(r.error, 'error')
    toast(desactivar ? `${nombre} ya no puede acceder a esta cuenta.` : `${nombre} vuelve a tener acceso a esta cuenta como ${rolTexto(rol)}.`)
  }

  const cancelarInvitacion = () => {
    const snapshot = { usuario: u, rol }
    const r = eliminarUsuario(yo, u.id)
    setDialogo(null)
    if (!r.ok) return toast(r.error, 'error')
    setCopia(snapshot)
    setCancelada(true)
  }

  return (
    <Page title="Perfil de miembro" back={volverALista} wide>
      {!enLinea && <AvisoSinConexion />}

      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8 md:items-start">
        <div className="contents md:flex md:flex-col md:gap-6 md:min-w-0">
          {/* Identidad */}
          <section className="order-1 md:order-none flex flex-col items-center gap-3 text-center md:px-5 md:py-8 md:rounded-md md:bg-surface md:shadow-1" aria-label="Datos del miembro">
            <MiembroAvatarGrande src={u.avatar} size={112} />
            <div className="flex flex-col gap-0.5 max-w-full">
              <h2 className="text-[28px] font-bold leading-tight text-[#0a3fa0] wrap-anywhere">{nombre}</h2>
              <p className="text-base text-muted tracking-[0.02em]">{u.cedula || 'Cédula no registrada'}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <RolBadge rol={rol} inactivo={inactivo} grande />
              <EstadoBadge estado={estado} grande />
            </div>
            {esTitular && <Badge tone="info">Titular de la cuenta</Badge>}
            {esYo && <p className="text-sm text-muted">Esta es tu cuenta.</p>}
          </section>

          {/* Adultos mayores a los que tiene acceso (tabla Vinculo): autorización explícita del familiar, asignados del cuidador/voluntario */}
          {tieneAcceso && !inactivo ? (
            <AccesosAdultos key={`${u.id}-${rol}`} usuario={u} rol={rol} className="order-4 md:order-none" />
          ) : (
            <section className={`order-4 md:order-none ${TARJETA}`} aria-labelledby="h-vinculos">
              <h3 id="h-vinculos" className="text-base font-bold">
                Adultos mayores
              </h3>
              <p className="text-sm text-muted">
                {inactivo
                  ? 'Sin acceso: la membresía está inactiva en esta cuenta.'
                  : `Accede a todos los adultos mayores de la cuenta (${rolTexto(rol)}): no necesita asignaciones individuales.`}
              </p>
            </section>
          )}

          {/* Permisos efectivos */}
          <section className={`order-7 md:order-none ${TARJETA}`} aria-labelledby="h-permisos">
            <div className="flex items-center justify-between gap-3">
              <h3 id="h-permisos" className="text-base font-bold">
                Permisos del rol {rolTexto(rol)}
              </h3>
              {puede(yo, 'usuarios:gestionar') && (
                <Link to={`${base}/roles`} className="inline-flex items-center min-h-12 text-sm font-bold text-navy hover:underline">
                  Ver matriz
                </Link>
              )}
            </div>
            <p className="text-sm text-ink-2">
              <strong>Alcance:</strong> {alcanceDeRol(rol, tipo)}
            </p>
            <dl className="flex flex-col gap-3">
              {permisos.map((g) => (
                <div key={g.grupo}>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">{g.grupo}</dt>
                  <dd>
                    <ul className="flex flex-col gap-1 mt-1">
                      {g.textos.map((t) => (
                        <li key={t} className="flex items-start gap-2 text-sm">
                          <Check size={16} strokeWidth={3} className="flex-none mt-0.5 text-success-700" aria-hidden />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="contents md:flex md:flex-col md:gap-6 md:min-w-0">
          {/* Información */}
          <section className="order-2 md:order-none flex flex-col gap-4" aria-labelledby="h-info">
            <h2 id="h-info" className={H2}>
              Información personal
            </h2>
            <InfoRow icon={<UserRound size={22} aria-hidden />} label="Nombres · Apellidos" value={`${u.nombre} · ${u.apellido || 'sin apellido'}`} />
            <InfoRow icon={<Mail size={22} aria-hidden />} label="Correo electrónico" value={u.email} />
            <InfoRow icon={<Phone size={22} aria-hidden />} label="Teléfono" value={u.telefono || 'Sin teléfono registrado'} />
            <InfoRow icon={<IdCard size={22} aria-hidden />} label="Cédula" value={u.cedula || 'No registrada'} />
            <InfoRow
              icon={<CalendarDays size={22} aria-hidden />}
              label="Miembro desde"
              value={fechaCorta(historial.at(-1)?.fechaInicio ?? u.creadoEn)}
            />
            <InfoRow icon={<UserCheck size={22} aria-hidden />} label="Estado en esta cuenta" value={<EstadoBadge estado={estado} />} />
          </section>

          {/* Acciones */}
          <section className="order-3 md:order-none flex flex-col gap-3" aria-labelledby="h-acciones">
            <h2 id="h-acciones" className={H2}>
              Acciones
            </h2>
            <div className="flex flex-col gap-3">
              <Button variant="outline" className="border-navy!" fullWidth icon={<Pencil size={20} aria-hidden />} disabled={!enLinea || !propia} onClick={() => setDialogo('datos')}>
                Editar datos
              </Button>
              <Button variant="outline" className="border-navy!" fullWidth icon={<UserCog size={20} aria-hidden />} disabled={!!bloqueo || inactivo} onClick={() => setDialogo('rol')}>
                Cambiar rol
              </Button>
              <Button
                variant={desactivar ? 'outline' : 'soft'}
                className={desactivar ? 'border-navy!' : 'border-teal!'}
                fullWidth
                icon={desactivar ? <UserX size={20} aria-hidden /> : <UserCheck size={20} aria-hidden />}
                disabled={!!bloqueo}
                onClick={() => setDialogo('estado')}
              >
                {desactivar ? 'Desactivar' : 'Reactivar'}
              </Button>
              {estado === 'invitado' && (
                <Button variant="danger-soft" className="border-danger!" fullWidth icon={<Trash2 size={20} aria-hidden />} disabled={!!bloqueo} onClick={() => setDialogo('cancelar')}>
                  Cancelar invitación
                </Button>
              )}
            </div>
            {bloqueo && <p className="text-sm text-muted">{bloqueo}</p>}
            {!propia && <p className="text-sm text-muted">Esta persona también pertenece a otra cuenta: sus datos personales los edita ella misma. Aquí gestionas su rol y su acceso a esta cuenta.</p>}
            {estado === 'invitado' && (
              <>
                <p className="text-sm text-ink-2">
                  Invitación pendiente: la cuenta se activará cuando la persona cree su contraseña en “Activar mi cuenta” con {u.email} y su código de activación.
                </p>
                <ReenviarInvitacion usuarioId={u.id} email={u.email} rol={rol} deshabilitado={!enLinea} />
              </>
            )}
          </section>

          {/* Historial de membresías de esta cuenta (tabla Membresia) */}
          <section className={`order-5 md:order-none ${TARJETA}`} aria-labelledby="h-membresias">
            <h3 id="h-membresias" className="text-base font-bold">
              Historial de membresías
            </h3>
            <p className="-mt-1 text-sm text-muted">Cada cambio de rol o de estado cierra la membresía vigente y abre una nueva: el historial se conserva.</p>
            {historial.length === 0 ? (
              <p className="text-sm text-muted">Sin membresías registradas.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <caption className="sr-only">Membresías de {nombre} en esta cuenta: rol, estado, fecha de inicio y de fin</caption>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line-soft">
                      <th scope="col" className="pr-2 py-2 font-bold">Rol</th>
                      <th scope="col" className="pr-2 py-2 font-bold">Estado</th>
                      <th scope="col" className="pr-2 py-2 font-bold">Inicio</th>
                      <th scope="col" className="py-2 font-bold">Fin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {historial.map((m) => (
                      <tr key={m.id} className="align-top">
                        <td className="pr-2 py-2.5">
                          <span className="font-semibold">{rolTexto(m.rol)}</span>
                        </td>
                        <td className="pr-2 py-2.5">
                          <span
                            className={
                              m.estado === 'activa'
                                ? 'inline-flex px-2 py-0.5 rounded-xl text-[10px] font-bold uppercase bg-success-700 text-white'
                                : 'inline-flex px-2 py-0.5 rounded-xl text-[10px] font-bold uppercase bg-surface-2 text-ink-2'
                            }
                          >
                            {m.estado === 'activa' ? 'Vigente' : 'Cerrada'}
                          </span>
                        </td>
                        <td className="pr-2 py-2.5 whitespace-nowrap">{fechaCorta(m.fechaInicio)}</td>
                        <td className="py-2.5 whitespace-nowrap">{m.fechaFin ? fechaCorta(m.fechaFin) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Perfil de cuidador (tabla Cuidador) */}
          {(rol === 'cuidador' || rol === 'voluntario' || cuidador) && (
            <section className={`order-6 md:order-none ${TARJETA}`} aria-labelledby="h-cuidador">
              <div className="flex items-center justify-between gap-3">
                <h3 id="h-cuidador" className="flex items-center gap-2 text-base font-bold">
                  <HandHeart size={20} className="text-navy" aria-hidden /> Perfil de cuidador
                </h3>
                {puede(yo, 'cuidadores:gestionar') && propia && (
                  <Button variant="ghost" size="sm" icon={<Pencil size={18} aria-hidden />} disabled={!enLinea} onClick={() => setDialogo('cuidador')}>
                    {cuidador ? 'Editar' : 'Registrar'}
                  </Button>
                )}
              </div>
              <PerfilCuidador cuidador={cuidador} />
            </section>
          )}

          {/* Actividad reciente */}
          {puede(yo, 'auditoria:ver') && (
            <section className={`order-8 md:order-none ${TARJETA}`} aria-labelledby="h-actividad">
              <div className="flex items-center justify-between gap-3">
                <h3 id="h-actividad" className="text-base font-bold">
                  Actividad reciente
                </h3>
                <Link to={`${base}/auditoria?usuario=${u.id}`} className="inline-flex items-center gap-1 min-h-12 text-sm font-bold text-navy hover:underline">
                  Ver en auditoría <ChevronRight size={16} aria-hidden />
                </Link>
              </div>
              {actividad.length === 0 ? (
                <p className="text-sm text-muted">Sin actividad registrada.</p>
              ) : (
                <ol className="flex flex-col divide-y divide-line-soft">
                  {actividad.map((e) => (
                    <li key={e.id} className="flex flex-col gap-1 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-semibold text-ink">{operacionTexto(e.accion)}</span>
                        <ResultadoBadge resultado={e.resultado} className="flex-none" />
                      </div>
                      <span className="text-xs text-muted">
                        <time dateTime={e.fecha} title={fechaHora(e.fecha)}>
                          {hace(e.fecha)}
                        </time>
                        {e.usuarioId !== u.id && ` · por ${e.usuarioNombre}`}
                        {e.detalle && ` · ${e.detalle}`}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      </div>

      {dialogo === 'datos' && <EditarDatos key={u.id} usuario={u} onClose={cerrar} />}
      {dialogo === 'rol' && <CambiarRol key={`${u.id}-${rol}`} usuario={u} rolActual={rol} adultosACargo={aCargo} onClose={cerrar} />}
      {dialogo === 'cuidador' && <EditarCuidador key={u.id} usuario={u} cuidador={cuidador} onClose={cerrar} />}

      <Sheet
        open={dialogo === 'estado'}
        onClose={cerrar}
        title={desactivar ? 'Desactivar miembro' : 'Reactivar miembro'}
        footer={
          <>
            <Button variant="light" onClick={cerrar}>
              Cancelar
            </Button>
            <Button variant={desactivar ? 'danger' : 'primary'} onClick={cambiarEstado}>
              {desactivar ? 'Desactivar' : 'Reactivar'}
            </Button>
          </>
        }
      >
        {desactivar ? (
          <>
            <p>
              <strong>{nombre}</strong> perderá el acceso a esta cuenta
              {aCargo > 0 ? ` y dejará de tener acceso a ${aCargo} ${aCargo === 1 ? 'adulto mayor' : 'adultos mayores'}` : ''}. Si no pertenece a otra cuenta, su sesión se cerrará y no podrá volver a entrar.
            </p>
            <p className="text-sm text-muted">Su historial (membresía, visitas, necesidades, auditoría) se conserva. Puedes reactivarlo cuando quieras.</p>
          </>
        ) : (
          <p>
            <strong>{nombre}</strong> volverá a tener acceso a esta cuenta con los permisos del rol {rolTexto(rol)}.
            {tieneAcceso ? ' Tendrás que volver a indicar los adultos mayores a los que accede.' : ''}
          </p>
        )}
      </Sheet>

      <Sheet
        open={dialogo === 'cancelar'}
        onClose={cerrar}
        title="Cancelar invitación"
        footer={
          <>
            <Button variant="light" onClick={cerrar}>
              Volver
            </Button>
            <Button variant="danger" onClick={cancelarInvitacion}>
              Cancelar invitación
            </Button>
          </>
        }
      >
        <p>
          ¿Seguro que deseas cancelar la invitación de <strong>{nombre}</strong>? Su código de activación dejará de servir.
        </p>
        <p className="text-sm text-muted">Solo se eliminan las invitaciones que nunca se activaron. A quien ya tiene acceso se le desactiva: su historial se conserva.</p>
      </Sheet>

      <SuccessOverlay open={cancelada} message="Invitación cancelada" onDone={() => navigate(volverALista, { replace: true })} />
    </Page>
  )
}

/** Hoja «Editar datos»: valida y guarda con actualizarUsuario (el rol se cambia con «Cambiar rol»). */
function EditarDatos({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const yo = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const [datos, setDatos] = useState<CamposUsuario>({
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    telefono: usuario.telefono,
    cedula: usuario.cedula,
    rol: '',
    adultoIds: [],
  })
  const [errores, setErrores] = useState<ErroresUsuario>({})

  const cambiar = <K extends keyof CamposUsuario>(campo: K, valor: CamposUsuario[K]) => {
    setDatos((d) => ({ ...d, [campo]: valor }))
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  const guardar = () => {
    const r = actualizarUsuario(yo, usuario.id, { nombre: datos.nombre, apellido: datos.apellido, email: datos.email, telefono: datos.telefono, cedula: datos.cedula })
    if (!r.ok) {
      setErrores((r.errores ?? {}) as ErroresUsuario)
      toast(r.error, 'error')
      return
    }
    toast('Cambios guardados')
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Editar datos"
      footer={
        <>
          <Button variant="light" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!enLinea}>
            Guardar
          </Button>
        </>
      }
    >
      {!enLinea && <AvisoSinConexion />}
      <UsuarioCampos datos={datos} errores={errores} onChange={cambiar} modo="datos" />
    </Sheet>
  )
}

/** Hoja «Cambiar rol»: solo ofrece los roles del tipo de cuenta; al confirmar se abre una membresía nueva y se limpian los accesos del rol anterior. */
function CambiarRol({ usuario, rolActual, adultosACargo, onClose }: { usuario: Usuario; rolActual: Rol; adultosACargo: number; onClose: () => void }) {
  const yo = useUser()
  const { org } = useSession()
  const toast = useToast()
  const enLinea = useEnLinea()
  const [nuevo, setNuevo] = useState<Rol>(rolActual)
  const [error, setError] = useState<string | undefined>()

  const guardar = () => {
    const r = cambiarRolMiembro(yo, usuario.id, nuevo)
    if (!r.ok) {
      setError(r.errores?.rol ?? r.error)
      toast(r.error, 'error')
      return
    }
    toast(`Rol actualizado a ${rolTexto(nuevo)}. Se abrió una membresía nueva y los permisos ya se aplican.`)
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Cambiar rol"
      footer={
        <>
          <Button variant="light" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!enLinea || nuevo === rolActual}>
            Cambiar rol
          </Button>
        </>
      }
    >
      {!enLinea && <AvisoSinConexion />}
      <p className="text-sm text-ink-2">
        Rol actual de <strong>{nombreCompleto(usuario)}</strong>: {rolTexto(rolActual)}.
      </p>
      <RolSelector
        valor={nuevo}
        roles={rolesDeTipo(tipoDeCuenta(org))}
        error={error}
        onChange={(r) => {
          setNuevo(r)
          setError(undefined)
        }}
      />
      {nuevo !== rolActual && (
        <Nota tono="warning">
          Cambiarás el rol de {rolTexto(rolActual)} a {rolTexto(nuevo)}: la persona solo podrá usar las funciones del nuevo rol.
          {adultosACargo > 0 ? ` Se quitarán sus ${adultosACargo} ${adultosACargo === 1 ? 'acceso' : 'accesos'} a adultos mayores; podrás asignarlos de nuevo.` : ''}
        </Nota>
      )}
    </Sheet>
  )
}
