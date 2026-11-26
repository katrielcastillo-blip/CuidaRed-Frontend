/*
 * marca.spec.ts — Publicación de marca en portada y login, restauración y referencia local segura.
 * Módulo: acceso conectado. Servicios e imágenes interceptados; sin datos ni identidades reales.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { simular } from './ayudas-fase2'

const API = 'http://localhost:3301/api/admin/marca'
const proyecto = 'https://auth.cuidared.test'
const original = proyecto + '/storage/v1/object/public/cuidared-marca/completo_claro/original.png?v=1'
const navidad = proyecto + '/storage/v1/object/public/cuidared-marca/completo_claro/navidad.png?v=2'
const png = readFileSync(new URL('../../public/brand/logo.png', import.meta.url))

test('la portada y el login reciben el logo publicado y permiten volver al predeterminado', async ({ page }) => {
  await simular(page)
  let marca: Record<string, string> = { completo_claro: original }
  const pendientes: Array<() => void> = []
  page.on('close', () => pendientes.splice(0).forEach((resolver) => resolver()))
  await page.route(proyecto + '/storage/v1/object/public/cuidared-marca/**', (route) => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route(API, (route) => route.fulfill({ json: { data: marca } }))
  await page.route(API + '/eventos', async (route) => {
    await new Promise<void>((resolve) => pendientes.push(resolve))
    try { await route.fulfill({ contentType: 'text/event-stream', body: 'event: marca\r\ndata: {"tema":"marca"}\r\n\r\n' }) } catch { /* cierre de la pestaña de prueba */ }
  })
  await page.goto('/')
  const cabecera = page.getByRole('link', { name: 'CuidaRed, inicio', exact: true }).first().locator('img')
  const pie = page.getByRole('contentinfo').getByRole('link', { name: 'CuidaRed, inicio', exact: true }).locator('img')
  await expect(cabecera).toHaveAttribute('src', original)
  await expect(pie).toHaveAttribute('src', original)
  await expect.poll(() => pendientes.length).toBeGreaterThan(0)
  marca = { completo_claro: navidad }
  pendientes.shift()!()
  await expect(cabecera).toHaveAttribute('src', navidad)
  await expect(pie).toHaveAttribute('src', navidad)
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).first().click()
  const login = page.getByRole('img', { name: 'CuidaRed', exact: true })
  await expect(login).toHaveAttribute('src', navidad)
  marca = {}
  await page.reload()
  await expect(login).toHaveAttribute('src', '/brand/logo.png')
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('cuidared:marca:')))).toEqual([])
})

test('el login conserva la última referencia válida si la API de marca no responde', async ({ page }) => {
  await simular(page)
  await page.addInitScript((url) => localStorage.setItem('cuidared:marca:https://auth.cuidared.test', JSON.stringify({ completo_claro: url })), navidad)
  await page.route(proyecto + '/storage/v1/object/public/cuidared-marca/**', (route) => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route(API, (route) => route.fulfill({ status: 503, json: {} }))
  await page.route(API + '/eventos', (route) => route.fulfill({ status: 503, body: '' }))
  await page.goto('/inicio')
  const login = page.getByRole('img', { name: 'CuidaRed', exact: true })
  await expect(login).toHaveAttribute('src', navidad)
  await page.reload()
  await expect(login).toHaveAttribute('src', navidad)
})

test('una referencia externa o inválida no sustituye el logo de CuidaRed', async ({ page }) => {
  await simular(page)
  await page.addInitScript(() => {
    localStorage.setItem('cuidared:marca:https://auth.cuidared.test', JSON.stringify({ completo_claro: 'https://externo.example.test/storage/v1/object/public/cuidared-marca/logo.png' }))
  })
  const externas: string[] = []
  await page.route('https://externo.example.test/**', (route) => { externas.push(route.request().url()); return route.abort() })
  await page.route(API, (route) => route.fulfill({ json: { data: { completo_claro: 'javascript:alert(1)' } } }))
  await page.route(API + '/eventos', (route) => route.fulfill({ status: 503, body: '' }))
  await page.goto('/inicio')
  await expect(page.getByRole('img', { name: 'CuidaRed', exact: true })).toHaveAttribute('src', '/brand/logo.png')
  expect(externas).toEqual([])
})
