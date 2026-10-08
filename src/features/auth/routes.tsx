import type { RouteObject } from 'react-router-dom'
import { Placeholder } from '@/app/Placeholder'
import { RedirectIfAuthed } from '@/app/guards'

/** Rutas públicas (sección Figma "Prototipo Funcional (Login)" + Registrar organización). Dueño: agente AUTH. */
export const authRoutes: RouteObject[] = [
  { path: '/', element: <Placeholder name="Pantalla Logo (splash)" inShell={false} /> },
  { path: '/inicio', element: <RedirectIfAuthed><Placeholder name="Pantalla Home (login)" inShell={false} /></RedirectIfAuthed> },
  { path: '/registro', element: <Placeholder name="Registrarse (paso 1)" inShell={false} /> },
  { path: '/registro/cuenta', element: <Placeholder name="Registrarse (paso 2)" inShell={false} /> },
  { path: '/recuperar', element: <Placeholder name="Olvidaste contraseña" inShell={false} /> },
  { path: '/restablecer', element: <Placeholder name="Restablecer contraseña" inShell={false} /> },
  { path: '/terminos', element: <Placeholder name="Términos y condiciones" inShell={false} /> },
  { path: '/privacidad', element: <Placeholder name="Política de privacidad" inShell={false} /> },
  { path: '/registro-organizacion', element: <Placeholder name="Registrar organización" inShell={false} /> },
]
