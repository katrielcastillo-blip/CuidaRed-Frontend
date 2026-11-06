/*
 * e2e-cu01-auth.spec.ts — Suite E2E-CU01-AUTH: escenarios de CU-01 Iniciar sesión en el sistema (RF-09 · Anexo B),
 * con las Reglas de Negocio V2: 5 roles, cuentas Familia u Organización con selector de cuenta, registro de cuenta
 * por tipo con prueba gratuita de 14 días, política de contraseñas con carácter especial y guía de bienvenida.
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page } from '@playwright/test'
import type { Rol } from '../../src/domain/types'
import { CUENTA_FAMILIA, CUENTAS, enviarCredenciales, iniciarSesion, leerDB, limpiarDatos, PASSWORD_DEMO } from './fixtures'

const ERROR_GENERICO = 'Correo o contraseña incorrectos.'
const ROLES: Rol[] = ['admin', 'coordinador', 'cuidador', 'voluntario', 'familiar']

/**
 * Reglas de Negocio V2: la primera vez que una persona entra con un rol, la app muestra una guía de bienvenida
 * (diálogo de un solo uso, clave `cuidared:onboarding:<userId>:<rol>`). Salvo en el escenario que la verifica, se
 * marca como vista (para los usuarios demo) antes de entrar.
 */
const claveOnboarding = (usuarioId: string, rol: Rol) => `cuidared:onboarding:${usuarioId}:${rol}`
async function omitirOnboarding(page: Page) {
  const claves = [...Object.entries(CUENTAS).map(([rol, c]) => claveOnboarding(c.id, rol as Rol)), claveOnboarding(CUENTA_FAMILIA.id, 'coordinador')]
  await page.evaluate((ks) => ks.forEach((k) => localStorage.setItem(k, new Date().toISOString())), claves)
}

/** Fecha local YYYY-MM-DD de dentro de `n` días. */
function enDiasISO(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test.describe('E2E-CU01-AUTH · Iniciar sesión en el sistema', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page)
  })

  for (const rol of ROLES) {
    test(`Escenario: Iniciar sesión con credenciales válidas (${CUENTAS[rol].etiqueta})`, async ({ page }) => {
      // Dado que el usuario tiene una cuenta activa con rol ${rol}
      // Cuando ingresa su correo y contraseña válidos
      await iniciarSesion(page, rol)
      // Entonces accede al área de su rol y ve su nombre, su rol y su cuenta en la barra superior
      await expect(page).toHaveURL(new RegExp(`${CUENTAS[rol].home}$`))
      await expect(page.getByTestId('usuario-actual')).toContainText(CUENTAS[rol].nombre)
      await expect(page.getByTestId('usuario-actual')).toContainText(CUENTAS[rol].etiqueta)
      // (quien pertenece a varias cuentas, Carlos y Clara, ve además la cuenta en la que entró: la Organización)
      if (rol === 'cuidador' || rol === 'familiar') await expect(page.getByTestId('usuario-actual')).toContainText('Fundación Esperanza')
      // Y la sesión queda registrada en el dispositivo y en la auditoría
      const sesion = await page.evaluate(() => JSON.parse(localStorage.getItem('cuidared:sesion') ?? 'null'))
      expect(sesion).toMatchObject({ usuarioId: CUENTAS[rol].id })
      const db = await leerDB(page)
      expect(db.auditoria.some((e) => e.accion === 'sesion.iniciar' && e.usuarioId === CUENTAS[rol].id)).toBe(true)
    })
  }

  test('Escenario: Iniciar sesión como coordinadora de una cuenta Familia en prueba gratuita', async ({ page }) => {
    // Dado que Patricia Méndez es la titular de la cuenta Familia «Familia Méndez»
    // Cuando ingresa su correo y contraseña válidos
    await enviarCredenciales(page, CUENTA_FAMILIA.email)
    // Entonces accede al área del coordinador de su cuenta Familia (sin selector: solo pertenece a una cuenta)
    await page.waitForURL('**/coordinador')
    const actual = page.getByTestId('usuario-actual')
    await expect(actual).toContainText(CUENTA_FAMILIA.nombre)
    await expect(actual).toContainText(CUENTA_FAMILIA.etiqueta)
    await expect(actual).not.toHaveAttribute('aria-haspopup', 'dialog')
    // Y ve el aviso de los días que le quedan de la prueba gratuita
    await expect(page.getByTestId('banner-prueba')).toContainText('Prueba gratuita')
    const db = await leerDB(page)
    expect(db.orgs.find((o) => o.id === CUENTA_FAMILIA.orgId)).toMatchObject({ nombre: 'Familia Méndez', tipoCuentaId: 'tc-familia', suscripcionEstado: 'prueba' })
  })

  test('Escenario: Rechazar credenciales inválidas con un mensaje genérico', async ({ page }) => {
    const correo = page.getByLabel('Correo electrónico')
    const clave = page.getByLabel('Contraseña', { exact: true })
    const entrar = page.getByRole('button', { name: 'Iniciar sesión' })

    // Cuando ingresa un correo registrado con una contraseña incorrecta
    await correo.fill(CUENTAS.coordinador.email)
    await clave.fill('Incorrecta99')
    await entrar.click()
    // Entonces el sistema no le permite el acceso y muestra un mensaje genérico
    await expect(page.getByRole('alert')).toHaveText(ERROR_GENERICO)
    await expect(page).toHaveURL(/\/inicio$/)

    // Y el mismo mensaje se muestra para un correo que no existe (no revela qué dato falló)
    await correo.fill('nadie@cuidared.do')
    await clave.fill(PASSWORD_DEMO)
    await entrar.click()
    await expect(page.getByRole('alert')).toHaveText(ERROR_GENERICO)
    await expect(page).toHaveURL(/\/inicio$/)
    expect(await page.evaluate(() => localStorage.getItem('cuidared:sesion'))).toBeNull()
  })

  test('Escenario: Impedir el acceso de una cuenta desactivada', async ({ page }) => {
    // Dado que la cuenta de Eduardo Hernández (voluntario) está desactivada en la semilla
    const db = await leerDB(page)
    expect(db.usuarios.find((u) => u.email === 'eduardo.h@gmail.com')?.estado).toBe('inactivo')
    // Cuando intenta iniciar sesión con su contraseña correcta
    await page.getByLabel('Correo electrónico').fill('eduardo.h@gmail.com')
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD_DEMO)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    // Entonces el sistema no le permite entrar
    await expect(page.getByRole('alert')).toContainText('no está activa')
    await expect(page).toHaveURL(/\/inicio$/)
    expect(await page.evaluate(() => localStorage.getItem('cuidared:sesion'))).toBeNull()
    // Y no puede acceder a las rutas protegidas
    await page.goto('/voluntario')
    await expect(page).toHaveURL(/\/inicio$/)
  })

  test('Escenario: La página de bienvenida es pública y, con la sesión abierta, lleva al inicio del rol', async ({ page }) => {
    // Cuando una persona sin sesión abre la raíz del sitio
    await page.goto('/')
    // Entonces ve la página pública de bienvenida con los accesos para entrar o crear una cuenta
    await expect(page.getByRole('heading', { level: 1, name: 'Acompañar a nuestros adultos mayores, entre todos' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Crear cuenta' }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Iniciar sesión' }).first().click()
    await expect(page).toHaveURL(/\/inicio$/)
    // Y con la sesión abierta, la raíz la lleva directo al inicio de su rol
    await iniciarSesion(page, 'coordinador')
    await page.goto('/')
    await expect(page).toHaveURL(/\/coordinador$/)
  })

  test('Escenario: El cuidador con dos cuentas cambia de cuenta desde el encabezado y ve los adultos de la otra', async ({ page }) => {
    const db = await leerDB(page)
    // Dado que Carlos Ruiz es cuidador en dos cuentas: Fundación Esperanza (Organización) y Familia Méndez (Familia)
    const membresiasCarlos = db.membresias.filter((m) => m.usuarioId === CUENTAS.cuidador.id && m.estado === 'activa')
    expect(membresiasCarlos.map((m) => m.orgId).sort()).toEqual(['org-1', 'org-fam'])
    // Cuando inicia sesión entra a su cuenta principal, la Organización, y ve sus 3 adultos asignados
    await iniciarSesion(page, 'cuidador')
    const selector = page.getByTestId('usuario-actual')
    await expect(selector).toContainText('Fundación Esperanza')
    await page.goto('/cuidador/adultos')
    await expect(page.getByText('3 adultos asignados')).toBeVisible()
    await expect(page.getByRole('link', { name: /^Elena Rodríguez, riesgo/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Rosa Méndez, riesgo/ })).toHaveCount(0)

    // Y abre el selector de cuenta del encabezado, donde aparecen sus dos cuentas con la actual marcada
    await selector.click()
    const hoja = page.getByRole('dialog', { name: 'Cambiar de cuenta' })
    const cuentas = hoja.getByTestId('lista-cuentas').getByRole('listitem')
    await expect(cuentas).toHaveCount(2)
    await expect(cuentas.filter({ hasText: 'Fundación Esperanza' }).getByRole('button')).toHaveAttribute('aria-current', 'true')
    // Y elige la cuenta Familia Méndez
    await cuentas.filter({ hasText: 'Familia Méndez' }).getByRole('button').click()

    // Entonces el sistema cambia la cuenta activa, lo lleva al inicio de su rol en ella y lo deja registrado
    await expect(page.getByText('Ahora trabajas en Familia Méndez como Cuidador.')).toBeVisible()
    await expect(page).toHaveURL(/\/cuidador$/)
    await expect(selector).toContainText('Familia Méndez')
    const membresiaFamilia = membresiasCarlos.find((m) => m.orgId === 'org-fam')!
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cuidared:sesion') ?? 'null')?.membresiaId)).toBe(membresiaFamilia.id)
    await expect
      .poll(async () => (await leerDB(page)).auditoria.filter((e) => e.accion === 'sesion.cambiar_cuenta' && e.usuarioId === CUENTAS.cuidador.id).length)
      .toBe(1)
    // Y ahora ve los adultos de la otra cuenta (y ya no los de la Fundación)
    await page.goto('/cuidador/adultos')
    await expect(selector).toContainText('Familia Méndez')
    await expect(page.getByText('2 adultos asignados')).toBeVisible()
    await expect(page.getByRole('link', { name: /^Rosa Méndez, riesgo/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Ramón Méndez, riesgo/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Elena Rodríguez, riesgo/ })).toHaveCount(0)
  })

  test('Escenario: Registrar una cuenta Familia deja la prueba gratuita de 14 días', async ({ page }) => {
    const correo = 'lucia.perez.e2e@correo.do'
    // Dado que una persona sin cuenta quiere crear una desde el inicio de sesión
    await page.getByRole('link', { name: 'Crear cuenta', exact: true }).click()
    // Cuando elige el tipo de cuenta Familia
    await expect(page).toHaveURL(/\/crear-cuenta$/)
    await expect(page.getByRole('heading', { name: '¿Qué tipo de cuenta quieres crear?' })).toBeVisible()
    await page.getByRole('link', { name: /Cuido a un familiar mayor/ }).click()
    await expect(page).toHaveURL(/\/registro-familia$/)
    // Y completa los datos de su familia (sin elegir plan: el registro no lo pide)
    await expect(page.getByText('Paso 1 de 3 · Tu familia')).toBeVisible()
    await expect(page.getByText('14 días gratis, sin tarjeta.')).toBeVisible()
    await expect(page.getByText(/Plan/)).toHaveCount(0)
    await page.getByRole('textbox', { name: /^Nombre de la familia/ }).fill('Familia Pérez')
    await page.getByRole('combobox', { name: /^Categoría/ }).selectOption({ label: 'Cuidado domiciliario' })
    await page.getByRole('combobox', { name: /^Provincia/ }).selectOption({ label: 'Santiago' })
    await page.getByRole('combobox', { name: /^Municipio/ }).selectOption({ label: 'Santiago' })
    await page.getByRole('button', { name: 'Siguiente' }).click()
    // Y los de la persona coordinadora
    await expect(page.getByText('Paso 2 de 3 · Persona coordinadora')).toBeVisible()
    await page.getByRole('textbox', { name: /^Cédula/ }).fill('031-0987654-3')
    await page.getByRole('textbox', { name: /^Nombre/ }).fill('Lucía')
    await page.getByRole('textbox', { name: /^Apellido/ }).fill('Pérez')
    await page.getByRole('textbox', { name: /^Teléfono/ }).fill('829 555 0140')
    await page.getByRole('textbox', { name: /^Correo electrónico/ }).fill(correo)
    await page.getByRole('button', { name: 'Siguiente' }).click()
    // Y una contraseña: Demo1234 (sin carácter especial) ya no sirve para crear una contraseña
    await expect(page.getByText('Paso 3 de 3 · Contraseña')).toBeVisible()
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD_DEMO)
    await page.getByLabel('Confirmar contraseña', { exact: true }).fill(PASSWORD_DEMO)
    await page.getByRole('checkbox', { name: /He leído y acepto/ }).check()
    await page.getByRole('button', { name: 'Crear cuenta familiar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'carácter especial' })).toBeVisible()
    await expect(page).toHaveURL(/\/registro-familia$/)
    // (con un carácter especial, sí)
    await page.getByLabel('Contraseña', { exact: true }).fill('Segura123!')
    await page.getByLabel('Confirmar contraseña', { exact: true }).fill('Segura123!')
    await page.getByRole('button', { name: 'Crear cuenta familiar' }).click()

    // Entonces la cuenta Familia queda creada y la coordinadora entra a su área
    await page.waitForURL('**/coordinador')
    const db = await leerDB(page)
    const usuario = db.usuarios.find((u) => u.email === correo)!
    expect(usuario).toMatchObject({ rol: 'coordinador', nombre: 'Lucía', apellido: 'Pérez', estado: 'activo' })
    const cuenta = db.orgs.find((o) => o.id === usuario.orgId)!
    expect(cuenta).toMatchObject({ nombre: 'Familia Pérez', tipoCuentaId: 'tc-familia', categoriaCuentaId: 'cc-domiciliario', usuarioTitularId: usuario.id })
    // Y la cuenta queda en prueba gratuita de 14 días, sin plan ni pago
    expect(cuenta).toMatchObject({ suscripcionEstado: 'prueba', pruebaGratuita: true, fechaInicioPrueba: enDiasISO(0), fechaFinPrueba: enDiasISO(14), planId: '', planPrecio: 0 })
    expect(db.pagos.filter((p) => p.orgId === cuenta.id)).toEqual([])
    expect(db.membresias.filter((m) => m.usuarioId === usuario.id && m.estado === 'activa')).toEqual([expect.objectContaining({ orgId: cuenta.id, rol: 'coordinador' })])
    // (su primera entrada muestra la guía de bienvenida, que la presenta y le explica la prueba gratuita)
    const guia = page.getByRole('dialog') // (su nombre accesible es el título del paso en curso)
    await expect(guia).toContainText('Coordinador · Familia Pérez')
    for (let i = 0; i < 3; i++) await guia.getByRole('button', { name: 'Siguiente' }).click()
    await expect(guia.getByRole('heading', { name: 'Tu prueba gratuita' })).toBeVisible()
    await expect(guia).toContainText('de los 14 de prueba gratuita')
    await guia.getByRole('button', { name: 'Empezar' }).click()
    await expect(guia).toHaveCount(0)
    // Y la ve en la pantalla de la cuenta: aviso con los días y estado «prueba» en Plan y suscripción
    await expect(page.getByTestId('banner-prueba')).toContainText('te quedan 14 días')
    await page.goto('/coordinador/suscripcion')
    const estado = page.getByTestId('estado-suscripcion')
    await expect(estado).toContainText('Prueba gratuita de 14 días')
    await expect(estado).toContainText('Quedan 14 días de prueba.')
  })

  test('Escenario: La guía de bienvenida se muestra solo la primera vez que se entra con un rol', async ({ page }) => {
    // Dado que el cuidador aún no ha visto la guía de bienvenida en este dispositivo
    await page.evaluate((k) => localStorage.removeItem(k), claveOnboarding(CUENTAS.cuidador.id, 'cuidador'))
    // Cuando inicia sesión por primera vez
    await iniciarSesion(page, 'cuidador')
    // Entonces ve la guía de su rol y su cuenta, de varios pasos, y puede saltarla
    const guia = page.getByRole('dialog') // (su nombre accesible es el título del paso en curso)
    await expect(guia).toContainText('Cuidador · Fundación Esperanza')
    await expect(guia).toContainText('Paso 1 de 4')
    await guia.getByRole('button', { name: 'Siguiente' }).click()
    await expect(guia).toContainText('Paso 2 de 4')
    await expect(guia.getByRole('heading', { name: 'Registra cada visita' })).toBeVisible()
    await guia.getByRole('button', { name: 'Saltar' }).click()
    await expect(guia).toHaveCount(0)
    // Y queda marcada como vista: no vuelve a aparecer al recargar ni al volver a entrar
    expect(await page.evaluate((k) => localStorage.getItem(k), claveOnboarding(CUENTAS.cuidador.id, 'cuidador'))).not.toBeNull()
    await page.reload()
    await expect(page.getByTestId('usuario-actual')).toContainText('Carlos Ruiz')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('Escenario: Desactivar mi propia cuenta desde Mi perfil conserva el historial y cierra el acceso', async ({ page }) => {
    const antes = await leerDB(page)
    const adultosRegistrados = antes.adultos.filter((a) => a.registradoPor === CUENTAS.coordinador.id).length
    expect(adultosRegistrados).toBeGreaterThan(0)
    // Dado que Laura Núñez (coordinadora, no titular de la cuenta) inicia sesión y abre «Desactivar mi cuenta» (reemplaza a «Eliminar cuenta»)
    await iniciarSesion(page, 'coordinador')
    await page.goto('/coordinador/perfil/desactivar')
    await expect(page.getByRole('heading', { name: '¿Quieres desactivar tu cuenta?' })).toBeVisible()
    await expect(page.getByText('Tu historial se conserva.')).toBeVisible()
    // Cuando confirma con su contraseña actual y la casilla «Entiendo»
    await page.getByLabel(/^Contraseña actual/).fill('Incorrecta99')
    await page.getByRole('checkbox', { name: /Entiendo que mi acceso se desactivará/ }).check()
    await page.getByRole('button', { name: 'Desactivar mi cuenta' }).click()
    // (con una contraseña incorrecta no se desactiva)
    await expect(page.getByText('La contraseña no es correcta.')).toBeVisible()
    expect((await leerDB(page)).usuarios.find((u) => u.id === CUENTAS.coordinador.id)?.estado).toBe('activo')
    await page.getByLabel(/^Contraseña actual/).fill(PASSWORD_DEMO)
    await page.getByRole('button', { name: 'Desactivar mi cuenta' }).click()

    // Entonces su sesión se cierra y vuelve al inicio de sesión
    await page.waitForURL('**/inicio')
    expect(await page.evaluate(() => localStorage.getItem('cuidared:sesion'))).toBeNull()
    // Y su cuenta y su membresía quedan inactivas, sin borrar nada de lo que registró
    const db = await leerDB(page)
    expect(db.usuarios.find((u) => u.id === CUENTAS.coordinador.id)?.estado).toBe('inactivo')
    expect(db.membresias.find((m) => m.usuarioId === CUENTAS.coordinador.id && m.orgId === 'org-1')).toMatchObject({ estado: 'inactiva', fechaFin: expect.any(String) })
    expect(db.adultos.filter((a) => a.registradoPor === CUENTAS.coordinador.id).length).toBe(adultosRegistrados)
    expect(db.auditoria.some((e) => e.accion === 'cuenta.desactivar' && e.usuarioId === CUENTAS.coordinador.id)).toBe(true)
    // Y no puede volver a entrar hasta que la persona responsable de su cuenta reactive su acceso
    await enviarCredenciales(page, CUENTAS.coordinador.email)
    await expect(page.getByRole('alert').filter({ hasText: 'no está activa' })).toBeVisible()
    await expect(page).toHaveURL(/\/inicio$/)
  })

  test('Escenario: La persona titular de una cuenta no puede desactivar su propia cuenta', async ({ page }) => {
    // Dado que Andrea Peña es la titular de la Fundación Esperanza
    await iniciarSesion(page, 'admin')
    // Cuando abre «Desactivar mi cuenta»
    await page.goto('/admin/perfil/desactivar')
    // Entonces el sistema se lo impide con un mensaje claro y no ofrece el botón de desactivar
    await expect(page.getByText('Todavía no puedes desactivar tu cuenta.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Desactivar mi cuenta' })).toHaveCount(0)
    expect((await leerDB(page)).usuarios.find((u) => u.id === CUENTAS.admin.id)?.estado).toBe('activo')
  })
})
