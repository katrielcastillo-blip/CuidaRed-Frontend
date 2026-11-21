/*
 * datosMaestros.ts — Datos maestros de la BD (catálogos y parámetros) con los que se inicializa una
 * organización nueva (SRS §11 "Inicialización de datos maestros"). Los ids son estables: son las claves
 * primarias de las tablas de catálogo del modelo V3.0.
 * Módulo: dominio.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { Catalogos, Municipio, Provincia } from './types'

/** Provincias de República Dominicana y municipios principales. */
export const MUNICIPIOS_POR_PROVINCIA: Record<string, string[]> = {
  'Distrito Nacional': ['Santo Domingo de Guzmán'],
  Azua: ['Azua de Compostela', 'Estebanía', 'Guayabal', 'Las Charcas', 'Las Yayas de Viajama', 'Padre Las Casas', 'Peralta', 'Pueblo Viejo', 'Sabana Yegua', 'Tábara Arriba'],
  Bahoruco: ['Neiba', 'Galván', 'Los Ríos', 'Tamayo', 'Villa Jaragua'],
  Barahona: ['Barahona', 'Cabral', 'El Peñón', 'Enriquillo', 'Fundación', 'Jaquimeyes', 'La Ciénaga', 'Las Salinas', 'Paraíso', 'Polo', 'Vicente Noble'],
  Dajabón: ['Dajabón', 'El Pino', 'Loma de Cabrera', 'Partido', 'Restauración'],
  Duarte: ['San Francisco de Macorís', 'Arenoso', 'Castillo', 'Eugenio María de Hostos', 'Las Guáranas', 'Pimentel', 'Villa Riva'],
  'El Seibo': ['El Seibo', 'Miches'],
  'Elías Piña': ['Comendador', 'Bánica', 'El Llano', 'Hondo Valle', 'Juan Santiago', 'Pedro Santana'],
  Espaillat: ['Moca', 'Cayetano Germosén', 'Gaspar Hernández', 'Jamao al Norte'],
  'Hato Mayor': ['Hato Mayor del Rey', 'El Valle', 'Sabana de la Mar'],
  'Hermanas Mirabal': ['Salcedo', 'Tenares', 'Villa Tapia'],
  Independencia: ['Jimaní', 'Cristóbal', 'Duvergé', 'La Descubierta', 'Mella', 'Postrer Río'],
  'La Altagracia': ['Higüey', 'San Rafael del Yuma'],
  'La Romana': ['La Romana', 'Guaymate', 'Villa Hermosa'],
  'La Vega': ['La Vega', 'Constanza', 'Jarabacoa', 'Jima Abajo'],
  'María Trinidad Sánchez': ['Nagua', 'Cabrera', 'El Factor', 'Río San Juan'],
  'Monseñor Nouel': ['Bonao', 'Maimón', 'Piedra Blanca'],
  'Monte Plata': ['Monte Plata', 'Bayaguana', 'Peralvillo', 'Sabana Grande de Boyá', 'Yamasá'],
  Montecristi: ['Montecristi', 'Castañuelas', 'Guayubín', 'Las Matas de Santa Cruz', 'Pepillo Salcedo', 'Villa Vásquez'],
  Pedernales: ['Pedernales', 'Oviedo'],
  Peravia: ['Baní', 'Nizao'],
  'Puerto Plata': ['Puerto Plata', 'Altamira', 'Guananico', 'Imbert', 'Los Hidalgos', 'Luperón', 'Sosúa', 'Villa Isabela', 'Villa Montellano'],
  Samaná: ['Samaná', 'Las Terrenas', 'Sánchez'],
  'San Cristóbal': ['San Cristóbal', 'Bajos de Haina', 'Cambita Garabitos', 'Los Cacaos', 'Sabana Grande de Palenque', 'San Gregorio de Nigua', 'Villa Altagracia', 'Yaguate'],
  'San José de Ocoa': ['San José de Ocoa', 'Rancho Arriba', 'Sabana Larga'],
  'San Juan': ['San Juan de la Maguana', 'Bohechío', 'El Cercado', 'Juan de Herrera', 'Las Matas de Farfán', 'Vallejuelo'],
  'San Pedro de Macorís': ['San Pedro de Macorís', 'Consuelo', 'Guayacanes', 'Quisqueya', 'Ramón Santana', 'San José de los Llanos'],
  'Sánchez Ramírez': ['Cotuí', 'Cevicos', 'Fantino', 'La Mata'],
  Santiago: ['Santiago', 'Baitoa', 'Bisonó', 'Jánico', 'Licey al Medio', 'Puñal', 'Sabana Iglesia', 'San José de las Matas', 'Tamboril', 'Villa González'],
  'Santiago Rodríguez': ['San Ignacio de Sabaneta', 'Los Almácigos', 'Monción'],
  'Santo Domingo': ['Santo Domingo Este', 'Santo Domingo Norte', 'Santo Domingo Oeste', 'Boca Chica', 'Los Alcarrizos', 'Pedro Brand', 'San Antonio de Guerra'],
  Valverde: ['Mao', 'Esperanza', 'Laguna Salada'],
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Provincias y municipios con códigos (Provincia_Cod "P01", Municipio_Cod "P01-01"). */
function geografia(): { provincias: Provincia[]; municipios: Municipio[] } {
  const provincias: Provincia[] = []
  const municipios: Municipio[] = []
  Object.entries(MUNICIPIOS_POR_PROVINCIA).forEach(([nombre, munis], i) => {
    const cod = `P${pad2(i + 1)}`
    provincias.push({ cod, nombre })
    munis.forEach((m, k) => municipios.push({ cod: `${cod}-${pad2(k + 1)}`, nombre: m, provinciaCod: cod }))
  })
  return { provincias, municipios }
}

/** Claves de parámetros usadas por el código (tabla Parametros). */
export const PARAM = {
  DIAS_SIN_VISITA_ALERTA: 'DIAS_SIN_VISITA_ALERTA',
  NOTIFICAR_CASOS_PRIORITARIOS: 'NOTIFICAR_CASOS_PRIORITARIOS',
  NOTIFICAR_NUEVOS_VOLUNTARIOS: 'NOTIFICAR_NUEVOS_VOLUNTARIOS',
  CONTACTO_INSTITUCIONAL_NOMBRE: 'CONTACTO_INSTITUCIONAL_NOMBRE',
  CONTACTO_INSTITUCIONAL_TELEFONO: 'CONTACTO_INSTITUCIONAL_TELEFONO',
  DIAS_ESCALAR_NECESIDAD: 'DIAS_ESCALAR_NECESIDAD',
} as const

export function catalogosIniciales(): Catalogos {
  const { provincias, municipios } = geografia()
  return {
    roles: [
      { id: 'admin', nombre: 'Administrador', descripcion: 'Solo en cuentas Organización: gestiona miembros, autoriza familiares, configura la cuenta y su suscripción.' },
      { id: 'coordinador', nombre: 'Coordinador', descripcion: 'Supervisa el seguimiento: asigna cuidadores y tareas, autoriza visitas, gestiona alertas. En cuentas Familia también gestiona los accesos.' },
      { id: 'cuidador', nombre: 'Cuidador', descripcion: 'Registra visitas, necesidades e indicaciones médicas, completa tareas y adjunta evidencias de los adultos que tiene asignados.' },
      { id: 'familiar', nombre: 'Familiar responsable', descripcion: 'Consulta el seguimiento de los adultos mayores para los que recibió permiso explícito.' },
      { id: 'voluntario', nombre: 'Voluntario', descripcion: 'Solo en cuentas Organización: registra que la visita ocurrió y deja una observación.' },
    ],
    tiposCuenta: [
      { id: 'tc-familia', nombre: 'Familia', descripcion: 'Una familia que organiza el cuidado de sus adultos mayores.' },
      { id: 'tc-organizacion', nombre: 'Organización', descripcion: 'Fundación, iglesia, asilo, universidad u otra organización comunitaria.' },
    ],
    // V2 §Cuenta: categorías por tipo de cuenta.
    categoriasCuenta: [
      { id: 'cc-monitoreo', nombre: 'Monitoreo a distancia', tipoCuentaId: 'tc-familia' },
      { id: 'cc-domiciliario', nombre: 'Cuidado domiciliario', tipoCuentaId: 'tc-familia' },
      { id: 'cc-temporal', nombre: 'Cuidado temporal', tipoCuentaId: 'tc-familia' },
      { id: 'cc-asilo', nombre: 'Asilo', tipoCuentaId: 'tc-organizacion' },
      { id: 'cc-iglesia', nombre: 'Iglesia', tipoCuentaId: 'tc-organizacion' },
      { id: 'cc-universidad', nombre: 'Universidad', tipoCuentaId: 'tc-organizacion' },
      { id: 'cc-fundacion', nombre: 'Fundación', tipoCuentaId: 'tc-organizacion' },
    ],
    categoriasPlan: [
      { id: 'pc-basico', nombre: 'Pagado (básico)' },
      { id: 'pc-premium', nombre: 'Pagado (premium)' },
    ],
    // V2 §Plan. Precios referenciales en RD$ (la monetización es informativa en el MVP; sin cobros reales).
    planes: [
      {
        id: 'plan-basico-familiar', nombre: 'Básico Familiar', categoriaId: 'pc-basico', precio: 650, periodicidad: 'mensual', duracionDias: 30, estado: 'activo',
        tipoCuentaId: 'tc-familia', limiteEnvejecientes: 2, limiteUsuarios: null, limiteFamiliares: 3,
        funcionalidades: ['registro_visitas', 'necesidades_diarias', 'visitas_recurrentes'],
        resumen: 'Hasta 2 adultos mayores y 3 familiares, cuidadores sin límite, alertas estándar y visitas recurrentes.',
      },
      {
        id: 'plan-cuidado-integral', nombre: 'Cuidado Integral', categoriaId: 'pc-premium', precio: 1450, periodicidad: 'mensual', duracionDias: 30, estado: 'activo',
        tipoCuentaId: 'tc-familia', limiteEnvejecientes: 6, limiteUsuarios: null, limiteFamiliares: null,
        funcionalidades: ['registro_visitas', 'necesidades_diarias', 'visitas_recurrentes', 'alertas_tiempo_real', 'historial_inmutable', 'dashboard_metricas'],
        resumen: 'Hasta 6 adultos mayores, familiares y cuidadores sin límite, alertas críticas en tiempo real, historial inmutable y dashboard de métricas.',
      },
      {
        id: 'plan-operacion-base', nombre: 'Operación Base', categoriaId: 'pc-basico', precio: 3500, periodicidad: 'mensual', duracionDias: 30, estado: 'activo',
        tipoCuentaId: 'tc-organizacion', limiteEnvejecientes: 15, limiteUsuarios: 20, limiteFamiliares: null,
        funcionalidades: ['registro_visitas', 'necesidades_diarias', 'tablon_notificaciones', 'dashboard_metricas'],
        resumen: 'Hasta 15 adultos mayores y 20 miembros del equipo, registro de visitas, necesidades diarias y tablón de notificaciones.',
      },
      {
        id: 'plan-gestion-avanzada', nombre: 'Gestión Comunitaria Avanzada', categoriaId: 'pc-premium', precio: 8500, periodicidad: 'mensual', duracionDias: 30, estado: 'activo',
        tipoCuentaId: 'tc-organizacion', limiteEnvejecientes: null, limiteUsuarios: null, limiteFamiliares: null,
        funcionalidades: ['registro_visitas', 'necesidades_diarias', 'tablon_notificaciones', 'dashboard_metricas', 'visitas_recurrentes', 'alertas_tiempo_real', 'riesgo_completo', 'org_necesidad', 'reportes_avanzados'],
        resumen: 'Adultos mayores y equipo sin límite, clasificación de riesgo completa, necesidades institucionales y reportes avanzados.',
      },
    ],
    metodosPago: [
      { id: 'mp-transferencia', nombre: 'Transferencia bancaria', activo: true },
      { id: 'mp-tarjeta', nombre: 'Tarjeta de crédito o débito', activo: true },
      { id: 'mp-efectivo', nombre: 'Efectivo', activo: true },
    ],
    provincias,
    municipios,
    tiposNecesidad: [
      { id: 'medicamentos', nombre: 'Medicamentos' },
      { id: 'alimentacion', nombre: 'Alimentación' },
      { id: 'transporte', nombre: 'Transporte' },
      { id: 'compania', nombre: 'Compañía' },
      { id: 'otros', nombre: 'Otros apoyos' },
    ],
    necesidades: [
      { id: 'nc-medicamento', nombre: 'Medicamento recetado', tipo: 'medicamentos', descripcion: 'Reposición de un medicamento indicado por personal de salud.' },
      { id: 'nc-insumos', nombre: 'Insumos de salud', tipo: 'medicamentos', descripcion: 'Pañales, gasas, tiras de glucosa, etc.' },
      { id: 'nc-canasta', nombre: 'Canasta de alimentos', tipo: 'alimentacion' },
      { id: 'nc-suplemento', nombre: 'Suplemento nutricional', tipo: 'alimentacion' },
      { id: 'nc-cita', nombre: 'Traslado a cita médica', tipo: 'transporte' },
      { id: 'nc-diligencia', nombre: 'Traslado para diligencias', tipo: 'transporte' },
      { id: 'nc-acompanamiento', nombre: 'Acompañamiento', tipo: 'compania' },
      { id: 'nc-vivienda', nombre: 'Reparación de vivienda', tipo: 'otros' },
      { id: 'nc-otro', nombre: 'Otro apoyo', tipo: 'otros' },
    ],
    alertas: [
      { id: 'prioritaria', nombre: 'Caso prioritario', descripcion: 'Riesgo "Alto" o necesidad de medicamentos pendiente (RF-04).' },
      { id: 'seguimiento', nombre: 'Seguimiento familiar', descripcion: 'Más días sin visita que el umbral configurado (RF-05).' },
      { id: 'emergencia', nombre: 'Emergencia', descripcion: 'Situación crítica reportada en una visita.' },
      { id: 'necesidad', nombre: 'Necesidad', descripcion: 'Solicitud de apoyo que requiere gestión.' },
    ],
    prioridades: [
      { id: 'alta', nombre: 'Alta' },
      { id: 'media', nombre: 'Media' },
      { id: 'baja', nombre: 'Baja' },
    ],
    riesgos: [
      { id: 'r-social', nombre: 'Vulnerabilidad social general', descripcion: 'Clasificación general asignada al registrar el perfil.' },
      { id: 'r-evaluacion', nombre: 'Evaluación de riesgo', descripcion: 'Resultado del cuestionario de evaluación.' },
      { id: 'r-salud', nombre: 'Salud y movilidad', descripcion: 'Enfermedad crónica, movilidad reducida, caídas.' },
      { id: 'r-economico', nombre: 'Situación económica', descripcion: 'Sin ingresos fijos o vivienda precaria.' },
      { id: 'r-aislamiento', nombre: 'Aislamiento o abandono', descripcion: 'Vive solo/a, sin red de apoyo o con abandono familiar.' },
      { id: 'r-maltrato', nombre: 'Sospecha de maltrato', descripcion: 'Indicios de maltrato físico, psicológico o económico.' },
    ],
    nivelesRiesgo: [
      { id: 'bajo', nombre: 'Bajo' },
      { id: 'medio', nombre: 'Medio' },
      { id: 'alto', nombre: 'Alto' },
    ],
    tiposIndicacion: [
      { id: 'ti-medicamento', nombre: 'Medicamento' },
      { id: 'ti-dieta', nombre: 'Alimentación / dieta' },
      { id: 'ti-actividad', nombre: 'Actividad física' },
      { id: 'ti-control', nombre: 'Control o cita médica' },
      { id: 'ti-cuidado', nombre: 'Cuidado general' },
    ],
    tiposVinculo: [
      { id: 'familiar_responsable', nombre: 'Familiar responsable', descripcion: 'Puede consultar el seguimiento del adulto mayor.' },
      { id: 'cuidador_asignado', nombre: 'Cuidador asignado', descripcion: 'Registra visitas, necesidades e indicaciones y ejecuta las tareas del adulto mayor.' },
      { id: 'voluntario_asignado', nombre: 'Voluntario asignado', descripcion: 'Registra que la visita ocurrió y deja una observación.' },
      { id: 'referente', nombre: 'Referente comunitario', descripcion: 'Acompaña al adulto mayor; no otorga acceso a datos.' },
    ],
    tiposCuidado: [
      { id: 'tcu-voluntario', nombre: 'Voluntario comunitario' },
      { id: 'tcu-remunerado', nombre: 'Cuidador remunerado' },
      { id: 'tcu-familiar', nombre: 'Familiar cuidador' },
    ],
    parametros: [
      { id: 'prm-1', clave: PARAM.DIAS_SIN_VISITA_ALERTA, nombre: 'Días sin visita para alerta', descripcion: 'Días calendario sin visita a partir de los cuales se genera la alerta de seguimiento familiar (RF-05).', tipo: 'numero', valorDefecto: '15' },
      { id: 'prm-2', clave: PARAM.NOTIFICAR_CASOS_PRIORITARIOS, nombre: 'Notificar alertas', descripcion: 'Enviar notificación a coordinadores y administradores cuando se genere una alerta.', tipo: 'booleano', valorDefecto: 'true' },
      { id: 'prm-3', clave: PARAM.NOTIFICAR_NUEVOS_VOLUNTARIOS, nombre: 'Notificar nuevos voluntarios', descripcion: 'Avisar a los administradores cuando un voluntario active su cuenta.', tipo: 'booleano', valorDefecto: 'true' },
      { id: 'prm-4', clave: PARAM.CONTACTO_INSTITUCIONAL_NOMBRE, nombre: 'Contacto institucional', descripcion: 'Nombre de la persona o institución de contacto que se muestra en la ayuda.', tipo: 'texto', valorDefecto: '' },
      { id: 'prm-5', clave: PARAM.CONTACTO_INSTITUCIONAL_TELEFONO, nombre: 'Teléfono institucional', descripcion: 'Teléfono de contacto que se muestra en la ayuda.', tipo: 'texto', valorDefecto: '' },
      { id: 'prm-6', clave: PARAM.DIAS_ESCALAR_NECESIDAD, nombre: 'Días para escalar una necesidad', descripcion: 'Umbral por defecto (Umbral_alerta) tras el que una necesidad pendiente se marca como atrasada.', tipo: 'numero', valorDefecto: '7' },
    ],
  }
}
