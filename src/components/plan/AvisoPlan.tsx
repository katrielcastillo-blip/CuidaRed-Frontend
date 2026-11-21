/*
 * AvisoPlan.tsx — Aviso en línea de una funcionalidad que el plan de la cuenta no incluye (CR-187).
 * «Disponible en el plan X», con enlace a Suscripción si el usuario puede gestionarla.
 * Módulo: plan y suscripción. Ocultar o avisar en la interfaz no reemplaza la validación del servidor.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useSession } from '@/domain/auth'
import { puede } from '@/domain/permisos'
import { ETIQUETA_FUNCIONALIDAD } from '@/domain/planes'
import type { Funcionalidad } from '@/domain/types'
import { usePlanCuenta, usePlanQueIncluye } from '@/domain/usePlan'
import { useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'

export function AvisoPlan({ funcionalidad, className }: { funcionalidad: Funcionalidad; className?: string }) {
  const { base } = useShell()
  const { user } = useSession()
  const { enPrueba } = usePlanCuenta()
  const plan = usePlanQueIncluye(funcionalidad)
  const nombre = ETIQUETA_FUNCIONALIDAD[funcionalidad]
  const gestiona = puede(user, 'cuenta:suscripcion')

  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-md border border-blue/40 bg-blue-100', className)} role="note" data-testid="aviso-plan">
      <Lock size={20} className="flex-none mt-0.5 text-navy" aria-hidden />
      <div className="flex-1 min-w-0 flex flex-col gap-1 text-sm leading-relaxed">
        <strong className="text-base text-ink">{nombre}</strong>
        <span className="text-ink-2">
          {plan ? (
            <>
              Disponible en el plan <strong className="text-ink">{plan.nombre}</strong>.
            </>
          ) : (
            'No está incluida en los planes de tu cuenta.'
          )}{' '}
          {enPrueba ? 'Tu prueba gratuita no la incluye.' : 'Tu plan actual no la incluye.'}
        </span>
        {gestiona ? (
          <Link to={`${base}/suscripcion`} className="inline-flex items-center min-h-12 w-fit font-semibold text-navy underline underline-offset-4 hover:text-blue">
            Ver planes
          </Link>
        ) : (
          <span className="text-muted">Pide a la persona titular de la cuenta que cambie de plan.</span>
        )}
      </div>
    </div>
  )
}
