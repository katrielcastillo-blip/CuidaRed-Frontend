/*
 * resumen-informe-datos.test.ts — Reglas puras del resumen de casos, del informe médico y de los mensajes de error de
 * la fase 7 conectada: consulta (filtros, orden y búsqueda), textos, opciones de filtro y nombre del archivo.
 * Módulo: pruebas (ID07, RF-07).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { describe, expect, it } from 'vitest'
import type { CasoResumen, InformeMedicoApi } from '@/features/access-real/api/reportes'
import { ApiError } from '@/features/access-real/client'
import { MOTIVO_OMISION, nombreArchivoInforme, resumenOmitidas, vigenciaIndicacion } from '@/features/access-real/operacion/informe-medico-datos'
import { mensajeReporte } from '@/features/access-real/operacion/reportes-errores'
import {
  consultaResumen,
  ESTADOS_ATENCION,
  FILTROS_RESUMEN_INICIALES,
  hayFiltrosResumen,
  opcionesDeCasos,
  sentidoDeOrden,
  terminoDeBusqueda,
  textoMotivo,
  textoSeguimiento,
} from '@/features/access-real/operacion/resumen-datos'

const caso = (id: string, extra: Partial<CasoResumen> = {}): CasoResumen => ({
  envejeciente_id: id, nombres: 'Juana', apellidos: 'Pérez', municipio: { codigo: '0101', nombre: 'Santo Domingo' }, zona: 'Villa Juana', fecha_alta: '2026-08-02T14:10:00+00:00',
  riesgo_vigente: null, prioridad: 'baja', estado_atencion: 'al_dia', motivos: [], alertas: { abiertas: 0, pendientes: 0, en_proceso: 0, prioritarias_abiertas: 0 }, necesidades_activas: 0,
  seguimiento: { ultima_visita_id: null, ultima_visita_fecha: null, fecha_referencia: '2026-08-02', dias_sin_visita: 110, umbral_dias: 15, vencido: true },
  asignados: { total: 0, cuidadores: [], voluntarios: [] }, ...extra,
})

describe('consulta del resumen de casos', () => {
  it('ordena por prioridad por defecto y no envía filtros vacíos', () => {
    expect(consultaResumen(FILTROS_RESUMEN_INICIALES, 'prioridad', false)).toEqual({ sort: ['prioridad'], filters: {} })
  })

  it('invierte el orden con un guion y envía solo los filtros con valor', () => {
    const consulta = consultaResumen({ ...FILTROS_RESUMEN_INICIALES, estado: 'alerta_en_proceso', riesgo: 'sin_evaluacion', municipio: '0101', zona: ' Villa Juana ', asignado: 'sin', prioridad: 'alta' }, 'ultima_visita', true)
    expect(consulta).toEqual({
      sort: ['-ultima_visita'],
      filters: { estado_atencion: 'alerta_en_proceso', prioridad: 'alta', riesgo: 'sin_evaluacion', municipio_cod: '0101', zona: 'Villa Juana', asignado: 'sin' },
    })
  })

  it('no envía una búsqueda de menos de 2 caracteres y recorta a 60', () => {
    expect(terminoDeBusqueda('a')).toBeUndefined()
    expect(terminoDeBusqueda('   ')).toBeUndefined()
    expect(terminoDeBusqueda('  ju   an ')).toBe('ju an')
    expect(terminoDeBusqueda('x'.repeat(80))).toHaveLength(60)
    expect(consultaResumen({ ...FILTROS_RESUMEN_INICIALES, busqueda: 'j' }, 'nombre', false).filters).toEqual({})
    expect(consultaResumen({ ...FILTROS_RESUMEN_INICIALES, busqueda: 'Juana' }, 'nombre', false).filters).toEqual({ q: 'Juana' })
  })

  it('sabe si hay filtros activos', () => {
    expect(hayFiltrosResumen(FILTROS_RESUMEN_INICIALES)).toBe(false)
    expect(hayFiltrosResumen({ ...FILTROS_RESUMEN_INICIALES, zona: 'Centro' })).toBe(true)
    expect(hayFiltrosResumen({ ...FILTROS_RESUMEN_INICIALES, busqueda: '   ' })).toBe(false)
  })

  it('describe el sentido de cada orden y su inverso', () => {
    expect(sentidoDeOrden('prioridad', false)).toBe('alta primero')
    expect(sentidoDeOrden('prioridad', true)).toBe('baja primero')
    expect(sentidoDeOrden('nombre', false)).toBe('de la A a la Z')
  })
})

describe('textos del resumen', () => {
  it('usa los estados de atención del servidor, del más al menos urgente', () => {
    expect(ESTADOS_ATENCION.map((e) => e.value)).toEqual(['alerta_pendiente', 'alerta_en_proceso', 'seguimiento_vencido', 'necesidades_activas', 'al_dia'])
  })

  it('traduce los motivos y deja legible un código desconocido', () => {
    expect(textoMotivo('alerta_prioritaria_abierta')).toBe('Alerta prioritaria abierta')
    expect(textoMotivo('sin_evaluacion_vigente')).toBe('Sin evaluación vigente')
    expect(textoMotivo('motivo_nuevo')).toBe('motivo nuevo')
  })

  it('cuenta los días desde la última visita o desde el alta si nunca fue visitado', () => {
    expect(textoSeguimiento({ ultima_visita_id: 'v', ultima_visita_fecha: '2026-11-01', fecha_referencia: '2026-11-01', dias_sin_visita: 19, umbral_dias: 15, vencido: true }))
      .toBe('Última visita realizada: 01/11/2026 (hace 19 días)')
    expect(textoSeguimiento({ ultima_visita_id: 'v', ultima_visita_fecha: '2026-11-19', fecha_referencia: '2026-11-19', dias_sin_visita: 1, umbral_dias: 15, vencido: false }))
      .toBe('Última visita realizada: 19/11/2026 (hace 1 día)')
    expect(textoSeguimiento({ ultima_visita_id: 'v', ultima_visita_fecha: '2026-11-20', fecha_referencia: '2026-11-20', dias_sin_visita: 0, umbral_dias: 15, vencido: false })).toContain('(hoy)')
    expect(textoSeguimiento({ ultima_visita_id: null, ultima_visita_fecha: null, fecha_referencia: '2026-08-02', dias_sin_visita: 110, umbral_dias: 15, vencido: true }))
      .toBe('Sin visitas realizadas · en seguimiento desde 02/08/2026 (hace 110 días)')
  })
})

describe('opciones de los filtros del resumen', () => {
  it('reúne municipios, sectores y personas sin repetir y ordenados', () => {
    const ana = { usuario_id: 'u1', nombres: 'Ana', apellidos: 'Gómez' }
    const luis = { usuario_id: 'u2', nombres: 'Luis', apellidos: 'Peña' }
    const opciones = opcionesDeCasos([
      caso('1', { asignados: { total: 1, cuidadores: [ana], voluntarios: [] } }),
      caso('2', { zona: 'Centro', municipio: { codigo: '2501', nombre: 'Santiago' }, asignados: { total: 2, cuidadores: [ana], voluntarios: [luis] } }),
      caso('3', { zona: null, municipio: null }),
    ])
    expect(opciones.municipios).toEqual([{ value: '0101', label: 'Santo Domingo' }, { value: '2501', label: 'Santiago' }].sort((a, b) => a.label.localeCompare(b.label, 'es')))
    expect(opciones.sectores.map((o) => o.value)).toEqual(['Centro', 'Villa Juana'])
    expect(opciones.personas).toEqual([{ value: 'u1', label: 'Ana Gómez · Cuidador' }, { value: 'u2', label: 'Luis Peña · Voluntario' }])
  })
})

describe('informe médico', () => {
  it('arma el nombre del archivo sin acentos ni signos', () => {
    expect(nombreArchivoInforme({ nombres: 'Juana', apellidos: 'Pérez Díaz' }, '2026-11-20')).toBe('informe-medico-perez-diaz-juana-2026-11-20.pdf')
    expect(nombreArchivoInforme({ nombres: '', apellidos: '' }, '2026-11-20')).toBe('informe-medico-adulto-2026-11-20.pdf')
  })

  it('lista las secciones omitidas en el orden del servidor y explica cada una', () => {
    const omitidas: InformeMedicoApi['secciones_omitidas'] = ['indicaciones', 'riesgo', 'visitas']
    expect(resumenOmitidas(omitidas)).toBe('Indicaciones médicas, Riesgo, Visitas')
    expect(resumenOmitidas([])).toBe('')
    expect(MOTIVO_OMISION.visitas).toMatch(/esta cuenta o para tu rol/)
  })

  it('escribe la vigencia con o sin fecha de fin', () => {
    expect(vigenciaIndicacion('2026-10-01', null)).toBe('Desde 01/10/2026 · sin fecha de fin')
    expect(vigenciaIndicacion('2026-10-01', '2026-12-31')).toBe('Desde 01/10/2026 hasta 31/12/2026')
  })
})

describe('mensajes de error de la fase 7', () => {
  it('explica la cuenta sin acceso vigente', () => {
    expect(mensajeReporte(new ApiError(403, 'x', 'SUBSCRIPTION_INACTIVE'), 'consultar')).toMatch(/no tiene una prueba o un plan vigente/)
  })

  it('distingue el 403 según la acción', () => {
    expect(mensajeReporte(new ApiError(403, 'x', 'FORBIDDEN'), 'consultar')).toMatch(/plan de la cuenta no la incluye/)
    expect(mensajeReporte(new ApiError(403, 'x', 'FORBIDDEN'), 'exportar')).toMatch(/No se generó el archivo/)
    expect(mensajeReporte(new ApiError(403, 'x', 'FORBIDDEN'), 'informe')).toMatch(/informe médico/)
  })

  it('traduce 404, 422, 429 y la falta de conexión sin detalles técnicos', () => {
    expect(mensajeReporte(new ApiError(404, 'x', 'NOT_FOUND'), 'informe')).toMatch(/expediente/)
    expect(mensajeReporte(new ApiError(422, 'x', 'INVALID_INPUT'), 'consultar')).toMatch(/filtros/)
    expect(mensajeReporte(new ApiError(429, 'x', 'RATE_LIMITED'), 'consultar')).toMatch(/demasiadas consultas/)
    expect(mensajeReporte(new ApiError(503, 'No se pudo conectar con CuidaRed. Intenta de nuevo.', 'DEPENDENCY_UNAVAILABLE'), 'consultar')).toBe('No se pudo conectar con CuidaRed. Intenta de nuevo.')
    expect(mensajeReporte(new TypeError('Failed to fetch'), 'exportar')).not.toMatch(/fetch/)
  })
})
