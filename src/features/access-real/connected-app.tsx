/* Rutas de acceso real; sin datos del simulador · ID01. Contexto de cuenta/rol activo (CR-175). © 2026 Equipo CuidaRed – INTEC. */
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { Privacidad, Terminos } from '../auth/pages/Legal'
import { ApiError, api, getClient, logout, type CurrentUser } from './client'
import { AccessForm, InvitationForm, RecoveryForm, ResetForm, ProfileForm } from './forms'
import { cuentaVigente, guardarCuentaActiva, leerCuentaActiva, PanelCuentas } from './cuentas'
import { AuthScreen } from '../auth/components/AuthScreen'
import { BienvenidaPresentacion } from '../auth/components/BienvenidaPresentacion'
import { SolicitarVisita } from '../auth/components/SolicitarVisita'
import { Button, ButtonLink } from '@/components/ui'

/**
 * Alta de cuentas Familia/Organización y solicitudes de visita: el backend real aún no las expone (fase 2). Se
 * explica sin simular datos; quien recibió una invitación la activa en /registro.
 */
function CreacionPendiente({ titulo }: { titulo: string }) {
  return (
    <AuthScreen title={titulo}>
      <p>Por ahora el acceso a CuidaRed es por invitación. La creación de cuentas de familia u organización estará disponible en la próxima fase.</p>
      <ButtonLink to="/registro" className="mt-5">
        Activar una invitación
      </ButtonLink>
      <ButtonLink to="/" variant="outline" className="mt-3">
        Volver al inicio
      </ButtonLink>
    </AuthScreen>
  )
}

const bienvenida = (
  <BienvenidaPresentacion solicitudVisita={<SolicitarVisita organizaciones={[]} enviar={async () => ({ ok: false, error: 'No disponible.' })} disponible={false} />} />
)

function AccessRoutes() {
  const [configuration] = useState(() => {
    try {
      return { client: getClient(), error: '' }
    } catch (issue) {
      return { client: null, error: issue instanceof Error ? issue.message : 'No se pudo configurar el acceso.' }
    }
  })
  const [loading, setLoading] = useState(!!configuration.client)
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [error, setError] = useState(configuration.error)
  const [revision, setRevision] = useState(0)
  const [cuentaElegida, setCuentaElegida] = useState<string | null>(() => leerCuentaActiva())

  useEffect(() => {
    let active = true
    const client = configuration.client
    if (client) {
      void client.auth
        .getSession()
        .then(({ data, error: issue }) => {
          if (!active) return
          if (issue) setError('No se pudo recuperar la sesión.')
          setSession(data.session)
          setLoading(false)
        })
        .catch(() => {
          if (active) {
            setError('No se pudo recuperar la sesión.')
            setLoading(false)
          }
        })
      const { data } = client.auth.onAuthStateChange((_event, next) => {
        if (active) {
          setSession(next)
          setUser(null)
        }
      })
      return () => {
        active = false
        data.subscription.unsubscribe()
      }
    }
    return () => {
      active = false
    }
  }, [configuration])

  useEffect(() => {
    if (!session) return
    let active = true
    let pending = false
    const refresh = async () => {
      if (pending) return
      pending = true
      try {
        const result = await api<CurrentUser>('/me', session.access_token)
        if (active) {
          setUser(result)
          setError('')
        }
      } catch (issue) {
        if (!active) return
        setError(issue instanceof Error ? issue.message : 'No se pudo comprobar tu sesión.')
        if (issue instanceof ApiError && (issue.status === 401 || issue.status === 403)) {
          setUser(null)
          if (issue.status === 401 || issue.code === 'USER_INACTIVE') {
            void getClient()
              .auth.signOut({ scope: 'local' })
              .catch(() => undefined)
          }
        }
      } finally {
        pending = false
      }
    }
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 30_000)
    const focus = () => {
      void refresh()
    }
    window.addEventListener('focus', focus)
    let lastActivity = 0
    const activity = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastActivity < 60_000) return
      lastActivity = Date.now()
      void api('/session/activity', session.access_token, 'POST').catch(() => {
        void refresh()
      })
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }))
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', focus)
      events.forEach((event) => window.removeEventListener(event, activity))
    }
  }, [session, revision])

  if (loading) return <main role="status">Comprobando acceso…</main>
  if (configuration.error)
    return (
      <AuthScreen title="Acceso a CuidaRed">
        <p role="alert">{configuration.error}</p>
      </AuthScreen>
    )
  const account = session ? (
    <AuthScreen title="Mi cuenta">
      {error && <p role="alert">{error}</p>}
      {!user && !error && <p role="status">Comprobando perfil…</p>}
      {user && user.identity.id === session.user.id && (
        <>
          <ProfileForm
            key={user.identity.id}
            token={session.access_token}
            profile={user.profile}
            onSaved={() => setRevision((value) => value + 1)}
          />
          <PanelCuentas
            user={user}
            activa={cuentaVigente(user, cuentaElegida)}
            onCambiar={(id) => {
              guardarCuentaActiva(id)
              setCuentaElegida(id)
              // Al cambiar de cuenta se vuelve a consultar /me: permisos y datos se recalculan en el servidor.
              setRevision((value) => value + 1)
            }}
          />
          <p className="mt-6 text-sm text-muted">La gestión de cuentas y miembros estará disponible al completar la siguiente fase.</p>
        </>
      )}
      {error && <Button onClick={() => setRevision((value) => value + 1)}>Reintentar</Button>}
      <Button variant="outline" className="mt-5" onClick={() => void logout()}>
        Cerrar sesión
      </Button>
    </AuthScreen>
  ) : (
    <Navigate to="/inicio" replace />
  )

  return (
    <Routes>
      <Route path="/inicio" element={session ? <Navigate to="/cuenta" replace /> : <AccessForm notice={error} />} />
      <Route path="/registro" element={session ? <Navigate to="/cuenta" replace /> : <InvitationForm />} />
      <Route path="/recuperar" element={<RecoveryForm />} />
      <Route path="/restablecer" element={<ResetForm />} />
      <Route path="/cuenta" element={account} />
      <Route path="/" element={session ? <Navigate to="/cuenta" replace /> : bienvenida} />
      <Route path="/crear-cuenta" element={<CreacionPendiente titulo="Crear una cuenta" />} />
      <Route path="/registro-familia" element={<CreacionPendiente titulo="Crear cuenta familiar" />} />
      <Route path="/registro-organizacion" element={<CreacionPendiente titulo="Registrar organización" />} />
      <Route path="/solicitud-visita" element={<CreacionPendiente titulo="Consultar mi solicitud" />} />
      <Route path="/terminos" element={<Terminos />} />
      <Route path="/privacidad" element={<Privacidad />} />
      <Route path="*" element={<Navigate to={session ? '/cuenta' : '/inicio'} replace />} />
    </Routes>
  )
}

export default function ConnectedApp() {
  return (
    <BrowserRouter>
      <AccessRoutes />
    </BrowserRouter>
  )
}
