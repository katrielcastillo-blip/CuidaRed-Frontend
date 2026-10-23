/*
 * Recuperar.tsx — "/recuperar": solicita un código de un solo uso para restablecer la contraseña.
 * Responde siempre con el mismo mensaje, exista o no el correo.
 * Módulo: auth (SRS §8.2.2.3.5 b "recuperación segura de contraseñas" y l "mensajes genéricos").
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, MailCheck } from 'lucide-react'
import { Button, ButtonLink, TextField } from '@/components/ui'
import { useEnLinea } from '@/domain/conectividad'
import { AuthScreen } from '../components/AuthScreen'
import { LogoBadge } from '../components/LogoBadge'
import { Acciones, Aviso, Lead } from '../components/Piezas'
import { MENSAJE_GENERICO_RECUPERACION, solicitarRecuperacion } from '../lib/recuperacion'
import { errorEmail, normalizarEmail } from '../lib/validar'

export default function Recuperar() {
  const navigate = useNavigate()
  const enLinea = useEnLinea()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [general, setGeneral] = useState<string>()
  const [enviando, setEnviando] = useState(false)
  const [codigo, setCodigo] = useState<string | null>(null)

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault()
    if (enviando) return
    const err = errorEmail(email)
    setError(err)
    if (err) return
    setEnviando(true)
    try {
      const res = await solicitarRecuperacion(email)
      if (res.ok) {
        setCodigo(res.codigoDemo)
        setGeneral(undefined)
      } else setGeneral(res.error)
    } finally {
      setEnviando(false)
    }
  }

  const correo = normalizarEmail(email)

  return (
    <AuthScreen title="Recuperar contraseña" back="/inicio" gradient="auth">
      {codigo ? (
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex flex-col items-center gap-3.5 text-center" role="status">
            <span className="grid size-[72px] place-items-center rounded-full bg-teal-100 text-teal">
              <MailCheck size={36} aria-hidden />
            </span>
            <h2 className="text-2xl text-navy">Revisa tu correo</h2>
            <p className="text-pretty leading-normal text-ink-2">{MENSAJE_GENERICO_RECUPERACION}</p>
            <p className="wrap-anywhere text-sm font-semibold text-ink">{correo}</p>
          </div>

          <div className="rounded-md border-2 border-dashed border-blue bg-blue-100 px-4 py-3.5 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-navy">
              <FlaskConical size={18} aria-hidden /> Modo demostración
            </p>
            <p className="mt-1 text-sm text-ink-2">Esta versión no envía correos. Este código llegaría por correo:</p>
            <p className="mt-2 font-mono text-[2rem] font-bold tracking-[0.3em] text-navy" aria-label={`Código: ${codigo.split('').join(' ')}`}>
              {codigo}
            </p>
            <p className="mt-1 text-xs text-muted">Solo funciona si el correo pertenece a una cuenta activa.</p>
          </div>

          <Acciones>
            <Button fullWidth onClick={() => navigate('/restablecer', { state: { email: correo } })}>
              Ingresar el código
            </Button>
            <Button variant="light" fullWidth loading={enviando} disabled={!enLinea} onClick={() => void enviar()}>
              Enviar otro código
            </Button>
            <ButtonLink to="/inicio" variant="ghost" fullWidth>
              Volver a iniciar sesión
            </ButtonLink>
          </Acciones>
        </div>
      ) : (
        <form className="flex min-w-0 flex-1 flex-col gap-5" onSubmit={enviar} noValidate aria-busy={enviando || undefined}>
          <div className="my-auto flex flex-col gap-5 py-4 md:my-0 md:py-0">
            <LogoBadge />
            <Lead>Escribe el correo de tu cuenta. Te enviaremos un código de 6 dígitos para crear una contraseña nueva.</Lead>
            {!enLinea && <Aviso tono="offline">Sin conexión: necesitas internet para recuperar tu contraseña.</Aviso>}
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
                setGeneral(undefined)
              }}
            />
            {general && <Aviso tono="error">{general}</Aviso>}
          </div>
          <Acciones>
            <Button type="submit" fullWidth loading={enviando} disabled={!enLinea}>
              Enviar código
            </Button>
            <ButtonLink to="/restablecer" variant="ghost" fullWidth>
              Ya tengo un código
            </ButtonLink>
          </Acciones>
        </form>
      )}
    </AuthScreen>
  )
}
