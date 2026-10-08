import type { RouteObject } from 'react-router-dom'
import { BriefcaseMedical, House, PersonStanding } from 'lucide-react'
import { RequireRole } from '@/app/guards'
import { Placeholder } from '@/app/Placeholder'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'

const BASE = '/familiar'
const nav: NavItem[] = [
  { to: BASE, label: 'Inicio', icon: House, end: true },
  { to: `${BASE}/adultos`, label: 'Adultos', icon: PersonStanding },
  { to: `${BASE}/visitas`, label: 'Visitas', icon: BriefcaseMedical },
]

/** Área del FAMILIAR (sección Figma "Prototipo Funcional (Familiar)"). Dueño: agente FAMILIAR. */
export const familiarRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="familiar">
      <AppShell nav={nav} base={BASE} perfilPath={`${BASE}/perfil`} />
    </RequireRole>
  ),
  children: [
    { index: true, element: <Placeholder name="Dashboard familiar" /> },
    ...perfilRoutes(),
  ],
}
