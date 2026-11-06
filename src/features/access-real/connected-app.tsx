/* Rutas de acceso real; sin datos del simulador · ID01. © 2026 Equipo CuidaRed – INTEC. */
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { Privacidad, Terminos } from '../auth/pages/Legal'
import { ApiError, api, getClient, logout, type CurrentUser } from './client'
import { AccessForm, InvitationForm, RecoveryForm, ResetForm, ProfileForm } from './forms'
import { AuthScreen } from '../auth/components/AuthScreen'
import { Button } from '@/components/ui'

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
