/*
 * solicitudVisita.ts — Validación por pasos del formulario público "Solicitar una visita" y utilidades del
 * código de seguimiento. Funciones puras, sin store: las usa tanto el modo prototipo como el conectado.
 * Módulo: auth (Reglas de Negocio V2 §Visita · feedback de PM sobre LOGIN SCREEN).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * La capa de servicios (domain/api/solicitudes.ts → crearSolicitudVisita) vuelve a validar todo antes de guardar:
 * aquí solo se valida cada pantalla para que la persona corrija sin perder lo escrito.
 */
import { todayISO } from '@/domain/dates'
import { errorCedula, errorEmail, errorNombre, errorTelefono, errorTexto, fechaValida, hayErrores } from '@/domain/validacion'

export type ErroresSolicitud = Record<string, string | undefined>

/** Campos del formulario (los mismos que DatosSolicitudVisita de domain/api/solicitudes). */
export interface DatosSolicitud {
  orgId: string
  nombres: string
  apellidos: string
  cedula: string
  telefono: string
  correo: string
  personaAVisitar: string
  fechaPropuesta: string
  horaPropuesta: string
  motivo: string
}

export const SOLICITUD_INICIAL: DatosSolicitud = {
  orgId: '',
  nombres: '',
  apellidos: '',
  cedula: '',
  telefono: '',
  correo: '',
  personaAVisitar: '',
  fechaPropuesta: '',
  horaPropuesta: '',
  motivo: '',
}

/** Campos de cada paso (para volver al paso con errores si el servicio los rechaza). */
export const CAMPOS_SOLICITUD_PASO: Record<1 | 2, Array<keyof DatosSolicitud>> = {
  1: ['orgId', 'nombres', 'apellidos', 'cedula', 'telefono', 'correo'],
  2: ['personaAVisitar', 'fechaPropuesta', 'horaPropuesta', 'motivo'],
}

/** Paso 1: organización y datos del visitante (5 campos de texto como máximo por pantalla). */
export function validarPasoVisitante(d: DatosSolicitud): ErroresSolicitud {
  return {
    orgId: d.orgId ? undefined : 'Elige la organización que quieres visitar.',
    nombres: errorNombre(d.nombres, 'nombre'),
    apellidos: errorNombre(d.apellidos, 'apellido'),
    cedula: errorCedula(d.cedula),
    telefono: errorTelefono(d.telefono),
    correo: d.correo.trim() ? errorEmail(d.correo) : undefined,
  }
}

/** Paso 2: a quién quiere visitar, cuándo y por qué. */
export function validarPasoVisita(d: DatosSolicitud, acepto: boolean): ErroresSolicitud {
  let fecha: string | undefined
  if (!fechaValida(d.fechaPropuesta)) fecha = 'Indica una fecha válida.'
  else if (d.fechaPropuesta < todayISO()) fecha = 'La fecha no puede ser anterior a hoy.'
  return {
    personaAVisitar: errorTexto(d.personaAVisitar, 'el nombre de la persona que quieres visitar', 3, 120),
    fechaPropuesta: fecha,
    horaPropuesta: /^\d{2}:\d{2}$/.test(d.horaPropuesta) ? undefined : 'Indica la hora.',
    motivo: errorTexto(d.motivo, 'el motivo de la visita', 3, 300),
    acepto: acepto ? undefined : 'Debes aceptar la Política de Privacidad para enviar la solicitud.',
  }
}

export { hayErrores }

/** El código de seguimiento se escribe en mayúsculas y sin espacios (el servicio también lo normaliza). */
export const normalizarCodigoEscrito = (v: string) => v.toUpperCase().replace(/\s+/g, '')

/** Formato del código: "VIS-7K2M-Q9TX". */
export const CODIGO_VALIDO = /^VIS-[A-Z0-9]{4}-[A-Z0-9]{4}$/

export function errorCodigoSeguimiento(v: string): string | undefined {
  const c = normalizarCodigoEscrito(v.trim())
  if (!c) return 'Escribe el código de seguimiento que recibiste.'
  if (!CODIGO_VALIDO.test(c)) return 'El código tiene el formato VIS-XXXX-XXXX. Revisa que esté completo.'
  return undefined
}
