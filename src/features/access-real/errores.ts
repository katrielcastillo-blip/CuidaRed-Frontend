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
  INVITATION_CONFIRM_SIGNUP: 'La persona debe confirmar el correo de su registro. Puede solicitar otro código desde el formulario de registro.',
  OWN_MEMBERSHIP: 'No puedes cambiar ni desactivar tu propia membresía.',
  OWNER_PROTECTED: 'La persona titular de la cuenta debe conservar un rol gestor: no se puede desactivar ni pasar a un rol que no gestione la cuenta.',
  LAST_MANAGER: 'La cuenta debe conservar al menos una persona gestora activa. Nombra a otra antes de hacer este cambio.',
  INVALID_STATE: 'Este cambio ya no es posible en el estado actual de la persona. Actualiza la lista e intenta de nuevo.',
  RATE_LIMITED: 'Hiciste demasiadas invitaciones seguidas. Espera unos minutos e intenta de nuevo.',
  SUBSCRIPTION_INACTIVE: 'La cuenta no tiene una prueba o un plan vigente. Puedes consultar la cuenta y su suscripción.',
  SANDBOX_UNAVAILABLE: 'Los pagos de prueba no están disponibles ahora. Intenta más tarde.',
  CHECKOUT_IN_PROGRESS: 'Ya hay un pago de prueba en curso. Actualiza el estado y retómalo desde la misma oferta.',
  CHECKOUT_EXPIRED: 'La sesión de pago de prueba venció. Actualiza los planes para iniciar un pago nuevo.',
  CHECKOUT_RETRY_LATER: 'No se pudo reabrir este intento de pago. Cuando venza, actualiza los planes e inténtalo de nuevo.',
  SUBSCRIPTION_IN_PROGRESS: 'La cuenta ya tiene una suscripción en curso. Actualiza el estado para consultarla.',
  PLAN_CHANGE_IN_PROGRESS: 'Hay un cambio de plan pendiente de confirmación. Puedes consultarlo al actualizar el estado.',
  PLAN_CHANGE_NOT_ALLOWED: 'La suscripción no permite cambiar de plan en su estado actual.',
  QUOTE_UPDATED: 'La oferta cambió. Revisa el precio y los cupos actualizados antes de continuar.',
  PLAN_CAPACITY_EXCEEDED: 'El número actual de personas registradas supera la capacidad del plan elegido.',
  TRANSFER_CANCELLATION_REQUIRED: 'Programa la cancelación de la renovación en Suscripción y pagos antes de transferir la titularidad.',
  EVIDENCE_REQUIRED: 'La tarea requiere una evidencia validada para completarse.',
  VISIT_CLOSED: 'La visita ya está cerrada.',
  PARTICIPANT_BUSY: 'El responsable ya tiene una visita que coincide con ese horario. Elige otra ventana.',
  VISIT_RECIPIENT_BUSY: 'La persona mayor ya tiene una visita en ese horario. Consulta el calendario y elige otra ventana.',
  VISIT_EVIDENCE_PENDING: 'La coordinación debe revisar las evidencias adjuntas antes de cerrar la visita.',
  VISIT_WINDOW_PASSED: 'El horario de esta visita ya pasó. Reprográmala antes de autorizarla.',
  CAREGIVER_PROFILE_REQUIRED: 'La persona seleccionada necesita un perfil de cuidador vigente. Complétalo en Organización (Configuración en una cuenta familiar) → Perfiles globales de cuidadores o elige a otra persona.',
  REQUEST_ALREADY_REVIEWED: 'Esta solicitud ya fue revisada. Actualiza la bandeja para ver su estado.',

  INVALID_VISIT_SERIES: 'Revisa la frecuencia, los días y la fecha de fin. El máximo es de 60 visitas.',
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
