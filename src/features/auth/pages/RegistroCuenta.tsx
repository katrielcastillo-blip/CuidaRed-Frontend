import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Building2, Users } from 'lucide-react'
import { Button, Checkbox, PasswordField, StepBar, TextField } from '@/components/ui'
import { HOME_BY_ROL } from '@/domain/auth'
import { AuthScreen } from '../components/AuthScreen'
import { LogoBadge } from '../components/LogoBadge'
import {
  emailRegistrado,
  guardarMemoriaCuenta,
  leerBorrador,
  leerMemoriaCuenta,
  limpiarBorrador,
  limpiarMemoriaCuenta,
  registrarCuenta,
} from '../lib/registro'
import { errorConfirmacion, errorEmail, errorPassword, hayErrores } from '../lib/validar'
import a from '../components/Auth.module.css'

interface Errores {
  email?: string
  password?: string
  confirmar?: string
  acepto?: string
  general?: string
}

/** "/registro/cuenta" — Registrarse paso 2 (Figma 255:561): cuenta de acceso y aceptación de términos. */
export default function RegistroCuenta() {
  const navigate = useNavigate()
  // Se captura al montar: al terminar se limpia el borrador y no debe disparar la redirección al paso 1.
  const [datos] = useState(() => leerBorrador())
  const [memoria] = useState(() => leerMemoriaCuenta())

  const [destino, setDestino] = useState<'familia' | 'organizacion'>(memoria?.destino ?? 'familia')
  const [email, setEmail] = useState(memoria?.email ?? '')
  const [password, setPassword] = useState(memoria?.password ?? '')
  const [confirmar, setConfirmar] = useState(memoria?.confirmar ?? '')
  const [acepto, setAcepto] = useState(memoria?.acepto ?? false)
  const [errores, setErrores] = useState<Errores>({})

  if (!datos) return <Navigate to="/registro" replace />

  const recordar = (parche: Partial<{ destino: 'familia' | 'organizacion'; email: string; password: string; confirmar: string; acepto: boolean }>) =>
    guardarMemoriaCuenta({ destino, email, password, confirmar, acepto, ...parche })

  const limpiar = (campo: keyof Errores) => setErrores((x) => ({ ...x, [campo]: undefined, general: undefined }))

  const registrar = (e: FormEvent) => {
    e.preventDefault()
    const nuevos: Errores = {
      email: errorEmail(email),
      password: errorPassword(password),
      confirmar: errorConfirmacion(password, confirmar),
      acepto: acepto ? undefined : 'Debes aceptar los Términos y la Política de Privacidad.',
    }
    setErrores(nuevos)
    if (hayErrores({ ...nuevos })) return

    if (destino === 'organizacion') {
      if (emailRegistrado(email)) return setErrores({ email: 'Ya existe una cuenta con este correo.' })
      // La cuenta de administrador se crea al final del flujo de organización.
      guardarMemoriaCuenta({ destino, email, password, confirmar, acepto })
      navigate('/registro-organizacion', { state: { cuenta: { email, password } } })
      return
    }

    const res = registrarCuenta(datos, email, password)
    if (!res.ok) {
      setErrores(res.error.includes('correo') ? { email: res.error } : { general: res.error })
      return
    }
    limpiarBorrador()
    limpiarMemoriaCuenta()
    navigate(HOME_BY_ROL[res.user.rol], { replace: true })
  }

  return (
    <AuthScreen title="Crear Cuenta" back="/registro">
      <form className={a.form} onSubmit={registrar} noValidate>
        <LogoBadge />
        <div className={a.steps}>
          <StepBar step={2} total={2} />
        </div>

        <fieldset className={a.grupo}>
          <legend className={a.grupoLabel}>¿Vas a usar CuidaRed para...?</legend>
          <div className={a.roles} role="radiogroup" aria-label="¿Vas a usar CuidaRed para...?">
            <button
              type="button"
              role="radio"
              aria-checked={destino === 'organizacion'}
              className={`${a.rol} ${destino === 'organizacion' ? a.rolOn : ''}`}
              onClick={() => {
                setDestino('organizacion')
                recordar({ destino: 'organizacion' })
              }}
            >
              <Building2 size={30} aria-hidden />
              Mi organización
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={destino === 'familia'}
              className={`${a.rol} ${destino === 'familia' ? a.rolOn : ''}`}
              onClick={() => {
                setDestino('familia')
                recordar({ destino: 'familia' })
              }}
            >
              <Users size={30} aria-hidden />
              Mi familia
            </button>
          </div>
        </fieldset>

        <TextField
          label="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ejemplo@correo.com"
          value={email}
          error={errores.email}
          onChange={(e) => {
            setEmail(e.target.value)
            recordar({ email: e.target.value })
            limpiar('email')
          }}
        />
        <PasswordField
          label="Contraseña"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          value={password}
          error={errores.password}
          onChange={(e) => {
            setPassword(e.target.value)
            recordar({ password: e.target.value })
            limpiar('password')
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
            recordar({ confirmar: e.target.value })
            limpiar('confirmar')
          }}
        />

        <div>
          <Checkbox
            checked={acepto}
            aria-invalid={!!errores.acepto || undefined}
            onChange={(e) => {
              setAcepto(e.target.checked)
              recordar({ acepto: e.target.checked })
              limpiar('acepto')
            }}
            label={
              <>
                Acepto los{' '}
                <Link to="/terminos" className={a.legal}>
                  Términos y Condiciones
                </Link>{' '}
                y la{' '}
                <Link to="/privacidad" className={a.legal}>
                  Política de Privacidad
                </Link>{' '}
                de CuidaRed.
              </>
            }
          />
          {errores.acepto && (
            <p className={a.alert} role="alert" style={{ marginTop: 10 }}>
              {errores.acepto}
            </p>
          )}
        </div>

        {errores.general && (
          <p className={a.alert} role="alert">
            {errores.general}
          </p>
        )}

        <div className={a.actions}>
          <Button type="submit" fullWidth>
            {destino === 'organizacion' ? 'Continuar' : 'Registrarse'}
          </Button>
          <p className={a.centro}>
            ¿Ya tienes una cuenta?{' '}
            <Link to="/inicio" className={a.enlace}>
              Iniciar sesión
            </Link>
          </p>
        </div>
      </form>
    </AuthScreen>
  )
}
