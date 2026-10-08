import type { RouteObject } from 'react-router-dom'
import AdultosPage from './pages/AdultosPage'
import AdultoNuevoPage from './pages/AdultoNuevoPage'
import AdultoPerfilPage from './pages/AdultoPerfilPage'
import AdultoEditarPage from './pages/AdultoEditarPage'
import RiesgoPage from './pages/RiesgoPage'
import AlertasPage from './pages/AlertasPage'
import AlertaDetallePage from './pages/AlertaDetallePage'
import ReportesPage from './pages/ReportesPage'

/**
 * Gestión de adultos mayores, alertas y reportes — compartido por ADMIN y COORDINADOR.
 * Rutas relativas a la base del rol (los enlaces internos se construyen con `useShell().base`):
 *   adultos                      Adultos Mayores (lista + búsqueda + filtros riesgo/zona/estado)       [408:1081 · 487:1213]
 *   adultos/nuevo                Agregar Adulto Mayor                                                    [417:653 · 487:1000]
 *   adultos/:adultoId            Perfil Envejeciente (+ cuidadores asignados, solo admin edita)          [408:1743 · 487:1315]
 *   adultos/:adultoId/editar     Editar Adulto Mayor (+ desactivar / reactivar)                          [441:2041 · 487:1137]
 *   adultos/:adultoId/riesgo     Evaluación de Riesgo (puntaje ponderado → nivel → alerta si es alto)    [441:3212 · 487:1065]
 *   alertas                      Alertas                                                                 [443:3977 · 487:1646]
 *   alertas/:alertaId            Detalle Alerta (marcar atendida + nota)                                 [479:1412 · 487:1804 · 499:3182]
 *   reportes                     Reportes y Estadísticas (KPIs, gráficos, exportar PDF/CSV)              [479:2093 · 487:2006]
 * El coordinador además enlaza a `visitas/…` y `necesidades/…` (módulo visitas); el admin no tiene esas rutas.
 */
export function gestionRoutes(): RouteObject[] {
  return [
    { path: 'adultos', element: <AdultosPage /> },
    { path: 'adultos/nuevo', element: <AdultoNuevoPage /> },
    { path: 'adultos/:adultoId', element: <AdultoPerfilPage /> },
    { path: 'adultos/:adultoId/editar', element: <AdultoEditarPage /> },
    { path: 'adultos/:adultoId/riesgo', element: <RiesgoPage /> },
    { path: 'alertas', element: <AlertasPage /> },
    { path: 'alertas/:alertaId', element: <AlertaDetallePage /> },
    { path: 'reportes', element: <ReportesPage /> },
  ]
}
