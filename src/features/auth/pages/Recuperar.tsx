import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { Button, ButtonLink, TextField } from '@/components/ui'
import { AuthScreen } from '../components/AuthScreen'
import { LogoBadge } from '../components/LogoBadge'
import { errorEmail, normalizarEmail } from '../lib/validar'
import a from '../components/Auth.module.css'

/** "/recuperar" — Olvidaste Contraseña (Figma 255:527): valida el correo y simula el envío del enlace. */
export default function Recuperar() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const err = errorEmail(email)
    setError(err)
    if (err) return
    setEnviando(true)
    // Prototipo: no hay servidor de correo; se simula la latencia del envío.
    timer.current = setTimeout(() => {
      setEnviando(false)
      setEnviado(true)
    }, 900)
  }

  const correo = normalizarEmail(email)

  return (
    <AuthScreen title="Recuperar Contraseña" back="/inicio" gradient="auth">
      {enviado ? (
        <div className={a.form}>
          <div className={a.mid}>
            <div className={a.exito} role="status">
              <span className={a.exitoIcono}>
                <MailCheck size={36} aria-hidden />
              </span>
              <h2 className={a.exitoTitulo}>Revisa tu correo</h2>
              <p className={a.lead}>
                Si <span className={a.leadStrong}>{correo}</span> está asociado a una cuenta, te enviamos un enlace para restablecer tu contraseña. Puede tardar unos minutos.
              </p>
            </div>
            <p className={a.aviso}>Prototipo: no se envía ningún correo real. Usa el botón de abajo para abrir el enlace de restablecimiento.</p>
          </div>
          <div className={a.actions}>
            <ButtonLink to={`/restablecer?email=${encodeURIComponent(correo)}`} fullWidth>
              Abrir enlace de restablecimiento
            </ButtonLink>
            <ButtonLink to="/inicio" variant="light" fullWidth>
              Volver a iniciar sesión
            </ButtonLink>
          </div>
        </div>
      ) : (
        <form className={a.form} onSubmit={enviar} noValidate>
          <div className={a.mid}>
            <LogoBadge />
            <p className={a.lead}>Ingresa el correo electrónico asociado a tu cuenta y te enviaremos un enlace para restablecer tu contraseña.</p>
            <TextField
              label="Correo electrónico"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ejemplo@correo.com"
              value={email}
              error={error}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(undefined)
              }}
            />
          </div>
          <div className={a.actions}>
            <Button type="submit" fullWidth loading={enviando}>
              Enviar enlace de recuperación
            </Button>
          </div>
        </form>
      )}
    </AuthScreen>
  )
}
