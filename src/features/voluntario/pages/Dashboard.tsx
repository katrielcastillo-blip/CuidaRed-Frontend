/*
 * Dashboard.tsx — Inicio del voluntario (Interfaz móvil de campo, SRS §13.1): visitas de hoy y próximas,
 * tareas de hoy de su agenda (Tarea_agenda del perfil Cuidador del usuario), acciones rápidas, adultos
 * asignados (Vinculo) con días sin visita y necesidades pendientes, y aviso de conexión / registros por
 * sincronizar (RF-10 · SRS §11 "Transición de estados de conectividad").
 * Módulo: voluntario.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Camera, CircleCheck, ClipboardPlus, CloudOff, HandHeart, ListTodo, RefreshCw } from 'lucide-react'
import { nombreCompleto, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaLarga, hhmmA12, todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { cuidadorDeUsuario } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import { usePendientes } from '@/domain/sync'
import type { Adulto, EstadoTarea, Tarea } from '@/domain/types'
import { Badge, ButtonLink, EmptyState, StatTile, type Tone } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { VisitaCard } from '@/features/visitas/components/VisitaCard'
import { porFechaAsc } from '@/features/visitas/lib/dominio'
import { AdultoCard } from '../components/AdultoCard'
import { useMisAdultos } from '../lib/resumen'

export function Dashboard() {
  const user = useUser()
  const { base } = useShell()
  const enLinea = useEnLinea()
  const pendientesSync = usePendientes().length
  const visitas = useDB((s) => s.visitas)
  const adultos = useDB((s) => s.adultos)
  const tareas = useDB((s) => s.tareas)
  const cuidadores = useDB((s) => s.cuidadores)
  const misAdultos = useMisAdultos()
  const verAgenda = puede(user, 'agenda:ver')

  const { deHoy, completadas, proximas } = useMemo(() => {
    const hoy = todayISO()
    const mias = visitas.filter((v) => v.cuidadorId === user.id && v.estado !== 'cancelada')
    const deHoy = mias.filter((v) => v.fecha === hoy).sort(porFechaAsc)
    return {
      deHoy,
      completadas: deHoy.filter((v) => v.estado === 'completada').length,
      proximas: mias.filter((v) => v.fecha > hoy && v.estado === 'pendiente').sort(porFechaAsc).slice(0, 3),
    }
  }, [visitas, user.id])

  // Tareas de hoy de su agenda: Tarea_agenda.Cuidador_Id = perfil de cuidador (tabla Cuidador) del usuario.
  const tareasHoy = useMemo(() => {
    const perfil = cuidadorDeUsuario(cuidadores, user.id)
    if (!perfil) return []
    const hoy = todayISO()
    return tareas
      .filter((t) => t.cuidadorId === perfil.id && t.fechaProgramada === hoy && t.estado !== 'cancelada')
      .sort((a, b) => a.horaProgramada.localeCompare(b.horaProgramada))
  }, [tareas, cuidadores, user.id])

  const abiertasHoy = deHoy.filter((v) => v.estado !== 'completada')
  const adultoDe = (id: string) => adultos.find((a) => a.id === id)

  return (
    <Page title="Inicio" wide>
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-bold leading-tight text-ink">Hola, {user.nombre}</h1>
        <p className="text-sm font-semibold text-muted">{fechaLarga()}</p>
      </div>

      {!enLinea ? (
        <div className="flex items-start gap-3 p-4 rounded-sm border border-warning bg-warning-100 text-ink" role="status">
          <CloudOff size={24} className="text-warning-700 flex-none" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-bold text-warning-700">Sin conexión. Puedes seguir registrando.</p>
            <p className="text-sm">
              Las visitas y necesidades se guardan en el dispositivo y se envían solas al volver la conexión
              {pendientesSync > 0 && ` (${pendientesSync} pendiente${pendientesSync === 1 ? '' : 's'})`}.
            </p>
          </div>
        </div>
      ) : (
        pendientesSync > 0 && (
          <Link
            to={`${base}/sincronizacion`}
            className="flex items-center gap-3 min-h-12 p-4 rounded-sm border border-blue bg-blue-100 text-navy hover:shadow-1"
            role="status"
          >
            <RefreshCw size={22} className="flex-none" aria-hidden />
            <span className="flex-1 font-semibold">
              {pendientesSync} registro{pendientesSync === 1 ? '' : 's'} pendiente{pendientesSync === 1 ? '' : 's'} de sincronizar
            </span>
            <ArrowRight size={20} aria-hidden />
          </Link>
        )
      )}

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <section className="flex flex-col gap-3 p-4 rounded-sm border border-line bg-surface-2/50" aria-labelledby="hoy-titulo">
            <h2 className="text-xl font-bold text-ink" id="hoy-titulo">
              Visitas de hoy
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Completadas" value={completadas} />
              <StatTile label="Por hacer" value={abiertasHoy.length} tone={abiertasHoy.length ? 'info' : 'default'} />
            </div>
            {abiertasHoy.length > 0 ? (
              <div className="flex flex-col gap-3">
                {abiertasHoy.map((v) => (
                  <VisitaCard key={v.id} visita={v} adulto={adultoDe(v.adultoId)} to={`${base}/visitas/${v.id}`} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-2">No tienes visitas pendientes para hoy.</p>
            )}
          </section>

          {verAgenda && <TareasDeHoy tareas={tareasHoy} adultoDe={adultoDe} base={base} />}
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          {puede(user, 'visitas:registrar') && (
            <section className="flex flex-col gap-3" aria-labelledby="acciones-titulo">
              <h2 className="section-title" id="acciones-titulo">
                Acciones rápidas
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                <ButtonLink variant="soft" fullWidth to={`${base}/visitas/nueva`} icon={<ClipboardPlus size={22} aria-hidden />}>
                  Registrar visita
                </ButtonLink>
                <ButtonLink variant="soft" fullWidth to={`${base}/necesidades/nueva`} icon={<HandHeart size={22} aria-hidden />}>
                  Registrar necesidad
                </ButtonLink>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3" aria-labelledby="proximas-titulo">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title" id="proximas-titulo">
                Próximas visitas
              </h2>
              <Link to={`${base}/visitas`} className="inline-flex items-center min-h-12 px-2 text-sm font-semibold text-navy underline underline-offset-4">
                Ver todas
              </Link>
            </div>
            {proximas.length > 0 ? (
              <div className="flex flex-col gap-3">
                {proximas.map((v) => (
                  <VisitaCard key={v.id} visita={v} adulto={adultoDe(v.adultoId)} to={`${base}/visitas/${v.id}`} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-2">No hay visitas programadas para los próximos días.</p>
            )}
          </section>
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="adultos-titulo">
        <h2 className="section-title" id="adultos-titulo">
          Mis adultos asignados
        </h2>
        {misAdultos.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]">
            {misAdultos.map((r) => (
              <AdultoCard key={r.adulto.id} resumen={r} />
            ))}
          </div>
        ) : (
          <EmptyState title="Sin adultos asignados" text="El coordinador te asignará los adultos mayores que debes visitar." />
        )}
      </section>
    </Page>
  )
}

const ESTADO_TAREA: Record<EstadoTarea, { label: string; tone: Tone }> = {
  pendiente: { label: 'Pendiente', tone: 'warning' },
  en_curso: { label: 'En curso', tone: 'info' },
  completada: { label: 'Completada', tone: 'success' },
  cancelada: { label: 'Cancelada', tone: 'neutral' },
}

/** Tareas de hoy de la agenda del voluntario (Tarea_agenda): hora, título, adulto, prioridad, evidencia y estado. */
function TareasDeHoy({ tareas, adultoDe, base }: { tareas: Tarea[]; adultoDe: (id: string) => Adulto | undefined; base: string }) {
  const hechas = tareas.filter((t) => t.estado === 'completada').length
  return (
    <section className="flex flex-col gap-3" aria-labelledby="tareas-titulo">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title" id="tareas-titulo">
          Tareas de hoy{' '}
          {tareas.length > 0 && (
            <span className="text-base font-semibold text-muted">
              ({hechas} de {tareas.length})
            </span>
          )}
        </h2>
        <Link to={`${base}/agenda`} className="inline-flex items-center min-h-12 px-2 text-sm font-semibold text-navy underline underline-offset-4">
          Ver agenda
        </Link>
      </div>
      {tareas.length > 0 ? (
        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {tareas.map((t) => {
            const adulto = adultoDe(t.adultoId)
            const hecha = t.estado === 'completada'
            const est = ESTADO_TAREA[t.estado]
            return (
              <li key={t.id}>
                <Link
                  to={`${base}/agenda/${t.id}`}
                  className={cn('flex items-center gap-3 min-h-12 p-3 rounded-sm border bg-bg hover:shadow-1', hecha ? 'border-line-soft' : 'border-line')}
                >
                  <span className="flex-none w-[4.5rem] text-sm font-bold text-navy">{hhmmA12(t.horaProgramada)}</span>
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className={cn('font-semibold wrap-anywhere', hecha ? 'text-muted line-through' : 'text-ink')}>{t.titulo}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-ink-2">
                      <span>{adulto ? nombreCompleto(adulto) : 'Adulto mayor'}</span>
                      {t.requiereEvidencia && (
                        <span className="inline-flex items-center gap-1">
                          <Camera size={12} aria-hidden /> Requiere evidencia
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 flex-none">
                    {hecha ? (
                      <>
                        <CircleCheck size={22} className="text-success-700" aria-hidden />
                        <span className="sr-only">Completada</span>
                      </>
                    ) : (
                      <Badge tone={est.tone}>{est.label.toUpperCase()}</Badge>
                    )}
                    {!hecha && t.prioridad === 'alta' && <Badge tone="danger">PRIORIDAD ALTA</Badge>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <ListTodo size={18} aria-hidden /> No tienes tareas programadas para hoy.
        </p>
      )}
    </section>
  )
}
