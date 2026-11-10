/*
 * cuentas.spec.ts — CR-175: cuentas activas independientes del perfil.
 * Auth y API interceptados: no usa correo ni base reales.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page } from '@playwright/test'

const userId = 'b3d1f9a0-1111-4c45-b5ba-dbc6a0019999'
const authUser = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'carla@example.test',
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
const profile = { id: userId, cedula: '00112345679', nombres: 'Carla', apellidos: 'Gómez', correo: authUser.email, telefono: null, estado: 'activo' }
const cuentas = [
  { cuenta_id: 'org-a', nombre: 'Fundación Esperanza', tipo: 'organizacion', rol: 'cuidador', estado_membresia: 'activa', permisos: ['visitas:registrar', 'necesidades:registrar'], estado_suscripcion: 'activa' },
  { cuenta_id: 'fam-b', nombre: 'Familia Méndez', tipo: 'familia', rol: 'coordinador', estado_membresia: 'activa', permisos: ['usuarios:gestionar', 'visitas:programar', 'alertas:gestionar'], estado_suscripcion: 'prueba' },
  { cuenta_id: 'org-c', nombre: 'Cuenta anterior', tipo: 'organizacion', rol: 'voluntario', estado_membresia: 'inactiva', permisos: [], estado_suscripcion: 'activa' },
]

async function mock(page: Page, conCuentas: boolean) {
  let consultasCuentas = 0
  await page.route('https://auth.cuidared.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    await route.fulfill({ json: path.endsWith('/token') || path.endsWith('/verify') ? session : path.endsWith('/user') ? authUser : {} })
  })
  await page.route('http://localhost:3301/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/me') && route.request().method() === 'GET') {
      await route.fulfill({ json: { data: { identity: { id: userId, email: authUser.email }, profile } } })
    } else if (path.endsWith('/cuentas')) {
      consultasCuentas++
      if (conCuentas) {
        await route.fulfill({ json: { data: cuentas.filter((c) => c.estado_membresia === 'activa'), meta: { page: 1, limit: 20, total: 2, totalPages: 1 } } })
      } else await route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE' } } })
    } else if (path.endsWith('/me/membresias')) {
      await route.fulfill({ json: { data: [] } })
    } else await route.fulfill({ status: 204 })
  })
  return () => consultasCuentas
}

async function entrar(page: Page) {
  await page.goto('/inicio')
  await page.getByLabel(/^Correo electrónico/).fill(authUser.email)
  await page.getByLabel(/^Contraseña/).fill('Fuerte123!')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await page.getByRole('link', { name: 'Mi cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible()
}

test('CR-175: lista solo las cuentas activas y cambia de cuenta recalculando permisos', async ({ page }) => {
  const consultas = await mock(page, true)
  await entrar(page)
  const lista = page.getByTestId('cuentas-conectadas')
  await expect(lista.getByRole('button')).toHaveCount(2)
  await expect(lista).not.toContainText('Cuenta anterior')
  await expect(lista.getByRole('button', { name: /Fundación Esperanza/ })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByTestId('permisos-cuenta')).toContainText('2 funciones')

  const antes = consultas()
  await lista.getByRole('button', { name: /Familia Méndez/ }).click()
  await expect(lista.getByRole('button', { name: /Familia Méndez/ })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByTestId('permisos-cuenta')).toContainText('3 funciones')
  await expect.poll(consultas).toBeGreaterThan(antes)

  // Recargar conserva la sesión y la cuenta elegida.
  await page.reload()
  await expect(page.getByTestId('cuentas-conectadas').getByRole('button', { name: /Familia Méndez/ })).toHaveAttribute('aria-current', 'true')
})

test('CR-175: las cuentas no disponibles conservan el perfil de fase 1', async ({ page }) => {
  await mock(page, false)
  await entrar(page)
  await expect(page.getByText('No se pudieron consultar tus cuentas.')).toBeVisible()
  await expect(page.getByLabel(/^Nombres/)).toHaveValue('Carla')
  await expect(page.getByTestId('cuentas-conectadas')).toHaveCount(0)
})
