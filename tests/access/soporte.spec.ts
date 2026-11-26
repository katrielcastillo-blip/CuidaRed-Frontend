/*
 * soporte.spec.ts — Solicitud y conversación de soporte sin correos ni borrados reales.
 * Módulo: acceso conectado. © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page } from '@playwright/test'
import { API, cuentaActiva, iniciarSesionEnMiCuenta, miembro, simular } from './ayudas-fase2'
import type { SolicitudSoporte } from '../../src/features/access-real/api/soporte'

async function preparar(page: Page) {
  const inactivo = miembro('5', 'Gloria', 'Inactiva', 'cuidador', 'inactiva')
  await simular(page, { cuentas: [cuentaActiva({ cuenta_id: 'org-a', nombre: 'Organización de prueba' })], miembros: { 'org-a': [inactivo] } })
  const date = new Date().toISOString()
  let ticket: SolicitudSoporte | undefined
  const requests: Array<{ method: string; path: string; body: Record<string, unknown> }> = []
  const pendientes: Array<() => void> = []
  page.on('close', () => pendientes.splice(0).forEach((r) => r()))
  await page.route(API + '/api/v1/cuentas/org-a/soporte**', async (route) => {
    const req = route.request()
    const headers = { 'access-control-allow-origin': req.headers().origin ?? 'http://localhost:5184', 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,OPTIONS' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const path = new URL(req.url()).pathname.split('/soporte')[1]
    const body = req.method() === 'POST' ? req.postDataJSON() as Record<string, unknown> : {}
    requests.push({ method: req.method(), path, body })
    if (path === '/eventos') {
      await new Promise<void>((resolve) => pendientes.push(resolve))
      try { await route.fulfill({ headers, contentType: 'text/event-stream', body: 'data: {"tema":"soporte"}\n\n' }) } catch { /* pestaña cerrada */ }
      return
    }
    if (path === '' && req.method() === 'POST') {
      ticket = { id: '1', codigo: 'SOP-000001', cuenta: { id: 'org-a', nombre: 'Organización de prueba' }, asunto: String(body.asunto), descripcion: String(body.descripcion), tipo: body.tipo as SolicitudSoporte['tipo'], estado: 'abierta', creado_en: date, actualizado_en: date, solicitante: { id: 'admin', nombre: 'Administradora' }, asignado: null,
        usuario_objetivo: body.usuario_objetivo_id ? { id: inactivo.usuario.id, nombre: 'Gloria Inactiva', correo: inactivo.usuario.correo, estado: 'suspendido' } : null, mensajes: [] }
      return route.fulfill({ headers, status: 201, json: { data: ticket } })
    }
    if (path === '') return route.fulfill({ headers, json: { data: ticket ? [ticket] : [], meta: { page: 1, limit: 25, total: ticket ? 1 : 0, totalPages: 1 } } })
    if (path === '/1/mensajes' && ticket) {
      ticket.mensajes!.push({ id: '2', origen: 'organizacion', texto: String(body.mensaje), autor: 'Administradora', estado: 'en_revision', creado_en: new Date().toISOString() })
      ticket.estado = 'en_revision'; ticket.actualizado_en = new Date().toISOString()
    }
    return route.fulfill({ headers, json: { data: ticket } })
  })
  await iniciarSesionEnMiCuenta(page, 'laura@example.test')
  await page.getByRole('link', { name: 'Miembros de la cuenta' }).click()
  return { requests, inactivo, pendientes, responder: () => {
    ticket!.estado = 'esperando_informacion'; ticket!.actualizado_en = new Date(Date.now() + 1000).toISOString()
    ticket!.mensajes!.push({ id: '1', origen: 'backoffice', texto: 'Necesitamos confirmar el motivo de esta solicitud.', estado: 'esperando_informacion', autor: 'Equipo CuidaRed', creado_en: ticket!.actualizado_en })
    pendientes.splice(0).forEach((resolver) => resolver())
  } }
}

test('el administrador envía una solicitud y conserva su código de seguimiento', async ({ page }, info) => {
  const sim = await preparar(page)
  await page.getByRole('button', { name: 'Contactar soporte', exact: true }).click()
  await page.getByLabel('Tipo de solicitud', { exact: true }).selectOption('eliminar_usuario')
  await page.getByLabel('Usuario que solicitas eliminar').selectOption('5')
  await page.getByLabel(/^Asunto/).fill('Revisar eliminación del miembro inactivo')
  await page.getByLabel('Describe lo que necesitas').fill('El miembro está inactivo y necesitamos volver a invitarlo con otro rol.')
  await page.getByRole('button', { name: 'Enviar solicitud de soporte', exact: true }).click()
  await expect(page.getByText('SOP-000001', { exact: true })).toBeVisible()
  const payload = sim.requests.find((r) => r.method === 'POST' && r.path === '')!.body
  expect(payload.usuario_objetivo_id).toBe(sim.inactivo.usuario.id)
  expect(payload.tipo).toBe('eliminar_usuario')
  expect(sim.requests.some((r) => r.path.includes('eliminacion'))).toBe(false)
  await page.getByRole('button', { name: 'Ver solicitudes', exact: true }).click()
  await expect(page.getByRole('button').filter({ hasText: 'SOP-000001' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.screenshot({ path: info.outputPath('soporte-organizacion.png'), fullPage: true })
})

test('la ficha inactiva abre el formulario con el miembro seleccionado y recibe respuestas', async ({ page }) => {
  const sim = await preparar(page)
  await page.getByRole('button', { name: 'Ver más de Gloria Inactiva', exact: true }).click()
  await page.getByRole('button', { name: 'Solicitar eliminación a soporte', exact: true }).click()
  await expect(page.getByLabel('Usuario que solicitas eliminar')).toHaveValue('5')
  await page.getByLabel(/^Asunto/).fill('Eliminar el acceso antiguo de Gloria')
  await page.getByLabel('Describe lo que necesitas').fill('Solicitamos eliminar el acceso inactivo después de revisar los registros vinculados.')
  await page.getByRole('button', { name: 'Enviar solicitud de soporte', exact: true }).click()
  await expect(page.getByText('SOP-000001', { exact: true })).toBeVisible()
  await expect.poll(() => sim.pendientes.length).toBeGreaterThan(0)
  sim.responder()
  await expect(page.getByText('Necesitamos confirmar el motivo de esta solicitud.', { exact: true })).toBeVisible()
  await page.getByLabel('Mensaje para soporte').fill('Confirmamos que el correo se usará para una nueva invitación.')
  await page.getByRole('button', { name: 'Enviar respuesta', exact: true }).click()
  await expect(page.getByText('Confirmamos que el correo se usará para una nueva invitación.', { exact: true })).toBeVisible()
  expect(sim.requests.find((r) => r.path === '/1/mensajes')?.body.version).toBeTruthy()
})

test('el coordinador de Familia conserva Miembros y no muestra contacto de organización', async ({ page }) => {
  await simular(page, { cuentas: [cuentaActiva({ cuenta_id: 'fam-b', nombre: 'Familia de prueba', tipo: 'familia', rol: 'coordinador' })], miembros: { 'fam-b': [] } })
  await iniciarSesionEnMiCuenta(page, 'laura@example.test')
  await page.getByRole('link', { name: 'Miembros de la cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Miembros', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Contactar soporte', exact: true })).toHaveCount(0)
})
