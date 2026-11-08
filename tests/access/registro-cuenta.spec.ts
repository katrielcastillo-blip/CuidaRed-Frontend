/*
 * registro-cuenta.spec.ts — Autorregistro del titular en el acceso conectado (fase 2): tipo de cuenta, datos de la
 * persona, contraseña, código del correo y datos de la cuenta, con Auth y API interceptados.
 * Módulo: pruebas · access-real.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page } from '@playwright/test'
import { CLAVE, iniciarSesion, simular } from './ayudas-fase2'

const CORREO = 'Ana.Perez@Example.test'
const CORREO_NORMAL = 'ana.perez@example.test'

/** Campos de texto de la pantalla actual (el SRS permite como máximo 5 por pantalla). */
const camposDeTexto = (page: Page) => page.locator('form input:not([type="checkbox"]):not([type="radio"])').count()

async function llenarDatos(page: Page) {
  await page.getByLabel(/^Cédula/).fill('00112345678')
  await page.getByLabel(/^Nombres/).fill('Ana')
  await page.getByLabel(/^Apellidos/).fill('Pérez')
  await page.getByLabel(/^Correo electrónico/).fill(CORREO)
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
}

async function llenarClave(page: Page) {
  await page.getByLabel(/^Contraseña/).fill(CLAVE)
  await page.getByLabel(/^Confirmar contraseña/).fill(CLAVE)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Registrarme' }).click()
}

async function verificarCodigo(page: Page, codigo = '123456') {
  await page.getByLabel(/^Código de verificación/).fill(codigo)
  await page.getByRole('button', { name: 'Verificar correo' }).click()
}

/** Recorre el alta hasta el último paso (datos de la cuenta) con el correo ya verificado. */
async function llegarADatosDeCuenta(page: Page, ruta: string) {
  await page.goto(ruta)
  if (ruta === '/crear-cuenta') {
    await page.getByRole('radio', { name: 'Familia' }).click()
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  }
  await llenarDatos(page)
  await llenarClave(page)
  await verificarCodigo(page)
  await expect(page.getByLabel(/^Categoría/)).toBeVisible()
}

async function llenarCuenta(page: Page, nombre = 'Familia Pérez') {
  await page.getByLabel(/^Nombre de la (familia|organización)/).fill(nombre)
  await page.getByLabel(/^Categoría/).selectOption({ label: 'Monitoreo a distancia' })
  await page.getByLabel(/^Provincia/).selectOption({ label: 'Distrito Nacional' })
  await page.getByLabel(/^Municipio/).selectOption({ label: 'Santo Domingo de Guzmán' })
  await page.getByLabel(/^Dirección/).fill('Calle 1, Ensanche Naco')
  await page.getByLabel(/^Teléfono/).fill('809-555-1234')
}

test('autorregistro completo de una familia: persona, código del correo, cuenta y sesión', async ({ page }) => {
  const sim = await simular(page)
  await page.goto('/crear-cuenta')

  // 1. Tipo de cuenta: sin elegir no avanza y explica por qué junto al campo.
  await expect(page.getByRole('heading', { name: 'Crear una cuenta' })).toBeVisible()
  await expect(page.getByText('Incluye 7 días de prueba gratuita, sin tarjeta.')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByText('Elige el tipo de cuenta para continuar.')).toBeVisible()
  await page.getByRole('radio', { name: 'Familia' }).click()
  await expect(page.getByText(/Serás la persona coordinadora/)).toBeVisible()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()

  // 2. Datos de la persona (4 campos de texto).
  await expect(page.getByLabel(/^Cédula/)).toBeVisible()
  expect(await camposDeTexto(page)).toBeLessThanOrEqual(5)
  await llenarDatos(page)

  // 3. Contraseña con su política (2 campos de texto).
  await expect(page.getByLabel(/^Confirmar contraseña/)).toBeVisible()
  expect(await camposDeTexto(page)).toBeLessThanOrEqual(5)
  await llenarClave(page)

  // 4. Código del correo.
  await expect(page.getByText(CORREO_NORMAL)).toBeVisible()
  expect(await camposDeTexto(page)).toBeLessThanOrEqual(5)
  expect(sim.peticiones.some((p) => p.ruta.endsWith('/verify'))).toBe(false)
  await verificarCodigo(page)

  // 5. Datos de la cuenta (3 campos de texto + 3 listas).
  await expect(page.getByLabel(/^Categoría/)).toBeVisible()
  expect(await camposDeTexto(page)).toBeLessThanOrEqual(5)
  await expect(page.getByLabel(/^Municipio/)).toBeDisabled()
  await llenarCuenta(page)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page).toHaveURL(/\/cuenta$/)
  await expect(page.getByRole('heading', { name: 'Mis cuentas' })).toBeVisible()
  await expect(page.getByTestId('cuentas-conectadas').getByRole('button', { name: /Familia Pérez/ })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByText(/La prueba gratuita termina el/)).toBeVisible()

  // signUp lleva los datos del perfil en `options.data` (el trigger del backend crea el perfil con ellos).
  const alta = sim.peticiones.find((p) => p.ruta.endsWith('/signup'))!
  expect(alta.cuerpo.email).toBe(CORREO_NORMAL)
  expect(alta.cuerpo.password).toBe(CLAVE)
  expect(alta.cuerpo.data).toEqual({ cedula: '00112345678', nombres: 'Ana', apellidos: 'Pérez' })
  const verificacion = sim.peticiones.find((p) => p.ruta.endsWith('/verify'))!
  expect(verificacion.cuerpo).toMatchObject({ email: CORREO_NORMAL, token: '123456', type: 'signup' })

  // Catálogos con la sesión del código y filtros simples del contrato.
  expect(sim.llamadas('GET', '/catalogos/categorias-cuenta')[0]!.consulta.get('tipo')).toBe('familia')
  expect(sim.llamadas('GET', '/catalogos/provincias').length).toBeGreaterThan(0)
  expect(sim.llamadas('GET', '/catalogos/municipios')[0]!.consulta.get('provincia_cod')).toBe('01')

  // La cuenta se crea con el cuerpo estricto del contrato (sin titular, rol, estado, plan ni fechas).
  const creacion = sim.llamadas('POST', '/cuentas')
  expect(creacion).toHaveLength(1)
  expect(creacion[0]!.cuerpo).toEqual({
    tipo: 'familia',
    nombre: 'Familia Pérez',
    categoria_cuenta_id: 1,
    municipio_cod: '0101',
    direccion: 'Calle 1, Ensanche Naco',
    telefono: '8095551234',
  })
  expect(creacion[0]!.autorizacion).toBe(`Bearer ${sim.token}`)

  // La sesión queda en el cliente principal y la contraseña no se guarda en el navegador.
  expect(await page.evaluate(() => sessionStorage.getItem('cuidared.auth.real'))).not.toBeNull()
  expect(await page.evaluate(() => Object.values(sessionStorage).join(' '))).not.toContain(CLAVE)
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
})

test('autorregistro de una organización: la ruta de entrada fija el tipo y filtra las categorías', async ({ page }) => {
  const sim = await simular(page)
  await page.goto('/registro-organizacion')
  await expect(page.getByRole('heading', { name: 'Registrar organización' })).toBeVisible()
  // Con el tipo ya elegido se empieza en los datos de la persona.
  await llenarDatos(page)
  await llenarClave(page)
  await verificarCodigo(page)

  await expect(page.getByLabel(/^Nombre de la organización/)).toBeVisible()
  await expect(page.getByLabel(/^Categoría/).locator('option')).toHaveText(['Elige una categoría', 'Iglesia o parroquia', 'Fundación u ONG'])
  await page.getByLabel(/^Nombre de la organización/).fill('Fundación Esperanza')
  await page.getByLabel(/^Categoría/).selectOption({ label: 'Fundación u ONG' })
  await page.getByLabel(/^Provincia/).selectOption({ label: 'Santiago' })
  await expect(page.getByLabel(/^Municipio/).locator('option')).toHaveText(['Elige un municipio', 'Santiago de los Caballeros', 'Bisonó'])
  await page.getByLabel(/^Municipio/).selectOption({ label: 'Bisonó' })
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page).toHaveURL(/\/cuenta$/)
  expect(sim.llamadas('GET', '/catalogos/categorias-cuenta')[0]!.consulta.get('tipo')).toBe('organizacion')
  // Los campos opcionales vacíos no se envían.
  expect(sim.llamadas('POST', '/cuentas')[0]!.cuerpo).toEqual({
    tipo: 'organizacion',
    nombre: 'Fundación Esperanza',
    categoria_cuenta_id: 4,
    municipio_cod: '2502',
  })
  await expect(page.getByTestId('resumen-cuenta')).toContainText('Organización')
  await expect(page.getByTestId('resumen-cuenta')).toContainText('Administrador · titular')
})

test('registro deshabilitado en Supabase: explica, ofrece la invitación y conserva lo escrito', async ({ page }) => {
  const sim = await simular(page, { registroDeshabilitado: true })
  await page.goto('/registro-familia')
  await llenarDatos(page)
  await llenarClave(page)

  const aviso = page.getByRole('alert')
  await expect(aviso).toContainText('El registro de cuentas todavía no está habilitado. Si recibiste una invitación, actívala aquí')
  await expect(aviso).not.toContainText('Signups not allowed')
  await expect(aviso.getByRole('link', { name: 'actívala aquí' })).toHaveAttribute('href', '/registro')
  // No avanzó ni pidió código; las contraseñas siguen escritas para reintentar.
  expect(sim.peticiones.some((p) => p.ruta.endsWith('/verify'))).toBe(false)
  await expect(page.getByLabel(/^Confirmar contraseña/)).toHaveValue(CLAVE)

  await page.locator('form').getByRole('button', { name: 'Volver' }).click()
  await expect(page.getByLabel(/^Cédula/)).toHaveValue('00112345678')
  await expect(page.getByLabel(/^Correo electrónico/)).toHaveValue(CORREO)

  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: 'Registrarme' }).click()
  await page.getByRole('link', { name: 'actívala aquí' }).click()
  await expect(page).toHaveURL(/\/registro$/)
  await expect(page.getByRole('heading', { name: 'Activar mi cuenta' })).toBeVisible()
})

test('correo ya registrado: respuesta genérica que no confirma si existe la cuenta', async ({ page }) => {
  await simular(page, { correoRegistrado: true })
  await page.goto('/registro-familia')
  await llenarDatos(page)
  await llenarClave(page)
  const aviso = page.getByRole('alert')
  await expect(aviso).toContainText('No se pudo crear la cuenta con esos datos. Si ya tienes una cuenta')
  await expect(aviso).not.toContainText(/already|registrado/i)
  await expect(aviso.getByRole('link', { name: 'inicia sesión' })).toHaveAttribute('href', '/inicio')
  await expect(aviso.getByRole('link', { name: 'recupera tu contraseña' })).toHaveAttribute('href', '/recuperar')
  await expect(page.getByLabel(/^Contraseña/)).toHaveValue(CLAVE)
})

test('código inválido: error junto al campo, conserva lo escrito y permite pedir otro código', async ({ page }) => {
  const sim = await simular(page, { codigoInvalido: true })
  await page.goto('/registro-familia')
  await llenarDatos(page)
  await llenarClave(page)
  await verificarCodigo(page, '999999')

  await expect(page.getByText('El código no es válido o ha vencido. Revisa tu correo o pide uno nuevo.')).toBeVisible()
  await expect(page.getByLabel(/^Código de verificación/)).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel(/^Código de verificación/)).toHaveValue('999999')
  await expect(page.getByLabel(/^Categoría/)).toHaveCount(0)
  expect(sim.llamadas('POST', '/cuentas')).toHaveLength(0)
  expect(sim.llamadas('GET', '/catalogos/provincias')).toHaveLength(0)

  await page.getByRole('button', { name: 'Reenviar código' }).click()
  await expect(page.getByText('Te enviamos un código nuevo.')).toBeVisible()
  expect(sim.peticiones.some((p) => p.ruta.endsWith('/resend') && p.cuerpo.type === 'signup' && p.cuerpo.email === CORREO_NORMAL)).toBe(true)

  // Con el código correcto el flujo continúa sin repetir lo anterior.
  sim.opciones.codigoInvalido = false
  await verificarCodigo(page, '654321')
  await expect(page.getByLabel(/^Categoría/)).toBeVisible()
})

test('INVALID_CATEGORY se muestra junto a la categoría y no borra lo escrito', async ({ page }) => {
  const sim = await simular(page, { categoriaInvalida: true })
  await llegarADatosDeCuenta(page, '/crear-cuenta')
  await llenarCuenta(page)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page.getByText('La categoría elegida no corresponde al tipo de cuenta. Elige otra de la lista.')).toBeVisible()
  await expect(page.getByLabel(/^Categoría/)).toHaveAttribute('aria-invalid', 'true')
  await expect(page).toHaveURL(/\/crear-cuenta$/)
  await expect(page.getByLabel(/^Nombre de la familia/)).toHaveValue('Familia Pérez')
  await expect(page.getByLabel(/^Municipio/)).toHaveValue('0101')
  await expect(page.getByLabel(/^Teléfono/)).toHaveValue('809-555-1234')
  await expect(page.locator('body')).not.toContainText('mensaje_privado')

  // Al corregir y reintentar se crea la cuenta sin repetir la verificación del correo.
  sim.opciones.categoriaInvalida = false
  await page.getByLabel(/^Categoría/).selectOption({ label: 'Cuidado en el hogar' })
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page).toHaveURL(/\/cuenta$/)
  expect(sim.peticiones.filter((p) => p.ruta.endsWith('/verify'))).toHaveLength(1)
  expect(sim.llamadas('POST', '/cuentas')[1]!.cuerpo.categoria_cuenta_id).toBe(2)
})

test('TRIAL_IN_PROGRESS explica que ya hay una prueba vigente y conserva el formulario', async ({ page }) => {
  await simular(page, { pruebaEnCurso: true })
  await llegarADatosDeCuenta(page, '/crear-cuenta')
  await llenarCuenta(page)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('alert')).toContainText('Ya tienes una cuenta con prueba gratuita vigente. Podrás abrir otra cuando termine.')
  await expect(page.getByLabel(/^Nombre de la familia/)).toHaveValue('Familia Pérez')
  await expect(page).toHaveURL(/\/crear-cuenta$/)
})

test('valida cada pantalla junto al campo antes de llamar a Supabase', async ({ page }) => {
  const sim = await simular(page)
  await page.goto('/registro-familia')

  // Datos de la persona: todo vacío.
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByText('La cédula debe tener exactamente 11 dígitos.')).toBeVisible()
  await expect(page.getByText('Escribe tus nombres.')).toBeVisible()
  await expect(page.getByText('Escribe tus apellidos.')).toBeVisible()
  await expect(page.getByText('Escribe un correo válido, por ejemplo nombre@correo.com.')).toBeVisible()
  await expect(page.getByLabel(/^Cédula/)).toHaveAttribute('aria-invalid', 'true')

  // La cédula solo admite dígitos (acepta pegar con guiones).
  await page.getByLabel(/^Cédula/).fill('001-1234567-8')
  await expect(page.getByLabel(/^Cédula/)).toHaveValue('00112345678')
  await page.getByLabel(/^Nombres/).fill('Ana')
  await page.getByLabel(/^Apellidos/).fill('Pérez')
  await page.getByLabel(/^Correo electrónico/).fill('sin-arroba')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByText('Escribe un correo válido, por ejemplo nombre@correo.com.')).toBeVisible()
  await page.getByLabel(/^Correo electrónico/).fill(CORREO)
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()

  // Contraseña débil, distinta y sin aceptar los términos.
  await page.getByLabel(/^Contraseña/).fill('debil')
  await page.getByLabel(/^Confirmar contraseña/).fill('otra')
  await page.getByRole('button', { name: 'Registrarme' }).click()
  await expect(page.getByText('Usa al menos 8 caracteres con mayúscula, minúscula, número y símbolo.')).toBeVisible()
  await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible()
  await expect(page.getByText('Debes aceptar los Términos y la Política de privacidad para crear tu cuenta.')).toBeVisible()
  expect(sim.peticiones.some((p) => p.ruta.endsWith('/signup'))).toBe(false)
})

test('valida los datos de la cuenta junto a cada campo y no los envía incompletos', async ({ page }) => {
  const sim = await simular(page)
  await llegarADatosDeCuenta(page, '/crear-cuenta')
  await page.getByLabel(/^Teléfono/).fill('123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByText('El nombre debe tener entre 2 y 120 caracteres.')).toBeVisible()
  await expect(page.getByText('Elige la categoría de la cuenta.')).toBeVisible()
  await expect(page.getByText('Elige la provincia.')).toBeVisible()
  await expect(page.getByText('Elige el municipio.')).toBeVisible()
  await expect(page.getByText('Escribe un teléfono de 10 a 15 dígitos, por ejemplo 809-555-1234.')).toBeVisible()
  expect(sim.llamadas('POST', '/cuentas')).toHaveLength(0)
})

test('quien ya tiene sesión y ninguna cuenta crea la suya sin repetir el registro de la persona', async ({ page }) => {
  const sim = await simular(page, { cuentas: [] })
  await iniciarSesion(page, 'laura@example.test')
  await expect(page.getByText(/Todavía no perteneces a ninguna familia u organización/)).toBeVisible()
  await page.getByRole('link', { name: 'Crear una cuenta' }).click()

  await expect(page).toHaveURL(/\/crear-cuenta$/)
  await page.getByRole('radio', { name: 'Organización' }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  // Salta persona, contraseña y código: ya hay sesión.
  await expect(page.getByLabel(/^Nombre de la organización/)).toBeVisible()
  await page.getByLabel(/^Nombre de la organización/).fill('Hogar San José')
  await page.getByLabel(/^Categoría/).selectOption({ label: 'Iglesia o parroquia' })
  await page.getByLabel(/^Provincia/).selectOption({ label: 'Distrito Nacional' })
  await page.getByLabel(/^Municipio/).selectOption({ label: 'Santo Domingo de Guzmán' })
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page).toHaveURL(/\/cuenta$/)
  await expect(page.getByTestId('cuentas-conectadas').getByRole('button', { name: /Hogar San José/ })).toHaveAttribute('aria-current', 'true')
  expect(sim.peticiones.some((p) => p.ruta.endsWith('/signup') || p.ruta.endsWith('/verify'))).toBe(false)
  expect(sim.llamadas('POST', '/cuentas')[0]!.autorizacion).toBe(`Bearer ${sim.token}`)
})
