/*
 * ErrorRuta.tsx — Pantalla de error controlado: ante un fallo inesperado muestra un mensaje claro, sin
 * detalles técnicos, y orienta al usuario (SRS §8.2.2.1.22 Robustez · §8.2.2.3.5 l).
 * Módulo: sistema.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useRouteError } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'

export default function ErrorRuta() {
  const error = useRouteError()
  // El detalle técnico solo va a la consola del navegador (nunca a la pantalla).
  console.error(error)
  return (
    <main className="min-h-dvh grid place-items-center px-6 bg-bg">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <span className="grid place-items-center size-20 rounded-full bg-warning-100 text-warning-700">
          <TriangleAlert size={40} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">Algo salió mal</h1>
        <p className="text-ink-2">
          No pudimos mostrar esta pantalla. Tus datos guardados no se perdieron: los registros sin conexión siguen en este dispositivo.
          Vuelve a intentarlo; si el problema continúa, avisa al coordinador de tu organización.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="min-h-12 px-5 rounded-md bg-navy text-white font-semibold" onClick={() => window.location.reload()}>
            Reintentar
          </button>
          <a href="/" className="inline-flex items-center min-h-12 px-5 rounded-md border-2 border-navy text-navy font-semibold">
            Ir al inicio
          </a>
        </div>
      </div>
    </main>
  )
}
