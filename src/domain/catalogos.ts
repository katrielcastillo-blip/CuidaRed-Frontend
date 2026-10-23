/*
 * catalogos.ts — Listas predefinidas del dominio (RF-06: captura con campos predefinidos, listas y casillas).
 * Módulo: dominio.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { Autonomia, EstadoAlerta, EstadoNecesidad, Rol, TipoAlerta, TipoNecesidad } from './types'

export interface Opcion<T extends string = string> {
  value: T
  label: string
}

export const ROLES: Array<Opcion<Rol>> = [
  { value: 'admin', label: 'Administrador' },
  { value: 'coordinador', label: 'Coordinador' },
  { value: 'voluntario', label: 'Voluntario' },
  { value: 'familiar', label: 'Familiar responsable' },
]

export const AUTONOMIAS: Array<Opcion<Autonomia>> = [
  { value: 'independiente', label: 'Independiente' },
  { value: 'parcial', label: 'Necesita ayuda parcial' },
  { value: 'dependiente', label: 'Dependiente' },
]

/**
 * Condición general: situaciones de salud y sociales relevantes para el seguimiento comunitario.
 * Son categorías amplias, no diagnósticos (minimización de datos de salud · Ley 42-01).
 */
export const CONDICIONES: Opcion[] = [
  { value: 'cronica', label: 'Enfermedad crónica' },
  { value: 'movilidad', label: 'Movilidad reducida' },
  { value: 'cognitivo', label: 'Deterioro de memoria' },
  { value: 'sensorial', label: 'Dificultad visual o auditiva' },
  { value: 'vive_solo', label: 'Vive solo/a' },
  { value: 'sin_ingresos', label: 'Sin ingresos fijos' },
  { value: 'vivienda', label: 'Vivienda precaria' },
  { value: 'aislamiento', label: 'Aislamiento social' },
]

/** Aspectos verificados en una visita comunitaria (checklist de CU-05). */
export const ASPECTOS_VISITA: Opcion[] = [
  { value: 'alimentacion', label: 'Alimentación adecuada' },
  { value: 'medicamentos', label: 'Toma de medicamentos' },
  { value: 'higiene', label: 'Higiene personal' },
  { value: 'vivienda', label: 'Condiciones de la vivienda' },
  { value: 'animo', label: 'Estado de ánimo' },
  { value: 'movilidad', label: 'Movilidad y caídas' },
]

export const TIPOS_NECESIDAD_TEXTO: Record<TipoNecesidad, string> = {
  medicamentos: 'Medicamentos',
  alimentacion: 'Alimentación',
  transporte: 'Transporte',
  compania: 'Compañía',
  otros: 'Otros apoyos',
}

export const ESTADOS_NECESIDAD: Array<Opcion<EstadoNecesidad>> = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'satisfecha', label: 'Satisfecha' },
  { value: 'inactiva', label: 'Inactiva' },
]

export const ESTADOS_ALERTA: Array<Opcion<EstadoAlerta>> = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_atencion', label: 'En atención' },
  { value: 'atendida', label: 'Atendida' },
]

export const TIPOS_ALERTA_TEXTO: Record<TipoAlerta, string> = {
  prioritaria: 'Caso prioritario',
  seguimiento: 'Seguimiento familiar',
  emergencia: 'Emergencia',
  necesidad: 'Necesidad',
}

/**
 * Abreviaturas aceptadas en las observaciones (RF-06 "soporte de abreviaturas"). Se expanden al escribir
 * un espacio o signo de puntuación después de ellas. Clave en minúsculas.
 */
export const ABREVIATURAS: Record<string, string> = {
  pa: 'presión arterial',
  hta: 'hipertensión',
  meds: 'medicamentos',
  med: 'medicamento',
  alim: 'alimentación',
  fam: 'familiar',
  flia: 'familia',
  tto: 'tratamiento',
  aprox: 'aproximadamente',
  sem: 'semana',
  hrs: 'horas',
  xq: 'porque',
  tb: 'también',
  q: 'que',
  sn: 'sin novedad',
  ok: 'en buen estado',
}
