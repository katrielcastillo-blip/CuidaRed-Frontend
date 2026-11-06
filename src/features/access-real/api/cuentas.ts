/*
 * cuentas.ts — Cliente tipado de las cuentas: alta por autorregistro, detalle y suscripción (fase 2, bloque 2b).
 * Módulo: access-real · API.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Contrato: CuidaRed-Backend/docs/contratos/cuentas.md. Los identificadores de cuenta viajan como texto. Las
 * pantallas usan estas funciones y no llaman a `api` directamente; el servidor sigue siendo quien autoriza.
 */
import {
  api,
  type CuentaMe,
  type CurrentUser,
  type EstadoSuscripcion,
  type LimitesPlan,
  type TipoCuenta,
} from '../client'

/** Cuerpo estricto de POST /cuentas: titular, rol, estado, plan y fechas los decide el servidor. */
export interface DatosNuevaCuenta {
  tipo: TipoCuenta
  nombre: string
  categoria_cuenta_id: number
  municipio_cod: string
  direccion?: string
  telefono?: string
  correo?: string
}

/** Uso actual de la cuenta frente a sus límites. */
export interface UsoCuenta {
  envejecientes: number
  usuarios: number
  familiares: number
  voluntarios: number
}

export interface DetalleCuenta {
  cuenta: {
    cuenta_id: string
    nombre: string
    tipo: TipoCuenta
    categoria: { categoria_cuenta_id: number; nombre: string }
    municipio: { municipio_cod: string; nombre: string; provincia_cod: string; provincia: string }
    direccion: string | null
    telefono: string | null
    correo: string | null
    fecha_creacion: string
  }
  contexto: CuentaMe
  uso: UsoCuenta
}

export interface PlanOfertado {
  plan_id: number
  nombre: string
  categoria: string
  precio: number
  periodicidad: string
  duracion_dias: number | null
  resumen: string | null
  limites?: LimitesPlan
  funcionalidades?: string[]
  es_actual?: boolean
}

/** Estado de la prueba gratuita: `dias_restantes` llega a 0 el último día, que todavía es vigente. */
export interface PruebaGratuita {
  gratuita: boolean
  vigente: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  dias_restantes: number
}

export interface Suscripcion {
  estado: EstadoSuscripcion
  acceso_operativo: boolean
  prueba: PruebaGratuita
  plan: PlanOfertado | null
  fecha_fin_vigencia: string | null
  limites: LimitesPlan
  uso: UsoCuenta
  funcionalidades: string[]
  /** Solo si el rol tiene `cuenta:suscripcion`. */
  planes?: PlanOfertado[]
}

const rutaCuenta = (cuentaId: string) => `/cuentas/${encodeURIComponent(cuentaId)}`

/** Contexto de la persona: identidad, perfil y cuentas activas y pendientes (GET /me). */
export const obtenerMe = (token: string) => api<CurrentUser>('/me', token)

/** Alta por autorregistro: el usuario de la sesión queda como titular y la prueba gratuita de 7 días empieza hoy. */
export const crearCuenta = (token: string, datos: DatosNuevaCuenta) => api<CuentaMe>('/cuentas', token, 'POST', datos)

export const obtenerCuenta = (token: string, cuentaId: string) => api<DetalleCuenta>(rutaCuenta(cuentaId), token)

/** Estado de la suscripción; con la cuenta vencida sigue disponible para cualquier miembro activo. */
export async function obtenerSuscripcion(token: string, cuentaId: string): Promise<Suscripcion> {
  const datos = await api<Suscripcion | undefined>(`${rutaCuenta(cuentaId)}/suscripcion`, token)
  if (!datos || typeof datos.estado !== 'string' || typeof datos.prueba !== 'object' || datos.prueba === null) {
    throw new Error('No se pudo interpretar la suscripción.')
  }
  return datos
}
