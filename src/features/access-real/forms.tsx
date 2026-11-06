/* Formularios ID01 conectados, sin contraseñas locales · acceso. © 2026 Equipo CuidaRed – INTEC. */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { Button, ButtonLink, Checkbox, PasswordField, StepBar, TextField } from '@/components/ui'
import { AuthScreen } from '../auth/components/AuthScreen'
import { Aviso, RequisitosPassword } from '../auth/components/Piezas'
import { LogoBadge } from '../auth/components/LogoBadge'
import { api, getClient, passwordError, temporaryClient, type CurrentUser, type Profile } from './client'

const GENERIC_RECOVERY = 'Si el correo pertenece a una cuenta, recibirás un código para restablecer tu contraseña.'
const GENERIC_CODE = 'El código no es válido o ha vencido. Solicita uno nuevo a la persona responsable.'
const normalEmail = (email: string) => email.trim().toLowerCase()
const message = (error: unknown) => (error instanceof Error ? error.message : 'No se pudo completar la operación. Intenta de nuevo.')

export function AccessForm({ notice }: { notice: string }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const client = getClient()
      const { data, error: issue } = await client.auth.signInWithPassword({ email: normalEmail(email), password })
      setPassword('')
      if (issue || !data.session) {
        setError('Correo o contraseña incorrectos.')
        return
      }
      // La API vuelve a comprobar la identidad, la sesión actual y el estado del usuario.
      await api<CurrentUser>('/me', data.session.access_token)
      navigate('/cuenta', { replace: true })
    } catch (issue) {
      setError(message(issue))
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthScreen>
      <h1 className="sr-only">Iniciar sesión en CuidaRed</h1>
      <img className="mb-7 self-center w-[min(279px,100%)]" src="/brand/logo.png" alt="CuidaRed" />
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <TextField
          label="Correo electrónico"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          label="Contraseña"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {(error || notice) && <Aviso tono="error">{error || notice}</Aviso>}
        {new URLSearchParams(window.location.search).has('cierre') && (
          <Aviso tono="warning">Se borró la sesión de este navegador, pero no se pudo confirmar su revocación en el servidor.</Aviso>
        )}
        <Button type="submit" fullWidth loading={busy}>
          Iniciar sesión
        </Button>
        <ButtonLink to="/recuperar" variant="ghost">
          ¿Olvidaste tu contraseña?
        </ButtonLink>
        <ButtonLink to="/registro" variant="outline">
          Activar mi cuenta
        </ButtonLink>
        <nav className="flex justify-center gap-4">
          <Link className="inline-flex min-h-12 items-center" to="/terminos">
            Términos
          </Link>
          <Link className="inline-flex min-h-12 items-center" to="/privacidad">
            Privacidad
          </Link>
        </nav>
      </form>
    </AuthScreen>
  )
}

export function InvitationForm() {
  const navigate = useNavigate()
  const [client] = useState(temporaryClient)
  const [session, setSession] = useState<Session | null>(null)
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [data, setData] = useState({ cedula: '', nombres: '', apellidos: '', telefono: '' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (step === 1) {
        let verifiedSession = session
        if (!verifiedSession) {
          const result = await client.auth.verifyOtp({ email: normalEmail(email), token: code, type: 'invite' })
          if (result.error || !result.data.session) {
            setError(GENERIC_CODE)
            return
          }
          verifiedSession = result.data.session
          setSession(verifiedSession)
        }
        const current = await api<CurrentUser>('/me', verifiedSession.access_token)
        setData({
          cedula: current.profile.cedula,
          nombres: current.profile.nombres,
          apellidos: current.profile.apellidos,
          telefono: current.profile.telefono ?? '',
        })
        setCode('')
        setStep(2)
      } else if (step === 2) {
        if (!/^\d{11}$/.test(data.cedula) || !data.nombres.trim() || !data.apellidos.trim()) {
          setError('Completa cédula de 11 dígitos, nombres y apellidos.')
          return
        }
        setStep(3)
      } else {
        const problem = passwordError(password)
        if (problem || password !== confirm || !accepted) {
          setError(problem ?? 'Confirma la contraseña y acepta los términos.')
          return
        }
        if (!session) {
          setStep(1)
          return
        }
        const changed = await client.auth.updateUser({ password })
        if (changed.error) {
          setError('No se pudo guardar la contraseña. Revisa los requisitos e intenta de nuevo.')
          return
        }
        await api('/me', session.access_token, 'PATCH', {
          nombres: data.nombres,
          apellidos: data.apellidos,
          telefono: data.telefono.trim() || null,
        })
        const { data: latest } = await client.auth.getSession()
        if (!latest.session) throw new Error('Activa nuevamente tu invitación para continuar.')
        const result = await getClient().auth.setSession({
          access_token: latest.session.access_token,
          refresh_token: latest.session.refresh_token,
        })
        if (result.error) throw new Error('No se pudo abrir la sesión. Intenta iniciar sesión con tu contraseña.')
        setPassword('')
        setConfirm('')
        navigate('/cuenta', { replace: true })
      }
    } catch (issue) {
      setError(message(issue))
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthScreen title="Activar mi cuenta" back="/inicio">
      <StepBar step={step} total={3} />
      <form className="mt-5 flex flex-col gap-5" onSubmit={submit}>
        {step === 1 && (
          <>
            <TextField
              label="Correo electrónico"
              type="email"
              required
              disabled={!!session}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextField
              label="Código de invitación"
              autoComplete="one-time-code"
              inputMode="numeric"
              disabled={!!session}
              required
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              help="Usa el código enviado por Supabase a tu correo. Caduca a los 15 minutos."
            />
          </>
        )}
        {step === 2 && <PersonalFields data={data} setData={setData} showCedula />}
        {step === 3 && (
          <>
            <PasswordField
              label="Contraseña"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <PasswordField
              label="Confirmar contraseña"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            <RequisitosPassword password={password} confirmar={confirm} />
            <Checkbox
              required
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              label={
                <>
                  Acepto los{' '}
                  <Link className="inline-flex min-h-12 items-center" target="_blank" rel="noopener" to="/terminos">
                    Términos
                  </Link>{' '}
                  y la{' '}
                  <Link className="inline-flex min-h-12 items-center" target="_blank" rel="noopener" to="/privacidad">
                    Política de privacidad
                  </Link>
                  .
                </>
              }
            />
          </>
        )}
        {error && <Aviso tono="error">{error}</Aviso>}
        <Button type="submit" loading={busy}>
          {step === 3 ? 'Activar cuenta' : 'Continuar'}
        </Button>
        {step > 2 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            Volver
          </Button>
        )}
      </form>
    </AuthScreen>
  )
}

export function RecoveryForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      // Una respuesta genérica evita distinguir correo existente/no existente.
      const { error: issue } = await temporaryClient().auth.resetPasswordForEmail(normalEmail(email))
      if (issue && (!issue.status || issue.status === 429 || issue.status >= 500)) {
        setError('No se pudo enviar la solicitud. Espera un momento e intenta de nuevo.')
        return
      }
      setSent(true)
    } catch {
      setError('No se pudo enviar la solicitud. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthScreen title="Recuperar contraseña" back="/inicio" gradient="auth">
      <LogoBadge />
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <TextField label="Correo electrónico" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        {sent && <Aviso>{GENERIC_RECOVERY}</Aviso>}
        {error && <Aviso tono="error">{error}</Aviso>}
        <Button type="submit" loading={busy}>
          {sent ? 'Enviar otro código' : 'Enviar código'}
        </Button>
        <ButtonLink to="/restablecer" variant="ghost">
          Ingresar el código
        </ButtonLink>
      </form>
    </AuthScreen>
  )
}

export function ResetForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [client] = useState(temporaryClient)
  const [verified, setVerified] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const problem = passwordError(password)
    if (problem || password !== confirm) {
      setError(problem ?? 'Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (!verified) {
        const result = await client.auth.verifyOtp({ email: normalEmail(email), token: code, type: 'recovery' })
        if (result.error || !result.data.session) {
          setError('El código no es válido o ha vencido. Solicita uno nuevo.')
          return
        }
        setVerified(true)
      }
      if (!passwordSaved) {
        const result = await client.auth.updateUser({ password })
        if (result.error) {
          setError('No se pudo guardar la contraseña. Revisa los requisitos e intenta de nuevo.')
          return
        }
        setPasswordSaved(true)
      }
      const closed = await client.auth.signOut({ scope: 'global' })
      if (closed.error) {
        setError('La contraseña cambió, pero no se pudo confirmar el cierre de las sesiones. Intenta de nuevo.')
        return
      }
      setPassword('')
      setConfirm('')
      setCode('')
      navigate('/inicio', { replace: true })
    } catch {
      setError('No se pudo completar la recuperación. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthScreen title="Restablecer contraseña" back="/recuperar" gradient="auth">
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <TextField
          label="Correo electrónico"
          type="email"
          required
          disabled={verified}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Código de verificación"
          required
          disabled={verified}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          help="Caduca a los 15 minutos y es de un solo uso."
        />
        <PasswordField
          label="Nueva contraseña"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <PasswordField
          label="Confirmar contraseña"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        <RequisitosPassword password={password} confirmar={confirm} />
        {error && <Aviso tono="error">{error}</Aviso>}
        <Button type="submit" loading={busy}>
          Guardar nueva contraseña
        </Button>
      </form>
    </AuthScreen>
  )
}

interface PersonalData {
  cedula: string
  nombres: string
  apellidos: string
  telefono: string
}
function PersonalFields({
  data,
  setData,
  showCedula,
}: {
  data: PersonalData
  setData: (value: PersonalData) => void
  showCedula: boolean
}) {
  return (
    <>
      {showCedula && (
        <TextField
          label="Cédula"
          inputMode="numeric"
          readOnly
          value={data.cedula}
          help="Registrada al invitarte; para corregirla contacta a la persona responsable."
        />
      )}
      <TextField
        label="Nombres"
        required
        maxLength={100}
        autoComplete="given-name"
        value={data.nombres}
        onChange={(event) => setData({ ...data, nombres: event.target.value })}
      />
      <TextField
        label="Apellidos"
        required
        maxLength={100}
        autoComplete="family-name"
        value={data.apellidos}
        onChange={(event) => setData({ ...data, apellidos: event.target.value })}
      />
      <TextField
        label="Teléfono (opcional)"
        type="tel"
        maxLength={20}
        autoComplete="tel"
        value={data.telefono}
        onChange={(event) => setData({ ...data, telefono: event.target.value })}
      />
    </>
  )
}

export function ProfileForm({ token, profile, onSaved }: { token: string; profile: Profile; onSaved: () => void }) {
  const [data, setData] = useState({
    cedula: profile.cedula,
    nombres: profile.nombres,
    apellidos: profile.apellidos,
    telefono: profile.telefono ?? '',
  })
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const input = { nombres: data.nombres, apellidos: data.apellidos, telefono: data.telefono.trim() || null }
      await api('/me', token, 'PATCH', input)
      setNotice('Cambios guardados.')
      onSaved()
    } catch (issue) {
      setError(message(issue))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <p className="break-all">{profile.correo}</p>
      <PersonalFields data={data} setData={setData} showCedula />
      {error && <Aviso tono="error">{error}</Aviso>}
      {notice && <p role="status">{notice}</p>}
      <Button type="submit" loading={busy}>
        Guardar cambios
      </Button>
    </form>
  )
}
