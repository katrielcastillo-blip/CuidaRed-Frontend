/*
 * suscripcion.ts — Contrato conectado de suscripción y pagos en Stripe Sandbox.
 * Módulo: access-real · ID08, RF-20.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { api, type EstadoSuscripcion, type LimitesPlan } from '../client'

type Periodicidad = 'mensual' | 'anual'
export type ModoCambioPlan = 'inmediato' | 'proximo_corte'
export type LimitesCotizacion = LimitesPlan & { cuidadores: number | null }

export interface PlanCatalogoSuscripcion {
  codigo: string
  nombre: string
  limites: LimitesPlan & { cuidadores: number | null }
  funcionalidades: string[]
  precios_referencia: Record<Periodicidad, number> | null
  cotizado?: boolean
}

export interface OfertaSuscripcion {
  codigo: string
  nombre: string
  periodicidad: Periodicidad
  importe_centavos: number
  moneda: string
  limites: LimitesPlan & { cuidadores?: number | null }
  funcionalidades: string[]
  actual: boolean
  version?: string | null
  en_curso?: boolean
  publicada?: boolean
}

export interface GestionSuscripcion {
  sandbox: true
  pagos_disponibles: boolean
  es_titular: boolean
  estado: EstadoSuscripcion
  acceso_operativo: boolean
  vigencia_hasta: string | null
  cancelacion_programada: boolean
  suscripcion_stripe: boolean
  puede_modificar: boolean
  checkout_en_curso: string | null
  cambio_en_curso: { codigo: string; modo: ModoCambioPlan; efectivo_en: string | null } | null
  ofertas: OfertaSuscripcion[]
}

export interface PagoSuscripcion {
  pago_id: string
  plan: string
  periodicidad: Periodicidad
  importe_centavos: number
  moneda: string
  estado: 'pendiente' | 'completado' | 'fallido' | 'reembolsado'
  fecha: string
  importe_reembolsado_centavos: number
}

export interface CotizacionSuscripcion {
  codigo: string
  nombre: string
  periodicidad: Periodicidad
  estado: 'sin_cotizar' | 'solicitada' | 'cotizada'
  importe_centavos: number | null
  moneda: 'USD'
  cuidadores: number
  envejecientes: number
  limites?: LimitesCotizacion | null
  version?: string | null
}

export const rutaSuscripcion = (base: string) => `${base}/suscripcion`

function destinoStripe(destino: string, host: 'checkout.stripe.com' | 'invoice.stripe.com') {
  const url = new URL(destino)
  if (url.origin !== `https://${host}` || url.username || url.password) {
    throw new Error('La dirección del pago de prueba no es válida.')
  }
  return url.href
}

export async function iniciarCheckoutSuscripcion(base: string, token: string, oferta: string, version?: string | null) {
  const datos = await api<{ url: string }>(`${rutaSuscripcion(base)}/checkout`, token, 'POST', { oferta, ...(version ? { version } : {}) })
  return destinoStripe(datos.url, 'checkout.stripe.com')
}

export async function cambiarPlan(base: string, token: string, oferta: string, version?: string | null) {
  const datos = await api<{ url: string | null; modo: ModoCambioPlan }>(`${rutaSuscripcion(base)}/cambio-plan`, token, 'POST', { oferta, ...(version ? { version } : {}) })
  return { ...datos, url: datos.url === null ? null : destinoStripe(datos.url, 'invoice.stripe.com') }
}

export const cancelarRenovacion = (base: string, token: string) =>
  api<void>(`${rutaSuscripcion(base)}/cancelacion`, token, 'POST')

export const solicitarCotizacion = (base: string, token: string, codigo: string) =>
  api<unknown>(`${rutaSuscripcion(base)}/cotizaciones`, token, 'POST', { codigo })
