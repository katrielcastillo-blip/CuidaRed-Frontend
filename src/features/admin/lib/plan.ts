/*
 * plan.ts — Textos y formatos de la suscripción: montos en RD$, precio y periodicidad del plan (tabla Plan) y
 * estado de la suscripción (Cuenta.Suscripcion_Estado). La implementación vive en `components/plan/formato`
 * (la comparten Suscripción, el aviso de plan y la pantalla de cuenta sin acceso); aquí se re-exporta para el área admin.
 * Módulo: admin (modelo de datos V3.0 · V2 §Plan).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
export { diasDeVigencia, ESTADO_PAGO, ESTADO_SUSCRIPCION, formatoMonto, PERIODICIDAD, precioPlan, vigenciaDelPago } from '@/components/plan/formato'
