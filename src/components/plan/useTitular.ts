/*
 * useTitular.ts — ¿Puede el usuario en sesión contratar o pagar el plan de la cuenta activa?
 * Módulo: plan y suscripción (Reglas de Negocio V2 §Cuenta: solo la persona titular paga).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { esTitularDeCuenta } from '@/domain/api/cuenta'
import { useSession } from '@/domain/auth'
import { puede } from '@/domain/permisos'

export function useTitular() {
  const { user, org } = useSession()
  const esTitular = esTitularDeCuenta(user, org)
  // El servicio vuelve a comprobar ambas cosas: ocultar el botón no es el control.
  return { esTitular, puedeContratar: esTitular && puede(user, 'cuenta:suscripcion') }
}
