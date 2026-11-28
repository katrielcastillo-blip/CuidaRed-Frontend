/*
 * suscripcion.spec.ts — ID08 y RF-20 en el acceso conectado. Intercepta Supabase, CuidaRed y Stripe.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page } from '@playwright/test'
import type { CotizacionSuscripcion, GestionSuscripcion, PagoSuscripcion, PlanCatalogoSuscripcion } from '../../src/features/access-real/api/suscripcion'
import { API, CLAVE, cuentaActiva, iniciarSesion, simular, suscripcionDePrueba } from './ayudas-fase2'

const id = '25'
const operacion = `/operacion/${id}`
const cuentaApi = `${API}/api/v1/cuentas/${id}`
const stripe = 'https://checkout.stripe.com/c/pay/cs_test_suscripcion'
const factura = 'https://invoice.stripe.com/i/test_cambio'
const codigoAvanzada = 'gestion_comunitaria_avanzada'
const cuposAvanzada = { envejecientes: 42, usuarios: 12, cuidadores: 8, familiares: null }
const versionAvanzada = 'a34958c9-6223-49a3-b8c9-76ef290a05ff'
const oferta = {
  codigo: 'operacion_base_mensual',
  nombre: 'Operación Base',
  periodicidad: 'mensual',
  importe_centavos: 9900,
  moneda: 'USD',
  limites: { envejecientes: 15, usuarios: 20, familiares: null },
  funcionalidades: ['dashboard_metricas', 'necesidades_diarias', 'registro_visitas', 'tablon_notificaciones'],
  actual: false,
} as const

const pago: PagoSuscripcion = {
  pago_id: '1', plan: oferta.nombre, periodicidad: oferta.periodicidad, importe_centavos: oferta.importe_centavos,
  moneda: oferta.moneda, estado: 'completado', fecha: '2026-11-22T16:00:00Z', importe_reembolsado_centavos: 0,
}

function crearCatalogo(tipo: 'familia' | 'organizacion'): PlanCatalogoSuscripcion[] {
  if (tipo === 'familia') return [
    { codigo: 'basico_familiar', nombre: 'Básico Familiar',
      limites: { envejecientes: 2, usuarios: null, familiares: 3, cuidadores: 5 },
      funcionalidades: ['necesidades_diarias'], precios_referencia: { mensual: 900, anual: 9000 } },
    { codigo: 'cuidado_integral', nombre: 'Cuidado Integral',
      limites: { envejecientes: 6, usuarios: null, familiares: null, cuidadores: null },
      funcionalidades: ['alertas_tiempo_real', 'reportes_avanzados'], precios_referencia: { mensual: 1900, anual: 19000 } },
  ]
  return [
    { codigo: 'operacion_base', nombre: oferta.nombre, limites: { ...oferta.limites, cuidadores: null },
      funcionalidades: [...oferta.funcionalidades], precios_referencia: null },
    { codigo: codigoAvanzada, nombre: 'Gestión Comunitaria Avanzada', cotizado: true,
      limites: { envejecientes: null, usuarios: null, familiares: null, cuidadores: null },
      funcionalidades: ['reportes_avanzados'], precios_referencia: null },
  ]
}

async function preparar(page: Page, opciones: {
  titular?: boolean; permiso?: boolean; checkout?: string; disponible?: boolean; cambioInmediato?: boolean
  tipo?: 'familia' | 'organizacion'
} = {}) {
  const titular = opciones.titular ?? true
  const cuenta = cuentaActiva({
    cuenta_id: id,
    nombre: 'Equipo CuidaRed',
    tipo: opciones.tipo ?? 'organizacion',
    es_titular: titular,
    estado_suscripcion: 'vencida',
    acceso_operativo: false,
    permisos: opciones.permiso === false ? ['adultos:ver'] : ['adultos:ver', 'cuenta:suscripcion'],
  })
  const gestion: GestionSuscripcion = {
    sandbox: true,
    pagos_disponibles: opciones.disponible ?? true,
    es_titular: titular,
    estado: 'vencida',
    acceso_operativo: false,
    vigencia_hasta: null,
    cancelacion_programada: false,
    suscripcion_stripe: false,
    puede_modificar: false,
    checkout_en_curso: null,
    cambio_en_curso: null,
    ofertas: [{ ...oferta, funcionalidades: [...oferta.funcionalidades] }],
  }
  const pagos: PagoSuscripcion[] = []
  const cotizaciones: CotizacionSuscripcion[] = []
  const catalogo = crearCatalogo(cuenta.tipo)
  const solicitudes = {
    gestion: 0, historial: 0, checkout: [] as Array<{ cuerpo: unknown; autorizacion?: string }>,
    cambios: [] as unknown[], cotizaciones: [] as unknown[], cancelaciones: 0,
  }
  const sesion = await simular(page, {
    cuentas: [cuenta],
    suscripciones: { [id]: suscripcionDePrueba(0, { estado: 'vencida', acceso_operativo: false }) },
  })
  await page.route(`${cuentaApi}/contexto`, (ruta) => ruta.fulfill({ json: { data: cuenta } }))
  await page.route(`${cuentaApi}/suscripcion/gestion`, (ruta) => {
    solicitudes.gestion++
    return ruta.fulfill({ json: { data: gestion } })
  })
  await page.route(`${cuentaApi}/suscripcion/catalogo`, (ruta) => ruta.fulfill({ json: { data: catalogo } }))
  await page.route(`${cuentaApi}/suscripcion/pagos*`, (ruta) => {
    solicitudes.historial++
    return ruta.fulfill({ json: { data: pagos, meta: { page: 1, limit: 20, total: pagos.length, totalPages: pagos.length ? 1 : 0 } } })
  })
  await page.route(`${cuentaApi}/suscripcion/checkout`, (ruta) => {
    solicitudes.checkout.push({ cuerpo: ruta.request().postDataJSON(), autorizacion: ruta.request().headers().authorization })
    return ruta.fulfill({ json: { data: { url: opciones.checkout ?? stripe } } })
  })
  await page.route(`${cuentaApi}/suscripcion/cambio-plan`, (ruta) => {
    const cuerpo = ruta.request().postDataJSON()
    const modo = opciones.cambioInmediato ? 'inmediato' : 'proximo_corte'
    solicitudes.cambios.push(cuerpo)
    gestion.cambio_en_curso = { codigo: cuerpo.oferta, modo, efectivo_en: '2026-12-22T18:30:00Z' }
    return ruta.fulfill({ status: 202, json: { data: { url: opciones.cambioInmediato ? factura : null, modo } } })
  })
  await page.route(`${cuentaApi}/suscripcion/cancelacion`, (ruta) => {
    solicitudes.cancelaciones++
    gestion.cancelacion_programada = true
    return ruta.fulfill({ status: 204 })
  })
  await page.route(`${cuentaApi}/suscripcion/cotizaciones`, (ruta) => {
    if (ruta.request().method() === 'POST') {
      const cuerpo = ruta.request().postDataJSON()
      solicitudes.cotizaciones.push(cuerpo)
      const cotizacion = cotizaciones.find((item) => item.codigo === cuerpo.codigo)
      if (cotizacion) cotizacion.estado = 'solicitada'
      return ruta.fulfill({ status: 201, json: { data: cotizacion } })
    }
    return ruta.fulfill({ json: { data: { cotizaciones } } })
  })
  await page.route(stripe, (ruta) => ruta.fulfill({ contentType: 'text/html', body: '<h1>Pago de prueba simulado</h1>' }))
  await page.route(factura, (ruta) => ruta.fulfill({ contentType: 'text/html', body: '<h1>Factura de prueba simulada</h1>' }))
  return { ...sesion, cuenta, gestion, pagos, cotizaciones, catalogo, solicitudes }
}

test('el titular de una cuenta vencida consulta su suscripción y elige una oferta en Stripe Sandbox', async ({ page }) => {
  const sim = await preparar(page)
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  await expect(page.getByRole('heading', { name: 'Suscripción y pagos' })).toBeVisible()
  await expect(page.getByText('Limitado a la cuenta')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Adultos', exact: true })).toHaveCount(0)
  await expect(page.getByText('Aún no hay pagos de prueba registrados.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Consultar estado del pago' })).toHaveCount(0)
  await expect(page.getByText(/USD\s+99[.,]00 por mes/)).toBeVisible()
  await page.getByRole('button', { name: 'Elegir Operación Base (mensual)' }).click()
  await expect(page.getByRole('heading', { name: 'Pago de prueba simulado' })).toBeVisible()
  expect(sim.solicitudes.checkout).toEqual([{ cuerpo: { oferta: oferta.codigo }, autorizacion: `Bearer ${sim.token}` }])
})

test('el retorno de Stripe conserva la ruta al iniciar sesión y espera datos confirmados', async ({ page }) => {
  const sim = await preparar(page)
  await page.goto(`${operacion}/suscripcion?checkout=retorno`)
  await page.getByLabel(/^Correo electrónico/).fill(sim.correo)
  await page.getByLabel(/^Contraseña/).fill(CLAVE)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page).toHaveURL(`${operacion}/suscripcion?checkout=retorno`)
  await expect(page.getByText(/cuando CuidaRed recibe la confirmación/)).toBeVisible()
  await expect(page.getByText('Sin plan activo')).toBeVisible()
  await expect(page.getByText('Completado', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Consultar estado del pago' }).click()
  await expect(page.getByText(/Estado consultado\. Todavía esperamos/)).toBeVisible()

  sim.gestion.estado = 'activa'
  sim.gestion.acceso_operativo = true
  sim.gestion.suscripcion_stripe = true
  sim.cuenta.estado_suscripcion = 'activa'
  sim.cuenta.acceso_operativo = true
  sim.pagos.push(pago)
  await page.getByRole('button', { name: 'Consultar estado del pago' }).click()
  await expect(page.getByText('Plan activo', { exact: true })).toBeVisible()
  await expect(page.getByText('Completado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Consultar estado del pago' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Elegir Operación/ })).toHaveCount(0)
})

test('un gestor que no es titular puede consultar el historial y no iniciar un pago', async ({ page }) => {
  const sim = await preparar(page, { titular: false })
  sim.pagos.push({ ...pago, estado: 'reembolsado', importe_reembolsado_centavos: pago.importe_centavos })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  await expect(page.getByText(/Solo la persona titular/)).toBeVisible()
  await expect(page.getByText('Reembolsado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Elegir Operación/ })).toHaveCount(0)
  expect(sim.solicitudes.checkout).toHaveLength(0)
})

test('un usuario sin permiso no accede a la administración ni al historial de suscripción', async ({ page }) => {
  const sim = await preparar(page, { permiso: false })
  await iniciarSesion(page, sim.correo)
  await expect(page.getByRole('link', { name: 'Ver suscripción y pagos' })).toHaveCount(0)
  await page.goto(`${operacion}/suscripcion`)
  await expect(page.getByText('No tienes acceso a este módulo de la cuenta.')).toBeVisible()
  expect(sim.solicitudes.gestion).toBe(0)
  expect(sim.solicitudes.historial).toBe(0)
})

test('rechaza destinos externos distintos de Stripe Checkout', async ({ page }) => {
  const sim = await preparar(page, { checkout: 'https://checkout.stripe.com.example.test/redirect' })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  await page.getByRole('button', { name: 'Elegir Operación Base (mensual)' }).click()
  await expect(page.getByText('No se pudo abrir Stripe. Intenta de nuevo.')).toBeVisible()
  await expect(page).toHaveURL(`${operacion}/suscripcion`)
  expect(sim.solicitudes.checkout).toHaveLength(1)
})

test('lee las unidades propias de cada moneda y mantiene la consulta con Checkout desactivado', async ({ page }) => {
  const sim = await preparar(page, { disponible: false })
  sim.gestion.ofertas.push({
    ...sim.gestion.ofertas[0]!, codigo: 'gestion_comunitaria_avanzada_anual', nombre: 'Gestión Comunitaria Avanzada',
    periodicidad: 'anual', moneda: 'JPY', importe_centavos: 7500,
  })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  await expect(page.getByText(/JPY\s+7[,.\s]500 por año/)).toBeVisible()
  await expect(page.getByText('Los pagos de prueba no están disponibles ahora.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Historial de pagos' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Elegir/ })).toHaveCount(0)
})

test('solo Avanzada se cotiza y Operación Base conserva funciones y cupos sin tarifa publicada', async ({ page }) => {
  const sim = await preparar(page)
  sim.gestion.ofertas = []
  for (const periodicidad of ['mensual', 'anual'] as const) sim.cotizaciones.push({
    codigo: `${codigoAvanzada}_${periodicidad}`, nombre: 'Gestión Comunitaria Avanzada',
    periodicidad, estado: 'sin_cotizar', importe_centavos: null, moneda: 'USD', cuidadores: 2, envejecientes: 5, limites: null,
  })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  const cotizaciones = page.getByRole('region', { name: 'Planes para tu organización' })
  const base = cotizaciones.getByRole('article', { name: oferta.nombre })
  const avanzada = cotizaciones.getByRole('article', { name: 'Gestión Comunitaria Avanzada' })
  await expect(cotizaciones.getByRole('article')).toHaveCount(2)
  await expect(base).toContainText('Hasta 15 adultos mayores')
  await expect(base).toContainText('Hasta 20 miembros del equipo')
  await expect(base).toContainText('Tarifa pendiente de publicación')
  await expect(base.getByRole('button', { name: /Solicitar cotización|Elegir/ })).toHaveCount(0)
  await expect(avanzada).not.toContainText('Adultos mayores sin límite')
  await expect(avanzada).toContainText('Análisis avanzado y exportación a Excel')
  await avanzada.getByRole('radio', { name: 'Anual' }).click()
  await avanzada.getByRole('button', { name: 'Solicitar cotización para Gestión Comunitaria Avanzada (anual)' }).click()
  await expect(avanzada.getByText('En revisión')).toBeVisible()
  await avanzada.getByRole('radio', { name: 'Mensual' }).click()
  await expect(avanzada.getByRole('button', { name: 'Solicitar cotización para Gestión Comunitaria Avanzada (mensual)' })).toBeVisible()
  expect(sim.solicitudes.cotizaciones).toEqual([{ codigo: `${codigoAvanzada}_anual` }])
})

test('contratar Avanzada muestra los cupos pactados y envía la versión de la cotización', async ({ page }) => {
  const sim = await preparar(page)
  const avanzada = {
    ...oferta, nombre: 'Gestión Comunitaria Avanzada', codigo: `${codigoAvanzada}_mensual` as const,
    limites: cuposAvanzada, version: versionAvanzada, importe_centavos: 15500, funcionalidades: ['reportes_avanzados'],
  }
  sim.gestion.ofertas.push(avanzada)
  sim.cotizaciones.push({
    codigo: avanzada.codigo, nombre: avanzada.nombre, periodicidad: 'mensual', estado: 'cotizada',
    importe_centavos: avanzada.importe_centavos, moneda: 'USD', cuidadores: 2, envejecientes: 5,
    limites: cuposAvanzada, version: versionAvanzada,
  })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  const tarjeta = page.getByRole('article', { name: avanzada.nombre })
  const cupos = tarjeta.getByRole('list', { name: 'Cupos de la cotización' })
  await expect(cupos).toContainText('Hasta 42 adultos mayores')
  await expect(cupos).toContainText('Hasta 12 integrantes del equipo')
  await expect(cupos).toContainText('Hasta 8 cuidadores')
  await expect(cupos).toContainText('Familiares sin límite')
  await tarjeta.getByRole('button', { name: 'Elegir Gestión Comunitaria Avanzada (mensual)' }).click()
  await expect(page.getByRole('heading', { name: 'Pago de prueba simulado' })).toBeVisible()
  expect(sim.solicitudes.checkout[0]?.cuerpo).toEqual({ oferta: avanzada.codigo, version: versionAvanzada })
})

test('una oferta actualizada muestra el conflicto en la tarjeta y bloquea intentar con la versión anterior', async ({ page }) => {
  const sim = await preparar(page)
  const versionNueva = '0fc1914a-c719-4e52-83c4-43698a1d5635'
  const tarjetas = page.getByRole('region', { name: 'Planes para tu organización' })
  const tarjeta = tarjetas.getByRole('article', { name: 'Operación Base' })
  sim.gestion.ofertas[0]!.version = versionAvanzada
  let enConflicto = false
  let permitirRefrescar: () => void = () => {}
  const esperarRefresco = new Promise<void>((resolver) => { permitirRefrescar = resolver })
  await page.route(`${cuentaApi}/suscripcion/gestion`, async (ruta) => {
    if (enConflicto) await esperarRefresco
    return ruta.fulfill({ json: { data: sim.gestion } })
  })
  const versiones: unknown[] = []
  await page.route(`${cuentaApi}/suscripcion/checkout`, (ruta) => {
    versiones.push(ruta.request().postDataJSON().version)
    if (versiones.length === 1) {
      enConflicto = true
      sim.gestion.ofertas[0]!.version = versionNueva
      sim.gestion.ofertas[0]!.importe_centavos = 11500
      return ruta.fulfill({ status: 409, json: { error: { code: 'QUOTE_UPDATED' } } })
    }
    return ruta.fulfill({ json: { data: { url: stripe } } })
  })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  const contratar = tarjeta.getByRole('button', { name: 'Elegir Operación Base (mensual)' })
  await contratar.click()
  try {
    await expect(tarjeta.getByRole('alert')).toContainText('La oferta cambió')
    await expect(contratar).toBeDisabled()
  } finally {
    permitirRefrescar()
  }
  await expect(tarjeta.getByText(/USD\s+115[.,]00 por mes/)).toBeVisible()
  await contratar.click()
  await expect(page.getByRole('heading', { name: 'Pago de prueba simulado' })).toBeVisible()
  expect(versiones).toEqual([versionAvanzada, versionNueva])
})

test('al retomar Avanzada se muestran el precio y los cupos de la versión que inició el pago', async ({ page }) => {
  const sim = await preparar(page)
  const codigo = `${codigoAvanzada}_mensual`
  const versionNueva = '96b68cc4-f0df-4b69-b457-10c078a1aa53'
  const nueva = {
    ...oferta, codigo, nombre: 'Gestión Comunitaria Avanzada', publicada: true, version: versionNueva,
    importe_centavos: 18500, limites: { ...cuposAvanzada, cuidadores: 10 }, funcionalidades: ['reportes_avanzados'],
  }
  sim.gestion.ofertas.push(nueva, {
    ...nueva, publicada: false, en_curso: true, version: versionAvanzada, importe_centavos: 15500, limites: cuposAvanzada,
  })
  sim.gestion.checkout_en_curso = codigo
  sim.cotizaciones.push({
    codigo, nombre: nueva.nombre, periodicidad: nueva.periodicidad, estado: 'cotizada', importe_centavos: nueva.importe_centavos,
    moneda: 'USD', cuidadores: 2, envejecientes: 5, limites: nueva.limites, version: versionNueva,
  })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  const tarjeta = page.getByRole('article', { name: nueva.nombre })
  await expect(tarjeta.getByText('Pago iniciado', { exact: true })).toBeVisible()
  await expect(tarjeta.getByText('Cotización disponible')).toHaveCount(0)
  await expect(tarjeta.getByText(/USD\s+155[.,]00 por mes/)).toBeVisible()
  await expect(tarjeta.getByRole('list', { name: 'Cupos del pago iniciado' })).toContainText('Hasta 8 cuidadores')
  await tarjeta.getByRole('button', { name: 'Retomar pago de prueba de Gestión Comunitaria Avanzada (mensual)' }).click()
  await expect(page.getByRole('heading', { name: 'Pago de prueba simulado' })).toBeVisible()
  expect(sim.solicitudes.checkout[0]?.cuerpo).toEqual({ oferta: codigo, version: versionAvanzada })
})

test('si el pago de prueba venció, el titular puede reiniciar el pago desde la misma tarjeta', async ({ page }) => {
  const sim = await preparar(page)
  sim.gestion.checkout_en_curso = oferta.codigo
  sim.gestion.ofertas[0]!.en_curso = true
  let intentos = 0
  await page.route(`${cuentaApi}/suscripcion/checkout`, (ruta) => {
    if (++intentos === 1) {
      sim.gestion.checkout_en_curso = null
      sim.gestion.ofertas[0]!.en_curso = false
      return ruta.fulfill({ status: 409, json: { error: { code: 'CHECKOUT_EXPIRED' } } })
    }
    return ruta.fulfill({ json: { data: { url: stripe } } })
  })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  const tarjeta = page.getByRole('article', { name: 'Operación Base' })
  await tarjeta.getByRole('button', { name: 'Retomar pago de prueba de Operación Base (mensual)' }).click()
  await expect(tarjeta.getByRole('alert')).toContainText('La sesión de pago de prueba venció')
  await tarjeta.getByRole('button', { name: 'Elegir Operación Base (mensual)' }).click()
  await expect(page.getByRole('heading', { name: 'Pago de prueba simulado' })).toBeVisible()
  expect(intentos).toBe(2)
})

test('Familia ve los límites y precios iniciales cuando faltan tarifas publicadas', async ({ page }) => {
  const sim = await preparar(page, { tipo: 'familia', disponible: false })
  sim.gestion.ofertas = []
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  const planes = page.getByRole('region', { name: 'Planes para tu familia' })
  const basico = planes.getByRole('article', { name: 'Básico Familiar' })
  const integral = planes.getByRole('article', { name: 'Cuidado Integral' })
  await expect(planes.getByRole('article')).toHaveCount(2)
  await expect(basico).toContainText('Hasta 2 adultos mayores')
  await expect(basico).toContainText('Hasta 5 cuidadores')
  await expect(basico.getByText(/USD\s+9[.,]00 por mes/)).toBeVisible()
  await expect(integral).toContainText('Hasta 6 adultos mayores')
  await expect(integral).toContainText('Cuidadores sin límite')
  await expect(integral).toContainText('Alertas críticas en tiempo real')
  await expect(integral).toContainText('Análisis avanzado y exportación a Excel')
  await expect(basico).not.toContainText('Análisis avanzado y exportación a Excel')
  await expect(integral.getByText(/USD\s+19[.,]00 por mes/)).toBeVisible()
  const mensual = basico.getByRole('radio', { name: 'Mensual' })
  await mensual.focus()
  await mensual.press('ArrowRight')
  await expect(basico.getByRole('radio', { name: 'Anual' })).toHaveAttribute('aria-checked', 'true')
  await expect(basico.getByText(/USD\s+90[.,]00 por año/)).toBeVisible()
  await expect(integral.getByRole('radio', { name: 'Mensual' })).toHaveAttribute('aria-checked', 'true')
  await expect(planes.getByText('Precio de referencia, pendiente de publicación.')).toHaveCount(2)
  await expect(planes.getByRole('button', { name: /Elegir/ })).toHaveCount(0)
})

test('la tarjeta abierta refleja los cambios del catálogo aunque no haya ofertas comprables', async ({ page }) => {
  const sim = await preparar(page, { tipo: 'familia', disponible: false })
  sim.gestion.ofertas = []
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  const basico = page.getByRole('article', { name: 'Básico Familiar' })
  await expect(basico.getByText('Hasta 5 cuidadores')).toBeVisible()
  await basico.getByRole('radio', { name: 'Anual' }).click()
  const plan = sim.catalogo[0]!
  plan.limites.cuidadores = 7
  plan.limites.envejecientes = 4
  plan.funcionalidades.push('dashboard_metricas')
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(basico.getByText('Hasta 7 cuidadores')).toBeVisible()
  await expect(basico.getByText('Hasta 4 adultos mayores')).toBeVisible()
  await expect(basico.getByText('Panel de métricas')).toBeVisible()
  await expect(basico.getByRole('radio', { name: 'Anual' })).toHaveAttribute('aria-checked', 'true')
  plan.limites.envejecientes = 5
  await page.getByRole('button', { name: 'Actualizar planes' }).click()
  await expect(basico.getByText('Hasta 5 adultos mayores')).toBeVisible()
})

test('Familia contrata el importe publicado de su ciclo y solo consulta la referencia del otro', async ({ page }) => {
  const sim = await preparar(page, { tipo: 'familia' })
  sim.gestion.ofertas = [{
    ...sim.gestion.ofertas[0]!, codigo: 'basico_familiar_mensual', nombre: 'Básico Familiar',
    importe_centavos: 1100, limites: { envejecientes: 2, usuarios: null, familiares: 3 },
  }]
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  const basico = page.getByRole('article', { name: 'Básico Familiar' })
  await expect(basico.getByText(/USD\s+11[.,]00 por mes/)).toBeVisible()
  await basico.getByRole('radio', { name: 'Anual' }).click()
  await expect(basico.getByText('Precio de referencia, pendiente de publicación.')).toBeVisible()
  await expect(basico.getByRole('button', { name: /Elegir/ })).toHaveCount(0)
  await basico.getByRole('radio', { name: 'Mensual' }).click()
  await basico.getByRole('button', { name: 'Elegir Básico Familiar (mensual)' }).click()
  await expect(page.getByRole('heading', { name: 'Pago de prueba simulado' })).toBeVisible()
  expect(sim.solicitudes.checkout[0]?.cuerpo).toEqual({ oferta: 'basico_familiar_mensual' })
})

test('un Checkout existente se puede retomar para la misma oferta', async ({ page }) => {
  const sim = await preparar(page)
  sim.gestion.suscripcion_stripe = true
  sim.gestion.checkout_en_curso = oferta.codigo
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  await page.getByRole('button', { name: 'Retomar pago de prueba de Operación Base (mensual)' }).click()
  await expect(page.getByRole('heading', { name: 'Pago de prueba simulado' })).toBeVisible()
  expect(sim.solicitudes.checkout[0]?.cuerpo).toEqual({ oferta: oferta.codigo })
})

test('muestra el próximo corte antes de solicitar el cambio de periodicidad y deja el plan actual', async ({ page }) => {
  const sim = await preparar(page)
  sim.gestion.suscripcion_stripe = true
  sim.gestion.puede_modificar = true
  sim.gestion.estado = 'activa'
  sim.gestion.acceso_operativo = true
  sim.gestion.ofertas[0]!.actual = true
  sim.gestion.ofertas.push({
    ...sim.gestion.ofertas[0]!, codigo: 'operacion_base_anual', periodicidad: 'anual', importe_centavos: 12000, actual: false,
  })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  const planBase = page.getByRole('article', { name: 'Operación Base' })
  await planBase.getByRole('radio', { name: 'Anual' }).click()
  await planBase.getByRole('button', { name: 'Cambiar a Operación Base (anual)' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Cambiar plan de prueba' })
  await expect(dialogo).toContainText('El nuevo plan se aplicará en el próximo corte')
  expect(sim.solicitudes.cambios).toHaveLength(0)
  await dialogo.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText(/Cambio programado para el/)).toBeVisible()
  await expect(page.getByText('Plan actual', { exact: true })).toBeVisible()
  expect(sim.solicitudes.cambios).toEqual([{ oferta: 'operacion_base_anual' }])
})

test('confirma la cancelación al fin del período y conserva el acceso operativo', async ({ page }) => {
  const sim = await preparar(page)
  sim.gestion.suscripcion_stripe = true
  sim.gestion.puede_modificar = true
  sim.gestion.estado = 'activa'
  sim.gestion.acceso_operativo = true
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  await page.getByRole('button', { name: 'Cancelar renovación' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Cancelar renovación' })
  await expect(dialogo).toContainText('hasta el final del período pagado')
  await dialogo.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Cancelación programada', { exact: true })).toBeVisible()
  await expect(page.getByText('Operativo', { exact: true })).toBeVisible()
  expect(sim.solicitudes.cancelaciones).toBe(1)
})

test('explica el cargo proporcional de un plan más caro y abre la factura de prueba de Stripe', async ({ page }) => {
  const sim = await preparar(page, { cambioInmediato: true })
  sim.gestion.suscripcion_stripe = true
  sim.gestion.puede_modificar = true
  sim.gestion.estado = 'activa'
  sim.gestion.acceso_operativo = true
  sim.gestion.ofertas[0]!.actual = true
  sim.gestion.ofertas.push({
    ...sim.gestion.ofertas[0]!, codigo: 'gestion_comunitaria_avanzada_mensual', nombre: 'Gestión Comunitaria Avanzada', importe_centavos: 12000, actual: false,
  })
  await iniciarSesion(page, sim.correo)
  await page.getByRole('link', { name: 'Ver suscripción y pagos' }).click()
  await page.getByRole('button', { name: 'Cambiar a Gestión Comunitaria Avanzada (mensual)' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Cambiar plan de prueba' })
  await expect(dialogo).toContainText('Stripe calcula el cargo proporcional')
  await dialogo.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('heading', { name: 'Factura de prueba simulada' })).toBeVisible()
  expect(sim.solicitudes.cambios).toEqual([{ oferta: 'gestion_comunitaria_avanzada_mensual' }])

  await page.goBack()
  await page.getByRole('button', { name: 'Consultar estado del pago' }).click()
  await expect(page.getByText('El cambio de plan está en revisión.')).toBeVisible()
  await page.getByRole('button', { name: 'Retomar cambio a Gestión Comunitaria Avanzada (mensual)' }).click()
  await expect(dialogo).toContainText('Se abrirá la factura de prueba en Stripe')
  await dialogo.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('heading', { name: 'Factura de prueba simulada' })).toBeVisible()
  expect(sim.solicitudes.cambios).toEqual([{ oferta: 'gestion_comunitaria_avanzada_mensual' }, { oferta: 'gestion_comunitaria_avanzada_mensual' }])
})
