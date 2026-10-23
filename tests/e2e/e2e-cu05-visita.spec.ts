/*
 * e2e-cu05-visita.spec.ts — Suite E2E-CU05-VISITA: escenarios Gherkin de CU-05 (SRS §16.2).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { alturaDocumento, CUENTAS, haceDiasISO, iniciarSesion, leerDB, limpiarDatos, objetivosPequenos, sesionDirecta } from './fixtures'

const OBSERVACIONES = 'Visita de prueba E2E sin novedades, buen estado general.'

test.describe('E2E-CU05-VISITA · Registrar visita comunitaria', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Registrar una visita correctamente', async ({ page }) => {
    // Dado que el usuario está autenticado como Coordinador
    await iniciarSesion(page, 'coordinador')
    // Y existe un perfil activo de adulto mayor (Camila Torres)
    await page.goto('/coordinador/adultos/a-camila')
    await page.getByRole('link', { name: 'Registrar visita' }).click()
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    // Cuando registra la fecha de la visita
    const fecha = haceDiasISO(1)
    await form.getByLabel('Fecha').fill(fecha)
    // Y registra al responsable
    await form.getByRole('combobox', { name: /Responsable/ }).selectOption({ label: 'Carlos Ruiz' })
    await form.getByRole('radio', { name: 'Estable' }).click()
    await form.getByText('Alimentación adecuada').click()
    // Y completa las observaciones correspondientes
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    // Y confirma el registro
    await form.getByRole('button', { name: 'Registrar visita' }).click()

    // Entonces el sistema debe guardar la visita
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    const db = await leerDB(page)
    const visita = db.visitas.find((v) => v.observaciones === OBSERVACIONES)
    expect(visita).toMatchObject({ adultoId: 'a-camila', cuidadorId: 'u-cuid', fecha, estado: 'completada', estadoAdulto: 'estable', checklist: ['alimentacion'] })
    expect(visita?.pendienteSync).toBeUndefined()

    // Y debe asociarla al perfil del adulto mayor y mostrarla en su historial de visitas
    await page.getByRole('link', { name: 'Volver al perfil de Camila' }).click()
    await expect(page).toHaveURL(/\/coordinador\/adultos\/a-camila$/)
    const historial = page.getByRole('region', { name: 'Historial del adulto mayor' })
    await expect(historial.getByRole('tab', { name: /Visitas/ })).toHaveAttribute('aria-selected', 'true')
    await expect(historial.getByRole('link').filter({ hasText: OBSERVACIONES.slice(0, 30) })).toBeVisible()
  })

  test('Escenario: Intentar registrar una visita sin seleccionar un adulto mayor', async ({ page }) => {
    // Dado que el usuario está registrando una visita (sin adulto preseleccionado)
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/visitas/nueva')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    const adulto = form.getByRole('combobox', { name: /Adulto mayor visitado/ })
    await expect(adulto).toHaveValue('')
    const antes = (await leerDB(page)).visitas.length

    // Cuando intenta guardar la visita sin asociarla a un adulto mayor
    await form.getByRole('radio', { name: 'Estable' }).click()
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    await form.getByRole('button', { name: 'Registrar visita' }).click()

    // Entonces el sistema debe impedir el registro
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toHaveCount(0)
    expect((await leerDB(page)).visitas.length).toBe(antes)
    // Y debe solicitar la selección de un perfil válido (mensaje junto al campo, sin perder lo escrito)
    await expect(adulto).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByRole('alert').filter({ hasText: 'Selecciona un perfil de adulto mayor válido.' })).toBeVisible()
    await expect(form.getByRole('textbox', { name: /Observaciones/ })).toHaveValue(OBSERVACIONES)
  })

  test('Escenario: Registrar una visita sin conexión', async ({ page, context }) => {
    // Dado que el usuario está autenticado
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    // Y el dispositivo no tiene conexión a internet
    await context.setOffline(true)
    await expect(form.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible()

    // Cuando registra una visita con todos los datos requeridos
    await form.getByRole('radio', { name: 'Requiere atención' }).click()
    await form.getByText('Toma de medicamentos').click()
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    await form.getByRole('button', { name: 'Registrar visita' }).click()

    // Entonces el sistema debe permitir completar el registro
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    // Y debe marcarlo como pendiente de sincronización
    await expect(page.getByText('Guardada en el dispositivo · Pendiente de sincronización')).toBeVisible()
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toBeVisible()
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    // (no llegó al servidor: solo está en la cola local del dispositivo)
    expect((await leerDB(page)).visitas.some((v) => v.observaciones === OBSERVACIONES)).toBe(false)
    const cola = await page.evaluate(
      () =>
        new Promise<Array<{ entidad: string; datos: { observaciones?: string } }>>((resolve) => {
          const req = indexedDB.open('cuidared-offline')
          req.onsuccess = () => {
            const r = req.result.transaction('pendientes').objectStore('pendientes').getAll()
            r.onsuccess = () => resolve(r.result)
          }
        }),
    )
    expect(cola).toEqual([expect.objectContaining({ entidad: 'visita', datos: expect.objectContaining({ observaciones: OBSERVACIONES }) })])
  })

  test('RF-06: formulario de visita con objetivos táctiles ≥ 48 px y un solo desplazamiento a 360×640', async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'RF-06 se verifica en la resolución de referencia (proyecto movil, 360×640)')
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    expect(page.viewportSize()).toEqual({ width: 360, height: 640 })
    // Ningún elemento interactivo visible del formulario mide menos de 48×48 px
    expect(await objetivosPequenos(form)).toEqual([])
    // Un solo desplazamiento: la página completa no supera dos alturas de pantalla
    expect(await alturaDocumento(page)).toBeLessThanOrEqual(2 * 640)
  })
})
