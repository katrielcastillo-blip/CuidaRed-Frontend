/*
 * e2e-cu14-sync.spec.ts — Suite E2E-CU14-SYNC: escenarios Gherkin de CU-14 (SRS §16.9).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Sin conexión real: context.setOffline(true) (navigator.onLine = false + evento "offline").
 * Conflicto Last-Write-Wins: dos pestañas del MISMO contexto actúan como dos dispositivos que comparten el
 * "servidor" (localStorage). La pestaña A queda sin conexión con la simulación por pestaña de la app
 * (sessionStorage 'cuidared:simular-sin-conexion') y la B sigue en línea.
 */
import { expect, test, type Page } from '@playwright/test'
import { CUENTAS, leerDB, limpiarDatos, sesionDirecta } from './fixtures'

const OBSERVACIONES = 'Visita registrada sin conexión durante la prueba E2E.'
const DESCRIPCION = 'Necesidad registrada sin conexión durante la prueba E2E.'
const MOTIVO = 'Acompañamiento cubierto por la parroquia.'

/** Registros pendientes en la cola offline del dispositivo (IndexedDB 'cuidared-offline'). */
const colaOffline = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Array<{ entidad: string; registroId: string }>>((resolve) => {
        const req = indexedDB.open('cuidared-offline')
        req.onsuccess = () => {
          const r = req.result.transaction('pendientes').objectStore('pendientes').getAll()
          r.onsuccess = () => resolve(r.result)
        }
        req.onerror = () => resolve([])
      }),
  )

/** Registra una visita a Camila Torres desde el formulario (ya abierto). */
async function registrarVisita(page: Page) {
  const form = page.getByRole('form', { name: 'Registro de visita' })
  await form.getByRole('radio', { name: 'Estable' }).click()
  await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
  await form.getByRole('button', { name: 'Registrar visita' }).click()
  await expect(page.getByText('Guardada en el dispositivo · Pendiente de sincronización')).toBeVisible()
}

/** Cambia el estado de la necesidad abierta en `page` (pantalla de detalle). Resolverla exige el motivo. */
async function cambiarEstado(page: Page, estado: 'En proceso' | 'Satisfecha') {
  await page.getByRole('radio', { name: estado }).click()
  if (estado === 'Satisfecha') await page.getByRole('textbox', { name: /^Motivo de la resolución/ }).fill(MOTIVO)
  await page.getByRole('button', { name: 'Guardar cambio de estado' }).click()
}

test.describe('E2E-CU14-SYNC · Sincronizar datos offline', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Sincronizar una visita registrada sin conexión', async ({ page, context }) => {
    // Dado que el usuario registró una visita mientras no tenía conexión
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva?adulto=a-camila')
    await expect(page.getByRole('form', { name: 'Registro de visita' })).toBeVisible()
    await context.setOffline(true)
    await registrarVisita(page)
    // Y la visita quedó pendiente de sincronización
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    expect((await leerDB(page)).visitas.some((v) => v.observaciones === OBSERVACIONES)).toBe(false)

    // Cuando se restablece la conexión
    await context.setOffline(false)

    // Entonces el sistema debe sincronizar la visita con la base de datos central
    await expect(page.getByText('Sincronización completada: 1 registro(s) enviado(s).')).toBeVisible({ timeout: 10_000 })
    const visita = (await leerDB(page)).visitas.find((v) => v.observaciones === OBSERVACIONES)
    expect(visita).toMatchObject({ adultoId: 'a-camila', cuidadorId: CUENTAS.voluntario.id, estado: 'completada' })
    expect(visita?.pendienteSync).toBeUndefined()
    // Y debe actualizar su estado como sincronizado (indicador de conexión, cola local y detalle de la visita)
    await expect(page.getByTestId('pendientes-sync')).toHaveCount(0)
    expect(await colaOffline(page)).toEqual([])
    await page.getByRole('link', { name: 'Ver la visita' }).click()
    await expect(page).toHaveURL(new RegExp(`/voluntario/visitas/${visita!.id}$`))
    await expect(page.getByText(OBSERVACIONES)).toBeVisible()
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toHaveCount(0)
  })

  test('La confirmación de una visita registrada sin conexión se actualiza al sincronizarse', async ({ page, context }) => {
    // CU-14: "debe actualizar su estado como sincronizado" también en la pantalla de confirmación abierta.
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva?adulto=a-camila')
    await expect(page.getByRole('form', { name: 'Registro de visita' })).toBeVisible()
    await context.setOffline(true)
    await registrarVisita(page)
    await context.setOffline(false)
    await expect(page.getByText('Sincronización completada: 1 registro(s) enviado(s).')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('pendientes-sync')).toHaveCount(0)
    // La confirmación debería dejar de mostrar el registro como pendiente.
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toHaveCount(0, { timeout: 3_000 })
  })

  test('Escenario: Sincronizar una necesidad registrada sin conexión', async ({ page, context }) => {
    // Dado que el usuario registró una necesidad mientras no tenía conexión
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/necesidades/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(form).toBeVisible()
    await context.setOffline(true)
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Alimentación' })
    await form.getByRole('textbox', { name: /Descripción/ }).fill(DESCRIPCION)
    await form.getByRole('button', { name: 'Registrar necesidad' }).click()
    // Y la necesidad quedó pendiente de sincronización
    await page.waitForURL(/\/voluntario\/necesidades\/n-/)
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toBeVisible()
    expect((await leerDB(page)).necesidades.some((n) => n.descripcion === DESCRIPCION)).toBe(false)

    // Cuando se restablece la conexión
    await context.setOffline(false)

    // Entonces el sistema debe sincronizar la necesidad con la base de datos central
    await expect(page.getByText('Sincronización completada: 1 registro(s) enviado(s).')).toBeVisible({ timeout: 10_000 })
    const n = (await leerDB(page)).necesidades.find((x) => x.descripcion === DESCRIPCION)
    expect(n).toMatchObject({ adultoId: 'a-camila', tipo: 'alimentacion', estado: 'pendiente' })
    // Y debe actualizar su estado como sincronizado
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('pendientes-sync')).toHaveCount(0)
    expect(await colaOffline(page)).toEqual([])
  })

  test('Escenario: Mantener datos pendientes cuando la conexión continúa ausente', async ({ page, context }) => {
    await page.clock.install()
    // Dado que existen registros pendientes de sincronización
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva?adulto=a-camila')
    await expect(page.getByRole('form', { name: 'Registro de visita' })).toBeVisible()
    await context.setOffline(true)
    await registrarVisita(page)
    // Y el dispositivo continúa sin conexión
    await page.getByTestId('indicador-conexion').click()
    await expect(page.getByTestId('estado-conexion')).toHaveText('Sin conexión')

    // Cuando el sistema intenta sincronizar los registros (reintento automático periódico)
    await page.clock.fastForward('01:05')
    await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toBeDisabled()

    // Entonces debe conservar los registros pendientes
    await expect(page.getByRole('heading', { name: 'Pendientes de sincronización (1)' })).toBeVisible()
    await expect(page.getByTestId('lista-pendientes').getByText('Pendiente de sincronización')).toHaveCount(1)
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    expect(await colaOffline(page)).toEqual([expect.objectContaining({ entidad: 'visita' })])
    // Y no debe indicar que fueron sincronizados correctamente
    await expect(page.getByText(/Sincronización completada/)).toHaveCount(0)
    await expect(page.getByTestId('ultimo-resultado')).toHaveCount(0)
    expect((await leerDB(page)).visitas.some((v) => v.observaciones === OBSERVACIONES)).toBe(false)
  })

  for (const caso of [
    { gana: 'servidor', primero: 'dispositivo', esperado: 'satisfecha', texto: 'se conservó la versión del servidor (más reciente)' },
    { gana: 'dispositivo', primero: 'servidor', esperado: 'en_proceso', texto: 'se conservó la versión de este dispositivo' },
  ] as const) {
    test(`Escenario: Resolver conflicto de sincronización (gana la versión más reciente: ${caso.gana})`, async ({ page, context }) => {
      // Dos "dispositivos" del mismo voluntario sobre la necesidad n-1 (Elena Rodríguez, pendiente)
      await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/necesidades/n-1')
      const enLinea = page // dispositivo B: en línea
      const sinRed = await context.newPage() // dispositivo A: sin conexión (simulada solo en esta pestaña)
      await sinRed.goto('/inicio')
      await sinRed.evaluate(() => sessionStorage.setItem('cuidared:simular-sin-conexion', '1'))
      await sinRed.goto('/voluntario/necesidades/n-1')
      await expect(sinRed.getByTestId('indicador-conexion')).toContainText('Sin conexión')
      await expect(enLinea.getByRole('heading', { name: 'Actualizar estado' })).toBeVisible()
      const base = (await leerDB(page)).necesidades.find((n) => n.id === 'n-1')!
      expect(base.estado).toBe('pendiente')

      // Dado que un registro fue modificado localmente y también fue modificado en el servidor
      // (el orden de las dos ediciones decide qué marca de tiempo UTC es más reciente)
      const editarSinRed = async () => {
        await cambiarEstado(sinRed, 'En proceso')
        await expect(sinRed.getByText(/Guardado en el dispositivo · Pendiente de sincronización/)).toBeVisible()
      }
      const editarEnLinea = async () => {
        await cambiarEstado(enLinea, 'Satisfecha')
        await expect(enLinea.getByText('Necesidad marcada como «Satisfecha»')).toBeVisible()
      }
      if (caso.primero === 'dispositivo') {
        await editarSinRed()
        await enLinea.waitForTimeout(20) // marcas de tiempo distintas
        await editarEnLinea()
      } else {
        await editarEnLinea()
        await sinRed.waitForTimeout(20)
        await editarSinRed()
      }
      const enServidor = (await leerDB(page)).necesidades.find((n) => n.id === 'n-1')!
      expect(enServidor.estado).toBe('satisfecha')

      // Cuando se restablece la conexión y se detecta el conflicto
      await sinRed.getByTestId('indicador-conexion').click()
      await expect(sinRed.getByText('Necesidad · modificada')).toBeVisible()
      await sinRed.getByRole('switch', { name: 'Simular sin conexión en este dispositivo' }).click()

      // Entonces el sistema debe resolver el conflicto aplicando la regla de "última escritura gana"
      const resultado = sinRed.getByTestId('ultimo-resultado')
      await expect(resultado).toContainText('Conflictos resueltos', { timeout: 10_000 })
      await expect(resultado).toContainText(`Necesidad n-1: ${caso.texto}.`)
      await expect(sinRed.getByText(/1 conflicto\(s\) resuelto\(s\) con "última escritura gana"/)).toBeVisible()
      const db = await leerDB(page)
      const final = db.necesidades.find((n) => n.id === 'n-1')!
      expect(final.estado).toBe(caso.esperado)
      // (se conserva el registro completo de la versión ganadora: resolución incluida o ninguna)
      if (caso.gana === 'servidor') expect(final).toMatchObject({ motivoResolucion: MOTIVO, satisfechaPor: CUENTAS.voluntario.id })
      else expect(final.motivoResolucion ?? final.satisfechaEn).toBeUndefined()
      // Y debe utilizar la marca de tiempo UTC asociada a cada modificación
      const conflicto = db.auditoria.find((e) => e.accion === 'sync.conflicto' && e.registroId === 'n-1')
      expect(conflicto?.detalle).toMatch(/local \d{4}-\d{2}-\d{2}T[\d:.]+Z · servidor \d{4}-\d{2}-\d{2}T[\d:.]+Z/)
      const [, local, servidor] = conflicto!.detalle!.match(/local (\S+) · servidor (\S+)\)/)!
      expect(caso.gana === 'dispositivo' ? local! > servidor! : servidor! > local!).toBe(true)
      expect(final.actualizadoEn).toBe(caso.gana === 'dispositivo' ? local : servidor)
      await expect(sinRed.getByTestId('pendientes-sync')).toHaveCount(0)
    })
  }
})
