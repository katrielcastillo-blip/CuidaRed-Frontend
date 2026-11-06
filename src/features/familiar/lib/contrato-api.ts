/*
 * contrato-api.ts — Contrato del Portal Familiar con la API conectada: DTO en snake_case y funciones tipadas
 * que usan `api` y `apiPage` de access-real/client. ES UNA PROPUESTA: el backend solo tiene sesión y perfil
 * (fase 1); estos endpoints llegan con las fases 3 (Envejecientes), 4 (Visitas) y 5 (Necesidades) y las
 * indicaciones médicas. NINGUNA función se monta en la app ni se llama desde el prototipo: hoy las pantallas leen
 * el store local mediante lib/datos.ts; al conectar, cada hook de datos pasa a llamar a su función de aquí y
 * devuelve el mismo modelo de lib/modelos.ts. Detalle, errores y regla de autorización: docs/CONTRATO-PORTAL-FAMILIAR.md.
 *
 * Convenciones (CuidaRed-Backend/docs/CONVENCIONES-API.md): rutas en kebab-case bajo /api/v1, campos en
 * snake_case, fechas ISO 8601 UTC (las de calendario, YYYY-MM-DD), listas con { data, meta } (page desde 1,
 * limit hasta 100), `sort=-campo,campo` y `filter[campo]=valor` solo con campos que cada endpoint declara.
 * Autorización SIEMPRE en el servidor: el Familiar solo accede a los envejecientes con permiso explícito
 * ("familiar_responsable") en su cuenta activa. Lo que aquí se envía (cuenta, ids, filtros) no concede acceso.
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { api, apiPage, ApiError } from '@/features/access-real/client'
import type { PaginatedResponse } from '@/lib/api-contract'
import type { ConsultaPendiente } from './modelos'

/* ═════════════════════════════ Vocabulario ═════════════════════════════ */

export type TipoNecesidadDto = 'medicamentos' | 'alimentacion' | 'transporte' | 'compania' | 'otros'
export type EstadoNecesidadDto = 'pendiente' | 'en_proceso' | 'satisfecha' | 'inactiva'
export type PrioridadDto = 'alta' | 'media' | 'baja'
export type EstadoVisitaDto = 'pendiente' | 'en_curso' | 'completada' | 'cancelada'
export type EstadoAdultoVisitaDto = 'estable' | 'requiere_atencion' | 'situacion_critica'
export type EstadoIndicacionDto = 'vigente' | 'suspendida' | 'finalizada'
export type EstadoEnvejecienteDto = 'activo' | 'inactivo'

/* ═════════════════════════════ DTO de respuesta ═════════════════════════════ */

/** Solo el nombre de una persona (personal, responsable): nunca cédula, teléfono ni correo. */
export interface PersonaDto {
  nombres: string
  apellidos: string
}

export interface EnvejecienteRefDto {
  envejeciente_id: string
  nombres: string
  apellidos: string
}

export interface VisitaResumenDto {
  visita_id: string
  /** YYYY-MM-DD. */
  fecha: string
  /** HH:MM. */
  hora_pautada: string
  /** ISO UTC; null si aún no empezó. */
  hora_inicio: string | null
  estado: EstadoVisitaDto
  razon: string | null
  tipo: string
  /** Quien la realiza o la tiene asignada; en una visita de visitante externo, quien la autorizó. */
  responsable: PersonaDto | null
  /** Solo el nombre del visitante externo autorizado; sus datos de contacto nunca se envían. */
  visitante_nombre: string | null
  /** La visita también atendió a otros adultos del hogar. */
  es_compartida: boolean
  /** Solo en visitas realizadas y cuando el envejeciente es el principal de la visita. */
  estado_adulto: EstadoAdultoVisitaDto | null
  /** Observación registrada PARA este envejeciente (solo visitas realizadas). */
  observacion: string | null
}

export interface EvidenciaDto {
  evidencia_id: string
  nombre: string
  es_imagen: boolean
  /** URL firmada de vida corta; null si no se puede mostrar. */
  url: string | null
}

export interface VisitaDetalleDto extends VisitaResumenDto {
  envejeciente: EnvejecienteRefDto
  /** El envejeciente es el principal de la visita: solo entonces vienen `estado_adulto` y `evidencias`. */
  es_adulto_principal: boolean
  /** ISO UTC; null si aún no terminó. */
  hora_fin: string | null
  /** Valores del catálogo de aspectos verificados. */
  aspectos_verificados: string[]
  /** Indicaciones para la visita. Siempre null en visitas de visitante externo. */
  notas: string | null
  evidencias: EvidenciaDto[]
  /** Otros envejecientes de la visita que la persona también está autorizada a consultar. */
  otros_envejecientes: EnvejecienteRefDto[]
  /** Cuántos más recibieron la visita sin que la persona pueda consultarlos: solo la cantidad. */
  otros_envejecientes_sin_acceso: number
}

export interface NecesidadResumenDto {
  necesidad_id: string
  /** Nombre del catálogo de necesidades ("Acompañamiento"). */
  nombre: string | null
  tipo: TipoNecesidadDto
  descripcion: string
  cantidad: number | null
  unidad_medida: string | null
  es_recurrente: boolean
  prioridad: PrioridadDto
  estado: EstadoNecesidadDto
  /** ISO UTC. */
  fecha_registro: string
  /** ISO UTC. */
  fecha_resolucion: string | null
  motivo_resolucion: string | null
}

export interface CambioEstadoNecesidadDto {
  estado: EstadoNecesidadDto
  /** ISO UTC. */
  fecha: string
  /** null: cambio automático del sistema. */
  actor: PersonaDto | null
  nota: string | null
}

export interface NecesidadDetalleDto extends NecesidadResumenDto {
  envejeciente: EnvejecienteRefDto
  registrada_por: PersonaDto | null
  resuelta_por: PersonaDto | null
  responsable: PersonaDto | null
  /** Del más reciente al más antiguo. */
  historial: CambioEstadoNecesidadDto[]
  /** Indicación médica relacionada; null si no hay o si la persona no puede consultar indicaciones. */
  indicacion: { indicacion_id: string; titulo: string } | null
}

export interface IndicacionDto {
  indicacion_id: string
  /** Tipo de indicación ("Medicamento", "Dieta"…). */
  tipo: string
  titulo: string
  descripcion: string
  frecuencia_horario: string
  /** YYYY-MM-DD. */
  fecha_inicio: string
  /** YYYY-MM-DD. */
  fecha_fin: string | null
  estado: EstadoIndicacionDto
  /** Nombre del documento de respaldo; el archivo no se descarga desde este portal. */
  evidencia_nombre: string | null
}

export interface ContactoEmergenciaDto {
  contacto_id: string
  nombres: string
  apellidos: string
  parentesco: string | null
  telefono: string
  es_principal: boolean
}

/** Estado del seguimiento (RF-05), común al listado y al perfil. */
export interface SeguimientoDto {
  /** Días calendario desde la última visita realizada (o desde el alta si no hay ninguna). */
  dias_sin_contacto: number
  con_visitas: boolean
  /** Superó el umbral de días sin visita configurado en la cuenta. */
  seguimiento_atrasado: boolean
  ultima_visita: VisitaResumenDto | null
  proxima_visita: VisitaResumenDto | null
  necesidades_abiertas_total: number
}

/** Elemento de GET /familiar/envejecientes. */
export interface EnvejecienteResumenDto {
  envejeciente_id: string
  cuenta_id: string
  nombres: string
  apellidos: string
  /** YYYY-MM-DD. */
  fecha_nacimiento: string
  estado: EstadoEnvejecienteDto
  /** Con este portal solo puede ser `familiar_responsable`. */
  tipo_vinculo: 'familiar_responsable'
  seguimiento: SeguimientoDto
  /** Las necesidades abiertas más recientes (máximo 3); el total está en `seguimiento`. */
  necesidades_abiertas: NecesidadResumenDto[]
}

/** Respuesta de GET /familiar/envejecientes/:id. No incluye riesgo, condición general ni consentimiento. */
export interface EnvejecienteDetalleDto {
  envejeciente_id: string
  cuenta_id: string
  nombres: string
  apellidos: string
  /** YYYY-MM-DD. */
  fecha_nacimiento: string
  cedula: string
  sexo: 'Femenino' | 'Masculino'
  telefono: string | null
  /** Calle, número y referencias. */
  direccion: string | null
  sector: string | null
  municipio: string | null
  provincia: string | null
  /** ISO UTC del alta en la cuenta. */
  fecha_registro: string
  estado: EstadoEnvejecienteDto
  tipo_vinculo: 'familiar_responsable'
  contactos_emergencia: ContactoEmergenciaDto[]
  /** Solo nombres del personal asignado. */
  cuidadores: PersonaDto[]
  voluntarios: PersonaDto[]
  seguimiento: SeguimientoDto
  /** Ayuda para mostrar u ocultar pestañas; el servidor vuelve a comprobar el permiso en cada petición. */
  permisos: { indicaciones_ver: boolean }
}

/* ═════════════════════════════ Parámetros de consulta ═════════════════════════════ */

type Orden<Campo extends string> = Campo | `-${Campo}`

interface PaginaBase<Campo extends string> {
  /** Desde 1 (predeterminado 1). */
  page?: number
  /** 1 a 100 (predeterminado 20). */
  limit?: number
  /** Campos declarados por el endpoint, con `-` para descendente; sin él, el orden predeterminado del servidor. */
  sort?: Array<Orden<Campo>>
}

export interface ConsultaEnvejecientes extends PaginaBase<'dias_sin_contacto' | 'apellidos' | 'nombres'> {
  /** Cuenta activa. Obligatoria: el servidor comprueba que la persona sea Familiar activo en ella (403 si no). */
  cuentaId: string
  /** Predeterminado `activo`. */
  estado?: EstadoEnvejecienteDto
}

export interface ConsultaVisitas extends PaginaBase<'fecha' | 'hora_pautada'> {
  estado?: EstadoVisitaDto
}

export interface ConsultaNecesidades extends PaginaBase<'abierta' | 'fecha_registro' | 'prioridad'> {
  /** true = pendientes y en proceso. */
  abierta?: boolean
  estado?: EstadoNecesidadDto
  tipo?: TipoNecesidadDto
}

export interface ConsultaIndicaciones extends PaginaBase<'fecha_inicio' | 'estado'> {
  /** Predeterminado `vigente`. */
  estado?: EstadoIndicacionDto
}

/* ═════════════════════════════ Funciones ═════════════════════════════ */

const RUTA = '/familiar/envejecientes'
const seg = (valor: string) => encodeURIComponent(valor)

/** Quita los filtros sin valor para no enviar `filter[x]=undefined`. */
const filtros = (valores: Record<string, string | number | boolean | undefined>) =>
  Object.fromEntries(Object.entries(valores).filter(([, v]) => v !== undefined)) as Record<string, string | number | boolean>

/**
 * GET /api/v1/familiar/envejecientes?filter[cuenta_id]=…&filter[estado]=activo
 * Envejecientes autorizados en la cuenta activa (paginado). Orden predeterminado: `-dias_sin_contacto,apellidos,nombres`.
 * La búsqueda por nombre aún no está definida: el cliente filtra la lista cargada.
 */
export function listarEnvejecientes(token: string, c: ConsultaEnvejecientes): Promise<PaginatedResponse<EnvejecienteResumenDto>> {
  return apiPage<EnvejecienteResumenDto>(RUTA, token, {
    page: c.page,
    limit: c.limit,
    sort: c.sort,
    filters: filtros({ cuenta_id: c.cuentaId, estado: c.estado ?? 'activo' }),
  })
}

/** GET /api/v1/familiar/envejecientes/:id — perfil de solo lectura. 404 si no existe o no está autorizado. */
export function obtenerEnvejeciente(token: string, envejecienteId: string): Promise<EnvejecienteDetalleDto> {
  return api<EnvejecienteDetalleDto>(`${RUTA}/${seg(envejecienteId)}`, token)
}

/**
 * GET /api/v1/familiar/envejecientes/:id/visitas (paginado), incluidas las visitas compartidas con otros adultos
 * del hogar. Orden predeterminado: `-fecha,-hora_pautada`.
 */
export function listarVisitas(token: string, envejecienteId: string, c: ConsultaVisitas = {}): Promise<PaginatedResponse<VisitaResumenDto>> {
  return apiPage<VisitaResumenDto>(`${RUTA}/${seg(envejecienteId)}/visitas`, token, {
    page: c.page,
    limit: c.limit,
    sort: c.sort,
    filters: filtros({ estado: c.estado }),
  })
}

/** GET /api/v1/familiar/envejecientes/:id/visitas/:visitaId — detalle desde el punto de vista de ese envejeciente. */
export function obtenerVisita(token: string, envejecienteId: string, visitaId: string): Promise<VisitaDetalleDto> {
  return api<VisitaDetalleDto>(`${RUTA}/${seg(envejecienteId)}/visitas/${seg(visitaId)}`, token)
}

/** GET /api/v1/familiar/envejecientes/:id/necesidades (paginado). Orden predeterminado: `-abierta,-fecha_registro`. */
export function listarNecesidades(token: string, envejecienteId: string, c: ConsultaNecesidades = {}): Promise<PaginatedResponse<NecesidadResumenDto>> {
  return apiPage<NecesidadResumenDto>(`${RUTA}/${seg(envejecienteId)}/necesidades`, token, {
    page: c.page,
    limit: c.limit,
    sort: c.sort,
    filters: filtros({ abierta: c.abierta, estado: c.estado, tipo: c.tipo }),
  })
}

/** GET /api/v1/familiar/envejecientes/:id/necesidades/:necesidadId — detalle con historial de estados. */
export function obtenerNecesidad(token: string, envejecienteId: string, necesidadId: string): Promise<NecesidadDetalleDto> {
  return api<NecesidadDetalleDto>(`${RUTA}/${seg(envejecienteId)}/necesidades/${seg(necesidadId)}`, token)
}

/**
 * GET /api/v1/familiar/envejecientes/:id/indicaciones (paginado). Requiere el permiso `indicaciones:ver`.
 * Orden predeterminado: `-fecha_inicio`. Por defecto solo las vigentes.
 */
export function listarIndicaciones(token: string, envejecienteId: string, c: ConsultaIndicaciones = {}): Promise<PaginatedResponse<IndicacionDto>> {
  return apiPage<IndicacionDto>(`${RUTA}/${seg(envejecienteId)}/indicaciones`, token, {
    page: c.page,
    limit: c.limit,
    sort: c.sort,
    filters: filtros({ estado: c.estado ?? 'vigente' }),
  })
}

/* ═════════════════════════════ Errores ═════════════════════════════ */

/**
 * Traduce un fallo de la API al estado de consulta de las pantallas. 404 y 403 se muestran igual ("No encontrado
 * o sin permiso") para no revelar si el registro existe. 401 y `USER_INACTIVE` NO se ocultan: los resuelve la
 * sesión conectada (volver a iniciar sesión / revocar la sesión local), según CONVENCIONES-API.
 */
export function consultaDesdeError(error: unknown): ConsultaPendiente {
  if (error instanceof ApiError && (error.status === 404 || error.status === 403) && error.code !== 'USER_INACTIVE') {
    return { estado: 'error', tipo: 'no_encontrado', mensaje: 'No encontrado o sin permiso.' }
  }
  return { estado: 'error', tipo: 'fallo', mensaje: error instanceof Error ? error.message : 'No se pudo cargar la información. Intenta de nuevo.' }
}
