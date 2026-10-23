/*
 * PerfilMiembro.tsx — Perfil de un usuario de la organización: datos (tabla Usuario), historial de membresías
 * (Membresia: rol, estado, inicio y fin), vínculos con adultos mayores (Vinculo + Tipo_vinculo), perfil de
 * cuidador (Cuidador + Tipo_Cuidado), permisos efectivos del rol, actividad reciente (auditoría) y acciones:
 * editar datos y rol, desactivar/reactivar y eliminar.
 * Módulo: admin (RF-09 · CU-13 · SRS §8.2.2.1.3 Auditabilidad · §8.2.2.3.5 b "invalidar usuarios desactivados").
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Check, ChevronRight, HandHeart, IdCard, Mail, Pencil, Phone, Trash2, UserCheck, UserRound, UserX } from 'lucide-react'
import { Button, ButtonLink, EmptyState, InfoRow, RiesgoBadge, Sheet, SuccessOverlay, useToast } from '@/components/ui'
import { actualizarUsuario, cambiarEstadoUsuario, eliminarUsuario } from '@/domain/api'
import { nombreCompleto, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, fechaHora } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { adultosVinculados, cuidadorDeUsuario, membresiasDe } from '@/domain/relaciones'
import { getDB, useDB } from '@/domain/store'
import type { Usuario } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { operacionTexto, ResultadoBadge } from '../components/AuditoriaUi'
import { EstadoBadge, MiembroAvatarGrande, RolBadge, rolTexto } from '../components/MiembroUi'
import { AvisoSinConexion } from '../components/Nota'
import { ReenviarInvitacion } from '../components/CodigoActivacion'
import { UsuarioCampos, type CamposUsuario, type ErroresUsuario } from '../components/UsuarioCampos'
import { hace } from '../lib/datos'
import { ALCANCE_ROL, permisosDeRol } from '../lib/permisos'
import { EditarCuidador, PerfilCuidador } from '../components/CuidadorUi'

type Dialogo = 'editar' | 'estado' | 'eliminar' | 'cuidador' | null

const TARJETA = 'flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1'
const H2 = 'text-xl font-bold text-ink'

export default function PerfilMiembro() {
  const { usuarioId } = useParams()
  const { base } = useShell()
  const yo = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const usuarios = useDB((s) => s.usuarios)
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  const membresias = useDB((s) => s.membresias)
  const cuidadores = useDB((s) => s.cuidadores)
  const orgs = useDB((s) => s.orgs)
  const catalogos = useDB((s) => s.catalogos)
  const auditoria = useDB((s) => s.auditoria)

  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [eliminado, setEliminado] = useState(false)
  /** Copia para seguir pintando el perfil mientras se muestra «Usuario eliminado». */
  const [copia, setCopia] = useState<Usuario | null>(null)

  const encontrado = useMemo(() => usuarios.find((u) => u.id === usuarioId && u.orgId === yo.orgId) ?? null, [usuarios, usuarioId, yo.orgId])
  const u = encontrado ?? copia
  const aCargo = useMemo(() => (u ? adultosVinculados(vinculos, u.id, 'voluntario_asignado') : []), [vinculos, u])
  /** Todos los vínculos del usuario con adultos mayores (cualquier tipo), con el adulto resuelto. */
  const susVinculos = useMemo(
    () =>
      u
        ? vinculos
            .filter((v) => v.usuarioId === u.id)
            .flatMap((v) => {
              const adulto = adultos.find((a) => a.id === v.adultoId)
              return adulto ? [{ vinculo: v, adulto, tipo: catalogos.tiposVinculo.find((t) => t.id === v.tipoVinculoId)?.nombre ?? v.tipoVinculoId }] : []
            })
            .sort((a, b) => nombreCompleto(a.adulto).localeCompare(nombreCompleto(b.adulto)))
        : [],
    [vinculos, adultos, catalogos, u],
  )
  const historial = useMemo(() => (u ? membresiasDe(membresias, u.id) : []), [membresias, u])
  const cuidador = useMemo(() => (u ? cuidadorDeUsuario(cuidadores, u.id) : undefined), [cuidadores, u])
  const actividad = useMemo(
    () => (u ? auditoria.filter((e) => e.orgId === yo.orgId && (e.usuarioId === u.id || (e.entidad === 'usuario' && e.registroId === u.id))).slice(0, 8) : []),
    [auditoria, u, yo.orgId],
  )
  const permisos = useMemo(() => (u ? permisosDeRol(u.rol) : []), [u])

  const volverALista = `${base}/miembros`
  const cerrar = useCallback(() => setDialogo(null), [])

  if (!u) {
    return (
      <Page title="Perfil de usuario" back={volverALista}>
        <EmptyState
          title="Usuario no encontrado"
          text="Puede que haya sido eliminado o que el enlace no sea válido."
          action={<ButtonLink to={volverALista}>Volver a usuarios</ButtonLink>}
        />
      </Page>
    )
  }

  const nombre = nombreCompleto(u)
  const esYo = u.id === yo.id
  const desactivar = u.estado !== 'inactivo'
  const bloqueo = !enLinea ? 'Necesitas conexión para esta acción.' : esYo ? 'No puedes desactivar ni eliminar tu propia cuenta.' : undefined

  const cambiarEstado = () => {
    const r = cambiarEstadoUsuario(yo, u.id, desactivar ? 'inactivo' : 'activo')
    setDialogo(null)
    if (!r.ok) return toast(r.error, 'error')
    toast(desactivar ? `${nombre} ya no puede acceder a CuidaRed.` : `${nombre} puede volver a iniciar sesión.`)
  }

  const eliminar = () => {
    const snapshot = u
    const r = eliminarUsuario(yo, u.id)
    setDialogo(null)
    if (!r.ok) return toast(r.error, 'error')
    setCopia(snapshot)
    setEliminado(true)
  }

  return (
    <Page title="Perfil de usuario" back={volverALista} wide>
      {!enLinea && <AvisoSinConexion />}

      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8 md:items-start">
        <div className="contents md:flex md:flex-col md:gap-6 md:min-w-0">
          {/* Identidad */}
          <section className="order-1 md:order-none flex flex-col items-center gap-3 text-center md:px-5 md:py-8 md:rounded-md md:bg-surface md:shadow-1" aria-label="Datos del usuario">
            <MiembroAvatarGrande src={u.avatar} size={112} />
            <div className="flex flex-col gap-0.5 max-w-full">
              <h2 className="text-[28px] font-bold leading-tight text-[#0a3fa0] wrap-anywhere">{nombre}</h2>
              <p className="text-base text-muted tracking-[0.02em]">{u.cedula || 'Cédula no registrada'}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <RolBadge rol={u.rol} inactivo={u.estado === 'inactivo'} grande />
              <EstadoBadge estado={u.estado} grande />
            </div>
            {esYo && <p className="text-sm text-muted">Esta es tu cuenta.</p>}
          </section>

          {/* Vínculos con adultos mayores (tabla Vinculo) */}
          <section className={`order-6 md:order-none ${TARJETA}`} aria-labelledby="h-vinculos">
            <div className="flex items-center justify-between gap-3">
              <h3 id="h-vinculos" className="text-base font-bold">
                Vínculos con adultos mayores
              </h3>
              <span className="text-2xl font-bold" aria-label={`${susVinculos.length} vínculos`}>
                {susVinculos.length}
              </span>
            </div>
            {susVinculos.length === 0 ? (
              <p className={u.rol === 'familiar' ? 'text-sm text-danger' : 'text-sm text-muted'}>
                {u.rol === 'familiar'
                  ? 'Sin adultos mayores a su cargo: edita el usuario para indicarlos.'
                  : u.rol === 'voluntario'
                    ? 'Sin adultos asignados. Asígnalos desde el perfil de cada adulto mayor.'
                    : 'Sin vínculos. Administradores y coordinadores acceden a todos los adultos de la organización.'}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line-soft">
                {susVinculos.map(({ vinculo, adulto, tipo }) => (
                  <li key={`${vinculo.adultoId}-${vinculo.tipoVinculoId}`}>
                    <Link to={`${base}/adultos/${adulto.id}`} className="flex items-center justify-between gap-3 min-h-14 py-1 hover:underline">
                      <span className="min-w-0 flex flex-col">
                        <span className="text-sm font-semibold truncate">{adulto.anonimizado ? 'Perfil anonimizado' : nombreCompleto(adulto)}</span>
                        <span className="text-xs text-muted">
                          {tipo} · desde {fechaCorta(vinculo.creadoEn)}
                        </span>
                      </span>
                      <RiesgoBadge riesgo={adulto.riesgo} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Permisos efectivos */}
          <section className={`order-7 md:order-none ${TARJETA}`} aria-labelledby="h-permisos">
            <div className="flex items-center justify-between gap-3">
              <h3 id="h-permisos" className="text-base font-bold">
                Permisos del rol {rolTexto(u.rol)}
              </h3>
              <Link to={`${base}/roles`} className="inline-flex items-center min-h-12 text-sm font-bold text-navy hover:underline">
                Ver matriz
              </Link>
            </div>
            <p className="text-sm text-ink-2">
              <strong>Alcance:</strong> {ALCANCE_ROL[u.rol]}
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
              label="Fecha de registro"
              value={`${fechaCorta(u.creadoEn)}${u.actualizadoEn ? ` · última modificación ${fechaCorta(u.actualizadoEn)}` : ''}`}
            />
            <InfoRow icon={<UserCheck size={22} aria-hidden />} label="Estado de la cuenta" value={<EstadoBadge estado={u.estado} />} />
          </section>

          {/* Acciones */}
          <section className="order-3 md:order-none flex flex-col gap-3" aria-labelledby="h-acciones">
            <h2 id="h-acciones" className={H2}>
              Acciones
            </h2>
            <div className="flex flex-col gap-3">
              <Button variant="outline" className="border-navy!" fullWidth icon={<Pencil size={20} aria-hidden />} disabled={!enLinea} onClick={() => setDialogo('editar')}>
                Editar datos y rol
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
              <Button variant="danger-soft" className="border-danger!" fullWidth icon={<Trash2 size={20} aria-hidden />} disabled={!!bloqueo} onClick={() => setDialogo('eliminar')}>
                Eliminar
              </Button>
            </div>
            {bloqueo && <p className="text-sm text-muted">{bloqueo}</p>}
            {u.estado === 'invitado' && (
              <>
                <p className="text-sm text-ink-2">Invitación pendiente: la cuenta se activará cuando la persona cree su contraseña en “Activar mi cuenta” con {u.email} y su código de activación.</p>
                <ReenviarInvitacion usuarioId={u.id} email={u.email} deshabilitado={!enLinea} />
              </>
            )}
          </section>

          {/* Historial de membresías (tabla Membresia) */}
          <section className={`order-4 md:order-none ${TARJETA}`} aria-labelledby="h-membresias">
            <h3 id="h-membresias" className="text-base font-bold">
              Historial de membresías
            </h3>
            <p className="-mt-1 text-sm text-muted">Cada cambio de rol o de estado cierra la membresía vigente y abre una nueva.</p>
            {historial.length === 0 ? (
              <p className="text-sm text-muted">Sin membresías registradas.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <caption className="sr-only">Membresías de {nombre}: rol, estado, fecha de inicio y de fin</caption>
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
                          {m.orgId !== u.orgId && <span className="block text-xs text-muted">{orgs.find((o) => o.id === m.orgId)?.nombre ?? 'Otra organización'}</span>}
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
          <section className={`order-5 md:order-none ${TARJETA}`} aria-labelledby="h-cuidador">
            <div className="flex items-center justify-between gap-3">
              <h3 id="h-cuidador" className="flex items-center gap-2 text-base font-bold">
                <HandHeart size={20} className="text-navy" aria-hidden /> Perfil de cuidador
              </h3>
              {puede(yo, 'cuidadores:gestionar') && (
                <Button variant="ghost" size="sm" icon={<Pencil size={18} aria-hidden />} disabled={!enLinea} onClick={() => setDialogo('cuidador')}>
                  {cuidador ? 'Editar' : 'Registrar'}
                </Button>
              )}
            </div>
            <PerfilCuidador cuidador={cuidador} />
          </section>

          {/* Actividad reciente */}
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
        </div>
      </div>

      {dialogo === 'editar' && <EditarUsuario key={u.id} usuario={u} esYo={esYo} onClose={cerrar} />}
      {dialogo === 'cuidador' && <EditarCuidador key={u.id} usuario={u} cuidador={cuidador} onClose={cerrar} />}

      <Sheet
        open={dialogo === 'estado'}
        onClose={cerrar}
        title={desactivar ? 'Desactivar usuario' : 'Reactivar usuario'}
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
              <strong>{nombre}</strong> perderá el acceso de inmediato: su sesión abierta se cerrará y no podrá volver a entrar.
            </p>
            <p className="text-sm text-muted">Sus registros (visitas, necesidades, auditoría) se conservan. Puedes reactivar la cuenta cuando quieras.</p>
          </>
        ) : (
          <p>
            <strong>{nombre}</strong> podrá volver a iniciar sesión con su contraseña y tendrá los permisos del rol {rolTexto(u.rol)}.
          </p>
        )}
      </Sheet>

      <Sheet
        open={dialogo === 'eliminar'}
        onClose={cerrar}
        title="Eliminar usuario"
        footer={
          <>
            <Button variant="light" onClick={cerrar}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={eliminar}>
              Eliminar
            </Button>
          </>
        }
      >
        <p>
          ¿Seguro que deseas eliminar a <strong>{nombre}</strong>? Perderá el acceso a CuidaRed
          {aCargo.length > 0 ? ` y dejará de estar asignado a ${aCargo.length} ${aCargo.length === 1 ? 'adulto mayor' : 'adultos mayores'}` : ''}.
        </p>
        <p className="text-sm text-muted">Esta acción no se puede deshacer. Si solo quieres retirar el acceso, usa “Desactivar”. El registro de auditoría conserva su nombre.</p>
      </Sheet>

      <SuccessOverlay open={eliminado} message="Usuario eliminado" onDone={() => navigate(volverALista, { replace: true })} />
    </Page>
  )
}

/** Hoja «Editar datos y rol»: valida y guarda con actualizarUsuario (el cambio de rol se aplica de inmediato). */
function EditarUsuario({ usuario, esYo, onClose }: { usuario: Usuario; esYo: boolean; onClose: () => void }) {
  const yo = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const [datos, setDatos] = useState<CamposUsuario>({
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    telefono: usuario.telefono,
    cedula: usuario.cedula,
    rol: usuario.rol,
    adultoIds: usuario.rol === 'familiar' ? adultosVinculados(getDB().vinculos, usuario.id, 'familiar_responsable') : [],
  })
  const [errores, setErrores] = useState<ErroresUsuario>({})

  const cambiar = <K extends keyof CamposUsuario>(campo: K, valor: CamposUsuario[K]) => {
    setDatos((d) => ({ ...d, [campo]: valor }))
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  const guardar = () => {
    // Solo el familiar responsable conserva adultos a cargo (al cambiar de rol se retiran sus vínculos).
    const r = actualizarUsuario(yo, usuario.id, datos.rol === 'familiar' ? datos : { ...datos, adultoIds: [] })
    if (!r.ok) {
      setErrores((r.errores ?? {}) as ErroresUsuario)
      toast(r.error, 'error')
      return
    }
    toast(
      datos.rol !== usuario.rol
        ? `Rol actualizado a ${rolTexto(r.valor.rol)}. Se abrió una membresía nueva y los permisos ya se aplican.`
        : 'Cambios guardados',
    )
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Editar datos y rol"
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
      <UsuarioCampos datos={datos} errores={errores} onChange={cambiar} bloquearRol={esYo ? 'No puedes cambiar el rol de tu propia cuenta.' : undefined} />
      {datos.rol !== usuario.rol && (
        <p className="text-sm text-warning-700 font-semibold">
          Cambiarás el rol de {rolTexto(usuario.rol)} a {datos.rol ? rolTexto(datos.rol) : '—'}. La persona solo podrá usar las funciones del nuevo rol.
        </p>
      )}
    </Sheet>
  )
}
