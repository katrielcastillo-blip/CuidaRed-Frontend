/*
 * routes.tsx — Rutas públicas: bienvenida, inicio de sesión, activación de cuenta, registro de organización,
 * recuperación de contraseña y avisos legales.
 * Módulo: auth.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Navigate, type RouteObject } from 'react-router-dom'
import { RedirectIfAuthed } from '@/app/guards'
import Inicio from './pages/Inicio'
import { Privacidad, Terminos } from './pages/Legal'
import Recuperar from './pages/Recuperar'
import Registro from './pages/Registro'
import RegistroOrganizacion from './pages/RegistroOrganizacion'
import Restablecer from './pages/Restablecer'
import Splash from './pages/Splash'

export const authRoutes: RouteObject[] = [
  { path: '/', element: <Splash /> },
  // /inicio resuelve la sesión por sí mismo (respeta location.state.from del mismo rol)
  { path: '/inicio', element: <Inicio /> },
  { path: '/registro', element: <RedirectIfAuthed><Registro /></RedirectIfAuthed> },
  // Ruta antigua del segundo paso del registro: la activación ahora vive entera en /registro.
  { path: '/registro/cuenta', element: <Navigate to="/registro" replace /> },
  { path: '/recuperar', element: <RedirectIfAuthed><Recuperar /></RedirectIfAuthed> },
  { path: '/restablecer', element: <RedirectIfAuthed><Restablecer /></RedirectIfAuthed> },
  { path: '/terminos', element: <Terminos /> },
  { path: '/privacidad', element: <Privacidad /> },
  { path: '/registro-organizacion', element: <RedirectIfAuthed><RegistroOrganizacion /></RedirectIfAuthed> },
]
