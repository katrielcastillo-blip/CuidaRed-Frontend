/*
 * e2e-cu08-necesidad-upd.spec.ts — Suite E2E-CU08-NECESIDAD-UPD: escenarios de CU-08 Actualizar estado de necesidad
 * (RF-03 · Anexo B: el SRS no detalla Gherkin; se derivan del criterio de aceptación de CU-07 "el usuario autorizado
 * puede registrar una necesidad nueva, modificar su estado y consultarla desde el perfil").
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { CUENTAS, editarDB, leerDB, limpiarDatos, necesidadPendiente, sesionDirecta } from './fixtures'

const MOTIVO = 'Donación de la farmacia comunitaria.'

test.describe('E2E-CU08-NECESIDAD-UPD · Actualizar estado de necesidad', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Actualizar el estado de una necesidad con una nota', async ({ page }) => {
    const nota = 'Se coordinó acompañamiento con la junta de vecinos.'
    // Dado que existe una necesidad pendiente (n-1, compañía para Elena Rodríguez)
    // Y el usuario está autenticado como Voluntario asignado
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/necesidades/n-1')
    await expect(page.getByText('PENDIENTE', { exact: true })).toBeVisible()
    // Cuando cambia el estado a "En proceso" con una nota
    await page.getByRole('radio', { name: 'En proceso' }).click()
    await page.getByRole('textbox', { name: 'Nota (opcional)' }).fill(nota)
    await page.getByRole('button', { name: 'Guardar cambio de estado' }).click()

    // Entonces el sistema actualiza el estado
    await expect(page.getByText('Necesidad marcada como «En proceso»')).toBeVisible()
    await expect(page.getByText('EN PROCESO', { exact: true })).toBeVisible()
    const n = (await leerDB(page)).necesidades.find((x) => x.id === 'n-1')!
    expect(n.estado).toBe('en_proceso')
    expect(n.historial.at(-1)).toMatchObject({ estado: 'en_proceso', usuarioId: CUENTAS.voluntario.id, nota })
    // Y deja constancia en el historial de estados (usuario, fecha y nota)
    const historial = page.getByRole('region', { name: 'Historial de estados' })
    await expect(historial.getByRole('listitem').first()).toContainText('Cambió a En proceso')
    await expect(historial.getByRole('listitem').first()).toContainText('Carlos Ruiz')
    await expect(historial.getByRole('listitem').first()).toContainText(nota)
  })

  test('Escenario: Satisfacer una necesidad de medicamentos cierra la alerta de caso prioritario', async ({ page }) => {
    // Dado que Camila Torres (riesgo bajo) tiene una necesidad de medicamentos pendiente con alerta prioritaria
    await editarDB(
      page,
      (db, n) => {
        db.necesidades.push(n)
      },
      necesidadPendiente({ id: 'n-e2e-med', adultoId: 'a-camila', catalogoId: 'nc-medicamento', registradaPor: 'u-cuid', tipo: 'medicamentos', descripcion: 'Reposición de metformina.' }),
    )
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/necesidades/n-e2e-med')
    expect((await leerDB(page)).alertas.find((a) => a.adultoId === 'a-camila' && a.tipo === 'prioritaria')?.estado).toBe('pendiente')
    // Cuando el Coordinador la marca como "Satisfecha" (resolverla exige indicar el motivo)
    await page.getByRole('radio', { name: 'Satisfecha' }).click()
    await page.getByRole('button', { name: 'Guardar cambio de estado' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Indica el motivo de la resolución.' })).toBeVisible()
    expect((await leerDB(page)).necesidades.find((n) => n.id === 'n-e2e-med')?.estado).toBe('pendiente')
    await page.getByRole('textbox', { name: /^Motivo de la resolución/ }).fill(MOTIVO)
    await page.getByRole('button', { name: 'Guardar cambio de estado' }).click()

    // Entonces la necesidad queda satisfecha y se consulta así desde el perfil del adulto
    await expect(page.getByText('Necesidad marcada como «Satisfecha»')).toBeVisible()
    const db = await leerDB(page)
    expect(db.necesidades.find((n) => n.id === 'n-e2e-med')).toMatchObject({ estado: 'satisfecha', satisfechaPor: CUENTAS.coordinador.id, motivoResolucion: MOTIVO })
    await expect(page.getByRole('region', { name: 'Resolución' })).toContainText(MOTIVO)
    // Y la alerta de caso prioritario se cierra automáticamente (ya no se cumple la condición de RF-04)
    expect(db.alertas.find((a) => a.adultoId === 'a-camila' && a.tipo === 'prioritaria')?.estado).toBe('atendida')
    await page.goto('/coordinador/adultos/a-camila')
    const historial = page.getByRole('region', { name: 'Historial del adulto mayor' })
    await historial.getByRole('tab', { name: /Necesidades/ }).click()
    await expect(historial.getByRole('link').filter({ hasText: 'Reposición de metformina.' })).toContainText('Satisfecha')
  })

  test('Escenario: El familiar responsable consulta el estado sin poder modificarlo', async ({ page }) => {
    // Dado que el usuario está autenticado como Familiar responsable de Elena Rodríguez
    await sesionDirecta(page, CUENTAS.familiar.id, '/familiar/necesidades/n-1')
    // Cuando consulta una necesidad del adulto a su cargo (n-1: «Acompañamiento», categoría Compañía)
    await expect(page.getByRole('heading', { name: 'Acompañamiento' })).toBeVisible()
    await expect(page.getByText('Compañía', { exact: true })).toBeVisible()
    // Entonces ve su estado actual
    await expect(page.getByText('Pendiente').first()).toBeVisible()
    // Y no tiene la opción de actualizarlo
    await expect(page.getByRole('heading', { name: 'Actualizar estado' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Guardar cambio de estado' })).toHaveCount(0)
  })
})
