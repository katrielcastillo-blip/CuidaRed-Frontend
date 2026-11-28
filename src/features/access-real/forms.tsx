/*
 * forms.tsx — Formularios conectados del acceso: inicio de sesión, activación de invitación y recuperación (el perfil propio vive en perfil-cuenta.tsx).
 * Módulo: access-real (ID01), sin contraseñas locales.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { Button, ButtonLink, Checkbox, PasswordField, ProgresoRegistro, TextField } from '@/components/ui'
import { useLogo } from '@/lib/marca'
import { AuthScreen } from '../auth/components/AuthScreen'
import { Aviso, RequisitosPassword, TITULO_PASO, YaTienesCuenta } from '../auth/components/Piezas'
import { LogoBadge } from '../auth/components/LogoBadge'
import { api, guardarSesionDelNavegador, passwordError, temporaryClient, type BrowserSession, type CurrentUser } from './client'

const GENERIC_RECOVERY = 'Si el correo pertenece a una cuenta, recibirás un código para restablecer tu contraseña.'
const GENERIC_CODE = 'El código no es válido o ha vencido. Solicita uno nuevo a la persona responsable.'
const normalEmail = (email: string) => email.trim().toLowerCase()
const message = (error: unknown) => (error instanceof Error ? error.message : 'No se pudo completar la operación. Intenta de nuevo.')

export function AccessForm({ notice, onSession }: { notice: string; onSession: (session: BrowserSession) => void }) {
  const [client] = useState(temporaryClient)
  const location = useLocation()
  const logo = useLogo()
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
      const { data, error: issue } = await client.auth.signInWithPassword({ email: normalEmail(email), password })
      setPassword('')
      if (issue || !data.session) {
        setError('Correo o contraseña incorrectos.')
        return
      }
      onSession(await guardarSesionDelNavegador(data.session))
    } catch (issue) {
      setError(message(issue))
    } finally {
      setBusy(false)
    }
  }
  const actualizada = (location.state as { contrasenaActualizada?: unknown } | null)?.contrasenaActualizada === true
  return (
    <AuthScreen homeLink>
      <h1 className="sr-only">Iniciar sesión en CuidaRed</h1>
      <img className="mb-8 self-center w-[min(248px,100%)]" src={logo} alt="CuidaRed" />
      <form className="flex flex-col gap-6" onSubmit={submit}>
        {actualizada && <Aviso tono="exito">Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.</Aviso>}
        <TextField
          label="Correo electrónico"
          type="email"
          required
          autoComplete="username"
          placeholder="ejemplo@correo.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          label="Contraseña"
          required
          autoComplete="current-password"
          placeholder="Tu contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {(error || notice) && <Aviso tono="error">{error || notice}</Aviso>}
        {new URLSearchParams(window.location.search).has('cierre') && (
          <Aviso tono="warning">Se borró la sesión de este navegador, pero no se pudo confirmar su revocación en el servidor.</Aviso>
        )}
        <div className="flex flex-col gap-2">
          <Button type="submit" fullWidth loading={busy}>
            Iniciar sesión
          </Button>
          <ButtonLink to="/recuperar" variant="ghost" className="self-center">
            ¿Olvidaste tu contraseña?
          </ButtonLink>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ButtonLink to="/registro" variant="outline" className="px-2!">
            Activar cuenta
          </ButtonLink>
          <ButtonLink to="/crear-cuenta" state={location.state} variant="outline" className="px-2!">
            Crear cuenta
          </ButtonLink>
        </div>
        <nav aria-label="Avisos legales" className="flex justify-center gap-4">
          <ButtonLink to="/terminos" variant="ghost">
            Términos
          </ButtonLink>
          <ButtonLink to="/privacidad" variant="ghost">
            Privacidad
          </ButtonLink>
        </nav>
      </form>
    </AuthScreen>
  )
}

export function InvitationForm({ onSession }: { onSession: (session: BrowserSession) => void }) {
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
        onSession(await guardarSesionDelNavegador(latest.session))
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
  const TITULOS = ['Confirma tu invitación', 'Tus datos personales', 'Crea tu contraseña']
  return (
    <AuthScreen title="Activar mi cuenta" back={step > 1 && !busy ? () => { setError(''); setStep(step - 1) } : '/inicio'}>
      <LogoBadge />
      <ProgresoRegistro paso={step} total={3} className="mt-6" />
      <form className="mt-6 flex flex-col gap-6" onSubmit={submit}>
        <h2 className={TITULO_PASO}>{TITULOS[step - 1]}</h2>
        {step === 1 && (
          <>
            <p className="text-cuerpo text-ink">
              Tu cuenta la creó la persona responsable de tu organización o familia. Escribe tu correo y el código de activación que te llegó por correo.
            </p>
            <TextField
              label="Correo electrónico"
              type="email"
              required
              disabled={!!session}
              placeholder="ejemplo@correo.com"
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
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              hint="6 dígitos. Lo encuentras en el correo de invitación y caduca a los 15 minutos."
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
                  <Link target="_blank" rel="noopener" to="/terminos">
                    Términos
                  </Link>{' '}
                  y la{' '}
                  <Link target="_blank" rel="noopener" to="/privacidad">
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
          <Button variant="ghost" className="self-center" onClick={() => setStep(step - 1)}>
            Volver
          </Button>
        )}
        {step === 1 && <YaTienesCuenta />}
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
      <ProgresoRegistro paso={1} total={3} className="mt-6" />
      <form className="mt-6 flex flex-col gap-6" onSubmit={submit}>
        <h2 className={TITULO_PASO}>¿Olvidaste tu contraseña?</h2>
        <p className="text-cuerpo text-ink">Escribe el correo de tu cuenta. Te enviaremos un código de 6 dígitos para crear una contraseña nueva.</p>
        <TextField
          label="Correo electrónico"
          type="email"
          required
          placeholder="ejemplo@correo.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Aviso>{sent ? GENERIC_RECOVERY : 'Si el correo está registrado, el código llegará en unos minutos. Revisa también la carpeta de spam.'}</Aviso>
        {error && <Aviso tono="error">{error}</Aviso>}
        <Button type="submit" loading={busy}>
          {sent ? 'Enviar otro código' : 'Enviar código'}
        </Button>
        <ButtonLink to="/restablecer" variant="ghost" className="self-center">
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
  const [tokenHash] = useState(() => new URL(window.location.href).searchParams.get('token_hash'))
  useEffect(() => {
    if (!tokenHash) return
    const url = new URL(window.location.href)
    url.searchParams.delete('token_hash')
    window.history.replaceState(window.history.state, '', url)
  }, [tokenHash])
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
        const result = tokenHash
          ? await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
          : await client.auth.verifyOtp({ email: normalEmail(email), token: code, type: 'recovery' })
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
      navigate('/inicio', { replace: true, state: { contrasenaActualizada: true } })
    } catch {
      setError('No se pudo completar la recuperación. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthScreen title="Recuperar contraseña" back="/recuperar" gradient="auth">
      <LogoBadge />
      <form className="mt-6 flex flex-col gap-6" onSubmit={submit}>
        <h2 className={TITULO_PASO}>Restablecer contraseña</h2>
        <p className="text-cuerpo text-ink">
          {tokenHash
            ? 'Tu enlace fue verificado. Elige una contraseña nueva que no hayas usado antes.'
            : 'Escribe tu correo y el código de 6 dígitos que te enviamos. Luego elige una contraseña nueva que no hayas usado antes.'}
        </p>
        {!tokenHash && <><TextField
          label="Correo electrónico"
          type="email"
          required
          disabled={verified}
          placeholder="ejemplo@correo.com"
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
          placeholder="000000"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          hint="6 dígitos. Caduca a los 15 minutos y es de un solo uso."
        /></>}
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
