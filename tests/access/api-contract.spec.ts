/* Consumo frontend del contrato CR-162 sin servicios reales. © 2026 Equipo CuidaRed – INTEC. */
import { expect, test } from '@playwright/test'
import { collectionSearch, readPaginatedResponse } from '../../src/lib/api-contract'

test('CR-162: serializa página, orden y filtros sin perder falsos o ceros', () => {
  const params = new URLSearchParams(
    collectionSearch({
      page: 2,
      limit: 100,
      sort: ['-fecha_creacion', 'nombres'],
      filters: { estado: 'activo', cantidad: 0, confirmado: false },
    }),
  )
  expect(Object.fromEntries(params)).toEqual({
    page: '2',
    limit: '100',
    sort: '-fecha_creacion,nombres',
    'filter[estado]': 'activo',
    'filter[cantidad]': '0',
    'filter[confirmado]': 'false',
  })
  expect(Object.fromEntries(new URLSearchParams(collectionSearch()))).toEqual({ page: '1', limit: '20' })
})

test('CR-162: rechaza límites y metadatos inconsistentes sin inventar una página vacía', () => {
  expect(() => collectionSearch({ limit: 101 })).toThrow('Revisa los parámetros de consulta.')
  expect(() => collectionSearch({ sort: ['nombres', '-nombres'] })).toThrow()
  expect(() => readPaginatedResponse({ data: [] })).toThrow('No se pudo interpretar el listado.')
  expect(() => readPaginatedResponse({ data: [], meta: { page: 1, limit: 20, total: 21, totalPages: 1 } })).toThrow()
  expect(readPaginatedResponse({ data: [], meta: { page: 8, limit: 20, total: 21, totalPages: 2 } })).toEqual({
    data: [],
    meta: { page: 8, limit: 20, total: 21, totalPages: 2 },
  })
})

test('CR-162: apiPage transmite la consulta y conserva data y meta del backend', async ({ page }) => {
  let received = ''
  await page.route('http://localhost:3301/api/v1/pruebas**', async (route) => {
    received = route.request().url()
    expect(route.request().headers().authorization).toBe('Bearer test-token')
    await route.fulfill({ json: { data: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } } })
  })
  await page.goto('/inicio')
  const result = await page.evaluate(async () => {
    const modulePath = '/src/features/access-real/client.ts'
    const client = await import(modulePath)
    return client.apiPage('/pruebas', 'test-token', { page: 2, filters: { estado: 'activo' }, sort: ['-fecha_creacion'] })
  })
  expect(Object.fromEntries(new URL(received).searchParams)).toEqual({
    page: '2',
    limit: '20',
    sort: '-fecha_creacion',
    'filter[estado]': 'activo',
  })
  expect(result).toEqual({ data: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } })
})
