/*
 * usePlan.ts — Hooks del plan de la cuenta activa: funcionalidades incluidas, límites y estado de la prueba.
 * Módulo: dominio · suscripción (CR-187 control de funcionalidades por plan en el front).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Uso en pantallas:
 *   const incluido = useFuncionalidad('reportes_avanzados')
 *   if (!incluido) return <AvisoPlan funcionalidad="reportes_avanzados" />   (components/ui)
 * Ocultar o avisar en la interfaz no reemplaza la validación del servidor.
 */
import { useMemo } from 'react'
import { useSession } from './auth'
import {
  cuentaTieneFuncionalidad,
  diasRestantesPrueba,
  enPruebaVigente,
  funcionalidadesDeCuenta,
  limitesDeCuenta,
  planDeCuenta,
  planQueIncluye,
  pruebaPorTerminar,
  tieneAccesoOperativo,
  tipoDeCuenta,
} from './planes'
import { useDB } from './store'
import type { Funcionalidad } from './types'

/** Estado del plan de la cuenta activa. */
export function usePlanCuenta() {
  const { org } = useSession()
  const catalogos = useDB((s) => s.catalogos)
  return useMemo(
    () => ({
      org,
      tipo: tipoDeCuenta(org),
      plan: planDeCuenta(catalogos, org),
      enPrueba: enPruebaVigente(org),
      diasRestantesPrueba: diasRestantesPrueba(org),
      pruebaPorTerminar: pruebaPorTerminar(org),
      accesoOperativo: tieneAccesoOperativo(org),
      funcionalidades: funcionalidadesDeCuenta(catalogos, org),
      limites: limitesDeCuenta(catalogos, org),
    }),
    [org, catalogos],
  )
}

/** ¿El plan de la cuenta activa incluye la funcionalidad? */
export function useFuncionalidad(f: Funcionalidad): boolean {
  const { org } = useSession()
  const catalogos = useDB((s) => s.catalogos)
  return useMemo(() => cuentaTieneFuncionalidad(catalogos, org, f), [catalogos, org, f])
}

/** Plan más económico de la cuenta que incluye la funcionalidad (para el aviso). */
export function usePlanQueIncluye(f: Funcionalidad) {
  const { org } = useSession()
  const catalogos = useDB((s) => s.catalogos)
  return useMemo(() => planQueIncluye(catalogos, org, f), [catalogos, org, f])
}
