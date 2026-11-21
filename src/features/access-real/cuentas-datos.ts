/*
 * cuentas-datos.ts — Textos y reglas de presentación de cuentas, roles y suscripción del acceso conectado.
 * Módulo: access-real.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Todo es informativo para la interfaz: el servidor valida roles, permisos y estado en cada petición (CR-162).
 */
import type { CuentaMe, EstadoSuscripcion, RolCuenta, TipoCuenta } from './client'

export const ROL_TEXTO: Record<RolCuenta, string> = {
  administrador: 'Administrador',
  coordinador: 'Coordinador',
  cuidador: 'Cuidador',
  familiar: 'Familiar responsable',
  voluntario: 'Voluntario',
}

export const TIPO_TEXTO: Record<TipoCuenta, string> = { familia: 'Familia', organizacion: 'Organización' }

const ROLES_POR_TIPO: Record<TipoCuenta, RolCuenta[]> = {
  familia: ['coordinador', 'cuidador', 'familiar'],
  organizacion: ['administrador', 'coordinador', 'cuidador', 'familiar', 'voluntario'],
}
/** Roles que existen en cada tipo de cuenta (misma matriz que el servidor, que vuelve a validarla). */
export const rolesDelTipo = (tipo: TipoCuenta): RolCuenta[] => ROLES_POR_TIPO[tipo]

const SUSCRIPCION_TEXTO: Record<EstadoSuscripcion, string> = {
  prueba: 'Prueba gratuita',
  activa: 'Plan activo',
  vencida: 'Sin plan activo',
  cancelada: 'Cancelada',
  suspendida: 'Suspendida',
}
export const suscripcionTexto = (estado: CuentaMe['estado_suscripcion']) => (estado ? SUSCRIPCION_TEXTO[estado] : 'Sin suscripción')

/** La gestión de miembros exige `usuarios:gestionar` en la cuenta activa (Coordinador en Familia, Administrador en Organización). */
export const puedeGestionarMiembros = (cuenta: CuentaMe | undefined) =>
  cuenta?.acceso_operativo === true && cuenta.permisos.includes('usuarios:gestionar')

/**
 * Quién recibe avisos internos de alertas. Espejo de `trg_alerta_avisar` (fase 6b, migración CUIDARED-009): solo las
 * personas con membresía vigente de Coordinador (cuenta Familia u Organización) o de Administrador (solo Organización)
 * con alcance sobre el adulto. El Cuidador consulta y resuelve alertas, pero no recibe avisos.
 */
export const recibeAvisosDeAlertas = (cuenta: Pick<CuentaMe, 'rol' | 'tipo'>) =>
  cuenta.rol === 'coordinador' || (cuenta.tipo === 'organizacion' && cuenta.rol === 'administrador')
