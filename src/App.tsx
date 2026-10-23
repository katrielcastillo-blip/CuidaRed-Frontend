/*
 * App.tsx — Raíz de la aplicación: avisos, vigilancia de la sesión, sincronización offline y evaluación
 * periódica del motor de alertas.
 * Módulo: app.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { ToastProvider } from '@/components/ui'
import { router } from '@/app/router'
import { useVigilanciaSesion } from '@/domain/auth'
import { evaluarReglas } from '@/domain/store'
import { iniciarSync } from '@/domain/sync'

/** Cada 5 minutos y al volver a la pestaña se re-evalúan las reglas de alertas (RF-04/RF-05). */
const EVALUACION_MS = 5 * 60_000

function Servicios() {
  useVigilanciaSesion()
  useEffect(() => {
    void iniciarSync()
    evaluarReglas()
    const t = setInterval(evaluarReglas, EVALUACION_MS)
    const alVolver = () => document.visibilityState === 'visible' && evaluarReglas()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])
  return null
}

export default function App() {
  return (
    <ToastProvider>
      <Servicios />
      <RouterProvider router={router} />
    </ToastProvider>
  )
}
