/*
 * marco-rediseno.spec.ts — Marco de la app conectada tras el rediseño: barra superior y secundaria, barra inferior por rol,
 * hoja «Más» (con Cerrar sesión), ayuda flotante (seis opciones) y sus pantallas, Accesibilidad (tamaño del texto), Notificaciones
 * agrupadas por día y Conexión y sincronización. Corre en el proyecto `desktop`
 * (cada prueba fija su propio ancho). Mocks con page.route, como el resto de las pruebas de acceso.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { expect, test, type Page } from '@playwright/test'
import { API, iniciarSesion } from './ayudas-fase2'
import { cuentaCompleta, cuentaId, montar, ruta, uuid } from './ayudas-responsive'

test.beforeEach(({ browserName: _navegador }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Cada prueba fija su propio viewport.')
  test.setTimeout(90_000)
})

const MOVIL = { width: 390, height: 844 }
const TITULOS = {
  aprende: 'Aprende a usar CuidaRed',
  preguntas: 'Preguntas frecuentes',
  idioma: 'Cambiar idioma',
  soporte: 'Contactar soporte',
  tema: 'Modo claro u oscuro',
  accesibilidad: 'Accesibilidad',
} as const

/** Mediodía local de hace `dias` días: cae siempre en «Hoy» (0), «Ayer» (1) o «Anteriores» (5), sea la hora que sea. */
const haceDias = (dias: number) => {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - dias)
  fecha.setHours(12, 0, 0, 0)
  return fecha.toISOString()
}

const aviso = (n: number, estado: 'no_leida' | 'leida' = 'no_leida', dias = 0) => ({
  notificacion_id: uuid(9100 + n), alerta_envejeciente_id: uuid(8001), mensaje: `Tienes una alerta asignada número ${n}.`,
  estado, fecha_notificacion: haceDias(dias), fecha_lectura: estado === 'leida' ? haceDias(dias) : null,
})

/** Monta la cuenta, simula las notificaciones y abre una sección con el ancho pedido. */
async function abrir(page: Page, seccion: string, { rol = 'coordinador', ancho = MOVIL.width, alto = MOVIL.height }: { rol?: 'administrador' | 'coordinador' | 'cuidador'; ancho?: number; alto?: number } = {}) {
  const cuenta = cuentaCompleta(rol === 'cuidador'
    ? { rol, nombre: 'Cuenta de prueba', es_titular: false, permisos: ['adultos:ver', 'visitas:ver', 'agenda:ver', 'visitas:registrar'] }
    : { rol, nombre: 'Cuenta de prueba' })
  const { sim } = await montar(page, { cuenta })
  const avisos = [aviso(1), aviso(2, 'no_leida', 1), aviso(3, 'leida', 5)]
  await page.route(`${API}/api/v1/cuentas/${cuentaId}/notificaciones-alerta**`, (route) => {
    const { pathname } = new URL(route.request().url())
    if (route.request().method() === 'POST' && pathname.endsWith('/leer')) {
      const id = pathname.split('/').at(-2)
      const encontrado = avisos.find((item) => item.notificacion_id === id)
      if (encontrado) Object.assign(encontrado, { estado: 'leida', fecha_lectura: '2026-11-21T10:00:00Z' })
      return route.fulfill({ json: { data: encontrado } })
    }
    const sinLeer = avisos.filter((item) => item.estado === 'no_leida').length
    const soloSinLeer = new URL(route.request().url()).searchParams.toString().includes('no_leida')
    const data = soloSinLeer ? avisos.filter((item) => item.estado === 'no_leida') : avisos
    return route.fulfill({ json: { data, meta: { page: 1, limit: 20, total: soloSinLeer ? sinLeer : data.length, totalPages: 1 } } })
  })
  await page.setViewportSize({ width: ancho, height: alto })
  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/${seccion}`)
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByText('Consultando…')).toHaveCount(0, { timeout: 10_000 })
}

const barraInferior = (page: Page) => page.getByRole('navigation', { name: 'Módulos de la cuenta' })
const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

test.describe('barra inferior por rol', () => {
  test('administrador: Inicio, Adultos, Miembros y Más', async ({ page }) => {
    await abrir(page, 'cuenta', { rol: 'administrador' })
    const nav = barraInferior(page)
    await expect(nav.getByRole('link')).toHaveText(['Inicio', 'Adultos', 'Miembros'])
    await expect(nav.getByRole('button', { name: 'Más' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('banner').getByRole('heading', { level: 1, name: 'Cuenta de prueba' })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('link', { name: 'Volver' })).toHaveCount(0)
  })

  test('coordinador: Inicio, Adultos, Visitas, Alertas y Más', async ({ page }) => {
    await abrir(page, 'envejecientes', { rol: 'coordinador' })
    const nav = barraInferior(page)
    await expect(nav.getByRole('link')).toHaveText(['Inicio', 'Adultos', 'Visitas', 'Alertas'])
    await expect(nav.getByRole('button', { name: 'Más' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Adultos' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('button', { name: 'Ayuda' })).toBeVisible()
  })

  test('cuidador conserva sus favoritos: Inicio, Adultos, Visitas, Agenda', async ({ page }) => {
    await abrir(page, 'cuenta', { rol: 'cuidador' })
    await expect(barraInferior(page).getByRole('link')).toHaveText(['Inicio', 'Adultos', 'Visitas', 'Agenda'])
  })
})

test.describe('hoja Más', () => {
  test('abre sobre la pantalla actual, lista el resto de módulos y cierra con Escape y con la X', async ({ page }) => {
    await abrir(page, 'envejecientes', { rol: 'administrador' })
    const mas = barraInferior(page).getByRole('button', { name: 'Más' })
    await mas.click()
    const hoja = page.getByRole('dialog', { name: 'Más opciones' })
    await expect(hoja).toBeVisible()
    await expect(page).toHaveURL(`${ruta}/envejecientes`)
    await expect(hoja.getByRole('link', { name: 'Visitas' })).toBeVisible()
    await expect(hoja.getByRole('link', { name: 'Reportes' })).toBeVisible()
    await expect(hoja.getByRole('link', { name: 'Miembros' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(hoja).toHaveCount(0)
    await expect(mas).toBeFocused()
    await mas.click()
    await hoja.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await expect(hoja).toHaveCount(0)
    await expect(mas).toBeFocused()
    await mas.click()
    await hoja.getByRole('link', { name: 'Reportes' }).click()
    await expect(page).toHaveURL(`${ruta}/reportes`)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('el enlace directo /mas abre la hoja sobre Inicio y al cerrar vuelve a Inicio', async ({ page }) => {
    await abrir(page, 'mas', { rol: 'administrador' })
    const hoja = page.getByRole('dialog', { name: 'Más opciones' })
    await expect(hoja).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(hoja).toHaveCount(0)
    await expect(page).toHaveURL(`${ruta}/cuenta`)
    await expect(barraInferior(page).getByRole('button', { name: 'Más' })).toBeFocused()
  })
})

test.describe('hoja Más: cuenta', () => {
  for (const rol of ['administrador', 'coordinador'] as const) {
    test(`${rol}: grupos, Mi perfil y Cerrar sesión`, async ({ page }) => {
      await abrir(page, 'cuenta', { rol })
      await barraInferior(page).getByRole('button', { name: 'Más' }).click()
      const hoja = page.getByRole('dialog', { name: 'Más opciones' })
      const grupos = hoja.getByRole('heading', { level: 3 })
      await expect(grupos.first()).toHaveText('Seguimiento')
      await expect(grupos.last()).toHaveText('Cuenta')
      // Coordinador: Reportes va en Seguimiento; administrador: en Administración (Figma 02).
      const grupoDeReportes = rol === 'administrador' ? 'Administración' : 'Seguimiento'
      await expect(hoja.getByRole('region', { name: grupoDeReportes }).getByRole('link', { name: 'Reportes' })).toBeVisible()
      await expect(hoja.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', '/cuenta')
      const cerrar = hoja.getByRole('region', { name: 'Cuenta' }).getByRole('button', { name: 'Cerrar sesión' })
      await expect(cerrar).toBeVisible()
      const alto = await cerrar.boundingBox()
      expect(alto && alto.height).toBeGreaterThanOrEqual(48)
      const cierre = page.waitForRequest((peticion) => peticion.url().endsWith('/session/logout') && peticion.method() === 'POST')
      await cerrar.click()
      await cierre
      await expect(page).toHaveURL(/\/inicio/)
    })
  }

  test('Mi perfil abre la pantalla de perfil', async ({ page }) => {
    await abrir(page, 'cuenta', { rol: 'administrador' })
    await barraInferior(page).getByRole('button', { name: 'Más' }).click()
    await page.getByRole('dialog', { name: 'Más opciones' }).getByRole('link', { name: 'Mi perfil' }).click()
    await expect(page).toHaveURL(/\/cuenta$/)
    await expect(page.getByRole('banner').getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible()
  })
})

test.describe('ayuda flotante', () => {
  test('abre con seis opciones, cierra con Escape y con la X, y devuelve el foco al botón', async ({ page }) => {
    await abrir(page, 'cuenta')
    const fab = page.getByRole('button', { name: 'Ayuda', exact: true })
    await expect(fab).toHaveAttribute('aria-expanded', 'false')
    await fab.click()
    const menu = page.getByRole('dialog', { name: 'Ayuda' })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('link')).toHaveText(Object.values(TITULOS))
    await expect(menu.getByRole('link')).toHaveCount(6)
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(fab).toBeFocused()
    await fab.click()
    await menu.getByRole('button', { name: 'Cerrar ayuda' }).click()
    await expect(menu).toHaveCount(0)
    await expect(fab).toBeFocused()
  })

  test('el botón queda 16 px sobre la barra inferior y a 24 px del borde en pantallas anchas', async ({ page }) => {
    await abrir(page, 'cuenta')
    const fab = page.getByRole('button', { name: 'Ayuda', exact: true })
    const nav = await barraInferior(page).boundingBox()
    const caja = await fab.boundingBox()
    expect(nav && caja && Math.round(nav.y - (caja.y + caja.height))).toBe(16)
    await page.setViewportSize({ width: 1440, height: 900 })
    const ancha = await fab.boundingBox()
    expect(ancha && [Math.round(1440 - (ancha.x + ancha.width)), Math.round(900 - (ancha.y + ancha.height))]).toEqual([24, 24])
  })

  for (const [id, titulo] of Object.entries(TITULOS)) {
    test(`la opción «${titulo}» abre su pantalla secundaria`, async ({ page }) => {
      await abrir(page, 'cuenta')
      await page.getByRole('button', { name: 'Ayuda', exact: true }).click()
      await page.getByRole('dialog', { name: 'Ayuda' }).getByRole('link', { name: titulo }).click()
      await expect(page).toHaveURL(`${ruta}/${id}`)
      const cabecera = page.getByRole('banner')
      await expect(cabecera.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
      await expect(cabecera.getByRole('link', { name: 'Volver' })).toBeVisible()
      await expect(barraInferior(page)).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Ayuda', exact: true })).toHaveCount(0)
        // Volver regresa a la pantalla desde la que se abrió la ayuda.
      await cabecera.getByRole('link', { name: 'Volver' }).click()
      await expect(page).toHaveURL(`${ruta}/cuenta`)
      await expect(barraInferior(page)).toBeVisible()
    })
  }

  test('Aprende filtra por búsqueda y categoría y abre cada guía; Preguntas filtra y es un acordeón', async ({ page }) => {
    await abrir(page, 'aprende')
    const articulos = page.getByRole('region', { name: 'Artículos de ayuda' })
    // «Lo más consultado»: las cuatro guías del Figma, sin video (no hay videos tutoriales).
    await expect(articulos.getByRole('link')).toHaveCount(4)
    await expect(articulos.getByRole('link').first()).toContainText('Cómo registrar una visita')
    const buscar = page.getByRole('searchbox', { name: 'Buscar en la ayuda' })
    await buscar.fill('abreviaturas')
    await expect(articulos.getByRole('link')).toHaveCount(1)
    await buscar.fill('zzzzz')
    await expect(articulos.getByRole('link')).toHaveCount(0)
    await expect(articulos.getByRole('status')).toBeVisible()
    await buscar.fill('')
    const temas = page.getByRole('group', { name: 'Categorías de ayuda' })
    await expect(temas.getByRole('button', { name: /Agenda y tareas/ })).toHaveCount(0)
    await temas.getByRole('button', { name: /^Visitas/ }).click()
    await expect(temas.getByRole('button', { name: /^Visitas/ })).toContainText('2 guías')
    await expect(articulos.getByRole('link')).toHaveCount(2)
    await articulos.getByRole('link', { name: /registrar una visita/ }).click()
    await expect(page).toHaveURL(`${ruta}/aprende?guia=registrar-visita`)
    // Guía (Figma 14): tema, título, pasos numerados, consejo y «¿Te sirvió esta guía?».
    await expect(page.getByRole('heading', { level: 2, name: 'Cómo registrar una visita' })).toBeVisible()
    await expect(page.getByRole('article').getByRole('listitem')).toHaveCount(5)
    await expect(page.getByText('registra también una necesidad')).toBeVisible()
    await page.getByRole('button', { name: 'Sí' }).click()
    await expect(page.getByRole('button', { name: 'Sí' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('banner').getByRole('link', { name: 'Volver' }).click()
    await expect(page).toHaveURL(`${ruta}/aprende`)
    await expect(page.getByRole('searchbox', { name: 'Buscar en la ayuda' })).toBeVisible()

    await page.goto(`${ruta}/preguntas`)
    const pregunta = page.getByRole('button', { name: /No veo a una persona/ })
    await expect(pregunta).toHaveAttribute('aria-expanded', 'false')
    await pregunta.click()
    await expect(pregunta).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('Pide al coordinador que te la asigne.')).toBeVisible()
    await pregunta.click()
    await expect(pregunta).toHaveAttribute('aria-expanded', 'false')
    // Búsqueda y categorías.
    await page.getByRole('searchbox', { name: 'Buscar una pregunta' }).fill('plan')
    await expect(page.getByRole('button', { name: /¿Cómo cambio de plan\?/ })).toBeVisible()
    await expect(pregunta).toHaveCount(0)
    await page.getByRole('searchbox', { name: 'Buscar una pregunta' }).fill('')
    await page.getByRole('group', { name: 'Categorías de preguntas' }).getByRole('button', { name: 'Plan y pagos' }).click()
    await expect(page.getByRole('button', { name: /¿Los pagos son reales\?/ })).toBeVisible()
    await expect(pregunta).toHaveCount(0)
    await page.getByRole('link', { name: /No encontraste tu respuesta/ }).click()
    await expect(page).toHaveURL(`${ruta}/soporte`)
  })

  test('Idioma: solo Español está seleccionado y los demás dicen Próximamente', async ({ page }) => {
    await abrir(page, 'idioma')
    const lista = page.getByRole('list', { name: 'Idiomas' })
    await expect(lista.getByRole('listitem').filter({ hasText: 'Español' })).toContainText('seleccionado')
    const otros = lista.getByRole('listitem').filter({ hasNotText: 'Español' })
    await expect(otros).not.toHaveCount(0)
    for (const item of await otros.all()) {
      await expect(item).toContainText('Próximamente')
      await expect(item).toHaveAttribute('aria-disabled', 'true')
    }
  })

  test('Modo claro u oscuro: Claro seleccionado; Oscuro y Según el sistema dicen Próximamente', async ({ page }) => {
    await abrir(page, 'tema')
    const lista = page.getByRole('list', { name: 'Modo de color' })
    await expect(lista.getByRole('listitem')).toHaveCount(3)
    await expect(lista.getByRole('listitem').filter({ hasText: 'Claro' })).toContainText('seleccionado')
    for (const nombre of ['Oscuro', 'Según el sistema']) {
      const item = lista.getByRole('listitem').filter({ hasText: nombre })
      await expect(item).toContainText('Próximamente')
      await expect(item).toHaveAttribute('aria-disabled', 'true')
    }
  })

  test('Accesibilidad: Tamaño del texto cambia el font-size de <html>, se recuerda y no va en la URL', async ({ page }) => {
    await abrir(page, 'accesibilidad')
    const html = page.locator('html')
    const clave = 'cuidared.accesibilidad.tamano-texto'
    const guardado = () => page.evaluate((k) => localStorage.getItem(k), clave)
    const opcion = (nombre: string) => page.locator('label').filter({ hasText: nombre })
    const texto = page.getByText('Elige un tamaño más cómodo')
    await expect(page.getByRole('radio', { name: /^Normal/ })).toBeChecked()
    await expect(html).toHaveCSS('font-size', '16px')
    await expect(texto).toHaveCSS('font-size', '16px')

    await opcion('Grande').filter({ hasNotText: 'Muy' }).click()
    await expect(page.getByRole('radio', { name: /^Grande/ })).toBeChecked()
    await expect(html).toHaveAttribute('style', /font-size:\s*112\.5%/)
    await expect(html).toHaveCSS('font-size', '18px')
    await expect(texto).toHaveCSS('font-size', '18px')
    expect(await guardado()).toBe('grande')
    expect(page.url()).not.toMatch(/tamano|texto|grande/i)

    await opcion('Muy grande').click()
    await expect(html).toHaveAttribute('style', /font-size:\s*125%/)
    await expect(html).toHaveCSS('font-size', '20px')
    await expect(texto).toHaveCSS('font-size', '20px')
    expect(await guardado()).toBe('muy-grande')

    // Se aplica al iniciar la app (recarga) y en las demás pantallas.
    await page.reload()
    await expect(page.getByRole('radio', { name: /^Muy grande/ })).toBeChecked()
    await expect(html).toHaveCSS('font-size', '20px')
    await page.goto(`${ruta}/cuenta`)
    await expect(html).toHaveCSS('font-size', '20px')

    await page.goto(`${ruta}/accesibilidad`)
    await opcion('Normal').click()
    await expect(html).toHaveCSS('font-size', '16px')
    expect(await guardado()).toBeNull()
  })

  test('Soporte: con el correo sin configurar muestra el formulario con un aviso y no abre ningún correo', async ({ page }) => {
    await abrir(page, 'soporte')
    // Las pruebas corren sin VITE_CONTACTO_EMAIL: no se usa una dirección inventada.
    await expect(page.getByText('El correo de soporte todavía no está configurado')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Algo no funciona' })).toBeChecked()
    for (const tema of ['Mi cuenta y acceso', 'Plan y pagos', 'Otra cosa']) await expect(page.getByRole('radio', { name: tema })).toBeVisible()
    await page.getByLabel(/^Asunto/).fill('No veo a una persona')
    await page.getByLabel(/^Mensaje/).fill('Necesito que me asignen a Juana.')
    await expect(page.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled()
    await expect(page.getByRole('heading', { name: 'Tu mensaje está listo' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page).toHaveURL(`${ruta}/cuenta`)
  })
})

test.describe('pantallas secundarias', () => {
  test('un módulo fuera de las pestañas muestra volver + título y no tiene barra inferior ni ayuda', async ({ page }) => {
    await abrir(page, 'reportes', { rol: 'administrador' })
    const cabecera = page.getByRole('banner')
    await expect(cabecera.getByRole('heading', { level: 1, name: 'Reportes y estadísticas' })).toBeVisible()
    await expect(cabecera.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', `${ruta}/cuenta`)
    await expect(cabecera.getByRole('link', { name: 'Mi cuenta' })).toHaveCount(0)
    await expect(barraInferior(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ayuda', exact: true })).toHaveCount(0)
  })

  test('en pantallas anchas Volver, título y acciones están en la cabecera de contenido y la ayuda sigue abajo a la derecha', async ({ page }) => {
    await abrir(page, 'reportes', { rol: 'administrador', ancho: 1440, alto: 900 })
    const cabecera = page.getByRole('banner')
    await expect(cabecera.getByRole('link', { name: 'Volver' })).toBeVisible()
    await expect(cabecera.getByRole('link', { name: /Notificaciones/ })).toBeVisible()
    await expect(cabecera.getByRole('link', { name: /Conexión y sincronización/ })).toBeVisible()
    await expect(cabecera.getByRole('link', { name: 'Mi cuenta' })).toBeVisible()
    await page.goto(`${ruta}/cuenta`)
    const menu = barraInferior(page)
    await expect(menu).toHaveCount(1)
    await expect(menu.getByRole('link', { name: 'Reportes', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ayuda', exact: true })).toBeVisible()
  })

  test('la campana abre Notificaciones agrupadas por día; tocar una tarjeta la marca como leída y abre la alerta', async ({ page }) => {
    await abrir(page, 'cuenta')
    const campana = page.getByRole('banner').getByRole('link', { name: 'Notificaciones, 2 sin leer' })
    await campana.click()
    await expect(page).toHaveURL(`${ruta}/notificaciones`)
    const region = page.getByRole('region', { name: 'Notificaciones de alertas' })
    // Fecha de cada aviso: hoy, ayer y hace cinco días (ver `haceDias`).
    await expect(region.getByRole('heading', { level: 2 })).toHaveText(['Hoy', 'Ayer', 'Anteriores'])
    await expect(region.getByRole('region', { name: 'Hoy' }).getByText('Tienes una alerta asignada número 1.')).toBeVisible()
    await expect(region.getByRole('region', { name: 'Ayer' }).getByText('Tienes una alerta asignada número 2.')).toBeVisible()
    await expect(region.getByRole('region', { name: 'Anteriores' }).getByText('Tienes una alerta asignada número 3.')).toBeVisible()
    await expect(region.getByRole('region', { name: 'Ayer' })).toContainText(/Ayer, \d{2}:\d{2} [ap]\.m\./)
    // Filtros con conteo. No existe ruta de «marcar todas como leídas» en el servidor: no hay botón.
    await expect(region.getByRole('button', { name: 'Todas (3)' })).toHaveAttribute('aria-pressed', 'true')
    await expect(region.getByRole('button', { name: 'Sin leer (2)' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Marcar todas/ })).toHaveCount(0)
    // Cada tarjeta con alerta es un botón (tocarla abre la alerta).
    await expect(region.getByRole('list').getByRole('button')).toHaveCount(3)
    await region.getByRole('button', { name: 'Sin leer (2)' }).click()
    await expect(region.getByRole('heading', { level: 2 })).toHaveText(['Hoy', 'Ayer'])
    await region.getByRole('button', { name: /^Todas/ }).click()

    const leida = page.waitForRequest((peticion) => peticion.method() === 'POST' && /\/notificaciones-alerta\/[^/]+\/leer$/.test(new URL(peticion.url()).pathname))
    await region.getByRole('button', { name: /número 1\./ }).click()
    await leida
    await expect(page).toHaveURL(`${ruta}/alertas?alerta=${uuid(8001)}`)
    await page.goBack()
    await expect(page).toHaveURL(`${ruta}/notificaciones`)
    await expect(region.getByRole('button', { name: 'Sin leer (1)' })).toBeVisible()
    await page.getByRole('banner').getByRole('link', { name: 'Volver' }).click()
    await expect(page.getByRole('banner').getByRole('link', { name: 'Notificaciones, 1 sin leer' })).toBeVisible()
  })

  test('Notificaciones y Conexión también muestran la ayuda flotante, sin barra inferior', async ({ page }) => {
    await abrir(page, 'notificaciones')
    await expect(page.getByRole('button', { name: 'Ayuda', exact: true })).toBeVisible()
    await expect(barraInferior(page)).toHaveCount(0)
    await page.goto(`${ruta}/conexion`)
    await expect(page.getByRole('button', { name: 'Ayuda', exact: true })).toBeVisible()
  })

  test('el enlace antiguo alertas?bandeja=avisos sigue mostrando la bandeja de avisos', async ({ page }) => {
    await abrir(page, 'alertas?bandeja=avisos')
    await expect(page.getByRole('region', { name: 'Notificaciones de alertas' })).toBeVisible()
  })

  test('Conexión y sincronización refleja el estado de la red', async ({ page }) => {
    await abrir(page, 'cuenta')
    await page.getByRole('banner').getByRole('link', { name: 'Conexión y sincronización: en línea' }).click()
    await expect(page).toHaveURL(`${ruta}/conexion`)
    await expect(page.getByRole('heading', { level: 2, name: 'En línea' })).toBeVisible()
    await expect(page.getByText('Todo está sincronizado. Tus cambios se envían automáticamente.')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Guardado solo en este teléfono/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toBeDisabled()
    await page.context().setOffline(true)
    await expect(page.getByRole('heading', { level: 2, name: 'Sin conexión' })).toBeVisible()
    await expect(page.getByText('Puedes seguir registrando visitas y necesidades')).toBeVisible()
    await page.context().setOffline(false)
    await expect(page.getByRole('heading', { level: 2, name: 'En línea' })).toBeVisible()
  })

  test('Conexión muestra «Espacio usado en este teléfono» con una barra (navigator.storage.estimate)', async ({ page }) => {
    await abrir(page, 'conexion')
    await expect(page.getByRole('heading', { level: 2, name: 'Espacio usado en este teléfono' })).toBeVisible()
    const barra = page.getByRole('progressbar', { name: 'Espacio usado en este teléfono' })
    await expect(barra).toBeVisible()
    await expect(barra).toHaveAttribute('aria-valuemax', '50')
    await expect(page.getByText(/^Registros y fotos$/)).toBeVisible()
    await expect(page.getByText(/\d+(,\d)? de 50 MB/)).toBeVisible()
  })

  test('Conexión: si el navegador no ofrece navigator.storage lo dice en vez de quedarse midiendo', async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true }) })
    await abrir(page, 'conexion')
    await expect(page.getByText('Tu navegador no informa cuánto espacio usa CuidaRed.')).toBeVisible()
    await expect(page.getByRole('progressbar')).toHaveCount(0)
  })
})

test.describe('sin desborde horizontal', () => {
  const SECCIONES = ['cuenta', 'envejecientes', 'mas', 'notificaciones', 'conexion', 'aprende', 'preguntas', 'idioma', 'tema', 'accesibilidad', 'soporte']
  for (const ancho of [320, 390, 768, 1440]) {
    test(`ancho ${ancho}px`, async ({ page }) => {
      test.setTimeout(150_000)
      await abrir(page, 'cuenta', { ancho, alto: ancho >= 1440 ? 900 : 844 })
      const fallos: string[] = []
      for (const seccion of SECCIONES) {
        await page.goto(`${ruta}/${seccion}`)
        await expect(page.getByRole('banner')).toBeVisible()
        await expect(page.getByText('Consultando…')).toHaveCount(0, { timeout: 10_000 })
        if (!(await sinDesborde(page))) fallos.push(seccion)
      }
      await page.goto(`${ruta}/cuenta`)
      await page.getByRole('button', { name: 'Ayuda', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'Ayuda' })).toBeVisible()
      if (!(await sinDesborde(page))) fallos.push('ayuda abierta')
      await page.keyboard.press('Escape')
      expect(fallos, `Desborde horizontal a ${ancho}px en: ${fallos.join(', ')}`).toEqual([])
    })
  }

  test('texto Muy grande a 320 px: las pantallas del marco no se desbordan', async ({ page }) => {
    test.setTimeout(150_000)
    await abrir(page, 'accesibilidad', { ancho: 320 })
    await page.locator('label').filter({ hasText: 'Muy grande' }).click()
    await expect(page.locator('html')).toHaveCSS('font-size', '20px')
    const fallos: string[] = []
    for (const seccion of ['notificaciones', 'conexion', 'aprende', 'aprende?guia=registrar-visita', 'preguntas', 'idioma', 'tema', 'accesibilidad', 'soporte']) {
      await page.goto(`${ruta}/${seccion}`)
      await expect(page.getByRole('banner')).toBeVisible()
      await expect(page.getByText('Consultando…')).toHaveCount(0, { timeout: 10_000 })
      if (!(await sinDesborde(page))) fallos.push(seccion)
    }
    expect(fallos, `Desborde con texto Muy grande en: ${fallos.join(', ')}`).toEqual([])
  })
})
