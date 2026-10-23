/*
 * e2e-cu11-resumen.spec.ts — Suite E2E-CU11-RESUMEN: escenarios Gherkin de CU-11 (SRS §16.6).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page } from '@playwright/test'
import { CUENTAS, iniciarSesion, leerDB, limpiarDatos, sesionDirecta, visibles } from './fixtures'

const PESO_PRIORIDAD: Record<string, number> = { 'Prioridad Alta': 0, 'Prioridad Media': 1, 'Prioridad Baja': 2 }
const ORDEN_ESTADOS = ['Alerta pendiente', 'En atención', 'Visita vencida', 'Necesidades pendientes', 'Al día']

/** Casos que se ven en pantalla (tarjetas en móvil, tabla en escritorio). */
const casos = (page: Page) => visibles(page.getByTestId('caso-resumen'))

async function columna(page: Page, testId: 'prioridad-caso' | 'estado-atencion') {
  return (await casos(page).getByTestId(testId).allTextContents()).map((t) => t.trim())
}

const noDecreciente = (xs: number[]) => xs.every((x, i) => i === 0 || xs[i - 1]! <= x)

test.describe('E2E-CU11-RESUMEN · Consultar módulo de resumen', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Visualizar casos activos', async ({ page }) => {
    // Dado que existen casos activos registrados en CuidaRed
    const activos = (await leerDB(page)).adultos.filter((a) => a.estado === 'activo')
    expect(activos.length).toBeGreaterThan(0)
    // Y el usuario está autenticado como Administrador
    await iniciarSesion(page, 'admin')
    // Cuando accede al módulo de resumen
    await page.goto('/admin/resumen')
    await expect(page.getByRole('heading', { name: 'Resumen de seguimiento' })).toBeVisible()

    // Entonces el sistema debe mostrar los casos activos
    await expect(casos(page)).toHaveCount(activos.length)
    await expect(page.getByText(`${activos.length} casos activos`)).toBeVisible()
    for (const a of activos) await expect(casos(page).filter({ hasText: `${a.nombre} ${a.apellido}` })).toHaveCount(1)
    // Y debe mostrar su estado y prioridad
    expect(await columna(page, 'prioridad-caso')).toHaveLength(activos.length)
    expect(await columna(page, 'estado-atencion')).toHaveLength(activos.length)
    for (const p of await columna(page, 'prioridad-caso')) expect(Object.keys(PESO_PRIORIDAD)).toContain(p)
    for (const e of await columna(page, 'estado-atencion')) expect(ORDEN_ESTADOS).toContain(e)
  })

  test('Escenario: Ordenar casos por prioridad', async ({ page }) => {
    // Dado que existen varios casos activos con diferentes niveles de prioridad
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/resumen')
    await expect(casos(page).first()).toBeVisible()
    // Cuando el usuario selecciona ordenar por prioridad (primero cambia a otro criterio y vuelve)
    const orden = page.getByRole('combobox', { name: /Ordenar por/ })
    await orden.selectOption({ label: 'Nivel de riesgo' })
    await orden.selectOption({ label: 'Prioridad' })
    await expect(page.getByText(/ordenados por prioridad/)).toBeVisible()

    // Entonces el sistema debe mostrar los casos ordenados según el criterio seleccionado
    const pesos = (await columna(page, 'prioridad-caso')).map((p) => PESO_PRIORIDAD[p]!)
    expect(new Set(pesos).size).toBeGreaterThan(1)
    expect(noDecreciente(pesos)).toBe(true)
  })

  test('Escenario: Ordenar casos por estado', async ({ page }) => {
    // Dado que existen casos con diferentes estados de atención
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/resumen')
    await expect(casos(page).first()).toBeVisible()
    // Cuando el usuario selecciona ordenar por estado
    await page.getByRole('combobox', { name: /Ordenar por/ }).selectOption({ label: 'Estado de atención' })
    await expect(page.getByText(/ordenados por estado de atención/)).toBeVisible()

    // Entonces el sistema debe mostrar los casos ordenados según su estado
    const pesos = (await columna(page, 'estado-atencion')).map((e) => ORDEN_ESTADOS.indexOf(e))
    expect(pesos.every((p) => p >= 0)).toBe(true)
    expect(new Set(pesos).size).toBeGreaterThan(1)
    expect(noDecreciente(pesos)).toBe(true)

    // Y también puede agruparlos por estado de atención
    await page.getByRole('switch', { name: /Agrupar por estado de atención/ }).click()
    const grupos = (await page.locator('h2[id^="grupo-"]').getByTestId('estado-atencion').allTextContents()).map((t) => ORDEN_ESTADOS.indexOf(t.trim()))
    expect(grupos.length).toBeGreaterThan(1)
    expect(noDecreciente(grupos)).toBe(true)
  })

  test('Escenario: Actualización del resumen', async ({ page }) => {
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/resumen')
    const elena = casos(page).filter({ hasText: 'Elena Rodríguez' })
    await expect(elena.getByTestId('estado-atencion')).toHaveText('Alerta pendiente')

    // Dado que un caso cambia de estado (el coordinador empieza a atender su alerta de emergencia)
    await page.goto('/coordinador/alertas/al-1')
    await page.getByRole('radio', { name: 'En atención' }).click()
    await page.getByRole('textbox', { name: /Acción tomada/ }).fill('Se llamó a la familia y se coordinó la visita médica.')
    await page.getByRole('button', { name: 'Guardar como "En atención"' }).click()
    await expect(page.getByText('Alerta marcada como "En atención"')).toBeVisible()

    // Cuando el usuario consulta nuevamente el módulo de resumen
    await page.goto('/coordinador/resumen')
    // Entonces el sistema debe mostrar el nuevo estado del caso
    await expect(elena.getByTestId('estado-atencion')).toHaveText('En atención')
  })
})
