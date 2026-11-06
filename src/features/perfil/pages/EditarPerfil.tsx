/*
 * EditarPerfil.tsx — Editar mi perfil: nombre, apellidos, teléfono y foto. El correo (y la cédula, según el rol) se
 * muestran de solo lectura con su explicación; el cambio de contraseña se hace desde su panel.
 * Módulo: perfil (CU-01 "Actualizar perfil" · HU-01 · RF-1.4 · Ley 172-13: rectificación · SRS §8.2.2.1.22: sin
 * perder lo escrito).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Pencil } from 'lucide-react'
import { Button, InfoRow, TextField, useFormulario, useToast, AvisoBorrador } from '@/components/ui'
import { actualizarMiPerfil, validarMiPerfil } from '@/domain/api/perfil'
import { nombreCompleto, ROL_LABEL, useSession } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { tipoDeCuenta } from '@/domain/planes'
import type { Organizacion, Usuario } from '@/domain/types'
import { Aviso } from '@/features/auth/components/Piezas'
import { formatTelefono } from '@/features/auth/lib/validar'
import { Page, useShell } from '@/layouts/AppShell'
import { CambiarPassword } from '../components/CambiarPassword'
import { PerfilCabecera } from '../components/PerfilCabecera'
import { leerAvatar } from '../lib/avatar'
import { muestraCedula, aResponsableDeCuenta } from '../lib/rol'

interface DatosFormulario {
  nombre: string
  apellido: string
  telefono: string
  /** dataURL de la foto; vacío = sin foto. */
  avatar: string
}

/** Campo de solo lectura: se ve, se puede leer con lector de pantalla y se explica por qué no se edita. */
const SOLO_LECTURA = 'bg-surface-2 text-ink-2 focus:ring-0'

function Vista({ user, org }: { user: Usuario; org: Organizacion | null }) {
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const archivo = useRef<HTMLInputElement>(null)
  const [cambiando, setCambiando] = useState(false)

  const f = useFormulario<DatosFormulario>({
    clave: `mi-perfil:${user.id}`,
    inicial: { nombre: user.nombre, apellido: user.apellido, telefono: user.telefono, avatar: user.avatar ?? '' },
    campos: ['nombre', 'apellido', 'telefono', 'avatar'],
    validar: (v) => validarMiPerfil(v),
  })

  const conCedula = muestraCedula(user.rol)
  const responsable = aResponsableDeCuenta(tipoDeCuenta(org))
  const cerrarPassword = useCallback(() => setCambiando(false), [])

  const elegirFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivoElegido = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!archivoElegido) return
    try {
      f.set('avatar', await leerAvatar(archivoElegido))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo cargar la imagen.', 'error')
    }
  }

  const guardar = f.enviar((v) => {
    const res = actualizarMiPerfil(user, { nombre: v.nombre, apellido: v.apellido, telefono: v.telefono, avatar: v.avatar || undefined })
    if (res.ok) {
      toast('Cambios guardados')
      navigate(`${base}/perfil`)
    } else if (!res.errores) {
      toast(res.error, 'error')
    }
    return res
  })

  const cancelar = () => {
    f.limpiarBorrador()
    navigate(`${base}/perfil`)
  }

  const nombreVista = nombreCompleto({ nombre: f.valores.nombre.trim() || user.nombre, apellido: f.valores.apellido.trim() || user.apellido })
  const telefono = f.campo('telefono')

  return (
    <Page title="Editar perfil" back={`${base}/perfil`} hideAvatar>
      <form
        className="flex flex-col gap-6 md:rounded-lg md:border md:border-line-soft md:bg-surface md:px-10 md:py-8 md:shadow-1"
        onSubmit={guardar}
        noValidate
      >
        <AvisoBorrador formulario={f} />

        <PerfilCabecera
          nombre={nombreVista}
          avatar={f.valores.avatar || undefined}
          size={120}
          cedula={conCedula ? user.cedula : undefined}
          rol={ROL_LABEL[user.rol]}
          fotoAccion={
            <>
              <button
                type="button"
                className="absolute bottom-0 right-0 grid size-12 place-items-center rounded-full border-[3px] border-bg bg-navy text-white shadow-2 transition hover:bg-navy-700"
                aria-label="Cambiar foto de perfil"
                onClick={() => archivo.current?.click()}
              >
                <Pencil size={20} aria-hidden />
              </button>
              <input ref={archivo} type="file" accept="image/*" hidden onChange={elegirFoto} />
            </>
          }
        >
          {f.valores.avatar && (
            <Button variant="ghost" size="sm" onClick={() => f.set('avatar', '')}>
              Quitar foto
            </Button>
          )}
          {f.errores.avatar && (
            <p className="text-sm text-danger" role="alert">
              {f.errores.avatar}
            </p>
          )}
        </PerfilCabecera>

        <section className="flex flex-col gap-5" aria-labelledby="editar-info">
          <h2 className="section-title" id="editar-info">
            Información personal
          </h2>
          <div className="grid gap-5 md:grid-cols-2 md:gap-x-6">
            <TextField label="Nombre" autoComplete="given-name" required {...f.campo('nombre')} />
            <TextField label="Apellidos" autoComplete="family-name" required {...f.campo('apellido')} />
            <TextField
              label="Teléfono"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="000 000 0000"
              maxLength={12}
              required
              {...telefono}
              onChange={(e) => f.set('telefono', formatTelefono(e.target.value))}
            />
          </div>
        </section>

        <section className="flex flex-col gap-5" aria-labelledby="editar-acceso">
          <h2 className="section-title" id="editar-acceso">
            Datos de la cuenta
          </h2>
          <div className="grid gap-5 md:grid-cols-2 md:gap-x-6">
            <TextField
              label="Correo electrónico"
              type="email"
              value={user.email}
              readOnly
              className={SOLO_LECTURA}
              hint={`Es tu correo de acceso y no se cambia desde aquí. Si necesitas otro, pídelo ${responsable}.`}
            />
            {conCedula && (
              <TextField
                label="Cédula"
                value={user.cedula}
                readOnly
                className={SOLO_LECTURA}
                hint={`Es tu documento de identidad y no se edita desde aquí. Para corregirla, contacta ${responsable}.`}
              />
            )}
          </div>
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
              <span id="perfil-sin-conexion">Sin conexión: tus cambios se conservan en este formulario, pero solo podrás guardarlos cuando vuelvas a tener internet.</span>
            </Aviso>
          )}
          <Button type="submit" variant="soft" fullWidth loading={f.enviando} disabled={!enLinea} aria-describedby={!enLinea ? 'perfil-sin-conexion' : undefined}>
            Guardar cambios
          </Button>
          <Button variant="outline" fullWidth onClick={cancelar}>
            Cancelar
          </Button>
        </div>
      </form>

      <CambiarPassword open={cambiando} onClose={cerrarPassword} user={user} />
    </Page>
  )
}

/** Editar perfil — compartido por los 5 roles. */
export default function EditarPerfil() {
  const { user, org } = useSession()
  if (!user) return null
  // `key`: al cambiar de cuenta/usuario el formulario y su borrador se reinician.
  return <Vista key={user.id} user={user} org={org} />
}
