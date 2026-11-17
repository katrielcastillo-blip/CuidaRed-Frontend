/* Renderizado y navegación segura de un aviso del sistema. © 2026 Equipo CuidaRed – INTEC. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { expect, test, vi } from 'vitest'

function simularWorker() {
  const eventos: Record<string, (evento: Record<string, unknown>) => void> = {}
  const showNotification = vi.fn().mockResolvedValue(undefined)
  const openWindow = vi.fn().mockResolvedValue(undefined)
  const matchAll = vi.fn().mockResolvedValue([])
  const origen = 'https://cuidared.example.test'
  runInNewContext(readFileSync(resolve('public/cuidared-push.js'), 'utf8'), { URL, self: {
    location: { origin: origen },
    registration: { showNotification },
    clients: { matchAll, openWindow },
    addEventListener: (evento: string, ejecutar: typeof eventos[string]) => { eventos[evento] = ejecutar },
  } })
  return { eventos, showNotification, openWindow, matchAll, origen }
}

test('el aviso del sistema usa texto fijo y enfoca solo la bandeja de la cuenta', async () => {
  const { eventos, showNotification, matchAll, openWindow, origen } = simularWorker()
  const waitUntil = vi.fn()
  const close = vi.fn()
  const aviso = '33333333-3333-4333-8333-333333333333'
  eventos.push({ data: { json: () => ({ cuenta_id: '123', aviso_id: aviso, body: 'dato reservado', url: 'https://example.test/' }) }, waitUntil })
  await waitUntil.mock.calls[0][0]
  expect(showNotification).toHaveBeenCalledWith('CuidaRed', {
    body: 'Tienes una alerta nueva en CuidaRed.',
    icon: '/icons/icon-192.png',
    tag: aviso,
    data: { tipo: 'cuidared-alerta', cuenta_id: '123' },
  })
  const focus = vi.fn().mockResolvedValue(undefined)
  matchAll.mockResolvedValueOnce([{ url: `${origen}/operacion/123/alertas?bandeja=avisos`, focus }])
  eventos.notificationclick({ notification: { data: showNotification.mock.calls[0][1].data, close }, waitUntil })
  await waitUntil.mock.calls[1][0]
  expect(close).toHaveBeenCalledOnce()
  expect(focus).toHaveBeenCalledOnce()
  expect(openWindow).not.toHaveBeenCalled()
})

test('el destino inválido abre Inicio en el mismo origen', async () => {
  const { eventos, openWindow, origen } = simularWorker()
  const waitUntil = vi.fn()
  eventos.notificationclick({ notification: {
    data: { tipo: 'cuidared-alerta', cuenta_id: '//example.test' }, close: vi.fn(),
  }, waitUntil })
  await waitUntil.mock.calls[0][0]
  expect(openWindow).toHaveBeenCalledWith(`${origen}/inicio`)
})
