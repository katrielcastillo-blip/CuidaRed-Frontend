/*
 * ContratarPlan.tsx — Planes que puede contratar la cuenta (según su tipo) con su resumen, límites y funcionalidades,
 * y el pago simulado al elegir uno. Solo la persona titular ve el botón de contratar o pagar; los demás ven
 * «Solo la persona titular puede contratar». Lo comparten «Plan y suscripción» y la pantalla de cuenta sin acceso.
 * Módulo: plan y suscripción (Reglas de Negocio V2 §Plan · §Cuenta).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useMemo, useState } from 'react'
import { Check, CircleCheck, Lock } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { useSession } from '@/domain/auth'
import { ETIQUETA_FUNCIONALIDAD, excedeLimite, planesCompatibles, tipoDeCuenta, type TipoCuenta } from '@/domain/planes'
import { usoDelPlan } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Plan } from '@/domain/types'
import { cn } from '@/lib/cn'
import { precioPlan } from './formato'
import { PagoSimulado } from './PagoSimulado'

const limite = (n: number | null | undefined, sustantivo: string) => (n == null ? `${sustantivo[0]!.toUpperCase()}${sustantivo.slice(1)} sin límite` : `Hasta ${n} ${sustantivo}`)

/** Líneas de límites de un plan (V2: `null` = ilimitado). */
function lineasLimites(p: Plan, tipo: TipoCuenta): string[] {
  const adultos = limite(p.limiteEnvejecientes, 'adultos mayores')
  if (tipo === 'familia') return [adultos, limite(p.limiteFamiliares, 'familiares'), limite(p.limiteUsuarios, 'cuidadores')]
  return [adultos, limite(p.limiteUsuarios, 'miembros del equipo')]
}

export function ContratarPlan({ puedeContratar, onPagado }: { puedeContratar: boolean; onPagado?: (plan: Plan) => void }) {
  const { org } = useSession()
  const catalogos = useDB((s) => s.catalogos)
  const adultos = useDB((s) => s.adultos)
  const usuarios = useDB((s) => s.usuarios)
  const membresias = useDB((s) => s.membresias)
  const [elegido, setElegido] = useState<Plan | null>(null)
  const cerrar = useCallback(() => setElegido(null), [])

  const tipo = tipoDeCuenta(org)
  const planes = useMemo(() => planesCompatibles(catalogos, org).sort((a, b) => a.precio - b.precio), [catalogos, org])
  const uso = useMemo(() => usoDelPlan({ adultos, usuarios, catalogos, membresias }, org), [adultos, usuarios, catalogos, membresias, org])
  const activa = org?.suscripcionEstado === 'activa'

  if (planes.length === 0) return <p className="text-sm text-muted">No hay planes disponibles para tu tipo de cuenta por ahora.</p>

  return (
    <div className="@container flex flex-col gap-3">
      <ul className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
        {planes.map((p) => {
          const actual = activa && p.id === org?.planId
          const insuficiente =
            excedeLimite(uso.envejecientes, p.limiteEnvejecientes) || excedeLimite(uso.usuarios, p.limiteUsuarios) || (tipo === 'familia' && excedeLimite(uso.familiares, p.limiteFamiliares))
          return (
            <li key={p.id} className={cn('flex flex-col gap-3 p-4 rounded-md border min-w-0', actual ? 'border-navy bg-blue-100' : 'border-line-soft bg-bg')} data-testid={`plan-${p.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <h3 className="text-lg font-bold text-ink">{p.nombre}</h3>
                <span className="font-bold text-navy">{precioPlan(p)}</span>
              </div>
              {actual && (
                <Badge tone="success" className="self-start">
                  <CircleCheck size={12} aria-hidden /> Plan actual
                </Badge>
              )}
              {p.resumen && <p className="text-sm text-ink-2">{p.resumen}</p>}
              <ul className="flex flex-col gap-1 text-sm font-semibold text-ink">
                {lineasLimites(p, tipo).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <div className="flex flex-col gap-1.5 pt-3 border-t border-line-soft">
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted">Incluye</h4>
                <ul className="grid grid-cols-1 gap-x-3 gap-y-1 text-sm text-ink-2 @md:grid-cols-2">
                  {p.funcionalidades.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check size={16} className="flex-none mt-0.5 text-success-700" aria-hidden />
                      <span>{ETIQUETA_FUNCIONALIDAD[f]}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {insuficiente && <p className="text-xs font-semibold text-warning-700">Tu uso actual supera los límites de este plan.</p>}
              <div className="mt-auto pt-1">
                {puedeContratar ? (
                  <Button fullWidth size="sm" variant={actual ? 'outline' : 'primary'} aria-label={`${actual ? 'Renovar' : activa ? 'Cambiar a' : 'Contratar'} ${p.nombre}`} onClick={() => setElegido(p)}>
                    {actual ? 'Renovar este plan' : activa ? 'Cambiar a este plan' : 'Contratar este plan'}
                  </Button>
                ) : (
                  <p className="flex items-center gap-2 min-h-12 text-sm font-semibold text-muted">
                    <Lock size={16} className="flex-none" aria-hidden /> Solo la persona titular puede contratar
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <PagoSimulado plan={elegido} onClose={cerrar} onPagado={(_pago, plan) => onPagado?.(plan)} />
    </div>
  )
}
