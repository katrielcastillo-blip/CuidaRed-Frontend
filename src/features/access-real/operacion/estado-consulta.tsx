/*
 * estado-consulta.tsx — Estado de una consulta de la fase 7 (cargando, sin conexión o fallo) con el motivo explicado: cuenta
 * sin acceso vigente, permiso o plan, servicio no disponible. A diferencia del estado genérico, no oculta la causa.
 * Módulo: access-real (ID07).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Button } from '@/components/ui'
import { mensajeReporte } from './reportes-errores'

export function EstadoConsulta({ consulta }: { consulta: { datos?: unknown; error?: true; fallo?: unknown; sinConexion?: boolean; reintentar: () => void } }) {
  if (consulta.sinConexion && consulta.datos === undefined) {
    return <p role="status" className="rounded-md border border-line-soft bg-warning-100 p-4 text-ink">Sin conexión. Los datos se consultarán cuando vuelva Internet.</p>
  }
  if (consulta.error) {
    return <div className="flex flex-wrap items-center gap-3 rounded-md border border-danger bg-danger-100 p-4 text-ink">
      <span role="alert">{mensajeReporte(consulta.fallo, 'consultar')}</span>
      <Button variant="outline" size="sm" onClick={consulta.reintentar}>Reintentar</Button>
    </div>
  }
  if (consulta.datos === undefined) return <p role="status" className="py-2 text-sm text-muted">Consultando…</p>
  return null
}
