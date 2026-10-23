/*
 * auditoria.ts — Registro de auditoría: quién hizo qué, sobre qué registro, cuándo y con qué resultado.
 * Módulo: dominio · auditabilidad (SRS §8.2.2.1.3, §8.2.2.3.4 e, §8.2.2.3.5 j).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Se escribe siempre dentro de un mutate() (la entrada viaja con el cambio que la origina). No existe
 * ninguna operación para editar o borrar entradas: solo el administrador puede consultarlas.
 */
import { nombreCompleto } from './nombres'
import type { DB, EntidadAuditada, RegistroAuditoria, ResultadoAuditoria, Usuario } from './types'

/** Tope de entradas guardadas localmente (límite de almacenamiento de la PWA, SRS §9.1.1). */
export const MAX_AUDITORIA = 3000

export type Actor = Usuario | 'sistema' | { anonimo: string }

export interface EntradaAuditoria {
  accion: string
  entidad: EntidadAuditada
  registroId?: string
  resultado?: ResultadoAuditoria
  detalle?: string
  /** Organización afectada si el actor no la determina (procesos del sistema). */
  orgId?: string
}

let secuencia = 0

export function auditar(db: DB, actor: Actor, e: EntradaAuditoria) {
  const registro: RegistroAuditoria = {
    id: `aud-${Date.now().toString(36)}-${(secuencia++).toString(36)}`,
    fecha: new Date().toISOString(),
    usuarioId: actor === 'sistema' ? 'sistema' : 'anonimo' in actor ? 'anonimo' : actor.id,
    usuarioNombre: actor === 'sistema' ? 'Sistema CuidaRed' : 'anonimo' in actor ? actor.anonimo : nombreCompleto(actor),
    rol: actor === 'sistema' ? 'sistema' : 'anonimo' in actor ? 'anonimo' : actor.rol,
    orgId: e.orgId ?? (actor !== 'sistema' && !('anonimo' in actor) ? actor.orgId : undefined),
    accion: e.accion,
    entidad: e.entidad,
    registroId: e.registroId,
    resultado: e.resultado ?? 'exito',
    detalle: e.detalle,
  }
  db.auditoria.unshift(registro)
  if (db.auditoria.length > MAX_AUDITORIA) db.auditoria.length = MAX_AUDITORIA
}

/** Nombres legibles de las acciones auditadas (para la pantalla de auditoría y la exportación). */
export const ACCIONES_AUDITORIA: Record<string, string> = {
  'sesion.iniciar': 'Inicio de sesión',
  'sesion.fallida': 'Inicio de sesión fallido',
  'sesion.bloqueada': 'Cuenta bloqueada temporalmente',
  'sesion.cerrar': 'Cierre de sesión',
  'sesion.expirar': 'Sesión expirada',
  'sesion.recuperar': 'Solicitud de recuperación de contraseña',
  'sesion.restablecer': 'Restablecimiento de contraseña',
  'usuario.crear': 'Creación de usuario',
  'usuario.editar': 'Modificación de usuario',
  'usuario.invitar': 'Reenvío de invitación',
  'usuario.rol': 'Modificación de rol',
  'usuario.desactivar': 'Desactivación de usuario',
  'usuario.reactivar': 'Reactivación de usuario',
  'usuario.eliminar': 'Eliminación de usuario',
  'usuario.password': 'Cambio de contraseña',
  'adulto.crear': 'Creación de perfil',
  'adulto.editar': 'Modificación de perfil',
  'adulto.riesgo': 'Evaluación de riesgo',
  'adulto.desactivar': 'Desactivación de perfil',
  'adulto.reactivar': 'Reactivación de perfil',
  'adulto.asignar': 'Asignación de voluntarios',
  'adulto.anonimizar': 'Anonimización de perfil',
  'adulto.contacto': 'Contacto de emergencia',
  'indicacion.crear': 'Registro de indicación médica',
  'indicacion.editar': 'Modificación de indicación médica',
  'tarea.crear': 'Creación de tarea de agenda',
  'tarea.editar': 'Modificación de tarea de agenda',
  'tarea.estado': 'Cambio de estado de tarea',
  'tarea.evidencia': 'Evidencia de tarea',
  'pago.plan': 'Cambio de plan',
  'pago.registrar': 'Registro de pago',
  'pago.estado': 'Cambio de estado de pago',
  'usuario.cuidador': 'Perfil de cuidador',
  'visita.registrar': 'Registro de visita',
  'visita.programar': 'Programación de visita',
  'visita.iniciar': 'Inicio de visita',
  'visita.cancelar': 'Cancelación de visita',
  'visita.reasignar': 'Reasignación de responsable de visita',
  'necesidad.crear': 'Registro de necesidad',
  'necesidad.estado': 'Cambio de estado de necesidad',
  'necesidad.responsable': 'Asignación de responsable de necesidad',
  'alerta.generar': 'Generación de alerta',
  'alerta.actualizar': 'Actualización automática de alerta',
  'alerta.gestionar': 'Gestión de alerta',
  'alerta.cerrar': 'Cierre automático de alerta',
  'organizacion.configurar': 'Configuración de la organización',
  'sync.registro': 'Sincronización de registro',
  'sync.conflicto': 'Conflicto de sincronización resuelto',
  'sync.error': 'Error de sincronización',
  'acceso.denegado': 'Acceso denegado',
  'datos.exportar': 'Exportación de datos',
}
