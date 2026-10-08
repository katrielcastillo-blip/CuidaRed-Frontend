import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button, ButtonLink, PasswordField, TextField } from '@/components/ui'
import { HOME_BY_ROL, login, ROL_LABEL, useSession } from '@/domain/auth'
import { DEMO_PASSWORD } from '@/domain/seed'
import type { Rol } from '@/domain/types'
import { AuthScreen } from '../components/AuthScreen'
import { emailValido } from '../lib/validar'
import a from '../components/Auth.module.css'
import styles from './Inicio.module.css'

const CUENTAS_DEMO: Array<{ rol: Rol; email: string }> = [
  { rol: 'cuidador', email: 'cuidador@cuidared.do' },
  { rol: 'familiar', email: 'familiar@cuidared.do' },
  { rol: 'admin', email: 'admin@cuidared.do' },
  { rol: 'coordinador', email: 'coordinador@cuidared.do' },
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

/** "/inicio" — Pantalla Home (Figma 255:473): login con correo y contraseña. */
export default function Inicio() {
  const { user } = useSession()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState<Errores>({})

  // Con sesión (o recién iniciada) se resuelve en el render: sin carreras con el guard del router.
  if (user) return <Navigate to={destino(user.rol, from)} replace />

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const nuevos: Errores = {}
    if (!email.trim()) nuevos.email = 'Escribe tu correo electrónico.'
    else if (!emailValido(email)) nuevos.email = 'Escribe un correo válido.'
    if (!password) nuevos.password = 'Escribe tu contraseña.'
    if (nuevos.email || nuevos.password) return setErrores(nuevos)

    const res = login(email, password)
    if (!res.ok) setErrores({ general: res.error })
  }

  const usarDemo = (correo: string) => {
    setEmail(correo)
    setPassword(DEMO_PASSWORD)
    setErrores({})
  }

  return (
    <AuthScreen>
      <h1 className="sr-only">Iniciar sesión en CuidaRed</h1>
      <img className={styles.logo} src="/brand/logo.png" width={279} height={104} alt="CuidaRed · Seguimiento Comunitario" />

      <form className={`${a.form} ${styles.form}`} onSubmit={enviar} noValidate>
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
          placeholder="********************"
          value={password}
          error={errores.password}
          onChange={(e) => {
            setPassword(e.target.value)
            setErrores((x) => ({ ...x, password: undefined, general: undefined }))
          }}
        />

        {errores.general && (
          <p className={a.alert} role="alert">
            {errores.general}
          </p>
        )}

        <div className={styles.accionPrincipal}>
          <Button type="submit" fullWidth>
            Iniciar sesión
          </Button>
          <Link to="/recuperar" className={a.enlaceSuave}>
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <div className={a.actions}>
          <ButtonLink to="/registro" variant="outline" fullWidth>
            Regístrate
          </ButtonLink>

          <div className={styles.secundarios}>
            <Link to="/registro-organizacion" className={styles.discreto}>
              Registrar organización
            </Link>
            <span aria-hidden className={styles.punto}>
              ·
            </span>
            <details className={styles.demo}>
              <summary className={styles.discreto}>Cuentas de demostración</summary>
              <div className={styles.demoLista}>
                <p className={styles.demoNota}>Prototipo: toca una cuenta para rellenar el formulario (contraseña {DEMO_PASSWORD}).</p>
                {CUENTAS_DEMO.map((c) => (
                  <button key={c.rol} type="button" className={styles.demoItem} onClick={() => usarDemo(c.email)}>
                    <strong>{ROL_LABEL[c.rol]}</strong>
                    <span>{c.email}</span>
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
      </form>
    </AuthScreen>
  )
}
