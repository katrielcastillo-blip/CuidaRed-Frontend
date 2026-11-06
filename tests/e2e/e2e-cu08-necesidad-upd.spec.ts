/*
 * e2e-cu08-necesidad-upd.spec.ts — Suite E2E-CU08-NECESIDAD-UPD: escenarios de CU-08 Actualizar estado de necesidad
 * (RF-03 · Anexo B: el SRS no detalla Gherkin; se derivan del criterio de aceptación de CU-07 "el usuario autorizado
 * puede registrar una necesidad nueva, modificar su estado y consultarla desde el perfil").
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reglas de Negocio V2 (§Necesidad): cambian el estado el coordinador (y el administrador) y el CUIDADOR, solo sobre los
 * adultos que tiene asignados en la cuenta activa; el voluntario no tiene necesidades; el familiar solo consulta. El perfil
 * del adulto muestra el «Historial consolidado» (línea de tiempo con los cambios de estado). El motor de alertas corre en
 * un efecto al montar la app: tras recargar se espera con expect.poll antes de leer las alertas. Las pruebas omiten el
 * onboarding de un solo uso (se verifica en la suite de CU-01).
 */
import { expect, test, type Page } from '@playwright/test'
import { CUENTA_FAMILIA, CUENTAS, editarDB, leerDB, limpiarDatos, necesidadPendiente, sesionDirecta } from './fixtures'

const MOTIVO = 'Donación de la farmacia comunitaria.'

/** Marca como vista la guía de onboarding de los usuarios demo (clave `cuidared:onboarding:<userId>:<rol>`). */
async function omitirOnboarding(page: Page) {
  const claves = [...Object.entries(CUENTAS).map(([rol, c]) => `${c.id}:${rol}`), `${CUENTA_FAMILIA.id}:coordinador`].map((k) => `cuidared:onboarding:${k}`)
  await page.evaluate((ks) => ks.forEach((k) => localStorage.setItem(k, new Date().toISOString())), claves)
}

/** Alerta de caso prioritario de un adulto, esperando a que el motor de reglas (que corre al montar) la evalúe. */
async function estadoAlertaPrioritaria(page: Page, adultoId: string, esperado: 'pendiente' | 'atendida') {
  await expect
    .poll(async () => (await leerDB(page)).alertas.find((a) => a.adultoId === adultoId && a.tipo === 'prioritaria')?.estado, { message: `la alerta prioritaria de ${adultoId} debe quedar «${esperado}»` })
    .toBe(esperado)
}

test.describe('E2E-CU08-NECESIDAD-UPD · Actualizar estado de necesidad', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page)
  })

  test('Escenario: Actualizar el estado de una necesidad con una nota', async ({ page }) => {
    const nota = 'Se coordinó acompañamiento con la junta de vecinos.'
    // Dado que existe una necesidad pendiente (n-1, compañía para Elena Rodríguez)
    // Y el usuario está autenticado como Cuidador asignado a Elena (Carlos Ruiz)
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/necesidades/n-1')
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
    expect(n.historial.at(-1)).toMatchObject({ estado: 'en_proceso', usuarioId: CUENTAS.cuidador.id, nota })
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
    await estadoAlertaPrioritaria(page, 'a-camila', 'pendiente')
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
    await estadoAlertaPrioritaria(page, 'a-camila', 'atendida')
    await page.goto('/coordinador/adultos/a-camila')
    // (el historial consolidado del perfil muestra el cambio de estado con su motivo)
    const historial = page.getByRole('region', { name: 'Historial consolidado' })
    const tipo = historial.getByRole('combobox', { name: 'Tipo' })
    await tipo.selectOption({ label: ((await tipo.locator('option', { hasText: /^Necesidades \(/ }).textContent()) ?? '').trim() })
    const cambio = historial.getByRole('list', { name: 'Línea de tiempo del adulto mayor' }).getByRole('listitem').filter({ hasText: 'pasó a satisfecha' })
    await expect(cambio.filter({ hasText: MOTIVO })).toHaveCount(1)
    await expect(cambio.filter({ hasText: MOTIVO })).toContainText('Satisfecha')
    await expect(historial.getByRole('list', { name: 'Línea de tiempo del adulto mayor' }).getByRole('listitem').filter({ hasText: 'Reposición de metformina.' })).not.toHaveCount(0)
  })

  test('Escenario: Actualizar el estado de una necesidad sin conexión', async ({ page, context }) => {
    // Dado que el cuidador abre la necesidad n-1 y pierde la conexión
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/necesidades/n-1')
    await expect(page.getByRole('heading', { name: 'Actualizar estado' })).toBeVisible()
    await context.setOffline(true)
    // Cuando cambia el estado a "En proceso"
    await page.getByRole('radio', { name: 'En proceso' }).click()
    await page.getByRole('button', { name: 'Guardar cambio de estado' }).click()
    // Entonces el cambio queda en el dispositivo, marcado como pendiente de sincronización, y no llega aún al servidor
    await expect(page.getByText(/Estado: En proceso\. Guardado en el dispositivo · Pendiente de sincronización/)).toBeVisible()
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toBeVisible()
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    expect((await leerDB(page)).necesidades.find((n) => n.id === 'n-1')?.estado).toBe('pendiente')
    // Y al volver la conexión se sincroniza y el servidor lo refleja
    await context.setOffline(false)
    await expect(page.getByText('Sincronización completada: 1 registro(s) enviado(s).')).toBeVisible({ timeout: 10_000 })
    expect((await leerDB(page)).necesidades.find((n) => n.id === 'n-1')?.estado).toBe('en_proceso')
    await expect(page.getByTestId('pendientes-sync')).toHaveCount(0)
  })

  test('Escenario: El cuidador no puede actualizar necesidades de adultos que no tiene asignados ni de otra cuenta', async ({ page }) => {
    // Dado que el usuario es Cuidador en la cuenta Fundación Esperanza (Carlos solo tiene asignados a Elena, José y Camila)
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/necesidades/n-3')
    // Cuando abre la necesidad n-3 (de María García, asignada a otra cuidadora)
    // Entonces el sistema responde igual que si no existiera
    await expect(page.getByText('No encontrado o sin permiso')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Actualizar estado' })).toHaveCount(0)
    // Y tampoco ve las necesidades de Familia Méndez, aunque Carlos también sea cuidador de esa cuenta (n-9 es de Rosa Méndez)
    await page.goto('/cuidador/necesidades/n-9')
    await expect(page.getByText('No encontrado o sin permiso')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardar cambio de estado' })).toHaveCount(0)
    expect((await leerDB(page)).necesidades.find((n) => n.id === 'n-9')?.estado).toBe('pendiente')
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
