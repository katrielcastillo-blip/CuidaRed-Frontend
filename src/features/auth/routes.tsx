import type { RouteObject } from 'react-router-dom'
import { RedirectIfAuthed } from '@/app/guards'
import Inicio from './pages/Inicio'
import { Privacidad, Terminos } from './pages/Legal'
import Recuperar from './pages/Recuperar'
import Registro from './pages/Registro'
import RegistroCuenta from './pages/RegistroCuenta'
import RegistroOrganizacion from './pages/RegistroOrganizacion'
import Restablecer from './pages/Restablecer'
import Splash from './pages/Splash'

/** Rutas públicas (sección Figma "Prototipo Funcional (Login)" + Registrar organización). Dueño: agente AUTH. */
export const authRoutes: RouteObject[] = [
  { path: '/', element: <Splash /> },
  // /inicio resuelve la sesión por sí mismo (respeta location.state.from del mismo rol)
  { path: '/inicio', element: <Inicio /> },
  { path: '/registro', element: <RedirectIfAuthed><Registro /></RedirectIfAuthed> },
  { path: '/registro/cuenta', element: <RedirectIfAuthed><RegistroCuenta /></RedirectIfAuthed> },
  { path: '/recuperar', element: <RedirectIfAuthed><Recuperar /></RedirectIfAuthed> },
  { path: '/restablecer', element: <RedirectIfAuthed><Restablecer /></RedirectIfAuthed> },
  { path: '/terminos', element: <Terminos /> },
  { path: '/privacidad', element: <Privacidad /> },
  { path: '/registro-organizacion', element: <RedirectIfAuthed><RegistroOrganizacion /></RedirectIfAuthed> },
]
