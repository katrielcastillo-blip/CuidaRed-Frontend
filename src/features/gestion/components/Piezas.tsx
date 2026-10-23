/*
 * Piezas.tsx — Piezas visuales del módulo de gestión: prioridad (urgencia) y estado de alertas, nota
 * informativa, títulos de sección y pantalla de "no encontrado o sin permiso". El nombre de la prioridad se
 * toma del catálogo Prioridad (AlertaEnvejeciente.Prioridad_Id).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Clock, Info, OctagonAlert, SearchX, TriangleAlert } from 'lucide-react'
import { ButtonLink } from '@/components/ui'
import { useDB } from '@/domain/store'
import type { EstadoAlerta, SeveridadAlerta } from '@/domain/types'
import { cn } from '@/lib/cn'
import { ESTADO_ALERTA_TEXTO, SEVERIDAD_TEXTO } from '../lib/formato'

/**
 * Urgencia de la alerta con color + icono + texto (CU-09: "diferenciando su nivel de urgencia de manera
 * visible"): Alta = octágono rojo · Media = triángulo ámbar · Baja = círculo informativo.
 */
export const URGENCIA_VISUAL: Record<SeveridadAlerta, { Icono: typeof Info; chip: string; borde: string; icono: string }> = {
  alta: { Icono: OctagonAlert, chip: 'bg-danger text-white', borde: 'border-l-danger', icono: 'bg-danger-100 text-danger' },
  media: { Icono: TriangleAlert, chip: 'bg-warning-700 text-white', borde: 'border-l-warning', icono: 'bg-warning-100 text-warning-700' },
  baja: { Icono: Info, chip: 'bg-info-100 text-navy border border-blue', borde: 'border-l-blue', icono: 'bg-blue-100 text-navy' },
}

export function UrgenciaBadge({ severidad, className }: { severidad: SeveridadAlerta; className?: string }) {
  const v = URGENCIA_VISUAL[severidad]
  const prioridades = useDB((s) => s.catalogos.prioridades)
  const nombre = prioridades.find((p) => p.id === severidad)?.nombre ?? SEVERIDAD_TEXTO[severidad]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[11px] font-bold uppercase leading-4 whitespace-nowrap', v.chip, className)}>
      <v.Icono size={12} strokeWidth={3} aria-hidden />
      Prioridad {nombre}
    </span>
  )
}

const ESTADO_VISUAL: Record<EstadoAlerta, { Icono: typeof Info; clase: string }> = {
  pendiente: { Icono: CircleAlert, clase: 'bg-danger-100 text-danger' },
  en_atencion: { Icono: Clock, clase: 'bg-warning-100 text-warning-700' },
  atendida: { Icono: CircleCheck, clase: 'bg-success-100 text-success-700' },
}

export function EstadoAlertaBadge({ estado }: { estado: EstadoAlerta }) {
  const v = ESTADO_VISUAL[estado]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-xs font-semibold whitespace-nowrap', v.clase)}>
      <v.Icono size={13} aria-hidden />
      {ESTADO_ALERTA_TEXTO[estado]}
    </span>
  )
}

/** Cuadro informativo azul con icono. */
export function NotaInfo({ children, tono = 'info' }: { children: ReactNode; tono?: 'info' | 'aviso' }) {
  return (
    <div
      className={cn('flex items-start gap-3 px-4 py-3 rounded-sm text-sm leading-normal', tono === 'info' ? 'bg-blue-100 text-ink-2' : 'bg-warning-100 text-ink')}
      role="note"
    >
      {tono === 'info' ? <Info size={20} className="flex-none mt-px text-blue" aria-hidden /> : <TriangleAlert size={20} className="flex-none mt-px text-warning-700" aria-hidden />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Título de sección con acción opcional a la derecha. */
export function Seccion({ titulo, id, accion, children, className }: { titulo: string; id: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3 min-w-0', className)} aria-labelledby={id}>
      <div className="flex items-center justify-between gap-3 min-h-12">
        <h2 id={id} className="text-xl font-semibold text-ink">
          {titulo}
        </h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

/** Registro inexistente, de otra organización o fuera del alcance del usuario (RF-09). */
export function NoEncontrado({ volverA, que = 'este registro', textoVolver = 'Volver al listado' }: { volverA: string; que?: string; textoVolver?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <SearchX size={44} className="text-muted" aria-hidden />
      <p className="text-lg font-bold">No encontramos {que}</p>
      <p className="text-muted max-w-md">No existe, fue eliminado o no tienes permiso para consultarlo.</p>
      <ButtonLink to={volverA} replace size="sm">
        {textoVolver}
      </ButtonLink>
    </div>
  )
}
