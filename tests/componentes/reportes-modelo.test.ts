/*
 * reportes-modelo.test.ts — Reglas puras de los reportes conectados (fase 7): rangos y filtros, parámetros `filter[...]`,
 * rutas, nombre de descarga, permisos por rol y paso de la respuesta del servidor al modelo de reporte.
 * Módulo: pruebas (ID07, RF-08).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { describe, expect, it } from 'vitest'
import {
  consultaDeFiltros,
  filtrosDeRespuesta,
  nombreDeDescarga,
  rutaAnalisisAvanzado,
  rutaCsv,
  rutaReporte,
  type AnalisisAvanzadoApi,
  type ExportacionApi,
  type FiltrosAplicados,
  type ReporteApi,
} from '@/features/access-real/api/reportes'
import {
  avanzadoSinVisitas,
  construirAvanzado,
  construirReporte,
  contextoDeExportacion,
  describirFiltros,
  errorRango,
  etiquetaMes,
  etiquetasDeSectores,
  filtrosDeSeleccion,
  hayFiltros,
  hoyRD,
  incluyeFuncionalidad,
  limitesRango,
  nombreDeArchivo,
  notaDeDetalle,
  opcionesUbicacion,
  SELECCION_INICIAL,
  tiposDisponibles,
} from '@/features/access-real/operacion/reportes-modelo'

const SIN_FILTROS: FiltrosAplicados = { desde: null, hasta: null, municipio_cod: null, zona: null, riesgo: null, tipo_necesidad_id: null }
const base = { campo_fecha: 'fecha_alta', zona_horaria: 'America/Santo_Domingo', generado_en: '2026-11-20T14:05:00.481+00:00', filtros: SIN_FILTROS, vacio: false, detalle_total: 0, detalle_truncado: false }
const punto = (clave: string, etiqueta: string, valor: number, porcentaje = 0) => ({ clave, etiqueta, valor, porcentaje })
const juana = { envejeciente_id: '0b6e1f0e-5c8f-4a51-9f8e-2d9d7a1c4b10', nombres: 'Juana', apellidos: 'Pérez Díaz', municipio: { codigo: '0101', nombre: 'Santo Domingo de Guzmán' }, zona: 'Villa Juana' }

describe('fecha de hoy y rangos', () => {
  it('usa el calendario de Santo Domingo, no el del dispositivo ni el UTC', () => {
    // 02:30 UTC del 21 todavía es la noche del 20 en Santo Domingo (UTC-4).
    expect(hoyRD(new Date('2026-11-21T02:30:00Z'))).toBe('2026-11-20')
    expect(hoyRD(new Date('2026-11-21T04:00:00Z'))).toBe('2026-11-21')
  })

  it('arma los rangos predefinidos de forma inclusiva hasta hoy', () => {
    const hoy = '2026-11-20'
    expect(limitesRango('todo', hoy)).toEqual({})
    expect(limitesRango('mes', hoy)).toEqual({ desde: '2026-11-01', hasta: hoy })
    expect(limitesRango('3m', hoy)).toEqual({ desde: '2026-09-01', hasta: hoy })
    expect(limitesRango('6m', hoy)).toEqual({ desde: '2026-06-01', hasta: hoy })
    expect(limitesRango('anio', hoy)).toEqual({ desde: '2026-01-01', hasta: hoy })
  })

  it('retrocede al año anterior cuando el rango cruza el cambio de año', () => {
    expect(limitesRango('3m', '2026-02-10')).toEqual({ desde: '2025-12-01', hasta: '2026-02-10' })
    expect(limitesRango('6m', '2026-01-31')).toEqual({ desde: '2025-08-01', hasta: '2026-01-31' })
  })

  it('el rango personalizado deja pasar solo las fechas escritas', () => {
    expect(limitesRango('personalizado', '2026-11-20', '2026-10-01', '')).toEqual({ desde: '2026-10-01' })
    expect(limitesRango('personalizado', '2026-11-20', '', '2026-10-31')).toEqual({ hasta: '2026-10-31' })
    expect(limitesRango('personalizado', '2026-11-20', '', '')).toEqual({})
  })

  it('detecta un rango incoherente solo en el personalizado', () => {
    expect(errorRango('personalizado', '2026-11-02', '2026-11-01')).toMatch(/igual o posterior/)
    expect(errorRango('personalizado', '2026-11-01', '2026-11-01')).toBeUndefined()
    expect(errorRango('personalizado', '2026-11-02', '')).toBeUndefined()
    expect(errorRango('mes', '2026-11-02', '2026-11-01')).toBeUndefined()
  })
})

describe('filtros del contrato', () => {
  it('solo envía los filtros con valor y no manda fechas si el rango es incorrecto', () => {
    expect(filtrosDeSeleccion(SELECCION_INICIAL, '2026-11-20')).toEqual({})
    expect(filtrosDeSeleccion({ ...SELECCION_INICIAL, rango: 'mes', municipio: '0101', zona: 'Villa Juana', riesgo: 'sin_evaluacion' }, '2026-11-20'))
      .toEqual({ desde: '2026-11-01', hasta: '2026-11-20', municipio_cod: '0101', zona: 'Villa Juana', riesgo: 'sin_evaluacion' })
    expect(filtrosDeSeleccion({ ...SELECCION_INICIAL, rango: 'personalizado', desde: '2026-11-05', hasta: '2026-11-01' }, '2026-11-20')).toEqual({})
    expect(filtrosDeSeleccion({ ...SELECCION_INICIAL, categoria: '3' }, '2026-11-20')).toEqual({ tipo_necesidad_id: 3 })
    expect(filtrosDeSeleccion({ ...SELECCION_INICIAL, categoria: 'x' }, '2026-11-20')).toEqual({})
  })

  it('sabe cuándo hay filtros activos', () => {
    expect(hayFiltros(SELECCION_INICIAL)).toBe(false)
    expect(hayFiltros({ ...SELECCION_INICIAL, rango: '6m' })).toBe(true)
    expect(hayFiltros({ ...SELECCION_INICIAL, zona: 'Centro' })).toBe(true)
  })

  it('arma filter[...] y envía la categoría solo en el reporte de necesidades', () => {
    const filtros = { desde: '2026-11-01', hasta: '2026-11-20', municipio_cod: '0101', zona: 'Villa Juana', riesgo: 'alto' as const, tipo_necesidad_id: 2 }
    expect(consultaDeFiltros(filtros, true).toString()).toBe(
      'filter%5Bdesde%5D=2026-11-01&filter%5Bhasta%5D=2026-11-20&filter%5Bmunicipio_cod%5D=0101&filter%5Bzona%5D=Villa+Juana&filter%5Briesgo%5D=alto&filter%5Btipo_necesidad_id%5D=2')
    expect(consultaDeFiltros(filtros, false).has('filter[tipo_necesidad_id]')).toBe(false)
    expect(consultaDeFiltros({ zona: '' }, false).toString()).toBe('')
  })

  it('usa guion en la ruta y no añade page ni limit (el reporte no es una colección)', () => {
    expect(rutaReporte('/cuentas/9', 'casos_prioritarios', {})).toBe('/cuentas/9/reportes/casos-prioritarios')
    expect(rutaReporte('/cuentas/9', 'visitas', { desde: '2026-11-01' })).toBe('/cuentas/9/reportes/visitas?filter%5Bdesde%5D=2026-11-01')
    expect(rutaReporte('/cuentas/9', 'adultos', { tipo_necesidad_id: 4 })).toBe('/cuentas/9/reportes/adultos')
    expect(rutaAnalisisAvanzado('/cuentas/9', { riesgo: 'bajo', tipo_necesidad_id: 4 })).toBe('/cuentas/9/reportes/analisis-avanzado?filter%5Briesgo%5D=bajo')
    expect(rutaCsv('/cuentas/9', 'casos_prioritarios', { desde: '2026-11-01' })).toBe('/cuentas/9/reportes/casos-prioritarios/exportacion?formato=csv&filter%5Bdesde%5D=2026-11-01')
  })

  it('pasa los filtros que devolvió el servidor al objeto de las exportaciones, sin null', () => {
    expect(filtrosDeRespuesta({ ...SIN_FILTROS, desde: '2026-11-01', riesgo: 'sin_evaluacion', tipo_necesidad_id: 3 }))
      .toEqual({ desde: '2026-11-01', riesgo: 'sin_evaluacion', tipo_necesidad_id: 3 })
    expect(filtrosDeRespuesta(SIN_FILTROS)).toEqual({})
  })
})

describe('nombre de la descarga', () => {
  it('toma el nombre simple de Content-Disposition', () => {
    expect(nombreDeDescarga('attachment; filename="reporte-adultos-2026-11-20.csv"')).toBe('reporte-adultos-2026-11-20.csv')
    expect(nombreDeDescarga('attachment; filename=reporte-visitas-2026-11-20.csv')).toBe('reporte-visitas-2026-11-20.csv')
  })

  it('rechaza nombres con rutas o sin cabecera y deja que la pantalla arme el suyo', () => {
    expect(nombreDeDescarga(null)).toBeNull()
    expect(nombreDeDescarga('attachment')).toBeNull()
    expect(nombreDeDescarga('attachment; filename="../../etc/passwd"')).toBeNull()
    expect(nombreDeDescarga('attachment; filename="a/b.csv"')).toBeNull()
  })

  it('arma el nombre del archivo del navegador con el mismo patrón del servidor', () => {
    expect(nombreDeArchivo('casos-prioritarios', '2026-11-20', 'pdf')).toBe('reporte-casos-prioritarios-2026-11-20.pdf')
    expect(nombreDeArchivo('adultos', '2026-11-20', 'xlsx')).toBe('reporte-adultos-2026-11-20.xlsx')
  })
})

describe('permisos y plan (informativos)', () => {
  const cuenta = (tipo: 'familia' | 'organizacion', permisos: string[], funcionalidades?: string[]) => ({ tipo, permisos, funcionalidades })

  it('Familia no tiene reporte de visitas aunque el rol tenga visitas:ver', () => {
    expect(tiposDisponibles(cuenta('familia', ['reportes:ver', 'visitas:ver']))).toEqual(['adultos', 'necesidades', 'casos_prioritarios'])
  })

  it('Organización ve visitas solo con visitas:ver', () => {
    expect(tiposDisponibles(cuenta('organizacion', ['reportes:ver', 'visitas:ver']))).toEqual(['adultos', 'visitas', 'necesidades', 'casos_prioritarios'])
    expect(tiposDisponibles(cuenta('organizacion', ['reportes:ver']))).toEqual(['adultos', 'necesidades', 'casos_prioritarios'])
  })

  it('sin reportes:ver no hay ningún tipo', () => {
    expect(tiposDisponibles(cuenta('organizacion', ['resumen:ver', 'visitas:ver']))).toEqual([])
  })

  it('lee el plan de funcionalidades del contexto y trata su ausencia como no incluido', () => {
    expect(incluyeFuncionalidad({ funcionalidades: ['dashboard_metricas'] }, 'dashboard_metricas')).toBe(true)
    expect(incluyeFuncionalidad({ funcionalidades: ['dashboard_metricas'] }, 'reportes_avanzados')).toBe(false)
    expect(incluyeFuncionalidad({}, 'dashboard_metricas')).toBe(false)
  })
})

describe('textos', () => {
  it('abrevia el mes y deja intacto lo que no es un mes', () => {
    expect(etiquetaMes('2026-11')).toBe('Nov 2026')
    expect(etiquetaMes('2026-01')).toBe('Ene 2026')
    expect(etiquetaMes('2026-13')).toBe('2026-13')
    expect(etiquetaMes('otro')).toBe('otro')
  })

  it('describe los filtros con el nombre del municipio y de la categoría', () => {
    const filtros = { ...SIN_FILTROS, desde: '2026-11-01', hasta: '2026-11-20', municipio_cod: '0101', riesgo: 'sin_evaluacion' as const, tipo_necesidad_id: 2 }
    expect(describirFiltros(filtros, 'fecha_registro', { municipio: 'Santo Domingo de Guzmán', categoria: 'Transporte' })).toEqual([
      'Período: 01/11/2026 – 20/11/2026',
      'Fecha que filtra: fecha de registro de la necesidad',
      'Municipio: Santo Domingo de Guzmán',
      'Sector: Todos',
      'Riesgo: Sin evaluación vigente',
      'Categoría: Transporte',
    ])
    expect(describirFiltros(SIN_FILTROS, 'fecha_visita')).toEqual([
      'Período: Todo el tiempo', 'Fecha que filtra: fecha de la visita', 'Municipio: Todos', 'Sector: Todos', 'Riesgo: Todos',
    ])
    expect(describirFiltros({ ...SIN_FILTROS, desde: '2026-11-01' }, null)[0]).toBe('Período: Desde 01/11/2026')
    expect(describirFiltros({ ...SIN_FILTROS, hasta: '2026-11-20' }, null)[0]).toBe('Período: Hasta 20/11/2026')
  })

  it('añade el municipio a un sector repetido en dos municipios y nombra el sector vacío', () => {
    const centro = { codigo: '0101', nombre: 'Santo Domingo' }
    const otro = { codigo: '2501', nombre: 'Santiago' }
    expect(etiquetasDeSectores([{ zona: 'Centro', municipio: centro }, { zona: 'Centro', municipio: otro }, { zona: null, municipio: centro }, { zona: 'Norte', municipio: centro }]))
      .toEqual(['Centro (Santo Domingo)', 'Centro (Santiago)', 'Sin sector', 'Norte'])
  })

  it('arma la nota del detalle solo si el servidor lo recortó', () => {
    expect(notaDeDetalle({ detalle: [], detalle_total: 0, detalle_truncado: false })).toBeUndefined()
    const nota = notaDeDetalle({ detalle: new Array(5000).fill(0), detalle_total: 7300, detalle_truncado: true })
    expect(nota).toContain('5,000 de 7,300')
    expect(nota).toContain('Detalle recortado')
  })
})

describe('reporte de adultos', () => {
  const api: ReporteApi = {
    ...base,
    tipo: 'adultos',
    indicadores: { registrados: 3, activos: 2, inactivos: 1, fallecidos: 0, riesgo_alto: 1, riesgo_medio: 0, riesgo_bajo: 1, sin_evaluacion: 0, edad_promedio: 78.5, sin_personal_asignado: 2 },
    series: {
      por_riesgo: [punto('alto', 'Alto', 1, 50), punto('medio', 'Medio', 0), punto('bajo', 'Bajo', 1, 50), punto('sin_evaluacion', 'Sin evaluación vigente', 0)],
      por_estado: [punto('activo', 'Activo', 2, 67), punto('inactivo', 'Inactivo', 1, 33), punto('fallecido', 'Fallecido', 0)],
      por_municipio: [punto('0101', 'Santo Domingo de Guzmán', 2, 100)],
      por_zona: [punto('Villa Juana', 'Villa Juana', 1, 50), punto('sin_zona', 'Sin sector', 1, 50)],
      por_mes: [punto('2026-10', '2026-10', 1, 33), punto('2026-11', '2026-11', 2, 67)],
    },
    detalle: [
      { envejeciente_id: juana.envejeciente_id, nombres: 'Juana', apellidos: 'Pérez Díaz', municipio: juana.municipio, zona: 'Villa Juana', edad: 82, sexo: 'F', riesgo_vigente: 'alto', estado: 'activo', fecha_alta: '2026-11-02T14:10:00+00:00', personal_asignado: 0 },
      { envejeciente_id: '2', nombres: 'Pedro', apellidos: 'Ramos', municipio: null, zona: null, edad: null, sexo: null, riesgo_vigente: null, estado: 'inactivo', fecha_alta: '2026-10-05T14:10:00+00:00', personal_asignado: 1 },
    ],
    detalle_total: 2,
  }

  it('traduce indicadores, marca los de alerta y no inventa valores', () => {
    const { kpis } = construirReporte(api)
    expect(kpis).toHaveLength(10)
    expect(kpis[0]).toEqual({ etiqueta: 'Adultos registrados', valor: 3 })
    expect(kpis.find((k) => k.etiqueta === 'Riesgo alto')).toMatchObject({ valor: 1, peligro: true, nota: 'Entre los activos' })
    expect(kpis.find((k) => k.etiqueta === 'Riesgo medio')?.peligro).toBeUndefined()
    expect(kpis.find((k) => k.etiqueta === 'Edad promedio')?.valor).toBe('78.5')
    expect(kpis.find((k) => k.etiqueta === 'Sin evaluación vigente')?.valor).toBe(0)
  })

  it('un promedio nulo se muestra como guion y un indicador ausente no rompe', () => {
    const { kpis } = construirReporte({ ...api, indicadores: { registrados: 0, edad_promedio: null } })
    expect(kpis.find((k) => k.etiqueta === 'Edad promedio')?.valor).toBe('—')
    expect(kpis.find((k) => k.etiqueta === 'Activos')?.valor).toBe('—')
  })

  it('arma un gráfico por serie, con anillo para partes de un todo y colores de riesgo', () => {
    const { graficos } = construirReporte(api)
    expect(graficos.map((g) => g.id)).toEqual(['adultos-por_riesgo', 'adultos-por_estado', 'adultos-por_municipio', 'adultos-por_zona', 'adultos-por_mes'])
    expect(graficos[0]).toMatchObject({ visual: 'dona', titulo: 'Adultos activos por nivel de riesgo' })
    expect(graficos[0]!.barras.map((b) => b.riesgo)).toEqual(['alto', 'medio', 'bajo', undefined])
    expect(graficos[2]!.visual).toBeUndefined()
    expect(graficos[4]).toMatchObject({ forma: 'v' })
    expect(graficos[4]!.barras.map((b) => b.etiqueta)).toEqual(['Oct 2026', 'Nov 2026'])
    expect(graficos[1]!.barras[0]).toEqual({ etiqueta: 'Activo', valor: 2, pct: 67 })
  })

  it('omite una serie que el servidor no envió', () => {
    const { series: _, ...resto } = api
    const { graficos } = construirReporte({ ...resto, series: { por_estado: api.series.por_estado! } })
    expect(graficos.map((g) => g.id)).toEqual(['adultos-por_estado'])
  })

  it('arma el detalle con enlace al adulto, riesgo y valores vacíos legibles', () => {
    const { tabla, tipo, titulo } = construirReporte(api)
    expect(titulo).toBe('Adultos mayores registrados')
    expect(tipo).toBe('adultos')
    expect(tabla.columnas.map((c) => c.etiqueta)).toEqual(['Adulto mayor', 'Municipio', 'Sector', 'Edad', 'Sexo', 'Riesgo vigente', 'Estado', 'Fecha de alta', 'Personal asignado'])
    expect(tabla.filas[0]).toMatchObject({ id: juana.envejeciente_id, adultoId: juana.envejeciente_id, riesgo: 'alto' })
    expect(tabla.filas[0]!.celdas.slice(0, 7)).toEqual(['Juana Pérez Díaz', 'Santo Domingo de Guzmán', 'Villa Juana', 82, 'Femenino', 'Alto', 'Activo'])
    expect(tabla.filas[1]!.celdas).toEqual(['Pedro Ramos', '—', '—', '—', '—', 'Sin evaluación vigente', 'Inactivo', '05/10/2026', 1])
    expect(tabla.filas[1]!.riesgo).toBeUndefined()
    expect(tabla.nota).toBeUndefined()
  })

  it('un reporte vacío conserva la estructura y se marca como vacío', () => {
    const vacio = construirReporte({ ...api, vacio: true, detalle: [], detalle_total: 0, indicadores: { registrados: 0, edad_promedio: null } })
    expect(vacio.vacio).toBe(true)
    expect(vacio.tabla.filas).toEqual([])
    expect(vacio.graficos).toHaveLength(5)
  })

  it('avisa en la tabla cuando el servidor recortó el detalle', () => {
    expect(construirReporte({ ...api, detalle_truncado: true, detalle_total: 9000 }).tabla.nota).toContain('de 9,000 filas')
  })

  it('saca las opciones de municipio y sector de las series y descarta el sector vacío', () => {
    expect(opcionesUbicacion(api)).toEqual({
      municipios: [{ value: '0101', label: 'Santo Domingo de Guzmán' }],
      sectores: [{ value: 'Villa Juana', label: 'Villa Juana' }],
    })
    expect(opcionesUbicacion(undefined)).toEqual({ municipios: [], sectores: [] })
  })
})

describe('reporte de visitas', () => {
  it('usa los estados del servidor y no cuenta visitas sin adultos', () => {
    const api: ReporteApi = {
      ...base, tipo: 'visitas', campo_fecha: 'fecha_visita',
      indicadores: { visitas_realizadas: 2, atenciones: 3, adultos_visitados: 2, adultos_activos: 5, promedio_por_adulto: 1.5, requirieron_atencion: 1, situaciones_criticas: 0, visitas_compartidas: 1 },
      series: { por_mes: [punto('2026-11', '2026-11', 2, 100)], por_estado_general: [punto('estable', 'Estable', 2, 67), punto('requiere_atencion', 'Requiere atención', 1, 33), punto('situacion_critica', 'Situación crítica', 0), punto('sin_registro', 'Sin registro', 0)] },
      detalle: [{
        visita_id: 'v1', fecha: '2026-11-18', hora_inicio: '09:00', hora_fin: '09:40', razon: 'Seguimiento', origen: 'solicitud',
        responsables: [{ usuario_id: 'u1', nombres: 'Ana', apellidos: 'Gómez' }],
        adultos: [{ envejeciente_id: 'a1', nombres: 'Juana', apellidos: 'Pérez', estado_general: 'requiere_atencion' }, { envejeciente_id: 'a2', nombres: 'Pedro', apellidos: 'Ramos', estado_general: null }],
      }],
      detalle_total: 1,
    }
    const r = construirReporte(api)
    expect(r.kpis.find((k) => k.etiqueta === 'Promedio por adulto visitado')?.valor).toBe('1.50')
    expect(r.kpis.find((k) => k.etiqueta === 'Requirieron atención')).toMatchObject({ valor: 1, peligro: true })
    expect(r.graficos.map((g) => g.id)).toEqual(['visitas-por_mes', 'visitas-por_estado_general'])
    expect(r.tabla.filas[0]!.adultoId).toBeUndefined()
    expect(r.tabla.filas[0]!.celdas).toEqual(['18/11/2026', '09:00 – 09:40', 'Seguimiento', 'Por solicitud', 'Ana Gómez', 'Juana Pérez (Requiere atención); Pedro Ramos'])
  })
})

describe('reporte de necesidades', () => {
  it('muestra la categoría más frecuente y las columnas por estado del servidor', () => {
    const api: ReporteApi = {
      ...base, tipo: 'necesidades', campo_fecha: 'fecha_registro',
      indicadores: { registradas: 4, activas: 3, pendientes: 2, en_proceso: 1, resueltas: 1, canceladas: 0, porcentaje_resueltas: 25, prioridad_alta_activas: 1, recurrentes: 1, adultos_con_necesidades: 3, mas_frecuente: { tipo_necesidad_id: 2, nombre: 'Transporte', total: 3 } },
      series: { por_tipo: [punto('2', 'Transporte', 3, 75)], por_estado: [], por_prioridad: [], recurrencia: [], por_mes: [] },
      detalle: [{ tipo_necesidad_id: 2, nombre: 'Transporte', total: 3, porcentaje: 75, pendientes: 2, en_proceso: 1, resueltas: 0, canceladas: 0, prioridad_alta: 1, recurrentes: 0 }],
      detalle_total: 1,
    }
    const r = construirReporte(api)
    expect(r.kpis.find((k) => k.etiqueta === 'Más frecuente')).toEqual({ etiqueta: 'Más frecuente', valor: 'Transporte', nota: '3 registros' })
    expect(r.kpis.find((k) => k.etiqueta === 'Porcentaje resueltas')?.valor).toBe('25%')
    expect(r.tabla.columnas.map((c) => c.etiqueta)).toContain('En proceso')
    expect(r.tabla.columnas.map((c) => c.etiqueta)).not.toContain('Satisfechas')
    expect(r.tabla.filas[0]!.celdas).toEqual(['Transporte', 3, '75%', 2, 1, 0, 0, 1, 0])
  })
})

describe('reporte de casos prioritarios', () => {
  it('distingue alertas de adultos y traduce tipos y estados', () => {
    const api: ReporteApi = {
      ...base, tipo: 'casos_prioritarios', campo_fecha: 'fecha_alerta',
      indicadores: { alertas_prioritarias: 3, adultos_prioritarios: 2, casos_abiertos: 1, alertas_pendientes: 1, alertas_en_proceso: 1, alertas_resueltas: 1, resueltas_automaticamente: 0, porcentaje_resueltas: 33 },
      series: { por_estado: [punto('pendiente', 'Pendiente', 1, 33)], por_tipo: [punto('riesgo_alto', 'Riesgo alto', 1, 33)], por_mes: [punto('2026-11', '2026-11', 3, 100)] },
      detalle: [{ ...juana, riesgo_vigente: 'alto', alertas: 2, alertas_abiertas: 2, tipos: ['medicamento_pendiente', 'riesgo_alto'], estado_actual: 'en_proceso', ultima_alerta: '2026-11-18T13:00:00+00:00' }],
      detalle_total: 1,
    }
    const r = construirReporte(api)
    expect(r.tipo).toBe('prioritarios')
    expect(r.kpis.find((k) => k.etiqueta === 'Alertas prioritarias')?.nota).toBe('Cuenta alertas')
    expect(r.kpis.find((k) => k.etiqueta === 'Adultos prioritarios')?.nota).toBe('Cuenta adultos distintos')
    expect(r.tabla.filas[0]!.celdas).toEqual(['Juana Pérez Díaz', 'Santo Domingo de Guzmán', 'Villa Juana', 'Alto', 2, 2, 'Medicamentos pendientes, Riesgo alto', 'En atención', '18/11/2026'])
    expect(r.tabla.filas[0]).toMatchObject({ adultoId: juana.envejeciente_id, riesgo: 'alto' })
  })
})

describe('análisis avanzado', () => {
  const fila = (zona: string | null, codigo = '0101', nombre = 'Santo Domingo') => ({
    zona, municipio: { codigo, nombre }, adultos_activos: 8, riesgo_alto: 2, visitas_realizadas: 11, visitas_por_adulto: 1.375, necesidades_activas: 3, alertas_abiertas: 4, dias_sin_visita_promedio: 9.5, sin_personal_asignado: 1,
  })
  const api: AnalisisAvanzadoApi = {
    tipo: 'analisis_avanzado', zona_horaria: 'America/Santo_Domingo', generado_en: base.generado_en, filtros: SIN_FILTROS, vacio: false,
    comparativo_zonas: [fila('Villa Juana'), fila(null)],
    comparativo_municipios: [{ ...fila(null), zona: undefined }],
    tendencias: [
      { mes: '2026-10', visitas_realizadas: 5, variacion_visitas: null, necesidades_registradas: 2, alertas_prioritarias: 1, perfiles_nuevos: 0 },
      { mes: '2026-11', visitas_realizadas: 6, variacion_visitas: 20, necesidades_registradas: 4, alertas_prioritarias: 3, perfiles_nuevos: 1 },
      { mes: '2026-12', visitas_realizadas: 3, variacion_visitas: -50, necesidades_registradas: 0, alertas_prioritarias: 0, perfiles_nuevos: 0 },
    ],
  }

  it('arma los comparativos por sector y por municipio con sus columnas', () => {
    const a = construirAvanzado(api)
    expect(a.zonas.grafico.etiquetas).toEqual(['Villa Juana', 'Sin sector'])
    expect(a.zonas.grafico.series.map((s) => s.nombre)).toEqual(['Adultos activos', 'Visitas realizadas', 'Necesidades activas'])
    expect(a.zonas.tabla.columnas).toHaveLength(10)
    expect(a.zonas.tabla.filas[0]!.celdas).toEqual(['Villa Juana', 'Santo Domingo', 8, 2, 11, '1.38', 3, 4, '9.5', 1])
    expect(a.municipios!.tabla.columnas[0]!.etiqueta).toBe('Municipio')
    expect(a.municipios!.tabla.filas[0]!.celdas.slice(0, 2)).toEqual(['Santo Domingo', 8])
  })

  it('muestra la variación con signo y guion cuando no hay mes anterior', () => {
    const a = construirAvanzado(api)
    expect(a.tendencias.tabla.filas.map((f) => f.celdas[2])).toEqual(['—', '+20%', '-50%'])
    expect(a.tendencias.grafico.etiquetas).toEqual(['Oct 2026', 'Nov 2026', 'Dic 2026'])
    expect(a.tendencias.grafico.series.map((s) => s.nombre)).toContain('Alertas prioritarias')
  })

  it('sin visitas:ver las visitas llegan null: se ocultan columnas y serie en lugar de mostrar ceros', () => {
    const sinVisitas: AnalisisAvanzadoApi = {
      ...api,
      comparativo_zonas: [{ ...fila('Villa Juana'), visitas_realizadas: null, visitas_por_adulto: null }],
      comparativo_municipios: [{ ...fila(null), zona: undefined, visitas_realizadas: null, visitas_por_adulto: null }],
      tendencias: api.tendencias.map((t) => ({ ...t, visitas_realizadas: null, variacion_visitas: null })),
    }
    expect(avanzadoSinVisitas(sinVisitas)).toBe(true)
    expect(avanzadoSinVisitas(api)).toBe(false)
    const a = construirAvanzado(sinVisitas)
    const etiquetas = [...a.zonas.tabla.columnas, ...a.municipios!.tabla.columnas, ...a.tendencias.tabla.columnas].map((c) => c.etiqueta)
    expect(etiquetas.some((e) => /isitas realizadas|isitas por adulto|ariación de visitas/.test(e))).toBe(false)
    expect(etiquetas).toContain('Días sin visita (prom.)')
    expect(a.zonas.grafico.series.map((s) => s.nombre)).toEqual(['Adultos activos', 'Necesidades activas'])
    expect(a.tendencias.grafico.series.map((s) => s.nombre)).not.toContain('Visitas realizadas')
    expect(a.zonas.tabla.filas[0]!.celdas).toEqual(['Villa Juana', 'Santo Domingo', 8, 2, 3, 4, '9.5', 1])
    expect(a.zonas.tabla.filas[0]!.celdas).toHaveLength(a.zonas.tabla.columnas.length)
    expect(a.tendencias.tabla.filas[0]!.celdas).toEqual(['Oct 2026', 2, 1, 0])
    expect(JSON.stringify(a)).not.toContain('null')
  })

  it('si solo algunas filas no traen visitas, muestra un guion en esa celda', () => {
    const mixto: AnalisisAvanzadoApi = { ...api, comparativo_zonas: [fila('Villa Juana'), { ...fila('Norte'), visitas_realizadas: null, visitas_por_adulto: null }] }
    const a = construirAvanzado(mixto)
    expect(a.zonas.tabla.filas[0]!.celdas.slice(4, 6)).toEqual([11, '1.38'])
    expect(a.zonas.tabla.filas[1]!.celdas.slice(4, 6)).toEqual(['—', '—'])
  })

  it('una población sin adultos queda vacía', () => {
    const a = construirAvanzado({ ...api, vacio: true, comparativo_zonas: [], comparativo_municipios: [], tendencias: [] })
    expect(a.zonas.vacio).toBe(true)
    expect(a.tendencias.vacio).toBe(true)
    expect(a.municipios!.vacio).toBe(true)
  })
})

describe('contexto de la exportación', () => {
  const exportacion: ExportacionApi = {
    exportacion_id: '3f9b2a40-8c1d-4e7a-9b55-0d4f6e2a1c90', tipo: 'adultos', formato: 'pdf', filtros: SIN_FILTROS, fecha: '2026-11-20T14:06:12.004+00:00',
    generado_por: { nombres: 'Laura', apellidos: 'Mejía', rol: 'coordinador' }, cuenta: { nombre: 'Fundación Esperanza' },
  }

  it('usa la constancia que devolvió el servidor', () => {
    const reporte = construirReporte({ ...base, tipo: 'adultos', indicadores: {}, series: {}, detalle: [] })
    const ctx = contextoDeExportacion({ exportacion, reporte, filtros: ['Período: Todo el tiempo'], tipoCuenta: 'organizacion', imagenes: {} })
    expect(ctx.cuenta).toBe('Fundación Esperanza · Cuenta Organización')
    expect(ctx.generadoPor).toBe('Laura Mejía (Coordinador)')
    expect(ctx.generado.toISOString()).toBe('2026-11-20T14:06:12.004Z')
    expect(ctx.constancia).toBe('Exportación 3f9b2a40-8c1d-4e7a-9b55-0d4f6e2a1c90')
    expect(ctx.avanzado).toBeNull()
    expect(ctx.avisoAvanzado).toBe('')
    expect(ctx.soloAvanzado).toBeUndefined()
  })

  it('marca el archivo que contiene solo el análisis avanzado', () => {
    const reporte = construirReporte({ ...base, tipo: 'adultos', indicadores: {}, series: {}, detalle: [] })
    const ctx = contextoDeExportacion({ exportacion, reporte, filtros: [], tipoCuenta: 'familia', imagenes: {}, soloAvanzado: true })
    expect(ctx.soloAvanzado).toBe(true)
    expect(ctx.cuenta).toContain('Familia')
  })
})
