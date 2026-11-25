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
  tipoVisita?: 'personal' | 'institucional'
  entidadVisitante?: string
  tipoEntidad?: string
  cantidadVisitantes?: string
  aportePrevisto?: string
  orgId: string
  nombres: string
  apellidos: string
  cedula: string
  telefono: string
  correo: string
  personaAVisitar: string
  fechaPropuesta: string
  horaPropuesta: string
  horaFinPropuesta?: string
  motivo: string
}

export const SOLICITUD_INICIAL: DatosSolicitud = {
  tipoVisita: 'personal',
  entidadVisitante: '',
  tipoEntidad: '',
  cantidadVisitantes: '1',
  aportePrevisto: '',
  orgId: '',
  nombres: '',
  apellidos: '',
  cedula: '',
  telefono: '',
  correo: '',
  personaAVisitar: '',
  fechaPropuesta: '',
  horaPropuesta: '',
  horaFinPropuesta: '',
  motivo: '',
}

/** Campos de cada paso (para volver al paso con errores si el servicio los rechaza). */
export const CAMPOS_SOLICITUD_PASO: Record<1 | 2 | 3, Array<keyof DatosSolicitud>> = {
  1: ['orgId', 'nombres', 'apellidos', 'cedula', 'telefono', 'correo'],
  2: ['tipoVisita', 'entidadVisitante', 'tipoEntidad', 'cantidadVisitantes', 'aportePrevisto', 'personaAVisitar'],
  3: ['fechaPropuesta', 'horaPropuesta', 'horaFinPropuesta', 'motivo'],
}

export const TIPOS_ENTIDAD_VISITANTE = [
  { value: 'fundacion', label: 'Fundación' },
  { value: 'iglesia', label: 'Iglesia o comunidad religiosa' },
  { value: 'universidad', label: 'Universidad' },
  { value: 'centro_educativo', label: 'Centro educativo' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'grupo_comunitario', label: 'Grupo comunitario' },
  { value: 'otro', label: 'Otra institución o grupo' },
]

/** Paso 1: organización y datos del visitante (5 campos de texto como máximo por pantalla). */
export function validarPasoVisitante(d: DatosSolicitud): ErroresSolicitud {
  return {
    orgId: d.orgId ? undefined : 'Elige la organización que quieres visitar.',
    nombres: errorNombre(d.nombres, 'nombre'),
    apellidos: errorNombre(d.apellidos, 'apellido'),
    cedula: errorCedula(d.cedula),
    telefono: errorTelefono(d.telefono),
    correo: d.correo.trim() ? errorEmail(d.correo) : 'Escribe el correo donde recibirás el seguimiento de tu visita.',
  }
}

export function validarPasoDestino(d: DatosSolicitud): ErroresSolicitud {
  return {
    tipoVisita: !d.tipoVisita || ['personal', 'institucional'].includes(d.tipoVisita) ? undefined : 'Elige un tipo de visita.',
    personaAVisitar: d.tipoVisita === 'institucional' ? undefined : errorTexto(d.personaAVisitar, 'el nombre de la persona que quieres visitar', 3, 120),
    entidadVisitante: d.tipoVisita === 'institucional' ? errorTexto(d.entidadVisitante ?? '', 'el nombre de la institución o grupo', 2, 160) : undefined,
    tipoEntidad: d.tipoVisita === 'institucional' && !TIPOS_ENTIDAD_VISITANTE.some(({ value }) => value === d.tipoEntidad) ? 'Elige el tipo de institución o grupo.' : undefined,
    cantidadVisitantes: /^[1-9]\d*$/.test(d.cantidadVisitantes ?? '1') && Number(d.cantidadVisitantes ?? 1) <= 2147483647 ? undefined : 'Indica un número entero de visitantes, mayor que cero.',
    aportePrevisto: (d.aportePrevisto?.trim().length ?? 0) > 300 ? 'Describe el aporte en un máximo de 300 caracteres.' : undefined,
  }
}

/** Verificación del destino y de la propuesta antes del envío. */
export function validarPasoVisita(d: DatosSolicitud, acepto: boolean): ErroresSolicitud {
  let fecha: string | undefined
  if (!fechaValida(d.fechaPropuesta)) fecha = 'Indica una fecha válida.'
  else if (d.fechaPropuesta < todayISO()) fecha = 'La fecha no puede ser anterior a hoy.'
  return {
    ...validarPasoDestino(d),
    fechaPropuesta: fecha,
    horaPropuesta: /^\d{2}:\d{2}$/.test(d.horaPropuesta) ? undefined : 'Indica la hora.',
    horaFinPropuesta: !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.horaFinPropuesta ?? '') ? 'Indica la hora de fin.' : d.horaFinPropuesta! <= d.horaPropuesta ? 'La hora de fin debe ser posterior al inicio.' : undefined,
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
