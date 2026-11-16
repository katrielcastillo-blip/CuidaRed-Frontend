/* Consultas conectadas de Necesidades y Alertas · RF-03/RF-04/RF-18. © 2026 Equipo CuidaRed – INTEC. */
import { expect, test } from '@playwright/test'
import { API, cuentaActiva, iniciarSesion, simular } from './ayudas-fase2'

const cuentaId = '9007199254740993'
const adultoId = '11111111-1111-4111-8111-111111111111'
const necesidadId = '55555555-5555-4555-8555-555555555555'
const riesgoId = '66666666-6666-4666-8666-666666666666'
const medicamentoId = '77777777-7777-4777-8777-777777777777'
const avisoId = '88888888-8888-4888-8888-888888888888'
const ruta = `/operacion/${cuentaId}`
const backend = `${API}/api/v1/cuentas/${cuentaId}`
const fecha = '2026-11-14T14:15:00Z'
const adulto = { envejeciente_id: adultoId, nombres: 'Juana', apellidos: 'Prueba', estado: 'activo' }
const pagina = (data: unknown[]) => ({ data, meta: { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0 } })
const necesidad = {
  envejeciente_necesidad_id: necesidadId, envejeciente_id: adultoId, envejeciente_nombre: 'Juana Prueba', envejeciente_estado: 'activo',
  necesidad_id: 4, necesidad_nombre: 'Medicamento recetado', tipo_necesidad_id: 2, tipo_necesidad_nombre: 'Medicamentos',
  prioridad_id: 3, prioridad: 'Alta', descripcion: 'El medicamento se agotó.', estado: 'pendiente', fecha_necesidad: fecha,
  fecha_actualizacion: fecha, cantidad: 2, unidad_medida: 'unidades', usuario_responsable_id: null, responsable: null,
  indicacion_medica_id: null, fecha_resolucion: null, motivo_resolucion: null, es_recurrente: false,
}

test('RF-03: consulta necesidades activas del expediente e historial de la ocurrencia', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', rol: 'familiar', permisos: ['adultos:ver', 'necesidades:ver'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  await page.route(`${API}/api/v1/catalogos/tipos-necesidad`, (req) =>
    req.fulfill({ json: { data: [{ tipo_necesidad_id: 2, nombre: 'Medicamentos' }] } }))
  await page.route(`${API}/api/v1/catalogos/prioridades`, (req) =>
    req.fulfill({ json: { data: [{ prioridad_id: 3, nombre: 'Alta', orden: 1 }] } }))
  await page.route(`${backend}/**`, async (req) => {
    const path = new URL(req.request().url()).pathname
    if (path.endsWith('/contexto')) return req.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/envejecientes')) return req.fulfill({ json: pagina([adulto]) })
    if (path.endsWith(adultoId)) return req.fulfill({ json: { data: adulto } })
    if (path.endsWith('/historial')) return req.fulfill({ json: pagina(path.includes(necesidadId) ? [{
      necesidad_evento_id: medicamentoId, actor: 'Gestor de prueba', fecha, estado: 'pendiente', estado_anterior: null,
      prioridad: 'Alta', motivo: null,
    }] : []) })
    if (path.endsWith('/necesidades')) return req.fulfill({ json: pagina([necesidad]) })
    if (path.endsWith(necesidadId)) return req.fulfill({ json: { data: necesidad } })
    return req.fallback()
  })

  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/envejecientes`)
  await page.getByRole('button', { name: /Juana Prueba/ }).click()
  const consulta = page.waitForRequest((r) => {
    const url = new URL(r.url())
    return url.pathname.endsWith('/necesidades') && url.searchParams.get('filter[envejeciente_id]') === adultoId
      && url.searchParams.get('filter[activas]') === 'true'
  })
  await page.getByRole('group', { name: 'Secciones de seguimiento' }).getByRole('button', { name: 'Necesidades', exact: true }).click()
  await consulta
  await page.getByRole('button', { name: /Ver necesidad: Medicamento recetado/ }).click()
  await expect(page.getByText('El medicamento se agotó.')).toBeVisible()
  await expect(page.getByText('2 unidades')).toBeVisible()
  await expect(page.getByText(/Gestor de prueba/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar necesidad' })).toHaveCount(0)
})

test('RF-04/RF-18: agrupa alertas, abre la bandeja desde la campana y actualiza el contador al leer', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', permisos: ['alertas:ver'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const alertaBase = {
    ...adulto, prioridad: { nombre: 'Alta', orden: 1 }, estado: 'pendiente', es_prioritaria: true,
    fecha_alerta: fecha, fecha_atencion: null, accion_tomada: null, atendida_por: null, cierre_automatico: false,
    descripcion: 'Detalle verificado.',
  }
  const riesgo = { ...alertaBase, alerta_envejeciente_id: riesgoId, tipo: { codigo: 'riesgo_alto', nombre: 'Riesgo alto' },
    fuente: { tipo: 'riesgo', referencia_id: '1' } }
  const medicamento = { ...alertaBase, alerta_envejeciente_id: medicamentoId, tipo: { codigo: 'medicamento_pendiente', nombre: 'Medicamento pendiente' },
    fuente: { tipo: 'necesidad', referencia_id: necesidadId } }
  let leida = false
  await page.route(`${backend}/**`, async (req) => {
    const { pathname: path, searchParams } = new URL(req.request().url())
    if (path.endsWith('/contexto')) return req.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/casos-prioritarios')) return req.fulfill({ json: pagina([
      { ...adulto, total_alertas: 2, fecha_alerta: fecha, alertas: [riesgo, medicamento] },
    ]) })
    if (path.endsWith(medicamentoId)) return req.fulfill({ json: { data: medicamento } })
    if (path.endsWith('/notificaciones-alerta')) return req.fulfill({ json: pagina(leida && searchParams.get('filter[estado]') === 'no_leida' ? [] : [
      { notificacion_id: avisoId, alerta_envejeciente_id: medicamentoId, mensaje: 'Tienes una alerta asignada.',
        estado: leida ? 'leida' : 'no_leida', fecha_notificacion: fecha, fecha_lectura: leida ? fecha : null },
    ]) })
    if (path.endsWith(`/${avisoId}/leer`)) {
      expect(req.request().method()).toBe('POST')
      expect(req.request().postDataJSON()).toEqual({})
      leida = true
      return req.fulfill({ json: { data: { notificacion_id: avisoId, alerta_envejeciente_id: medicamentoId,
        mensaje: 'Tienes una alerta asignada.', estado: 'leida', fecha_notificacion: fecha, fecha_lectura: fecha } } })
    }
    return req.fallback()
  })

  await iniciarSesion(page, sim.correo)
  const cabecera = page.getByRole('banner')
  await expect(cabecera.getByRole('link', { name: 'Notificaciones, 1 sin leer' })).toBeVisible()
  await page.goto(`${ruta}/alertas`)
  await expect(page.getByRole('heading', { name: 'Juana Prueba' })).toHaveCount(1)
  await expect(page.getByText('2 alertas abiertas')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Riesgo alto' })).toBeVisible()
  await page.getByRole('button', { name: /Ver alerta: Medicamento pendiente/ }).click()
  await expect(page.getByText('Detalle verificado.')).toBeVisible()
  await expect(page.getByText('Necesidad registrada', { exact: true })).toBeVisible()
  await cabecera.getByRole('link', { name: 'Notificaciones, 1 sin leer' }).click()
  await expect(page).toHaveURL(`${ruta}/alertas?bandeja=avisos`)
  await expect(page.getByRole('region', { name: 'Notificaciones de alertas' })).toBeVisible()
  await page.getByRole('button', { name: 'Marcar como leída' }).click()
  await expect(page.getByText('Leída', { exact: true })).toBeVisible()
  await expect(page.getByText(/Leída el/)).toBeVisible()
  await expect(cabecera.getByRole('link', { name: 'Notificaciones', exact: true })).toBeVisible()
})

test('RF-03: conserva un solo responsable, muestra la unidad y mantiene los datos ante un fallo de red', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', tipo: 'familia', rol: 'coordinador',
    permisos: ['necesidades:ver', 'necesidades:registrar', 'necesidades:actualizar', 'indicaciones:ver'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const responsableId = '99999999-9999-4999-8999-999999999999'
  const envios: unknown[] = []
  await page.route(`${API}/api/v1/catalogos/tipos-necesidad`, (req) =>
    req.fulfill({ json: { data: [{ tipo_necesidad_id: 2, nombre: 'Medicamentos' }] } }))
  await page.route(`${API}/api/v1/catalogos/necesidades`, (req) =>
    req.fulfill({ json: { data: [{ necesidad_id: 4, tipo_necesidad_id: 2, nombre: 'Medicamentos (general)' }] } }))
  await page.route(`${API}/api/v1/catalogos/prioridades`, (req) =>
    req.fulfill({ json: { data: [{ prioridad_id: 3, nombre: 'Alta' }] } }))
  await page.route(`${backend}/**`, async (req) => {
    const { pathname: path } = new URL(req.request().url())
    if (path.endsWith('/contexto')) return req.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/envejecientes')) return req.fulfill({ json: pagina([adulto]) })
    if (path.endsWith('/candidatos')) return req.fulfill({ json: pagina([{ usuario_id: responsableId, nombre: 'Gestor de prueba' }]) })
    if (path.endsWith('/indicaciones') || path.endsWith('/historial')) return req.fulfill({ json: pagina([]) })
    if (path.endsWith('/necesidades') && req.request().method() === 'POST') {
      envios.push(req.request().postDataJSON())
      if (envios.length === 1) return req.abort('connectionrefused')
      return req.fulfill({ status: 201, json: { data: necesidad } })
    }
    if (path.endsWith('/necesidades')) return req.fulfill({ json: pagina([]) })
    if (path.endsWith(necesidadId)) return req.fulfill({ json: { data: necesidad } })
    return req.fallback()
  })

  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/necesidades`)
  await page.getByRole('button', { name: 'Registrar necesidad' }).click()
  const formulario = page.getByRole('form', { name: 'Registrar necesidad' })
  await formulario.getByLabel('Adulto mayor').selectOption(adultoId)
  await formulario.getByLabel('Categoría de la necesidad').selectOption('2')
  await formulario.getByLabel('Necesidad del catálogo').selectOption('4')
  await formulario.getByRole('combobox', { name: /^Prioridad/ }).selectOption('3')
  await formulario.getByLabel('Descripción').fill('Medicamento para la próxima semana.')
  const opcionales = formulario.getByText('Datos opcionales', { exact: true })
  await opcionales.click()
  const responsable = formulario.getByRole('combobox', { name: 'Responsable (opcional)', exact: true })
  await responsable.selectOption(responsableId)
  const cantidad = formulario.getByLabel('Cantidad (opcional)')
  const unidad = formulario.getByRole('combobox', { name: /^Unidad de medida/ })
  await cantidad.fill('1')
  await expect(unidad).toBeVisible()
  await cantidad.clear()
  await expect(unidad).toHaveCount(0)
  await cantidad.fill('1')
  await expect(responsable).toHaveCount(1)
  await expect(responsable).toHaveValue(responsableId)
  await expect(formulario.getByRole('combobox', { name: 'Indicación médica (opcional)', exact: true })).toHaveCount(1)

  await opcionales.click()
  const registrar = formulario.getByRole('button', { name: 'Registrar necesidad' })
  await registrar.click()
  await expect(unidad).toBeVisible()
  expect(envios).toHaveLength(0)
  await unidad.selectOption({ label: 'cajas' })

  await registrar.click()
  await expect(formulario.getByRole('alert')).toHaveText(/No se pudo confirmar el registro/)
  await expect(responsable).toHaveValue(responsableId)
  await expect(unidad).toHaveValue('cajas')
  await expect(formulario.getByLabel('Descripción')).toHaveValue('Medicamento para la próxima semana.')
  expect(envios).toHaveLength(1)
  await registrar.click()
  await expect(formulario).toHaveCount(0)
  expect(envios).toHaveLength(2)
  expect(envios[0]).toMatchObject({ cantidad: 1, unidad_medida: 'cajas', usuario_responsable_id: responsableId })
  expect(envios[1]).toEqual(envios[0])
})

test('RF-10: conserva la captura de alta rechazada por cupo y reintenta la misma operación', async ({ page, context }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', rol: 'coordinador',
    permisos: ['necesidades:ver', 'necesidades:registrar', 'necesidades:actualizar', 'sync:usar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const capturas: Array<{ id_cliente: string; registro_id: string; datos: Record<string, unknown> }> = []
  await page.route(`${API}/api/v1/catalogos/tipos-necesidad`, (req) =>
    req.fulfill({ json: { data: [{ tipo_necesidad_id: 2, nombre: 'Alimentación' }] } }))
  await page.route(`${API}/api/v1/catalogos/necesidades`, (req) =>
    req.fulfill({ json: { data: [{ necesidad_id: 4, tipo_necesidad_id: 2, nombre: 'Alimentación (general)' }] } }))
  await page.route(`${API}/api/v1/catalogos/prioridades`, (req) =>
    req.fulfill({ json: { data: [{ prioridad_id: 1, nombre: 'Alta' }] } }))
  await page.route(`${backend}/**`, async (req) => {
    const path = new URL(req.request().url()).pathname
    if (path.endsWith('/contexto')) return req.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/envejecientes')) return req.fulfill({ json: pagina([adulto]) })
    if (path.endsWith('/necesidades') || path.endsWith('/candidatos')) return req.fulfill({ json: pagina([]) })
    if (path.endsWith('/sync')) {
      const lote = req.request().postDataJSON().operaciones as typeof capturas
      capturas.push(...lote)
      const sinCupo = capturas.length === 1
      return req.fulfill({ json: { data: { resultados: lote.map((i) => ({
        id_cliente: i.id_cliente, registro_id: i.registro_id,
        ...(sinCupo ? { resultado: 'rechazada', motivo: 'PLAN_LIMIT_REACHED' } : { resultado: 'aplicada' }),
      })) } } })
    }
    return req.fallback()
  })
  await iniciarSesion(page, sim.correo)
  const catalogoListo = page.waitForResponse(`${API}/api/v1/catalogos/necesidades`)
  await page.goto(`${ruta}/necesidades`)
  await catalogoListo
  await expect(page.getByText('Sin necesidades', { exact: false }).first()).toBeVisible()
  const unidad = 'Unidad personalizada de prueba'.padEnd(64, 'a')
  await context.setOffline(true)
  try {
    await page.getByRole('button', { name: 'Registrar necesidad' }).click()
    await page.getByLabel('Adulto mayor').selectOption(adultoId)
    await page.getByLabel('Categoría de la necesidad').selectOption('2')
    await page.getByLabel('Necesidad del catálogo').selectOption('4')
    await page.getByRole('combobox', { name: /^Prioridad/ }).selectOption('1')
    await page.getByLabel('Descripción').fill('Canasta de alimentos.')
    await page.getByText('Datos opcionales', { exact: true }).click()
    await page.getByLabel('Cantidad (opcional)').fill('0.004')
    await page.getByRole('combobox', { name: /^Unidad de medida/ }).selectOption('otra')
    await page.getByLabel('Otra unidad de medida').fill(unidad)
    await page.getByRole('button', { name: 'Registrar necesidad' }).click()
    await expect(page.getByText(/1 necesidad\(es\) pendiente/)).toBeVisible()
    expect(capturas).toHaveLength(0)
  } finally {
    await context.setOffline(false)
  }
  await expect.poll(() => capturas.length).toBe(1)
  await expect(page.getByText(/Se alcanzó el límite del plan de la cuenta/)).toBeVisible()
  await expect(page.getByText(/1 necesidad\(es\) pendiente/)).toBeVisible()
  expect(capturas[0]).toMatchObject({ entidad: 'necesidad', tipo: 'registrar',
    datos: { envejeciente_id: adultoId, necesidad_id: 4, prioridad_id: 1, descripcion: 'Canasta de alimentos.',
      cantidad: 0.004, unidad_medida: unidad } })
  await page.getByRole('button', { name: 'Reintentar sincronización' }).click()
  await expect(page.getByText(/0 necesidad\(es\) pendiente/)).toBeVisible()
  expect(capturas).toHaveLength(2)
  expect(capturas[1]).toEqual(capturas[0])
})

test('el voluntario no recibe navegación ni consultas de necesidades y alertas', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', rol: 'voluntario', permisos: ['adultos:ver', 'visitas:ver'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  await page.route(`${backend}/contexto`, (req) => req.fulfill({ json: { data: cuenta } }))
  const peticiones: string[] = []
  page.on('request', (req) => {
    if (req.url().startsWith(backend) && /\/(necesidades|alertas|casos-prioritarios|notificaciones-alerta)(?:\?|$)/.test(req.url())) {
      peticiones.push(req.url())
    }
  })
  await iniciarSesion(page, sim.correo)
  const inicio = page.getByRole('region', { name: 'Accesos rápidos' })
  await expect(page.getByRole('banner').getByRole('link', { name: /Notificaciones/ })).toHaveCount(0)
  await expect(inicio.getByRole('link', { name: /Necesidades|Alertas/ })).toHaveCount(0)
  await page.goto(`${ruta}/necesidades`)
  await expect(page.getByText('No tienes acceso a este módulo de la cuenta.')).toBeVisible()
  await page.goto(`${ruta}/alertas`)
  await expect(page.getByText('No tienes acceso a este módulo de la cuenta.')).toBeVisible()
  expect(peticiones).toEqual([])
})

test('RF-10: conserva la versión del servidor y explica el conflicto al sincronizar un cierre', async ({ page, context }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', rol: 'cuidador',
    permisos: ['necesidades:ver', 'necesidades:actualizar', 'sync:usar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const capturas: Array<{ id_cliente: string; registro_id: string }> = []
  let expediente = 'activo'
  await page.route(`${backend}/**`, async (req) => {
    const path = new URL(req.request().url()).pathname
    if (path.endsWith('/contexto')) return req.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/historial')) return req.fulfill({ json: pagina([]) })
    if (path.endsWith('/necesidades')) return req.fulfill({ json: pagina([{ ...necesidad, envejeciente_estado: expediente }]) })
    if (path.endsWith(necesidadId)) return req.fulfill({ json: { data: { ...necesidad, envejeciente_estado: expediente } } })
    if (path.endsWith('/sync')) {
      capturas.push(...req.request().postDataJSON().operaciones)
      expediente = 'inactivo'
      return req.fulfill({ json: { data: { resultados: capturas.map((i) => ({
        id_cliente: i.id_cliente, registro_id: i.registro_id, resultado: 'conflicto', gana: 'servidor',
      })) } } })
    }
    return req.fallback()
  })

  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/necesidades`)
  const ver = page.getByRole('button', { name: /Ver necesidad: Medicamento recetado/ })
  await expect(ver).toBeVisible()
  await context.setOffline(true)
  try {
    await ver.click()
    await page.getByRole('button', { name: 'Cambiar estado' }).click()
    await page.getByLabel('Nuevo estado').selectOption('resuelta')
    await page.getByLabel('Motivo del cierre').fill('Se consiguió el medicamento.')
    await page.getByRole('button', { name: 'Confirmar estado' }).click()
    await expect(page.getByText(/1 necesidad\(es\) pendiente/)).toBeVisible()
    expect(capturas).toHaveLength(0)
  } finally {
    await context.setOffline(false)
  }
  await expect(page.getByText(/El servidor conservó su versión/)).toBeVisible()
  await expect(page.getByText('Pendiente', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText('Los cambios requieren un expediente activo.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cambiar estado' })).toHaveCount(0)
  expect(capturas).toHaveLength(1)
  expect(capturas[0]).toMatchObject({ registro_id: necesidadId, entidad: 'necesidad', tipo: 'cambiar_estado',
    base_actualizado_en: '2026-11-14T14:15:00.000Z', datos: { estado: 'resuelta', motivo: 'Se consiguió el medicamento.' } })
})

test('RF-04: el gestor inicia la atención, resuelve y conserva el filtro del listado', async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 640 })
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', permisos: ['alertas:ver', 'alertas:gestionar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  let estado = 'pendiente'
  let accion: string | null = null
  const alerta = () => ({
    ...adulto, alerta_envejeciente_id: riesgoId, tipo: { codigo: 'riesgo_alto', nombre: 'Factor de riesgo alto' },
    prioridad: { nombre: 'Alta', orden: 1 }, fecha_alerta: fecha, estado,
    fecha_atencion: estado === 'resuelta' ? fecha : null, accion_tomada: accion,
    atendida_por: estado === 'resuelta' ? 'Persona gestora' : null, cierre_automatico: false,
    es_prioritaria: true, fuente: { tipo: 'riesgo', referencia_id: '2' },
  })
  await page.route(`${backend}/**`, async (req) => {
    const url = new URL(req.request().url())
    const path = url.pathname
    if (path.endsWith('/contexto')) return req.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/casos-prioritarios')) return req.fulfill({ json: pagina([]) })
    if (path.endsWith('/alertas')) {
      const filtro = url.searchParams.get('filter[estado]')
      return req.fulfill({ json: pagina(!filtro || filtro === estado ? [alerta()] : []) })
    }
    if (path.endsWith('/en-atencion')) {
      expect(req.request().postDataJSON()).toEqual({})
      estado = 'en_proceso'
    }
    if (path.endsWith('/resolver')) {
      accion = req.request().postDataJSON().accion_tomada
      estado = 'resuelta'
    }
    if (path.includes(riesgoId)) return req.fulfill({ json: { data: alerta() } })
    return req.fallback()
  })

  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/alertas`)
  await page.getByRole('button', { name: 'Alertas', exact: true }).click()
  const filtro = page.getByLabel('Estado de la alerta')
  await expect(filtro.locator('option', { hasText: 'Cancelada' })).toHaveCount(0)
  await filtro.selectOption('pendiente')
  await page.getByRole('button', { name: /Ver alerta: Factor de riesgo alto/ }).click()
  await page.getByRole('button', { name: 'Iniciar atención' }).click()
  await page.getByRole('button', { name: 'Confirmar inicio' }).click()
  await expect(page.getByText('Alerta en atención.')).toBeVisible()
  await page.getByRole('button', { name: 'Resolver alerta' }).click()
  await page.getByLabel('Acción tomada').fill('Contacté al equipo de atención.')
  await page.getByRole('button', { name: 'Confirmar resolución' }).click()
  await expect(page.getByText('Alerta resuelta.')).toBeVisible()
  await expect(page.getByText('Contacté al equipo de atención.')).toBeVisible()
  await expect(page.getByText('Persona gestora', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Volver a la bandeja' }).click()
  await expect(filtro).toHaveValue('pendiente')
  await expect(page.getByText('Sin alertas en este listado.')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
