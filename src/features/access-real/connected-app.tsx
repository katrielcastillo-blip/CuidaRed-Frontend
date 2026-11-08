/*
 * connected-app.tsx — Rutas del acceso conectado (Supabase Auth + API Express), sin datos del simulador.
 * Módulo: access-real (ID01 · ID02: contexto de cuenta y rol activo CR-175, autorregistro, invitaciones y miembros).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Rutas: /inicio, /registro (activar invitación), /recuperar, /restablecer, /cuenta (perfil, invitaciones, cuentas y
 * resumen), /cuenta/miembros (solo con `usuarios:gestionar`), /crear-cuenta, /registro-familia y /registro-organizacion
 * (autorregistro del titular).
 */
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { Privacidad, Terminos } from '../auth/pages/Legal'
import { ApiError, api, getClient, logout, type CuentaMe, type CurrentUser } from './client'
import { AccessForm, InvitationForm, RecoveryForm, ResetForm, ProfileForm } from './forms'
import { guardarCuentaActiva, leerCuentaActiva, PanelCuentas } from './cuentas'
import { listarCuentas, listarInvitaciones } from './api/cuentas'
import { PantallaMiembros } from './miembros'
import { RegistroCuenta } from './registro-cuenta'
import { InvitacionesPendientes, ResumenCuenta } from './resumen-cuenta'
import { AuthScreen } from '../auth/components/AuthScreen'
import { BienvenidaPresentacion } from '../auth/components/BienvenidaPresentacion'
import { SolicitarVisita } from '../auth/components/SolicitarVisita'
import { Button, ButtonLink } from '@/components/ui'
import { Portal } from './operacion/portal'
import { useColaVisitas } from './operacion/cola-visitas'

/**
 * Solicitudes de visita: el backend real aún no las expone. Se explica sin simular datos; quien recibió una
 * invitación la activa en /registro y quien quiere una cuenta se registra en /crear-cuenta.
 */
function SolicitudPendiente({ titulo }: { titulo: string }) {
  return (
    <AuthScreen title={titulo}>
      <p>Las solicitudes de visita todavía no están disponibles en esta versión de CuidaRed.</p>
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
  const [pagina, setPagina] = useState(1)
  const [revisionCuentas, setRevisionCuentas] = useState(0)
  const [listado, setListado] = useState<{
    usuarioId: string
    pagina: number
    resultado?: Awaited<ReturnType<typeof listarCuentas>>
    error?: true
  }>()
  const [invitaciones, setInvitaciones] = useState<{ usuarioId: string; datos?: CuentaMe[]; error?: true }>()
  const perfilListo = !!session && !!user && user.identity.id === session.user.id
  const cola = useColaVisitas(perfilListo ? session?.user.id : undefined, perfilListo ? session?.access_token : undefined)

  useEffect(() => {
    if (!session || !perfilListo) return
    const { user: { id: usuarioId }, access_token: token } = session
    let activo = true
    let cargando = false
    const cargar = async () => {
      if (cargando) return
      cargando = true
      await Promise.allSettled([
        listarCuentas(token, pagina).then(
          (resultado) => { if (activo) setListado({ usuarioId, pagina, resultado }) },
          () => { if (activo) setListado({ usuarioId, pagina, error: true }) },
        ),
        listarInvitaciones(token).then(
          (datos) => { if (activo) setInvitaciones({ usuarioId, datos }) },
          () => { if (activo) setInvitaciones({ usuarioId, error: true }) },
        ),
      ])
      cargando = false
    }
    const visible = () => { if (document.visibilityState === 'visible') void cargar() }
    void cargar()
    const timer = window.setInterval(visible, 30_000)
    window.addEventListener('focus', visible)
    return () => {
      activo = false
      window.clearInterval(timer)
      window.removeEventListener('focus', visible)
    }
  }, [session, perfilListo, pagina, revisionCuentas])

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
          // Una renovación de token de la misma persona no descarta lo cargado (ni lo que escribe en pantalla).
          setUser((actual) => (next && actual && actual.identity.id === next.user.id ? actual : null))
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

  const refrescar = () => setRevision((value) => value + 1)
  const refrescarCuentas = () => setRevisionCuentas((value) => value + 1)
  const elegirCuenta = (id: string) => {
    guardarCuentaActiva(id)
    setCuentaElegida(id)
    refrescarCuentas()
  }
  const alCrearCuenta = (cuenta: CuentaMe) => elegirCuenta(cuenta.cuenta_id)
  const datosCuentas = listado?.usuarioId === session?.user.id && listado?.pagina === pagina ? listado : undefined
  const datosInvitaciones = invitaciones?.usuarioId === session?.user.id ? invitaciones : undefined
  const cuentas = datosCuentas?.resultado?.data ?? []
  const cuentaActiva = cuentaElegida ? cuentas.find((c) => c.cuenta_id === cuentaElegida) : cuentas[0]

  const account = session ? (
    <AuthScreen title="Mi cuenta">
      {error && <p role="alert">{error}</p>}
      {!user && !error && <p role="status">Comprobando perfil…</p>}
      {perfilListo && (
        <>
          <InvitacionesPendientes key={`invitaciones:${user.identity.id}`} pendientes={datosInvitaciones?.datos ?? []} token={session.access_token} onResuelta={refrescarCuentas} />
          <ProfileForm
            key={user.identity.id}
            token={session.access_token}
            profile={user.profile}
            onSaved={() => setRevision((value) => value + 1)}
          />
          {datosCuentas?.resultado ? (
            <PanelCuentas cuentas={cuentas} activa={cuentaActiva} onCambiar={elegirCuenta} pagina={pagina}
              totalPaginas={datosCuentas.resultado.meta.totalPages} onPagina={setPagina} />
          ) : (
            <section aria-label="Mis cuentas" className="mt-5">
              {datosCuentas?.error ? <p role="status">No se pudieron consultar tus cuentas.</p> : <p role="status">Consultando tus cuentas…</p>}
              {datosCuentas?.error && <Button variant="outline" onClick={refrescarCuentas}>Reintentar cuentas</Button>}
            </section>
          )}
          {datosInvitaciones?.error && <p className="text-sm text-muted">No se pudieron consultar las invitaciones.</p>}
          {cuentaActiva && <ResumenCuenta key={cuentaActiva.cuenta_id} cuenta={cuentaActiva} token={session.access_token} />}
        </>
      )}
      {error && <Button onClick={refrescar}>Reintentar</Button>}
      <Button variant="outline" className="mt-5" onClick={() => void logout()}>
        Cerrar sesión
      </Button>
    </AuthScreen>
  ) : (
    <Navigate to="/inicio" replace />
  )

  const miembros = session ? (
    perfilListo ? (
      <PantallaMiembros token={session.access_token} cuenta={cuentaActiva} usuarioId={user.identity.id} />
    ) : (
      <AuthScreen title="Miembros" back="/cuenta">
        {error ? <p role="alert">{error}</p> : <p role="status">Comprobando perfil…</p>}
      </AuthScreen>
    )
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
      <Route path="/cuenta/miembros" element={miembros} />
      <Route path="/operacion/:cuentaId/:seccion" element={perfilListo && session ? (
        <Portal key={session.user.id} token={session.access_token} usuarioId={session.user.id} cola={cola} />
      ) : account} />
      <Route path="/" element={session ? <Navigate to="/cuenta" replace /> : bienvenida} />
      <Route path="/crear-cuenta" element={<RegistroCuenta key="crear" titulo="Crear una cuenta" session={session} onCreada={alCrearCuenta} />} />
      <Route
        path="/registro-familia"
        element={<RegistroCuenta key="familia" titulo="Crear cuenta familiar" tipoInicial="familia" session={session} onCreada={alCrearCuenta} />}
      />
      <Route
        path="/registro-organizacion"
        element={<RegistroCuenta key="organizacion" titulo="Registrar organización" tipoInicial="organizacion" session={session} onCreada={alCrearCuenta} />}
      />
      <Route path="/solicitud-visita" element={<SolicitudPendiente titulo="Consultar mi solicitud" />} />
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
