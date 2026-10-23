/*
 * e2e-cu12-reportes.spec.ts — Suite E2E-CU12-REPORTES: escenarios Gherkin de CU-12 (SRS §16.7).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page } from '@playwright/test'
import { CUENTAS, editarDB, haceDiasInstante, haceDiasISO, iniciarSesion, leerDB, limpiarDatos, sesionDirecta, visitaCompletada } from './fixtures'

const SIN_DATOS = 'No existen datos disponibles para este reporte con los filtros seleccionados.'

/** Elige el tipo de reporte y espera a que se genere. */
async function elegirReporte(page: Page, tipo: string) {
  await page.getByRole('radio', { name: tipo }).click()
  await expect(page.getByRole('radio', { name: tipo })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('#titulo-reporte')).toHaveText(tipo)
}

/** Valor del indicador (KPI) con la etiqueta dada. */
const kpi = (page: Page, etiqueta: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: etiqueta, exact: true }) }).locator('p').first()

/** Tabla de detalle del reporte. */
const tabla = (page: Page) => page.locator('section[aria-labelledby="tabla-reporte"]').getByRole('table')

test.describe('E2E-CU12-REPORTES · Generar reporte estadístico', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Generar reporte de adultos mayores registrados', async ({ page }) => {
    // Dado que el usuario está autenticado como Coordinador
    await iniciarSesion(page, 'coordinador')
    await page.goto('/coordinador/reportes')
    // Cuando selecciona el reporte de adultos mayores registrados
    await elegirReporte(page, 'Adultos mayores registrados')
    // Entonces el sistema debe generar el reporte
    const total = (await leerDB(page)).adultos.length
    await expect(kpi(page, 'Adultos registrados')).toHaveText(String(total))
    await expect(tabla(page).locator('tbody tr')).toHaveCount(total)
    await expect(page.getByText(/Datos actualizados:/)).toBeVisible()

    // Y debe mostrar información actualizada de los registros existentes (se registra un perfil más)
    await editarDB(page, (db, creadoEn) => {
      const base = db.adultos.find((a) => a.id === 'a-alicia')!
      db.adultos.push({ ...base, id: 'a-e2e-rep', nombre: 'Teresa', apellido: 'Valdez', cedula: '001-7070707-0', creadoEn, actualizadoEn: creadoEn })
    }, new Date().toISOString())
    await elegirReporte(page, 'Adultos mayores registrados')
    await expect(kpi(page, 'Adultos registrados')).toHaveText(String(total + 1))
    await expect(tabla(page).getByRole('row', { name: /Teresa Valdez/ })).toBeVisible()
  })

  test('Escenario: Generar reporte de visitas realizadas', async ({ page }) => {
    // Dado que existen visitas registradas
    const completadas = (await leerDB(page)).visitas.filter((v) => v.estado === 'completada').length
    expect(completadas).toBeGreaterThan(0)
    await sesionDirecta(page, CUENTAS.admin.id, '/admin/reportes')
    // Cuando el usuario selecciona el reporte de visitas
    await elegirReporte(page, 'Visitas realizadas')
    // Entonces el sistema debe generar el reporte
    await expect(kpi(page, 'Visitas realizadas')).toHaveText(String(completadas))
    await expect(page.getByRole('heading', { name: 'Visitas por mes' })).toBeVisible()
    await expect(tabla(page).locator('tbody tr')).toHaveCount(completadas)

    // Y debe mostrar información actualizada de las visitas (se registra una visita nueva)
    await editarDB(
      page,
      (db, v) => {
        db.visitas.push(v)
      },
      visitaCompletada({ id: 'v-e2e-rep', adultoId: 'a-alicia', cuidadorId: 'u-coord', fecha: haceDiasISO(0), instante: haceDiasInstante(0), horaPautada: '09:00', observaciones: 'Visita para el reporte.' }),
    )
    await elegirReporte(page, 'Visitas realizadas')
    await expect(kpi(page, 'Visitas realizadas')).toHaveText(String(completadas + 1))
  })

  test('Escenario: Generar reporte de necesidades frecuentes', async ({ page }) => {
    // Dado que existen necesidades registradas
    const necesidades = (await leerDB(page)).necesidades
    expect(necesidades.length).toBeGreaterThan(0)
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/reportes')
    // Cuando el usuario selecciona el reporte de necesidades frecuentes
    await elegirReporte(page, 'Necesidades frecuentes')
    // Entonces el sistema debe generar el reporte
    await expect(kpi(page, 'Necesidades registradas')).toHaveText(String(necesidades.length))
    await expect(page.getByRole('heading', { name: 'Necesidades por categoría' })).toBeVisible()
    // Y debe presentar la información correspondiente a las categorías registradas
    const etiqueta: Record<string, string> = { medicamentos: 'Medicamentos', alimentacion: 'Alimentación', transporte: 'Transporte', compania: 'Compañía', otros: 'Otros apoyos' }
    const porTipo = new Map<string, number>()
    for (const n of necesidades) porTipo.set(n.tipo, (porTipo.get(n.tipo) ?? 0) + 1)
    for (const [tipo, total] of porTipo) {
      const fila = tabla(page).getByRole('row').filter({ has: page.getByRole('cell', { name: etiqueta[tipo], exact: true }) })
      await expect(fila.getByRole('cell').nth(1)).toHaveText(String(total))
    }
    // (filtro opcional por categoría)
    await page.getByRole('combobox', { name: 'Categoría' }).selectOption({ label: 'Medicamentos' })
    await expect(kpi(page, 'Necesidades registradas')).toHaveText(String(porTipo.get('medicamentos') ?? 0))
  })

  test('Escenario: Generar reporte de casos prioritarios', async ({ page }) => {
    // Dado que existen casos clasificados como prioritarios (alertas de urgencia Alta: caso prioritario o emergencia)
    const db = await leerDB(page)
    const casos = new Set(db.alertas.filter((a) => a.tipo === 'prioritaria' || a.tipo === 'emergencia').map((a) => a.adultoId))
    expect(casos.size).toBeGreaterThan(0)
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/reportes')
    // Cuando el usuario selecciona el reporte de casos prioritarios
    await elegirReporte(page, 'Casos prioritarios')
    // Entonces el sistema debe generar el reporte
    await expect(kpi(page, 'Casos prioritarios')).toHaveText(String(casos.size))
    // Y debe mostrar información actualizada de dichos casos
    await expect(tabla(page).locator('tbody tr')).toHaveCount(casos.size)
    for (const id of casos) {
      const a = db.adultos.find((x) => x.id === id)!
      await expect(tabla(page).getByRole('row', { name: new RegExp(`${a.nombre} ${a.apellido}`) })).toBeVisible()
    }
  })

  test('Escenario: Consultar un reporte sin datos', async ({ page }) => {
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/reportes')
    await elegirReporte(page, 'Visitas realizadas')
    // Dado que no existen registros para el tipo de reporte seleccionado (período sin actividad)
    await page.getByRole('combobox', { name: 'Período' }).selectOption({ label: 'Personalizado (desde / hasta)' })
    await page.getByLabel('Desde').fill('2001-01-01')
    await page.getByLabel('Hasta').fill('2001-01-31')
    // Cuando el usuario solicita el reporte
    // Entonces el sistema debe mostrar que no existen datos disponibles
    await expect(page.getByRole('status').filter({ hasText: SIN_DATOS })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled()
    await expect(page.getByRole('table')).toHaveCount(0)
  })
})
