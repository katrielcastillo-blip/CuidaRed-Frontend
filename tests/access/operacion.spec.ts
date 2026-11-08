/*
 * operacion.spec.ts — Integración de expedientes, visitas offline y agenda con la API interceptada.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { expect, test } from '@playwright/test'
import { API, cuentaActiva, iniciarSesion, simular } from './ayudas-fase2'

const cuentaId = '9007199254740993'
const adultoId = '11111111-1111-4111-8111-111111111111'
const visitaId = '22222222-2222-4222-8222-222222222222'
const tareaId = '33333333-3333-4333-8333-333333333333'
const ruta = `/operacion/${cuentaId}`
const backend = `${API}/api/v1/cuentas/${cuentaId}`
const adulto = { envejeciente_id: adultoId, nombres: 'Juana', apellidos: 'Prueba', estado: 'activo', zona: 'Centro', municipio_nombre: 'Distrito Nacional' }
const pagina = (data: unknown[]) => ({ data, meta: { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0 } })

test('ID03: registra un expediente con consentimiento y un contacto principal por la API', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta sintética', permisos: ['adultos:ver', 'adultos:crear'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  let alta: unknown
  await page.route(`${backend}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname
    if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/envejecientes') && r.request().method() === 'POST') {
      alta = r.request().postDataJSON()
      return r.fulfill({ status: 201, json: { data: adulto } })
    }
    if (path.endsWith('/envejecientes')) return r.fulfill({ json: pagina(alta ? [adulto] : []) })
    if (path.endsWith(adultoId)) return r.fulfill({ json: { data: adulto } })
    if (path.endsWith('/historial')) return r.fulfill({ json: pagina([]) })
    return r.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Abrir cuenta' }).click()
  await page.getByRole('link', { name: 'Envejecientes' }).click()
  await page.getByRole('button', { name: 'Registrar adulto mayor' }).click()
  await page.getByLabel(/^Nombres/).fill('Juana')
  await page.getByLabel(/^Apellidos/).fill('Prueba')
  await page.getByLabel(/^Cédula del adulto/).fill('00112345679')
  await page.getByLabel(/^Fecha de nacimiento/).fill('1945-05-06')
  await page.getByLabel(/^Sexo/).selectOption('F')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel(/^Provincia/).selectOption('01')
  await page.getByLabel(/^Municipio/).selectOption('0101')
  await page.getByLabel(/^Sector o zona/).fill('Centro')
  await page.getByLabel(/^Autonomía/).selectOption('parcial')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel(/^Nombres del contacto/).fill('Elena')
  await page.getByLabel(/^Apellidos del contacto/).fill('Prueba')
  await page.getByLabel(/^Parentesco/).fill('Hermana')
  await page.getByLabel(/^Teléfono del contacto/).fill('8095550100')
  await page.getByLabel(/Confirmo que se otorgó el consentimiento/).check()
  await page.getByRole('button', { name: 'Registrar adulto mayor', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Juana Prueba' })).toBeVisible()
  expect(alta).toMatchObject({ cedula: '00112345679', municipio_cod: '0101', consentimiento: { otorgado: true, otorgado_por: 'adulto' },
    contactos: [{ nombres: 'Elena', es_principal: true }] })
})

test('RF-10: registra offline una visita autorizada y envía la misma captura al volver la conexión', async ({ page, context }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta sintética', rol: 'voluntario', permisos: ['visitas:ver', 'visitas:registrar', 'sync:usar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const visita = {
    visita_id: visitaId, razon: 'Visita autorizada', fecha: '2026-11-07', hora_programada: '09:00',
    estado: 'en_curso', fecha_actualizacion: '2026-11-07T12:00:00Z',
    autorizada_por: { usuario_id: adultoId }, participantes: [{ usuario_id: sim.usuarioId }], adultos: [adulto],
  }
  let capturas: { id_cliente: string; registro_id: string; tipo: string; datos: object }[] = []
  await page.route(`${backend}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname
    if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/visitas')) return r.fulfill({ json: pagina([visita]) })
    if (path.endsWith(visitaId)) return r.fulfill({ json: { data: visita } })
    if (path.endsWith('/evidencias')) return r.fulfill({ json: { data: [] } })
    if (path.endsWith('/sync')) {
      capturas = r.request().postDataJSON().operaciones
      visita.estado = 'completada'
      return r.fulfill({ json: { data: { resultados: capturas.map((c) => ({ id_cliente: c.id_cliente, resultado: 'aplicada' })) } } })
    }
    return r.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Abrir cuenta' }).click()
  await page.getByRole('link', { name: 'Visitas', exact: true }).click()
  await page.getByRole('button', { name: /Visita autorizada/ }).click()
  await context.setOffline(true)
  try {
    await page.getByLabel(/Observación de Juana Prueba/).fill('Observación sintética')
    await page.getByRole('button', { name: 'Registrar visita', exact: true }).click()
    await expect(page.getByText(/1 pendiente\(s\) en esta cuenta/)).toBeVisible()
    expect(capturas).toHaveLength(0)
  } finally {
    await context.setOffline(false)
  }
  await expect.poll(() => capturas.length).toBe(1)
  expect(capturas[0]).toMatchObject({ registro_id: visitaId, tipo: 'registrar',
    datos: { detalles: [{ envejeciente_id: adultoId, observacion: 'Observación sintética' }] } })
  await expect(page.getByText(/0 pendiente\(s\) en esta cuenta/)).toBeVisible()
})

test('ID02: una cuenta vencida no consulta rutas operativas ni habilita miembros', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta vencida', acceso_operativo: false, estado_suscripcion: 'vencida', permisos: ['agenda:ver', 'usuarios:gestionar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  let llamadasAgenda = 0
  await page.route(`${backend}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname
    if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/tareas')) llamadasAgenda++
    return r.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await expect(page.getByRole('link', { name: 'Miembros de la cuenta' })).toHaveCount(0)
  await page.goto(`${ruta}/agenda`)
  await expect(page.getByText('No tienes acceso a este módulo de la cuenta.')).toBeVisible()
  expect(llamadasAgenda).toBe(0)
})

test('RF-16: la interfaz bloquea completar una tarea que carece de evidencia validada', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta sintética', rol: 'cuidador', permisos: ['agenda:ver', 'agenda:ejecutar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const tarea = { tarea_id: tareaId, titulo: 'Seguimiento de prueba', fecha_programada: '2026-11-07', estado: 'en_progreso',
    requiere_evidencia: true, evidencias: { validadas: 0 } }
  await page.route(`${backend}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname
    if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/tareas')) return r.fulfill({ json: pagina([tarea]) })
    if (path.endsWith(tareaId)) return r.fulfill({ json: { data: tarea } })
    if (path.endsWith('/evidencias')) return r.fulfill({ json: { data: [] } })
    return r.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/agenda`)
  await page.getByRole('button', { name: /Seguimiento de prueba/ }).click()
  await expect(page.getByText('Para completar esta tarea hace falta una evidencia validada.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Completar', exact: true })).toHaveCount(0)
})
