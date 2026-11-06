/*
 * formato.ts — Textos y formatos de la suscripción: montos en RD$, precio y periodicidad del plan, estado de la
 * suscripción y del pago, y vigencia de un pago confirmado.
 * Módulo: plan y suscripción (Reglas de Negocio V2 §Plan, §Ciclo de vida de una suscripción).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { Tone } from '@/components/ui'
import { addDays, toISODate } from '@/domain/dates'
import type { EstadoSuscripcion, Pago, Plan } from '@/domain/types'

const moneda = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 2 })
export const formatoMonto = (n: number) => moneda.format(n)

const PERIODO: Record<Plan['periodicidad'], string> = { mensual: 'al mes', anual: 'al año', unico: 'pago único' }
export const PERIODICIDAD: Record<Plan['periodicidad'], string> = { mensual: 'Mensual', anual: 'Anual', unico: 'Pago único' }

/** "RD$1,500.00 al mes" · "Gratis". */
export const precioPlan = (p: Plan) => (p.precio === 0 ? 'Gratis' : `${formatoMonto(p.precio)} ${PERIODO[p.periodicidad]}`)

export const ESTADO_SUSCRIPCION: Record<EstadoSuscripcion, { texto: string; tono: Tone }> = {
  prueba: { texto: 'Prueba gratuita', tono: 'info' },
  activa: { texto: 'Activa', tono: 'success' },
  vencida: { texto: 'Vencida', tono: 'warning' },
  cancelada: { texto: 'Cancelada', tono: 'neutral' },
}

export const ESTADO_PAGO: Record<Pago['estado'], { texto: string; tono: Tone }> = {
  registrado: { texto: 'Por confirmar', tono: 'warning' },
  confirmado: { texto: 'Confirmado', tono: 'success' },
  anulado: { texto: 'Anulado', tono: 'neutral' },
}

/** Días que cubre un pago del plan: su duración, o según la periodicidad si el plan no la indica. */
export const diasDeVigencia = (p: Pick<Plan, 'duracionDias' | 'periodicidad'>) => (p.duracionDias > 0 ? p.duracionDias : p.periodicidad === 'anual' ? 365 : 30)

/** Fecha (YYYY-MM-DD) hasta la que cubre un pago confirmado del plan; depende de la periodicidad del plan. */
export const vigenciaDelPago = (pago: Pick<Pago, 'fecha'>, plan: Pick<Plan, 'duracionDias' | 'periodicidad'>) => toISODate(addDays(new Date(pago.fecha), diasDeVigencia(plan)))
