/*
 * e2e-cu01-auth.spec.ts — Suite E2E-CU01-AUTH: escenarios de CU-01 Iniciar sesión en el sistema (RF-09 · Anexo B).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import type { Rol } from '../../src/domain/types'
import { CUENTAS, iniciarSesion, leerDB, limpiarDatos, PASSWORD_DEMO } from './fixtures'

const ERROR_GENERICO = 'Correo o contraseña incorrectos.'

test.describe('E2E-CU01-AUTH · Iniciar sesión en el sistema', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  for (const rol of ['admin', 'coordinador', 'voluntario', 'familiar'] as Rol[]) {
    test(`Escenario: Iniciar sesión con credenciales válidas (${CUENTAS[rol].etiqueta})`, async ({ page }) => {
      // Dado que el usuario tiene una cuenta activa con rol ${rol}
      // Cuando ingresa su correo y contraseña válidos
      await iniciarSesion(page, rol)
      // Entonces accede al inicio de su rol y ve su nombre y rol en la barra superior
      await expect(page).toHaveURL(new RegExp(`${CUENTAS[rol].home}$`))
      await expect(page.getByTestId('usuario-actual')).toContainText(CUENTAS[rol].nombre)
      await expect(page.getByTestId('usuario-actual')).toContainText(CUENTAS[rol].etiqueta)
      // Y la sesión queda registrada en el dispositivo y en la auditoría
      const sesion = await page.evaluate(() => JSON.parse(localStorage.getItem('cuidared:sesion') ?? 'null'))
      expect(sesion).toMatchObject({ usuarioId: CUENTAS[rol].id })
      const db = await leerDB(page)
      expect(db.auditoria.some((e) => e.accion === 'sesion.iniciar' && e.usuarioId === CUENTAS[rol].id)).toBe(true)
    })
  }

  test('Escenario: Rechazar credenciales inválidas con un mensaje genérico', async ({ page }) => {
    const correo = page.getByLabel('Correo electrónico')
    const clave = page.getByLabel('Contraseña', { exact: true })
    const entrar = page.getByRole('button', { name: 'Iniciar sesión' })

    // Cuando ingresa un correo registrado con una contraseña incorrecta
    await correo.fill(CUENTAS.coordinador.email)
    await clave.fill('Incorrecta99')
    await entrar.click()
    // Entonces el sistema no le permite el acceso y muestra un mensaje genérico
    await expect(page.getByRole('alert')).toHaveText(ERROR_GENERICO)
    await expect(page).toHaveURL(/\/inicio$/)

    // Y el mismo mensaje se muestra para un correo que no existe (no revela qué dato falló)
    await correo.fill('nadie@cuidared.do')
    await clave.fill(PASSWORD_DEMO)
    await entrar.click()
    await expect(page.getByRole('alert')).toHaveText(ERROR_GENERICO)
    await expect(page).toHaveURL(/\/inicio$/)
    expect(await page.evaluate(() => localStorage.getItem('cuidared:sesion'))).toBeNull()
  })

  test('Escenario: Impedir el acceso de una cuenta desactivada', async ({ page }) => {
    // Dado que la cuenta de Eduardo Hernández (voluntario) está desactivada en la semilla
    const db = await leerDB(page)
    expect(db.usuarios.find((u) => u.email === 'eduardo.h@gmail.com')?.estado).toBe('inactivo')
    // Cuando intenta iniciar sesión con su contraseña correcta
    await page.getByLabel('Correo electrónico').fill('eduardo.h@gmail.com')
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD_DEMO)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    // Entonces el sistema no le permite entrar
    await expect(page.getByRole('alert')).toContainText('no está activa')
    await expect(page).toHaveURL(/\/inicio$/)
    expect(await page.evaluate(() => localStorage.getItem('cuidared:sesion'))).toBeNull()
    // Y no puede acceder a las rutas protegidas
    await page.goto('/voluntario')
    await expect(page).toHaveURL(/\/inicio$/)
  })
})
