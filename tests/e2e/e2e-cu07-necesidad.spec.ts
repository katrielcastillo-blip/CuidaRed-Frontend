/*
 * e2e-cu07-necesidad.spec.ts — Suite E2E-CU07-NECESIDAD: escenarios Gherkin de CU-07 (SRS §16.3).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { alturaDocumento, CUENTAS, iniciarSesion, leerDB, limpiarDatos, objetivosPequenos, sesionDirecta } from './fixtures'

test.describe('E2E-CU07-NECESIDAD · Registrar necesidad pendiente', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Registrar una necesidad pendiente', async ({ page }) => {
    const descripcion = 'Necesita transporte para su cita del viernes en el hospital.'
    // Dado que existe un adulto mayor con perfil activo (Alicia Castillo)
    // Y el usuario está autenticado como Coordinador
    await iniciarSesion(page, 'coordinador')
    await page.goto('/coordinador/adultos/a-alicia')
    await page.getByRole('link', { name: 'Agregar necesidad' }).click()
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(form).toBeVisible()
    // Cuando selecciona una categoría de necesidad
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Transporte' })
    // (y, opcionalmente, la necesidad concreta del catálogo de esa categoría)
    await form.getByRole('combobox', { name: /^Necesidad/ }).selectOption({ label: 'Traslado a cita médica' })
    // Y registra la descripción de la necesidad
    await form.getByRole('textbox', { name: /Descripción/ }).fill(descripcion)
    // Y confirma el registro
    await form.getByRole('button', { name: 'Registrar necesidad' }).click()

    // Entonces el sistema debe crear la necesidad
    await expect(page.getByText('Necesidad registrada correctamente')).toBeVisible()
    const n = (await leerDB(page)).necesidades.find((x) => x.descripcion === descripcion)
    // Y debe asociarla al adulto mayor y establecerla inicialmente como pendiente
    expect(n).toMatchObject({ adultoId: 'a-alicia', tipo: 'transporte', catalogoId: 'nc-cita', estado: 'pendiente', prioridad: 'media', recurrente: false, registradaPor: CUENTAS.coordinador.id })
    expect(n?.historial).toEqual([expect.objectContaining({ estado: 'pendiente', usuarioId: CUENTAS.coordinador.id })])
    // (la confirmación lleva al detalle, que muestra el estado inicial y el adulto)
    await page.waitForURL(`**/coordinador/necesidades/${n!.id}`)
    await expect(page.getByText('PENDIENTE', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Alicia Castillo' })).toBeVisible()
  })

  test('Escenario: Registrar una necesidad de medicamentos', async ({ page }) => {
    const descripcion = 'Reposición de losartán de 50 miligramos para el mes.'
    // Dado que el usuario (voluntario) está registrando una necesidad para Camila Torres
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/necesidades/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    // Cuando selecciona la categoría "Medicamentos"
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Medicamentos' })
    await expect(form.getByRole('note')).toContainText('Generará una alerta de caso prioritario')
    // (la prioridad pasa a Alta por defecto en medicamentos)
    await expect(form.getByRole('radio', { name: 'Alta' })).toHaveAttribute('aria-checked', 'true')
    // Y completa la información requerida
    await form.getByRole('textbox', { name: /Descripción/ }).fill(descripcion)
    await form.getByRole('button', { name: 'Registrar necesidad' }).click()

    // Entonces el sistema debe registrar la necesidad como pendiente
    await expect(page.getByText('Necesidad registrada correctamente')).toBeVisible()
    const db = await leerDB(page)
    const n = db.necesidades.find((x) => x.descripcion === descripcion)
    // Y debe asociarla al adulto mayor correspondiente
    expect(n).toMatchObject({ adultoId: 'a-camila', tipo: 'medicamentos', estado: 'pendiente', prioridad: 'alta' })
    // (RF-04: la necesidad de medicamentos pendiente genera la alerta de caso prioritario)
    expect(db.alertas.some((a) => a.adultoId === 'a-camila' && a.tipo === 'prioritaria' && a.estado === 'pendiente')).toBe(true)
  })

  test('Escenario: Registrar una necesidad sin conexión', async ({ page, context }) => {
    const descripcion = 'Requiere acompañamiento por las tardes durante la semana.'
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/necesidades/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(form).toBeVisible()
    // Dado que el usuario no dispone de conexión a internet
    await context.setOffline(true)
    await expect(form.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible()
    // Cuando registra una necesidad pendiente válida
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Compañía' })
    await form.getByRole('textbox', { name: /Descripción/ }).fill(descripcion)
    await form.getByRole('button', { name: 'Registrar necesidad' }).click()

    // Entonces el sistema debe permitir completar el registro
    await expect(page.getByText('Necesidad registrada correctamente')).toBeVisible()
    // Y debe marcar la información como pendiente de sincronización
    await expect(page.getByText('Guardada en el dispositivo · Pendiente de sincronización')).toBeVisible()
    await page.waitForURL(/\/voluntario\/necesidades\/n-/)
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toBeVisible()
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    expect((await leerDB(page)).necesidades.some((x) => x.descripcion === descripcion)).toBe(false)
  })

  test('RF-06: formulario de necesidad con objetivos táctiles ≥ 48 px y un solo desplazamiento a 360×640', async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'RF-06 se verifica en la resolución de referencia (proyecto movil, 360×640)')
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/necesidades/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Medicamentos' }) // muestra también el aviso
    expect(page.viewportSize()).toEqual({ width: 360, height: 640 })
    expect(await objetivosPequenos(form)).toEqual([])
    expect(await alturaDocumento(page)).toBeLessThanOrEqual(2 * 640)
  })
})
