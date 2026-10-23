/*
 * e2e-cu03-perfil-edit.spec.ts — Suite E2E-CU03-PERFIL-EDIT: escenarios de CU-03 Editar perfil de adulto mayor
 * (RF-01 · Anexo B: el SRS no detalla Gherkin; se derivan del criterio de aceptación de CU-02 "el perfil queda
 * consultable y editable posteriormente").
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { CUENTAS, leerDB, limpiarDatos, sesionDirecta } from './fixtures'

const MOTIVO = 'Se mudó sola y sus ingresos son inestables.'

test.describe('E2E-CU03-PERFIL-EDIT · Editar perfil de adulto mayor', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Editar los datos y el nivel de riesgo de un perfil existente', async ({ page }) => {
    // Dado que el usuario está autenticado como Coordinador y consulta el perfil de Camila Torres
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/adultos/a-camila')
    // Cuando selecciona "Editar perfil"
    await page.getByRole('link', { name: 'Editar perfil' }).click()
    await expect(page.getByRole('heading', { name: 'Editar a Camila Torres' })).toBeVisible()
    // Y modifica el teléfono y el nivel de riesgo social (paso 1 · Identificación → paso 3 · Condición y riesgo)
    await page.getByRole('textbox', { name: /^Teléfono/ }).fill('809 666 9999')
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(page.getByText('Paso 2 de 3 · Ubicación y contacto')).toBeVisible()
    // (los datos de ubicación y el contacto de emergencia principal se cargan del perfil)
    await expect(page.getByRole('combobox', { name: /^Sector o barrio/ })).toHaveValue('Renacimiento')
    await expect(page.getByRole('textbox', { name: /^Nombres/ })).toHaveValue('Pedro')
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(page.getByText('Paso 3 de 3 · Condición y riesgo')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Riesgo bajo' })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('radio', { name: 'Riesgo medio' }).click()
    await page.getByRole('textbox', { name: /^Motivo del nivel de riesgo/ }).fill(MOTIVO)
    // Y guarda los cambios
    await page.getByRole('button', { name: 'Guardar' }).click()

    // Entonces el sistema debe actualizar el perfil
    await expect(page.getByText('Cambios guardados correctamente')).toBeVisible()
    await expect(page).toHaveURL(/\/coordinador\/adultos\/a-camila$/)
    const db = await leerDB(page)
    const camila = db.adultos.find((a) => a.id === 'a-camila')!
    expect(camila).toMatchObject({ telefono: '809 666 9999', riesgo: 'medio', actualizadoPor: CUENTAS.coordinador.id })
    // (el cambio de clasificación queda en el historial de riesgos: la anterior pasa a "superado")
    const sociales = db.riesgos.filter((r) => r.adultoId === 'a-camila' && r.riesgoId === 'r-social')
    expect(sociales.find((r) => r.id === 'er-4')).toMatchObject({ nivel: 'bajo', estado: 'superado' })
    expect(sociales.filter((r) => r.estado === 'vigente')).toEqual([expect.objectContaining({ nivel: 'medio', motivo: MOTIVO, registradoPor: CUENTAS.coordinador.id })])
    // Y debe mostrar los datos actualizados al consultarlo
    await expect(page.getByRole('region', { name: 'Resumen del adulto mayor' })).toContainText('Riesgo MEDIO')
    await expect(page.getByText('809 666 9999')).toBeVisible()
  })

  test('Escenario: Rechazar cambios inválidos sin perder lo escrito', async ({ page }) => {
    const antes = (await leerDB(page)).adultos.find((a) => a.id === 'a-camila')!
    // Dado que el usuario está editando el perfil
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/adultos/a-camila/editar')
    // Cuando deja vacío un campo obligatorio y escribe una cédula con formato incorrecto
    await page.getByRole('textbox', { name: /^Nombre/ }).fill('')
    await page.getByRole('textbox', { name: /^Cédula/ }).fill('123')
    await page.getByRole('textbox', { name: /^Teléfono/ }).fill('809 666 9999')
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // Entonces el sistema debe impedir guardar e indicar el error junto a cada campo
    await expect(page.getByRole('alert').filter({ hasText: 'Escribe el nombre.' })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Usa el formato 000-0000000-0.' })).toBeVisible()
    await expect(page.getByText('Paso 1 de 3 · Identificación')).toBeVisible()
    // Y conservar lo ya escrito en los demás campos
    await expect(page.getByRole('textbox', { name: /^Teléfono/ })).toHaveValue('809 666 9999')
    await expect(page.getByRole('textbox', { name: /^Apellido/ })).toHaveValue('Torres')
    expect((await leerDB(page)).adultos.find((a) => a.id === 'a-camila')).toEqual(antes)
  })

  test('Escenario: Desactivar un perfil conservando su historial', async ({ page }) => {
    const visitasAntes = (await leerDB(page)).visitas.filter((v) => v.adultoId === 'a-camila').length
    // Dado que el usuario está editando el perfil de Camila Torres
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/adultos/a-camila/editar')
    // Cuando selecciona "Desactivar perfil" y lo confirma
    await page.getByRole('button', { name: 'Desactivar perfil' }).click()
    await page.getByRole('dialog', { name: 'Desactivar perfil' }).getByRole('button', { name: 'Desactivar' }).click()

    // Entonces el perfil queda inactivo y se conserva su historial
    await expect(page.getByText('Camila Torres fue desactivado')).toBeVisible()
    const db = await leerDB(page)
    expect(db.adultos.find((a) => a.id === 'a-camila')?.estado).toBe('inactivo')
    expect(db.visitas.filter((v) => v.adultoId === 'a-camila').length).toBe(visitasAntes)
    // Y deja de aparecer en el resumen de casos activos
    await page.goto('/coordinador/resumen')
    await expect(page.getByTestId('caso-resumen').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByTestId('caso-resumen').filter({ hasText: 'Camila Torres' })).toHaveCount(0)
  })
})
