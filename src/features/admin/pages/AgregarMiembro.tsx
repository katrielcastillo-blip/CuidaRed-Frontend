/*
 * AgregarMiembro.tsx — Alta de usuario: datos, rol (los 4 del SRS) y modo de acceso. Por defecto se envía
 * una INVITACIÓN (la persona activa su cuenta en "Activar mi cuenta" y elige su contraseña); opcionalmente el
 * administrador define una contraseña inicial que cumple la política de contraseñas robustas.
 * Tablas: Usuario, Membresia (rol inicial) y Vinculo (adultos a cargo del familiar responsable).
 * Módulo: admin (RF-09 · CU-13 · SRS §8.2.2.3.5 b/d · §8.2.2.1.18 Operabilidad).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { Button, ChoicePills, PasswordField, SuccessOverlay, useToast } from '@/components/ui'
import { crearUsuario } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { REGLAS_PASSWORD } from '@/domain/seguridad'
import { useBorrador } from '@/lib/useBorrador'
import { cn } from '@/lib/cn'
import { Page, useShell } from '@/layouts/AppShell'
import { AvisoSinConexion, Nota } from '../components/Nota'
import { CAMPOS_VACIOS, UsuarioCampos, type CamposUsuario, type ErroresUsuario } from '../components/UsuarioCampos'
import { volver } from '../lib/datos'
import { CodigoActivacion } from '../components/CodigoActivacion'

type Modo = 'invitacion' | 'password'
const MODOS: Array<{ value: Modo; label: string }> = [
  { value: 'invitacion', label: 'Enviar invitación' },
  { value: 'password', label: 'Definir contraseña' },
]

export default function AgregarMiembro() {
  const { base } = useShell()
  const admin = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  // El borrador conserva lo escrito si se recarga la pantalla. La contraseña NUNCA se guarda en el borrador.
  const [datos, setDatos, descartar] = useBorrador<CamposUsuario>('admin:nuevo-usuario', CAMPOS_VACIOS)
  const [modo, setModo] = useState<Modo>('invitacion')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState<ErroresUsuario>({})
  const [enviando, setEnviando] = useState(false)
  const [creado, setCreado] = useState<{ id: string; invitado: boolean; codigo?: string; email: string } | null>(null)

  const cambiar = <K extends keyof CamposUsuario>(campo: K, valor: CamposUsuario[K]) => {
    setDatos((d) => ({ ...d, [campo]: valor, ...(campo === 'rol' && valor !== 'familiar' ? { adultoIds: [] } : {}) }))
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    if (modo === 'password' && !password) {
      setErrores((e) => ({ ...e, password: 'Escribe la contraseña inicial o elige "Enviar invitación".' }))
      return
    }
    setEnviando(true)
    const r = await crearUsuario(admin, { ...datos, password: modo === 'password' ? password : '' })
    setEnviando(false)
    if (!r.ok) {
      setErrores((r.errores ?? {}) as ErroresUsuario)
      toast(r.error, 'error')
      return
    }
    descartar()
    setPassword('')
    setCreado({ id: r.valor.id, invitado: r.valor.estado === 'invitado', codigo: r.valor.codigoActivacion, email: r.valor.email })
  }

  const cancelar = () => {
    descartar()
    volver(navigate, `${base}/miembros`)
  }

  return (
    <Page title="Agregar usuario" back={`${base}/miembros`}>
      <form className="flex flex-col gap-5" onSubmit={enviar} noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold">Nuevo usuario</h2>
          <p className="text-muted">Registra los datos de la persona y asígnale un rol. Los campos con * son obligatorios.</p>
        </div>

        {!enLinea && <AvisoSinConexion />}

        <UsuarioCampos datos={datos} errores={errores} onChange={cambiar} />

        <section className="flex flex-col gap-4 p-4 rounded-md bg-surface shadow-1" aria-labelledby="h-acceso">
          <h3 id="h-acceso" className="text-base font-bold">
            Acceso a la cuenta
          </h3>
          <ChoicePills
            label="¿Cómo obtendrá su contraseña?"
            value={modo}
            options={MODOS}
            onChange={(m) => {
              setModo(m)
              setErrores((e) => ({ ...e, password: undefined }))
            }}
            help="Recomendado: enviar invitación. Así solo la persona conoce su contraseña. Define una contraseña inicial solo si la persona no puede activar la cuenta por sí misma."
          />
          {modo === 'invitacion' ? (
            <Nota>
              La cuenta quedará como <strong>Invitado</strong>. La persona la activa desde <strong>“Activar mi cuenta”</strong> con este mismo correo y elige su propia
              contraseña.
            </Nota>
          ) : (
            <>
              <PasswordField
                label="Contraseña inicial"
                required
                autoComplete="new-password"
                value={password}
                error={errores.password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errores.password) setErrores((x) => ({ ...x, password: undefined }))
                }}
              />
              <ul className="grid gap-1 sm:grid-cols-2" aria-label="Requisitos de la contraseña">
                {REGLAS_PASSWORD.map((regla) => {
                  const ok = regla.ok(password)
                  return (
                    <li key={regla.id} className={cn('flex items-center gap-2 text-sm', ok ? 'text-success-700 font-semibold' : 'text-muted')}>
                      {ok ? <Check size={16} strokeWidth={3} aria-hidden /> : <X size={16} aria-hidden />}
                      <span>
                        {regla.texto}
                        <span className="sr-only">{ok ? ' (cumplido)' : ' (pendiente)'}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="text-sm text-muted">Comunícale la contraseña por un medio seguro y pídele que la cambie al entrar. La cuenta quedará activa de inmediato.</p>
            </>
          )}
        </section>

        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
          <Button type="submit" fullWidth loading={enviando} disabled={!enLinea}>
            {modo === 'invitacion' ? 'Guardar y enviar invitación' : 'Crear usuario'}
          </Button>
          <Button variant="outline" className="border-navy!" fullWidth onClick={cancelar}>
            Cancelar
          </Button>
        </div>
      </form>

      <SuccessOverlay
        open={!!creado && !creado.invitado}
        message="¡Usuario creado!"
        detail="La cuenta ya puede iniciar sesión."
        onDone={() => creado && navigate(`${base}/miembros/${creado.id}`, { replace: true })}
      />
      <CodigoActivacion
        codigo={creado?.invitado ? (creado.codigo ?? null) : null}
        email={creado?.email ?? ''}
        onCerrar={() => creado && navigate(`${base}/miembros/${creado.id}`, { replace: true })}
      />
    </Page>
  )
}
