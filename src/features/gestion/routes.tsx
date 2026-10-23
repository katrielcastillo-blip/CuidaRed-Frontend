/*
 * routes.tsx — Rutas del módulo de gestión, compartido por ADMINISTRADOR y COORDINADOR.
 * Cada ruta exige su permiso con <RequirePermiso> (RF-09 · CU-13); la capa de servicios vuelve a validar.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Rutas relativas a la base del rol (los enlaces internos se construyen con `useShell().base`):
 *   adultos                      Listado de perfiles (búsqueda, filtros, días sin visita, alertas)  CU-04   adultos:ver
 *   adultos/nuevo                Registrar perfil (3 pasos)                                         CU-02   adultos:crear
 *   adultos/:adultoId            Perfil: contactos, vínculos, riesgos, indicaciones, agenda, historial CU-04   adultos:ver
 *   adultos/:adultoId/editar     Editar perfil (+ desactivar / reactivar / anonimizar)              CU-03   adultos:editar
 *   adultos/:adultoId/riesgo     Evaluación de riesgo (alerta automática si queda en "Alto")        RF-01   adultos:evaluar
 *   alertas                      Bandeja de alertas por urgencia                                     CU-09/10 alertas:ver
 *   alertas/:alertaId            Detalle y gestión de la alerta                                      CU-09/10 alertas:ver
 *   resumen                      Resumen de seguimiento de casos activos                             CU-11   resumen:ver
 *   reportes                     Reportes estadísticos (CSV / PDF)                                   CU-12   reportes:ver
 * Enlaza a `visitas/…` y `necesidades/…` (módulo visitas) para el historial del adulto.
 */
import type { ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'
import { RequirePermiso } from '@/app/guards'
import type { Accion } from '@/domain/permisos'
import AdultosPage from './pages/AdultosPage'
import AdultoNuevoPage from './pages/AdultoNuevoPage'
import AdultoPerfilPage from './pages/AdultoPerfilPage'
import AdultoEditarPage from './pages/AdultoEditarPage'
import RiesgoPage from './pages/RiesgoPage'
import AlertasPage from './pages/AlertasPage'
import AlertaDetallePage from './pages/AlertaDetallePage'
import ResumenPage from './pages/ResumenPage'
import ReportesPage from './pages/ReportesPage'

const ruta = (path: string, accion: Accion, element: ReactNode): RouteObject => ({
  path,
  element: <RequirePermiso accion={accion}>{element}</RequirePermiso>,
})

export function gestionRoutes(): RouteObject[] {
  return [
    ruta('adultos', 'adultos:ver', <AdultosPage />),
    ruta('adultos/nuevo', 'adultos:crear', <AdultoNuevoPage />),
    ruta('adultos/:adultoId', 'adultos:ver', <AdultoPerfilPage />),
    ruta('adultos/:adultoId/editar', 'adultos:editar', <AdultoEditarPage />),
    ruta('adultos/:adultoId/riesgo', 'adultos:evaluar', <RiesgoPage />),
    ruta('alertas', 'alertas:ver', <AlertasPage />),
    ruta('alertas/:alertaId', 'alertas:ver', <AlertaDetallePage />),
    ruta('resumen', 'resumen:ver', <ResumenPage />),
    ruta('reportes', 'reportes:ver', <ReportesPage />),
  ]
}
