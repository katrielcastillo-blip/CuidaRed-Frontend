/*
 * IndicadorFrecuencia.tsx — Indicador reutilizable de frecuencia de visitas (CU-06 · RF-05): días desde la última
 * visita REALIZADA y semáforo frente al umbral configurable de la cuenta, siempre con texto además del color
 * y con un icono distinto por estado (SRS §18.4). Sin visitas realizadas muestra «Atención inicial pendiente».
 *   variante «completo»: tarjeta para el perfil (días, estado, última visita, umbral y barra de avance).
 *   variante «compacto»: una línea para listas y tarjetas.
 * Módulo: gestión (reutilizable por cualquier área).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { CalendarCheck, CalendarClock, CalendarPlus, CalendarX } from 'lucide-react'
import { fechaCorta } from '@/domain/dates'
import { configOrg } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { cn } from '@/lib/cn'
import { calcularFrecuencia, type EstadoFrecuencia, type Frecuencia } from '../lib/frecuencia'
import { plural } from '../lib/formato'

type Variante = 'completo' | 'compacto'

const VISUAL: Record<EstadoFrecuencia, { Icono: typeof CalendarCheck; etiqueta: string; caja: string; texto: string; barra: string }> = {
  al_dia: { Icono: CalendarCheck, etiqueta: 'Al día', caja: 'border-success-700 bg-success-100', texto: 'text-success-700', barra: 'bg-success-700' },
  por_vencer: { Icono: CalendarClock, etiqueta: 'Próxima al límite', caja: 'border-warning-700 bg-warning-100', texto: 'text-warning-700', barra: 'bg-warning-700' },
  vencida: { Icono: CalendarX, etiqueta: 'Supera el límite', caja: 'border-danger bg-danger-100', texto: 'text-danger', barra: 'bg-danger' },
  inicial: { Icono: CalendarPlus, etiqueta: 'Atención inicial pendiente', caja: 'border-blue bg-blue-100', texto: 'text-navy', barra: 'bg-blue' },
}

/** «12 días sin visita», «Visitado hoy» o «Atención inicial pendiente». */
function titulo(f: Frecuencia) {
  if (f.estado === 'inicial') return 'Atención inicial pendiente'
  return f.dias === 0 ? 'Visitado hoy' : `${plural(f.dias, 'día', 'días')} sin visita`
}

/** Frase corta del estado respecto al umbral. */
function detalleUmbral(f: Frecuencia) {
  if (f.superaUmbral) return `Supera el límite de ${plural(f.umbral, 'día', 'días')} sin visita`
  if (f.dias === f.umbral) return `Alcanza hoy el límite de ${plural(f.umbral, 'día', 'días')}`
  return `Faltan ${plural(f.restantes, 'día', 'días')} para el límite de ${f.umbral}`
}

export function IndicadorFrecuencia({ adulto, variante = 'completo', className }: { adulto: Adulto; variante?: Variante; className?: string }) {
  const visitas = useDB((s) => s.visitas)
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  // Un perfil inactivo o anonimizado no tiene seguimiento activo: no se le evalúa la frecuencia.
  if (adulto.estado !== 'activo') return null
  const umbral = configOrg({ catalogos, configuracion }, adulto.orgId).diasSinVisitaAlerta
  const f = calcularFrecuencia(visitas, adulto, umbral)
  const v = VISUAL[f.estado]

  if (variante === 'compacto') {
    return (
      <span className={cn('inline-flex flex-wrap items-center gap-x-1.5 text-sm font-semibold', v.texto, className)} data-estado={f.estado}>
        <v.Icono size={16} className="flex-none" aria-hidden />
        <span>{titulo(f)}</span>
        {f.estado !== 'inicial' && <span className="font-normal">· {v.etiqueta}</span>}
      </span>
    )
  }

  return (
    <section className={cn('flex flex-col gap-3 p-4 rounded-sm border', v.caja, className)} aria-label="Frecuencia de visitas" data-estado={f.estado}>
      <div className="flex items-start gap-3">
        <v.Icono size={32} className={cn('flex-none', v.texto)} aria-hidden />
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-2">Frecuencia de visitas</span>
          <strong className={cn('text-xl font-bold', v.texto)}>{titulo(f)}</strong>
          <span className={cn('text-sm font-semibold', v.texto)}>{f.estado === 'inicial' ? `Perfil registrado hace ${plural(f.dias, 'día', 'días')}` : v.etiqueta}</span>
        </div>
      </div>
      <div className="h-2 rounded-pill bg-white/70 overflow-hidden" aria-hidden>
        <div className={cn('h-full rounded-pill', v.barra)} style={{ width: `${Math.min(100, Math.round(f.avance * 100))}%` }} />
      </div>
      <p className="text-sm text-ink-2">
        {f.estado === 'inicial' ? (
          <>Aún no tiene ninguna visita realizada: programa o registra la primera. {f.superaUmbral && <b>Ya superó el límite de {plural(f.umbral, 'día', 'días')}.</b>}</>
        ) : (
          <>
            Última visita realizada: <b>{fechaCorta(f.referencia)}</b>. {detalleUmbral(f)}.
          </>
        )}{' '}
        <span className="text-muted">Solo cuentan las visitas realizadas; el límite se configura en la cuenta.</span>
      </p>
    </section>
  )
}
