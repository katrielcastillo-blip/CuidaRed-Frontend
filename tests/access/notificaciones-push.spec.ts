/* Suscripción y navegación de avisos Web Push. © 2026 Equipo CuidaRed – INTEC. */
import { expect, test } from '@playwright/test'
import { API, CLAVE, cuentaActiva, simular } from './ayudas-fase2'

const cuentaId = '9007199254740993'
const destino = `/operacion/${cuentaId}/alertas?bandeja=avisos`
const endpoint = 'https://fcm.googleapis.com/fcm/send/dispositivo-de-prueba'
const push = `${API}/api/v1/notificaciones-push`

test('una notificación recupera la sesión vigente después de cerrar la pestaña', async ({ page, context }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Familia CuidaRed', permisos: ['alertas:ver'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  await context.route(`${API}/api/v1/cuentas/${cuentaId}/contexto`, (ruta) => ruta.fulfill({ json: { data: cuenta } }))
  await context.route(`${API}/api/v1/cuentas/${cuentaId}/notificaciones-alerta?*`, (ruta) => ruta.fulfill({ json: {
    data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  } }))

  await page.goto(destino)
  await page.getByLabel(/^Correo electrónico/).fill(sim.correo)
  await page.getByLabel(/^Contraseña/).fill(CLAVE)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Notificaciones de alertas' })).toBeVisible()
  const cookies = await context.cookies()
  expect(cookies.find((cookie) => cookie.name === '__Secure-cuidared-browser')).toMatchObject({
    httpOnly: true, secure: true, sameSite: 'Strict',
  })
  expect(await page.evaluate(() => sessionStorage.getItem('cuidared.auth.real'))).toBeNull()
  await page.close()
  const reabierta = await context.newPage()
  await reabierta.goto(destino)
  await expect(reabierta.getByRole('region', { name: 'Notificaciones de alertas' })).toBeVisible()
  await expect(reabierta).toHaveURL(destino)
  await expect(reabierta.getByLabel(/^Contraseña/)).toHaveCount(0)
})

test('conserva la bandeja al iniciar sesión y solicita el permiso al activar este dispositivo', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Familia CuidaRed', tipo: 'familia', rol: 'coordinador', permisos: ['alertas:ver'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const suscripciones: unknown[] = []
  const revocaciones: unknown[] = []
  let habilitado = true
  await page.addInitScript((endpointFicticio) => {
    const clave = 'cuidaRedPruebaSuscripcion'
    const suscripcion = {
      endpoint: endpointFicticio,
      toJSON: () => ({ keys: { p256dh: 'publica-prueba', auth: 'auth-prueba' } }),
      unsubscribe: () => { localStorage.removeItem(clave); return Promise.resolve(true) },
    }
    const pushManager = {
      getSubscription: () => Promise.resolve(localStorage.getItem(clave) ? suscripcion : null),
      subscribe: (opciones: PushSubscriptionOptionsInit) => {
        if (opciones.userVisibleOnly !== true || (opciones.applicationServerKey as Uint8Array)[0] !== 4) {
          throw new Error('Opciones de suscripción incorrectas.')
        }
        localStorage.setItem(clave, '1')
        return Promise.resolve(suscripcion)
      },
    }
    Object.defineProperty(navigator, 'serviceWorker', { value: {
      getRegistration: () => Promise.resolve({ active: {}, pushManager }),
    } })
    Object.defineProperty(window, 'PushManager', { value: Object })
    Object.defineProperty(window, 'Notification', { value: { permission: 'default' } })
  }, endpoint)
  await page.route(`${push}/configuracion`, (ruta) => ruta.fulfill({ json: {
    data: { habilitado, clave_publica: habilitado ? Buffer.from([4, ...Array<number>(64).fill(1)]).toString('base64url') : null },
  } }))
  await page.route(`${push}/suscripciones`, async (ruta) => {
    suscripciones.push(ruta.request().postDataJSON())
    await ruta.fulfill({ status: 204 })
  })
  await page.route(`${push}/suscripciones/estado`, async (ruta) => {
    expect(ruta.request().method()).toBe('POST')
    expect(ruta.request().postDataJSON()).toEqual({ endpoint })
    await ruta.fulfill({ json: { data: { activa: true } } })
  })
  await page.route(`${push}/suscripciones/revocar`, async (ruta) => {
    revocaciones.push(ruta.request().postDataJSON())
    await ruta.fulfill({ status: 204 })
  })
  await page.route(`${API}/api/v1/cuentas/${cuentaId}/contexto`, (ruta) => ruta.fulfill({ json: { data: cuenta } }))
  await page.route(`${API}/api/v1/cuentas/${cuentaId}/notificaciones-alerta?*`, (ruta) => ruta.fulfill({ json: {
    data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  } }))

  await page.goto(destino)
  await page.getByLabel(/^Correo electrónico/).fill(sim.correo)
  await page.getByLabel(/^Contraseña/).fill(CLAVE)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page).toHaveURL(destino)
  const habilitar = page.getByRole('button', { name: 'Activar notificaciones', exact: true })
  await expect(habilitar).toBeVisible()
  expect(suscripciones).toEqual([])
  await habilitar.click()
  await expect(page.getByText('Notificaciones activadas para este dispositivo.')).toBeVisible()
  expect(suscripciones).toEqual([{ endpoint, keys: { p256dh: 'publica-prueba', auth: 'auth-prueba' } }])
  habilitado = false
  await page.reload()
  await expect(page.getByText('El envío está pausado.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Desactivar notificaciones' }).click()
  await expect(page.getByRole('region', { name: 'Notificaciones en este dispositivo' })).toHaveCount(0)
  expect(revocaciones).toEqual([{ endpoint }])

  habilitado = true
  await page.reload()
  await page.getByRole('button', { name: 'Activar notificaciones', exact: true }).click()
  await expect(page.getByText('Notificaciones activadas para este dispositivo.')).toBeVisible()
  await page.goto('/cuenta')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL('/inicio')
  expect(revocaciones).toEqual([{ endpoint }, { endpoint }])
  expect(await page.evaluate(() => localStorage.getItem('cuidaRedPruebaSuscripcion'))).toBeNull()
})
