/*
 * AvisoPlan.tsx — Aviso en línea de una funcionalidad que el plan de la cuenta no incluye ("Disponible en el plan
 * Gestión Comunitaria Avanzada"). Nada se oculta sin explicarlo: los extras de reportes avanzados muestran este
 * aviso junto al control bloqueado. useAvisoPlan (otro archivo) da el mismo texto para el PDF y el Excel.
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Lock } from 'lucide-react'
import type { Funcionalidad } from '@/domain/types'
import { cn } from '@/lib/cn'
import { useAvisoPlan } from './useAvisoPlan'

/** `que` nombra lo bloqueado ("Exportar a Excel"); sin él, el aviso va dentro de la tarjeta que ya lo explica. */
export function AvisoPlan({ funcionalidad, que, id, className }: { funcionalidad: Funcionalidad; que?: string; id?: string; className?: string }) {
  const { texto, plan } = useAvisoPlan(funcionalidad)
  return (
    <p id={id} role="note" data-testid="aviso-plan" className={cn('flex items-start gap-2 text-sm text-ink-2', className)}>
      <Lock size={16} className="flex-none mt-0.5 text-warning-700" aria-hidden />
      <span>
        {que && <b className="text-ink">{que}: </b>}
        {plan ? (
          <>
            Disponible en el plan <b className="text-ink">{plan}</b>.{texto.slice(`Disponible en el plan ${plan}.`.length)}
          </>
        ) : (
          texto
        )}
      </span>
    </p>
  )
}
