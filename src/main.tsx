/*
 * main.tsx — Punto de entrada: monta la aplicación React y carga los estilos globales (Tailwind).
 * Módulo: app.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
