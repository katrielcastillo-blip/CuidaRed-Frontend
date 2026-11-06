/*
 * planes.ts — Tipos de cuenta, planes, prueba gratuita y control de funcionalidades por plan (feature gating).
 * Módulo: dominio · suscripción (Reglas de Negocio V2 §Cuenta, §Plan, §Ciclo de vida de una suscripción).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Funciones puras (sin React ni store) para poder usarlas en permisos.ts y en la capa de servicios. Los hooks
 * equivalentes están en usePlan.ts.
 *
 * Decisiones vigentes:
 *  - Una cuenta es Familia u Organización; cada plan aplica a un único tipo de cuenta.
 *  - La prueba gratuita se maneja en la Cuenta (no es un plan), se usa una sola vez y dura 14 días
 *    (feedback de PM sobre LOGIN SCREEN, 2026-11). Durante la prueba la cuenta tiene funciones limitadas.
 *  - Al vencer la prueba sin un pago registrado, la cuenta queda sin acceso operativo hasta contratar un plan.
 */
import { diasCalendario, todayISO } from './dates'
import type { Catalogos, Funcionalidad, Organizacion, Plan, Rol } from './types'

export type TipoCuenta = 'familia' | 'organizacion'

/** Ids estables del catálogo TipoCuenta. */
export const TIPO_CUENTA_ID: Record<TipoCuenta, string> = { familia: 'tc-familia', organizacion: 'tc-organizacion' }

export const TIPO_CUENTA_LABEL: Record<TipoCuenta, string> = { familia: 'Familia', organizacion: 'Organización' }

/** Duración de la prueba gratuita (una sola vez por cuenta). */
export const DIAS_PRUEBA_GRATUITA = 14

/** Roles permitidos por tipo de cuenta (V2 §Cuenta). */
export const ROLES_POR_TIPO_CUENTA: Record<TipoCuenta, readonly Rol[]> = {
  familia: ['coordinador', 'cuidador', 'familiar'],
  organizacion: ['admin', 'coordinador', 'cuidador', 'familiar', 'voluntario'],
}

/** Nombre legible de cada funcionalidad (para avisos de "no incluido en tu plan"). */
export const ETIQUETA_FUNCIONALIDAD: Record<Funcionalidad, string> = {
  registro_visitas: 'Registro de visitas',
  necesidades_diarias: 'Gestión de necesidades',
  visitas_recurrentes: 'Visitas recurrentes',
  tablon_notificaciones: 'Tablón de notificaciones',
  alertas_tiempo_real: 'Alertas críticas en tiempo real',
  historial_inmutable: 'Historial inmutable',
  dashboard_metricas: 'Dashboard de métricas',
  riesgo_completo: 'Clasificación de riesgo completa',
  org_necesidad: 'Necesidades institucionales',
  reportes_avanzados: 'Reportes avanzados',
}

export interface LimitesCuenta {
  envejecientes: number | null
  usuarios: number | null
  familiares: number | null
}

/**
 * Alcance de la prueba gratuita por tipo de cuenta. Propuesta del equipo de front (la PM pidió acotarla: "50
 * adultos mayores es mucho"): Familia prueba lo esencial del Básico Familiar; Organización, una operación pequeña.
 */
export const PRUEBA_GRATUITA: Record<TipoCuenta, { limites: LimitesCuenta; funcionalidades: Funcionalidad[] }> = {
  familia: {
    limites: { envejecientes: 2, usuarios: 4, familiares: 2 },
    funcionalidades: ['registro_visitas', 'necesidades_diarias'],
  },
  organizacion: {
    limites: { envejecientes: 5, usuarios: 5, familiares: null },
    funcionalidades: ['registro_visitas', 'necesidades_diarias', 'tablon_notificaciones', 'dashboard_metricas'],
  },
}

export function tipoDeCuenta(org: Pick<Organizacion, 'tipoCuentaId'> | null | undefined): TipoCuenta {
  return org?.tipoCuentaId === TIPO_CUENTA_ID.familia ? 'familia' : 'organizacion'
}

export const planDeCuenta = (cat: Pick<Catalogos, 'planes'>, org: Pick<Organizacion, 'planId'> | null | undefined): Plan | undefined =>
  org?.planId ? cat.planes.find((p) => p.id === org.planId) : undefined

/** Planes que puede contratar una cuenta según su tipo (V2: un plan familiar no se contrata desde una Organización). */
export const planesCompatibles = (cat: Pick<Catalogos, 'planes'>, org: Pick<Organizacion, 'tipoCuentaId'> | null | undefined) =>
  cat.planes.filter((p) => p.estado === 'activo' && p.tipoCuentaId === TIPO_CUENTA_ID[tipoDeCuenta(org)])

/** ¿La cuenta está en su prueba gratuita vigente? */
export function enPruebaVigente(org: Pick<Organizacion, 'suscripcionEstado' | 'fechaFinPrueba'> | null | undefined, hoy = todayISO()): boolean {
  return !!org && org.suscripcionEstado === 'prueba' && !!org.fechaFinPrueba && org.fechaFinPrueba >= hoy
}

/** Días que le quedan a la prueba (0 si venció o no está en prueba). */
export function diasRestantesPrueba(org: Pick<Organizacion, 'suscripcionEstado' | 'fechaFinPrueba'> | null | undefined, hoy = todayISO()): number {
  if (!org || org.suscripcionEstado !== 'prueba' || !org.fechaFinPrueba) return 0
  return Math.max(0, diasCalendario(hoy, org.fechaFinPrueba))
}

/** La prueba está por terminar: se muestra la invitación a elegir plan (no antes, para no mostrar precios de entrada). */
export const pruebaPorTerminar = (org: Parameters<typeof diasRestantesPrueba>[0], hoy = todayISO()) =>
  enPruebaVigente(org, hoy) && diasRestantesPrueba(org, hoy) <= 3

/** Acceso operativo: suscripción activa o prueba vigente (V2: sin pago tras la prueba, la cuenta queda sin acceso). */
export function tieneAccesoOperativo(org: Pick<Organizacion, 'suscripcionEstado' | 'fechaFinPrueba'> | null | undefined, hoy = todayISO()): boolean {
  if (!org) return false
  return org.suscripcionEstado === 'activa' || enPruebaVigente(org, hoy)
}

/** Funcionalidades efectivas de la cuenta (plan activo, o las de la prueba). */
export function funcionalidadesDeCuenta(
  cat: Pick<Catalogos, 'planes'>,
  org: Pick<Organizacion, 'tipoCuentaId' | 'planId' | 'suscripcionEstado' | 'fechaFinPrueba'> | null | undefined,
  hoy = todayISO(),
): Funcionalidad[] {
  if (!org) return []
  if (org.suscripcionEstado === 'activa') return planDeCuenta(cat, org)?.funcionalidades ?? []
  if (enPruebaVigente(org, hoy)) return PRUEBA_GRATUITA[tipoDeCuenta(org)].funcionalidades
  return []
}

export function cuentaTieneFuncionalidad(
  cat: Pick<Catalogos, 'planes'>,
  org: Parameters<typeof funcionalidadesDeCuenta>[1],
  f: Funcionalidad,
  hoy = todayISO(),
): boolean {
  return funcionalidadesDeCuenta(cat, org, hoy).includes(f)
}

/** Límites efectivos (del plan activo o de la prueba). */
export function limitesDeCuenta(cat: Pick<Catalogos, 'planes'>, org: Parameters<typeof funcionalidadesDeCuenta>[1]): LimitesCuenta {
  if (!org) return { envejecientes: 0, usuarios: 0, familiares: 0 }
  if (org.suscripcionEstado === 'activa') {
    const p = planDeCuenta(cat, org)
    return { envejecientes: p?.limiteEnvejecientes ?? null, usuarios: p?.limiteUsuarios ?? null, familiares: p?.limiteFamiliares ?? null }
  }
  return PRUEBA_GRATUITA[tipoDeCuenta(org)].limites
}

/** Plan más económico (del tipo de la cuenta) que incluye la funcionalidad: para el aviso de "disponible en…". */
export function planQueIncluye(cat: Pick<Catalogos, 'planes'>, org: Pick<Organizacion, 'tipoCuentaId'> | null | undefined, f: Funcionalidad): Plan | undefined {
  return planesCompatibles(cat, org)
    .filter((p) => p.funcionalidades.includes(f))
    .sort((a, b) => a.precio - b.precio)[0]
}

/** "Ilimitado" o el número. */
export const textoLimite = (n: number | null | undefined) => (n == null ? 'Ilimitado' : String(n))

/** ¿Se superó el límite? (null = ilimitado). */
export const excedeLimite = (usado: number, limite: number | null | undefined) => limite != null && usado > limite
