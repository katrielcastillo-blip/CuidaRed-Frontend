/*
 * ayudas-reportes.ts — Servicios simulados del resumen de casos, los reportes, las exportaciones y el informe médico
 * (fase 7) para las pruebas del acceso conectado. Intercepta la red del navegador: jamás usa servicios reales.
 * Módulo: pruebas · access-real (ID07).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reproduce el formato del contrato `reportes.md` (paginación y errores CR-162, filtros `filter[...]`, CSV con
 * `Content-Disposition`, registro previo de PDF y Excel). Este archivo no es una prueba: solo se ejecutan los `*.spec.ts`.
 */
import type { Page } from '@playwright/test'
import { API, type CuentaSim, type Json } from './ayudas-fase2'

export const cuentaId = '9007199254740993'
export const ruta = `/operacion/${cuentaId}`
export const prefijoApi = `/api/v1/cuentas/${cuentaId}`
export const juanaId = '0b6e1f0e-5c8f-4a51-9f8e-2d9d7a1c4b10'
export const pedroId = '22222222-2222-4222-8222-222222222222'

/** Fecha de hoy en el calendario de Santo Domingo, como la calcula la aplicación. */
export const hoyRD = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santo_Domingo', dateStyle: 'short' }).format(new Date())

export interface Llamada { metodo: string; ruta: string; consulta: URLSearchParams; cuerpo?: Json; autorizacion?: string }
export interface Fallo { status: number; code: string }

export interface OpcionesReportes {
  /** Cantidad de casos del resumen (por defecto, tres con datos distintos). */
  casos?: Json[]
  /** El servidor responde vacío a todos los reportes. */
  vacio?: boolean
  /** El detalle del reporte llega recortado (`detalle_total` mayor que las filas publicadas). */
  truncado?: boolean
  /** Error a las consultas de reportes (no a las exportaciones). */
  errorReporte?: Fallo
  /** Error a las consultas del resumen. */
  errorResumen?: Fallo
  /** Error al registrar PDF o Excel. */
  errorRegistro?: Fallo
  /** Error al descargar el CSV. */
  errorCsv?: Fallo
  /** El servidor no expone `Content-Disposition` por CORS: el navegador no puede leer el nombre. */
  sinExponerCabecera?: boolean
  /** Visitas y variación llegan `null` (quien consulta no tiene `visitas:ver`). */
  sinVisitas?: boolean
  /** Error al generar el informe médico. */
  errorInforme?: Fallo
  /** Secciones del informe que el servidor omite. */
  omitidas?: Array<'indicaciones' | 'riesgo' | 'visitas'>
}

const punto = (clave: string, etiqueta: string, valor: number, porcentaje: number) => ({ clave, etiqueta, valor, porcentaje })
const municipio = { codigo: '0101', nombre: 'Santo Domingo de Guzmán' }
const error = (status: number, code: string) => ({ status, json: { error: { code, message: 'mensaje_privado' }, requestId: 'prueba' } })

export const pagina = (items: unknown[], consulta: URLSearchParams) => {
  const page = Number(consulta.get('page') ?? 1)
  const limit = Number(consulta.get('limit') ?? 20)
  return { data: items.slice((page - 1) * limit, page * limit), meta: { page, limit, total: items.length, totalPages: Math.ceil(items.length / limit) } }
}

/* ───────────── Resumen de casos ───────────── */
export const casoDe = (numero: number, extra: Json = {}): Json => ({
  envejeciente_id: numero === 1 ? juanaId : numero === 2 ? pedroId : `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`,
  nombres: numero === 1 ? 'Juana' : numero === 2 ? 'Pedro' : `Persona${String(numero).padStart(2, '0')}`,
  apellidos: numero === 1 ? 'Pérez Díaz' : numero === 2 ? 'Ramos' : 'Ejemplo',
  municipio: numero === 2 ? { codigo: '2501', nombre: 'Santiago de los Caballeros' } : municipio,
  zona: numero === 2 ? 'Centro' : 'Villa Juana',
  fecha_alta: '2026-08-02T14:10:00+00:00',
  riesgo_vigente: numero === 1 ? 'alto' : null,
  prioridad: numero === 1 ? 'alta' : numero === 2 ? 'media' : 'baja',
  estado_atencion: numero === 1 ? 'alerta_en_proceso' : numero === 2 ? 'seguimiento_vencido' : 'al_dia',
  motivos: numero === 1 ? ['alerta_prioritaria_abierta', 'riesgo_alto', 'seguimiento_vencido'] : numero === 2 ? ['seguimiento_vencido', 'sin_evaluacion_vigente', 'sin_personal_asignado'] : [],
  alertas: numero === 1 ? { abiertas: 2, pendientes: 1, en_proceso: 1, prioritarias_abiertas: 2 } : { abiertas: 0, pendientes: 0, en_proceso: 0, prioritarias_abiertas: 0 },
  necesidades_activas: numero === 1 ? 1 : 0,
  seguimiento: numero === 1
    ? { ultima_visita_id: '6c0f3b9a-0b1e-4a65-8d0e-3c6a4e0f9a21', ultima_visita_fecha: '2026-11-01', fecha_referencia: '2026-11-01', dias_sin_visita: 19, umbral_dias: 15, vencido: true }
    : { ultima_visita_id: null, ultima_visita_fecha: null, fecha_referencia: '2026-08-02', dias_sin_visita: numero === 2 ? 110 : 3, umbral_dias: 15, vencido: numero === 2 },
  asignados: numero === 1
    ? { total: 1, cuidadores: [{ usuario_id: '5d7c8a8e-1a4b-4f0e-9a3e-7e0d1b2c3f40', nombres: 'Ana', apellidos: 'Gómez' }], voluntarios: [] }
    : { total: 0, cuidadores: [], voluntarios: [] },
  ...extra,
})

export const INDICADORES: Json = {
  fecha_calculo: '2026-11-20', umbral_dias_sin_visita: 15, casos_activos: 42,
  por_prioridad: { alta: 7, media: 20, baja: 15 },
  por_estado_atencion: { alerta_pendiente: 5, alerta_en_proceso: 2, seguimiento_vencido: 6, necesidades_activas: 9, al_dia: 20 },
  adultos_prioritarios: 6, alertas_prioritarias_abiertas: 9, alertas_abiertas: 14, alertas_pendientes: 10, alertas_en_proceso: 4,
  seguimiento_vencido: 8, necesidades_activas: 17, adultos_con_necesidades_activas: 11, sin_personal_asignado: 3,
}

function filtrarCasos(casos: Json[], consulta: URLSearchParams) {
  const f = (clave: string) => consulta.get(`filter[${clave}]`)
  return casos.filter((c) => {
    const asignados = c.asignados as { total: number; cuidadores: Array<{ usuario_id: string }>; voluntarios: Array<{ usuario_id: string }> }
    const asignado = f('asignado')
    return (!f('estado_atencion') || c.estado_atencion === f('estado_atencion')) && (!f('prioridad') || c.prioridad === f('prioridad'))
      && (!f('riesgo') || (f('riesgo') === 'sin_evaluacion' ? c.riesgo_vigente === null : c.riesgo_vigente === f('riesgo')))
      && (!f('municipio_cod') || (c.municipio as { codigo: string }).codigo === f('municipio_cod')) && (!f('zona') || c.zona === f('zona'))
      && (!asignado || (asignado === 'sin' ? asignados.total === 0 : asignado === 'con' ? asignados.total > 0
        : [...asignados.cuidadores, ...asignados.voluntarios].some((p) => p.usuario_id === asignado)))
      && (!f('q') || `${c.nombres} ${c.apellidos} ${c.zona}`.toLowerCase().includes(f('q')!.toLowerCase()))
  })
}

/* ───────────── Reportes ───────────── */
export const SIN_FILTROS = { desde: null, hasta: null, municipio_cod: null, zona: null, riesgo: null, tipo_necesidad_id: null }
const filtrosDe = (consulta: URLSearchParams) => {
  const f = (clave: string) => consulta.get(`filter[${clave}]`)
  return { desde: f('desde'), hasta: f('hasta'), municipio_cod: f('municipio_cod'), zona: f('zona'), riesgo: f('riesgo'), tipo_necesidad_id: f('tipo_necesidad_id') ? Number(f('tipo_necesidad_id')) : null }
}
const cabecera = (tipo: string, campo: string, consulta: URLSearchParams, vacio: boolean) => ({
  tipo, campo_fecha: campo, zona_horaria: 'America/Santo_Domingo', generado_en: '2026-11-20T14:05:00.481+00:00', filtros: filtrosDe(consulta), vacio,
})

/** Filas de detalle sintéticas con nombre distinto cada una (para probar el recorte y «mostrar más»). */
const filasAdultos = (cuantas: number) => Array.from({ length: cuantas }, (_, i) => ({
  envejeciente_id: i === 0 ? juanaId : `00000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}`,
  nombres: i === 0 ? 'Juana' : `Persona${String(i).padStart(3, '0')}`, apellidos: i === 0 ? 'Pérez Díaz' : 'Ejemplo', municipio, zona: 'Villa Juana', edad: 82, sexo: 'F',
  riesgo_vigente: i === 0 ? 'alto' : null, estado: 'activo', fecha_alta: '2026-11-02T14:10:00+00:00', personal_asignado: i === 0 ? 0 : 1,
}))

export function reporteDe(tipo: string, consulta: URLSearchParams, opciones: OpcionesReportes = {}): Json {
  const vacio = !!opciones.vacio
  const cero = (n: number) => (vacio ? 0 : n)
  const publicadas = opciones.truncado ? 120 : 2
  const total = opciones.truncado ? 7300 : 2
  const detalleTotal = vacio ? 0 : total
  const truncado = !vacio && !!opciones.truncado
  if (tipo === 'adultos') {
    return {
      ...cabecera('adultos', 'fecha_alta', consulta, vacio),
      indicadores: { registrados: cero(3), activos: cero(2), inactivos: cero(1), fallecidos: 0, riesgo_alto: cero(1), riesgo_medio: 0, riesgo_bajo: cero(1), sin_evaluacion: 0, edad_promedio: vacio ? null : 78.5, sin_personal_asignado: cero(2) },
      series: {
        por_riesgo: [punto('alto', 'Alto', cero(1), 50), punto('medio', 'Medio', 0, 0), punto('bajo', 'Bajo', cero(1), 50), punto('sin_evaluacion', 'Sin evaluación vigente', 0, 0)],
        por_estado: [punto('activo', 'Activo', cero(2), 67), punto('inactivo', 'Inactivo', cero(1), 33), punto('fallecido', 'Fallecido', 0, 0)],
        por_municipio: [punto('0101', 'Santo Domingo de Guzmán', cero(2), 67), punto('2501', 'Santiago de los Caballeros', cero(1), 33)],
        por_zona: [punto('Villa Juana', 'Villa Juana', cero(2), 67), punto('Centro', 'Centro', cero(1), 33), punto('sin_zona', 'Sin sector', 0, 0)],
        por_mes: [punto('2026-10', '2026-10', cero(1), 33), punto('2026-11', '2026-11', cero(2), 67)],
      },
      detalle: vacio ? [] : opciones.truncado ? filasAdultos(publicadas)
        : [...filasAdultos(1), { ...filasAdultos(2)[1], envejeciente_id: pedroId, nombres: 'Pedro', apellidos: 'Ramos', zona: null, municipio: null, edad: null, sexo: null, estado: 'inactivo' }],
      detalle_total: detalleTotal, detalle_truncado: truncado,
    }
  }
  if (tipo === 'visitas') {
    return {
      ...cabecera('visitas', 'fecha_visita', consulta, vacio),
      indicadores: { visitas_realizadas: cero(2), atenciones: cero(3), adultos_visitados: cero(2), adultos_activos: cero(5), promedio_por_adulto: vacio ? null : 1.5, requirieron_atencion: cero(1), situaciones_criticas: 0, visitas_compartidas: cero(1) },
      series: {
        por_mes: [punto('2026-11', '2026-11', cero(2), 100)],
        por_estado_general: [punto('estable', 'Estable', cero(2), 67), punto('requiere_atencion', 'Requiere atención', cero(1), 33), punto('situacion_critica', 'Situación crítica', 0, 0), punto('sin_registro', 'Sin registro', 0, 0)],
      },
      detalle: vacio ? [] : [{
        visita_id: 'a1111111-1111-4111-8111-111111111111', fecha: '2026-11-18', hora_inicio: '09:00', hora_fin: '09:40', razon: 'Seguimiento mensual', origen: 'interna',
        responsables: [{ usuario_id: 'u1', nombres: 'Ana', apellidos: 'Gómez' }],
        adultos: [{ envejeciente_id: juanaId, nombres: 'Juana', apellidos: 'Pérez Díaz', estado_general: 'requiere_atencion' }],
      }],
      detalle_total: detalleTotal, detalle_truncado: false,
    }
  }
  if (tipo === 'necesidades') {
    return {
      ...cabecera('necesidades', 'fecha_registro', consulta, vacio),
      indicadores: { registradas: cero(4), activas: cero(3), pendientes: cero(2), en_proceso: cero(1), resueltas: cero(1), canceladas: 0, porcentaje_resueltas: cero(25), prioridad_alta_activas: cero(1), recurrentes: cero(1), adultos_con_necesidades: cero(3), mas_frecuente: vacio ? null : { tipo_necesidad_id: 2, nombre: 'Transporte', total: 3 } },
      series: {
        por_tipo: [punto('2', 'Transporte', cero(3), 75), punto('1', 'Medicamentos', cero(1), 25)],
        por_estado: [punto('pendiente', 'Pendiente', cero(2), 50), punto('en_proceso', 'En proceso', cero(1), 25), punto('resuelta', 'Resuelta', cero(1), 25), punto('cancelada', 'Cancelada', 0, 0)],
        por_prioridad: [punto('alta', 'Alta', cero(1), 25), punto('media', 'Media', cero(3), 75)],
        recurrencia: [punto('recurrente', 'Recurrente', cero(1), 25), punto('puntual', 'Puntual', cero(3), 75)],
        por_mes: [punto('2026-11', '2026-11', cero(4), 100)],
      },
      detalle: vacio ? [] : [{ tipo_necesidad_id: 2, nombre: 'Transporte', total: 3, porcentaje: 75, pendientes: 2, en_proceso: 1, resueltas: 0, canceladas: 0, prioridad_alta: 1, recurrentes: 0 }],
      detalle_total: detalleTotal, detalle_truncado: false,
    }
  }
  return {
    ...cabecera('casos_prioritarios', 'fecha_alerta', consulta, vacio),
    indicadores: { alertas_prioritarias: cero(3), adultos_prioritarios: cero(2), casos_abiertos: cero(1), alertas_pendientes: cero(1), alertas_en_proceso: cero(1), alertas_resueltas: cero(1), resueltas_automaticamente: 0, porcentaje_resueltas: cero(33) },
    series: {
      por_estado: [punto('pendiente', 'Pendiente', cero(1), 33), punto('en_proceso', 'En proceso', cero(1), 33), punto('resuelta', 'Resuelta', cero(1), 33)],
      por_tipo: [punto('riesgo_alto', 'Riesgo alto', cero(1), 33), punto('medicamento_pendiente', 'Medicamentos pendientes', cero(2), 67), punto('necesidad_prioritaria', 'Necesidad prioritaria', 0, 0)],
      por_mes: [punto('2026-11', '2026-11', cero(3), 100)],
    },
    detalle: vacio ? [] : [{ envejeciente_id: juanaId, nombres: 'Juana', apellidos: 'Pérez Díaz', municipio, zona: 'Villa Juana', riesgo_vigente: 'alto', alertas: 2, alertas_abiertas: 2,
      tipos: ['medicamento_pendiente', 'riesgo_alto'], estado_actual: 'pendiente', ultima_alerta: '2026-11-18T13:00:00+00:00' }],
    detalle_total: detalleTotal, detalle_truncado: false,
  }
}

export function avanzadoDe(consulta: URLSearchParams, opciones: OpcionesReportes = {}): Json {
  const visitas = (valor: number | null) => (opciones.sinVisitas ? null : valor)
  const fila = (zona: string | null, nombre: string) => ({
    ...(zona !== undefined && { zona }), municipio: { codigo: '0101', nombre }, adultos_activos: 8, riesgo_alto: 2, visitas_realizadas: visitas(11), visitas_por_adulto: visitas(1.38),
    necesidades_activas: 3, alertas_abiertas: 4, dias_sin_visita_promedio: 9.5, sin_personal_asignado: 1,
  })
  return {
    tipo: 'analisis_avanzado', zona_horaria: 'America/Santo_Domingo', generado_en: '2026-11-20T14:05:00.481+00:00', filtros: filtrosDe(consulta), vacio: false,
    comparativo_zonas: [fila('Villa Juana', 'Santo Domingo de Guzmán'), fila('Centro', 'Santiago de los Caballeros')],
    comparativo_municipios: [{ ...fila(null, 'Santo Domingo de Guzmán'), zona: undefined }],
    tendencias: [
      { mes: '2026-10', visitas_realizadas: visitas(5), variacion_visitas: null, necesidades_registradas: 2, alertas_prioritarias: 1, perfiles_nuevos: 0 },
      { mes: '2026-11', visitas_realizadas: visitas(6), variacion_visitas: opciones.sinVisitas ? null : 20, necesidades_registradas: 4, alertas_prioritarias: 3, perfiles_nuevos: 1 },
    ],
  }
}

/* ───────────── Informe médico ───────────── */
export function informeDe(omitidas: NonNullable<OpcionesReportes['omitidas']> = []): Json {
  return {
    informe_id: '9a3c5e10-2b4f-4c6d-8e1a-7f0b9c2d3e41', generado_en: '2026-11-20T14:07:30.112+00:00',
    generado_por: { nombres: 'Laura', apellidos: 'Mejía', rol: 'coordinador' }, cuenta: { nombre: 'Fundación Esperanza' },
    aviso: 'CuidaRed no diagnostica ni sustituye al médico tratante.', secciones_omitidas: omitidas,
    identificacion: { envejeciente_id: juanaId, nombres: 'Juana', apellidos: 'Pérez Díaz', cedula: '00112345678', fecha_nacimiento: '1944-03-12', edad: 82, sexo: 'F', municipio, provincia: { codigo: '01', nombre: 'Distrito Nacional' }, estado: 'activo' },
    // El código del factor y del nivel puede ser null en filas heredadas del catálogo: se muestra el nombre.
    riesgo: omitidas.includes('riesgo') ? null : {
      nivel_vigente: 'alto',
      vigentes: [{ envejeciente_riesgo_id: '41', factor: { codigo: null, nombre: 'Riesgo de caída' }, nivel: { codigo: null, nombre: 'Alto' }, motivo: 'Caída reciente en el baño', observacion: null, fecha: '2026-11-10T15:00:00+00:00' }],
      historial: [{ envejeciente_riesgo_id: '41', factor: { codigo: null, nombre: 'Riesgo de caída' }, nivel: { codigo: 'alto', nombre: 'Alto' }, estado: 'activo', motivo: 'Caída reciente en el baño', fecha: '2026-11-10T15:00:00+00:00', fecha_resolucion: null }],
      historial_total: 1,
    },
    indicaciones: omitidas.includes('indicaciones') ? null : {
      vigentes: [{ indicacion_medica_id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f', tipo: { tipo_indicacion_id: 1, nombre: 'Medicamento' }, titulo: 'Losartán 50 mg', descripcion: 'Una tableta en la mañana.', frecuencia_horario: 'Diaria, 8:00', fecha_inicio: '2026-10-01', fecha_fin: null, registrada_por: { nombres: 'Ana', apellidos: 'Gómez' } }],
      no_vigentes: 2,
    },
    visitas: omitidas.includes('visitas') ? null : {
      realizadas_total: 7, ultima_fecha: '2026-11-01',
      recientes: [{ visita_id: '6c0f3b9a-0b1e-4a65-8d0e-3c6a4e0f9a21', fecha: '2026-11-01', hora_inicio: '09:00', hora_fin: '09:40', origen: 'interna', responsables: [{ nombres: 'Ana', apellidos: 'Gómez' }], estado_general: 'requiere_atencion', observacion: 'Refiere mareos por la mañana.' }],
    },
  }
}

export const EXPORTACION = {
  exportacion_id: '3f9b2a40-8c1d-4e7a-9b55-0d4f6e2a1c90', fecha: '2026-11-20T14:06:12.004+00:00',
  generado_por: { nombres: 'Laura', apellidos: 'Mejía', rol: 'coordinador' }, cuenta: { nombre: 'Fundación Esperanza' },
}

/** Nombre que el servidor da al CSV: `reporte-<tipo de la ruta>-<fecha de negocio>.csv`. */
export const nombreCsv = (tipo: string) => `reporte-${tipo}-${hoyRD()}.csv`

/**
 * Simula las rutas de la fase 7 de la cuenta. Va después de `simular`: las rutas de la página tienen prioridad sobre las
 * del contexto. Devuelve las llamadas recibidas y el orden en que ocurrieron los registros y las descargas.
 */
export async function montarReportes(page: Page, cuenta: CuentaSim, opciones: OpcionesReportes = {}) {
  const llamadas: Llamada[] = []
  const orden: string[] = []
  const casos = opciones.casos ?? [casoDe(1), casoDe(2), casoDe(3)]
  const adulto = { envejeciente_id: juanaId, nombres: 'Juana', apellidos: 'Pérez Díaz', estado: 'activo', municipio_cod: '0101', municipio_nombre: municipio.nombre, zona: 'Villa Juana' }
  page.on('download', () => orden.push('descarga'))
  await page.route(`${API}/api/v1/catalogos/tipos-necesidad`, (req) =>
    req.fulfill({ json: { data: [{ tipo_necesidad_id: 1, nombre: 'Medicamentos' }, { tipo_necesidad_id: 2, nombre: 'Transporte' }] } }))
  await page.route(`${API}${prefijoApi}/**`, async (req) => {
    const peticion = req.request()
    const url = new URL(peticion.url())
    const sub = url.pathname.slice(prefijoApi.length)
    const metodo = peticion.method()
    llamadas.push({ metodo, ruta: sub, consulta: url.searchParams, cuerpo: metodo === 'GET' ? undefined : (peticion.postDataJSON() ?? {}) as Json, autorizacion: peticion.headers().authorization })
    if (sub === '/contexto') return req.fulfill({ json: { data: cuenta } })

    if (sub === '/resumen-casos/indicadores') return opciones.errorResumen ? req.fulfill(error(opciones.errorResumen.status, opciones.errorResumen.code)) : req.fulfill({ json: { data: INDICADORES } })
    if (sub === '/resumen-casos') {
      if (opciones.errorResumen) return req.fulfill(error(opciones.errorResumen.status, opciones.errorResumen.code))
      return req.fulfill({ json: pagina(filtrarCasos(casos, url.searchParams), url.searchParams) })
    }

    if (sub === '/reportes/exportaciones' && metodo === 'POST') {
      orden.push('registro')
      if (opciones.errorRegistro) return req.fulfill(error(opciones.errorRegistro.status, opciones.errorRegistro.code))
      const cuerpo = (peticion.postDataJSON() ?? {}) as { tipo: string; formato: string; filtros?: Record<string, unknown> }
      return req.fulfill({ status: 201, json: { data: { ...EXPORTACION, tipo: cuerpo.tipo, formato: cuerpo.formato, filtros: { ...SIN_FILTROS, ...(cuerpo.filtros ?? {}) } } } })
    }
    const csv = sub.match(/^\/reportes\/([^/]+)\/exportacion$/)
    if (csv) {
      orden.push('csv')
      if (opciones.errorCsv) return req.fulfill(error(opciones.errorCsv.status, opciones.errorCsv.code))
      return req.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${nombreCsv(csv[1]!)}"`,
          ...(opciones.sinExponerCabecera ? {} : { 'access-control-expose-headers': 'Content-Disposition' }),
        },
        body: `﻿Reporte CuidaRed,${csv[1]}\r\nIndicador,Valor\r\n`,
      })
    }
    if (sub.startsWith('/reportes/') && opciones.errorReporte) return req.fulfill(error(opciones.errorReporte.status, opciones.errorReporte.code))
    if (sub === '/reportes/analisis-avanzado') return req.fulfill({ json: { data: avanzadoDe(url.searchParams, opciones) } })
    const reporte = sub.match(/^\/reportes\/([^/]+)$/)
    if (reporte) {
      const tipo = reporte[1]!.replace('-', '_')
      if (!['adultos', 'visitas', 'necesidades', 'casos_prioritarios'].includes(tipo)) return req.fulfill(error(404, 'NOT_FOUND'))
      return req.fulfill({ json: { data: reporteDe(tipo, url.searchParams, opciones) } })
    }

    if (sub === '/envejecientes') return req.fulfill({ json: pagina([adulto], url.searchParams) })
    if (sub === `/envejecientes/${juanaId}/informe-medico`) {
      if (opciones.errorInforme) return req.fulfill(error(opciones.errorInforme.status, opciones.errorInforme.code))
      return req.fulfill({ json: { data: informeDe(opciones.omitidas) } })
    }
    if (sub === `/envejecientes/${juanaId}/historial`) return req.fulfill({ json: pagina([], url.searchParams) })
    if (sub === `/envejecientes/${juanaId}/riesgo`) return req.fulfill({ json: { data: { nivel_vigente: 'alto' } } })
    if (sub === `/envejecientes/${juanaId}`) return req.fulfill({ json: { data: adulto } })
    return req.fallback()
  })
  return {
    llamadas,
    orden,
    /** Llamadas GET a una ruta (sin el prefijo de la cuenta). */
    de: (patron: RegExp, metodo = 'GET') => llamadas.filter((l) => l.metodo === metodo && patron.test(l.ruta)),
  }
}
