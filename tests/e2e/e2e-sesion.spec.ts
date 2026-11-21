/*
 * e2e-sesion.spec.ts — Sesión (RS-003 · CU-01): expira por inactividad, conserva los registros sin sincronizar del
 * dispositivo y el selector de cuenta cambia rol y datos sin cerrar la sesión (Reglas de Negocio V2).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page } from '@playwright/test'
import { CLAVE_SESION, CUENTAS, limpiarDatos, sesionDirecta } from './fixtures'

/** Marca la guía inicial como vista para que no tape la pantalla. */
async function sinOnboarding(page: Page) {
  await page.evaluate(() => {
    for (const [id, rol] of [
      ['u-cuid', 'cuidador'],
      ['u-fam', 'familiar'],
      ['u-coord', 'coordinador'],
    ])
      localStorage.setItem(`cuidared:onboarding:${id}:${rol}`, '1')
  })
}

test.beforeEach(async ({ page }) => {
  await limpiarDatos(page)
  await sinOnboarding(page)
})

test('RS-003: la sesión vence tras 30 minutos sin interacción y pide iniciar sesión de nuevo', async ({ page }) => {
  await sesionDirecta(page, CUENTAS.coordinador.id)
  await expect(page.getByTestId('usuario-actual')).toBeVisible()
  await page.evaluate((clave) => {
    const s = JSON.parse(localStorage.getItem(clave)!)
    s.ultimaActividad = new Date(Date.now() - 31 * 60_000).toISOString()
    localStorage.setItem(clave, JSON.stringify(s))
  }, CLAVE_SESION)
  await page.reload()
  await page.waitForURL(/\/inicio/)
  await expect(page.getByText(/expiró por inactividad/i)).toBeVisible()
  expect(await page.evaluate((clave) => localStorage.getItem(clave), CLAVE_SESION)).toBeNull()
})

test('V2: el cuidador cambia de cuenta desde el encabezado sin cerrar la sesión', async ({ page }) => {
  await sesionDirecta(page, CUENTAS.cuidador.id)
  await expect(page.getByTestId('usuario-actual')).toContainText('Fundación Esperanza')
  await page.getByTestId('usuario-actual').click()
  await page.getByRole('button', { name: /Familia Méndez/ }).click()
  await expect(page.getByTestId('usuario-actual')).toContainText('Familia Méndez')
  await page.goto('/cuidador/adultos')
  await expect(page.getByText('Ramón').first()).toBeVisible()
  await expect(page.getByText('Elena', { exact: false })).toHaveCount(0)
  const sesion = await page.evaluate((clave) => JSON.parse(localStorage.getItem(clave)!), CLAVE_SESION)
  expect(sesion.usuarioId).toBe('u-cuid')
  expect(sesion.membresiaId).toBe('m-11')
})
