/* Rediseño PWA: datos del servidor, alcance por cuenta, ayuda solo visual y ajuste adaptable. */
import { expect, test, type Page } from '@playwright/test'
import { API, cuentaActiva, iniciarSesion, simular, suscripcionDePrueba } from './ayudas-fase2'

const raiz = '/operacion/25'
const apiCuenta = `${API}/api/v1/cuentas/25`
const permisos = ['adultos:ver', 'necesidades:ver', 'resumen:ver', 'alertas:ver', 'visitas:ver', 'visitas:autorizar', 'usuarios:gestionar', 'organizacion:configurar', 'cuenta:suscripcion']
const indicadores = { fecha_calculo: '2026-11-25', umbral_dias_sin_visita: 21, casos_activos: 37, alertas_abiertas: 9, necesidades_activas: 6, seguimiento_vencido: 4 }
const adulto = { envejeciente_id: '11111111-1111-4111-8111-111111111111', nombres: 'Juana', apellidos: 'Prueba', estado: 'activo', zona: 'Centro', municipio_nombre: 'Distrito Nacional' }
const pagina = (total: number, data: unknown[] = []) => ({ data, meta: { page: 1, limit: 1, total, totalPages: total } })

async function preparar(page: Page, familia = false) {
  const consultas: string[] = []
  const cuenta = cuentaActiva({ cuenta_id: '25', nombre: 'Fundación Esperanza', tipo: familia ? 'familia' : 'organizacion', permisos })
  const sim = await simular(page, { cuentas: [cuenta], suscripciones: { '25': suscripcionDePrueba(2, { prueba: { vigente: true, dias_restantes: 2, fecha_fin: '2026-11-27T12:00:00Z' } }) } })
  await page.route(apiCuenta, ruta => ruta.fulfill({ json: { data: { cuenta: { ...cuenta, fecha_creacion: '2026-11-25T12:00:00Z', categoria: { nombre: 'Fundación u ONG' }, municipio: { nombre: 'Santo Domingo', provincia: 'Distrito Nacional' } } } } }))
  await page.route(`${apiCuenta}/**`, async ruta => {
    const url = new URL(ruta.request().url())
    consultas.push(url.pathname)
    if (url.pathname.endsWith('/contexto')) return ruta.fulfill({ json: { data: cuenta } })
    if (url.pathname.endsWith('/resumen-casos/indicadores')) return ruta.fulfill({ json: { data: { ...indicadores, umbral_dias_sin_visita: familia ? null : 21 } } })
    if (url.pathname.endsWith('/visitas')) return ruta.fulfill({ json: pagina(3) })
    if (url.pathname.endsWith('/solicitudes-visita')) return ruta.fulfill({ json: pagina(2) })
    if (url.pathname.endsWith('/notificaciones-alerta')) return ruta.fulfill({ json: pagina(1) })
    if (url.pathname.endsWith('/casos-prioritarios')) return ruta.fulfill({ json: pagina(1, [{ ...adulto, total_alertas: 2, alertas: [{ descripcion: 'Revisar seguimiento del cuidado' }] }]) })
    if (url.pathname.endsWith('/envejecientes')) return ruta.fulfill({ json: pagina(1, [adulto]) })
    return ruta.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await expect(page.getByRole('heading', { name: 'Hola, Laura' })).toBeVisible()
  return { consultas, sim }
}

test('el inicio muestra valores reales, umbral configurado y enlaces de seguimiento', async ({ page }) => {
  await preparar(page)
  const resumen = page.getByRole('list', { name: 'Indicadores de hoy' })
  await expect(resumen.getByRole('link', { name: /Alertas abiertas/ })).toContainText('9')
  await expect(resumen.getByRole('link', { name: /Envejecientes activos/ })).toContainText('37')
  await expect(resumen.getByRole('link', { name: /Necesidades activas/ })).toContainText('6')
  await expect(resumen.getByRole('link', { name: /Visitas programadas hoy/ })).toContainText('3')
  await expect(page.getByRole('link', { name: /Sin visita reciente/ })).toContainText('Más de 21 días sin contacto')
  await expect(page.getByRole('link', { name: /Solicitudes de visita Esperan tu revisión/ })).toContainText('2')
  await expect(page.getByRole('link', { name: /Juana Prueba Revisar/ })).toHaveAttribute('href', `${raiz}/alertas?bandeja=alertas&adulto=${adulto.envejeciente_id}`)
  await expect(page.getByRole('link', { name: 'Ver planes', exact: true })).toHaveAttribute('href', `${raiz}/suscripcion`)
})

test('la cuenta familia no consulta ni ofrece visitas aunque reciba un permiso heredado', async ({ page }) => {
  const { consultas } = await preparar(page, true)
  await expect(page.getByRole('list', { name: 'Indicadores de hoy' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Visitas programadas hoy|Solicitudes de visita|Sin visita reciente/ })).toHaveCount(0)
  expect(consultas.some(url => /\/(visitas|solicitudes-visita)$/.test(url))).toBe(false)
})

test('ayuda presenta seis opciones inactivas y devuelve el foco al cerrar', async ({ page }) => {
  await preparar(page)
  const peticiones: string[] = []
  page.on('request', solicitud => peticiones.push(solicitud.url()))
  const rutaInicial = page.url()
  const abrir = page.getByRole('button', { name: 'Abrir ayuda de CuidaRed' })
  await abrir.click()
  const ayuda = page.getByRole('dialog', { name: 'Opciones de ayuda' })
  for (const nombre of ['Aprende a usar CuidaRed', 'Preguntas frecuentes', 'Cambiar idioma', 'Contactar soporte', 'Modo claro u oscuro', 'Accesibilidad']) {
    await expect(ayuda.getByRole('button', { name: `${nombre} · próximamente` })).toBeDisabled()
  }
  await expect(ayuda.getByRole('button', { name: 'Cerrar ayuda' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(ayuda.getByRole('button', { name: 'Cerrar ayuda' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(ayuda).toHaveCount(0)
  await expect(abrir).toBeFocused()
  expect(page.url()).toBe(rutaInicial)
  expect(peticiones.some(url => /soporte|theme|idioma|accesibilidad/.test(url))).toBe(false)
})

test('inicio, ayuda, adultos y perfil se ajustan a móvil, tableta y escritorio', async ({ page }, testInfo) => {
  await preparar(page)
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.evaluate(() => document.fonts.ready)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await expect(page.getByRole('list', { name: 'Indicadores de hoy' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`inicio-${width}.png`), fullPage: true, scale: 'css' })
    await page.getByRole('button', { name: 'Abrir ayuda de CuidaRed' }).click()
    const ayuda = page.getByRole('dialog', { name: 'Opciones de ayuda' })
    await expect(ayuda.getByRole('button', { name: 'Accesibilidad · próximamente' })).toBeInViewport()
    await expect(ayuda.getByRole('button', { name: 'Cerrar ayuda' })).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath(`ayuda-${width}.png`), scale: 'css' })
    await page.keyboard.press('Escape')
  }
  await expect.poll(() => page.locator('[data-icon="elderly"]').first().evaluate(el => getComputedStyle(el).fontFamily)).toContain('Material Symbols Outlined')
  await expect.poll(() => page.getByRole('heading', { name: 'Hola, Laura' }).evaluate(el => getComputedStyle(el).fontFamily)).toContain('Montserrat')
  await page.setViewportSize({ width: 360, height: 640 })
  await page.getByRole('navigation', { name: 'Módulos de la cuenta' }).getByRole('link', { name: 'Adultos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Juana Prueba' })).toBeVisible()
  await expect.poll(() => page.getByRole('banner').getByRole('heading', { name: 'Envejecientes', exact: true }).evaluate(el => { const rango = document.createRange(); rango.selectNodeContents(el); return rango.getClientRects().length })).toBe(1)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('adultos-360.png'), fullPage: true })
  await page.getByRole('link', { name: 'Mi cuenta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Información personal' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('perfil-360.png'), fullPage: true })
})

test('el menú cabe con texto ampliado y movimiento reducido', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await preparar(page)
  await page.setViewportSize({ width: 360, height: 640 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px')
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.screenshot({ path: testInfo.outputPath('texto-ampliado.png'), scale: 'css' })
  const medidas = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, disponible: document.documentElement.clientWidth, fuera: [...document.querySelectorAll('body *')].filter(el => el.clientWidth > 0 && (el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)).slice(0, 15).map(el => ({ elemento: el.tagName, clase: el.className, ancho: el.clientWidth, scroll: el.scrollWidth, texto: el.textContent?.slice(0, 50) })) }))
  expect(medidas.ancho, JSON.stringify(medidas.fuera)).toBeLessThanOrEqual(medidas.disponible)
  await page.getByRole('button', { name: 'Abrir ayuda de CuidaRed' }).click()
  await expect(page.getByRole('button', { name: 'Cerrar ayuda' })).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Abrir ayuda de CuidaRed' })).toBeFocused()
})
