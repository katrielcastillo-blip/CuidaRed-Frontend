/*
 * routes.tsx — Área del VOLUNTARIO: portal mínimo (Reglas de Negocio V2 §Visita: el voluntario únicamente registra
 * que la visita ocurrió y deja una observación). Navegación: Inicio · Visitas · Perfil.
 *   index ................ Inicio: bienvenida (primera vez), visitas de hoy y próximas, visita no programada
 *   visitas .............. Mis visitas: programadas por registrar e historial de las registradas
 *   visitas/nueva ........ Registrar visita (mínima): adulto, "La visita se realizó" y observación
 *   perfil ............... perfilRoutes(): Mi perfil, ayuda y sincronización (sistemaRoutes())
 * NO monta visitasRoutes() ni agendaRoutes(): incluyen necesidades, indicaciones médicas y estado del adulto, a los
 * que el voluntario no tiene acceso. La activación de la cuenta por invitación vive en el área pública (/registro) y
 * termina aquí (HOME_BY_ROL.voluntario). Las asignaciones de adultos las hace el coordinador o el administrador.
 * Módulo: voluntario.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { RouteObject } from 'react-router-dom'
import { ClipboardList, House, UserRound } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'
import { sistemaRoutes } from '@/features/sistema/routes'
import { Inicio } from './pages/Inicio'
import { MisVisitas } from './pages/MisVisitas'
import { RegistrarVisita } from './pages/RegistrarVisita'

const BASE = '/voluntario'
const nav: NavItem[] = [
  { to: BASE, label: 'Inicio', icon: House, end: true },
  { to: `${BASE}/visitas`, label: 'Visitas', icon: ClipboardList },
  { to: `${BASE}/perfil`, label: 'Perfil', icon: UserRound },
]

export const voluntarioRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="voluntario">
      <AppShell nav={nav} base={BASE} perfilPath={`${BASE}/perfil`} />
    </RequireRole>
  ),
  children: [
    { index: true, element: <Inicio /> },
    { path: 'visitas', element: <MisVisitas /> },
    { path: 'visitas/nueva', element: <RegistrarVisita /> },
    ...perfilRoutes(),
    ...sistemaRoutes(),
  ],
}
