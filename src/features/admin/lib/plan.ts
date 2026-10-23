/*
 * plan.ts — Textos y formatos de la suscripción: montos en RD$, precio y periodicidad del plan (tabla Plan) y
 * estado de la suscripción (Cuenta.Suscripcion_Estado).
 * Módulo: admin (modelo de datos V3.0 · SRS §8.1: la monetización es informativa en el MVP).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { Tone } from '@/components/ui'
import type { EstadoSuscripcion, Plan } from '@/domain/types'

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
