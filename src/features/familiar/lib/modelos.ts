/*
 * modelos.ts — Modelos de vista del Portal Familiar (solo lectura): lo ÚNICO que consumen las pantallas.
 * Hoy los llenan los hooks de `datos.ts` leyendo el store local; mañana los llenará la API (DTO de
 * `contrato-api.ts`, tabla de equivalencias en docs/CONTRATO-PORTAL-FAMILIAR.md). Las pantallas no importan
 * `@/domain/store` ni los tipos Adulto/Visita/Necesidad: así el cambio de origen no las toca.
 * Regla de privacidad: aquí NO existen campos de riesgo, condición general, consentimiento ni datos del
 * visitante externo salvo su nombre (el Familiar no tiene `adultos:ver-sensible`).
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { EstadoAdultoVisita, EstadoNecesidad, EstadoVisita, Prioridad, TipoNecesidad } from '@/domain/types'

export type EstadoIndicacion = 'vigente' | 'suspendida' | 'finalizada'

/* ───────────── Estado de una consulta (preparado para red) ───────────── */

/** Una consulta que no se puede mostrar. `no_encontrado` cubre "no existe" y "sin permiso" sin distinguirlos. */
export type ConsultaPendiente =
  | { estado: 'cargando' }
  | { estado: 'error'; tipo: 'no_encontrado' | 'fallo'; mensaje: string }

/** Resultado de un hook de datos: cargando, con error o con datos. Hoy siempre es inmediata; con la API no. */
export type Consulta<T> = ConsultaPendiente | { estado: 'listo'; datos: T }

/* ───────────── Visitas ───────────── */

export interface VisitaResumenVista {
  id: string
  fecha: string // YYYY-MM-DD
  horaPautada: string // HH:MM
  /** ISO: inicio real, si la visita ya empezó. */
  inicio?: string
  estado: EstadoVisita
  /** Motivo de la visita ('' si no se indicó). */
  razon: string
  tipo: string
  /** Nombre de quien la hizo o la tiene asignada; en una visita de visitante externo, quien la autorizó. */
  responsable: string
  /** Nombre del visitante externo autorizado (solo el nombre). */
  visitante?: string
  /** La visita también atendió a otros adultos del hogar. */
  compartida: boolean
  /** Cómo encontraron a ESTE adulto (solo visitas realizadas; ausente en visitas históricas sin estado por adulto). */
  estadoAdulto?: EstadoAdultoVisita
  /** Observación registrada PARA este adulto (solo visitas realizadas). */
  observacion?: string
  /** Registro guardado en el dispositivo que aún espera sincronizar (RF-10). */
  pendienteSync?: boolean
}

export interface EvidenciaVista {
  clave: string
  nombre: string
  /** URL o data URL de la imagen, si la evidencia es una imagen. */
  imagen?: string
}

export interface VisitaDetalleVista extends VisitaResumenVista {
  /** Adulto desde cuyo punto de vista se muestra la visita. */
  adulto: { id: string; nombre: string; nombres: string }
  /** El adulto es el principal de la visita: solo entonces se informan las evidencias (el estado se informa para cada adulto). */
  esPrincipal: boolean
  fin?: string
  /** Valores del catálogo de aspectos verificados (ASPECTOS_VISITA). */
  checklist: string[]
  /** Indicaciones para la visita. Vacío en visitas de visitante externo (podrían incluir sus datos personales). */
  notas?: string
  evidencias: EvidenciaVista[]
  /** Otros adultos de la visita que la familia también está autorizada a consultar. */
  otrosAutorizados: Array<{ id: string; nombre: string }>
  /** Cuántos adultos más recibieron la visita sin que la familia pueda consultarlos (solo la cantidad). */
  otrosSinAcceso: number
}

/* ───────────── Necesidades ───────────── */

export interface NecesidadVista {
  id: string
  /** Nombre del catálogo de necesidades ("Acompañamiento"), si lo tiene. */
  nombre?: string
  tipo: TipoNecesidad
  descripcion: string
  cantidad?: number
  unidad?: string
  recurrente: boolean
  prioridad: Prioridad
  estado: EstadoNecesidad
  /** ISO UTC. */
  creadaEn: string
  /** ISO UTC. */
  resueltaEn?: string
  motivoResolucion?: string
  pendienteSync?: boolean
}

export interface NecesidadDetalleVista extends NecesidadVista {
  adulto: { id: string; nombre: string }
  registradaPor: string
  resueltaPor?: string
  /** Persona a cargo de gestionarla (si no hay, la cuenta). */
  responsable?: string
  /** Cambios de estado, del más reciente al más antiguo. */
  historial: Array<{ estado: EstadoNecesidad; fecha: string; por: string; nota?: string }>
  /** Indicación médica relacionada; solo si la familia puede consultar indicaciones. */
  indicacion?: { id: string; titulo: string }
}

/* ───────────── Indicaciones médicas ───────────── */

export interface IndicacionVista {
  id: string
  /** Tipo de indicación ("Medicamento", "Dieta"…). */
  tipo: string
  titulo: string
  descripcion: string
  frecuenciaHorario: string
  fechaInicio: string // YYYY-MM-DD
  fechaFin?: string // YYYY-MM-DD
  estado: EstadoIndicacion
  /** Nombre del documento de respaldo (receta). */
  respaldo?: string
}

/* ───────────── Envejecientes ───────────── */

/** Estado del seguimiento de un adulto mayor (RF-05) que comparten la tarjeta y el perfil. */
export interface SeguimientoVista {
  /** Días calendario desde la última visita realizada (o desde el alta si no hay ninguna). */
  diasSinContacto: number
  conVisitas: boolean
  /** Superó el umbral de días sin visita de la cuenta. */
  atrasado: boolean
  ultimaVisita?: VisitaResumenVista
  proximaVisita?: VisitaResumenVista
  necesidadesAbiertasTotal: number
}

/** Tarjeta de "Mis envejecientes". */
export interface EnvejecienteTarjeta {
  id: string
  nombre: string
  edad: number
  /** Tipo de vínculo del usuario con el adulto ("Familiar responsable"). */
  vinculo?: string
  seguimiento: SeguimientoVista
  /** Necesidades abiertas más recientes (la tarjeta muestra las 3 primeras; el total está en `seguimiento`). */
  necesidadesAbiertas: NecesidadVista[]
}

export interface ContactoVista {
  id: string
  nombre: string
  parentesco: string
  telefono: string
  principal: boolean
}

/** Perfil de solo lectura de un envejeciente autorizado. */
export interface EnvejecientePerfil {
  id: string
  nombre: string
  edad: number
  vinculo?: string
  fechaNacimiento: string // YYYY-MM-DD
  cedula: string
  sexo: string
  telefono: string
  direccion: string
  /** ISO UTC del alta en la cuenta. */
  registradoEn: string
  contactos: ContactoVista[]
  /** Solo los nombres del personal asignado. */
  cuidadores: string[]
  voluntarios: string[]
  seguimiento: SeguimientoVista
  /** Lo que la cuenta activa le permite consultar a este usuario. */
  permisos: { indicaciones: boolean }
}

/** Cuenta (Familia u Organización) en la que actúa la persona. */
export interface CuentaActivaVista {
  nombre: string
  /** La persona tiene acceso en más de una cuenta: los envejecientes se ven por cuenta. */
  variasCuentas: boolean
}
