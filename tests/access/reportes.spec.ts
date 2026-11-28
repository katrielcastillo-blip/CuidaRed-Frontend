/*
 * Resumen de casos y reportes conectados (fase 7): permisos por rol, plan, filtros, exportaciones y errores · ID07, RF-07/RF-08.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { cuentaActiva, iniciarSesion, simular, type CuentaSim } from './ayudas-fase2'
import { casoDe, hoyRD, juanaId, montarReportes, nombreCsv, ruta, type OpcionesReportes } from './ayudas-reportes'

const BASE = ['adultos:ver', 'adultos:ver-sensible']
type Rol = { nombre: string; tipo: 'familia' | 'organizacion'; rol: string; permisos: string[]; resumen: boolean; reportes: boolean }
const ROLES: Rol[] = [
  { nombre: 'Administrador de una Organización', tipo: 'organizacion', rol: 'administrador', permisos: [...BASE, 'visitas:ver', 'resumen:ver', 'reportes:ver'], resumen: true, reportes: true },
  { nombre: 'Coordinador de una Familia', tipo: 'familia', rol: 'coordinador', permisos: [...BASE, 'visitas:ver', 'resumen:ver', 'reportes:ver', 'informe:exportar'], resumen: true, reportes: true },
  { nombre: 'Coordinador de una Organización', tipo: 'organizacion', rol: 'coordinador', permisos: [...BASE, 'visitas:ver', 'resumen:ver', 'reportes:ver', 'informe:exportar'], resumen: true, reportes: true },
  { nombre: 'Cuidador', tipo: 'organizacion', rol: 'cuidador', permisos: [...BASE, 'visitas:ver', 'informe:exportar'], resumen: false, reportes: false },
  { nombre: 'Familiar', tipo: 'familia', rol: 'familiar', permisos: ['adultos:ver', 'necesidades:ver'], resumen: false, reportes: false },
  { nombre: 'Voluntario', tipo: 'organizacion', rol: 'voluntario', permisos: ['adultos:ver', 'visitas:ver'], resumen: false, reportes: false },
]
const PLAN_METRICAS = ['dashboard_metricas']
const PLAN_AVANZADO = ['dashboard_metricas', 'reportes_avanzados']
const PERMISOS_REPORTES = [...BASE, 'visitas:ver', 'resumen:ver', 'reportes:ver', 'cuenta:suscripcion']

const cuentaDe = (datos: Partial<CuentaSim> = {}) =>
  cuentaActiva({ cuenta_id: '9007199254740993', nombre: 'Fundación Esperanza', tipo: 'organizacion', rol: 'coordinador', permisos: PERMISOS_REPORTES, funcionalidades: PLAN_AVANZADO, ...datos })

const cuentaIntegral = () => cuentaDe({
  tipo: 'familia',
  nombre: 'Familia Esperanza',
  permisos: PERMISOS_REPORTES.filter((p) => p !== 'visitas:ver'),
})

async function abrir(page: Page, cuenta: CuentaSim, seccion: 'resumen' | 'reportes' | 'cuenta', opciones: OpcionesReportes = {}) {
  const sim = await simular(page, { cuentas: [cuenta] })
  const api = await montarReportes(page, cuenta, opciones)
  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/${seccion}`)
  return { ...api, sim }
}

const sinDesbordeHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

/* ───────────── Navegación y permisos por rol ───────────── */
for (const caso of ROLES) {
  test(`permisos: el ${caso.nombre} ${caso.resumen ? 've' : 'no ve'} Resumen y Reportes`, async ({ page }) => {
    const cuenta = cuentaDe({ tipo: caso.tipo, rol: caso.rol, permisos: caso.permisos, funcionalidades: caso.reportes ? PLAN_METRICAS : [] })
    const { de } = await abrir(page, cuenta, 'cuenta')
    // Administrador y Coordinador (Figma «Inicio v3») no tienen accesos rápidos: sus módulos están en «Más» (móvil) o en el
    // menú lateral (pantallas anchas). Los demás roles los conservan en el Inicio.
    const gestion = caso.rol === 'administrador' || caso.rol === 'coordinador'
    const navegacion = page.getByRole('navigation', { name: 'Módulos de la cuenta' })
    let accesos = page.getByRole('region', { name: 'Accesos rápidos' })
    if (gestion) {
      await expect(accesos).toHaveCount(0)
      await expect(navegacion.first()).toBeVisible()
      const mas = navegacion.getByRole('button', { name: 'Más' })
      const enMovil = await mas.isVisible()
      if (enMovil) await mas.click()
      accesos = enMovil ? page.getByRole('dialog', { name: 'Más opciones' }) : navegacion
    }
    await expect(accesos).toBeVisible()
    const resumen = gestion ? { name: 'Resumen', exact: true } : { name: /Resumen de casos/ }
    const reportes = gestion ? { name: 'Reportes', exact: true } : { name: /Reportes y estadísticas/ }
    await expect(accesos.getByRole('link', resumen)).toHaveCount(caso.resumen ? 1 : 0)
    await expect(accesos.getByRole('link', reportes)).toHaveCount(caso.reportes ? 1 : 0)

    // Quien no tiene el permiso no llega ni por la dirección: no se consulta nada.
    for (const seccion of ['resumen', 'reportes'] as const) {
      await page.goto(`${ruta}/${seccion}`)
      if (caso[seccion]) {
        await expect(page.getByRole('heading', { level: 1, name: seccion === 'resumen' ? 'Resumen de casos' : 'Reportes y estadísticas' })).toBeVisible()
      } else {
        await expect(page.getByText('No tienes acceso a este módulo de la cuenta.')).toBeVisible()
      }
    }
    if (!caso.resumen) expect(de(/^\/resumen-casos/)).toHaveLength(0)
    if (!caso.reportes) expect(de(/^\/reportes/)).toHaveLength(0)
  })
}

/* ───────────── Plan ───────────── */
test('plan: la Familia en prueba ve el bloqueo de reportes y no se consulta la API', async ({ page }) => {
  const cuenta = cuentaDe({ tipo: 'familia', nombre: 'Familia Prueba', estado_suscripcion: 'prueba', funcionalidades: ['registro_visitas'] })
  const { de, llamadas } = await abrir(page, cuenta, 'reportes')
  await expect(page.getByRole('heading', { name: 'Los reportes estadísticos no están incluidos en tu plan' })).toBeVisible()
  await expect(page.getByTestId('bloqueo-plan').first()).toContainText('prueba gratuita')
  await expect(page.getByRole('link', { name: 'Ver la suscripción de la cuenta' }).first()).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Exportar|Descargar CSV/ })).toHaveCount(0)
  expect(de(/^\/reportes/)).toHaveLength(0)
  // El resumen no tiene requisito de plan: sigue disponible para el mismo rol.
  await page.goto(`${ruta}/resumen`)
  await expect(page.getByTestId('caso-resumen')).toHaveCount(3)
  expect(llamadas.filter((l) => l.ruta.startsWith('/reportes'))).toHaveLength(0)
})

test('plan: la Organización en prueba consulta reportes, pero el análisis avanzado y el Excel quedan bloqueados', async ({ page }) => {
  const cuenta = cuentaDe({ estado_suscripcion: 'prueba', funcionalidades: PLAN_METRICAS })
  const { de } = await abrir(page, cuenta, 'reportes')
  await expect(page.getByRole('heading', { level: 2, name: 'Adultos mayores registrados' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Descargar CSV' })).toBeEnabled()
  const excel = page.getByRole('button', { name: 'Exportar Excel' })
  await expect(excel).toBeDisabled()
  await expect(page.locator('#aviso-excel')).toContainText('no está incluido en el plan de tu cuenta')
  await expect(page.getByRole('heading', { name: 'Comparativo por sector y tendencias no incluidos en tu plan' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Análisis en (PDF|Excel)/ })).toHaveCount(0)
  expect(de(/^\/reportes\/adultos$/).length).toBeGreaterThan(0)
  expect(de(/^\/reportes\/analisis-avanzado/)).toHaveLength(0)
})

test('plan: con reportes_avanzados se habilitan el Excel y el análisis avanzado (sector, municipio y tendencias)', async ({ page }) => {
  const { de } = await abrir(page, cuentaDe(), 'reportes')
  await expect(page.getByRole('button', { name: 'Exportar Excel' })).toBeEnabled()
  await expect(page.locator('#aviso-excel')).toHaveCount(0)
  const avanzado = page.getByTestId('analisis-avanzado')
  await expect(avanzado.getByRole('heading', { name: 'Comparativo por sector (2)', level: 3 })).toBeVisible()
  await expect(avanzado.getByRole('heading', { name: 'Comparativo por municipio (1)', level: 3 })).toBeVisible()
  await expect(avanzado.getByRole('heading', { name: 'Tendencias mensuales (2)', level: 3 })).toBeVisible()
  await expect(avanzado.getByRole('columnheader', { name: 'Visitas por adulto' }).first()).toBeVisible()
  await expect(avanzado.getByRole('row', { name: /Nov 2026.*\+20%/ })).toBeVisible()
  await expect(avanzado.getByTestId('canvas-grafico')).toHaveCount(2)
  expect(de(/^\/reportes\/analisis-avanzado$/).length).toBeGreaterThan(0)
  expect(de(/^\/reportes\/analisis-avanzado$/).every((l) => !l.consulta.has('filter[tipo_necesidad_id]'))).toBe(true)
})

test('Cuidado Integral ofrece análisis avanzado sin reportes ni métricas de Visitas', async ({ page }) => {
  await abrir(page, cuentaIntegral(), 'reportes', { sinVisitas: true })
  await expect(page.getByRole('radio', { name: 'Visitas realizadas' })).toHaveCount(0)
  await expect(page.locator('#avanzado-bloqueado')).toHaveCount(0)
  const avanzado = page.getByTestId('analisis-avanzado')
  await expect(avanzado.getByTestId('aviso-sin-visitas')).toBeVisible()
  await expect(avanzado.getByRole('columnheader', { name: 'Adultos activos' }).first()).toBeVisible()
  await expect(avanzado.getByRole('columnheader', { name: /Visitas realizadas|Visitas por adulto|Variación de visitas/ })).toHaveCount(0)
  await expect(avanzado.getByRole('cell', { name: '—' })).toHaveCount(0)
})

test('los tipos de reporte que el rol no puede usar no se ofrecen: Familia no tiene visitas', async ({ page }) => {
  await abrir(page, cuentaDe({ tipo: 'familia', nombre: 'Familia Prueba', funcionalidades: PLAN_METRICAS }), 'reportes')
  const tipos = page.getByRole('radiogroup', { name: 'Tipo de reporte' })
  await expect(tipos.getByRole('radio')).toHaveText(['Adultos mayores registrados', 'Necesidades frecuentes y atendidas', 'Casos prioritarios'])
})

test('los cuatro tipos de reporte están disponibles en una Organización y cada uno consulta su ruta', async ({ page }) => {
  const { de } = await abrir(page, cuentaDe({ funcionalidades: PLAN_METRICAS }), 'reportes')
  const tipos = page.getByRole('radiogroup', { name: 'Tipo de reporte' })
  await expect(tipos.getByRole('radio')).toHaveCount(4)
  for (const [nombre, patron] of [['Visitas realizadas', /^\/reportes\/visitas$/], ['Necesidades frecuentes y atendidas', /^\/reportes\/necesidades$/], ['Casos prioritarios', /^\/reportes\/casos-prioritarios$/]] as const) {
    await tipos.getByRole('radio', { name: nombre }).click()
    await expect(tipos.getByRole('radio', { name: nombre })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('heading', { level: 2, name: nombre })).toBeVisible()
    expect(de(patron).length).toBeGreaterThan(0)
  }
  // Los estados son los del servidor: «Resuelta» y «En proceso», no los del simulador.
  await expect(page.getByRole('table').first()).toContainText('Pendiente')
  await expect(page.getByTestId('indicadores-reporte')).toContainText('Alertas prioritarias')
  await expect(page.getByTestId('indicadores-reporte')).toContainText('Adultos prioritarios')
})

/* ───────────── Contenido del reporte ───────────── */
test('el reporte muestra indicadores, gráficos con su tabla de datos y detalle con enlace al expediente', async ({ page }) => {
  await abrir(page, cuentaDe({ funcionalidades: PLAN_METRICAS }), 'reportes')
  const indicadores = page.getByTestId('indicadores-reporte')
  await expect(indicadores.getByRole('heading', { name: 'Adultos registrados' })).toBeVisible()
  await expect(indicadores.locator('article', { hasText: 'Edad promedio' })).toContainText('78.5')
  await expect(indicadores.locator('article', { hasText: 'Sin personal asignado' })).toContainText('Activos sin cuidador ni voluntario')

  await expect(page.getByTestId('grafico-reporte')).toHaveCount(5)
  await expect(page.getByTestId('canvas-grafico')).toHaveCount(5)
  const grafico = page.getByTestId('grafico-reporte').first()
  await expect(grafico.getByTestId('canvas-grafico')).toHaveAttribute('aria-label', /Gráfico de anillo: Adultos activos por nivel de riesgo\. Alto: 1 \(50%\)/)
  await grafico.getByText('Ver tabla de datos').click()
  const tabla = grafico.getByRole('region', { name: 'Tabla de datos: Adultos activos por nivel de riesgo' })
  await expect(tabla.getByRole('row', { name: /Alto 1 50%/ })).toBeVisible()

  const detalle = page.getByRole('region', { name: /Detalle de adultos mayores/ })
  await expect(detalle.getByRole('row')).toHaveCount(3)
  await expect(detalle.getByRole('row', { name: /Juana Pérez Díaz.*Villa Juana.*Femenino.*alto/i })).toBeVisible()
  await expect(detalle.getByRole('row', { name: /Pedro Ramos.*Sin evaluación vigente.*Inactivo/ })).toBeVisible()
  await expect(detalle.getByRole('link', { name: 'Juana Pérez Díaz' })).toHaveAttribute('href', `${ruta}/envejecientes?adulto=${juanaId}`)
  expect(await sinDesbordeHorizontal(page)).toBe(true)
})

test('un reporte vacío es válido: explica que no hay datos y aun así se puede descargar', async ({ page }) => {
  const { de } = await abrir(page, cuentaDe({ funcionalidades: PLAN_METRICAS }), 'reportes', { vacio: true })
  await expect(page.getByText('No existen datos disponibles para este reporte con los filtros seleccionados.')).toBeVisible()
  await expect(page.getByTestId('grafico-reporte')).toHaveCount(0)
  await expect(page.getByTestId('indicadores-reporte')).toHaveCount(0)
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar CSV' }).click()])
  expect(descarga.suggestedFilename()).toBe(nombreCsv('adultos'))
  expect(de(/exportacion$/)).toHaveLength(1)
})

test('si el servidor recorta el detalle, lo avisa y muestra las filas por tramos', async ({ page }) => {
  await abrir(page, cuentaDe({ funcionalidades: PLAN_METRICAS }), 'reportes', { truncado: true })
  const detalle = page.getByRole('region', { name: /Detalle de adultos mayores/ })
  await expect(page.getByRole('note').filter({ hasText: 'Detalle recortado' })).toContainText('120 de 7,300 filas')
  // 1 encabezado + 100 filas; el resto se muestra bajo demanda para no pintar miles de filas de una vez.
  await expect(detalle.getByRole('row')).toHaveCount(101)
  await page.getByRole('button', { name: 'Mostrar 20 filas más' }).click()
  await expect(detalle.getByRole('row')).toHaveCount(121)
  await expect(page.getByRole('button', { name: /filas más/ })).toHaveCount(0)
})

/* ───────────── Filtros ───────────── */
test('los filtros envían los parámetros filter[...] del contrato, sin page ni limit', async ({ page }) => {
  const { de } = await abrir(page, cuentaDe({ funcionalidades: PLAN_AVANZADO }), 'reportes')
  const ultima = (patron: RegExp) => de(patron).at(-1)!.consulta
  await expect(page.getByLabel('Municipio', { exact: true }).locator('option')).toHaveText(['Todos', 'Santiago de los Caballeros', 'Santo Domingo de Guzmán'])
  await expect(page.getByLabel('Sector', { exact: true }).locator('option')).toHaveText(['Todos', 'Centro', 'Villa Juana'])
  expect(ultima(/^\/reportes\/adultos$/).size).toBe(0)

  // Rango predefinido: del día 1 del mes a hoy, en el calendario de Santo Domingo.
  await page.getByLabel('Período').selectOption('mes')
  const hoy = hoyRD()
  await expect.poll(() => de(/^\/reportes\/adultos$/).at(-1)?.consulta.get('filter[hasta]')).toBe(hoy)
  expect(ultima(/^\/reportes\/adultos$/).get('filter[desde]')).toBe(`${hoy.slice(0, 8)}01`)

  await page.getByLabel('Municipio', { exact: true }).selectOption('0101')
  await page.getByLabel('Sector', { exact: true }).selectOption('Villa Juana')
  await page.getByLabel('Riesgo', { exact: true }).selectOption('sin_evaluacion')
  await expect.poll(() => de(/^\/reportes\/adultos$/).at(-1)?.consulta.get('filter[riesgo]')).toBe('sin_evaluacion')
  const consulta = ultima(/^\/reportes\/adultos$/)
  expect(Object.fromEntries(consulta)).toEqual({
    'filter[desde]': `${hoy.slice(0, 8)}01`, 'filter[hasta]': hoy, 'filter[municipio_cod]': '0101', 'filter[zona]': 'Villa Juana', 'filter[riesgo]': 'sin_evaluacion',
  })
  // El análisis avanzado usa los mismos filtros de fecha, ubicación y riesgo.
  await expect.poll(() => de(/^\/reportes\/analisis-avanzado$/).at(-1)?.consulta.get('filter[riesgo]')).toBe('sin_evaluacion')
  expect(Object.keys(Object.fromEntries(ultima(/^\/reportes\/analisis-avanzado$/))).sort()).toEqual(
    ['filter[desde]', 'filter[hasta]', 'filter[municipio_cod]', 'filter[riesgo]', 'filter[zona]'])

  await page.getByRole('button', { name: 'Quitar filtros' }).click()
  await expect.poll(() => de(/^\/reportes\/adultos$/).at(-1)?.consulta.size).toBe(0)
})

test('un rango personalizado inválido suspende el reporte, el análisis y las exportaciones', async ({ page }) => {
  const { de } = await abrir(page, cuentaDe({ funcionalidades: PLAN_AVANZADO }), 'reportes')
  await page.getByLabel('Período').selectOption('personalizado')
  await page.getByLabel('Desde').fill('2026-10-01')
  await page.getByLabel('Hasta').fill('2026-10-31')
  await expect.poll(() => de(/^\/reportes\/adultos$/).at(-1)?.consulta.get('filter[hasta]')).toBe('2026-10-31')
  expect(de(/^\/reportes\/adultos$/).at(-1)!.consulta.get('filter[desde]')).toBe('2026-10-01')
  await expect(page.getByRole('button', { name: 'Análisis en PDF' })).toBeEnabled()
  const consultas = de(/^\/reportes\/(adultos|analisis-avanzado)$/).length

  await page.getByLabel('Desde').fill('2026-11-05')
  await expect(page.getByText('La fecha «hasta» debe ser igual o posterior a «desde».')).toBeVisible()
  await expect(page.getByRole('button', { name: /Descargar CSV|Exportar PDF|Exportar Excel|Análisis en PDF|Análisis en Excel/ })).toHaveCount(0)
  expect(de(/^\/reportes\/(adultos|analisis-avanzado)$/)).toHaveLength(consultas)

  await page.getByLabel('Hasta').fill('2026-11-10')
  await expect(page.getByRole('button', { name: 'Descargar CSV' })).toBeEnabled()
  expect(de(/^\/reportes\/adultos$/).at(-1)!.consulta.get('filter[hasta]')).toBe('2026-11-10')
})

test('la categoría de necesidad solo viaja en el reporte de necesidades', async ({ page }) => {
  const { de } = await abrir(page, cuentaDe({ funcionalidades: PLAN_AVANZADO }), 'reportes')
  await expect(page.getByLabel('Categoría de necesidad', { exact: true })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Necesidades frecuentes y atendidas' }).click()
  await expect(page.getByLabel('Categoría de necesidad', { exact: true }).locator('option')).toHaveText(['Todas', 'Medicamentos', 'Transporte'])
  await page.getByLabel('Categoría de necesidad', { exact: true }).selectOption('2')
  await expect.poll(() => de(/^\/reportes\/necesidades$/).at(-1)?.consulta.get('filter[tipo_necesidad_id]')).toBe('2')
  await expect(page.getByText('Categoría: Transporte').first()).toBeVisible()

  await page.getByRole('radio', { name: 'Casos prioritarios' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Casos prioritarios' })).toBeVisible()
  expect(de(/^\/reportes\/casos-prioritarios$/).every((l) => !l.consulta.has('filter[tipo_necesidad_id]'))).toBe(true)
  // El análisis avanzado tampoco la acepta (sería 422).
  expect(de(/^\/reportes\/analisis-avanzado$/).every((l) => !l.consulta.has('filter[tipo_necesidad_id]'))).toBe(true)
})

/* ───────────── Exportaciones ───────────── */
test('CSV: se descarga del servidor con la sesión y el nombre de Content-Disposition, sin registrar nada en el cliente', async ({ page }) => {
  const { de, sim, orden } = await abrir(page, cuentaDe({ funcionalidades: PLAN_METRICAS }), 'reportes')
  await page.getByLabel('Riesgo', { exact: true }).selectOption('alto')
  await expect.poll(() => de(/^\/reportes\/adultos$/).at(-1)?.consulta.get('filter[riesgo]')).toBe('alto')
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar CSV' }).click()])
  expect(descarga.suggestedFilename()).toBe(nombreCsv('adultos'))
  const bytes = readFileSync((await descarga.path())!)
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  await expect(page.getByRole('status').filter({ hasText: 'Reporte descargado en formato CSV' })).toBeVisible()

  const llamada = de(/\/exportacion$/)
  expect(llamada).toHaveLength(1)
  expect(llamada[0]).toMatchObject({ ruta: '/reportes/adultos/exportacion', autorizacion: `Bearer ${sim.token}` })
  expect(Object.fromEntries(llamada[0]!.consulta)).toEqual({ formato: 'csv', 'filter[riesgo]': 'alto' })
  // El CSV lo audita el servidor: el cliente no llama al registro de PDF y Excel.
  expect(de(/^\/reportes\/exportaciones$/, 'POST')).toHaveLength(0)
  expect(orden).toEqual(['csv', 'descarga'])
})

test('CSV: si el navegador no puede leer Content-Disposition, usa el nombre reporte-<tipo>-<fecha>.csv', async ({ page }) => {
  await abrir(page, cuentaDe({ funcionalidades: PLAN_METRICAS }), 'reportes', { sinExponerCabecera: true })
  await page.getByRole('radio', { name: 'Casos prioritarios' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Casos prioritarios' })).toBeVisible()
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar CSV' }).click()])
  expect(descarga.suggestedFilename()).toBe(`reporte-casos-prioritarios-${hoyRD()}.csv`)
})

test('PDF: primero registra la exportación en el servidor y después genera el archivo', async ({ page }) => {
  test.setTimeout(60_000)
  const { de, orden } = await abrir(page, cuentaDe({ funcionalidades: PLAN_METRICAS }), 'reportes')
  await page.getByRole('radio', { name: 'Casos prioritarios' }).click()
  await page.getByLabel('Período').selectOption('3m')
  await expect.poll(() => de(/^\/reportes\/casos-prioritarios$/).at(-1)?.consulta.has('filter[desde]')).toBe(true)
  const consultada = de(/^\/reportes\/casos-prioritarios$/).at(-1)!.consulta
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 45_000 }), page.getByRole('button', { name: 'Exportar PDF' }).click()])
  expect(descarga.suggestedFilename()).toBe(`reporte-casos-prioritarios-${hoyRD()}.pdf`)
  expect(readFileSync((await descarga.path())!).subarray(0, 4).toString('latin1')).toBe('%PDF')
  await expect(page.getByRole('status').filter({ hasText: 'Reporte descargado en formato PDF' })).toBeVisible()

  const registros = de(/^\/reportes\/exportaciones$/, 'POST')
  expect(registros).toHaveLength(1)
  // El tipo usa guion bajo en el cuerpo, los filtros son los del reporte mostrado y no llevan claves null.
  expect(registros[0]!.cuerpo).toEqual({ tipo: 'casos_prioritarios', formato: 'pdf', filtros: { desde: consultada.get('filter[desde]'), hasta: consultada.get('filter[hasta]') } })
  expect(Object.keys(registros[0]!.cuerpo!).sort()).toEqual(['filtros', 'formato', 'tipo'])
  expect(Object.values(registros[0]!.cuerpo!.filtros as Record<string, unknown>).every((valor) => valor !== null)).toBe(true)
  expect(orden).toEqual(['registro', 'descarga'])
  // El modo conectado no usa el almacén del prototipo, tampoco al cargar los generadores de PDF y gráficos.
  expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain('cuidared:db')
})

for (const [estado, codigo, mensaje] of [
  [403, 'FORBIDDEN', /No se generó el archivo: tu rol o el plan de la cuenta no permiten esta exportación/],
  [403, 'SUBSCRIPTION_INACTIVE', /La cuenta no tiene una prueba o un plan vigente/],
  [503, 'DEPENDENCY_UNAVAILABLE', /No se pudo conectar con CuidaRed\. Intenta de nuevo\./],
] as const) {
  test(`PDF: si el registro responde ${estado} ${codigo}, no se genera el archivo`, async ({ page }) => {
    const { de, orden } = await abrir(page, cuentaDe({ funcionalidades: PLAN_METRICAS }), 'reportes', { errorRegistro: { status: estado, code: codigo } })
    await expect(page.getByRole('heading', { level: 2, name: 'Adultos mayores registrados' })).toBeVisible()
    await page.getByRole('button', { name: 'Exportar PDF' }).click()
    await expect(page.getByRole('alert').filter({ hasText: mensaje })).toBeVisible()
    await page.waitForTimeout(800)
    expect(de(/^\/reportes\/exportaciones$/, 'POST')).toHaveLength(1)
    expect(orden).toEqual(['registro'])
    await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled()
  })
}

test('Excel: Cuidado Integral registra xlsx y genera el libro', async ({ page }) => {
  test.setTimeout(60_000)
  const { de, orden } = await abrir(page, cuentaIntegral(), 'reportes', { sinVisitas: true })
  await expect(page.getByRole('heading', { level: 2, name: 'Adultos mayores registrados' })).toBeVisible()
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 45_000 }), page.getByRole('button', { name: 'Exportar Excel' }).click()])
  expect(descarga.suggestedFilename()).toBe(`reporte-adultos-${hoyRD()}.xlsx`)
  expect(readFileSync((await descarga.path())!).subarray(0, 2).toString('latin1')).toBe('PK')
  expect(de(/^\/reportes\/exportaciones$/, 'POST')[0]!.cuerpo).toEqual({ tipo: 'adultos', formato: 'xlsx', filtros: {} })
  expect(orden).toEqual(['registro', 'descarga'])
  expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain('cuidared:db')
})

test('Excel: si el servidor lo rechaza por plan, no se genera ningún archivo', async ({ page }) => {
  const { orden } = await abrir(page, cuentaDe(), 'reportes', { errorRegistro: { status: 403, code: 'FORBIDDEN' } })
  await expect(page.getByRole('heading', { level: 2, name: 'Adultos mayores registrados' })).toBeVisible()
  await page.getByRole('button', { name: 'Exportar Excel' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'No se generó el archivo' })).toBeVisible()
  await page.waitForTimeout(800)
  expect(orden).toEqual(['registro'])
})

test('análisis avanzado: registra analisis_avanzado antes de generar el PDF', async ({ page }) => {
  test.setTimeout(60_000)
  const { de, orden } = await abrir(page, cuentaDe(), 'reportes')
  await expect(page.getByTestId('analisis-avanzado').getByRole('heading', { name: 'Comparativo por municipio (1)', level: 3 })).toBeVisible()
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 45_000 }), page.getByRole('button', { name: 'Análisis en PDF' }).click()])
  expect(descarga.suggestedFilename()).toBe(`reporte-analisis-avanzado-${hoyRD()}.pdf`)
  expect(de(/^\/reportes\/exportaciones$/, 'POST')[0]!.cuerpo).toEqual({ tipo: 'analisis_avanzado', formato: 'pdf', filtros: {} })
  expect(orden).toEqual(['registro', 'descarga'])
})

test('sin conexión no se puede exportar: se explica el motivo', async ({ page }) => {
  const erroresGraficos: string[] = []
  page.on('pageerror', (error) => {
    if (/GraficoChart|configGrafico/i.test(error.message)) erroresGraficos.push(error.message)
  })
  await page.route('**/GraficoChart.tsx*', (route) => route.abort('internetdisconnected'))
  await page.route('**/configGrafico.ts*', (route) => route.abort('internetdisconnected'))
  await abrir(page, cuentaDe({ funcionalidades: PLAN_AVANZADO }), 'reportes')
  await expect(page.getByRole('heading', { level: 2, name: 'Adultos mayores registrados' })).toBeVisible()
  await expect(page.getByText('El gráfico no está disponible. Puedes consultar la tabla de datos.').first()).toBeVisible()
  await page.context().setOffline(true)
  await expect(page.getByText('Sin conexión: las exportaciones necesitan Internet')).toBeVisible()
  for (const nombre of ['Descargar CSV', 'Exportar PDF', 'Exportar Excel']) await expect(page.getByRole('button', { name: nombre })).toBeDisabled()
  await page.context().setOffline(false)
  await expect(page.getByRole('button', { name: 'Descargar CSV' })).toBeEnabled()
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar PDF' }).click()
  expect((await descarga).suggestedFilename()).toMatch(/^reporte-adultos-.*\.pdf$/)
  expect(erroresGraficos).toEqual([])
})

/* ───────────── Errores ───────────── */
for (const [pantalla, seccion, titulo] of [['reportes', 'reportes', 'Reportes y estadísticas'], ['resumen', 'resumen', 'Resumen de casos']] as const) {
  test(`errores: ${pantalla} explica una cuenta sin prueba ni plan vigente (SUBSCRIPTION_INACTIVE)`, async ({ page }) => {
    const opciones = seccion === 'reportes' ? { errorReporte: { status: 403, code: 'SUBSCRIPTION_INACTIVE' } } : { errorResumen: { status: 403, code: 'SUBSCRIPTION_INACTIVE' } }
    await abrir(page, cuentaDe({ funcionalidades: PLAN_METRICAS }), seccion, opciones)
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'La cuenta no tiene una prueba o un plan vigente.' }).first()).toBeVisible()
    await expect(page.getByTestId('grafico-reporte')).toHaveCount(0)
    await expect(page.getByTestId('caso-resumen')).toHaveCount(0)
  })

  test(`errores: ${pantalla} muestra un fallo 503 sin detalles técnicos y permite reintentar`, async ({ page }) => {
    const opciones = seccion === 'reportes' ? { errorReporte: { status: 503, code: 'DEPENDENCY_UNAVAILABLE' } } : { errorResumen: { status: 503, code: 'DEPENDENCY_UNAVAILABLE' } }
    const { llamadas } = await abrir(page, cuentaDe({ funcionalidades: PLAN_METRICAS }), seccion, opciones)
    const alerta = page.getByRole('alert').filter({ hasText: 'No se pudo conectar con CuidaRed. Intenta de nuevo.' }).first()
    await expect(alerta).toBeVisible()
    await expect(page.getByText('mensaje_privado')).toHaveCount(0)
    const antes = llamadas.length
    await page.getByRole('button', { name: 'Reintentar' }).first().click()
    await expect.poll(() => llamadas.length).toBeGreaterThan(antes)
  })
}

test('errores: un 403 FORBIDDEN al consultar un reporte explica que puede ser permiso o plan', async ({ page }) => {
  await abrir(page, cuentaDe({ funcionalidades: PLAN_METRICAS }), 'reportes', { errorReporte: { status: 403, code: 'FORBIDDEN' } })
  await expect(page.getByRole('alert').filter({ hasText: 'No tienes permiso para consultar esta información, o el plan de la cuenta no la incluye.' }).first()).toBeVisible()
})

/* ───────────── Resumen de casos ───────────── */
test('resumen: muestra indicadores sin filtrar y distingue alertas abiertas de adultos prioritarios', async ({ page }) => {
  const { de } = await abrir(page, cuentaDe(), 'resumen')
  const prioritarios = page.getByTestId('indicador-adultos-prioritarios')
  const alertas = page.getByTestId('indicador-alertas-abiertas')
  await expect(prioritarios).toContainText('Adultos prioritarios')
  await expect(prioritarios).toContainText('6')
  await expect(prioritarios).toContainText('al menos una alerta prioritaria abierta')
  await expect(alertas).toContainText('Alertas abiertas')
  await expect(alertas).toContainText('14')
  await expect(alertas).toContainText('dos alertas de la misma persona suman dos alertas, pero un solo adulto prioritario')
  await expect(alertas).toContainText('10 pendientes · 4 en atención · 9 prioritarias')
  await expect(page.getByText('Cubren todos los casos activos al 20/11/2026; no cambian con los filtros de la lista.')).toBeVisible()
  await expect(page.getByText('Más de 15 días sin visita', { exact: true })).toBeVisible()
  expect(de(/^\/resumen-casos\/indicadores$/)[0]!.consulta.size).toBe(0)

  const lista = page.getByRole('list', { name: 'Casos activos' })
  const juana = lista.getByTestId('caso-resumen').filter({ hasText: 'Juana Pérez Díaz' })
  await expect(juana).toContainText('Prioridad alta')
  await expect(juana).toContainText('Alerta en atención')
  await expect(juana).toContainText('Alerta prioritaria abierta · Riesgo alto · Seguimiento vencido')
  await expect(juana).toContainText('2 alertas abiertas: 1 pendientes, 1 en atención, 2 prioritarias.')
  await expect(juana).toContainText('Última visita realizada: 01/11/2026 (hace 19 días). Supera el límite de 15 días.')
  await expect(juana).toContainText('Ana Gómez (Cuidador)')
  await expect(juana.getByRole('link', { name: 'Juana Pérez Díaz' })).toHaveAttribute('href', `${ruta}/envejecientes?adulto=${juanaId}`)
  const pedro = lista.getByTestId('caso-resumen').filter({ hasText: 'Pedro Ramos' })
  await expect(pedro).toContainText('Sin evaluación vigente')
  await expect(pedro).toContainText('Sin personal asignado')
  await expect(pedro).toContainText('Sin visitas realizadas · en seguimiento desde 02/08/2026 (hace 110 días)')
  expect(await sinDesbordeHorizontal(page)).toBe(true)

  const consulta = de(/^\/resumen-casos$/).find((l) => l.consulta.get('limit') === '20')!.consulta
  expect(Object.fromEntries(consulta)).toEqual({ page: '1', limit: '20', sort: 'prioridad' })
})

test('resumen: los filtros, el orden y la búsqueda se envían al servidor y el cambio vuelve a la página 1', async ({ page }) => {
  const casos = Array.from({ length: 45 }, (_, i) => casoDe(i + 1))
  const { de } = await abrir(page, cuentaDe(), 'resumen', { casos })
  const lista = () => de(/^\/resumen-casos$/).filter((l) => l.consulta.get('limit') === '20')
  const ultima = () => Object.fromEntries(lista().at(-1)!.consulta)
  await expect(page.getByTestId('caso-resumen')).toHaveCount(20)
  await expect(page.getByTestId('total-casos')).toContainText('45 casos activos')

  // Paginación CR-162.
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Página 2 de 3')).toBeVisible()
  expect(ultima()).toMatchObject({ page: '2', limit: '20' })

  // Las opciones de municipio, sector y persona salen de los casos de la cuenta, no solo de la página.
  await expect(page.getByLabel('Municipio', { exact: true }).locator('option')).toHaveText(['Todos', 'Santiago de los Caballeros', 'Santo Domingo de Guzmán'])
  await expect(page.getByLabel('Sector', { exact: true }).locator('option')).toHaveText(['Todos', 'Centro', 'Villa Juana'])
  await expect(page.getByLabel('Asignado a').locator('option')).toHaveText(['Todos', 'Sin personal asignado', 'Con personal asignado', 'Ana Gómez · Cuidador'])

  await page.getByLabel('Estado de atención').selectOption('seguimiento_vencido')
  await expect.poll(ultima).toMatchObject({ 'filter[estado_atencion]': 'seguimiento_vencido', page: '1' })
  await expect(page.getByTestId('caso-resumen')).toHaveCount(1)
  await expect(page.getByTestId('total-casos')).toContainText('1 caso coincide con los filtros')
  await page.getByLabel('Estado de atención').selectOption('')

  await page.getByLabel('Prioridad', { exact: true }).selectOption('alta')
  await page.getByLabel('Riesgo', { exact: true }).selectOption('sin_evaluacion')
  await page.getByLabel('Municipio', { exact: true }).selectOption('2501')
  await page.getByLabel('Sector', { exact: true }).selectOption('Centro')
  await page.getByLabel('Asignado a').selectOption('sin')
  await expect.poll(ultima).toEqual({
    page: '1', limit: '20', sort: 'prioridad', 'filter[prioridad]': 'alta', 'filter[riesgo]': 'sin_evaluacion', 'filter[municipio_cod]': '2501', 'filter[zona]': 'Centro', 'filter[asignado]': 'sin',
  })
  await page.getByRole('button', { name: 'Quitar filtros' }).first().click()
  await expect.poll(ultima).toEqual({ page: '1', limit: '20', sort: 'prioridad' })

  // Orden: criterio e inversión (`-`).
  await page.getByLabel('Ordenar por', { exact: true }).selectOption('ultima_visita')
  await expect.poll(() => ultima().sort).toBe('ultima_visita')
  await page.getByRole('button', { name: /^Orden:/ }).click()
  await expect.poll(() => ultima().sort).toBe('-ultima_visita')
  await expect(page.getByRole('button', { name: /^Orden: más reciente primero/ })).toBeVisible()

  // La persona asignada viaja como usuario_id.
  await page.getByLabel('Asignado a').selectOption({ label: 'Ana Gómez · Cuidador' })
  await expect.poll(() => ultima()['filter[asignado]']).toBe('5d7c8a8e-1a4b-4f0e-9a3e-7e0d1b2c3f40')
})

test('resumen: la búsqueda espera a tener 2 caracteres y se envía como filter[q]', async ({ page }) => {
  const { de } = await abrir(page, cuentaDe(), 'resumen')
  const lista = () => de(/^\/resumen-casos$/).filter((l) => l.consulta.get('limit') === '20')
  await expect(page.getByTestId('caso-resumen')).toHaveCount(3)
  const buscador = page.getByRole('searchbox', { name: 'Buscar por nombre, sector o municipio' })
  await buscador.fill('J')
  await expect(page.getByText('Escribe al menos 2 caracteres para buscar.')).toBeVisible()
  await page.waitForTimeout(700)
  expect(lista().every((l) => !l.consulta.has('filter[q]'))).toBe(true)
  await buscador.fill('Pedro')
  await expect.poll(() => lista().at(-1)?.consulta.get('filter[q]')).toBe('Pedro')
  await expect(page.getByTestId('caso-resumen')).toHaveCount(1)
})

test('los filtros incluyen las opciones de un caso fuera de los primeros 100', async ({ page }) => {
  const casos = Array.from({ length: 101 }, (_, i) => casoDe(i + 1, { zona: i === 100 ? 'Sector 101' : 'Centro' }))
  const { de } = await abrir(page, cuentaDe(), 'resumen', { casos })
  await expect(page.getByTestId('total-casos')).toContainText('101 casos activos')
  await page.getByLabel('Sector', { exact: true }).selectOption('Sector 101')
  await expect(page.getByTestId('total-casos')).toContainText('1 caso coincide')
  // El Inicio del coordinador consulta aparte los 3 adultos con más días sin visita (sort=ultima_visita, limit=3): no es el listado.
  expect(de(/^\/resumen-casos$/).filter((l) => l.consulta.get('sort') !== 'ultima_visita').every((l) => l.consulta.get('limit') === '20')).toBe(true)
  await page.goto(`${ruta}/reportes`)
  await page.getByLabel('Sector', { exact: true }).selectOption('Sector 101')
  await expect.poll(() => de(/^\/reportes\/adultos$/).at(-1)?.consulta.get('filter[zona]')).toBe('Sector 101')
})

test('una Familia consulta el resumen sin métricas ni filtros de visitas', async ({ page }) => {
  await abrir(page, cuentaDe({ tipo: 'familia' }), 'resumen', {
    casos: [casoDe(3, { seguimiento: null, estado_atencion: 'al_dia' })],
  })
  await expect(page.getByTestId('caso-resumen')).toHaveCount(1)
  await expect(page.getByText(/días sin visita|Sin visitas realizadas/i)).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Seguimiento vencido' })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Última visita' })).toHaveCount(0)
})

test('el reporte distingue las visitas institucionales de las atenciones a adultos', async ({ page }) => {
  await abrir(page, cuentaDe(), 'reportes')
  await page.getByRole('radio', { name: 'Visitas realizadas' }).click()
  const indicadores = page.getByTestId('indicadores-reporte')
  await expect(indicadores.getByRole('article').filter({ hasText: 'Visitas realizadas' })).toContainText('2')
  await expect(indicadores.getByRole('article').filter({ hasText: 'Visitas institucionales' })).toContainText('1')
  await expect(indicadores.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Atenciones', exact: true }) })).toContainText('1')
  await expect(page.getByRole('row').filter({ hasText: 'Actividad comunitaria' })).toContainText('Institucional sin expediente')
})

test('resumen: sin casos activos muestra un estado vacío válido y, con filtros, permite quitarlos', async ({ page }) => {
  await abrir(page, cuentaDe(), 'resumen', { casos: [] })
  await expect(page.getByText('No hay casos activos')).toBeVisible()
  await expect(page.getByTestId('caso-resumen')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Páginas del listado' })).toHaveCount(0)
  await page.getByLabel('Prioridad', { exact: true }).selectOption('alta')
  await expect(page.getByText('Ningún caso coincide con los filtros')).toBeVisible()
  await page.getByRole('button', { name: 'Quitar filtros' }).last().click()
  await expect(page.getByText('No hay casos activos')).toBeVisible()
})

test('resumen: el nombre del caso abre su expediente y volver limpia el enlace', async ({ page }) => {
  await abrir(page, cuentaDe(), 'resumen')
  await page.getByRole('link', { name: 'Juana Pérez Díaz' }).click()
  await expect(page).toHaveURL(`${ruta}/envejecientes?adulto=${juanaId}`)
  await expect(page.getByRole('heading', { level: 2, name: 'Juana Pérez Díaz' })).toBeVisible()
  await page.getByRole('link', { name: 'Volver', exact: true }).click()
  await expect(page).toHaveURL(`${ruta}/envejecientes`)
  await expect(page.getByRole('heading', { level: 2, name: 'Adultos mayores' })).toBeVisible()
})

test('resumen: un identificador de adulto que no es UUID en el enlace se ignora', async ({ page }) => {
  const sim = await simular(page, { cuentas: [cuentaDe()] })
  await montarReportes(page, cuentaDe())
  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/envejecientes?adulto=no-es-un-uuid`)
  await expect(page.getByRole('heading', { level: 2, name: 'Adultos mayores' })).toBeVisible()
})
