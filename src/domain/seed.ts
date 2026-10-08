import { isoAt, toISODate, addDays } from './dates'
import type { DB, EstadoAdultoVisita, Visita } from './types'

export const DB_VERSION = 2
export const DEMO_PASSWORD = 'Demo1234'

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
        adultoId: adultos[n % adultos.length],
        cuidadorId: cuidadores[n % cuidadores.length],
        tipo: 'Visita de Seguimiento',
        fecha: toISODate(addDays(new Date(), dias)),
        horaPautada: `${hh}:00`,
        inicio: isoAt(dias, `${hh}:05`),
        fin: isoAt(dias, `${hh}:45`),
        estado: 'completada',
        estadoAdulto: estados[n % estados.length],
        observaciones: observaciones[n % observaciones.length],
        evidencias: [],
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
  const ORG = 'org-1'

  return {
    version: DB_VERSION,
    sessionUserId: null,
    orgs: [
      {
        id: ORG,
        nombre: 'Fundación Esperanza',
        tipo: 'Fundación',
        telefono: '809 555 0100',
        provincia: 'Distrito Nacional',
        municipio: 'Santo Domingo',
        config: {
          diasSinVisitaAlerta: 15,
          notificarCasosPrioritarios: true,
          notificarNuevosVoluntarios: true,
          contactoInstitucional: { nombre: 'Fundación Esperanza', telefono: '809 555 0100' },
        },
      },
    ],
    familias: [
      { id: 'fam-1', nombre: 'Flia. Rodríguez', orgId: ORG },
      { id: 'fam-2', nombre: 'Flia. Santana', orgId: ORG },
      { id: 'fam-3', nombre: 'Flia. Torres', orgId: ORG },
    ],
    usuarios: [
      // Cuentas demo (todas con contraseña Demo1234)
      { id: 'u-cuid', rol: 'cuidador', nombre: 'Carlos', apellido: 'Ruiz', cedula: '001-8755156-2', email: 'cuidador@cuidared.do', telefono: '829 777 9865', password: DEMO_PASSWORD, etiqueta: 'Voluntario', estado: 'activo', orgId: ORG, familiaIds: ['fam-1', 'fam-2', 'fam-3'], creadoEn: f(-120) },
      { id: 'u-fam', rol: 'familiar', nombre: 'Clara', apellido: 'Rodríguez', cedula: '001-1122334-5', email: 'familiar@cuidared.do', telefono: '809 444 2211', password: DEMO_PASSWORD, etiqueta: 'Familiar', estado: 'activo', orgId: ORG, familiaIds: ['fam-1'], creadoEn: f(-200) },
      { id: 'u-admin', rol: 'admin', nombre: 'Carlos', apellido: 'Ruiz', cedula: '001-1234567-8', email: 'admin@cuidared.do', telefono: '829 777 9865', password: DEMO_PASSWORD, etiqueta: 'Administrador', estado: 'activo', orgId: ORG, familiaIds: [], creadoEn: f(-400) },
      { id: 'u-coord', rol: 'coordinador', nombre: 'Laura', apellido: 'Núñez', cedula: '001-5566778-9', email: 'coordinador@cuidared.do', telefono: '809 333 7788', password: DEMO_PASSWORD, etiqueta: 'Coordinador', estado: 'activo', orgId: ORG, familiaIds: [], creadoEn: f(-300) },
      // Otros miembros de la organización
      { id: 'u-giselle', rol: 'cuidador', nombre: 'Giselle', apellido: 'Mejía', cedula: '001-0012154-2', email: 'giselle.mejia@gmail.com', telefono: '809 787 1234', password: DEMO_PASSWORD, etiqueta: 'Cuidador', estado: 'activo', orgId: ORG, familiaIds: ['fam-1'], creadoEn: f(-90) },
      { id: 'u-ctorres', rol: 'coordinador', nombre: 'Carlos', apellido: 'Torres', cedula: '001-2233445-6', email: 'carlos.torres@cuidared.do', telefono: '809 222 3344', password: DEMO_PASSWORD, etiqueta: 'Coordinador', estado: 'activo', orgId: ORG, familiaIds: [], creadoEn: f(-150) },
      { id: 'u-eduardo', rol: 'cuidador', nombre: 'Eduardo', apellido: 'Hernández', cedula: '001-9988776-5', email: 'eduardo.h@gmail.com', telefono: '829 111 2233', password: DEMO_PASSWORD, etiqueta: 'Cuidador', estado: 'inactivo', orgId: ORG, familiaIds: ['fam-2'], creadoEn: f(-60) },
    ],
    adultos: [
      { id: 'a-elena', orgId: ORG, familiaId: 'fam-1', nombre: 'Elena', apellido: 'Rodríguez', cedula: '001-0012154-2', fechaNacimiento: '1950-10-18', sexo: 'Femenino', telefono: '809 787 1234', zona: 'D.N., Renacimiento', municipio: 'Santo Domingo', contactoEmergencia: { nombre: 'Clara Rodríguez', telefono: '849 787 0348' }, riesgo: 'medio', estado: 'activo', cuidadorIds: ['u-cuid', 'u-giselle'], creadoEn: f(-100) },
      { id: 'a-jose', orgId: ORG, familiaId: 'fam-2', nombre: 'José', apellido: 'Santana', cedula: '001-6545889-2', fechaNacimiento: '1944-03-02', sexo: 'Masculino', telefono: '809 555 4411', zona: 'D.N., El Millón', municipio: 'Santo Domingo', contactoEmergencia: { nombre: 'Rosa Santana', telefono: '829 555 0192' }, riesgo: 'alto', estado: 'activo', cuidadorIds: ['u-cuid'], creadoEn: f(-95) },
      { id: 'a-camila', orgId: ORG, familiaId: 'fam-3', nombre: 'Camila', apellido: 'Torres', cedula: '001-0012554-8', fechaNacimiento: '1952-07-21', sexo: 'Femenino', telefono: '809 666 7712', zona: 'D.N., Renacimiento', municipio: 'Santo Domingo', contactoEmergencia: { nombre: 'Pedro Torres', telefono: '809 666 0001' }, riesgo: 'bajo', estado: 'activo', cuidadorIds: ['u-cuid'], creadoEn: f(-80) },
      { id: 'a-maria', orgId: ORG, familiaId: 'fam-1', nombre: 'María', apellido: 'García', cedula: '001-3344556-7', fechaNacimiento: '1948-01-12', sexo: 'Femenino', telefono: '809 321 9087', zona: 'D.N., Los Mina', municipio: 'Santo Domingo Este', contactoEmergencia: { nombre: 'Luis García', telefono: '829 321 0000' }, riesgo: 'medio', estado: 'activo', cuidadorIds: ['u-giselle'], creadoEn: f(-70) },
      { id: 'a-alicia', orgId: ORG, familiaId: 'fam-2', nombre: 'Alicia', apellido: 'Castillo', cedula: '001-7788990-1', fechaNacimiento: '1961-05-30', sexo: 'Femenino', telefono: '809 400 1122', zona: 'D.N., Gazcue', municipio: 'Santo Domingo', contactoEmergencia: { nombre: 'Katriel Castillo', telefono: '809 400 3344' }, riesgo: 'bajo', estado: 'activo', cuidadorIds: [], creadoEn: f(-50) },
      { id: 'a-josem', orgId: ORG, familiaId: 'fam-3', nombre: 'José', apellido: 'Martínez', cedula: '001-1010101-0', fechaNacimiento: '1968-09-09', sexo: 'Masculino', telefono: '809 700 8899', zona: 'D.N., Villa Mella', municipio: 'Santo Domingo Norte', contactoEmergencia: { nombre: 'Ana Martínez', telefono: '809 700 1100' }, riesgo: 'alto', estado: 'activo', cuidadorIds: [], creadoEn: f(-40) },
      { id: 'a-estefan', orgId: ORG, familiaId: 'fam-1', nombre: 'Estefan', apellido: 'Durán', cedula: '001-2020202-1', fechaNacimiento: '1938-12-25', sexo: 'Masculino', telefono: '809 800 5566', zona: 'D.N., Naco', municipio: 'Santo Domingo', contactoEmergencia: { nombre: 'Marta Durán', telefono: '829 800 7788' }, riesgo: 'medio', estado: 'activo', cuidadorIds: [], creadoEn: f(-30) },
    ],
    visitas: [
      { id: 'v-1', adultoId: 'a-elena', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', fecha: f(-1), horaPautada: '16:30', inicio: isoAt(-1, '16:35'), fin: isoAt(-1, '17:20'), estado: 'completada', estadoAdulto: 'estable', observaciones: 'Se encuentra de buen ánimo, tomó sus medicamentos.', evidencias: [] },
      { id: 'v-2', adultoId: 'a-jose', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', fecha: hoy, horaPautada: '12:00', inicio: isoAt(0, '12:02'), fin: isoAt(0, '12:50'), estado: 'completada', estadoAdulto: 'requiere_atencion', observaciones: 'Refiere dolor en la rodilla izquierda.', evidencias: [] },
      { id: 'v-3', adultoId: 'a-elena', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', fecha: hoy, horaPautada: '15:00', estado: 'pendiente', notas: 'Verificar estado general y confirmar si recibió los medicamentos solicitados durante la visita anterior.', evidencias: [] },
      { id: 'v-4', adultoId: 'a-jose', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', fecha: f(1), horaPautada: '10:30', estado: 'pendiente', notas: 'Llevar tensiómetro.', evidencias: [] },
      { id: 'v-5', adultoId: 'a-camila', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', fecha: f(2), horaPautada: '09:00', estado: 'pendiente', evidencias: [] },
      { id: 'v-6', adultoId: 'a-camila', cuidadorId: 'u-cuid', tipo: 'Visita de Seguimiento', fecha: f(-6), horaPautada: '11:00', inicio: isoAt(-6, '11:05'), fin: isoAt(-6, '11:45'), estado: 'completada', estadoAdulto: 'estable', observaciones: 'Sin novedades.', evidencias: [] },
      { id: 'v-7', adultoId: 'a-maria', cuidadorId: 'u-giselle', tipo: 'Visita de Seguimiento', fecha: f(-3), horaPautada: '10:00', inicio: isoAt(-3, '10:10'), fin: isoAt(-3, '10:55'), estado: 'completada', estadoAdulto: 'estable', observaciones: 'Visita sin novedades.', evidencias: [] },
      { id: 'v-8', adultoId: 'a-elena', cuidadorId: 'u-giselle', tipo: 'Visita de Seguimiento', fecha: f(-9), horaPautada: '10:00', inicio: isoAt(-9, '10:00'), fin: isoAt(-9, '10:40'), estado: 'completada', estadoAdulto: 'estable', evidencias: [] },
      ...historialVisitas(),
    ],
    necesidades: [
      { id: 'n-1', adultoId: 'a-elena', registradaPor: 'u-cuid', tipo: 'compania', descripcion: 'Le gustaría recibir más compañía por las tardes; se siente sola.', estado: 'activa', creadaEn: isoAt(-1, '12:30') },
      { id: 'n-2', adultoId: 'a-jose', registradaPor: 'u-cuid', tipo: 'medicamentos', descripcion: 'Necesita reposición de losartán 50 mg (quedan 3 días).', estado: 'activa', creadaEn: isoAt(0, '12:40') },
      { id: 'n-3', adultoId: 'a-maria', registradaPor: 'u-giselle', tipo: 'transporte', descripcion: 'Requiere transporte a su cita de cardiología el viernes.', estado: 'activa', creadaEn: isoAt(-2, '10:30') },
      { id: 'n-4', adultoId: 'a-elena', registradaPor: 'u-giselle', tipo: 'alimentacion', descripcion: 'Canasta de alimentos del mes.', estado: 'satisfecha', creadaEn: isoAt(-12, '09:00'), satisfechaEn: isoAt(-10, '15:00'), satisfechaPor: 'u-coord' },
      { id: 'n-5', adultoId: 'a-camila', registradaPor: 'u-cuid', tipo: 'medicamentos', descripcion: 'Reposición de metformina 850 mg.', estado: 'satisfecha', creadaEn: isoAt(-20, '10:00'), satisfechaEn: isoAt(-18, '11:30'), satisfechaPor: 'u-coord' },
      { id: 'n-6', adultoId: 'a-estefan', registradaPor: 'u-giselle', tipo: 'compania', descripcion: 'Acompañamiento a misa dominical.', estado: 'satisfecha', creadaEn: isoAt(-35, '08:00'), satisfechaEn: isoAt(-33, '12:00'), satisfechaPor: 'u-ctorres' },
      { id: 'n-7', adultoId: 'a-josem', registradaPor: 'u-cuid', tipo: 'otros', descripcion: 'Reparación de la rampa de acceso a la vivienda.', estado: 'activa', creadaEn: isoAt(-4, '16:00') },
      { id: 'n-8', adultoId: 'a-alicia', registradaPor: 'u-coord', tipo: 'alimentacion', descripcion: 'Suplemento nutricional recomendado por su médico.', estado: 'inactiva', creadaEn: isoAt(-15, '09:30') },
    ],
    alertas: [
      { id: 'al-1', adultoId: 'a-elena', severidad: 'alta', categoria: 'EMERGENCIA MÉDICA', titulo: 'Necesidad reportada de medicamento urgente', descripcion: 'Necesidad reportada de medicamento para presión arterial. Se requiere atención inmediata.', creadaEn: isoAt(0, '09:15'), estado: 'pendiente' },
      { id: 'al-2', adultoId: 'a-jose', severidad: 'media', categoria: 'SIN VISITA', titulo: 'Más de 10 días sin visita', descripcion: 'El adulto mayor no ha recibido visita en los últimos 10 días.', creadaEn: isoAt(-1, '08:00'), estado: 'pendiente' },
      { id: 'al-3', adultoId: 'a-camila', severidad: 'baja', categoria: 'SEGUIMIENTO', titulo: 'Actualización de expediente nutricional', descripcion: 'Se actualizó el expediente nutricional del paciente.', creadaEn: isoAt(-2, '14:00'), estado: 'atendida', atendidaPor: 'u-coord' },
      { id: 'al-4', adultoId: 'a-josem', severidad: 'alta', categoria: 'RIESGO ALTO', titulo: 'Evaluación de riesgo elevado', descripcion: 'La última evaluación arrojó nivel de riesgo alto.', creadaEn: isoAt(-3, '11:00'), estado: 'en_atencion' },
      { id: 'al-5', adultoId: 'a-maria', severidad: 'media', categoria: 'NECESIDAD', titulo: 'Solicitud de apoyo para cita médica', descripcion: 'Solicitud de apoyo para traslado a cita médica programada en el hospital central.', creadaEn: isoAt(-2, '10:30'), estado: 'pendiente' },
    ],
    invitaciones: [
      { id: 'inv-1', familiaId: 'fam-1', invitadoPor: 'u-fam', email: 'cuidador@cuidared.do', rol: 'cuidador', estado: 'pendiente', creadaEn: isoAt(0, '08:00') },
    ],
  }
}
