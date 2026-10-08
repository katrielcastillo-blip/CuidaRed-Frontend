import type { RouteObject } from 'react-router-dom'
import { DetalleNecesidad } from './pages/DetalleNecesidad'
import { DetalleVisita } from './pages/DetalleVisita'
import { RegistrarNecesidad } from './pages/RegistrarNecesidad'
import { RegistrarVisita } from './pages/RegistrarVisita'

/**
 * Flujo de visitas y necesidades — compartido por CUIDADOR y COORDINADOR (cada uno lo monta en su área).
 * Rutas relativas a la base del rol:
 *   visitas/nueva?adulto=:id         Registrar Visita (+ overlay "Visita registrada correctamente!")
 *   visitas/:visitaId                Detalle Visita (iniciar visita si está pendiente)
 *   necesidades/nueva?adulto=:id     Registrar Necesidad (+ overlay "Necesidad registrada correctamente!")
 *   necesidades/:necesidadId         Detalle Necesidad
 * El comportamiento y los enlaces se adaptan al rol (useSession) y a la base del área (useShell).
 * Dueño: agente CUIDADOR.
 */
export function visitasRoutes(): RouteObject[] {
  return [
    { path: 'visitas/nueva', element: <RegistrarVisita /> },
    { path: 'visitas/:visitaId', element: <DetalleVisita /> },
    { path: 'necesidades/nueva', element: <RegistrarNecesidad /> },
    { path: 'necesidades/:necesidadId', element: <DetalleNecesidad /> },
  ]
}
