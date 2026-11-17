/*
 * connected-app.tsx — Rutas del acceso conectado (Supabase Auth + API Express), sin datos del simulador.
 * Módulo: access-real (ID01 · ID02: contexto de cuenta y rol activo CR-175, autorregistro, invitaciones y miembros).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Rutas: /inicio (acceso o entrada al portal), /registro (activar invitación), /recuperar, /restablecer, /cuenta (perfil, invitaciones, cuentas y
 * resumen), /cuenta/miembros (solo con `usuarios:gestionar`), /crear-cuenta, /registro-familia y /registro-organizacion
 * (autorregistro del titular).
 */
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Privacidad, Terminos } from '../auth/pages/Legal'
import { ApiError, api, configuration as validarConfiguracion, logout, obtenerSuscripcionPush, recuperarSesionDelNavegador, type BrowserSession, type CuentaMe, type CurrentUser } from './client'
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
import { useColaOperaciones } from './operacion/cola-operaciones'

/**
 * Solicitudes públicas de visita: el backend real mantiene cerrado ese flujo. Quien recibió una
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
  const { pathname, search } = useLocation()
  const enlaceAvisos = /^\/operacion\/[1-9][0-9]{0,18}\/alertas$/.test(pathname) && search === '?bandeja=avisos'
  const [configuration] = useState(() => {
    try {
      validarConfiguracion()
      return { disponible: true, error: '' }
    } catch (issue) {
      return { disponible: false, error: issue instanceof Error ? issue.message : 'No se pudo configurar el acceso.' }
    }
  })
  const [loading, setLoading] = useState(configuration.disponible)
  const [session, setSession] = useState<BrowserSession | null>(null)
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
  const [activaRemota, setActivaRemota] = useState<{ usuarioId: string; id: string; cuenta: CuentaMe }>()
  const perfilListo = !!session && !!user && user.identity.id === session.user.id
  const cola = useColaOperaciones(perfilListo ? session?.user.id : undefined, perfilListo ? session?.access_token : undefined)
  const tokenPush = perfilListo ? session?.access_token : undefined

  useEffect(() => {
    if (!tokenPush) return
    let vigente = true
    const verificar = async () => {
      const suscripcion = await obtenerSuscripcionPush()
      if (!suscripcion || !vigente) return
      const estado = await api<{ activa: boolean }>('/notificaciones-push/suscripciones/estado', tokenPush,
        'POST', { endpoint: suscripcion.endpoint })
      // Un segundo usuario que inicia sesión en un navegador compartido no hereda avisos del anterior.
      if (vigente && estado.activa === false) await suscripcion.unsubscribe()
    }
    void verificar().catch(() => {})
    return () => { vigente = false }
  }, [tokenPush])

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
    if (!session || !perfilListo || !cuentaElegida) return
    const usuarioId = session.user.id
    const id = cuentaElegida
    let vigente = true
    const consultar = () => {
      void api<CuentaMe>(`/cuentas/${encodeURIComponent(id)}/contexto`, session.access_token).then(
        (cuenta) => { if (vigente) setActivaRemota({ usuarioId, id, cuenta }) },
        (error: unknown) => {
          if (!vigente) return
          setActivaRemota(undefined)
          if (error instanceof ApiError && error.status === 404) {
            guardarCuentaActiva(null)
            setCuentaElegida(null)
          }
        },
      )
    }
    const visible = () => { if (document.visibilityState === 'visible') consultar() }
    consultar()
    const timer = window.setInterval(visible, 30_000)
    window.addEventListener('focus', visible)
    return () => {
      vigente = false
      window.clearInterval(timer)
      window.removeEventListener('focus', visible)
    }
  }, [session, perfilListo, cuentaElegida, revisionCuentas])

  useEffect(() => {
    let active = true
    if (configuration.disponible) {
      void recuperarSesionDelNavegador().then((next) => {
        if (active) setSession(next)
      }).catch((issue: unknown) => {
        if (active) setError(issue instanceof Error ? issue.message : 'No se pudo recuperar la sesión.')
      }).finally(() => {
        if (active) setLoading(false)
      })
    }
    return () => {
      active = false
    }
  }, [configuration])

  useEffect(() => {
    if (!session) return
    let active = true
    let pending = false
    const refresh = async (permitirRenovar = false) => {
      if (pending) return
      pending = true
      try {
        if (permitirRenovar && session.expires_at * 1000 - Date.now() <= 60_000) {
          const next = await recuperarSesionDelNavegador()
          if (active) {
            setSession(next)
            if (!next) {
              setUser(null)
              setError('Tu sesión venció. Inicia sesión de nuevo.')
            }
          }
          return
        }
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
            setSession(null)
          }
        }
      } finally {
        pending = false
      }
    }
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true)
    }, 30_000)
    const focus = () => {
      void refresh(true)
    }
    window.addEventListener('focus', focus)
    let lastActivity = 0
    const activity = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastActivity < 60_000) return
      lastActivity = Date.now()
      void api('/session/activity', session.access_token, 'POST').catch(() => {
        void refresh(true)
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
  const abrirSesion = (next: BrowserSession) => {
    setError('')
    setSession(next)
  }
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
  const cuentaRecordada = activaRemota && activaRemota.usuarioId === session?.user.id && activaRemota.id === cuentaElegida
    ? activaRemota : undefined
  const cuentaActiva = cuentaElegida
    ? cuentas.find((c) => c.cuenta_id === cuentaElegida) ?? cuentaRecordada?.cuenta
    : cuentas[0]
  const listaCuentas = datosCuentas?.resultado ? (
    <PanelCuentas cuentas={cuentas} activa={cuentaActiva} onCambiar={elegirCuenta} pagina={pagina}
      totalPaginas={datosCuentas.resultado.meta.totalPages} onPagina={setPagina} />
  ) : (
    <section aria-label="Mis cuentas" className="mt-5">
      {datosCuentas?.error ? <p role="status">No se pudieron consultar tus cuentas.</p> : <p role="status">Consultando tus cuentas…</p>}
      {datosCuentas?.error && <Button variant="outline" onClick={refrescarCuentas}>Reintentar cuentas</Button>}
    </section>
  )
  const panelInvitaciones = session && perfilListo ? (
    <>
      <InvitacionesPendientes key={`invitaciones:${user.identity.id}`} pendientes={datosInvitaciones?.datos ?? []} token={session.access_token} onResuelta={refrescarCuentas} />
      {datosInvitaciones?.error && <p className="text-sm text-muted">No se pudieron consultar las invitaciones.</p>}
    </>
  ) : null

  const inicio = session ? (
    perfilListo && cuentaActiva ? (
      <Navigate to={`/operacion/${encodeURIComponent(cuentaActiva.cuenta_id)}/cuenta`} replace />
    ) : (
      <AuthScreen title="Inicio">
        {error && <p role="alert">{error}</p>}
        {!perfilListo && !error && <p role="status">Comprobando perfil…</p>}
        {perfilListo && <>
          {panelInvitaciones}
          {listaCuentas}
          <ButtonLink to="/cuenta" variant="outline" className="mt-5">Mi cuenta</ButtonLink>
        </>}
        {error && <Button onClick={refrescar}>Reintentar</Button>}
        <Button variant="ghost" className="mt-3" onClick={() => void logout(session)}>Cerrar sesión</Button>
      </AuthScreen>
    )
  ) : <AccessForm notice={error} onSession={abrirSesion} />

  const account = session ? (
    <AuthScreen title="Mi cuenta" back="/inicio">
      {error && <p role="alert">{error}</p>}
      {!user && !error && <p role="status">Comprobando perfil…</p>}
      {perfilListo && (
        <>
          {panelInvitaciones}
          <ProfileForm
            key={user.identity.id}
            token={session.access_token}
            profile={user.profile}
            onSaved={() => setRevision((value) => value + 1)}
          />
          {listaCuentas}
          {cuentaActiva && <ResumenCuenta key={cuentaActiva.cuenta_id} cuenta={cuentaActiva} token={session.access_token} />}
        </>
      )}
      {error && <Button onClick={refrescar}>Reintentar</Button>}
      <Button variant="outline" className="mt-5" onClick={() => void logout(session)}>
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
      <Route path="/inicio" element={inicio} />
      <Route path="/registro" element={session ? <Navigate to="/cuenta" replace /> : <InvitationForm onSession={abrirSesion} />} />
      <Route path="/recuperar" element={<RecoveryForm />} />
      <Route path="/restablecer" element={<ResetForm />} />
      <Route path="/cuenta" element={account} />
      <Route path="/cuenta/miembros" element={miembros} />
      <Route path="/operacion/:cuentaId/:seccion" element={perfilListo && session ? (
        <Portal key={session.user.id} token={session.access_token} usuarioId={session.user.id} cola={cola} />
      ) : enlaceAvisos && !session ? <AccessForm notice={error} onSession={abrirSesion} /> : account} />
      <Route path="/" element={session ? <Navigate to="/inicio" replace /> : bienvenida} />
      <Route path="/crear-cuenta" element={<RegistroCuenta key="crear" titulo="Crear una cuenta" session={session} onSession={abrirSesion} onCreada={alCrearCuenta} />} />
      <Route
        path="/registro-familia"
        element={<RegistroCuenta key="familia" titulo="Crear cuenta familiar" tipoInicial="familia" session={session} onSession={abrirSesion} onCreada={alCrearCuenta} />}
      />
      <Route
        path="/registro-organizacion"
        element={<RegistroCuenta key="organizacion" titulo="Registrar organización" tipoInicial="organizacion" session={session} onSession={abrirSesion} onCreada={alCrearCuenta} />}
      />
      <Route path="/solicitud-visita" element={<SolicitudPendiente titulo="Consultar mi solicitud" />} />
      <Route path="/terminos" element={<Terminos />} />
      <Route path="/privacidad" element={<Privacidad />} />
      <Route path="*" element={<Navigate to="/inicio" replace />} />
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
