/*
 * useAvisoPlan.ts — Texto del aviso "Disponible en el plan …" de una funcionalidad que el plan de la cuenta no
 * incluye. Lo usan el aviso en pantalla (AvisoPlan) y el PDF/Excel.
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { TIPO_CUENTA_ID, TIPO_CUENTA_LABEL } from '@/domain/planes'
import { useDB } from '@/domain/store'
import type { Funcionalidad } from '@/domain/types'
import { usePlanCuenta, usePlanQueIncluye } from '@/domain/usePlan'

/** Texto del aviso de plan para la funcionalidad. */
export function useAvisoPlan(f: Funcionalidad): { texto: string; plan: string | undefined } {
  const delTipo = usePlanQueIncluye(f)
  const planes = useDB((s) => s.catalogos.planes)
  const { enPrueba, tipo } = usePlanCuenta()
  // Si ningún plan del tipo de cuenta la incluye (p. ej. una cuenta Familia), se indica el plan que sí, y de qué tipo de cuenta es.
  const plan = delTipo ?? planes.filter((p) => p.estado === 'activo' && p.funcionalidades.includes(f)).sort((a, b) => a.precio - b.precio)[0]
  if (!plan) return { texto: 'No está incluido en el plan de tu cuenta.', plan: undefined }
  const otroTipo = plan.tipoCuentaId !== TIPO_CUENTA_ID[tipo]
  const tipoPlan = plan.tipoCuentaId === TIPO_CUENTA_ID.organizacion ? 'organizacion' : 'familia'
  const texto = `Disponible en el plan ${plan.nombre}.${otroTipo ? ` Es un plan para cuentas de tipo ${TIPO_CUENTA_LABEL[tipoPlan]}.` : ''}${enPrueba ? ' Tu cuenta está en prueba gratuita.' : ''}`
  return { texto, plan: plan.nombre }
}
