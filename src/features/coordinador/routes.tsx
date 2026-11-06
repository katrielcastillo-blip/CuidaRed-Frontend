/*
 * routes.tsx — Área del COORDINADOR (panel de gestión y supervisión, SRS §13.1).
 * Navegación: Inicio · Adultos · Visitas · Alertas (contador de alertas sin atender) · Más (contador de
 * solicitudes de visita por autorizar, si puede autorizarlas).
 *   index ................. Inicio: alertas activas, próximos eventos, monitoreo de visitas y solicitudes por autorizar
 *   visitas ............... Agenda de visitas (hoy / próximas / historial)
 *   visitas/programar ..... Programar visita (antes de visitasRoutes() para no chocar con visitas/:visitaId)
 *   mas ................... Más opciones (incluye Agenda y, según permisos, Miembros, Suscripción y Configuración
 *                           de la cuenta: en una cuenta Familia el Coordinador gestiona la cuenta; el orquestador monta esas
 *                           pantallas en miembros, suscripcion y configuracion)
 *   + solicitudesRoutes() (solicitudes, solicitudes/:solicitudId: visitantes externos [visitas:autorizar])
 *   + cuentaRoutes() (miembros, configuracion, roles) y suscripcion: solo con permiso (cuenta Familia)
 *   + necesidadesOrgRoutes() (necesidades-institucionales, plan Gestión Comunitaria Avanzada)
 *   + agendaRoutes() (agenda, agenda/nueva, agenda/:tareaId, agenda/:tareaId/editar: Tarea_agenda y Evidencias)
 *   + visitasRoutes(), gestionRoutes() (adultos, alertas, resumen, reportes), perfilRoutes(), sistemaRoutes()
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import type { RouteObject } from 'react-router-dom'
import { BellRing, BriefcaseMedical, Ellipsis, House, PersonStanding } from 'lucide-react'
import { alertasVisibles } from '@/domain/api'
import { useSession } from '@/domain/auth'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import { AppShell, type NavItem } from '@/layouts/AppShell'
import { perfilRoutes } from '@/features/perfil/routes'
import { sistemaRoutes } from '@/features/sistema/routes'
import { gestionRoutes } from '@/features/gestion/routes'
import { visitasRoutes } from '@/features/visitas/routes'
import { agendaRoutes } from '@/features/agenda/routes'
import { DashboardPage } from './DashboardPage'
import { MasPage } from './MasPage'
import { ProgramarVisitaPage } from './ProgramarVisitaPage'
import { solicitudesRoutes } from './solicitudes/routes'
import { RequirePermiso, RequireRole } from '@/app/guards'
import { cuentaRoutes } from '@/features/admin/cuentaRoutes'
import { necesidadesOrgRoutes } from '@/features/admin/necesidadesOrgRoutes'
import Suscripcion from '@/features/admin/pages/Suscripcion'
import { VisitasPage } from './VisitasPage'

const BASE = '/coordinador'

/**
 * Shell con la navegación del coordinador; el ítem Alertas muestra las alertas visibles sin atender y Más, las
 * solicitudes de visita por autorizar (solo si el usuario puede autorizarlas).
 */
function CoordinadorShell() {
  const { user } = useSession()
  const alertas = useDB((s) => s.alertas)
  const adultos = useDB((s) => s.adultos)
  const solicitudes = useDB((s) => s.solicitudesVisita)
  const sinAtender = useMemo(() => alertasVisibles({ alertas, adultos }, user).filter((a) => a.estado !== 'atendida').length, [alertas, adultos, user])
  const porAutorizar = useMemo(
    () => (user && puede(user, 'visitas:autorizar') ? solicitudes.filter((s) => s.orgId === user.orgId && s.estado === 'pendiente').length : 0),
    [solicitudes, user],
  )

  const nav: NavItem[] = useMemo(
    () => [
      { to: BASE, label: 'Inicio', icon: House, end: true },
      { to: `${BASE}/adultos`, label: 'Adultos', icon: PersonStanding },
      { to: `${BASE}/visitas`, label: 'Visitas', icon: BriefcaseMedical },
      { to: `${BASE}/alertas`, label: 'Alertas', icon: BellRing, badge: sinAtender },
      { to: `${BASE}/mas`, label: 'Más', icon: Ellipsis, badge: porAutorizar },
    ],
    [sinAtender, porAutorizar],
  )
  return <AppShell nav={nav} base={BASE} perfilPath={`${BASE}/perfil`} />
}

export const coordinadorRoutes: RouteObject = {
  path: BASE,
  element: (
    <RequireRole rol="coordinador">
      <CoordinadorShell />
    </RequireRole>
  ),
  children: [
    { index: true, element: <DashboardPage /> },
    { path: 'visitas', element: <VisitasPage /> },
    { path: 'visitas/programar', element: <ProgramarVisitaPage /> },
    { path: 'mas', element: <MasPage /> },
    ...solicitudesRoutes(),
    // Cuenta Familia (V2): el Coordinador gestiona miembros, configuración y suscripción. Cada ruta exige su permiso,
    // así que en una Organización (donde lo hace el Administrador) quedan bloqueadas.
    ...cuentaRoutes(),
    { path: 'suscripcion', element: <RequirePermiso accion="cuenta:suscripcion"><Suscripcion /></RequirePermiso> },
    ...necesidadesOrgRoutes(),
    ...agendaRoutes(),
    ...visitasRoutes(),
    ...gestionRoutes(),
    ...perfilRoutes(),
    ...sistemaRoutes(),
  ],
}
