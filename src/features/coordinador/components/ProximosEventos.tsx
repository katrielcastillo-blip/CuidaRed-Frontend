/*
 * ProximosEventos.tsx — Próximos eventos del coordinador: visitas programadas y tareas de la agenda de hoy y de los
 * próximos días, agrupados por día. Las visitas de personas externas indican el visitante y quién las autorizó.
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Camera, CalendarCheck, ListChecks, Repeat } from 'lucide-react'
import { Badge } from '@/components/ui'
import { fechaCorta, todayISO } from '@/domain/dates'
import { ESTADO_TAREA, etiquetaDia, horaTarea } from '@/features/agenda/lib/agenda'
import { cn } from '@/lib/cn'
import { ESTADO_VISITA, horaPautada12, textoVisitante, type EventoProximo } from '../lib/datos'

export interface ResolverNombres {
  /** Nombre del adulto mayor (adulto de la visita o de la tarea). */
  adulto: (adultoId: string) => string
  /** Nombre del usuario (responsable de la visita o quien autorizó). */
  usuario: (usuarioId: string | undefined) => string
  /** Nombre del cuidador al que se asignó la tarea. */
  cuidador: (cuidadorId: string) => string
}

/** "Hoy" · "Mañana" · "Lunes 09/11/2026". */
function titularDia(fecha: string) {
  const dia = etiquetaDia(fecha)
  if (dia === 'Hoy' || dia === 'Mañana') return dia
  const d = new Date(`${fecha}T00:00:00`)
  const semana = d.toLocaleDateString('es-DO', { weekday: 'long' })
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${fechaCorta(fecha)}`
}

export function ProximosEventos({
  eventos,
  base,
  nombres,
  limite = 8,
  puedeVerAgenda,
}: {
  eventos: EventoProximo[]
  base: string
  nombres: ResolverNombres
  limite?: number
  puedeVerAgenda: boolean
}) {
  const visibles = eventos.slice(0, limite)
  const grupos = new Map<string, EventoProximo[]>()
  for (const e of visibles) grupos.set(e.fecha, [...(grupos.get(e.fecha) ?? []), e])
  const ocultos = eventos.length - visibles.length

  return (
    <div className="flex flex-col gap-4">
      {[...grupos.entries()].map(([fecha, lista]) => (
        <div key={fecha} className="flex flex-col gap-2">
          <h3 className={cn('px-1 text-sm font-bold uppercase tracking-wide', fecha === todayISO() ? 'text-navy' : 'text-muted')}>{titularDia(fecha)}</h3>
          <ul className="flex flex-col rounded-md border border-line-soft bg-surface divide-y divide-line-soft">
            {lista.map((e) => (
              <li key={`${e.tipo}-${e.id}`}>{e.tipo === 'visita' ? <FilaVisita e={e} base={base} nombres={nombres} /> : <FilaTarea e={e} base={base} nombres={nombres} />}</li>
            ))}
          </ul>
        </div>
      ))}
      {ocultos > 0 && (
        <p className="px-1 text-sm text-muted">
          {ocultos === 1 ? 'Hay 1 evento más' : `Hay ${ocultos} eventos más`} en los próximos días:{' '}
          <Link to={`${base}/visitas?tab=proximas`} className="font-bold text-navy hover:underline">
            ver visitas próximas
          </Link>
          {puedeVerAgenda && (
            <>
              {' '}
              o{' '}
              <Link to={`${base}/agenda`} className="font-bold text-navy hover:underline">
                la agenda de tareas
              </Link>
            </>
          )}
          .
        </p>
      )}
    </div>
  )
}

const FILA = 'flex items-start gap-3 min-h-16 px-4 py-3 hover:bg-blue-100/50'

/** Hora y estado en una columna a la izquierda: deja todo el ancho restante al título y al detalle (móvil). */
function ColumnaHora({ hora, children }: { hora: string; children: ReactNode }) {
  return (
    <span className="flex flex-none flex-col items-start gap-1.5 w-[76px] pt-0.5">
      <span className="text-sm font-bold leading-tight text-navy">{hora}</span>
      {children}
    </span>
  )
}

function FilaVisita({ e, base, nombres }: { e: Extract<EventoProximo, { tipo: 'visita' }>; base: string; nombres: ResolverNombres }) {
  const v = e.visita
  const est = ESTADO_VISITA[v.estado]
  const visitante = textoVisitante(v, nombres.usuario)
  return (
    <Link to={`${base}/visitas/${v.id}`} className={FILA}>
      <ColumnaHora hora={horaPautada12(v.horaPautada)}>
        <Badge tone={est.tono}>{est.label}</Badge>
      </ColumnaHora>
      <span className="flex flex-col flex-1 min-w-0">
        <strong className="flex items-start gap-1.5 text-base leading-snug text-ink">
          <CalendarCheck size={16} className="flex-none mt-1 text-navy" aria-label="Visita" />
          <span className="wrap-anywhere">{nombres.adulto(v.adultoId)}</span>
        </strong>
        <span className="text-sm text-ink-2 wrap-anywhere">{v.razon || v.tipo}</span>
        <span className="text-sm text-muted wrap-anywhere">{visitante ?? `Responsable: ${nombres.usuario(v.cuidadorId)}`}</span>
        {v.pendienteSync && (
          <span className="mt-1">
            <Badge tone="warning">Pendiente de sincronización</Badge>
          </span>
        )}
      </span>
    </Link>
  )
}

function FilaTarea({ e, base, nombres }: { e: Extract<EventoProximo, { tipo: 'tarea' }>; base: string; nombres: ResolverNombres }) {
  const t = e.tarea
  const est = ESTADO_TAREA[t.estado]
  return (
    <Link to={`${base}/agenda/${t.id}`} className={FILA}>
      <ColumnaHora hora={horaTarea(t.horaProgramada)}>
        <Badge tone={est.tono}>{est.label}</Badge>
      </ColumnaHora>
      <span className="flex flex-col flex-1 min-w-0">
        <strong className="flex items-start gap-1.5 text-base leading-snug text-ink">
          <ListChecks size={16} className="flex-none mt-1 text-success-700" aria-label="Tarea de agenda" />
          <span className="wrap-anywhere">{t.titulo}</span>
        </strong>
        <span className="text-sm text-muted wrap-anywhere">
          {nombres.adulto(t.adultoId)} · {nombres.cuidador(t.cuidadorId)}
        </span>
        {(t.requiereEvidencia || t.repetitiva) && (
          <span className="mt-0.5 flex gap-2 text-navy">
            {t.requiereEvidencia && <Camera size={16} aria-label="Requiere evidencia" />}
            {t.repetitiva && <Repeat size={16} aria-label="Repetitiva" />}
          </span>
        )}
      </span>
    </Link>
  )
}
