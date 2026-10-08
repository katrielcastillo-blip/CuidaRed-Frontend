import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Mail, Phone } from 'lucide-react'
import { Button, ButtonLink, ChoicePills, EmptyState, InfoRow, RiesgoBadge, Sheet, SuccessOverlay, useToast } from '@/components/ui'
import { nombreCompleto, useSession } from '@/domain/auth'
import { fechaCorta } from '@/domain/dates'
import { mutate, useDB } from '@/domain/store'
import type { EstadoMiembro, Rol, Usuario } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { EstadoBadge, MiembroAvatarGrande, RolBadge, estadoTexto, rolTexto } from '../components/MiembroUi'
import { esMiembro } from '../lib/datos'
import styles from './PerfilMiembro.module.css'

export default function PerfilMiembro() {
  const { usuarioId } = useParams()
  const { base } = useShell()
  const { org } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const usuarios = useDB((s) => s.usuarios)
  const adultos = useDB((s) => s.adultos)

  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [eliminado, setEliminado] = useState(false)
  /** Copia del miembro para seguir pintando el perfil mientras se muestra «Miembro eliminado correctamente!». */
  const [copia, setCopia] = useState<Usuario | null>(null)

  const encontrado = useMemo(
    () => (org ? (usuarios.find((u) => u.id === usuarioId && esMiembro(u, org.id)) ?? null) : null),
    [usuarios, usuarioId, org],
  )
  const u = encontrado ?? copia
  const aCargo = useMemo(() => (u ? adultos.filter((a) => a.cuidadorIds.includes(u.id)) : []), [adultos, u])

  const volverALista = `${base}/miembros`
  const cerrarEdicion = useCallback(() => setEditando(false), [])
  const cerrarConfirmacion = useCallback(() => setConfirmando(false), [])
  const avisarGuardado = useCallback(() => toast('Cambios guardados'), [toast])

  if (!u) {
    return (
      <Page title="Perfil Miembro" back={volverALista}>
        <EmptyState
          title="Miembro no encontrado"
          text="Puede que haya sido eliminado o que el enlace no sea válido."
          action={<ButtonLink to={volverALista}>Volver a miembros</ButtonLink>}
        />
      </Page>
    )
  }

  const nombre = nombreCompleto(u)

  const eliminar = () => {
    setCopia(u)
    mutate((db) => {
      db.usuarios = db.usuarios.filter((x) => x.id !== u.id)
      for (const a of db.adultos) a.cuidadorIds = a.cuidadorIds.filter((id) => id !== u.id)
      // Invitaciones de la organización (sin familia) pendientes para ese correo
      db.invitaciones = db.invitaciones.filter((i) => !(i.familiaId === '' && i.email.toLowerCase() === u.email.toLowerCase()))
      if (db.sessionUserId === u.id) db.sessionUserId = null
    })
    setConfirmando(false)
    setEliminado(true)
  }

  return (
    <Page title="Perfil Miembro" back={volverALista} wide>
      <div className={styles.grid}>
        <div className={styles.colIzq}>
          <section className={styles.identidad} aria-label="Datos del miembro">
            <MiembroAvatarGrande src={u.avatar} size={128} />
            <div className={styles.nombres}>
              <h2 className={styles.nombre}>{nombre}</h2>
              <p className={styles.cedula}>{u.cedula || 'Cédula no registrada'}</p>
            </div>
            <div className={styles.chips}>
              <RolBadge rol={u.rol} inactivo={u.estado === 'inactivo'} grande />
              <EstadoBadge estado={u.estado} grande />
            </div>
          </section>

          <section className={styles.aCargo} aria-label="Adultos mayores a cargo">
            <span className={styles.aCargoLabel}>Adultos Mayores a Cargo</span>
            <strong className={styles.aCargoValor}>{aCargo.length}</strong>
          </section>

          {aCargo.length > 0 && (
            <section className={`${styles.lista} only-desktop`} aria-label="Adultos asignados">
              <h3 className={styles.listaTitulo}>Adultos asignados</h3>
              <ul>
                {aCargo.map((a) => (
                  <li key={a.id}>
                    <Link to={`${base}/adultos/${a.id}`} className={styles.listaItem}>
                      <span>{nombreCompleto(a)}</span>
                      <RiesgoBadge riesgo={a.riesgo} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className={styles.colDer}>
          <section className={styles.info} aria-labelledby="h-info">
            <h2 id="h-info" className="section-title">
              Información Personal
            </h2>
            <div className={styles.filas}>
              <InfoRow icon={<Mail size={22} aria-hidden />} label="Correo electrónico" value={u.email} />
              <InfoRow icon={<Phone size={22} aria-hidden />} label="Teléfono" value={u.telefono || 'Sin teléfono registrado'} />
              <InfoRow icon={<CalendarDays size={22} aria-hidden />} label="Fecha de registro" value={fechaCorta(u.creadoEn)} />
            </div>
          </section>

          <section className={styles.acciones} aria-labelledby="h-acciones">
            <h2 id="h-acciones" className="section-title">
              Acciones Rápidas
            </h2>
            <div className={styles.botones}>
              <Button variant="outline" fullWidth onClick={() => setEditando(true)}>
                Editar rol o estado
              </Button>
              <Button variant="danger-soft" fullWidth onClick={() => setConfirmando(true)}>
                Eliminar miembro
              </Button>
            </div>
          </section>
        </div>
      </div>

      {editando && <EditarRolEstado key={u.id} usuario={u} onClose={cerrarEdicion} onSaved={avisarGuardado} />}

      <Sheet
        open={confirmando}
        onClose={cerrarConfirmacion}
        title="Eliminar miembro"
        footer={
          <>
            <Button variant="light" onClick={cerrarConfirmacion}>
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
          {aCargo.length > 0
            ? ` y dejará de estar asignado a ${aCargo.length} ${aCargo.length === 1 ? 'adulto mayor' : 'adultos mayores'}`
            : ''}
          .
        </p>
        <p className="muted text-sm">Esta acción no se puede deshacer.</p>
      </Sheet>

      <SuccessOverlay open={eliminado} message="Miembro eliminado correctamente!" onDone={() => navigate(volverALista, { replace: true })} />
    </Page>
  )
}

/** Hoja «Editar rol o estado»: persiste en el store al guardar. */
function EditarRolEstado({ usuario, onClose, onSaved }: { usuario: Usuario; onClose: () => void; onSaved: () => void }) {
  const [rol, setRol] = useState<Rol>(usuario.rol)
  const [estado, setEstado] = useState<EstadoMiembro>(usuario.estado)

  const roles: Array<{ value: Rol; label: string }> = [
    { value: 'cuidador', label: 'Cuidador' },
    { value: 'coordinador', label: 'Coordinador' },
  ]
  if (!roles.some((r) => r.value === usuario.rol)) roles.push({ value: usuario.rol, label: rolTexto(usuario.rol) })
  const estados: Array<{ value: EstadoMiembro; label: string }> = [
    { value: 'activo', label: estadoTexto('activo') },
    { value: 'inactivo', label: estadoTexto('inactivo') },
  ]
  if (usuario.estado === 'invitado') estados.push({ value: 'invitado', label: estadoTexto('invitado') })

  const guardar = () => {
    mutate((db) => {
      const x = db.usuarios.find((v) => v.id === usuario.id)
      if (!x) return
      // La etiqueta del perfil sigue al rol mientras sea la predeterminada
      if (x.rol !== rol && (x.etiqueta === rolTexto(x.rol) || x.etiqueta === 'Voluntario')) x.etiqueta = rolTexto(rol)
      x.rol = rol
      x.estado = estado
    })
    onSaved()
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Editar rol o estado"
      footer={
        <>
          <Button variant="light" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Guardar</Button>
        </>
      }
    >
      <ChoicePills label="Rol" value={rol} options={roles} onChange={setRol} />
      <ChoicePills label="Estado" value={estado} options={estados} onChange={setEstado} />
    </Sheet>
  )
}
