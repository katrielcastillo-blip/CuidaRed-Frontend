/*
 * BannerPrueba.tsx — Banda delgada con los días que quedan de la prueba gratuita. Con 3 días o menos invita a
 * elegir plan (no antes: no se muestran precios de entrada); solo la persona titular ve el botón.
 * Módulo: plan y suscripción (Reglas de Negocio V2 §Ciclo de vida de una suscripción).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Gift, Hourglass } from 'lucide-react'
import { usePlanCuenta } from '@/domain/usePlan'
import { ButtonLink } from '@/components/ui'
import { useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { useTitular } from './useTitular'

const cuando = (dias: number) => (dias <= 0 ? 'termina hoy' : dias === 1 ? 'termina mañana' : `termina en ${dias} días`)

export function BannerPrueba() {
  const { base } = useShell()
  const { enPrueba, diasRestantesPrueba: dias, pruebaPorTerminar } = usePlanCuenta()
  const { puedeContratar } = useTitular()
  if (!enPrueba) return null

  const Icono = pruebaPorTerminar ? Hourglass : Gift
  return (
    <div
      className={cn('no-print w-full border-b', pruebaPorTerminar ? 'bg-warning-100 border-warning text-ink' : 'bg-blue-100 border-blue/40 text-navy')}
      role="status"
      data-testid="banner-prueba"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-12 px-[var(--gutter)] py-1 mx-auto max-w-[calc(var(--content-max)+var(--gutter)*2)]">
        <Icono size={18} className={cn('flex-none', pruebaPorTerminar ? 'text-warning-700' : 'text-navy')} aria-hidden />
        <p className="flex-1 min-w-0 text-sm">
          {pruebaPorTerminar ? (
            <>
              <strong>Tu prueba gratuita {cuando(dias)}.</strong> {puedeContratar ? 'Elige un plan para seguir usando CuidaRed.' : 'Avisa a la persona titular para que elija un plan.'}
            </>
          ) : (
            <>
              <strong>Prueba gratuita:</strong> te quedan {dias} días.
            </>
          )}
        </p>
        {pruebaPorTerminar && puedeContratar && (
          <ButtonLink to={`${base}/suscripcion`} size="sm">
            Elegir plan
          </ButtonLink>
        )}
      </div>
    </div>
  )
}
