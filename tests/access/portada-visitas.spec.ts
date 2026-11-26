/*
 * Portada, envío y consulta de visitas en modo conectado con servicios interceptados.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { expect, test } from '@playwright/test'

test('una institución solicita una visita grupal con cantidad y aporte, sin elegir una persona mayor', async ({ page }) => {
  let solicitud: Record<string, unknown> | undefined
  const intentos: unknown[] = []
  await page.route('http://localhost:3301/api/v1/publico/**', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { data: [{ cuenta_id: 4, nombre: 'Asilo de prueba' }] } })
    solicitud = route.request().postDataJSON()
    intentos.push(solicitud?.idempotencia)
    if (intentos.length === 1) return route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE' } } })
    await route.fulfill({ status: 201, json: { data: { codigo: 'VIS-GRUP-2345' } } })
  })
  await page.goto('/solicitar-visita')
  await page.getByRole('combobox', { name: 'Organización que quieres visitar' }).selectOption('4')
  await page.getByLabel('Tu nombre', { exact: true }).fill('Ana')
  await page.getByLabel('Tus apellidos').fill('Prueba')
  await page.getByLabel('Cédula', { exact: true }).fill('00123456780')
  await page.getByLabel('Teléfono').fill('8095550100')
  await page.getByLabel('Correo electrónico').fill('visitante@example.test')
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await page.getByRole('radio', { name: /Visita de una institución o grupo/ }).check()
  await expect(page.getByLabel('¿A quién quieres visitar?', { exact: true })).toHaveCount(0)
  await page.getByLabel('Nombre de la institución o del grupo').fill('Fundación de prueba')
  await page.getByLabel('Tipo de institución o grupo', { exact: true }).selectOption('fundacion')
  await page.getByLabel('Cantidad de visitantes').fill('12')
  await page.getByLabel('Actividad o aporte previsto (opcional)').fill('Actividad musical y entrega de alimentos.')
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await page.getByLabel('Fecha propuesta').fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10))
  await page.getByLabel('Hora propuesta').fill('10:30')
  await page.getByLabel('Hora de fin propuesta').fill('11:30')
  await page.getByLabel('Motivo de la visita').fill('Encuentro comunitario')
  await page.getByRole('checkbox', { name: /He leído la/ }).check()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
  await page.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(page.getByText('No pudimos confirmar el envío. Vuelve a intentarlo sin cambiar los datos.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(page.getByText('VIS-GRUP-2345', { exact: true })).toBeVisible()
  expect(solicitud).toMatchObject({ tipo_visita: 'institucional', entidad_visitante: 'Fundación de prueba', tipo_entidad: 'fundacion', cantidad_visitantes: 12, aporte_previsto: 'Actividad musical y entrega de alimentos.' })
  expect(solicitud).not.toHaveProperty('persona_a_visitar')
  expect(intentos).toHaveLength(2)
  expect(intentos[0]).toBe(intentos[1])
  expect(intentos[0]).toMatch(/^[0-9a-f-]{36}$/)
})

test('el acceso y la creación de cuenta permiten volver a la portada', async ({ page }) => {
  await page.route('http://localhost:3301/api/v1/publico/organizaciones', (route) => route.fulfill({ json: { data: [] } }))
  await page.goto('/#solicitar-visita')
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).first().click()
  await expect(page).toHaveURL(/\/inicio$/)
  const volver = () => page.getByRole('navigation', { name: 'Navegación pública' }).getByRole('link', { name: 'Volver a la portada' })
  await expect(volver()).toBeVisible()
  await volver().click()
  await expect(page).toHaveURL(/\/#solicitar-visita$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('El cuidado se organiza en comunidad.')

  await page.getByRole('contentinfo').getByRole('link', { name: 'Crear cuenta', exact: true }).click()
  await expect(page).toHaveURL(/\/crear-cuenta$/)
  await expect(page.getByRole('navigation', { name: 'Navegación pública' })).toHaveCount(0)
  const volverDesdeRegistro = page.getByRole('button', { name: 'Volver a la portada', exact: true })
  await expect(volverDesdeRegistro).toBeVisible()
  await volverDesdeRegistro.click()
  await expect(page).toHaveURL(/\/#solicitar-visita$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('El cuidado se organiza en comunidad.')
})

test('la portada distingue un catálogo vacío de las solicitudes deshabilitadas', async ({ page }) => {
  let cuentaOperativa = false
  await page.route('http://localhost:3301/api/v1/publico/organizaciones', (route) => route.fulfill({
    json: { data: cuentaOperativa ? [{ cuenta_id: 4, nombre: 'Centro de prueba' }] : [] },
  }))
  await page.goto('/')
  const seccion = page.locator('#solicitar-visita')
  await expect(seccion.getByText('Por el momento no hay organizaciones disponibles para recibir solicitudes.')).toBeVisible()
  const organizacion = seccion.getByRole('combobox', { name: 'Organización que quieres visitar' })
  await expect(organizacion).toBeDisabled()
  await expect(seccion.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  await expect(seccion.getByText(/Las solicitudes en línea aún no están habilitadas/)).toHaveCount(0)

  cuentaOperativa = true
  await seccion.getByRole('button', { name: 'Volver a cargar organizaciones' }).click()
  await expect(organizacion).toBeEnabled()
  await organizacion.selectOption({ label: 'Centro de prueba' })
  await expect(organizacion).toHaveValue('4')
})

test('la portada permite seguir una visita sin sesión y observarla después de realizarse', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.setDefaultTimeout(8_000)
  const codigo = 'VIS-ABCD-2345'
  const fecha = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
  let terminada = false
  let observacion = ''
  const estado = () => ({
    organizacion: 'Centro de prueba',
    estado: terminada ? 'realizada' : 'autorizada',
    estado_texto: terminada ? 'Visita realizada' : 'Autorizada',
    fecha, hora: '10:30', motivo_rechazo: null,
    puede_registrar_observacion: terminada && !observacion,
    observacion: observacion || null,
  })
  await page.route('http://localhost:3301/api/v1/publico/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    expect(request.headers().authorization).toBeUndefined()
    if (path.endsWith('/organizaciones')) {
      await route.fulfill({ json: { data: [{ cuenta_id: 4, nombre: 'Centro de prueba' }] } })
    } else if (path.endsWith('/consulta')) {
      expect(request.postDataJSON()).toEqual({ codigo })
      await route.fulfill({ json: { data: estado() } })
    } else if (path.endsWith('/observacion')) {
      expect(terminada).toBe(true)
      const datos = request.postDataJSON()
      expect(datos.codigo).toBe(codigo)
      observacion = datos.observacion
      await route.fulfill({ json: { data: estado() } })
    } else {
      expect(path).toBe('/api/v1/publico/solicitudes-visita')
      expect(request.postDataJSON()).toMatchObject({ cuenta_id: 4, nombres: 'Ana', fecha_propuesta: fecha })
      await route.fulfill({ status: 201, json: { data: { codigo } } })
    }
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('El cuidado se organiza en comunidad.')
  await expect(page.getByRole('link', { name: 'Consultar mi solicitud', exact: true }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
  const menu = page.getByRole('button', { name: 'Abrir menú' })
  if (await menu.isVisible()) {
    await menu.click()
    await page.keyboard.press('Escape')
    await expect(menu).toBeFocused()
    await menu.click()
    await page.getByRole('navigation', { name: 'Menú principal' }).getByRole('link', { name: 'Ayuda' }).click()
    await expect(menu).toBeVisible()
  }
  await page.getByText('¿Cuándo puedo enviar una observación?', { exact: true }).click()
  await expect(page.getByText(/Desde el inicio del horario autorizado puedes consultar tu código/)).toBeVisible()
  await page.getByRole('link', { name: 'Solicitar una visita', exact: true }).first().click()
  await page.getByRole('combobox', { name: 'Organización que quieres visitar' }).selectOption('4')
  await page.getByLabel('Tu nombre', { exact: true }).fill('Ana')
  await page.getByLabel('Tus apellidos').fill('Prueba')
  await page.getByRole('textbox', { name: 'Cédula', exact: true }).fill('00123456780')
  await page.getByLabel('Teléfono').fill('8095550100')
  await page.getByLabel('Correo electrónico').fill('visitante@example.test')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('textbox', { name: '¿A quién quieres visitar?', exact: true }).fill('Teresa Prueba')
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await page.getByLabel('Fecha propuesta').fill(fecha)
  await page.getByLabel('Hora propuesta').fill('10:30')
  await page.getByLabel('Hora de fin propuesta').fill('11:30')
  await page.getByLabel('Motivo de la visita').fill('Visita de compañía')
  await page.getByRole('checkbox', { name: /He leído la/ }).check()
  await page.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(page.getByText(codigo, { exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('cuidared:borrador:solicitud-visita'))).toBeNull()
  await page.locator('#solicitar-visita').getByRole('link', { name: 'Consultar mi solicitud', exact: true }).last().click()
  await page.getByLabel('Código de seguimiento').fill(codigo)
  await page.getByRole('button', { name: 'Consultar solicitud' }).click()
  await expect(page.getByText('Autorizada', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Tu observación')).toHaveCount(0)
  terminada = true
  await page.getByRole('button', { name: 'Actualizar estado' }).click()
  await page.getByRole('textbox', { name: 'Tu observación', exact: true }).fill('Conversamos y acordamos una próxima visita.')
  await page.getByRole('button', { name: 'Guardar observación' }).click()
  await expect(page.getByText('Tu observación quedó registrada.')).toBeVisible()
  await expect(page.getByText(observacion, { exact: true })).toBeVisible()
  expect(page.url()).not.toContain(codigo)
})
