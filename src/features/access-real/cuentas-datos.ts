/*
 * cuentas-datos.ts — Textos y reglas de presentación de cuentas, roles y suscripción del acceso conectado.
 * Módulo: access-real.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Todo es informativo para la interfaz: el servidor valida roles, permisos y estado en cada petición (CR-162).
 */
import type { CuentaMe, CurrentUser, EstadoSuscripcion, RolCuenta, TipoCuenta } from './client'

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

/** Invitaciones pendientes de aceptar: no dan acceso ni permisos hasta que la persona las acepta. */
export const pendientesDe = (user: CurrentUser | null): CuentaMe[] =>
  (user?.cuentas ?? []).filter((c) => c.estado_membresia === 'pendiente' && !!c.membresia_id)

/** La gestión de miembros exige `usuarios:gestionar` en la cuenta activa (Coordinador en Familia, Administrador en Organización). */
export const puedeGestionarMiembros = (cuenta: CuentaMe | undefined) => !!cuenta?.permisos.includes('usuarios:gestionar')
