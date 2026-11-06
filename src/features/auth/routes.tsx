/*
 * routes.tsx — Rutas públicas: bienvenida, inicio de sesión, creación de cuenta (tipo, familia, organización),
 * activación de cuenta invitada, recuperación de contraseña, consulta de solicitudes de visita y avisos legales.
 * Módulo: auth.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Navigate, type RouteObject } from 'react-router-dom'
import { RedirectIfAuthed } from '@/app/guards'
import Bienvenida from './pages/Bienvenida'
import ConsultarSolicitud from './pages/ConsultarSolicitud'
import Inicio from './pages/Inicio'
import { Privacidad, Terminos } from './pages/Legal'
import Recuperar from './pages/Recuperar'
import Registro from './pages/Registro'
import RegistroFamilia from './pages/RegistroFamilia'
import RegistroOrganizacion from './pages/RegistroOrganizacion'
import Restablecer from './pages/Restablecer'
import TipoCuenta from './pages/TipoCuenta'

export const authRoutes: RouteObject[] = [
  // "/" es la página de bienvenida (qué es CuidaRed, cómo funciona y accesos); con sesión salta al inicio del rol.
  { path: '/', element: <RedirectIfAuthed><Bienvenida /></RedirectIfAuthed> },
  // /inicio resuelve la sesión por sí mismo (respeta location.state.from del mismo rol)
  { path: '/inicio', element: <Inicio /> },
  // Crear una cuenta nueva: primero se elige el tipo (Familia u Organización) y luego su formulario.
  { path: '/crear-cuenta', element: <RedirectIfAuthed><TipoCuenta /></RedirectIfAuthed> },
  { path: '/registro-familia', element: <RedirectIfAuthed><RegistroFamilia /></RedirectIfAuthed> },
  { path: '/registro-organizacion', element: <RedirectIfAuthed><RegistroOrganizacion /></RedirectIfAuthed> },
  // Activar una cuenta a la que te invitaron.
  { path: '/registro', element: <RedirectIfAuthed><Registro /></RedirectIfAuthed> },
  // Ruta antigua del segundo paso del registro: la activación ahora vive entera en /registro.
  { path: '/registro/cuenta', element: <Navigate to="/registro" replace /> },
  { path: '/recuperar', element: <RedirectIfAuthed><Recuperar /></RedirectIfAuthed> },
  { path: '/restablecer', element: <RedirectIfAuthed><Restablecer /></RedirectIfAuthed> },
  // Visitante externo: consulta su solicitud con el código de seguimiento (sin cuenta).
  { path: '/solicitud-visita', element: <RedirectIfAuthed><ConsultarSolicitud /></RedirectIfAuthed> },
  { path: '/terminos', element: <Terminos /> },
  { path: '/privacidad', element: <Privacidad /> },
]
