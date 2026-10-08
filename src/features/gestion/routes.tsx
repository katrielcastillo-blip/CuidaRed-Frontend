import type { RouteObject } from 'react-router-dom'
import { Placeholder } from '@/app/Placeholder'

/**
 * Gestión de adultos mayores, alertas y reportes — compartido por ADMIN y COORDINADOR.
 * Rutas relativas a la base del rol:
 *   adultos                      Adultos Mayores (lista + búsqueda + filtros riesgo/zona)
 *   adultos/nuevo                Agregar Adulto Mayor
 *   adultos/:adultoId            Perfil Envejeciente (admin)
 *   adultos/:adultoId/editar     Editar Adulto Mayor
 *   adultos/:adultoId/riesgo     Evaluación de Riesgo
 *   alertas                      Alertas
 *   alertas/:alertaId            Detalle Alerta
 *   reportes                     Reportes y Estadísticas
 * Dueño: agente ADMIN.
 */
export function gestionRoutes(): RouteObject[] {
  return [
    { path: 'adultos', element: <Placeholder name="Adultos Mayores" /> },
    { path: 'adultos/nuevo', element: <Placeholder name="Agregar Adulto Mayor" /> },
    { path: 'adultos/:adultoId', element: <Placeholder name="Perfil Envejeciente" /> },
    { path: 'adultos/:adultoId/editar', element: <Placeholder name="Editar Adulto Mayor" /> },
    { path: 'adultos/:adultoId/riesgo', element: <Placeholder name="Evaluación de Riesgo" /> },
    { path: 'alertas', element: <Placeholder name="Alertas" /> },
    { path: 'alertas/:alertaId', element: <Placeholder name="Detalle Alerta" /> },
    { path: 'reportes', element: <Placeholder name="Reportes y Estadísticas" /> },
  ]
}
