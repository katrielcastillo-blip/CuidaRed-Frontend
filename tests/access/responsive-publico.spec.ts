/*
 * responsive-publico.spec.ts — Diseño adaptable de las pantallas públicas, de acceso y de cuenta, y del menú operativo.
 * Recorre cada ruta en anchos de teléfono, tablet, portátil y escritorio ancho con Auth y API interceptados.
 * Comprueba: sin desbordamiento horizontal de la página, ningún elemento más ancho que la pantalla (salvo dentro de un
 * contenedor con desplazamiento propio), controles de texto a 16 px en pantallas táctiles, objetivos táctiles de 44 px,
 * navegación principal visible y acciones clave a la vista. Las capturas van a test-results/ (ignorado por git).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { API, cuentaActiva, iniciarSesion, invitacionPendiente, miembro, simular, type MiembroSim } from './ayudas-fase2'

const ANCHOS = [320, 360, 390, 414, 768, 1024, 1280, 1440, 1920]
const ANCHOS_CON_CAPTURA = new Set([320, 768, 1440])

interface Hallazgos {
  paginaAncha: string
  anchos: string[]
  entradasPequenas: string[]
  objetivosPequenos: string[]
}

/** Revisa la página abierta y devuelve lo que se sale de los límites del diseño adaptable. */
async function auditar(page: Page): Promise<Hallazgos> {
  return page.evaluate(() => {
    const ancho = window.innerWidth
    const descripcion = (el: Element) => {
      const clase = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 4).join('.') : ''
      const texto = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
      return `${el.tagName.toLowerCase()}${clase ? '.' + clase : ''} «${texto}»`
    }
    const visible = (el: Element) => {
      const estilo = getComputedStyle(el)
      if (estilo.display === 'none' || estilo.visibility === 'hidden') return false
      const caja = el.getBoundingClientRect()
      if (caja.width === 0 || caja.height === 0) return false
      // Texto solo para lectores de pantalla (sr-only): cajas de 1 px recortadas.
      return !(caja.width <= 1 && caja.height <= 1)
    }
    const decorativo = (el: Element) => !!el.closest('[aria-hidden="true"]')
    // Un ancestro con desplazamiento propio contiene el desbordamiento; uno que solo recorta (hidden/clip) lo oculta.
    const contenido = (el: Element) => {
      for (let padre = el.parentElement; padre && padre !== document.body; padre = padre.parentElement) {
        const x = getComputedStyle(padre).overflowX
        if (x === 'auto' || x === 'scroll') return true
        if (x === 'hidden' || x === 'clip') return decorativo(el)
      }
      return false
    }

    const anchos: string[] = []
    for (const el of document.body.querySelectorAll('*')) {
      if (!visible(el) || el.closest('svg') !== null && el.tagName.toLowerCase() !== 'svg') continue
      const caja = el.getBoundingClientRect()
      if ((caja.right > ancho + 1 || caja.left < -1) && !contenido(el) && getComputedStyle(el).position !== 'fixed') {
        anchos.push(`${descripcion(el)} [${Math.round(caja.left)}→${Math.round(caja.right)} de ${ancho}]`)
      }
    }

    const tactil = ancho <= 768
    const entradasPequenas: string[] = []
    const objetivosPequenos: string[] = []
    if (tactil) {
      for (const el of document.querySelectorAll('input, select, textarea')) {
        const tipo = (el as HTMLInputElement).type
        if (['checkbox', 'radio', 'hidden', 'file', 'range', 'submit', 'button'].includes(tipo) || !visible(el)) continue
        if (parseFloat(getComputedStyle(el).fontSize) < 16) entradasPequenas.push(descripcion(el))
      }
      for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"]')) {
        const tipo = (el as HTMLInputElement).type
        if (!visible(el) || tipo === 'hidden' || el.closest('.sr-only')) continue
        // Enlaces dentro de un párrafo y casillas con su rótulo no se miden aparte (WCAG: texto en línea).
        if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') continue
        if (['checkbox', 'radio'].includes(tipo) && el.closest('label')) continue
        const caja = el.getBoundingClientRect()
        if (caja.height < 44 || caja.width < 44) objetivosPequenos.push(`${descripcion(el)} ${Math.round(caja.width)}×${Math.round(caja.height)}`)
      }
    }
    const raiz = document.documentElement
    return {
      paginaAncha: raiz.scrollWidth > ancho + 1 ? `scrollWidth ${raiz.scrollWidth} > ${ancho}` : '',
      anchos: [...new Set(anchos)].slice(0, 12),
      entradasPequenas: [...new Set(entradasPequenas)].slice(0, 12),
      objetivosPequenos: [...new Set(objetivosPequenos)].slice(0, 12),
    }
  })
}

type Revision = {
  /** Elemento que identifica que la pantalla cargó y que debe verse dentro de la ventana. */
  listo?: (page: Page) => Locator
  /** Elementos de acción que deben estar visibles en cualquier ancho. */
  acciones?: (page: Page) => Locator[]
  /** Pasos previos a la auditoría (abrir un diálogo, avanzar un paso…). */
  preparar?: (page: Page) => Promise<void>
  /** Pasos al terminar cada ancho (restablecer la conexión, cerrar un diálogo…). */
  limpiar?: (page: Page) => Promise<void>
  /** Comprueba el menú operativo: barra inferior en móvil, menú lateral desde 768 px. */
  menu?: boolean
  /** Comprueba que el diálogo abierto cabe en la ventana y que sus acciones se alcanzan. */
  dialogo?: boolean
}

/** Teléfonos en horizontal: poca altura, donde un diálogo o una barra fija pueden tapar todo. */
const HORIZONTALES: Array<[number, number]> = [[568, 320], [667, 375], [812, 375], [896, 414]]

async function revisarDialogo(page: Page, ancho: number, alto: number) {
  const dialogo = page.getByRole('dialog')
  await expect(dialogo, `diálogo visible a ${ancho}×${alto}`).toBeVisible()
  const caja = (await dialogo.boundingBox())!
  expect.soft(caja.x >= -1 && caja.y >= -1 && caja.x + caja.width <= ancho + 1 && caja.y + caja.height <= alto + 1, `diálogo dentro de la ventana a ${ancho}×${alto} (${JSON.stringify(caja)})`).toBe(true)
  for (const boton of await dialogo.getByRole('button').all()) {
    await boton.scrollIntoViewIfNeeded()
    const c = (await boton.boundingBox())!
    expect.soft(c.x >= -1 && c.x + c.width <= ancho + 1 && c.y >= -1 && c.y + c.height <= alto + 1, `botón del diálogo alcanzable a ${ancho}×${alto} (${JSON.stringify(c)})`).toBe(true)
  }
}

async function dentroDeLaVentana(page: Page, localizador: Locator, etiqueta: string, ancho: number) {
  await expect(localizador.first(), `${etiqueta} visible a ${ancho}px`).toBeVisible()
  const caja = await localizador.first().boundingBox()
  expect.soft(caja && caja.x >= -1 && caja.x + caja.width <= ancho + 1, `${etiqueta} dentro de la ventana a ${ancho}px (${JSON.stringify(caja)})`).toBe(true)
}

async function revisarMenu(page: Page, ancho: number) {
  const nav = page.getByRole('navigation', { name: 'Módulos de la cuenta' })
  await expect(nav, `menú operativo visible a ${ancho}px`).toBeVisible()
  const caja = (await nav.boundingBox())!
  const alto = page.viewportSize()!.height
  if (ancho < 768) {
    expect.soft(Math.abs(caja.y + caja.height - alto) <= 1 && caja.width >= ancho - 1, `barra inferior pegada al borde a ${ancho}px (${JSON.stringify(caja)})`).toBe(true)
    const enlaces = nav.getByRole('link')
    const total = await enlaces.count()
    expect(total, 'la barra inferior tiene al menos dos accesos').toBeGreaterThanOrEqual(2)
    for (let i = 0; i < total; i++) {
      const c = (await enlaces.nth(i).boundingBox())!
      expect.soft(c.x >= -1 && c.x + c.width <= ancho + 1 && c.width >= 44 && c.height >= 44, `acceso ${i} de la barra inferior usable a ${ancho}px (${JSON.stringify(c)})`).toBe(true)
    }
    // El final del contenido no debe quedar tapado por la barra fija.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const principal = (await page.getByRole('main').boundingBox())!
    expect.soft(principal.y + principal.height <= caja.y + 1, `la barra inferior no tapa el final del contenido a ${ancho}px`).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
  } else {
    expect.soft(caja.x <= 1 && caja.width >= 60 && caja.height >= alto - 1, `menú lateral a la izquierda a ${ancho}px (${JSON.stringify(caja)})`).toBe(true)
    const enlaces = nav.getByRole('link')
    const total = await enlaces.count()
    for (let i = 0; i < total; i++) {
      const c = (await enlaces.nth(i).boundingBox())!
      expect.soft(c.x >= 0 && c.x + c.width <= caja.x + caja.width + 1 && c.height >= 44, `acceso ${i} del menú lateral usable a ${ancho}px (${JSON.stringify(c)})`).toBe(true)
    }
  }
}

async function recorrer(page: Page, nombre: string, ruta: string, revision: Revision, tamanos: Array<number | [number, number]> = ANCHOS) {
  for (const tamano of tamanos) {
    const [ancho, alto] = typeof tamano === 'number' ? [tamano, tamano < 768 ? 700 : 900] : tamano
    await page.setViewportSize({ width: ancho, height: alto })
    await page.goto(ruta)
    await page.waitForLoadState('load')
    if (revision.listo) await expect(revision.listo(page), `${nombre} cargó a ${ancho}px`).toBeVisible()
    await revision.preparar?.(page)
    await page.waitForTimeout(150)
    const hallazgos = await auditar(page)
    expect.soft(hallazgos.paginaAncha, `${nombre} @${ancho}: desbordamiento horizontal de la página`).toBe('')
    expect.soft(hallazgos.anchos, `${nombre} @${ancho}: elementos más anchos que la pantalla`).toEqual([])
    expect.soft(hallazgos.entradasPequenas, `${nombre} @${ancho}: campos con letra menor de 16px`).toEqual([])
    expect.soft(hallazgos.objetivosPequenos, `${nombre} @${ancho}: objetivos táctiles menores de 44px`).toEqual([])
    for (const accion of revision.acciones?.(page) ?? []) await dentroDeLaVentana(page, accion, `${nombre}: acción`, ancho)
    if (revision.menu && alto >= 600) await revisarMenu(page, ancho)
    if (revision.dialogo) await revisarDialogo(page, ancho, alto)
    if (typeof tamano === 'number' && ANCHOS_CON_CAPTURA.has(ancho)) {
      const archivo = `test-results/responsive/${nombre.replace(/[^a-z0-9]+/gi, '-')}-${ancho}`
      await page.screenshot({ path: `${archivo}.png`, fullPage: true })
      if (ancho === 320) {
        // Tramos legibles de la página completa, para inspeccionarla sin reducir el tamaño.
        const alto = await page.evaluate(() => document.documentElement.scrollHeight)
        for (let i = 0; i * 900 < Math.min(alto, 5400); i++) {
          await page.screenshot({ path: `${archivo}-t${i}.png`, fullPage: true, clip: { x: 0, y: i * 900, width: 320, height: Math.min(900, alto - i * 900) } })
        }
      }

    }
    await revision.limpiar?.(page)
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  test.skip(testInfo.project.name !== 'desktop', 'El recorrido fija sus propios anchos: basta el proyecto de escritorio.')
  test.setTimeout(180_000)
})

/* ───────────── Datos de prueba ───────────── */

const CUENTA_ID = '7'
const NOMBRE_LARGO = 'Fundación Hogar de Ancianos Nuestra Señora de la Altagracia y Santa Teresa de Jesús del Valle'
const backend = `${API}/api/v1`
const pagina = (data: unknown[]) => ({ data, meta: { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0 } })
const adulto = (n: number) => ({ envejeciente_id: `11111111-1111-4111-8111-1111111111${String(n).padStart(2, '0')}`, nombres: `Juana María de los Ángeles ${n}`,
  apellidos: 'Fernández de la Rosa', estado: 'activo', zona: 'Sector Los Jardines del Norte', municipio_nombre: 'Santo Domingo de Guzmán' })

function equipo(yo: string): MiembroSim[] {
  const propia = miembro('1', 'Laura', 'Díaz', 'administrador', 'activa', { es_titular: true })
  propia.usuario.id = yo
  const largo = miembro('2', 'María de los Ángeles Guadalupe', 'Fernández Rodríguez de la Cruz', 'cuidador')
  largo.usuario.correo = 'maria.de.los.angeles.guadalupe.fernandez.rodriguez@fundacion-hogar-ancianos.example.test'
  return [propia, largo, miembro('3', 'Elena', 'Coordina', 'coordinador'), miembro('4', 'Fabio', 'Familiar', 'familiar'),
    miembro('5', 'Gloria', 'Voluntaria', 'voluntario', 'inactiva'), miembro('6', 'Hugo', 'Pendiente', 'cuidador', 'pendiente'),
    ...Array.from({ length: 16 }, (_, i) => miembro(String(7 + i), `Persona${7 + i}`, 'Prueba', 'cuidador'))]
}

/** Servicios públicos y de cuenta que las pantallas necesitan, además de los de `simular`. */
async function servicios(page: Page, cuentaId = CUENTA_ID) {
  await page.context().route(`${backend}/publico/**`, async (route) => {
    const ruta = new URL(route.request().url()).pathname
    if (ruta.endsWith('/organizaciones')) return route.fulfill({ json: { data: [{ cuenta_id: 4, nombre: NOMBRE_LARGO }, { cuenta_id: 5, nombre: 'Centro de prueba' }] } })
    if (ruta.endsWith('/consulta')) {
      return route.fulfill({ json: { data: { organizacion: NOMBRE_LARGO, estado: 'autorizada', estado_texto: 'Autorizada', fecha: '2026-12-01', hora: '10:30', motivo_rechazo: null,
        puede_registrar_observacion: false, observacion: null } } })
    }
    return route.fulfill({ status: 201, json: { data: { codigo: 'VIS-ABCD-2345' } } })
  })
  await page.context().route(`${backend}/cuentas/${cuentaId}/**`, async (route) => {
    const ruta = new URL(route.request().url()).pathname
    if (ruta.endsWith('/envejecientes')) return route.fulfill({ json: pagina([1, 2, 3].map(adulto)) })
    return route.fallback()
  })
}

const entrar = async (page: Page, correo: string) => iniciarSesion(page, correo)

/* ───────────── Sin sesión ───────────── */

test.describe('sin sesión', () => {
  test.beforeEach(async ({ page }) => {
    await simular(page)
    await servicios(page)
  })

  test('portada /', async ({ page }) => {
    await recorrer(page, 'portada', '/', {
      listo: (p) => p.getByRole('heading', { level: 1 }),
      acciones: (p) => [p.getByRole('link', { name: 'Iniciar sesión', exact: true }).first()],
    })
  })

  test('acceso /inicio', async ({ page }) => {
    await recorrer(page, 'inicio-acceso', '/inicio', {
      listo: (p) => p.getByLabel(/^Correo electrónico/),
      acciones: (p) => [p.getByLabel(/^Contraseña/), p.getByRole('button', { name: 'Iniciar sesión', exact: true })],
    })
  })

  test('acceso con error de credenciales', async ({ page }) => {
    await page.context().route('https://auth.cuidared.test/**', (route) => route.fulfill({ status: 400, json: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }))
    await recorrer(page, 'inicio-errores', '/inicio', {
      listo: (p) => p.getByLabel(/^Correo electrónico/),
      preparar: async (p) => {
        await p.getByLabel(/^Correo electrónico/).fill('persona-con-un-correo-extremadamente-largo-para-probar-el-ajuste@dominio-largo.example.test')
        await p.getByLabel(/^Contraseña/).fill('x')
        await p.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
        await p.waitForTimeout(300)
      },
    })
  })

  test('activar invitación /registro', async ({ page }) => {
    await recorrer(page, 'registro-invitacion', '/registro', { listo: (p) => p.getByRole('main').or(p.locator('form')).first() })
  })

  test('recuperar /recuperar', async ({ page }) => {
    await recorrer(page, 'recuperar', '/recuperar', { listo: (p) => p.getByLabel(/^Correo electrónico/) })
  })

  test('restablecer /restablecer', async ({ page }) => {
    await recorrer(page, 'restablecer', '/restablecer', { listo: (p) => p.locator('form').first() })
  })

  for (const [nombre, ruta] of [['crear-cuenta', '/crear-cuenta'], ['registro-familia', '/registro-familia'], ['registro-organizacion', '/registro-organizacion']]) {
    test(`registro ${ruta}`, async ({ page }) => {
      await recorrer(page, nombre!, ruta!, { listo: (p) => p.getByRole('heading', { level: 1 }), acciones: (p) => [p.locator('form button[type="submit"], form button').last()] })
    })
    test(`registro ${ruta} con errores de validación`, async ({ page }) => {
      await recorrer(page, `${nombre}-errores`, ruta!, {
        listo: (p) => p.getByRole('heading', { level: 1 }),
        preparar: async (p) => {
          await p.locator('form button[type="submit"]').first().click()
          await p.waitForTimeout(200)
        },
      })
    })
  }

  test('solicitud de visita /solicitar-visita (pasos)', async ({ page }) => {
    await recorrer(page, 'solicitar-visita-paso1', '/solicitar-visita', {
      listo: (p) => p.getByRole('combobox', { name: 'Organización que quieres visitar' }),
      acciones: (p) => [p.getByRole('button', { name: 'Siguiente', exact: true })],
    })
    await recorrer(page, 'solicitar-visita-paso2', '/solicitar-visita', {
      listo: (p) => p.getByRole('combobox', { name: 'Organización que quieres visitar' }),
      preparar: async (p) => {
        await p.getByRole('combobox', { name: 'Organización que quieres visitar' }).selectOption('4')
        await p.getByLabel('Tu nombre', { exact: true }).fill('Ana')
        await p.getByLabel('Tus apellidos').fill('Prueba')
        await p.getByLabel('Cédula', { exact: true }).fill('00123456780')
        await p.getByLabel('Teléfono').fill('8095550100')
        await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
        await p.getByRole('radio', { name: /Visita de una institución o grupo/ }).check()
      },
      acciones: (p) => [p.getByRole('button', { name: 'Siguiente', exact: true })],
    })
    await recorrer(page, 'solicitar-visita-paso3', '/solicitar-visita', {
      listo: (p) => p.getByRole('combobox', { name: 'Organización que quieres visitar' }),
      preparar: async (p) => {
        await p.getByRole('combobox', { name: 'Organización que quieres visitar' }).selectOption('4')
        await p.getByLabel('Tu nombre', { exact: true }).fill('Ana')
        await p.getByLabel('Tus apellidos').fill('Prueba')
        await p.getByLabel('Cédula', { exact: true }).fill('00123456780')
        await p.getByLabel('Teléfono').fill('8095550100')
        await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
        await p.getByRole('radio', { name: /Visita de una institución o grupo/ }).check()
        await p.getByLabel('Nombre de la institución o del grupo').fill('Fundación de prueba')
        await p.getByLabel('Tipo de institución o grupo', { exact: true }).selectOption('fundacion')
        await p.getByLabel('Cantidad de visitantes').fill('12')
        await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
      },
      acciones: (p) => [p.getByRole('button', { name: 'Enviar solicitud' })],
    })
  })

  test('seguimiento de visita /solicitud-visita', async ({ page }) => {
    await recorrer(page, 'seguimiento-visita', '/solicitud-visita', { listo: (p) => p.locator('form').first() })
    await recorrer(page, 'seguimiento-visita-resultado', '/solicitud-visita', {
      listo: (p) => p.locator('form').first(),
      preparar: async (p) => {
        await p.locator('form input').first().fill('VIS-ABCD-2345')
        await p.locator('form button[type="submit"]').first().click()
        await p.getByText(NOMBRE_LARGO).first().waitFor()
      },
    })
  })

  for (const [nombre, ruta] of [['guias', '/guias'], ['terminos', '/terminos'], ['privacidad', '/privacidad']]) {
    test(`texto público ${ruta}`, async ({ page }) => {
      await recorrer(page, nombre!, ruta!, { listo: (p) => p.getByRole('heading', { level: 1 }).first() })
    })
  }

  test('ruta desconocida vuelve al acceso', async ({ page }) => {
    await page.goto('/ruta-que-no-existe')
    await expect(page).toHaveURL(/\/inicio$/)
  })
})

/* ───────────── Con sesión, sin cuenta activa ───────────── */

test.describe('con sesión y una invitación pendiente', () => {
  test('inicio y cuenta', async ({ page }) => {
    const sim = await simular(page, {
      cuentas: [invitacionPendiente({ cuenta_id: '31', nombre: NOMBRE_LARGO, membresia_id: '900', rol: 'coordinador' })],
    })
    await servicios(page)
    await entrar(page, sim.correo)
    await recorrer(page, 'inicio-con-invitacion', '/inicio', {
      listo: (p) => p.getByTestId('invitaciones-pendientes'),
      acciones: (p) => [p.getByRole('link', { name: 'Mi cuenta', exact: true }), p.getByRole('button', { name: 'Cerrar sesión', exact: true })],
    })
    await recorrer(page, 'cuenta-con-invitacion', '/cuenta', {
      listo: (p) => p.getByRole('heading', { name: 'Mi perfil', exact: true }),
      acciones: (p) => [p.getByRole('button', { name: 'Cerrar sesión', exact: true })],
    })
  })
})

/* ───────────── Con sesión y cuentas ───────────── */

test.describe('con sesión y cuentas activas', () => {
  test('mi cuenta, miembros y menú operativo (administrador con todos los módulos)', async ({ page }) => {
    const permisos = ['adultos:ver', 'visitas:ver', 'agenda:ver', 'necesidades:ver', 'alertas:ver', 'resumen:ver', 'reportes:ver', 'usuarios:gestionar',
      'organizacion:configurar', 'visitas:autorizar', 'auditoria:ver', 'cuenta:suscripcion']
    const cuentas = [
      cuentaActiva({ cuenta_id: CUENTA_ID, nombre: NOMBRE_LARGO, rol: 'administrador', es_titular: true, permisos }),
      cuentaActiva({ cuenta_id: '8', nombre: 'Familia Méndez', tipo: 'familia', rol: 'coordinador', permisos: ['adultos:ver', 'usuarios:gestionar'] }),
      cuentaActiva({ cuenta_id: '9', nombre: 'Parroquia San Judas Tadeo', rol: 'voluntario', permisos: ['adultos:ver'] }),
    ]
    const sim = await simular(page, { correo: `${'contacto'.repeat(6)}@dominio-extenso.example.test`, cuentas, miembros: { [CUENTA_ID]: equipo('c0a80101-0000-4000-8000-0000000000aa') } })
    await servicios(page)
    await page.context().route(`${backend}/cuentas/${CUENTA_ID}/contexto`, (r) => r.fulfill({ json: { data: cuentas[0] } }))
    await entrar(page, sim.correo)
    await expect(page).toHaveURL(new RegExp(`/operacion/${CUENTA_ID}/cuenta$`))

    await recorrer(page, 'mi-cuenta', '/cuenta', {
      listo: (p) => p.getByRole('heading', { name: 'Mis cuentas' }),
      acciones: (p) => [p.getByRole('button', { name: 'Cerrar sesión', exact: true })],
    })
    await recorrer(page, 'miembros', '/cuenta/miembros', {
      listo: (p) => p.getByRole('heading', { name: 'Miembros', exact: true }),
      acciones: (p) => [p.getByRole('button', { name: 'Agregar miembros', exact: true })],
    })
    await recorrer(page, 'miembros-invitar', '/cuenta/miembros', {
      listo: (p) => p.getByRole('heading', { name: 'Miembros', exact: true }),
      preparar: async (p) => {
        await p.getByRole('button', { name: 'Agregar miembros', exact: true }).click()
        await expect(p.getByLabel(/^Correo electrónico de la persona/)).toBeVisible()
      },
    })
    await recorrer(page, 'miembros-filtros', '/cuenta/miembros', {
      listo: (p) => p.getByRole('heading', { name: 'Miembros', exact: true }),
      preparar: async (p) => { await p.getByRole('button', { name: 'Filtros', exact: true }).click() },
      dialogo: true,
    }, [...ANCHOS, ...HORIZONTALES])
    await recorrer(page, 'miembros-accion', '/cuenta/miembros', {
      listo: (p) => p.getByRole('heading', { name: 'Miembros', exact: true }),
      preparar: async (p) => {
        await p.getByRole('button', { name: /^Ver más de María/ }).click()
        await p.getByRole('button', { name: 'Desactivar miembro', exact: true }).click()
      },
      dialogo: true,
    }, [320, 390, 768, 1280, ...HORIZONTALES])
    await recorrer(page, 'portal-horizontal', `/operacion/${CUENTA_ID}/envejecientes`, {
      listo: (p) => p.getByRole('heading', { name: 'Adultos mayores', exact: true }).first(), menu: true,
    }, HORIZONTALES)
    await recorrer(page, 'portal-sin-conexion', `/operacion/${CUENTA_ID}/envejecientes`, {
      listo: (p) => p.getByRole('heading', { name: 'Adultos mayores', exact: true }).first(),
      preparar: async (p) => {
        await p.context().setOffline(true)
        await expect(p.getByRole('status').filter({ hasText: 'Sin conexión' }).first()).toBeVisible()
      },
      limpiar: async (p) => { await p.context().setOffline(false) },
      acciones: (p) => [p.getByRole('status').filter({ hasText: 'Sin conexión' }).first(), p.getByRole('link', { name: 'Mi cuenta', exact: true })],
      menu: true,
    }, [320, 360, 414, 768, 1280])
    await recorrer(page, 'portal-inicio', `/operacion/${CUENTA_ID}/cuenta`, {
      listo: (p) => p.getByRole('heading', { name: 'Resumen de hoy' }), menu: true,
    })
    await recorrer(page, 'portal-mas', `/operacion/${CUENTA_ID}/mas`, {
      listo: (p) => p.getByRole('heading', { name: 'Más opciones' }), menu: true,
    })
    await recorrer(page, 'portal-adultos', `/operacion/${CUENTA_ID}/envejecientes`, {
      listo: (p) => p.getByRole('heading', { name: 'Adultos mayores', exact: true }).first(), menu: true,
    })
  })

  test('menú operativo con pocos módulos (cuidador de una cuenta familiar)', async ({ page }) => {
    const cuentas = [cuentaActiva({ cuenta_id: CUENTA_ID, nombre: 'Familia Méndez', tipo: 'familia', rol: 'cuidador', permisos: ['adultos:ver', 'agenda:ver', 'necesidades:ver'] })]
    const sim = await simular(page, { cuentas })
    await servicios(page)
    await page.context().route(`${backend}/cuentas/${CUENTA_ID}/contexto`, (r) => r.fulfill({ json: { data: cuentas[0] } }))
    await entrar(page, sim.correo)
    await recorrer(page, 'portal-inicio-cuidador', `/operacion/${CUENTA_ID}/cuenta`, {
      listo: (p) => p.getByRole('heading', { name: 'Accesos rápidos' }), menu: true,
    })
  })

  test('registro de cuenta con sesión iniciada', async ({ page }) => {
    const sim = await simular(page, { cuentas: [] })
    await servicios(page)
    await entrar(page, sim.correo)
    for (const [nombre, ruta] of [['crear-cuenta-sesion', '/crear-cuenta'], ['registro-familia-sesion', '/registro-familia'], ['registro-organizacion-sesion', '/registro-organizacion']]) {
      await recorrer(page, nombre!, ruta!, { listo: (p) => p.getByRole('heading', { level: 1 }) })
    }
  })
})
