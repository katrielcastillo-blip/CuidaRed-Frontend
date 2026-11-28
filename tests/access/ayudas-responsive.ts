/*
 * ayudas-responsive.ts — Datos realistas (nombres largos, muchas filas, textos extensos) y servicios simulados de todos los
 * módulos operativos, más la auditoría de diseño adaptable que usa `responsive-operacion.spec.ts`.
 * Intercepta la red del navegador: jamás usa servicios reales. Este archivo no es una prueba.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { API, cuentaActiva, iniciarSesion, simular, suscripcionDePrueba, type CuentaSim, type Json } from './ayudas-fase2'
import { casoDe, cuentaId, juanaId, montarReportes, pagina, prefijoApi, ruta, type OpcionesReportes } from './ayudas-reportes'

export { cuentaId, juanaId, ruta }

/** Anchos de la matriz: teléfonos pequeños y grandes, tableta vertical, portátiles y escritorio ancho. */
export const ANCHOS = [320, 360, 390, 414, 768, 1024, 1280, 1440] as const
/** Anchos en los que además se guarda una captura (en `test-results/`, ignorado por git). */
export const ANCHOS_CON_CAPTURA: ReadonlySet<number> = new Set([320, 768, 1440])

export const PERMISOS_TODOS = [
  'adultos:ver', 'adultos:ver-sensible', 'adultos:crear', 'adultos:editar', 'adultos:desactivar', 'adultos:asignar', 'adultos:evaluar',
  'familiares:autorizar', 'visitas:ver', 'visitas:programar', 'visitas:autorizar', 'visitas:registrar', 'evidencias:validar',
  'agenda:ver', 'agenda:gestionar', 'agenda:ejecutar', 'necesidades:ver', 'necesidades:registrar', 'necesidades:actualizar',
  'alertas:ver', 'alertas:gestionar', 'alertas:cerrar', 'indicaciones:ver', 'indicaciones:gestionar', 'informe:exportar',
  'resumen:ver', 'reportes:ver', 'auditoria:ver', 'organizacion:configurar', 'usuarios:gestionar', 'cuidadores:gestionar',
  'cuenta:suscripcion', 'sync:usar',
]

export const cuentaCompleta = (extra: Partial<CuentaSim> = {}) => cuentaActiva({
  cuenta_id: cuentaId,
  nombre: 'Fundación Comunitaria Esperanza y Dignidad para Adultos Mayores del Distrito Nacional',
  tipo: 'organizacion',
  rol: 'coordinador',
  es_titular: true,
  permisos: PERMISOS_TODOS,
  funcionalidades: ['dashboard_metricas', 'reportes_avanzados', 'visitas_recurrentes', 'registro_visitas'],
  estado_suscripcion: 'activa',
  ...extra,
})

/* ───────────── Datos ───────────── */
export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const NOMBRES = ['María de los Ángeles', 'José Altagracia', 'Ana Dolores del Carmen', 'Juan Bautista', 'Rosa Amelia', 'Pedro Pablo', 'Altagracia', 'Luz Marina Concepción']
const APELLIDOS = ['Fernández de la Cruz', 'Rodríguez-Altagracia de los Santos', 'Pérez Díaz', 'Ruizdelacruzvalderramaaltagraciaespinal', 'Ramos Familia', 'De los Santos Mercedes', 'Jiménez Peña', 'Mercedes Valdez de la Rosa']
const ZONAS = ['Villa Juana', 'Ensanche Luperón de la Zona Colonial Norte', 'Los Mina Sur', 'Cristo Rey', 'Gazcue']
const nombreLargo = (i: number) => ({ nombres: NOMBRES[i % NOMBRES.length]!, apellidos: APELLIDOS[i % APELLIDOS.length]! })
const completo = (i: number) => `${nombreLargo(i).nombres} ${nombreLargo(i).apellidos}`
const TEXTO_LARGO = 'La persona refiere dolor persistente en la rodilla derecha desde hace tres semanas, dificultad para subir escaleras y poca ingesta de líquidos durante el día; se recomienda coordinar una evaluación con el médico de cabecera y reforzar la hidratación. Referencia: https://ejemplo.cuidared.test/expedientes/documento-adjunto-muy-largo-sin-espacios-0123456789'
const CORREO_LARGO = 'visitante.con.correo.muy.largo.de.prueba.para.verificar.el.ajuste@organizacion-comunitaria-ejemplo.example.test'

const adultoId = (i: number) => (i === 0 ? juanaId : uuid(i + 1))
export const visitaId = uuid(5001)
export const visitaCursoId = uuid(5002)
export const tareaId = uuid(6001)
export const necesidadId = uuid(7001)
export const alertaId = uuid(8001)
const usuarioId = 'c0a80101-0000-4000-8000-0000000000aa'

const adulto = (i: number, extra: Json = {}): Json => ({
  envejeciente_id: adultoId(i), ...nombreLargo(i), estado: i % 9 === 8 ? 'inactivo' : 'activo', zona: ZONAS[i % ZONAS.length],
  municipio_cod: '0101', municipio_nombre: 'Santo Domingo de Guzmán', provincia_cod: '01', ...extra,
})
const ADULTOS = Array.from({ length: 45 }, (_, i) => adulto(i))
const persona = (i: number) => ({ usuario_id: uuid(900 + i), nombres: NOMBRES[(i + 2) % NOMBRES.length]!, apellidos: APELLIDOS[(i + 3) % APELLIDOS.length]! })

const perfil = (i: number): Json => ({
  ...adulto(i), cedula: '00112345679', fecha_nacimiento: '1944-03-12', sexo: 'F', telefono: '8095550100',
  direccion: 'Calle Doctor Delgado número 245, esquina Avenida Winston Churchill, edificio Torre del Sol apartamento 4-B',
  contacto_principal: { contacto_id: '1', nombres: 'Elena de los Ángeles', apellidos: 'Fernández de la Cruz y Rodríguez', parentesco: 'Hijo/a', telefono: '8095550101', es_principal: true },
  contactos: [
    { contacto_id: '1', nombres: 'Elena de los Ángeles', apellidos: 'Fernández de la Cruz y Rodríguez', parentesco: 'Hijo/a', telefono: '8095550101', es_principal: true },
    { contacto_id: '2', nombres: 'Carlos Manuel', apellidos: 'Pérez Díaz', parentesco: 'Sobrino/a', telefono: '8295550102', es_principal: false },
  ],
  condicion_general: { autonomia: 'parcial', condiciones: ['cronica', 'movilidad', 'cognitivo', 'sensorial'], nota: TEXTO_LARGO },
  consentimiento: { otorgado_por: 'representante', representante: 'Elena de los Ángeles Fernández de la Cruz y Rodríguez' },
})

const evento = (i: number) => ({
  tipo: ['visita', 'riesgo', 'evaluacion', 'indicacion', 'necesidad', 'alerta'][i % 6]!, referencia_id: uuid(3000 + i), fecha: `2026-11-${String(20 - (i % 19)).padStart(2, '0')}T14:05:00Z`,
  titulo: i % 3 === 0 ? 'Visita realizada por el equipo de cuidado comunitario del sector' : 'Factor de riesgo registrado: aislamiento social y dificultad de movilidad',
  detalle: i % 2 === 0 ? TEXTO_LARGO : undefined,
})

const visita = (n: number, extra: Json = {}): Json => {
  const id = n === 0 ? visitaId : n === -1 ? visitaCursoId : uuid(5100 + n)
  const estados = ['programada', 'completada', 'cancelada', 'en_curso'] as const
  return {
    visita_id: id, fecha: '2026-11-27', hora_programada: '09:30:00', hora_fin_programada: '11:00:00', razon: n % 3 === 0 ? 'Seguimiento mensual de salud, hidratación y revisión de medicamentos recetados' : 'Entrega de alimentos',
    notas: TEXTO_LARGO, estado: estados[Math.abs(n) % 4], fecha_actualizacion: '2026-11-26T10:00:00Z', pendiente_autorizacion: n % 4 === 1,
    autorizada_por: { usuario_id: uuid(901), nombres: 'Laura', apellidos: 'Mejía de la Cruz' }, tipo_visita: 'personal',
    participantes: [{ usuario_id: usuarioId, nombres: 'Laura', apellidos: 'Díaz' }, persona(2), persona(3)],
    adultos: [{ envejeciente_id: uuid(n + 11), ...nombreLargo(n + 3), observacion: TEXTO_LARGO, estado_general: 'requiere_atencion' }, { envejeciente_id: uuid(n + 12), ...nombreLargo(n + 4), observacion: null, estado_general: 'estable' }],
    checklist: ['alimentacion', 'medicamentos', 'higiene', 'vivienda', 'animo', 'movilidad'], visitante: null,
    entidad_visitante: 'Parroquia de Nuestra Señora de la Altagracia y Grupo de Voluntarios Juveniles', cantidad_visitantes: 12, aporte_previsto: TEXTO_LARGO,
    ...extra,
  }
}
const VISITAS = [visita(0, { estado: 'programada', pendiente_autorizacion: false }), visita(-1, { estado: 'en_curso', pendiente_autorizacion: false, hora_inicio: '09:35:00' }),
  ...Array.from({ length: 30 }, (_, i) => visita(i + 1))]
const solicitud = (i: number): Json => ({
  solicitud_visita_id: uuid(4000 + i), estado: i % 3 === 0 ? 'pendiente' : 'autorizada', fecha_propuesta: '2026-12-02', hora_propuesta: '10:30:00',
  visitante: { nombres: 'María de los Ángeles', apellidos: 'Fernández de la Cruz', telefono: '8095550123', correo: CORREO_LARGO },
  persona_a_visitar: completo(i), tipo_visita: i % 2 === 0 ? 'institucional' : 'personal', entidad_visitante: 'Asociación Cristiana de Jóvenes Voluntarios del Distrito Nacional',
  tipo_entidad: 'iglesia', cantidad_visitantes: 8, aporte_previsto: TEXTO_LARGO, motivo: TEXTO_LARGO, motivo_rechazo: i % 3 === 1 ? TEXTO_LARGO : null,
  observacion_visitante: i === 2 ? TEXTO_LARGO : null, visita_id: i % 3 === 0 ? null : visitaId,
})
const tarea = (i: number, extra: Json = {}): Json => ({
  tarea_id: i === 0 ? tareaId : uuid(6100 + i), visita_id: i === 0 ? visitaId : null, envejeciente_id: adultoId(i), envejeciente_nombre: completo(i), cuidador_id: uuid(950 + i),
  cuidador_nombre: `${NOMBRES[(i + 2) % NOMBRES.length]} ${APELLIDOS[(i + 3) % APELLIDOS.length]}`, indicacion_medica_id: uuid(2001), indicacion_titulo: 'Losartán 50 mg cada ocho horas con las comidas principales',
  prioridad_id: 1 + (i % 3), prioridad: ['Alta', 'Media', 'Baja'][i % 3], titulo: i % 2 === 0 ? 'Administrar el medicamento antihipertensivo y registrar la presión arterial en la libreta' : 'Caminata asistida',
  fecha_programada: '2026-11-27', hora_programada: '08:00:00', estado: (['pendiente', 'en_progreso', 'completada', 'cancelada'] as const)[i % 4], requiere_evidencia: true,
  es_repetitiva: i % 2 === 0, evidencias: { validadas: 0, pendientes: 1, rechazadas: 1 }, motivo_cancelacion: null, ultimo_motivo_rechazo: TEXTO_LARGO, ...extra,
})
const necesidad = (i: number, extra: Json = {}): Json => ({
  envejeciente_necesidad_id: i === 0 ? necesidadId : uuid(7100 + i), envejeciente_id: adultoId(i), envejeciente_nombre: completo(i), envejeciente_estado: 'activo',
  necesidad_id: 1, necesidad_nombre: i % 2 === 0 ? 'Silla de ruedas ligera plegable con cojín antiescaras y reposapiés ajustables' : 'Alimentos', tipo_necesidad_id: 1,
  tipo_necesidad_nombre: 'Equipos médicos, ayudas técnicas y movilidad', prioridad_id: 1, prioridad: 'Alta', estado: (['pendiente', 'en_proceso', 'resuelta', 'cancelada'] as const)[i % 4],
  descripcion: TEXTO_LARGO, cantidad: 3, unidad_medida: 'unidades', fecha_necesidad: '2026-11-20T14:05:00Z', fecha_actualizacion: '2026-11-21T14:05:00Z',
  usuario_responsable_id: uuid(902), responsable: 'Rosa Amelia Rodríguez-Altagracia de los Santos', indicacion_medica_id: null, fecha_resolucion: null, motivo_resolucion: null, es_recurrente: true, ...extra,
})
const alerta = (i: number, extra: Json = {}): Json => ({
  alerta_envejeciente_id: i === 0 ? alertaId : uuid(8100 + i), envejeciente_id: adultoId(i), ...nombreLargo(i),
  tipo: { codigo: 'riesgo_alto', nombre: i % 2 === 0 ? 'Riesgo alto detectado en la última evaluación social y de salud' : 'Seguimiento vencido' },
  prioridad: { nombre: 'Alta', orden: 1 }, descripcion: TEXTO_LARGO, estado: (['pendiente', 'en_proceso', 'resuelta'] as const)[i % 3], fecha_alerta: '2026-11-20T14:05:00Z',
  fecha_atencion: '2026-11-21T09:00:00Z', accion_tomada: TEXTO_LARGO, atendida_por: 'Laura Mejía de la Cruz y Altagracia', cierre_automatico: i % 3 === 2, fuente: { tipo: 'riesgo', referencia_id: uuid(3) }, es_prioritaria: true, ...extra,
})
const indicacion = (i: number): Json => ({
  indicacion_medica_id: uuid(2000 + i), tipo_indicacion_id: 1, tipo: 'Medicamento', titulo: i % 2 === 0 ? 'Losartán 50 mg cada ocho horas con las comidas principales' : 'Dieta baja en sodio',
  descripcion: TEXTO_LARGO, frecuencia_horario: 'Diaria, 8:00, 14:00 y 20:00', fecha_inicio: '2026-10-01', fecha_fin: i % 2 ? '2026-12-31' : null, estado: (['activa', 'suspendida', 'finalizada'] as const)[i % 3],
})
const evidencia = (i: number): Json => ({
  evidencia_id: uuid(9000 + i), nombre_archivo: i % 2 ? 'foto.jpg' : 'comprobante-de-entrega-de-alimentos-del-sector-los-mina-sur-noviembre-2026-version-final-firmada.pdf',
  estado_validacion: ['pendiente', 'validada', 'rechazada'][i % 3], observacion: TEXTO_LARGO, motivo_rechazo: i % 3 === 2 ? TEXTO_LARGO : null, es_historica: false, url_descarga: 'https://archivos.cuidared.test/privado/doc.pdf',
})

/* ───────────── Suscripción ───────────── */
const OFERTA_BASE = {
  codigo: 'operacion_base_mensual', nombre: 'Operación Base', periodicidad: 'mensual' as const, importe_centavos: 9900, moneda: 'USD',
  limites: { envejecientes: 15, usuarios: 20, familiares: null }, funcionalidades: ['dashboard_metricas', 'necesidades_diarias', 'registro_visitas', 'tablon_notificaciones'], actual: true, publicada: true,
}
const GESTION = {
  sandbox: true as const, pagos_disponibles: true, es_titular: true, estado: 'activa', acceso_operativo: true, vigencia_hasta: '2026-12-22T16:00:00Z', cancelacion_programada: false,
  suscripcion_stripe: true, puede_modificar: true, checkout_en_curso: null, cambio_en_curso: null,
  ofertas: [OFERTA_BASE, { ...OFERTA_BASE, codigo: 'operacion_base_anual', periodicidad: 'anual' as const, importe_centavos: 99000, actual: false },
    { ...OFERTA_BASE, codigo: 'gestion_comunitaria_avanzada_mensual', nombre: 'Gestión Comunitaria Avanzada', importe_centavos: 15500, actual: false, version: 'a34958c9-6223-49a3-b8c9-76ef290a05ff',
      limites: { envejecientes: 42, usuarios: 12, cuidadores: 8, familiares: null }, funcionalidades: ['reportes_avanzados'] }],
}
const CATALOGO = [
  { codigo: 'operacion_base', nombre: 'Operación Base', limites: { envejecientes: 15, usuarios: 20, familiares: null, cuidadores: null }, funcionalidades: GESTION.ofertas[0]!.funcionalidades, precios_referencia: null },
  { codigo: 'gestion_comunitaria_avanzada', nombre: 'Gestión Comunitaria Avanzada', cotizado: true, limites: { envejecientes: null, usuarios: null, familiares: null, cuidadores: null }, funcionalidades: ['reportes_avanzados'], precios_referencia: null },
]
const PAGOS = Array.from({ length: 12 }, (_, i) => ({
  pago_id: String(i + 1), plan: i % 2 ? 'Gestión Comunitaria Avanzada con cupos pactados y facturación anual' : 'Operación Base', periodicidad: 'mensual', importe_centavos: 9900 + i * 100, moneda: 'USD',
  estado: (['completado', 'pendiente', 'fallido', 'reembolsado'] as const)[i % 4], fecha: '2026-11-22T16:00:00Z', importe_reembolsado_centavos: i % 4 === 3 ? 5000 : 0,
}))

/* ───────────── Servicios simulados ───────────── */
export interface OpcionesMontaje {
  cuenta?: CuentaSim
  reportes?: OpcionesReportes
  /** Gestión de suscripción distinta de la activa con plan base. */
  gestion?: Json
}

/** Responde con los datos de arriba. Lo que no reconoce pasa al siguiente manejador (reportes, resumen y simulador base). */
export async function montar(page: Page, opciones: OpcionesMontaje = {}) {
  const cuenta = opciones.cuenta ?? cuentaCompleta()
  const sim = await simular(page, { cuentas: [cuenta], suscripciones: { [cuenta.cuenta_id]: suscripcionDePrueba(7) } })
  await montarReportes(page, cuenta, {
    casos: Array.from({ length: 14 }, (_, i) => casoDe(i + 1, { ...nombreLargo(i), envejeciente_id: i === 0 ? juanaId : uuid(i + 1), zona: ZONAS[i % ZONAS.length],
      asignados: { total: 3, cuidadores: [persona(1), persona(2)], voluntarios: [persona(3)] } })),
    truncado: true,
    ...opciones.reportes,
  })
  const catalogo = (datos: unknown) => ({ json: { data: datos } })
  await page.route(`${API}/api/v1/catalogos/**`, (req) => {
    const nombre = new URL(req.request().url()).pathname.split('/').pop()
    const tablas: Record<string, unknown> = {
      'tipos-necesidad': [{ tipo_necesidad_id: 1, nombre: 'Equipos médicos, ayudas técnicas y movilidad' }, { tipo_necesidad_id: 2, nombre: 'Alimentación' }],
      necesidades: [{ necesidad_id: 1, nombre: 'Silla de ruedas ligera plegable con cojín antiescaras', tipo_necesidad_id: 1 }, { necesidad_id: 2, nombre: 'Canasta de alimentos', tipo_necesidad_id: 2 }],
      prioridades: [{ prioridad_id: 1, nombre: 'Alta' }, { prioridad_id: 2, nombre: 'Media' }, { prioridad_id: 3, nombre: 'Baja' }],
      'tipos-alerta': [{ codigo: 'riesgo_alto', nombre: 'Riesgo alto detectado en la última evaluación social y de salud' }, { codigo: 'seguimiento', nombre: 'Seguimiento vencido' }],
      'tipos-indicacion': [{ tipo_indicacion_id: 1, nombre: 'Medicamento' }],
      riesgos: [{ riesgo_id: 1, nombre: 'Aislamiento social y dificultad severa de movilidad', codigo: 'aislamiento' }],
      'tipos-cuidado': [{ tipo_cuidado_id: 1, nombre: 'Cuidado integral domiciliario' }],
    }
    return nombre && nombre in tablas ? req.fulfill(catalogo(tablas[nombre])) : req.fallback()
  })
  await page.route(`${API}/api/v1/notificaciones-push/**`, (req) => {
    const sub = new URL(req.request().url()).pathname
    if (sub.endsWith('/configuracion')) return req.fulfill(catalogo({ habilitado: true, clave_publica: 'B'.repeat(87) }))
    return req.fulfill(catalogo({ activa: false }))
  })
  await page.route(`${API}${prefijoApi}`, (req) => req.fulfill(catalogo({
    cuenta: { cuenta_id: cuentaId, nombre: cuenta.nombre, tipo: cuenta.tipo, categoria: { categoria_cuenta_id: 4, nombre: 'Fundación u organización sin fines de lucro' },
      municipio: { municipio_cod: '0101', nombre: 'Santo Domingo de Guzmán', provincia_cod: '01', provincia: 'Distrito Nacional' }, direccion: 'Calle Doctor Delgado número 245, esquina Avenida Winston Churchill, Torre del Sol',
      telefono: '8095550100', correo: CORREO_LARGO, fecha_creacion: '2026-11-07T12:00:00Z' },
    contexto: cuenta, uso: { envejecientes: 12, usuarios: 8, familiares: 3, voluntarios: 4 },
  })))
  await page.route(`${API}${prefijoApi}/**`, async (req) => {
    const url = new URL(req.request().url())
    const sub = url.pathname.slice(prefijoApi.length)
    const lista = (items: unknown[]) => req.fulfill({ json: pagina(items, url.searchParams) })
    const ok = (data: unknown) => req.fulfill({ json: { data } })
    const metodo = req.request().method()
    if (metodo !== 'GET') return req.fulfill({ json: { data: {} } })
    if (sub === '/contexto') return ok(cuenta)
    // Adultos
    if (sub === '/envejecientes') return lista(ADULTOS)
    if (sub === '/consentimientos-retirados') return lista(Array.from({ length: 6 }, (_, i) => ({ envejeciente_id: adultoId(i), nombre: completo(i), fecha: '2026-11-10T10:00:00Z', motivo: TEXTO_LARGO, actor: 'Laura Mejía de la Cruz y Altagracia' })))
    let m = sub.match(/^\/envejecientes\/([^/]+)(?:\/(.+))?$/)
    if (m) {
      const idx = ADULTOS.findIndex((a) => a.envejeciente_id === m![1])
      const i = idx < 0 ? 0 : idx
      const resto = m[2]
      if (!resto) return ok(perfil(i))
      if (resto === 'informe-medico') return req.fallback()
      if (resto === 'riesgo') return ok({ nivel_vigente: 'alto', texto: 'Nivel de riesgo vigente: alto, con factores de aislamiento social y movilidad reducida', ultima_evaluacion: { puntaje: 78, vigente: true },
        factores_vigentes: [{ envejeciente_riesgo_id: '41', riesgo: 'Aislamiento social y dificultad severa de movilidad', nivel: 'alto', estado: 'activo', motivo: TEXTO_LARGO, observacion: TEXTO_LARGO }] })
      if (resto === 'historial') return lista(Array.from({ length: 25 }, (_, k) => evento(k)))
      if (resto === 'asignaciones') return ok({ cuidadores: [persona(1), persona(2)], voluntarios: [persona(3)], familiares: [persona(4)] })
      if (resto === 'indicaciones') return lista(Array.from({ length: 6 }, (_, k) => indicacion(k)))
      if (resto === 'necesidades/candidatos') return lista(Array.from({ length: 5 }, (_, k) => ({ usuario_id: uuid(960 + k), nombre: completo(k) })))
    }
    m = sub.match(/^\/indicaciones\/[^/]+\/evidencias$/)
    if (m) return ok([evidencia(0), evidencia(1)])
    // Candidatos
    m = sub.match(/^\/candidatos\/(.+)$/)
    if (m) return lista(Array.from({ length: 8 }, (_, i) => ({ usuario_id: uuid(940 + i), membresia_id: uuid(980 + i), cuidador_id: uuid(970 + i), nombre: `${completo(i)} de la Congregación`, rol: i % 2 ? 'voluntario' : 'cuidador' })))
    // Visitas
    if (sub === '/visitas') return lista(VISITAS)
    m = sub.match(/^\/visitas\/([^/]+)(\/evidencias)?$/)
    if (m) return m[2] ? ok([evidencia(0), evidencia(1), evidencia(2)]) : ok(VISITAS.find((v) => v.visita_id === m![1]) ?? VISITAS[0])
    if (sub === '/solicitudes-visita') return lista(Array.from({ length: 12 }, (_, i) => solicitud(i)))
    // Agenda
    if (sub === '/tareas') return lista(Array.from({ length: 24 }, (_, i) => tarea(i)))
    m = sub.match(/^\/tareas\/([^/]+)(\/evidencias)?$/)
    if (m) return m[2] ? ok([evidencia(0), evidencia(1), evidencia(2)]) : ok(tarea(m[1] === tareaId ? 0 : 1, { estado: 'pendiente', es_repetitiva: true }))
    // Necesidades
    if (sub === '/necesidades') return lista(Array.from({ length: 24 }, (_, i) => necesidad(i)))
    m = sub.match(/^\/necesidades\/([^/]+)(\/historial)?$/)
    if (m) return m[2] ? lista(Array.from({ length: 6 }, (_, i) => ({ necesidad_evento_id: uuid(7500 + i), fecha: '2026-11-20T14:05:00Z', actor: 'Laura Mejía de la Cruz y Altagracia', estado_anterior: 'pendiente',
      estado: 'en_proceso', prioridad: 'Alta', prioridad_anterior: 'Media', responsable_anterior: null, responsable: 'Rosa Amelia Rodríguez-Altagracia de los Santos', motivo: TEXTO_LARGO })))
      : ok(necesidad(0, { estado: 'pendiente' }))
    // Alertas
    if (sub === '/casos-prioritarios') return lista(Array.from({ length: 6 }, (_, i) => ({ envejeciente_id: adultoId(i), ...nombreLargo(i), fecha_alerta: '2026-11-20T14:05:00Z', total_alertas: 2, alertas: [alerta(i * 2), alerta(i * 2 + 1)] })))
    if (sub === '/alertas') return lista(Array.from({ length: 24 }, (_, i) => alerta(i)))
    m = sub.match(/^\/alertas\/([^/]+)$/)
    if (m) return ok(alerta(m[1] === alertaId ? 0 : 1, { estado: 'pendiente' }))
    if (sub === '/notificaciones-alerta') return lista(Array.from({ length: 12 }, (_, i) => ({ notificacion_id: uuid(8500 + i), alerta_envejeciente_id: alertaId,
      mensaje: `Nueva alerta prioritaria para ${completo(i)}: riesgo alto detectado en la evaluación social y de salud de este mes.`, estado: i % 2 ? 'leida' : 'no_leida',
      fecha_notificacion: '2026-11-20T14:05:00Z', fecha_lectura: i % 2 ? '2026-11-21T08:00:00Z' : null })))
    // Cuenta
    if (sub === '/auditoria') return lista(Array.from({ length: 30 }, (_, i) => ({ auditoria_id: uuid(8800 + i), actor: i % 2 ? null : 'Laura Mejía de la Cruz y Altagracia (coordinadora)', accion: (['alta', 'actualizacion', 'baja', 'exportacion'] as const)[i % 4],
      entidad: ['envejeciente_necesidad', 'evidencia_visita', 'evidencia_indicacion', 'visita'][i % 4], fecha: '2026-11-20T14:05:00Z', resultado: 'confirmado' })))
    if (sub === '/configuracion') return ok([
      { nombre: 'dias_sin_visita_alerta', valor: '15', tipo_dato: 'entero', descripcion: 'Cantidad de días sin visita antes de generar una alerta de seguimiento vencido para el adulto.', es_propio: true, valor_general: '15' },
      { nombre: 'dias_escalar_necesidad', valor: '7', tipo_dato: 'entero', descripcion: null, es_propio: false, valor_general: '7' },
      { nombre: 'notificar_casos_prioritarios', valor: 'true', tipo_dato: 'booleano', descripcion: 'Avisa al equipo de coordinación cada vez que se abre un caso prioritario nuevo en la cuenta.', es_propio: false, valor_general: 'true' },
      { nombre: 'notificar_nuevos_voluntarios', valor: 'false', tipo_dato: 'booleano', descripcion: null, es_propio: false, valor_general: 'false' },
      { nombre: 'contacto_institucional_nombre', valor: 'Coordinación general de la Fundación Comunitaria Esperanza y Dignidad', tipo_dato: 'texto', descripcion: null, es_propio: true, valor_general: '' },
      { nombre: 'contacto_institucional_telefono', valor: '8095550100', tipo_dato: 'texto', descripcion: null, es_propio: false, valor_general: '' },
    ])
    m = sub.match(/^\/miembros\/[^/]+\/cuidador$/)
    if (m) return ok(null)
    // Suscripción
    if (sub === '/suscripcion/gestion') return ok(opciones.gestion ?? GESTION)
    if (sub === '/suscripcion/catalogo') return ok(CATALOGO)
    if (sub === '/suscripcion/pagos') return lista(PAGOS)
    if (sub === '/suscripcion/cotizaciones') return ok({ cotizaciones: [{ codigo: 'gestion_comunitaria_avanzada_anual', nombre: 'Gestión Comunitaria Avanzada', periodicidad: 'anual', estado: 'sin_cotizar',
      importe_centavos: null, moneda: 'USD', cuidadores: 0, envejecientes: 0 }] })
    return req.fallback()
  })
  return { cuenta, sim }
}

/* ───────────── Auditoría de diseño adaptable ───────────── */
export interface OpcionesAuditoria {
  /** Controles que deben estar visibles y dentro del ancho de la pantalla. */
  visibles?: Array<Locator>
  /** Fragmentos de texto de problemas que se aceptan (p. ej. elementos de componentes compartidos). */
  tolerar?: RegExp[]
}

type Hallazgo = string

/** Se ejecuta dentro del navegador. */
function auditarEnNavegador({ tactil }: { tactil: boolean }): Hallazgo[] {
  const problemas: string[] = []
  const ancho = window.innerWidth
  const raiz = document.documentElement
  if (raiz.scrollWidth > ancho + 1) problemas.push(`desborde horizontal de la página (scrollWidth ${raiz.scrollWidth} > ${ancho})`)
  const describir = (el: Element) => {
    const texto = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 50)
    const clase = (typeof el.className === 'string' ? el.className : '').slice(0, 70)
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} class="${clase}"> «${texto}»`
  }
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    const e = getComputedStyle(el)
    return r.width > 1 && r.height > 1 && e.visibility !== 'hidden' && e.display !== 'none'
  }
  const main = document.querySelector('main') ?? document.body
  const bajoBarra = document.querySelector('nav[aria-label="Módulos de la cuenta"]')
  for (const el of Array.from(main.querySelectorAll('*'))) {
    if (!visible(el) || el.closest('svg') && el.tagName !== 'svg') continue
    const r = el.getBoundingClientRect()
    const padre = el.parentElement
    if (padre && padre !== document.body) {
      const rp = padre.getBoundingClientRect()
      const estiloPadre = getComputedStyle(padre)
      const enFlujo = getComputedStyle(el).position !== 'absolute' && getComputedStyle(el).position !== 'fixed'
      // El origen del desborde es el elemento más ancho que su contenedor; si éste hace scroll por diseño no hay problema.
      if (enFlujo && (r.right > rp.right + 1 || r.left < rp.left - 1)) {
        if (estiloPadre.overflowX === 'hidden' || estiloPadre.overflowX === 'clip') problemas.push(`contenido recortado por overflow-hidden de su contenedor: ${describir(el)} (${Math.round(r.width)}px en ${Math.round(rp.width)}px)`)
        else if (estiloPadre.overflowX === 'visible') problemas.push(`más ancho que su contenedor (${Math.round(r.width)}px en ${Math.round(rp.width)}px): ${describir(el)}`)
      }
    }
    const interactivo = el.matches('button, a[href], [role=radio], [role=tab], summary, label, h1, h2, h3, h4, p, dd, dt, li, span, strong')
    if (interactivo && !el.closest('[role=region][tabindex]') && (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1
      && getComputedStyle(el).overflowX === 'visible' && getComputedStyle(el).display !== 'inline' && el.clientWidth > 0) {
      problemas.push(`el texto desborda su caja (${(el as HTMLElement).scrollWidth} > ${(el as HTMLElement).clientWidth}): ${describir(el)}`)
    }
    if (tactil && el.matches('button, select, summary, textarea, input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file])') && r.height < 43.5) {
      problemas.push(`objetivo táctil bajo (${Math.round(r.height)}px): ${describir(el)}`)
    }
    if (tactil && el.matches('a[href]') && getComputedStyle(el).display !== 'inline' && r.height < 43.5) {
      problemas.push(`enlace táctil bajo (${Math.round(r.height)}px): ${describir(el)}`)
    }
    if (tactil && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), select, textarea')
      && parseFloat(getComputedStyle(el).fontSize) < 16) {
      problemas.push(`campo con letra menor de 16px (${getComputedStyle(el).fontSize}): ${describir(el)}`)
    }
    if (el.tagName === 'CANVAS' && (r.width > ancho || r.height < 120)) problemas.push(`gráfico con tamaño inadecuado (${Math.round(r.width)}×${Math.round(r.height)}): ${describir(el)}`)
  }
  // El final del contenido no debe quedar bajo la barra inferior fija.
  if (bajoBarra && getComputedStyle(bajoBarra).position === 'fixed' && visible(bajoBarra)) {
    const alto = Math.max(document.body.scrollHeight, raiz.scrollHeight)
    window.scrollTo(0, alto)
    const arriba = bajoBarra.getBoundingClientRect().top
    let fondo = 0
    for (const el of Array.from(main.querySelectorAll('*'))) {
      if (!visible(el) || el.children.length > 0 && !el.matches('button, a, input, select, textarea, p, h1, h2, h3, h4, li, label, td, th, span')) continue
      fondo = Math.max(fondo, el.getBoundingClientRect().bottom)
    }
    if (fondo > arriba + 1) problemas.push(`el final del contenido (${Math.round(fondo)}) queda bajo la barra inferior (${Math.round(arriba)})`)
    window.scrollTo(0, 0)
  }
  return problemas
}

/**
 * Recorre la matriz de anchos sobre la pantalla actual. Devuelve los hallazgos agrupados por ancho (vacío = todo bien).
 * Con `nombre` guarda capturas de página completa en `test-results/responsive-operacion/`.
 */
export async function recorrerAnchos(page: Page, _testInfo: TestInfo, nombre: string, opciones: OpcionesAuditoria = {}) {
  const hallazgos: string[] = []
  const carpeta = join(process.cwd(), 'test-results', 'responsive-operacion')
  mkdirSync(carpeta, { recursive: true })
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: ancho < 768 ? 800 : 900 })
    await page.waitForTimeout((await page.locator('canvas').count()) > 0 ? 900 : 150)
    let encontrados = await page.evaluate(auditarEnNavegador, { tactil: ancho <= 768 })
    // Los gráficos y las animaciones tardan en asentarse tras cambiar el ancho: se confirma antes de informar.
    if (encontrados.length > 0) {
      await page.waitForTimeout(700)
      encontrados = await page.evaluate(auditarEnNavegador, { tactil: ancho <= 768 })
    }
    for (const texto of encontrados) {
      if (opciones.tolerar?.some((patron) => patron.test(texto))) continue
      hallazgos.push(`[${ancho}px] ${texto}`)
    }
    for (const control of opciones.visibles ?? []) {
      const caja = await control.first().boundingBox({ timeout: 4000 }).catch(() => null)
      if (!caja) hallazgos.push(`[${ancho}px] control no visible: ${control}`)
      else if (caja.x < -1 || caja.x + caja.width > ancho + 1) hallazgos.push(`[${ancho}px] control fuera del ancho (${Math.round(caja.x)}→${Math.round(caja.x + caja.width)}): ${control}`)
    }
    if (ANCHOS_CON_CAPTURA.has(ancho)) {
      await page.screenshot({ path: join(carpeta, `${nombre}-${ancho}.png`), fullPage: true })
    }
  }
  // Un mismo problema en varios anchos se informa una vez, con la lista de anchos.
  const agrupados = new Map<string, { texto: string; anchos: string[] }>()
  for (const hallazgo of hallazgos) {
    const [, ancho, texto] = /^\[(\d+)px\] (.*)$/s.exec(hallazgo) ?? []
    const clave = (texto ?? hallazgo).replace(/\d+/g, '#')
    const previo = agrupados.get(clave)
    if (previo) previo.anchos.push(ancho ?? '?')
    else agrupados.set(clave, { texto: texto ?? hallazgo, anchos: [ancho ?? '?'] })
  }
  return [...agrupados.values()].map(({ texto, anchos }) => `[${anchos.join(',')}px] ${texto}`)
}

export async function abrirOperacion(page: Page, seccion: string, opciones: OpcionesMontaje = {}) {
  const { cuenta, sim } = await montar(page, opciones)
  await page.setViewportSize({ width: 1280, height: 900 })
  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/${seccion}`)
  await expect(page.getByRole('banner')).toBeVisible()
  return { cuenta, sim }
}

/** Espera a que desaparezcan los mensajes de carga antes de medir. */
export async function esperarCarga(page: Page) {
  await expect(page.getByText('Consultando…')).toHaveCount(0, { timeout: 10_000 })
}
