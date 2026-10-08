import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, ButtonLink, PasswordField, useToast } from '@/components/ui'
import { mutate, useDB } from '@/domain/store'
import { AuthScreen } from '../components/AuthScreen'
import { LogoBadge } from '../components/LogoBadge'
import { errorConfirmacion, errorPassword, hayErrores, normalizarEmail } from '../lib/validar'
import a from '../components/Auth.module.css'

/** "/restablecer?email=…" — Restablecer Contraseña (Figma 255:541). */
export default function Restablecer() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const email = normalizarEmail(params.get('email') ?? '')
  const usuarios = useDB((s) => s.usuarios)
  const cuenta = usuarios.find((u) => u.email.toLowerCase() === email)

  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [errores, setErrores] = useState<{ password?: string; confirmar?: string }>({})

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    const nuevos = { password: errorPassword(password), confirmar: errorConfirmacion(password, confirmar) }
    setErrores(nuevos)
    if (hayErrores(nuevos) || !cuenta) return
    mutate((db) => {
      const u = db.usuarios.find((x) => x.id === cuenta.id)
      if (u) u.password = password
    })
    toast('Contraseña actualizada. Ya puedes iniciar sesión.')
    navigate('/inicio', { replace: true })
  }

  return (
    <AuthScreen title="Restablecer Contraseña" back="/inicio" gradient="auth">
      {!cuenta ? (
        <div className={a.form}>
          <div className={a.mid}>
            <LogoBadge />
            <p className={a.alert} role="alert">
              Este enlace no es válido o la cuenta ya no existe. Solicita uno nuevo para continuar.
            </p>
          </div>
          <div className={a.actions}>
            <ButtonLink to="/recuperar" fullWidth>
              Solicitar un enlace nuevo
            </ButtonLink>
            <ButtonLink to="/inicio" variant="light" fullWidth>
              Volver a iniciar sesión
            </ButtonLink>
          </div>
        </div>
      ) : (
        <form className={a.form} onSubmit={guardar} noValidate>
          <div className={a.mid}>
            <LogoBadge />
            <p className={a.lead}>
              Ingrese su nueva contraseña para acceder a su cuenta de CuidaRed
              <br />
              <span className={a.leadStrong}>{cuenta.email}</span>
            </p>
            <PasswordField
              label="Contraseña"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              error={errores.password}
              onChange={(e) => {
                setPassword(e.target.value)
                setErrores((x) => ({ ...x, password: undefined }))
              }}
            />
            <PasswordField
              label="Confirmar contraseña"
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              value={confirmar}
              error={errores.confirmar}
              onChange={(e) => {
                setConfirmar(e.target.value)
                setErrores((x) => ({ ...x, confirmar: undefined }))
              }}
            />
          </div>
          <div className={a.actions}>
            <Button type="submit" fullWidth>
              Guardar nueva contraseña
            </Button>
          </div>
        </form>
      )}
    </AuthScreen>
  )
}
