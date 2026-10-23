/*
 * seed.ts — Datos maestros y de demostración (SRS §11 "Inicialización de datos maestros": la organización
 * se inicializa con los catálogos de la BD y los cuatro perfiles de rol: Administrador, Coordinador,
 * Voluntario y Familiar responsable). Cubre todas las tablas del modelo de datos V3.0.
 * Módulo: dominio.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { catalogosIniciales } from './datosMaestros'
import { isoAt, toISODate, addDays } from './dates'
import type {
  Adulto,
  Alerta,
  CondicionGeneral,
  ContactoEmergencia,
  DB,
  EstadoAdultoVisita,
  Necesidad,
  Usuario,
  Vinculo,
  Visita,
} from './types'

export const DB_VERSION = 4
export const DEMO_PASSWORD = 'Demo1234'
/** Hash PBKDF2-SHA256 (100 000 iteraciones) de DEMO_PASSWORD con DEMO_SALT: la semilla no guarda contraseñas en claro. */
const DEMO_SALT = 'c7a1d2e3f4a5b6c7d8e9f0a1b2c3d4e5'
const DEMO_HASH = 'b7a4d162d0a09e98d22ee67e0b693eaccd28cf5a6a363df2b60520603f861f3d'
const CHECKLIST_BASE = ['alimentacion', 'medicamentos', 'animo']
const RAZON_SEGUIMIENTO = 'Seguimiento periódico'

/**
 * Visitas completadas de los ~5 meses anteriores (deterministas) para que los gráficos
 * "Visitas por mes" y los historiales tengan datos realistas.
 */
function historialVisitas(): Visita[] {
  const adultos = ['a-elena', 'a-jose', 'a-camila', 'a-maria', 'a-estefan', 'a-alicia']
  const cuidadores = ['u-cuid', 'u-giselle', 'u-cuid', 'u-giselle', 'u-eduardo']
  const estados: EstadoAdultoVisita[] = ['estable', 'estable', 'requiere_atencion', 'estable', 'estable', 'situacion_critica', 'estable']
  const observaciones = [
    'Sin novedades; buen estado de ánimo.',
    'Se revisó la toma de medicamentos.',
    'Refiere molestias leves, se recomienda control médico.',
    'Acompañamiento y conversación por la tarde.',
    'Se verificó la alimentación de la semana.',
  ]
  // visitas por cada mes hacia atrás (de 5 meses atrás al mes pasado)
  const porMes = [6, 9, 7, 11, 13]
  const out: Visita[] = []
  let n = 0
  porMes.forEach((cantidad, i) => {
    const mesesAtras = porMes.length - i // 5…1
    for (let k = 0; k < cantidad; k++) {
      const dias = -(mesesAtras * 30) + Math.round((k * 27) / cantidad) - 13
      const hh = String(9 + (k % 7)).padStart(2, '0')
      out.push({
        id: `vh-${n}`,
        adultoId: adultos[n % adultos.length]!,
        cuidadorId: cuidadores[n % cuidadores.length]!,
        autorizadaPor: 'u-coord',
        razon: RAZON_SEGUIMIENTO,
        tipo: 'Visita de Seguimiento',
        fecha: toISODate(addDays(new Date(), dias)),
        horaPautada: `${hh}:00`,
        inicio: isoAt(dias, `${hh}:05`),
        fin: isoAt(dias, `${hh}:45`),
        estado: 'completada',
        estadoAdulto: estados[n % estados.length],
        observaciones: observaciones[n % observaciones.length],
        detallesAdicionales: [],
        checklist: CHECKLIST_BASE,
        evidencias: [],
        creadaPor: cuidadores[n % cuidadores.length],
        actualizadoEn: isoAt(dias, `${hh}:45`),
      })
      n++
    }
  })
  return out
}

/** Datos de demostración. Las fechas son relativas a "hoy" para que el prototipo siempre se vea vivo. */
export function buildSeed(): DB {
  const hoy = toISODate(new Date())
  const f = (n: number) => toISODate(addDays(new Date(), n))
  /** ISO UTC de hace n días a la hora dada. */
  const t = (n: number, hhmm = '09:00') => isoAt(n, hhmm)
  const ORG = 'org-1'
  const catalogos = catalogosIniciales()
  const mun = (nombre: string) => catalogos.municipios.find((m) => m.nombre === nombre)!.cod
  const DN = mun('Santo Domingo de Guzmán')

  const usuario = (u: Omit<Usuario, 'passwordHash' | 'passwordSalt' | 'orgId' | 'actualizadoEn'>): Usuario => ({
    ...u,
    orgId: ORG,
    passwordHash: DEMO_HASH,
    passwordSalt: DEMO_SALT,
    actualizadoEn: `${u.creadoEn}T12:00:00.000Z`,
  })

  const cond = (autonomia: CondicionGeneral['autonomia'], condiciones: string[]): CondicionGeneral => ({ autonomia, condiciones })

  const adulto = (a: Omit<Adulto, 'orgId' | 'actualizadoEn' | 'consentimiento' | 'registradoPor'>): Adulto => ({
    ...a,
    orgId: ORG,
    consentimiento: { otorgado: true, otorgadoPor: 'adulto', fecha: `${a.creadoEn}T12:00:00.000Z`, registradoPor: 'u-coord' },
    registradoPor: 'u-coord',
    actualizadoEn: `${a.creadoEn}T12:00:00.000Z`,
    actualizadoPor: 'u-coord',
  })

  const visita = (v: Omit<Visita, 'actualizadoEn' | 'checklist' | 'razon' | 'detallesAdicionales'> & Partial<Pick<Visita, 'checklist' | 'razon' | 'detallesAdicionales'>>): Visita => ({
    checklist: v.estado === 'completada' ? CHECKLIST_BASE : [],
    razon: RAZON_SEGUIMIENTO,
    detallesAdicionales: [],
    autorizadaPor: 'u-coord',
    ...v,
    creadaPor: v.cuidadorId,
    actualizadoEn: v.fin ?? `${v.fecha}T08:00:00.000Z`,
  })

  const necesidad = (
    n: Omit<Necesidad, 'historial' | 'actualizadoEn' | 'recurrente' | 'prioridad'> & Partial<Pick<Necesidad, 'recurrente' | 'prioridad'>> & { gestionadaPor?: string; gestionadaEn?: string },
  ): Necesidad => {
    const { gestionadaPor, gestionadaEn, ...resto } = n
    const fechaCambio = n.satisfechaEn ?? gestionadaEn ?? n.creadaEn
    return {
      recurrente: false,
      prioridad: n.tipo === 'medicamentos' ? 'alta' : 'media',
      ...resto,
      historial: [
        { estado: 'pendiente', fecha: n.creadaEn, usuarioId: n.registradaPor },
        ...(n.estado !== 'pendiente' ? [{ estado: n.estado, fecha: fechaCambio, usuarioId: n.satisfechaPor ?? gestionadaPor ?? n.registradaPor }] : []),
      ],
      actualizadoEn: fechaCambio,
      actualizadoPor: n.satisfechaPor ?? gestionadaPor ?? n.registradaPor,
    }
  }

  const alerta = (
    a: Omit<Alerta, 'acciones' | 'leidaPor' | 'actualizadoEn' | 'condiciones'> & Partial<Pick<Alerta, 'acciones' | 'condiciones'>>,
  ): Alerta => ({
    condiciones: [],
    acciones: [],
    leidaPor: [],
    ...a,
    actualizadoEn: a.atendidaEn ?? a.acciones?.at(-1)?.fecha ?? a.creadaEn,
  })

  let nc = 0
  const contacto = (adultoId: string, nombres: string, apellidos: string, parentesco: string, telefono: string, esPrincipal = true): ContactoEmergencia => ({
    id: `ce-${++nc}`,
    adultoId,
    nombres,
    apellidos,
    parentesco,
    telefono,
    esPrincipal,
  })

  const vinculo = (usuarioId: string, adultoId: string, tipoVinculoId: Vinculo['tipoVinculoId'], dias: number): Vinculo => ({ usuarioId, adultoId, tipoVinculoId, creadoEn: t(dias) })

  const adultos: Adulto[] = [
    adulto({ id: 'a-elena', nombre: 'Elena', apellido: 'Rodríguez', cedula: '001-0012154-2', fechaNacimiento: '1950-10-18', sexo: 'Femenino', telefono: '809 787 1234', municipioCod: DN, zona: 'Renacimiento', direccion: 'Calle 5 #12, casa verde', riesgo: 'medio', condicionGeneral: cond('parcial', ['cronica', 'vive_solo']), estado: 'activo', creadoEn: f(-100) }),
    adulto({ id: 'a-jose', nombre: 'José', apellido: 'Santana', cedula: '001-6545889-2', fechaNacimiento: '1944-03-02', sexo: 'Masculino', telefono: '809 555 4411', municipioCod: DN, zona: 'El Millón', direccion: 'Av. Núñez de Cáceres #301, apto 2B', riesgo: 'alto', condicionGeneral: cond('dependiente', ['cronica', 'movilidad', 'sin_ingresos']), estado: 'activo', creadoEn: f(-95) }),
    adulto({ id: 'a-camila', nombre: 'Camila', apellido: 'Torres', cedula: '001-0012554-8', fechaNacimiento: '1952-07-21', sexo: 'Femenino', telefono: '809 666 7712', municipioCod: DN, zona: 'Renacimiento', direccion: 'Calle 9 #4', riesgo: 'bajo', condicionGeneral: cond('independiente', ['cronica']), estado: 'activo', creadoEn: f(-80) }),
    adulto({ id: 'a-maria', nombre: 'María', apellido: 'García', cedula: '001-3344556-7', fechaNacimiento: '1948-01-12', sexo: 'Femenino', telefono: '809 321 9087', municipioCod: mun('Santo Domingo Este'), zona: 'Los Mina', direccion: 'Calle Respaldo 3 #18', riesgo: 'medio', condicionGeneral: cond('parcial', ['sensorial', 'aislamiento']), estado: 'activo', creadoEn: f(-70) }),
    adulto({ id: 'a-alicia', nombre: 'Alicia', apellido: 'Castillo', cedula: '001-7788990-1', fechaNacimiento: '1961-05-30', sexo: 'Femenino', telefono: '809 400 1122', municipioCod: DN, zona: 'Gazcue', direccion: 'Calle Santiago #210', riesgo: 'bajo', condicionGeneral: cond('independiente', []), estado: 'activo', creadoEn: f(-50) }),
    adulto({ id: 'a-josem', nombre: 'José', apellido: 'Martínez', cedula: '001-1010101-0', fechaNacimiento: '1958-09-09', sexo: 'Masculino', telefono: '809 700 8899', municipioCod: mun('Santo Domingo Norte'), zona: 'Villa Mella', direccion: 'Calle Principal #45, detrás del colmado', riesgo: 'alto', condicionGeneral: cond('dependiente', ['movilidad', 'vivienda', 'vive_solo']), estado: 'activo', creadoEn: f(-40) }),
    adulto({ id: 'a-estefan', nombre: 'Estefan', apellido: 'Durán', cedula: '001-2020202-1', fechaNacimiento: '1938-12-25', sexo: 'Masculino', telefono: '809 800 5566', municipioCod: DN, zona: 'Naco', direccion: 'Calle Fantino Falco #7', riesgo: 'medio', condicionGeneral: cond('parcial', ['cognitivo']), estado: 'activo', creadoEn: f(-30) }),
  ]

  return {
    version: DB_VERSION,
    catalogos,
    orgs: [
      {
        id: ORG,
        nombre: 'Fundación Esperanza',
        tipoCuentaId: 'tc-fundacion',
        categoriaCuentaId: 'cc-sin-fines',
        municipioCod: DN,
        direccion: 'Calle Las Damas #15, Zona Colonial',
        telefono: '809 555 0100',
        correo: 'contacto@fundacionesperanza.org',
        suscripcionEstado: 'activa',
        creadoEn: t(-420),
        pruebaGratuita: true,
        fechaInicioPrueba: f(-420),
        fechaFinPrueba: f(-390),
        planId: 'plan-comunitario',
        planPrecio: 1500,
        usuarioTitularId: 'u-admin',
      },
    ],
    configuracion: [
      { orgId: ORG, parametroId: 'prm-4', valor: 'Fundación Esperanza', actualizadoEn: t(-400) },
      { orgId: ORG, parametroId: 'prm-5', valor: '809 555 0100', actualizadoEn: t(-400) },
    ],
    pagos: [
      { id: 'pg-1', orgId: ORG, planId: 'plan-comunitario', usuarioId: 'u-admin', monto: 1500, metodoPagoId: 'mp-transferencia', estado: 'confirmado', fecha: t(-62), referencia: 'TRF-88213' },
      { id: 'pg-2', orgId: ORG, planId: 'plan-comunitario', usuarioId: 'u-admin', monto: 1500, metodoPagoId: 'mp-transferencia', estado: 'confirmado', fecha: t(-32), referencia: 'TRF-90544' },
      { id: 'pg-3', orgId: ORG, planId: 'plan-comunitario', usuarioId: 'u-admin', monto: 1500, metodoPagoId: 'mp-tarjeta', estado: 'registrado', fecha: t(-2) },
    ],
    usuarios: [
      // Cuentas demo: los cuatro roles del sistema (contraseña Demo1234)
      usuario({ id: 'u-cuid', rol: 'voluntario', nombre: 'Carlos', apellido: 'Ruiz', cedula: '001-8755156-2', email: 'voluntario@cuidared.do', telefono: '829 777 9865', etiqueta: 'Voluntario', estado: 'activo', creadoEn: f(-120) }),
      usuario({ id: 'u-fam', rol: 'familiar', nombre: 'Clara', apellido: 'Rodríguez', cedula: '001-1122334-5', email: 'familiar@cuidared.do', telefono: '809 444 2211', etiqueta: 'Familiar responsable', estado: 'activo', creadoEn: f(-200) }),
      usuario({ id: 'u-admin', rol: 'admin', nombre: 'Andrea', apellido: 'Peña', cedula: '001-1234567-8', email: 'admin@cuidared.do', telefono: '829 777 1100', etiqueta: 'Administrador', estado: 'activo', creadoEn: f(-400) }),
      usuario({ id: 'u-coord', rol: 'coordinador', nombre: 'Laura', apellido: 'Núñez', cedula: '001-5566778-9', email: 'coordinador@cuidared.do', telefono: '809 333 7788', etiqueta: 'Coordinador', estado: 'activo', creadoEn: f(-300) }),
      // Otros miembros de la organización
      usuario({ id: 'u-giselle', rol: 'voluntario', nombre: 'Giselle', apellido: 'Mejía', cedula: '001-0012154-3', email: 'giselle.mejia@gmail.com', telefono: '809 787 1234', etiqueta: 'Voluntario', estado: 'activo', creadoEn: f(-90) }),
      usuario({ id: 'u-ctorres', rol: 'coordinador', nombre: 'Carlos', apellido: 'Torres', cedula: '001-2233445-6', email: 'carlos.torres@cuidared.do', telefono: '809 222 3344', etiqueta: 'Coordinador', estado: 'activo', creadoEn: f(-150) }),
      usuario({ id: 'u-eduardo', rol: 'voluntario', nombre: 'Eduardo', apellido: 'Hernández', cedula: '001-9988776-5', email: 'eduardo.h@gmail.com', telefono: '829 111 2233', etiqueta: 'Voluntario', estado: 'inactivo', creadoEn: f(-60) }),
    ],
    membresias: [
      { id: 'm-1', usuarioId: 'u-admin', orgId: ORG, rol: 'admin', estado: 'activa', fechaInicio: t(-400) },
      { id: 'm-2', usuarioId: 'u-coord', orgId: ORG, rol: 'coordinador', estado: 'activa', fechaInicio: t(-300) },
      { id: 'm-3', usuarioId: 'u-cuid', orgId: ORG, rol: 'voluntario', estado: 'activa', fechaInicio: t(-120) },
      { id: 'm-4', usuarioId: 'u-fam', orgId: ORG, rol: 'familiar', estado: 'activa', fechaInicio: t(-200) },
      { id: 'm-5', usuarioId: 'u-giselle', orgId: ORG, rol: 'voluntario', estado: 'activa', fechaInicio: t(-90) },
      { id: 'm-6', usuarioId: 'u-ctorres', orgId: ORG, rol: 'voluntario', estado: 'inactiva', fechaInicio: t(-200), fechaFin: t(-150) },
      { id: 'm-7', usuarioId: 'u-ctorres', orgId: ORG, rol: 'coordinador', estado: 'activa', fechaInicio: t(-150) },
      { id: 'm-8', usuarioId: 'u-eduardo', orgId: ORG, rol: 'voluntario', estado: 'inactiva', fechaInicio: t(-60), fechaFin: t(-10) },
    ],
    cuidadores: [
      { id: 'cu-1', usuarioId: 'u-cuid', tipoCuidadoId: 'tcu-voluntario', fechaInicio: f(-120), independiente: true },
      { id: 'cu-2', usuarioId: 'u-giselle', tipoCuidadoId: 'tcu-remunerado', fechaInicio: f(-90), independiente: false, empleadorUsuarioId: 'u-fam' },
    ],
    notificaciones: [],
    adultos,
    contactos: [
      contacto('a-elena', 'Clara', 'Rodríguez', 'Hijo/a', '849 787 0348'),
      contacto('a-elena', 'Pedro', 'Rodríguez', 'Hijo/a', '829 787 1100', false),
      contacto('a-jose', 'Rosa', 'Santana', 'Esposo/a', '829 555 0192'),
      contacto('a-camila', 'Pedro', 'Torres', 'Sobrino/a', '809 666 0001'),
      contacto('a-maria', 'Luis', 'García', 'Hijo/a', '829 321 0000'),
      contacto('a-alicia', 'Katriel', 'Castillo', 'Hijo/a', '809 400 3344'),
      contacto('a-josem', 'Ana', 'Martínez', 'Hermano/a', '809 700 1100'),
      contacto('a-estefan', 'Marta', 'Durán', 'Hijo/a', '829 800 7788'),
    ],
    vinculos: [
      // Familiar responsable (Clara): su madre Elena y otros dos adultos de la familia
      vinculo('u-fam', 'a-elena', 'familiar_responsable', -200),
      vinculo('u-fam', 'a-maria', 'familiar_responsable', -70),
      vinculo('u-fam', 'a-estefan', 'familiar_responsable', -30),
      // Voluntarios asignados
      vinculo('u-cuid', 'a-elena', 'voluntario_asignado', -100),
      vinculo('u-cuid', 'a-jose', 'voluntario_asignado', -95),
      vinculo('u-cuid', 'a-camila', 'voluntario_asignado', -80),
      vinculo('u-giselle', 'a-elena', 'voluntario_asignado', -90),
      vinculo('u-giselle', 'a-maria', 'voluntario_asignado', -70),
    ],
    riesgos: [
      { id: 'er-1', adultoId: 'a-elena', riesgoId: 'r-social', fecha: t(-100), nivel: 'medio', estado: 'vigente', motivo: 'Vive sola y tiene una enfermedad crónica.', registradoPor: 'u-coord' },
      { id: 'er-2', adultoId: 'a-jose', riesgoId: 'r-social', fecha: t(-95), nivel: 'alto', estado: 'vigente', motivo: 'Dependiente, sin ingresos fijos.', registradoPor: 'u-coord' },
      { id: 'er-3', adultoId: 'a-jose', riesgoId: 'r-salud', fecha: t(-20), nivel: 'alto', estado: 'vigente', motivo: 'Movilidad reducida y riesgo de caídas.', observacion: 'Usa andador; vivienda con escalones.', registradoPor: 'u-cuid' },
      { id: 'er-4', adultoId: 'a-camila', riesgoId: 'r-social', fecha: t(-80), nivel: 'bajo', estado: 'vigente', motivo: 'Independiente, buena red familiar.', registradoPor: 'u-coord' },
      { id: 'er-5', adultoId: 'a-maria', riesgoId: 'r-social', fecha: t(-70), nivel: 'medio', estado: 'vigente', motivo: 'Dificultad auditiva y aislamiento.', registradoPor: 'u-coord' },
      { id: 'er-6', adultoId: 'a-maria', riesgoId: 'r-aislamiento', fecha: t(-40), nivel: 'alto', estado: 'superado', motivo: 'Pasaba días sin contacto.', observacion: 'Superado: ahora recibe visitas semanales.', registradoPor: 'u-giselle' },
      { id: 'er-7', adultoId: 'a-alicia', riesgoId: 'r-social', fecha: t(-50), nivel: 'bajo', estado: 'vigente', motivo: 'Independiente.', registradoPor: 'u-coord' },
      { id: 'er-8', adultoId: 'a-josem', riesgoId: 'r-social', fecha: t(-40), nivel: 'alto', estado: 'vigente', motivo: 'Vive solo en vivienda precaria, dependiente.', registradoPor: 'u-coord' },
      { id: 'er-9', adultoId: 'a-estefan', riesgoId: 'r-social', fecha: t(-30), nivel: 'medio', estado: 'vigente', motivo: 'Deterioro de memoria.', registradoPor: 'u-coord' },
    ],
    indicaciones: [
      { id: 'im-1', adultoId: 'a-jose', tipoIndicacionId: 'ti-medicamento', titulo: 'Losartán 50 mg', descripcion: 'Una tableta en la mañana, según receta de su médico de cabecera.', frecuenciaHorario: 'Diario · 8:00 a.m.', fechaInicio: f(-60), estado: 'vigente', evidencia: 'receta-losartan.jpg', registradaPor: 'u-coord', actualizadoEn: t(-60) },
      { id: 'im-2', adultoId: 'a-elena', tipoIndicacionId: 'ti-control', titulo: 'Control de presión arterial', descripcion: 'Tomar la presión y anotarla en cada visita.', frecuenciaHorario: 'En cada visita', fechaInicio: f(-30), estado: 'vigente', registradaPor: 'u-coord', actualizadoEn: t(-30) },
      { id: 'im-3', adultoId: 'a-camila', tipoIndicacionId: 'ti-dieta', titulo: 'Dieta baja en azúcar', descripcion: 'Evitar refrescos y dulces; preferir frutas enteras.', frecuenciaHorario: 'Permanente', fechaInicio: f(-80), estado: 'vigente', registradaPor: 'u-coord', actualizadoEn: t(-80) },
      { id: 'im-4', adultoId: 'a-camila', tipoIndicacionId: 'ti-medicamento', titulo: 'Metformina 850 mg', descripcion: 'Tratamiento anterior, suspendido por su médico.', frecuenciaHorario: 'Diario · con el almuerzo', fechaInicio: f(-80), fechaFin: f(-18), estado: 'finalizada', registradaPor: 'u-coord', actualizadoEn: t(-18) },
    ],
    visitas: [
      visita({ id: 'v-1', adultoId: 'a-elena', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', fecha: f(-1), horaPautada: '16:30', inicio: isoAt(-1, '16:35'), fin: isoAt(-1, '17:20'), estado: 'completada', estadoAdulto: 'estable', observaciones: 'Se encuentra de buen ánimo, tomó sus medicamentos.', checklist: ['alimentacion', 'medicamentos', 'higiene', 'animo'], evidencias: [] }),
      visita({ id: 'v-2', adultoId: 'a-jose', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', razon: 'Revisión de medicamentos', fecha: hoy, horaPautada: '12:00', inicio: isoAt(0, '12:02'), fin: isoAt(0, '12:50'), estado: 'completada', estadoAdulto: 'requiere_atencion', observaciones: 'Refiere dolor en la rodilla izquierda.', checklist: ['alimentacion', 'movilidad'], evidencias: [] }),
      visita({ id: 'v-3', adultoId: 'a-elena', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', fecha: hoy, horaPautada: '15:00', estado: 'pendiente', notas: 'Verificar estado general y confirmar si recibió los medicamentos solicitados durante la visita anterior.', evidencias: [] }),
      visita({ id: 'v-4', adultoId: 'a-jose', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', razon: 'Control de presión arterial', fecha: f(1), horaPautada: '10:30', estado: 'pendiente', notas: 'Llevar tensiómetro.', evidencias: [] }),
      visita({ id: 'v-5', adultoId: 'a-camila', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', fecha: f(2), horaPautada: '09:00', estado: 'pendiente', evidencias: [] }),
      visita({ id: 'v-6', adultoId: 'a-camila', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', fecha: f(-6), horaPautada: '11:00', inicio: isoAt(-6, '11:05'), fin: isoAt(-6, '11:45'), estado: 'completada', estadoAdulto: 'estable', observaciones: 'Sin novedades.', evidencias: [] }),
      visita({ id: 'v-7', adultoId: 'a-maria', cuidadorId: 'u-giselle', tipo: 'Visita de Seguimiento', fecha: f(-3), horaPautada: '10:00', inicio: isoAt(-3, '10:10'), fin: isoAt(-3, '10:55'), estado: 'completada', estadoAdulto: 'estable', observaciones: 'Visita sin novedades.', evidencias: [] }),
      // Visita a un hogar con dos adultos (DetalleVisita con dos filas)
      visita({ id: 'v-8', adultoId: 'a-elena', cuidadorId: 'u-giselle', tipo: 'Visita de Seguimiento', razon: 'Visita familiar conjunta', fecha: f(-9), horaPautada: '10:00', inicio: isoAt(-9, '10:00'), fin: isoAt(-9, '10:40'), estado: 'completada', estadoAdulto: 'estable', observaciones: 'Control rutinario.', detallesAdicionales: [{ adultoId: 'a-maria', observacion: 'Estaba de visita en casa de Elena; buen estado general.' }], evidencias: [] }),
      ...historialVisitas(),
    ],
    necesidades: [
      necesidad({ id: 'n-1', adultoId: 'a-elena', catalogoId: 'nc-acompanamiento', registradaPor: 'u-cuid', tipo: 'compania', descripcion: 'Le gustaría recibir más compañía por las tardes; se siente sola.', recurrente: true, prioridad: 'media', estado: 'pendiente', creadaEn: t(-1, '12:30'), responsableId: 'u-coord' }),
      necesidad({ id: 'n-2', adultoId: 'a-jose', catalogoId: 'nc-medicamento', registradaPor: 'u-cuid', tipo: 'medicamentos', descripcion: 'Necesita reposición de losartán 50 mg (quedan 3 días).', cantidad: 30, unidad: 'tabletas', recurrente: true, prioridad: 'alta', estado: 'pendiente', creadaEn: t(0, '12:40'), indicacionId: 'im-1', umbralAlertaDias: 3, responsableId: 'u-coord' }),
      necesidad({ id: 'n-3', adultoId: 'a-maria', catalogoId: 'nc-cita', registradaPor: 'u-giselle', tipo: 'transporte', descripcion: 'Requiere transporte a su cita de cardiología el viernes.', estado: 'en_proceso', creadaEn: t(-2, '10:30'), gestionadaPor: 'u-coord', gestionadaEn: t(-1, '09:00'), responsableId: 'u-coord' }),
      necesidad({ id: 'n-4', adultoId: 'a-elena', catalogoId: 'nc-canasta', registradaPor: 'u-giselle', tipo: 'alimentacion', descripcion: 'Canasta de alimentos del mes.', cantidad: 1, unidad: 'canasta', recurrente: true, estado: 'satisfecha', creadaEn: t(-12), satisfechaEn: t(-10, '15:00'), satisfechaPor: 'u-coord', motivoResolucion: 'Entregada por la parroquia.' }),
      necesidad({ id: 'n-5', adultoId: 'a-camila', catalogoId: 'nc-medicamento', registradaPor: 'u-cuid', tipo: 'medicamentos', descripcion: 'Reposición de metformina 850 mg.', cantidad: 60, unidad: 'tabletas', estado: 'satisfecha', creadaEn: t(-20, '10:00'), satisfechaEn: t(-18, '11:30'), satisfechaPor: 'u-coord', motivoResolucion: 'Donación de farmacia comunitaria.', indicacionId: 'im-4' }),
      necesidad({ id: 'n-6', adultoId: 'a-estefan', catalogoId: 'nc-acompanamiento', registradaPor: 'u-giselle', tipo: 'compania', descripcion: 'Acompañamiento a misa dominical.', recurrente: true, prioridad: 'baja', estado: 'satisfecha', creadaEn: t(-35, '08:00'), satisfechaEn: t(-33, '12:00'), satisfechaPor: 'u-ctorres', motivoResolucion: 'Lo acompaña un voluntario de la iglesia.' }),
      necesidad({ id: 'n-7', adultoId: 'a-josem', catalogoId: 'nc-vivienda', registradaPor: 'u-coord', tipo: 'otros', descripcion: 'Reparación de la rampa de acceso a la vivienda.', prioridad: 'alta', estado: 'pendiente', creadaEn: t(-4, '16:00'), umbralAlertaDias: 10 }),
      necesidad({ id: 'n-8', adultoId: 'a-alicia', catalogoId: 'nc-suplemento', registradaPor: 'u-coord', tipo: 'alimentacion', descripcion: 'Suplemento nutricional recomendado por su médico.', cantidad: 2, unidad: 'latas', estado: 'inactiva', creadaEn: t(-15, '09:30'), gestionadaPor: 'u-coord', gestionadaEn: t(-14, '09:30'), motivoResolucion: 'La familia lo cubre directamente.' }),
    ],
    // Alertas registradas manualmente o desde visitas. Las de caso prioritario (RF-04), seguimiento
    // familiar (RF-05) y necesidades atrasadas las genera el motor de reglas al cargar los datos.
    alertas: [
      alerta({ id: 'al-1', adultoId: 'a-elena', tipo: 'emergencia', severidad: 'alta', categoria: 'EMERGENCIA MÉDICA', titulo: 'Situación crítica reportada en visita', descripcion: 'Durante la visita se reportó mareo y presión arterial elevada. Se requiere atención inmediata.', condiciones: ['Situación crítica reportada en visita'], creadaEn: t(0, '09:15'), estado: 'pendiente', generadaPor: 'u-giselle' }),
      alerta({ id: 'al-3', adultoId: 'a-camila', tipo: 'necesidad', severidad: 'baja', categoria: 'NECESIDAD', titulo: 'Actualización de plan de alimentación', descripcion: 'Se solicitó revisar el plan de alimentación con la familia.', creadaEn: t(-2, '14:00'), estado: 'atendida', generadaPor: 'u-cuid', atendidaPor: 'u-coord', atendidaEn: t(-1, '10:00'), notaAtencion: 'Se coordinó con la familia la nueva canasta.', acciones: [{ id: 'ac-1', fecha: t(-1, '10:00'), usuarioId: 'u-coord', estado: 'atendida', nota: 'Se coordinó con la familia la nueva canasta.' }] }),
      alerta({ id: 'al-5', adultoId: 'a-maria', tipo: 'necesidad', severidad: 'media', categoria: 'NECESIDAD', titulo: 'Solicitud de apoyo para cita médica', descripcion: 'Solicitud de apoyo para traslado a cita médica programada en el hospital central.', creadaEn: t(-2, '10:30'), estado: 'en_atencion', generadaPor: 'u-giselle', acciones: [{ id: 'ac-2', fecha: t(-1, '09:00'), usuarioId: 'u-coord', estado: 'en_atencion', nota: 'Se está gestionando transporte con la junta de vecinos.' }] }),
    ],
    tareas: [
      { id: 'ta-1', cuidadorId: 'cu-1', indicacionId: 'im-1', adultoId: 'a-jose', titulo: 'Verificar toma de losartán', fechaProgramada: hoy, horaProgramada: '08:00', prioridad: 'alta', estado: 'pendiente', requiereEvidencia: true, repetitiva: true, creadaPor: 'u-coord', actualizadoEn: t(-5) },
      { id: 'ta-2', cuidadorId: 'cu-1', indicacionId: 'im-2', adultoId: 'a-elena', titulo: 'Tomar la presión arterial', fechaProgramada: hoy, horaProgramada: '15:00', prioridad: 'media', estado: 'pendiente', requiereEvidencia: false, repetitiva: false, creadaPor: 'u-coord', actualizadoEn: t(-2) },
      { id: 'ta-3', cuidadorId: 'cu-2', adultoId: 'a-maria', titulo: 'Acompañar a la cita de cardiología', fechaProgramada: f(2), horaProgramada: '07:30', prioridad: 'alta', estado: 'pendiente', requiereEvidencia: true, repetitiva: false, creadaPor: 'u-coord', actualizadoEn: t(-1) },
      { id: 'ta-4', cuidadorId: 'cu-1', indicacionId: 'im-1', adultoId: 'a-jose', titulo: 'Verificar toma de losartán', fechaProgramada: f(-1), horaProgramada: '08:00', prioridad: 'alta', estado: 'completada', requiereEvidencia: true, repetitiva: true, creadaPor: 'u-coord', actualizadoEn: t(-1, '08:20') },
    ],
    evidencias: [
      { id: 'ev-1', tareaId: 'ta-4', fechaRegistro: t(-1, '08:20'), archivo: 'foto-pastillero.jpg', observacion: 'Pastillero del día vacío a la hora indicada.', estadoValidacion: 'validada', registradaPor: 'u-cuid', validadaPor: 'u-coord' },
    ],
    invitaciones: [],
    auditoria: [],
    bloqueos: {},
    recuperaciones: [],
  }
}
