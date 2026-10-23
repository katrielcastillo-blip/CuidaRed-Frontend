/*
 * AdminShell.tsx — Esqueleto del área del administrador con su navegación principal y el contador de
 * alertas sin atender (bandeja de alertas por urgencia, SRS §13.1 "Panel de gestión").
 * Módulo: admin (RF-09 · CU-13).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { BellRing, Ellipsis, House, PersonStanding, Users } from 'lucide-react'
import { alertasVisibles } from '@/domain/api'
import { useSession } from '@/domain/auth'
import { useDB } from '@/domain/store'
import { AppShell, type NavItem } from '@/layouts/AppShell'

export const BASE_ADMIN = '/admin'

export function AdminShell() {
  const { user } = useSession()
  const alertas = useDB((s) => s.alertas)
  const adultos = useDB((s) => s.adultos)

  const sinAtender = useMemo(() => alertasVisibles({ alertas, adultos }, user).filter((a) => a.estado !== 'atendida').length, [alertas, adultos, user])

  const nav: NavItem[] = useMemo(
    () => [
      { to: BASE_ADMIN, label: 'Inicio', icon: House, end: true },
      { to: `${BASE_ADMIN}/adultos`, label: 'Adultos', icon: PersonStanding },
      { to: `${BASE_ADMIN}/miembros`, label: 'Usuarios', icon: Users },
      { to: `${BASE_ADMIN}/alertas`, label: 'Alertas', icon: BellRing, badge: sinAtender },
      { to: `${BASE_ADMIN}/mas`, label: 'Más', icon: Ellipsis },
    ],
    [sinAtender],
  )

  return <AppShell nav={nav} base={BASE_ADMIN} perfilPath={`${BASE_ADMIN}/perfil`} />
}
