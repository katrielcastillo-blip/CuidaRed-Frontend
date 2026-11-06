/* Integración UI ID01: jamás usa correo ni base reales. © 2026 Equipo CuidaRed – INTEC. */
import { expect, test, type Page } from '@playwright/test'

const userId = 'a271ce25-7f40-4c45-b5ba-dbc6a0011234'
const authUser = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'ana@example.test',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}
const token = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: userId, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'test-signature',
].join('.')
const session = { access_token: token, refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, user: authUser }
const initialProfile = {
  id: userId,
  cedula: '00112345678',
  nombres: 'Ana',
  apellidos: 'Pérez',
  correo: authUser.email,
  telefono: null,
  estado: 'activo',
}

async function mockServices(
  page: Page,
  options: {
    profileMissing?: boolean
    inactive?: boolean
    invalidCode?: boolean
    loginFails?: boolean
    unavailable?: boolean
    expired?: boolean
    profileDenied?: boolean
    patchError?: { status: number; code: string }
  } = {},
) {
  let profile: typeof initialProfile | null = options.profileMissing ? null : { ...initialProfile }
  const requests: Array<{ path: string; body: Record<string, unknown> }> = []
  await page.route('https://auth.cuidared.test/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body = request.postDataJSON() ?? {}
    requests.push({ path, body })
    if (path.endsWith('/token') && options.loginFails) {
      await route.fulfill({ status: 400, json: { code: 'invalid_credentials', msg: 'provider details must not be displayed' } })
      return
    }
    if (path.endsWith('/verify') && options.invalidCode) {
      await route.fulfill({ status: 403, json: { code: 'otp_expired', msg: 'expired' } })
      return
    }
    await route.fulfill({ json: path.endsWith('/token') || path.endsWith('/verify') ? session : path.endsWith('/user') ? authUser : {} })
  })
  await page.route('http://localhost:3301/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body = request.postDataJSON() ?? {}
    requests.push({ path, body })
    if (options.inactive || options.unavailable || options.expired) {
      await route.fulfill({
        status: options.inactive ? 403 : options.expired ? 401 : 503,
        json: { error: { code: options.inactive ? 'USER_INACTIVE' : options.expired ? 'INVALID_SESSION' : 'DEPENDENCY_UNAVAILABLE' } },
      })
      return
    }
    if (options.patchError && request.method() === 'PATCH') {
      await route.fulfill({
        status: options.patchError.status,
        json: {
          error: { code: options.patchError.code, message: 'private_message', details: 'private_details' },
          requestId: 'test-request',
        },
      })
      return
    }
    if (options.profileDenied && request.method() === 'GET' && path.endsWith('/me')) {
      await route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN', message: 'private_message' }, requestId: 'test-request' } })
      return
    }
    if (path.endsWith('/me')) {
      if (!profile) {
        await route.fulfill({ status: 409, json: { error: { code: 'PROFILE_REQUIRED' } } })
        return
      }
      if (request.method() === 'PATCH') profile = { ...profile!, ...body }
      if (request.method() === 'POST') profile = { ...initialProfile, ...body }
      await route.fulfill({
        json: {
          data:
            request.method() === 'GET' ? { identity: { id: userId, email: authUser.email }, profile, profileRequired: !profile } : profile,
        },
      })
    } else await route.fulfill({ status: 204 })
  })
  return requests
}

async function login(page: Page) {
  await page.goto('/inicio')
  await page.getByLabel(/^Correo electrónico/).fill(authUser.email)
  await page.getByLabel(/^Contraseña/).fill('Fuerte123!')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
}

for (const [status, code, message] of [
  [403, 'FORBIDDEN', 'Tu usuario no tiene acceso.'],
  [404, 'NOT_FOUND', 'Recurso no encontrado.'],
  [422, 'INVALID_INPUT', 'Revisa los datos del formulario.'],
] as const) {
  test(`CR-162: ${code} conserva el formulario sin mostrar detalles técnicos`, async ({ page }) => {
    const requests = await mockServices(page, { patchError: { status, code } })
    await login(page)
    await page.getByLabel(/^Nombres/).fill('Anabel')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByRole('alert')).toContainText(message)
    await expect(page.getByLabel(/^Nombres/)).toHaveValue('Anabel')
    await expect(page).toHaveURL(/\/cuenta$/)
    await expect(page.locator('body')).not.toContainText('private_message')
    await expect(page.locator('body')).not.toContainText('private_details')
    expect(requests.some((request) => request.path.endsWith('/logout'))).toBe(false)
  })
}

test('CR-162: un 403 de permisos oculta el perfil sin cerrar una sesión válida', async ({ page }) => {
  const requests = await mockServices(page, { profileDenied: true })
  await login(page)
  await expect(page).toHaveURL(/\/cuenta$/)
  await expect(page.getByRole('alert')).toContainText('Tu usuario no tiene acceso.')
  await expect(page.getByLabel(/^Nombres/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  expect(requests.some((request) => request.path.endsWith('/logout'))).toBe(false)
})

test('login, perfil persistido por API, recarga y cierre sin datos del simulador', async ({ page }) => {
  const requests = await mockServices(page)
  await login(page)
  await expect(page.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible()
  await expect(page.getByLabel(/^Nombres/)).toHaveValue('Ana')
  await page.getByLabel(/^Nombres/).fill('Anabel')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status')).toContainText('Cambios guardados')
  expect(requests.some((r) => r.path === '/api/v1/me' && r.body.nombres === 'Anabel')).toBe(true)
  await page.reload()
  await expect(page.getByLabel(/^Nombres/)).toHaveValue('Anabel')
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
  expect(await page.evaluate(() => Object.values(sessionStorage).join(' '))).not.toContain('Fuerte123!')
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/cuenta$/)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/inicio$/)
  expect(requests.some((r) => r.path.endsWith('/session/logout'))).toBe(true)
  expect(await page.evaluate(() => sessionStorage.getItem('cuidared.auth.real'))).toBeNull()
})

test('credenciales inválidas muestran un mensaje genérico', async ({ page }) => {
  await mockServices(page, { loginFails: true })
  await login(page)
  await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos.')
  await expect(page.getByRole('alert')).not.toContainText('provider details')
  await expect(page).toHaveURL(/\/inicio$/)
})

test('usuario desactivado no ve módulos ni perfil', async ({ page }) => {
  await mockServices(page, { inactive: true })
  await login(page)
  await expect(page.getByRole('alert')).toContainText('Tu usuario no tiene acceso.')
  await expect(page.getByLabel(/^Nombres/)).not.toBeVisible()
})

test('recuperación genérica y cambio de contraseña con código Supabase', async ({ page }) => {
  const requests = await mockServices(page)
  await page.goto('/recuperar')
  await page.getByLabel(/^Correo electrónico/).fill('sin-cuenta@example.test')
  await page.getByRole('button', { name: 'Enviar código', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Si el correo pertenece a una cuenta')
  await expect(page.getByText('Modo demostración')).not.toBeVisible()
  await page.getByRole('link', { name: 'Ingresar el código' }).click()
  await page.getByLabel(/^Correo electrónico/).fill(authUser.email)
  await page.getByLabel(/^Código de verificación/).fill('123456')
  await page.getByLabel(/^Nueva contraseña/).fill('Otra123!')
  await page.getByLabel(/^Confirmar contraseña/).fill('Otra123!')
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click()
  await expect(page).toHaveURL(/\/inicio$/)
  expect(requests.some((r) => r.path.endsWith('/verify') && r.body.type === 'recovery')).toBe(true)
  expect(requests.some((r) => r.path.endsWith('/user') && r.body.password === 'Otra123!')).toBe(true)
  expect(await page.evaluate(() => sessionStorage.getItem('cuidared.auth.real'))).toBeNull()
})

test('activa solo invitación y confirma el perfil previo sin asignarse rol', async ({ page }) => {
  const requests = await mockServices(page)
  await page.goto('/registro')
  await page.getByLabel(/^Correo electrónico/).fill(authUser.email)
  await page.getByLabel(/^Código de invitación/).fill('123456')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByLabel(/^Cédula/)).toHaveValue('00112345678')
  await expect(page.getByLabel(/^Cédula/)).toHaveAttribute('readonly', '')
  await page.getByLabel(/^Nombres/).fill('Ana')
  await page.getByLabel(/^Apellidos/).fill('Pérez')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByLabel(/^Contraseña/).fill('Nueva123!')
  await page.getByLabel(/^Confirmar contraseña/).fill('Nueva123!')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Activar cuenta' }).click()
  await expect(page).toHaveURL(/\/cuenta$/)
  await expect(page.getByLabel(/^Nombres/)).toHaveValue('Ana')
  expect(requests.some((r) => r.path.endsWith('/verify') && r.body.type === 'invite')).toBe(true)
  const changes = requests.filter((r) => r.path === '/api/v1/me' && r.body.nombres)
  expect(changes).toHaveLength(1)
  expect(changes.every((r) => !('rol' in r.body) && !('estado' in r.body) && !('cedula' in r.body))).toBe(true)
  expect(requests.some((r) => r.path.endsWith('/signup'))).toBe(false)
})

test('un código inválido no permite avanzar ni crear perfil', async ({ page }) => {
  const requests = await mockServices(page, { invalidCode: true })
  await page.goto('/registro')
  await page.getByLabel(/^Correo electrónico/).fill(authUser.email)
  await page.getByLabel(/^Código de invitación/).fill('999999')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('El código no es válido o ha vencido')
  await expect(page.getByLabel(/^Cédula/)).not.toBeVisible()
  expect(requests.some((r) => r.path === '/api/v1/me')).toBe(false)
})

test('la sesión vencida en servidor pierde acceso al perfil', async ({ page }) => {
  const options = { expired: false }
  await mockServices(page, options)
  await login(page)
  await expect(page.getByLabel(/^Nombres/)).toHaveValue('Ana')
  options.expired = true
  await page.reload()
  await expect(page).toHaveURL(/\/inicio$/)
  await expect(page.getByRole('alert')).toContainText('Tu sesión venció')
  expect(await page.evaluate(() => sessionStorage.getItem('cuidared.auth.real'))).toBeNull()
})

test('un fallo de API al guardar conserva los datos escritos y no anuncia éxito', async ({ page }) => {
  const options = { unavailable: false }
  await mockServices(page, options)
  await login(page)
  await expect(page.getByLabel(/^Nombres/)).toHaveValue('Ana')
  await page.getByLabel(/^Nombres/).fill('Nombre pendiente')
  options.unavailable = true
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('alert').first()).toContainText('No se pudo conectar')
  await expect(page.getByLabel(/^Nombres/)).toHaveValue('Nombre pendiente')
  await expect(page.getByText('Cambios guardados.')).not.toBeVisible()
})
