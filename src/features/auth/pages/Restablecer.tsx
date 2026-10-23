/*
 * Restablecer.tsx — "/restablecer": crea una contraseña nueva con el correo y el código de un solo uso.
 * El código se valida contra su hash, su caducidad (15 min) y que no se haya usado.
 * Módulo: auth (SRS §8.2.2.3.5 b: recuperación segura y política de contraseñas robustas).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, PasswordField, TextField, useToast } from '@/components/ui'
import { useEnLinea } from '@/domain/conectividad'
import { AuthScreen } from '../components/AuthScreen'
import { LogoBadge } from '../components/LogoBadge'
import { Acciones, Aviso, ENLACE, Lead, RequisitosPassword } from '../components/Piezas'
import { restablecerPassword } from '../lib/recuperacion'
import { errorCodigo, errorConfirmacion, errorEmail, hayErrores } from '../lib/validar'

interface Errores {
  email?: string
  codigo?: string
  password?: string
  confirmar?: string
}

export default function Restablecer() {
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const location = useLocation()
  const [email, setEmail] = useState(() => (location.state as { email?: string } | null)?.email ?? '')
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [general, setGeneral] = useState<string>()
  const [cargando, setCargando] = useState(false)

  const limpiar = (campo: keyof Errores) => {
    setErrores((x) => ({ ...x, [campo]: undefined }))
    setGeneral(undefined)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (cargando) return
    const nuevos: Errores = {
      email: errorEmail(email),
      codigo: errorCodigo(codigo),
      confirmar: errorConfirmacion(password, confirmar),
    }
    setErrores(nuevos)
    if (hayErrores({ ...nuevos })) return
    setCargando(true)
    try {
      const res = await restablecerPassword(email, codigo, password)
      if (res.ok) {
        toast('Contraseña actualizada. Ya puedes iniciar sesión.')
        navigate('/inicio', { replace: true })
        return
      }
      setErrores((x) => ({ ...x, ...res.errores }))
      if (!res.errores) setGeneral(res.error)
    } finally {
      setCargando(false)
    }
  }

  return (
    <AuthScreen title="Restablecer contraseña" back="/recuperar" gradient="auth">
      <form className="flex min-w-0 flex-1 flex-col gap-5" onSubmit={guardar} noValidate aria-busy={cargando || undefined}>
        <LogoBadge />
        <Lead>Escribe el código de 6 dígitos que recibiste y elige tu nueva contraseña.</Lead>
        {!enLinea && <Aviso tono="offline">Sin conexión: necesitas internet para cambiar tu contraseña.</Aviso>}

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
            limpiar('email')
          }}
        />
        <TextField
          label="Código de verificación"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
          className="font-mono text-xl! tracking-[0.3em]"
          value={codigo}
          error={errores.codigo}
          help="Caduca a los 15 minutos y solo se puede usar una vez. Si no funciona, solicita uno nuevo."
          onChange={(e) => {
            setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))
            limpiar('codigo')
          }}
        />
        <PasswordField
          label="Nueva contraseña"
          autoComplete="new-password"
          value={password}
          error={errores.password}
          onChange={(e) => {
            setPassword(e.target.value)
            limpiar('password')
          }}
        />
        <PasswordField
          label="Confirmar nueva contraseña"
          autoComplete="new-password"
          value={confirmar}
          error={errores.confirmar}
          onChange={(e) => {
            setConfirmar(e.target.value)
            limpiar('confirmar')
          }}
        />
        <RequisitosPassword password={password} confirmar={confirmar} />
        {general && <Aviso tono="error">{general}</Aviso>}

        <Acciones>
          <Button type="submit" fullWidth loading={cargando} disabled={!enLinea}>
            Guardar nueva contraseña
          </Button>
          <p className="text-center text-ink-2">
            ¿No tienes un código?{' '}
            <Link to="/recuperar" className={ENLACE}>
              Solicitar uno
            </Link>
          </p>
        </Acciones>
      </form>
    </AuthScreen>
  )
}
