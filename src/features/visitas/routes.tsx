import type { RouteObject } from 'react-router-dom'
import { Placeholder } from '@/app/Placeholder'

/**
 * Flujo de visitas y necesidades — compartido por CUIDADOR y COORDINADOR (cada uno lo monta en su área).
 * Rutas relativas a la base del rol:
 *   visitas/nueva?adulto=:id         Registrar Visita (+ overlay "Visita registrada correctamente!")
 *   visitas/:visitaId                Detalle Visita (iniciar visita si está pendiente)
 *   necesidades/nueva?adulto=:id     Registrar Necesidad (+ overlay "Necesidad registrada correctamente!")
 *   necesidades/:necesidadId         Detalle Necesidad
 * Dueño: agente CUIDADOR.
 */
export function visitasRoutes(): RouteObject[] {
  return [
    { path: 'visitas/nueva', element: <Placeholder name="Registrar Visita" /> },
    { path: 'visitas/:visitaId', element: <Placeholder name="Detalle Visita" /> },
    { path: 'necesidades/nueva', element: <Placeholder name="Registrar Necesidad" /> },
    { path: 'necesidades/:necesidadId', element: <Placeholder name="Detalle Necesidad" /> },
  ]
}
