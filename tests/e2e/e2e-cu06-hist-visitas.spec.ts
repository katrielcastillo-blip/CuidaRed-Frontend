/*
 * e2e-cu06-hist-visitas.spec.ts — Suite E2E-CU06-HIST-VISITAS: escenarios de CU-06 Consultar historial de visitas
 * (RF-02 · Anexo B: el SRS no detalla Gherkin; se derivan de la postcondición de CU-05 "la visita queda reflejada
 * en el historial del perfil correspondiente").
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { CUENTAS, haceDiasISO, leerDB, limpiarDatos, sesionDirecta } from './fixtures'

test.describe('E2E-CU06-HIST-VISITAS · Consultar historial de visitas', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Consultar el historial de visitas de un adulto mayor', async ({ page }) => {
    const visitas = (await leerDB(page)).visitas.filter((v) => v.adultoId === 'a-elena')
    expect(visitas.length).toBeGreaterThan(5)
    const masReciente = [...visitas].sort((a, b) => `${b.fecha} ${b.horaPautada}`.localeCompare(`${a.fecha} ${a.horaPautada}`))[0]!
    // Dado que el usuario está autenticado como Coordinador y abre el perfil de Elena Rodríguez
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/adultos/a-elena')
    const historial = page.getByRole('region', { name: 'Historial del adulto mayor' })
    // Cuando consulta la pestaña de visitas del historial
    const pestana = historial.getByRole('tab', { name: `Visitas (${visitas.length})` })
    await pestana.click()
    await expect(pestana).toHaveAttribute('aria-selected', 'true')
    // Entonces el sistema muestra todas sus visitas, de la más reciente a la más antigua
    await historial.getByRole('button', { name: `Ver todo (${visitas.length})` }).click()
    const items = historial.getByRole('tabpanel').getByRole('link')
    await expect(items).toHaveCount(visitas.length)
    const [d, m, y] = [masReciente.fecha.slice(8, 10), masReciente.fecha.slice(5, 7), masReciente.fecha.slice(0, 4)]
    await expect(items.first()).toContainText(`${d}/${m}/${y}`)
    // Y puede abrir el detalle de una visita
    await items.first().click()
    await expect(page).toHaveURL(new RegExp(`/coordinador/visitas/${masReciente.id}$`))
    await expect(page.getByRole('heading', { name: masReciente.tipo })).toBeVisible()
  })

  test('Escenario: El voluntario consulta el historial de sus visitas realizadas', async ({ page }) => {
    const db = await leerDB(page)
    const hoy = haceDiasISO(0)
    const historial = db.visitas.filter((v) => v.cuidadorId === CUENTAS.voluntario.id && v.fecha < hoy)
    expect(historial.length).toBeGreaterThan(0)
    // Dado que el usuario está autenticado como Voluntario
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas')
    // Cuando selecciona la pestaña "Historial" de sus visitas
    await page.getByRole('tab', { name: 'Historial' }).click()
    // Entonces ve las visitas que realizó, con su estado
    const tarjetas = page.getByRole('link').filter({ hasText: 'Ver más' })
    await expect(tarjetas).toHaveCount(historial.length)
    await expect(tarjetas.first()).toContainText('COMPLETADA')
    // Y puede abrir el detalle con las observaciones registradas (la más reciente a Elena es v-1, de ayer)
    const v1 = db.visitas.find((v) => v.id === 'v-1')!
    await tarjetas.filter({ hasText: 'Elena Rodríguez' }).first().click()
    await expect(page).toHaveURL(/\/voluntario\/visitas\/v-1$/)
    await expect(page.getByRole('heading', { name: 'Detalle de visita' })).toBeVisible()
    await expect(page.getByText(v1.observaciones!)).toBeVisible()
  })

  test('Escenario: El familiar responsable consulta las visitas del adulto a su cargo', async ({ page }) => {
    const visitas = (await leerDB(page)).visitas.filter((v) => v.adultoId === 'a-elena' && v.estado !== 'cancelada')
    // Dado que el usuario está autenticado como Familiar responsable de Elena Rodríguez
    await sesionDirecta(page, CUENTAS.familiar.id, '/familiar/adultos/a-elena')
    // Cuando consulta la pestaña de visitas
    await page.getByRole('tab', { name: 'Visitas' }).click()
    // Entonces ve el historial de visitas registradas
    const panel = page.getByRole('tabpanel', { name: 'Historial de visitas' })
    await expect(panel.getByRole('link')).toHaveCount(visitas.length)
    // Y puede abrir el detalle de una visita (solo lectura)
    await panel.getByRole('link').first().click()
    await expect(page).toHaveURL(/\/familiar\/visitas\//)
    await expect(page.getByRole('button', { name: /Guardar|Registrar/ })).toHaveCount(0)
  })
})
