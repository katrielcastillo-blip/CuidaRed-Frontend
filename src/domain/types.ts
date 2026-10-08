/** Modelo de dominio compartido por todos los roles. Los datos viven en el store local (ver store.ts). */

export type Rol = 'cuidador' | 'familiar' | 'admin' | 'coordinador'
export type Riesgo = 'bajo' | 'medio' | 'alto'
export type EstadoMiembro = 'activo' | 'inactivo' | 'invitado'

export interface Organizacion {
  id: string
  nombre: string
  tipo: string
  telefono: string
  provincia: string
  municipio: string
  /** Configuración de la organización (pantalla "Configurar organización") */
  config: {
    diasSinVisitaAlerta: number
    notificarCasosPrioritarios: boolean
    notificarNuevosVoluntarios: boolean
    contactoInstitucional: { nombre: string; telefono: string }
  }
}

export interface Usuario {
  id: string
  rol: Rol
  nombre: string
  apellido: string
  cedula: string
  email: string
  telefono: string
  /** Prototipo: contraseña en claro (no hay backend). */
  password: string
  /** Etiqueta bajo el nombre en Mi Perfil: "Voluntario", "Administrador", "Coordinador"… */
  etiqueta: string
  estado: EstadoMiembro
  orgId: string
  /** Familias (grupos de adultos) a las que pertenece: selector "Flia. Rodríguez ▾". */
  familiaIds: string[]
  /** URL/dataURL opcional; si falta se muestran iniciales. */
  avatar?: string
  creadoEn: string
}

/** Grupo familiar: agrupa adultos mayores y las personas que los acompañan. */
export interface Familia {
  id: string
  nombre: string // "Flia. Rodríguez"
  orgId: string
}

export interface ContactoEmergencia {
  nombre: string
  telefono: string
}

export interface Evaluacion {
  /** Respuestas del formulario "Evaluación de riesgo" (clave de pregunta → valor). */
  respuestas: Record<string, string | boolean>
  puntaje: number
  nivel: Riesgo
  fecha: string
  evaluadoPor: string // userId
}

export interface Adulto {
  id: string
  orgId: string
  familiaId: string
  nombre: string
  apellido: string
  cedula: string
  fechaNacimiento: string // YYYY-MM-DD
  sexo: 'Femenino' | 'Masculino'
  telefono: string
  zona: string // "D.N., Renacimiento"
  municipio: string
  contactoEmergencia: ContactoEmergencia
  riesgo: Riesgo
  evaluacion?: Evaluacion
  estado: 'activo' | 'inactivo'
  /** Cuidadores asignados (userId). */
  cuidadorIds: string[]
  foto?: string
  creadoEn: string
}

export type EstadoVisita = 'pendiente' | 'en_curso' | 'completada' | 'cancelada'
export type EstadoAdultoVisita = 'estable' | 'requiere_atencion' | 'situacion_critica'

export interface Visita {
  id: string
  adultoId: string
  cuidadorId: string
  tipo: string // "Visita de Seguimiento"
  fecha: string // YYYY-MM-DD
  horaPautada: string // "10:30"
  inicio?: string // ISO
  fin?: string // ISO
  estado: EstadoVisita
  estadoAdulto?: EstadoAdultoVisita
  observaciones?: string
  /** Instrucciones previas ("Verificar estado general…"). */
  notas?: string
  /** Nombres/dataURLs de evidencias adjuntas. */
  evidencias: string[]
}

export type TipoNecesidad = 'medicamentos' | 'alimentacion' | 'transporte' | 'compania' | 'otros'
export type EstadoNecesidad = 'activa' | 'inactiva' | 'satisfecha'

export interface Necesidad {
  id: string
  adultoId: string
  registradaPor: string // userId
  tipo: TipoNecesidad
  descripcion: string
  estado: EstadoNecesidad
  creadaEn: string // ISO
  satisfechaEn?: string
  satisfechaPor?: string
}

export type SeveridadAlerta = 'alta' | 'media' | 'baja'

export interface Alerta {
  id: string
  adultoId: string
  severidad: SeveridadAlerta
  categoria: string // "EMERGENCIA MÉDICA", "SIN VISITA", …
  titulo: string
  descripcion: string
  creadaEn: string
  estado: 'pendiente' | 'en_atencion' | 'atendida'
  atendidaPor?: string
  notaAtencion?: string
}

/** Invitación de un cuidador/familiar a una familia ("Clara Rodríguez te ha invitado…"). */
export interface Invitacion {
  id: string
  familiaId: string
  invitadoPor: string // userId
  email: string
  rol: Rol
  nombre?: string
  apellido?: string
  estado: 'pendiente' | 'aceptada' | 'rechazada'
  creadaEn: string
}

export interface DB {
  /** Se incrementa al cambiar el esquema/seed para invalidar localStorage antiguo. */
  version: number
  sessionUserId: string | null
  orgs: Organizacion[]
  usuarios: Usuario[]
  familias: Familia[]
  adultos: Adulto[]
  visitas: Visita[]
  necesidades: Necesidad[]
  alertas: Alerta[]
  invitaciones: Invitacion[]
}
