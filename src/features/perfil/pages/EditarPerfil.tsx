/*
 * EditarPerfil.tsx — Editar mi perfil: nombre, correo, teléfono y foto; cambio de contraseña y eliminación de
 * la propia cuenta (voluntario y familiar responsable).
 * Módulo: perfil (Ley 172-13: rectificación y cancelación · SRS §8.2.2.3.4 e: auditoría · §8.2.2.1.22: sin
 * perder lo escrito).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Pencil, Trash2 } from 'lucide-react'
import { Button, InfoRow, Sheet, TextField, useToast } from '@/components/ui'
import { logout, nombreCompleto, ROL_LABEL, useSession } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import type { Usuario } from '@/domain/types'
import { Aviso } from '@/features/auth/components/Piezas'
import { formatTelefono } from '@/features/auth/lib/validar'
import { Page, useShell } from '@/layouts/AppShell'
import { useBorrador } from '@/lib/useBorrador'
import { CambiarPassword } from '../components/CambiarPassword'
import { PerfilCabecera } from '../components/PerfilCabecera'
import { leerAvatar } from '../lib/avatar'
import { actualizarMiPerfil, eliminarMiCuenta, type DatosMiPerfil } from '../lib/cuenta'
import { muestraCedula, puedeEliminarCuenta } from '../lib/rol'

type Errores = Partial<Record<'nombre' | 'apellido' | 'email' | 'telefono', string>>

function Vista({ user }: { user: Usuario }) {
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const archivo = useRef<HTMLInputElement>(null)

  const [d, setD, descartar] = useBorrador<DatosMiPerfil>(`mi-perfil:${user.id}`, {
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    telefono: user.telefono,
    avatar: user.avatar,
  })
  const [errores, setErrores] = useState<Errores>({})
  const [cambiando, setCambiando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const conCedula = muestraCedula(user.rol)
  const cerrarPassword = useCallback(() => setCambiando(false), [])
  const cerrarEliminar = useCallback(() => setEliminando(false), [])
  const set = (campo: keyof Errores, valor: string) => {
    setD((x) => ({ ...x, [campo]: valor }))
    setErrores((x) => ({ ...x, [campo]: undefined }))
  }

  const elegirFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!f) return
    try {
      const avatar = await leerAvatar(f)
      setD((x) => ({ ...x, avatar }))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo cargar la imagen.', 'error')
    }
  }

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    const res = actualizarMiPerfil(user, d)
    if (!res.ok) {
      setErrores(res.errores ?? {})
      if (!res.errores) toast(res.error, 'error')
      return
    }
    descartar()
    toast('Cambios guardados')
    navigate(`${base}/perfil`)
  }

  const cancelar = () => {
    descartar()
    navigate(`${base}/perfil`)
  }

  const eliminar = () => {
    const res = eliminarMiCuenta(user)
    if (!res.ok) {
      toast(res.error, 'error')
      return
    }
    descartar()
    logout()
    toast('Tu cuenta fue eliminada. Gracias por acompañar a tu comunidad.')
    navigate('/inicio', { replace: true })
  }

  const nombreVista = nombreCompleto({ nombre: d.nombre.trim() || user.nombre, apellido: d.apellido.trim() || user.apellido })

  return (
    <Page title="Editar perfil" back={`${base}/perfil`} hideAvatar>
      <form
        className="flex flex-col gap-7 md:rounded-lg md:border md:border-line-soft md:bg-surface md:px-10 md:py-8 md:shadow-1"
        onSubmit={guardar}
        noValidate
      >
        <PerfilCabecera
          nombre={nombreVista}
          avatar={d.avatar}
          size={150}
          cedula={conCedula ? user.cedula : undefined}
          rol={ROL_LABEL[user.rol]}
          fotoAccion={
            <>
              <button
                type="button"
                className="absolute bottom-1 right-0 grid size-12 place-items-center rounded-full border-[3px] border-bg bg-navy text-white shadow-2 transition hover:bg-navy-700"
                aria-label="Cambiar foto de perfil"
                onClick={() => archivo.current?.click()}
              >
                <Pencil size={20} aria-hidden />
              </button>
              <input ref={archivo} type="file" accept="image/*" hidden onChange={elegirFoto} />
            </>
          }
        >
          {d.avatar && (
            <Button variant="ghost" size="sm" onClick={() => setD((x) => ({ ...x, avatar: undefined }))}>
              Quitar foto
            </Button>
          )}
        </PerfilCabecera>

        <section className="flex flex-col gap-5" aria-labelledby="editar-info">
          <h2 className="section-title" id="editar-info">
            Información personal
          </h2>
          <div className="grid gap-5 md:grid-cols-2 md:gap-x-6">
            <TextField label="Nombre" autoComplete="given-name" value={d.nombre} error={errores.nombre} onChange={(e) => set('nombre', e.target.value)} />
            <TextField label="Apellido" autoComplete="family-name" value={d.apellido} error={errores.apellido} onChange={(e) => set('apellido', e.target.value)} />
            <TextField
              label="Correo electrónico"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={d.email}
              error={errores.email}
              help="Es el correo con el que inicias sesión. Si lo cambias, usa el nuevo la próxima vez."
              onChange={(e) => set('email', e.target.value)}
            />
            <TextField
              label="Teléfono"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="000 000 0000"
              maxLength={12}
              value={d.telefono}
              error={errores.telefono}
              onChange={(e) => set('telefono', formatTelefono(e.target.value))}
            />
          </div>
          {conCedula && <p className="text-sm text-muted">Para corregir tu cédula o tu rol, contacta al administrador de tu organización.</p>}
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="editar-cuenta">
          <h2 className="section-title" id="editar-cuenta">
            Cuenta
          </h2>
          <InfoRow
            icon={<KeyRound size={22} aria-hidden />}
            label="Contraseña"
            value="••••••••••••"
            action={
              <Button variant="ghost" size="sm" onClick={() => setCambiando(true)}>
                Cambiar
              </Button>
            }
          />
        </section>

        <div className="flex flex-col gap-3">
          {!enLinea && (
            <Aviso tono="offline">
              Sin conexión: tus cambios se conservan en este formulario, pero solo podrás guardarlos cuando vuelvas a tener internet.
            </Aviso>
          )}
          <Button type="submit" variant="soft" fullWidth disabled={!enLinea}>
            Guardar cambios
          </Button>
          <Button variant="outline" fullWidth onClick={cancelar}>
            Cancelar
          </Button>
          {puedeEliminarCuenta(user.rol) && (
            <Button variant="danger-soft" fullWidth icon={<Trash2 size={20} aria-hidden />} disabled={!enLinea} onClick={() => setEliminando(true)}>
              Eliminar mi cuenta
            </Button>
          )}
        </div>
      </form>

      <CambiarPassword open={cambiando} onClose={cerrarPassword} user={user} />

      <Sheet
        open={eliminando}
        onClose={cerrarEliminar}
        title="Eliminar mi cuenta"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={cerrarEliminar}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={eliminar} disabled={!enLinea}>
              Sí, eliminar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 leading-normal text-ink-2">
          <p>
            ¿Seguro que quieres eliminar la cuenta <strong className="wrap-anywhere text-ink">{user.email}</strong>?
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>Se borrarán tus datos personales y se cerrará tu sesión.</li>
            <li>Dejarás de tener acceso a CuidaRed; para volver, tu organización tendrá que invitarte de nuevo.</li>
            <li>Las visitas y necesidades que registraste se conservan en el historial del adulto mayor, según la política de retención.</li>
          </ul>
          <p className="font-semibold text-danger">Esta acción no se puede deshacer.</p>
        </div>
      </Sheet>
    </Page>
  )
}

/** Editar perfil — compartido por los 4 roles. */
export default function EditarPerfil() {
  const { user } = useSession()
  if (!user) return null
  return <Vista user={user} />
}
