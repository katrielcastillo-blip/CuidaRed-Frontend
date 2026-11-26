/*
 * login-layout.spec.ts — Acceso y registro completos en escritorio, con adaptación móvil.
 * Módulo: pruebas de acceso. Servicios interceptados, sin identidades reales.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { CLAVE, simular } from './ayudas-fase2'

async function revisarPantalla(page: Page, isMobile: boolean, info: TestInfo, nombre: string) {
  const vistas = isMobile ? [[360, 640], [390, 844], [320, 640], [428, 926]] : [[1366, 768], [1280, 720], [1366, 640], [1100, 640], [768, 640], [1024, 768], [1920, 1080]]
  for (const [width, height] of vistas) {
    await page.setViewportSize({ width, height })
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0) })
    const medidas = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, alto: document.documentElement.scrollHeight, anchoDisponible: innerWidth, altoDisponible: innerHeight }))
    const contexto = JSON.stringify({ nombre, width, height, medidas })
    expect(medidas.ancho, contexto).toBeLessThanOrEqual(medidas.anchoDisponible)
    if (!isMobile) {
      const tarjeta = await page.locator('section').filter({ has: page.locator('form') }).boundingBox()
      expect(tarjeta?.width, contexto).toBeLessThanOrEqual(460)
      if (width === 1366 && height === 640) await page.screenshot({ path: info.outputPath(`${nombre}.png`), scale: 'css' })
      expect(medidas.alto, contexto).toBeLessThanOrEqual(medidas.altoDisponible + 1)
      for (const accion of await page.locator('form button, form a').all()) await expect(accion, contexto).toBeInViewport()
    } else {
      await expect(page.getByRole('complementary', { name: 'CuidaRed', exact: true })).toBeHidden()
      expect(medidas.alto, contexto).toBeLessThanOrEqual(medidas.altoDisponible * 2)
      if (width === 390) await page.screenshot({ path: info.outputPath(`${nombre}-movil.png`), fullPage: true, scale: 'css' })
    }
    await expect(page.locator('section > header button')).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: 'Navegación pública' })).toHaveCount(0)
    const campos = await page.locator('input:not([type="checkbox"]):not([type="radio"]), select').evaluateAll((items) => items.map((campo) => ({ alto: campo.getBoundingClientRect().height, letra: parseFloat(getComputedStyle(campo).fontSize) })))
    expect(campos.every((campo) => campo.alto >= 48 && campo.letra >= 16), contexto).toBe(true)
  }
}

test('el login conserva su diseño y permite ver todos los controles', async ({ page, isMobile }, info) => {
  await page.route('http://localhost:3301/**', async (route) => {
    const request = route.request()
    const headers = {
      'access-control-allow-origin': request.headers().origin ?? 'http://localhost:5174',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'POST,GET,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
    }
    if (new URL(request.url()).pathname.startsWith('/api/v1/session/browser/')) await route.fulfill({ status: 204, headers })
    else await route.fulfill({ status: 200, headers, json: { data: {} } })
  })
  const vistas = isMobile ? [[360, 640], [390, 844], [320, 640], [428, 926]] : [[1366, 768], [1280, 720], [1366, 640], [1100, 640], [768, 640], [1024, 768], [1920, 1080]]
  for (const [width, height] of vistas) {
    await page.setViewportSize({ width, height })
    await page.goto('/inicio')
    await expect(page.getByLabel(/^Correo electrónico/)).toBeVisible()
    await page.evaluate(async () => { await document.fonts.ready })
    await expect.poll(() => page.getByRole('img', { name: 'CuidaRed', exact: true }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    const medidas = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, alto: document.documentElement.scrollHeight, anchoDisponible: innerWidth, altoDisponible: innerHeight }))
    expect(medidas.ancho, JSON.stringify({ width, height, medidas })).toBeLessThanOrEqual(medidas.anchoDisponible)
    expect(medidas.alto, JSON.stringify({ width, height, medidas })).toBeLessThanOrEqual(medidas.altoDisponible + 1)
    for (const name of ['¿Olvidaste tu contraseña?', 'Activar cuenta', 'Crear cuenta', 'Términos', 'Privacidad']) await expect(page.getByRole('link', { name, exact: true })).toBeInViewport({ ratio: 1 })
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeInViewport({ ratio: 1 })
    if (!isMobile) {
      if (width === 1366) await page.screenshot({ path: info.outputPath(`login-${width}-${height}.png`), scale: 'css' })
    } else {
      await expect(page.getByRole('complementary', { name: 'CuidaRed', exact: true })).toBeHidden()
      await page.screenshot({ path: info.outputPath(`login-${width}-${height}-movil.png`), scale: 'css' })
      if (width === 390) await page.screenshot({ path: info.outputPath('login-movil.png'), fullPage: true, scale: 'css' })
    }
    const flecha = page.getByRole('link', { name: 'Volver a la portada', exact: true })
    await expect(flecha).toHaveText('')
    await expect(page.locator('img[src*="/portada/"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Pausar fotos|Reanudar fotos/ })).toHaveCount(0)
    const activar = await page.getByRole('link', { name: 'Activar cuenta', exact: true }).boundingBox()
    const crear = await page.getByRole('link', { name: 'Crear cuenta', exact: true }).boundingBox()
    expect(activar).not.toBeNull()
    expect(crear).not.toBeNull()
    expect(Math.abs(activar!.y - crear!.y)).toBeLessThanOrEqual(1)
    expect(activar!.x + activar!.width).toBeLessThan(crear!.x)
    expect(activar!.height).toBeGreaterThanOrEqual(48)
    expect(crear!.height).toBeGreaterThanOrEqual(48)
    const logo = await page.getByRole('img', { name: 'CuidaRed', exact: true }).boundingBox()
    if (isMobile) expect(logo!.y + logo!.height).toBeLessThanOrEqual(190)
    const campos = await page.locator('input').evaluateAll((items) => items.map((input) => ({ alto: input.getBoundingClientRect().height, letra: parseFloat(getComputedStyle(input).fontSize) })))
    expect(campos.every((campo) => campo.alto >= 48 && campo.letra >= 16)).toBe(true)
  }
})

test('el login permite enfocar los campos con una ventana reducida y mostrar errores', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Comprobación del acceso móvil con teclado en pantalla.')
  await simular(page)
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/inicio')
  await page.getByLabel(/^Correo electrónico/).fill('correo-invalido')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByLabel(/^Correo electrónico/)).toBeFocused()
  await page.setViewportSize({ width: 360, height: 340 })
  await page.getByLabel(/^Contraseña/).focus()
  await page.getByLabel(/^Contraseña/).fill('clave-de-prueba')
  await expect(page.getByLabel(/^Contraseña/)).toBeInViewport()
  await page.getByRole('link', { name: 'Crear cuenta', exact: true }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('link', { name: 'Crear cuenta', exact: true })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-top', '24px')
    document.documentElement.style.setProperty('--safe-bottom', '20px')
    window.scrollTo(0, 0)
  })
  const volver = await page.getByRole('link', { name: 'Volver a la portada', exact: true }).boundingBox()
  expect(volver!.y).toBeGreaterThanOrEqual(24)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(845)
  await expect(page.getByRole('link', { name: 'Privacidad', exact: true })).toBeInViewport({ ratio: 1 })
  await page.route('https://auth.cuidared.test/auth/v1/token**', (route) => route.fulfill({ status: 400, json: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }))
  await page.getByLabel(/^Correo electrónico/).fill('ana@example.test')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.')
})

for (const tipo of ['Familia', 'Organización']) {
  test(`el registro de ${tipo} aprovecha el espacio en sus cinco pasos`, async ({ page, isMobile }, info) => {
    await simular(page)
    await page.goto('/crear-cuenta')
    await expect(page.getByRole('heading', { name: 'Crear una cuenta', exact: true })).toBeVisible()
    await revisarPantalla(page, isMobile, info, 'registro-tipo')
    await page.getByRole('radio', { name: tipo, exact: true }).check()
    await revisarPantalla(page, isMobile, info, 'registro-tipo-elegido')
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await revisarPantalla(page, isMobile, info, 'registro-datos')
    await page.getByLabel(/^Cédula/).fill('00112345678')
    await page.getByLabel(/^Nombres/).fill('Ana')
    await page.getByLabel(/^Apellidos/).fill('Pérez')
    await page.getByLabel(/^Correo electrónico/).fill('ana@example.test')
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await revisarPantalla(page, isMobile, info, 'registro-clave')
    await page.getByLabel(/^Contraseña/).fill(CLAVE)
    await page.getByLabel(/^Confirmar contraseña/).fill(CLAVE)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Registrarme', exact: true }).click()
    await expect(page.getByLabel(/^Código de verificación/)).toBeVisible()
    await revisarPantalla(page, isMobile, info, 'registro-codigo')
    await page.getByLabel(/^Código de verificación/).fill('123456')
    await page.getByRole('button', { name: 'Verificar correo', exact: true }).click()
    await expect(page.getByLabel(/^Provincia/)).toBeEnabled()
    await revisarPantalla(page, isMobile, info, 'registro-cuenta')
  })
}

test('recuperar y restablecer contraseña caben en escritorio', async ({ page, isMobile }, info) => {
  await simular(page)
  await page.goto('/recuperar')
  await expect(page.getByLabel(/^Correo electrónico/)).toBeVisible()
  await revisarPantalla(page, isMobile, info, 'recuperar')
  await page.getByLabel(/^Correo electrónico/).fill('ana@example.test')
  await page.getByRole('button', { name: 'Enviar código', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Si el correo pertenece a una cuenta')
  await revisarPantalla(page, isMobile, info, 'recuperar-enviado')
  await page.goto('/restablecer')
  await expect(page.getByLabel(/^Nueva contraseña/)).toBeVisible()
  await revisarPantalla(page, isMobile, info, 'restablecer')
})

test('los tres pasos de la invitación caben en escritorio', async ({ page, isMobile }, info) => {
  await simular(page)
  await page.goto('/registro')
  await expect(page.getByLabel(/^Código de invitación/)).toBeVisible()
  await revisarPantalla(page, isMobile, info, 'invitacion-codigo')
  await page.getByLabel(/^Correo electrónico/).fill('ana@example.test')
  await page.getByLabel(/^Código de invitación/).fill('123456')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByLabel(/^Nombres/)).toBeVisible()
  await revisarPantalla(page, isMobile, info, 'invitacion-datos')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByLabel(/^Confirmar contraseña/)).toBeVisible()
  await revisarPantalla(page, isMobile, info, 'invitacion-clave')
})
