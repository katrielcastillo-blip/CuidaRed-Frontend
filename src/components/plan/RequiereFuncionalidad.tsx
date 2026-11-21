/*
 * RequiereFuncionalidad.tsx — Envoltorio que muestra su contenido solo si el plan de la cuenta incluye la
 * funcionalidad; si no, un aviso (por defecto <AvisoPlan>) o el `fallback` indicado (`null` la oculta).
 * Módulo: plan y suscripción (CR-187).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import type { Funcionalidad } from '@/domain/types'
import { useFuncionalidad } from '@/domain/usePlan'
import { AvisoPlan } from './AvisoPlan'

export function RequiereFuncionalidad({ f, fallback, children }: { f: Funcionalidad; fallback?: ReactNode; children: ReactNode }) {
  const incluida = useFuncionalidad(f)
  if (incluida) return <>{children}</>
  return <>{fallback === undefined ? <AvisoPlan funcionalidad={f} /> : fallback}</>
}
