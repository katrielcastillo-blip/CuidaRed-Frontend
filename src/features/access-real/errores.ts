/*
 * errores.ts — Mensajes claros en español para los códigos públicos de la API de cuentas y miembros (fase 2).
 * Módulo: access-real.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * El servidor responde `{ error: { code } }` con códigos de lista cerrada (CR-162). Aquí se traducen a textos que
 * dicen qué pasó y qué hacer, sin detalles técnicos ni datos de otra persona. Lo que no se reconoce cae en el mensaje
 * genérico por estado que ya arma `client.ts`.
 */
import { ApiError } from './client'

const POR_CODIGO: Record<string, string> = {
  // Alta de cuenta
  INVALID_CATEGORY: 'La categoría elegida no corresponde al tipo de cuenta. Elige otra de la lista.',
  TRIAL_IN_PROGRESS: 'Ya tienes una cuenta con prueba gratuita vigente. Podrás abrir otra cuando termine.',
  // Invitaciones y miembros
  PLAN_LIMIT_REACHED: 'Se alcanzó el límite de personas del plan de la cuenta. Libera un cupo (desactiva a alguien) o amplía el plan.',
  ROLE_NOT_ALLOWED: 'Ese rol no está disponible para este tipo de cuenta. Elige otro.',
  INVITATIONS_UNAVAILABLE:
    'Todavía no se pueden invitar personas nuevas. Puedes invitar a alguien que ya tenga un perfil en CuidaRed.',
  IDENTITY_MISMATCH: 'No se pudo invitar a esa persona con esos datos. Revisa el correo y la cédula.',
  ALREADY_MEMBER: 'Esa persona ya tiene una membresía vigente en la cuenta.',
  INVITATION_CONFLICT: 'No se pudo crear la invitación con esos datos. Revisa el correo y la cédula.',
  OWN_MEMBERSHIP: 'No puedes cambiar ni desactivar tu propia membresía.',
  OWNER_PROTECTED: 'La persona titular de la cuenta debe conservar un rol gestor: no se puede desactivar ni pasar a un rol que no gestione la cuenta.',
  LAST_MANAGER: 'La cuenta debe conservar al menos una persona gestora activa. Nombra a otra antes de hacer este cambio.',
  INVALID_STATE: 'Este cambio ya no es posible en el estado actual de la persona. Actualiza la lista e intenta de nuevo.',
  RATE_LIMITED: 'Hiciste demasiadas invitaciones seguidas. Espera unos minutos e intenta de nuevo.',
  SUBSCRIPTION_INACTIVE: 'La cuenta no tiene una prueba o un plan vigente. Puedes consultar la cuenta y su suscripción.',
  EVIDENCE_REQUIRED: 'La tarea requiere una evidencia validada para completarse.',
  VISIT_CLOSED: 'La visita ya está cerrada.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción en esta cuenta.',
}

/** Mensaje para mostrar al usuario ante cualquier fallo de la API; nunca el texto técnico del proveedor. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    const propio = error.code ? POR_CODIGO[error.code] : undefined
    if (propio) return propio
    // `client.ts` arma el 409 pensando en el perfil; en cuentas y miembros es un conflicto de estado.
    if (error.status === 409) return 'La operación no se pudo completar porque entra en conflicto con los datos actuales. Actualiza e intenta de nuevo.'
    return error.message
  }
  return 'No se pudo completar la operación. Revisa tu conexión e intenta de nuevo.'
}
