/*
 * types.ts — Modelo de dominio de CuidaRed, alineado con el modelo de base de datos V3.0
 * ("2026.09.25 Normalización BD CuidaRed", diagrama final) y con el alcance del SRS.
 * Módulo: dominio. Los datos viven en el "servidor" simulado (store.ts) y, sin conexión, en la cola
 * offline (sync.ts). La correspondencia tabla ↔ tipo está documentada en docs/MAPEO-BD.md.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Convenciones:
 *  - Cada interfaz indica su tabla de la BD con @tabla y, cuando el nombre difiere, la columna (@col).
 *  - Marcas de tiempo con hora: ISO 8601 en UTC (Date#toISOString), usadas en auditoría y Last-Write-Wins.
 *  - Campos marcados [SRS] no existen en la BD V3.0 y son exigidos por el SRS (ver recomendaciones en MAPEO-BD.md).
 *  - Campos marcados [desnormalizado] son copias de lectura rápida que la capa de servicios mantiene
 *    sincronizadas con su tabla de origen (como hace el propio modelo con Cuenta.Plan_Precio).
 */

/* ════════════════════════════ Catálogos ════════════════════════════ */

/** Fila genérica de catálogo: id + nombre (+ descripción opcional). */
export interface ItemCatalogo {
  id: string
  nombre: string
  descripcion?: string
}

/** @tabla Provincia (Provincia_Cod, Provincia_Nombre) */
export interface Provincia {
  cod: string
  nombre: string
}

/** @tabla Municipio (Municipio_Cod, Municipio_Nombre, Provincia_Cod FK) */
export interface Municipio {
  cod: string
  nombre: string
  provinciaCod: string
}

/** @tabla Necesidad (catálogo): Necesidad_Id, Necesidad_Nombre, Necesidad_Tipo FK → TipoNecesidad, Necesidad_Descripcion */
export interface NecesidadCatalogo {
  id: string
  nombre: string
  tipo: TipoNecesidad
  descripcion?: string
}

/** @tabla Parametros (Param_Id, Param_Nombre, Param_Valor, Param_Descripcion, Param_ValorDefecto) */
export interface Parametro {
  id: string
  /** Clave estable usada por el código (p. ej. DIAS_SIN_VISITA_ALERTA). @col Param_Nombre */
  clave: string
  nombre: string
  descripcion: string
  tipo: 'numero' | 'booleano' | 'texto'
  valorDefecto: string
}

/** @tabla Plan (Plan_Id, Plan_Nombre, Plan_Categoria FK, Plan_Precio, Plan_Periodicidad, Plan_DuracionDias, Plan_Estado, Limite_Envejecientes, Limite_Usuarios, Cuenta_Tipo_Id FK) */
export interface Plan {
  id: string
  nombre: string
  categoriaId: string
  precio: number
  periodicidad: 'mensual' | 'anual' | 'unico'
  duracionDias: number
  estado: 'activo' | 'inactivo'
  limiteEnvejecientes: number
  limiteUsuarios: number
  tipoCuentaId?: string
}

/** Todos los catálogos de la BD (tablas de referencia). Se inicializan con datos maestros (SRS §11). */
export interface Catalogos {
  /** @tabla Rol (Rol_Id, Rol_Nombre, Rol_Descripcion) — el id coincide con el tipo Rol. */
  roles: Array<ItemCatalogo & { id: Rol }>
  /** @tabla TipoCuenta */
  tiposCuenta: ItemCatalogo[]
  /** @tabla Categoria_cuenta */
  categoriasCuenta: ItemCatalogo[]
  /** @tabla PlanCategoria */
  categoriasPlan: ItemCatalogo[]
  planes: Plan[]
  /** @tabla MetodoPago (Metodo_pago_Id, Metodo_tipo_nombre, Estado) */
  metodosPago: Array<ItemCatalogo & { activo: boolean }>
  provincias: Provincia[]
  municipios: Municipio[]
  /** @tabla TipoNecesidad — el id coincide con TipoNecesidad. */
  tiposNecesidad: Array<ItemCatalogo & { id: TipoNecesidad }>
  necesidades: NecesidadCatalogo[]
  /** @tabla Alertas (Alert_Id, Alert_Nombre) — el id coincide con TipoAlerta. */
  alertas: Array<ItemCatalogo & { id: TipoAlerta }>
  /** @tabla Prioridad (Prioridad_Id, Prioridad_Nombre) — compartida por necesidades, alertas y tareas. */
  prioridades: Array<ItemCatalogo & { id: Prioridad }>
  /** @tabla Riesgo (Riesgo_Id, Riesgo_Nombre, Riesgo_Descripcion): factores de riesgo. */
  riesgos: ItemCatalogo[]
  /** @tabla Nivel_Riesgo — el id coincide con el tipo Riesgo. */
  nivelesRiesgo: Array<ItemCatalogo & { id: Riesgo }>
  /** @tabla Tipo_Indicacion */
  tiposIndicacion: ItemCatalogo[]
  /** @tabla Tipo_vinculo */
  tiposVinculo: Array<ItemCatalogo & { id: TipoVinculo | string }>
  /** @tabla Tipo_Cuidado */
  tiposCuidado: ItemCatalogo[]
  parametros: Parametro[]
}

/* ════════════════════════════ Cuenta / organización ════════════════════════════ */

/** Roles del sistema (RF-09): administrador, coordinador, voluntario y familiar responsable. @tabla Rol */
export type Rol = 'voluntario' | 'familiar' | 'admin' | 'coordinador'
export type Riesgo = 'bajo' | 'medio' | 'alto'
export type Prioridad = 'alta' | 'media' | 'baja'
export type EstadoMiembro = 'activo' | 'inactivo' | 'invitado'
export type EstadoSuscripcion = 'prueba' | 'activa' | 'vencida' | 'cancelada'

/**
 * @tabla Cuenta — la organización comunitaria que usa CuidaRed.
 * (Cuenta_Id, Cuenta_Nombre, Cuenta_Tipo_Id FK, Categoria_cuenta_Id FK, Municipio_Cod FK, Direccion, Telefono,
 *  Suscripcion_Estado, Correo, Fecha_Creacion, Prueba_gratuita, Fecha_Inicio_Prueba, Fecha_Fin_Prueba, Plan_Id FK,
 *  Plan_Precio [desnormalizado], User_Titular FK)
 */
export interface Organizacion {
  id: string
  nombre: string
  tipoCuentaId: string
  categoriaCuentaId: string
  municipioCod: string
  direccion: string
  telefono: string
  correo: string
  suscripcionEstado: EstadoSuscripcion
  creadoEn: string
  pruebaGratuita: boolean
  fechaInicioPrueba?: string // YYYY-MM-DD
  fechaFinPrueba?: string // YYYY-MM-DD
  planId: string
  /** [desnormalizado] precio del plan al contratarlo. @col Plan_Precio */
  planPrecio: number
  /** Usuario responsable de la cuenta (administrador titular). @col User_Titular */
  usuarioTitularId: string
}

/** @tabla Configuracion_Cuenta (Cuenta_Id, Param_Id, Valor, Fecha_Actualizacion) */
export interface ConfiguracionCuenta {
  orgId: string
  parametroId: string
  valor: string
  actualizadoEn: string
}

/** @tabla Pago (Pago_Id, Plan_Id FK, User_Id FK, Pago_Monto, Metodo_pago_Id FK, Pago_Estado, Pago_Fecha) */
export interface Pago {
  id: string
  /** [SRS] organización a la que corresponde (la BD lo infiere por el usuario). */
  orgId: string
  planId: string
  usuarioId: string
  monto: number
  metodoPagoId: string
  estado: 'registrado' | 'confirmado' | 'anulado'
  fecha: string // ISO UTC
  /** Referencia o comprobante (texto libre opcional). */
  referencia?: string
}

/* ════════════════════════════ Usuarios ════════════════════════════ */

/**
 * @tabla Usuario (User_Id, User_Cedula, User_Nombres, User_Apellidos, User_Correo, User_Contraseña, User_Telefono,
 * User_Estado, User_FechaRegistro). La contraseña se guarda como hash + sal (el SRS prohíbe texto plano).
 */
export interface Usuario {
  id: string
  /** [desnormalizado] rol de la membresía vigente (ver Membresia). */
  rol: Rol
  nombre: string
  apellido: string
  cedula: string
  email: string
  telefono: string
  /** Hash PBKDF2-SHA256 (hex) de la contraseña. @col User_Contraseña */
  passwordHash: string
  passwordSalt: string
  /** Etiqueta bajo el nombre en Mi Perfil: "Voluntario", "Administrador"… */
  etiqueta: string
  estado: EstadoMiembro
  /** [desnormalizado] cuenta de la membresía vigente (ver Membresia). */
  orgId: string
  avatar?: string
  /** @col User_FechaRegistro */
  creadoEn: string
  actualizadoEn?: string
}

/** @tabla Membresia (User_Id, Cuenta_Id, Rol_Id FK, Estado, Fecha_Inicio, Fecha_Fin): historial de pertenencia y rol. */
export interface Membresia {
  id: string
  usuarioId: string
  orgId: string
  rol: Rol
  estado: 'activa' | 'inactiva'
  fechaInicio: string // ISO UTC
  fechaFin?: string // ISO UTC
}

/**
 * @tabla Cuidador (Cuidador_Id, User_Id FK, Fecha_Inicio, Fecha_Fin, Tipo_cuidado_Id FK, Cuidador_Indep, user_empleador FK)
 * Perfil de cuidado de un usuario (voluntario comunitario, cuidador remunerado o familiar cuidador).
 */
export interface Cuidador {
  id: string
  usuarioId: string
  tipoCuidadoId: string
  fechaInicio: string // YYYY-MM-DD
  fechaFin?: string // YYYY-MM-DD
  /** true si trabaja por cuenta propia; si no, `empleadorUsuarioId` indica quién lo emplea. @col Cuidador_Indep */
  independiente: boolean
  empleadorUsuarioId?: string
}

/** @tabla Notificacion (Notificacion_Id, User_Id FK, Notificacion_fecha, Notificacion_mensaje, Plan_Id FK, Cuenta_Id FK, Estado, Fecha_lectura) */
export interface Notificacion {
  id: string
  usuarioId: string
  fecha: string // ISO UTC
  mensaje: string
  planId?: string
  orgId?: string
  estado: 'no_leida' | 'leida'
  fechaLectura?: string
  /** [SRS] enlace a la alerta que la originó (para abrirla desde la campana). */
  alertaId?: string
}

/* ════════════════════════════ Envejeciente ════════════════════════════ */

/** Grado de autonomía para las actividades de la vida diaria. [SRS] */
export type Autonomia = 'independiente' | 'parcial' | 'dependiente'

/** Condición general del adulto mayor (RF-01). [SRS] Listas predefinidas, sin información clínica detallada. */
export interface CondicionGeneral {
  autonomia: Autonomia
  condiciones: string[]
  nota?: string
}

/** Consentimiento informado para el tratamiento de datos (Ley 172-13). [SRS] */
export interface Consentimiento {
  otorgado: boolean
  otorgadoPor: 'adulto' | 'representante'
  fecha: string // ISO UTC
  registradoPor: string // userId
}

export interface Evaluacion {
  /** Respuestas del formulario "Evaluación de riesgo" (clave de pregunta → valor). [SRS] */
  respuestas: Record<string, string | boolean>
  puntaje: number
  nivel: Riesgo
  fecha: string
  evaluadoPor: string // userId
}

/**
 * @tabla Envejeciente (Env_Id, Env_Nombres, Env_Apellidos, Env_Cedula, Env_FechaNacimiento, Municipio_Cod FK,
 * Env_Direccion, Env_Telefono, Env_Sexo, Env_Estado, Env_FechaCreacion, User_registrador FK, Cuenta_Id FK)
 */
export interface Adulto {
  id: string
  /** @col Cuenta_Id */
  orgId: string
  nombre: string
  apellido: string
  cedula: string
  fechaNacimiento: string // YYYY-MM-DD
  sexo: 'Femenino' | 'Masculino'
  telefono: string
  municipioCod: string
  /** Sector o barrio (parte de Env_Direccion; se usa para filtrar por zona). */
  zona: string
  /** Calle, número y referencias (parte de Env_Direccion). */
  direccion: string
  /** [desnormalizado] nivel del registro de riesgo vigente más reciente (ver EnvRiesgo). */
  riesgo: Riesgo
  condicionGeneral: CondicionGeneral
  consentimiento?: Consentimiento
  evaluacion?: Evaluacion
  estado: 'activo' | 'inactivo'
  foto?: string
  anonimizado?: boolean
  /** @col User_registrador */
  registradoPor: string
  /** @col Env_FechaCreacion */
  creadoEn: string
  actualizadoEn: string
  actualizadoPor?: string
}

/** @tabla Contacto_emergencia (Contacto_Id, Env_Id FK, nombres, apellidos, Parentesco, telefono, Es_Principal) */
export interface ContactoEmergencia {
  id: string
  adultoId: string
  nombres: string
  apellidos: string
  parentesco: string
  telefono: string
  esPrincipal: boolean
}

/** Tipos de vínculo con significado para el control de acceso. @tabla Tipo_vinculo */
export type TipoVinculo = 'familiar_responsable' | 'voluntario_asignado' | 'referente'

/**
 * @tabla Vinculo (Env_Id, User_Id, Tipo_vinculo_Id): relación usuario ↔ adulto mayor.
 * Define el alcance de acceso: el voluntario ve los adultos con vínculo "voluntario_asignado"; el familiar
 * responsable, los adultos con vínculo "familiar_responsable".
 */
export interface Vinculo {
  adultoId: string
  usuarioId: string
  tipoVinculoId: TipoVinculo | string
  /** [SRS] fecha de creación (auditoría). */
  creadoEn: string
}

/**
 * @tabla Env_Riesgo (Env_Id, Riesgo_Id FK, Riesgo_Fecha, Nivel_Riesgo_Id FK, Riesgo_Estado, Riesgo_Motivo, Riesgo_Observacion)
 * Historial de factores de riesgo identificados para un adulto mayor.
 */
export interface EnvRiesgo {
  /** [SRS] id propio para conservar el historial (ver recomendación de PK en MAPEO-BD.md). */
  id: string
  adultoId: string
  /** Factor de riesgo (catálogo Riesgo). */
  riesgoId: string
  fecha: string // ISO UTC
  nivel: Riesgo
  estado: 'vigente' | 'superado'
  motivo: string
  observacion?: string
  registradoPor: string
}

/**
 * @tabla Indicacion_Medica (Indicacion_Id, Env_Id FK, Tipo_Indicacion_Id FK, Titulo, Descripcion, Frecuencia_horario,
 * Fecha_Inicio, Fecha_Fin, Estado, Evidencia). Solo transcribe lo indicado por personal de salud (no es expediente clínico).
 */
export interface IndicacionMedica {
  id: string
  adultoId: string
  tipoIndicacionId: string
  titulo: string
  descripcion: string
  frecuenciaHorario: string
  fechaInicio: string // YYYY-MM-DD
  fechaFin?: string // YYYY-MM-DD
  estado: 'vigente' | 'suspendida' | 'finalizada'
  /** Nombre o miniatura del documento de respaldo (receta, indicación escrita). */
  evidencia?: string
  registradaPor: string
  actualizadoEn: string
}

/* ════════════════════════════ Visitas ════════════════════════════ */

export type EstadoVisita = 'pendiente' | 'en_curso' | 'completada' | 'cancelada'
export type EstadoAdultoVisita = 'estable' | 'requiere_atencion' | 'situacion_critica'

/** Marca que se añade en la vista local a los registros que aún esperan sincronización (RF-10). */
export interface MarcaSync {
  pendienteSync?: boolean
}

/** @tabla DetalleVisita (Env_Id, Visit_Id, Observacion): otro adulto del mismo hogar atendido en la misma visita. */
export interface DetalleVisita {
  adultoId: string
  observacion: string
}

/**
 * @tabla Visita (Visit_Id, Visit_Estado, Visit_razon, Visit_Fecha, Visit_HoraInicio, Visit_HoraFin)
 * + RegistroVisita (User_Id, Visit_Id, Autorizada_por_user_Id) + DetalleVisita (Env_Id, Visit_Id, Observacion).
 * `adultoId`/`observaciones` son el detalle principal; `detallesAdicionales`, el resto de adultos del hogar.
 */
export interface Visita extends MarcaSync {
  id: string
  /** Adulto principal visitado (primera fila de DetalleVisita). */
  adultoId: string
  /** Responsable de la visita. @col RegistroVisita.User_Id */
  cuidadorId: string
  /** @col RegistroVisita.Autorizada_por_user_Id (coordinador que programó o autorizó la visita). */
  autorizadaPor?: string
  /** Motivo de la visita. @col Visit_razon */
  razon: string
  tipo: string // "Visita de Seguimiento"
  fecha: string // YYYY-MM-DD
  horaPautada: string // "10:30"
  inicio?: string // ISO  @col Visit_HoraInicio
  fin?: string // ISO     @col Visit_HoraFin
  estado: EstadoVisita
  estadoAdulto?: EstadoAdultoVisita
  /** @col DetalleVisita.Observacion del adulto principal */
  observaciones?: string
  detallesAdicionales: DetalleVisita[]
  /** Aspectos verificados (checklist de CU-05). [SRS] */
  checklist: string[]
  notas?: string
  evidencias: string[]
  creadaPor?: string
  actualizadoEn: string
  actualizadoPor?: string
}

/* ════════════════════════════ Necesidades ════════════════════════════ */

/** @tabla TipoNecesidad */
export type TipoNecesidad = 'medicamentos' | 'alimentacion' | 'transporte' | 'compania' | 'otros'
/** Estados de una necesidad (RF-03). Se registra siempre como "pendiente". @col Necesidad_Estado */
export type EstadoNecesidad = 'pendiente' | 'en_proceso' | 'satisfecha' | 'inactiva'

export interface CambioEstadoNecesidad {
  estado: EstadoNecesidad
  fecha: string // ISO UTC
  usuarioId: string
  nota?: string
}

/**
 * @tabla Env_Necesidad (Necesidad_Id FK, Env_Id FK, Necesidad_Fecha, Cantidad, Unidad_Medida, Necesidad_Estado,
 * es_recurrente, Prioridad_Id FK, Fecha_resolucion, motivo_resolucion, User_responsable FK, Indicacion_Id FK, Umbral_alerta)
 */
export interface Necesidad extends MarcaSync {
  id: string
  adultoId: string
  /** Elemento del catálogo Necesidad (p. ej. "Medicamento recetado"). @col Necesidad_Id */
  catalogoId?: string
  registradaPor: string
  tipo: TipoNecesidad
  descripcion: string
  cantidad?: number
  /** @col Unidad_Medida */
  unidad?: string
  /** @col es_recurrente */
  recurrente: boolean
  /** @col Prioridad_Id */
  prioridad: Prioridad
  estado: EstadoNecesidad
  /** @col Necesidad_Fecha */
  creadaEn: string // ISO
  /** @col Fecha_resolucion */
  satisfechaEn?: string
  satisfechaPor?: string
  /** @col motivo_resolucion */
  motivoResolucion?: string
  /** Usuario a cargo de gestionarla. @col User_responsable */
  responsableId?: string
  /** Indicación médica relacionada (p. ej. un medicamento indicado). @col Indicacion_Id */
  indicacionId?: string
  /** Días sin resolver tras los que se debe escalar. @col Umbral_alerta */
  umbralAlertaDias?: number
  /** Historial de cambios de estado. [SRS] */
  historial: CambioEstadoNecesidad[]
  visitaId?: string
  actualizadoEn: string
  actualizadoPor?: string
}

/* ════════════════════════════ Alertas ════════════════════════════ */

export type SeveridadAlerta = Prioridad
export type EstadoAlerta = 'pendiente' | 'en_atencion' | 'atendida'
/** Tipo de alerta. @tabla Alertas (catálogo) */
export type TipoAlerta = 'prioritaria' | 'seguimiento' | 'emergencia' | 'necesidad'

/** Acción registrada por quien gestiona la alerta (CU-09 paso 4). [SRS] historial de AlertaEnvejeciente.Accion_tomada */
export interface AccionAlerta {
  id: string
  fecha: string
  usuarioId: string
  estado: EstadoAlerta
  nota: string
}

/**
 * @tabla AlertaEnvejeciente (Env_Id, Alert_Id FK, Descripcion, Alert_Fecha, Prioridad_Id FK, Estado, Fecha_Atencion,
 * Accion_tomada, Atentida_por_user_Id)
 */
export interface Alerta {
  id: string
  adultoId: string
  /** @col Alert_Id (catálogo Alertas) */
  tipo: TipoAlerta
  /** @col Prioridad_Id */
  severidad: SeveridadAlerta
  categoria: string
  titulo: string
  /** @col Descripcion */
  descripcion: string
  condiciones: string[]
  /** Necesidad que originó la alerta (alertas de necesidad atrasada por Umbral_alerta). [SRS] */
  necesidadId?: string
  firma?: string
  /** @col Alert_Fecha */
  creadaEn: string
  estado: EstadoAlerta
  generadaPor: string
  /** @col Atentida_por_user_Id */
  atendidaPor?: string
  /** @col Fecha_Atencion */
  atendidaEn?: string
  /** @col Accion_tomada (última acción) */
  notaAtencion?: string
  acciones: AccionAlerta[]
  leidaPor: string[]
  actualizadoEn: string
}

/* ════════════════════════════ Agenda ════════════════════════════ */

export type EstadoTarea = 'pendiente' | 'en_curso' | 'completada' | 'cancelada'

/**
 * @tabla Tarea_agenda (Tarea_Id, Cuidador_Id FK, Indicacion_Id FK, Env_Id FK, Titulo_Tarea, Hora_programada,
 * Prioridad_Id FK, Estado, Requiere_evidencia, tarea_repetitiva, Fecha_programada, User_creador FK)
 */
export interface Tarea {
  id: string
  cuidadorId: string
  indicacionId?: string
  adultoId: string
  titulo: string
  fechaProgramada: string // YYYY-MM-DD
  horaProgramada: string // HH:MM
  prioridad: Prioridad
  estado: EstadoTarea
  requiereEvidencia: boolean
  repetitiva: boolean
  creadaPor: string
  actualizadoEn: string
}

/** @tabla Evidencias (Evidencia_Id, Tarea_Id FK, Fecha_registro, Archivo_url, Observacion, Estado_validacion) */
export interface Evidencia {
  id: string
  tareaId: string
  fechaRegistro: string // ISO UTC
  /** Miniatura (dataURL) o nombre del archivo. @col Archivo_url */
  archivo: string
  observacion?: string
  estadoValidacion: 'pendiente' | 'validada' | 'rechazada'
  registradaPor: string
  validadaPor?: string
}

/* ════════════════════════════ Otros ════════════════════════════ */

/** Invitación para activar una cuenta creada por el administrador. [SRS] */
export interface Invitacion {
  id: string
  invitadoPor: string
  email: string
  rol: Rol
  nombre?: string
  apellido?: string
  estado: 'pendiente' | 'aceptada' | 'rechazada'
  creadaEn: string
  codigoHash?: string
  expira?: string
}

/* ───────────── Auditoría [SRS] (SRS §8.2.2.1.3 · §8.2.2.3.4 e · §8.2.2.3.5 j) ───────────── */
export type EntidadAuditada =
  | 'sesion'
  | 'usuario'
  | 'adulto'
  | 'visita'
  | 'necesidad'
  | 'alerta'
  | 'organizacion'
  | 'sincronizacion'
  | 'indicacion'
  | 'tarea'
  | 'pago'
export type ResultadoAuditoria = 'exito' | 'fallo' | 'denegado' | 'conflicto'

export interface RegistroAuditoria {
  id: string
  fecha: string
  usuarioId: string
  usuarioNombre: string
  rol: Rol | 'sistema' | 'anonimo'
  orgId?: string
  accion: string
  entidad: EntidadAuditada
  registroId?: string
  resultado: ResultadoAuditoria
  detalle?: string
}

export interface BloqueoLogin {
  fallos: number
  bloqueadoHasta?: string
}

export interface Recuperacion {
  id: string
  email: string
  codigoHash: string
  expira: string
  usado: boolean
}

/** Base de datos completa del "servidor" simulado. */
export interface DB {
  /** Se incrementa al cambiar el esquema/seed para invalidar localStorage antiguo. */
  version: number
  catalogos: Catalogos
  orgs: Organizacion[]
  configuracion: ConfiguracionCuenta[]
  pagos: Pago[]
  usuarios: Usuario[]
  membresias: Membresia[]
  cuidadores: Cuidador[]
  notificaciones: Notificacion[]
  adultos: Adulto[]
  contactos: ContactoEmergencia[]
  vinculos: Vinculo[]
  riesgos: EnvRiesgo[]
  indicaciones: IndicacionMedica[]
  visitas: Visita[]
  necesidades: Necesidad[]
  alertas: Alerta[]
  tareas: Tarea[]
  evidencias: Evidencia[]
  invitaciones: Invitacion[]
  auditoria: RegistroAuditoria[]
  bloqueos: Record<string, BloqueoLogin>
  recuperaciones: Recuperacion[]
}
