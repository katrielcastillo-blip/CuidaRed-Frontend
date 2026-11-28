/*
 * frecuencia.ts — Cálculo del indicador de frecuencia de visitas (CU-06 · RF-05): días desde el último contacto
 * efectivo y su semáforo frente al umbral configurable de la cuenta (parámetro DIAS_SIN_VISITA_ALERTA).
 * Contacto efectivo = solo una visita REALIZADA (estado "completada"); las programadas, en curso o canceladas no
 * cuentan (domain/reglas.ts → ultimaVisitaCompletada). Sin ninguna visita realizada el estado es "inicial"
 * (Atención inicial pendiente) y los días se cuentan desde la creación del perfil.
 * Módulo: gestión (reutilizable por cualquier área).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { diasSinVisita } from '@/domain/reglas'
import type { Adulto, Visita } from '@/domain/types'

/** Estados del semáforo. `inicial` = el adulto aún no recibió ninguna visita realizada. */
export type EstadoFrecuencia = 'al_dia' | 'por_vencer' | 'vencida' | 'inicial'

export interface Frecuencia {
  estado: EstadoFrecuencia
  /** Días calendario desde la última visita realizada (o desde la creación del perfil si no hay ninguna). */
  dias: number
  /** Umbral configurado de la cuenta, en días. */
  umbral: number
  /** Días que faltan para alcanzar el umbral (0 si ya se superó). */
  restantes: number
  /** true si los días superan el umbral (aplica también a «inicial»). */
  superaUmbral: boolean
  /** Fecha de la última visita realizada (o de creación del perfil cuando `inicial`). */
  referencia: string
  /** Proporción del umbral consumida (0 a 1+) para la barra de avance. */
  avance: number
}

/** A partir de qué fracción del umbral el semáforo pasa de verde a ámbar. */
export const FRACCION_AVISO = 0.7

/**
 * Evalúa la frecuencia de visitas del adulto con el umbral de su cuenta.
 * El semáforo es: verde («al día») hasta el 70 % del umbral · ámbar («por vencer») hasta el umbral ·
 * rojo («vencida») cuando se supera, igual que dispara la alerta automática RF-05 (> umbral días).
 */
export function calcularFrecuencia(visitas: Visita[], adulto: Adulto, umbral: number, ahora = new Date()): Frecuencia {
  const { dias, referencia, conVisitas } = diasSinVisita({ visitas }, adulto, ahora)
  const superaUmbral = dias > umbral
  const estado: EstadoFrecuencia = !conVisitas ? 'inicial' : superaUmbral ? 'vencida' : dias >= Math.ceil(umbral * FRACCION_AVISO) ? 'por_vencer' : 'al_dia'
  return { estado, dias, umbral, restantes: Math.max(0, umbral - dias), superaUmbral, referencia, avance: umbral > 0 ? dias / umbral : 1 }
}
