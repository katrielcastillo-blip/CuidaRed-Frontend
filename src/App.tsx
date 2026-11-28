/*
 * App.tsx — Acceso conectado por defecto; prototipo aislado y explícito en desarrollo.
 * Módulo: app.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { lazy, Suspense } from 'react'
import { PantallaEspera } from '@/components/ui/PantallaEspera'

// El acceso real no importa store, seed ni el simulador de contraseñas.
const DemoApp = import.meta.env.DEV ? lazy(() => import('./DemoApp')) : null
const ConnectedApp = lazy(() => import('./features/access-real/connected-app'))

export default function App() {
  const demo = import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'demo'
  return <Suspense fallback={<PantallaEspera />}>{demo && DemoApp ? <DemoApp /> : <ConnectedApp />}</Suspense>
}
