/*
 * AgendaSeccion.tsx — Próximas tareas de la agenda del adulto mayor (tabla Tarea_agenda: Titulo_Tarea,
 * Fecha_programada, Hora_programada, Prioridad_Id, Estado, Cuidador_Id, Indicacion_Id, Requiere_evidencia,
 * tarea_repetitiva). Enlaza al detalle de cada tarea y, con permiso agenda:gestionar, a "Nueva tarea"
 * (el módulo de agenda vive en features/agenda).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Camera, CalendarPlus, Repeat } from 'lucide-react'
import { Badge, ButtonLink } from '@/components/ui'
import { fechaCorta, hhmmA12, todayISO } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { nombreCatalogo, nombreUsuario } from '../../lib/datos'
import { ESTADO_TAREA_TEXTO, TONO_PRIORIDAD } from '../../lib/formato'
import { Seccion } from '../Piezas'

const LIMITE = 5

export function AgendaSeccion({ adulto, base, gestiona, className }: { adulto: Adulto; base: string; gestiona: boolean; className?: string }) {
  const tareas = useDB((s) => s.tareas)
  const cuidadores = useDB((s) => s.cuidadores)
  const usuarios = useDB((s) => s.usuarios)
  const indicaciones = useDB((s) => s.indicaciones)
  const prioridades = useDB((s) => s.catalogos.prioridades)

  const { proximas, atrasadas, completadas } = useMemo(() => {
    const hoy = todayISO()
    const propias = tareas.filter((t) => t.adultoId === adulto.id)
    const abiertas = propias
      .filter((t) => t.estado === 'pendiente' || t.estado === 'en_curso')
      .sort((a, b) => `${a.fechaProgramada} ${a.horaProgramada}`.localeCompare(`${b.fechaProgramada} ${b.horaProgramada}`))
    return {
      proximas: abiertas,
      atrasadas: abiertas.filter((t) => t.fechaProgramada < hoy).length,
      completadas: propias.filter((t) => t.estado === 'completada').length,
    }
  }, [tareas, adulto.id])

  const responsable = (cuidadorId: string) => {
    const c = cuidadores.find((x) => x.id === cuidadorId)
    return nombreUsuario(usuarios, c?.usuarioId) ?? 'Sin asignar'
  }

  return (
    <Seccion
      titulo="Agenda de cuidado"
      id="agenda"
      className={className}
      accion={
        gestiona &&
        adulto.estado === 'activo' && (
          <ButtonLink size="sm" variant="light" className="whitespace-nowrap" to={`${base}/agenda/nueva?adulto=${adulto.id}`} icon={<CalendarPlus size={18} aria-hidden />}>
            Nueva tarea
          </ButtonLink>
        )
      }
    >
      <p className="-mt-2 text-xs text-muted">
        {proximas.length} pendiente(s){atrasadas > 0 ? ` · ${atrasadas} atrasada(s)` : ''} · {completadas} completada(s)
      </p>
      {proximas.length === 0 ? (
        <p className="text-sm text-muted">No hay tareas pendientes para este adulto.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {proximas.slice(0, LIMITE).map((t) => {
            const indicacion = indicaciones.find((i) => i.id === t.indicacionId)
            const atrasada = t.fechaProgramada < todayISO()
            return (
              <li key={t.id}>
                <Link to={`${base}/agenda/${t.id}`} className="flex items-center gap-3 min-h-12 p-3 rounded-sm border border-line-soft bg-surface hover:shadow-1">
                  <span className="flex flex-col items-center justify-center flex-none w-16 py-1 rounded-sm bg-blue-100 text-navy leading-tight">
                    <span className="text-xs font-semibold">{fechaCorta(t.fechaProgramada).slice(0, 5)}</span>
                    <span className="text-[11px]">{hhmmA12(t.horaProgramada)}</span>
                  </span>
                  <span className="flex flex-col flex-1 min-w-0 gap-1">
                    <strong className="text-sm text-ink wrap-anywhere">{t.titulo}</strong>
                    <span className="text-xs text-muted">
                      {responsable(t.cuidadorId)}
                      {indicacion ? ` · ${indicacion.titulo}` : ''}
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      <Badge tone={TONO_PRIORIDAD[t.prioridad]}>Prioridad {nombreCatalogo(prioridades, t.prioridad)}</Badge>
                      {atrasada ? <Badge tone="danger">Atrasada</Badge> : <Badge tone="neutral">{ESTADO_TAREA_TEXTO[t.estado]}</Badge>}
                      {t.requiereEvidencia && (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                          <Camera size={13} aria-hidden /> Evidencia
                        </span>
                      )}
                      {t.repetitiva && (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                          <Repeat size={13} aria-hidden /> Diaria
                        </span>
                      )}
                    </span>
                  </span>
                  <ArrowRight size={18} className="flex-none text-navy" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {proximas.length > LIMITE && (
        <Link to={`${base}/agenda`} className="inline-flex items-center min-h-12 text-sm font-semibold text-navy underline underline-offset-2">
          Ver las {proximas.length} tareas en la agenda
        </Link>
      )}
    </Seccion>
  )
}
