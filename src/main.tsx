/*
 * main.tsx — Punto de entrada: monta la aplicación React y carga los estilos globales (Tailwind).
 * Módulo: app.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App.tsx'
import { escucharFallosDeLaPwa } from './features/access-real/telemetria'
import { aplicarTamanoTextoGuardado } from './features/access-real/operacion/marco/accesibilidad'

escucharFallosDeLaPwa()
// «Tamaño del texto» (Accesibilidad) se recuerda en este dispositivo y se aplica antes de pintar la primera pantalla.
aplicarTamanoTextoGuardado()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
