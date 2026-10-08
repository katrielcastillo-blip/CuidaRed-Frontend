import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Pencil } from 'lucide-react'
import { Button, InfoRow, Sheet, TextField, useToast } from '@/components/ui'
import { nombreCompleto, useSession } from '@/domain/auth'
import { mutate, useDB } from '@/domain/store'
import type { Usuario } from '@/domain/types'
import { errorEmail, errorNombre, errorTelefono, formatTelefono, hayErrores, normalizarEmail } from '@/features/auth/lib/validar'
import { Page, useShell } from '@/layouts/AppShell'
import { CambiarPassword } from '../components/CambiarPassword'
import { PerfilCabecera } from '../components/PerfilCabecera'
import { leerAvatar } from '../lib/avatar'
import { muestraCedula, puedeEliminarCuenta } from '../lib/rol'
import styles from '../Perfil.module.css'

interface Errores {
  nombre?: string
  apellido?: string
  email?: string
  telefono?: string
}

function Vista({ user }: { user: Usuario }) {
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const usuarios = useDB((s) => s.usuarios)
  const archivo = useRef<HTMLInputElement>(null)

  const [nombre, setNombre] = useState(user.nombre)
  const [apellido, setApellido] = useState(user.apellido)
  const [email, setEmail] = useState(user.email)
  const [telefono, setTelefono] = useState(user.telefono)
  const [avatar, setAvatar] = useState<string | undefined>(user.avatar)
  const [errores, setErrores] = useState<Errores>({})
  const [cambiando, setCambiando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const conCedula = muestraCedula(user.rol)
  const cerrarPassword = useCallback(() => setCambiando(false), [])
  const cerrarEliminar = useCallback(() => setEliminando(false), [])
  const limpiar = (campo: keyof Errores) => setErrores((x) => ({ ...x, [campo]: undefined }))

  const elegirFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!f) return
    try {
      setAvatar(await leerAvatar(f))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo cargar la imagen.', 'error')
    }
  }

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    const correo = normalizarEmail(email)
    const duplicado = usuarios.some((u) => u.id !== user.id && u.email.toLowerCase() === correo)
    const nuevos: Errores = {
      nombre: errorNombre(nombre, 'nombre'),
      apellido: errorNombre(apellido, 'apellido'),
      email: errorEmail(email) ?? (duplicado ? 'Ya existe una cuenta con este correo.' : undefined),
      telefono: errorTelefono(telefono),
    }
    setErrores(nuevos)
    if (hayErrores({ ...nuevos })) return

    mutate((db) => {
      const u = db.usuarios.find((x) => x.id === user.id)
      if (!u) return
      u.nombre = nombre.trim()
      u.apellido = apellido.trim()
      u.email = correo
      u.telefono = telefono
      if (avatar) u.avatar = avatar
      else delete u.avatar
    })
    toast('Cambios guardados')
    navigate(`${base}/perfil`)
  }

  const eliminar = () => {
    mutate((db) => {
      db.usuarios = db.usuarios.filter((u) => u.id !== user.id)
      for (const a of db.adultos) a.cuidadorIds = a.cuidadorIds.filter((id) => id !== user.id)
      db.sessionUserId = null
    })
    toast('Tu cuenta fue eliminada')
    navigate('/inicio', { replace: true })
  }

  const nombreVista = nombreCompleto({ nombre: nombre.trim() || user.nombre, apellido: apellido.trim() || user.apellido })

  return (
    <Page title="Editar Mi Perfil" back={`${base}/perfil`} hideAvatar>
      <form className={styles.panel} onSubmit={guardar} noValidate>
        <PerfilCabecera
          nombre={nombreVista}
          avatar={avatar}
          size={195}
          cedula={conCedula ? user.cedula : undefined}
          etiqueta={user.etiqueta}
          fotoAccion={
            <>
              <button type="button" className={styles.fotoBtn} aria-label="Cambiar foto de perfil" onClick={() => archivo.current?.click()}>
                <Pencil size={20} aria-hidden />
              </button>
              <input ref={archivo} type="file" accept="image/*" hidden onChange={elegirFoto} />
            </>
          }
        />
        {avatar && (
          <div className={styles.quitarFoto}>
            <Button variant="ghost" size="sm" onClick={() => setAvatar(undefined)}>
              Quitar foto
            </Button>
          </div>
        )}

        <section className={styles.seccion} aria-labelledby="editar-info">
          <h2 className="section-title" id="editar-info">
            Información Personal
          </h2>
          <div className={styles.campos}>
            <TextField
              label="Nombre"
              autoComplete="given-name"
              value={nombre}
              error={errores.nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                limpiar('nombre')
              }}
            />
            <TextField
              label="Apellido"
              autoComplete="family-name"
              value={apellido}
              error={errores.apellido}
              onChange={(e) => {
                setApellido(e.target.value)
                limpiar('apellido')
              }}
            />
            <TextField
              label="Correo electrónico"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              error={errores.email}
              onChange={(e) => {
                setEmail(e.target.value)
                limpiar('email')
              }}
            />
            <TextField
              label="Teléfono"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="000 000 0000"
              maxLength={12}
              value={telefono}
              error={errores.telefono}
              onChange={(e) => {
                setTelefono(formatTelefono(e.target.value))
                limpiar('telefono')
              }}
            />
          </div>
        </section>

        <section className={styles.seccion} aria-labelledby="editar-cuenta">
          <h2 className="section-title" id="editar-cuenta">
            Cuenta
          </h2>
          <InfoRow
            icon={<Lock size={24} aria-hidden />}
            label="Contraseña"
            value="••••••••••••••••"
            action={
              <Button variant="ghost" size="sm" onClick={() => setCambiando(true)}>
                Cambiar
              </Button>
            }
          />
        </section>

        <div className={styles.acciones}>
          <Button type="submit" variant="soft" fullWidth>
            Guardar Cambios
          </Button>
          {puedeEliminarCuenta(user.rol) && (
            <Button variant="danger-soft" fullWidth onClick={() => setEliminando(true)}>
              Eliminar Cuenta
            </Button>
          )}
        </div>
      </form>

      <CambiarPassword open={cambiando} onClose={cerrarPassword} user={user} />

      <Sheet
        open={eliminando}
        onClose={cerrarEliminar}
        title="Eliminar cuenta"
        footer={
          <>
            <Button variant="outline" onClick={cerrarEliminar}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={eliminar}>
              Sí, eliminar
            </Button>
          </>
        }
      >
        <div className={styles.confirma}>
          <p>
            ¿Seguro que quieres eliminar la cuenta <strong>{user.email}</strong>?
          </p>
          <p>Esta acción no se puede deshacer: se cerrará tu sesión y dejarás de tener acceso a CuidaRed.</p>
        </div>
      </Sheet>
    </Page>
  )
}

/** Editar Mi Perfil — compartido por los 4 roles (cuidador 358:2787 · familiar 285:819 · admin 238:612 · coordinador 361:723). */
export default function EditarPerfil() {
  const { user } = useSession()
  if (!user) return null
  return <Vista user={user} />
}
