/*
 * Inicio.tsx — "/inicio": inicio de sesión con correo y contraseña (CU-01 · RF-09).
 * Módulo: auth (SRS §8.2.2.3.5 b/l: credenciales validadas, mensajes genéricos, bloqueo por intentos;
 * §18.1/18.3/18.6: logotipo, aviso legal y mención al INTEC).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ChevronDown, KeyRound, Lock, Siren, UserRound } from 'lucide-react'
import { Button, ButtonLink, PasswordField, TextField } from '@/components/ui'
import { HOME_BY_ROL, login, ROL_LABEL, useSession } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { DEMO_PASSWORD } from '@/domain/seed'
import type { Rol } from '@/domain/types'
import { PRODUCTO } from '@/lib/proyecto'
import { AuthScreen } from '../components/AuthScreen'
import { Aviso } from '../components/Piezas'
import { emailValido } from '../lib/validar'

/** Cuentas de demostración: los 4 roles del SRS (RF-09). */
const CUENTAS_DEMO: Array<{ rol: Rol; email: string }> = [
  { rol: 'admin', email: 'admin@cuidared.do' },
  { rol: 'coordinador', email: 'coordinador@cuidared.do' },
  { rol: 'voluntario', email: 'voluntario@cuidared.do' },
  { rol: 'familiar', email: 'familiar@cuidared.do' },
]

/** Respeta la ruta de origen solo si pertenece al área del mismo rol (y no es una pantalla de perfil recién cerrada). */
function destino(rol: Rol, from?: string) {
  const home = HOME_BY_ROL[rol]
  const mismoRol = !!from && (from === home || from.startsWith(`${home}/`))
  const esPerfil = !!from && /\/perfil(\/|$)/.test(from)
  return mismoRol && !esPerfil ? from : home
}

interface Errores {
  email?: string
  password?: string
  general?: string
}

const ENLACE_PIE = 'inline-flex min-h-12 items-center px-2 text-sm text-ink-2 underline underline-offset-[3px] hover:text-navy'

export default function Inicio() {
  const { user } = useSession()
  const enLinea = useEnLinea()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [cargando, setCargando] = useState(false)

  // Con sesión (o recién iniciada) se resuelve en el render: sin carreras con el guard del router.
  if (user) return <Navigate to={destino(user.rol, from)} replace />

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (cargando) return
    const nuevos: Errores = {}
    if (!email.trim()) nuevos.email = 'Escribe tu correo electrónico.'
    else if (!emailValido(email)) nuevos.email = 'Escribe un correo válido (ej. nombre@correo.com).'
    if (!password) nuevos.password = 'Escribe tu contraseña.'
    if (nuevos.email || nuevos.password) return setErrores(nuevos)

    setCargando(true)
    try {
      const res = await login(email, password)
      if (!res.ok) setErrores({ general: res.error })
    } catch {
      setErrores({ general: 'No pudimos iniciar sesión. Inténtalo de nuevo en unos segundos.' })
    } finally {
      setCargando(false)
    }
  }

  const usarDemo = (correo: string) => {
    setEmail(correo)
    setPassword(DEMO_PASSWORD)
    setErrores({})
  }

  const bloqueo = errores.general?.startsWith('Demasiados intentos')

  return (
    <AuthScreen>
      <h1 className="sr-only">Iniciar sesión en CuidaRed</h1>
      <img className="mb-7 block h-auto w-[min(279px,100%)] self-center" src="/brand/logo.png" width={279} height={104} alt="CuidaRed · Seguimiento Comunitario" />

      <form className="flex min-w-0 flex-1 flex-col gap-5" onSubmit={enviar} noValidate aria-busy={cargando || undefined}>
        {!enLinea && (
          <Aviso tono="offline">
            Sin conexión a internet. Necesitas conexión para iniciar sesión; si ya tenías la sesión abierta, puedes seguir registrando visitas y necesidades.
          </Aviso>
        )}

        <TextField
          label="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="ejemplo@correo.com"
          value={email}
          error={errores.email}
          onChange={(e) => {
            setEmail(e.target.value)
            setErrores((x) => ({ ...x, email: undefined, general: undefined }))
          }}
        />
        <PasswordField
          label="Contraseña"
          autoComplete="current-password"
          placeholder="Tu contraseña"
          value={password}
          error={errores.password}
          onChange={(e) => {
            setPassword(e.target.value)
            setErrores((x) => ({ ...x, password: undefined, general: undefined }))
          }}
        />

        {errores.general && (
          <Aviso tono="error" icono={bloqueo ? <Lock size={18} /> : undefined}>
            {errores.general}
            {bloqueo && <span className="mt-1 block font-normal">Si olvidaste tu contraseña, puedes restablecerla con un código.</span>}
          </Aviso>
        )}

        <div className="mt-1 flex flex-col gap-1">
          <Button type="submit" fullWidth loading={cargando} disabled={!enLinea}>
            {cargando ? 'Verificando…' : 'Iniciar sesión'}
          </Button>
          <Link to="/recuperar" className="grid min-h-12 place-items-center text-ink-2 hover:text-navy hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-2">
          <p className="text-center text-sm text-ink-2">¿Tu organización te invitó a CuidaRed?</p>
          <ButtonLink to="/registro" variant="outline" fullWidth icon={<KeyRound size={20} aria-hidden />}>
            Activar mi cuenta
          </ButtonLink>
          <Link to="/registro-organizacion" className="grid min-h-12 place-items-center text-center text-sm font-semibold text-navy underline underline-offset-[3px]">
            Registrar una organización
          </Link>

          <details className="group rounded-md border border-line-soft bg-surface shadow-1">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <UserRound size={18} aria-hidden className="text-blue" />
                Cuentas de demostración
              </span>
              <ChevronDown size={18} aria-hidden className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-2 px-3 pb-3">
              <p className="px-1 text-xs leading-snug text-muted">
                Prototipo: toca una cuenta para rellenar el formulario. Contraseña de todas: <strong className="text-ink">{DEMO_PASSWORD}</strong>
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {CUENTAS_DEMO.map((c) => (
                  <li key={c.rol}>
                    <button
                      type="button"
                      className="flex min-h-12 w-full flex-col items-start justify-center rounded-sm border border-line-soft bg-bg px-3 py-1.5 text-left text-sm hover:border-blue hover:bg-blue-100"
                      onClick={() => usarDemo(c.email)}
                    >
                      <strong className="text-navy">{ROL_LABEL[c.rol]}</strong>
                      <span className="wrap-anywhere text-ink-2">{c.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </form>

      <footer className="mt-5 flex flex-col gap-1 text-center">
        <p className="flex items-start gap-2 rounded-sm bg-blue-100 px-3 py-2.5 text-left text-xs leading-snug text-navy">
          <Siren size={16} aria-hidden className="mt-px flex-none" />
          <span>
            CuidaRed apoya la coordinación comunitaria y <strong>no sustituye servicios médicos ni de emergencia</strong>. En una emergencia llama al
            9-1-1.
          </span>
        </p>
        <nav aria-label="Avisos legales" className="flex flex-wrap items-center justify-center">
          <Link to="/terminos" className={ENLACE_PIE}>
            Términos
          </Link>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <Link to="/privacidad" className={ENLACE_PIE}>
            Privacidad
          </Link>
        </nav>
        <p className="text-xs leading-relaxed text-muted">
          {PRODUCTO.copyright}
          <br />
          Proyecto académico del INTEC · Versión {PRODUCTO.version}
        </p>
      </footer>
    </AuthScreen>
  )
}
