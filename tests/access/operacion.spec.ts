/*
 * operacion.spec.ts — Integración de expedientes, visitas offline y agenda con la API interceptada.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { expect, test, type Locator } from '@playwright/test'
import { API, cuentaActiva, iniciarSesion, simular } from './ayudas-fase2'

const cuentaId = '9007199254740993'
const adultoId = '11111111-1111-4111-8111-111111111111'
const visitaId = '22222222-2222-4222-8222-222222222222'
const tareaId = '33333333-3333-4333-8333-333333333333'
const ruta = `/operacion/${cuentaId}`
const backend = `${API}/api/v1/cuentas/${cuentaId}`
const adulto = { envejeciente_id: adultoId, nombres: 'Juana', apellidos: 'Prueba', estado: 'activo', zona: 'Centro', municipio_nombre: 'Distrito Nacional' }
const pagina = (data: unknown[]) => ({ data, meta: { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0 } })

test('Inicio y Más mantienen tarjetas uniformes y el filtro de adultos se lee completo', async ({ page, isMobile }) => {
  await page.setViewportSize({ width: isMobile ? 508 : 1361, height: 618 })
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Organización sintética',
    permisos: ['adultos:ver', 'visitas:ver', 'agenda:ver', 'usuarios:gestionar', 'organizacion:configurar'] })
  const sim = await simular(page, { cuentas: [cuenta], correo: `${'contacto'.repeat(7)}@example.test` })
  await page.route(backend, (r) => r.fulfill({ json: { data: { cuenta: {
    cuenta_id: cuentaId, nombre: cuenta.nombre, tipo: cuenta.tipo,
    categoria: { categoria_cuenta_id: 3, nombre: 'Iglesia o parroquia' },
    municipio: { municipio_cod: '0101', nombre: 'Santo Domingo de Guzmán', provincia_cod: '01', provincia: 'Distrito Nacional' },
    fecha_creacion: '2026-11-07T12:00:00Z',
  }, contexto: cuenta } } }))
  await page.route(`${backend}/**`, (r) => {
    const path = new URL(r.request().url()).pathname
    if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/envejecientes')) return r.fulfill({ json: pagina([adulto]) })
    return r.fallback()
  })
  const tarjetasUniformes = async (enlaces: Locator, cantidad: number) => {
    await expect(enlaces).toHaveCount(cantidad)
    await expect.poll(() => enlaces.evaluateAll((items) => {
      const tamanos = items.map((item) => {
        const { width, height } = item.getBoundingClientRect()
        return `${Math.round(width)}×${Math.round(height)}`
      })
      return new Set(tamanos).size
    })).toBe(1)
  }

  await iniciarSesion(page, sim.correo)
  const cabecera = page.getByRole('banner')
  const navegacion = page.getByRole('navigation', { name: 'Módulos de la cuenta' })
  await expect(cabecera.getByRole('link', { name: 'Volver' })).toHaveCount(0)
  await tarjetasUniformes(page.getByRole('region', { name: 'Accesos rápidos' }).getByRole('link'), 5)
  const configurar = page.getByRole('link', { name: 'Configurar organización', exact: true })
  await expect.poll(async () => {
    const texto = await configurar.getByText('Configurar organización', { exact: true }).boundingBox()
    const flecha = await configurar.locator('svg').boundingBox()
    return !!texto && !!flecha && flecha.x >= texto.x + texto.width && Math.abs(flecha.y + flecha.height / 2 - texto.y - texto.height / 2) < 2
  }).toBe(true)

  if (isMobile) {
    await navegacion.getByRole('link', { name: 'Más' }).click()
    await expect(page.getByRole('heading', { name: 'Más opciones' })).toBeVisible()
    await tarjetasUniformes(page.getByRole('main').getByRole('link'), 6)
  } else {
    const marca = navegacion.getByRole('link', { name: 'CuidaRed, ir al inicio' })
    await expect.poll(() => marca.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.currentSrc.endsWith('/brand/logo.png'))).toBe(true)
    await navegacion.getByRole('link', { name: 'Adultos', exact: true }).click()
    await marca.click()
    await expect(page).toHaveURL(`${ruta}/cuenta`)
  }
  await navegacion.getByRole('link', { name: 'Adultos', exact: true }).click()
  await expect(cabecera.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', `${ruta}/cuenta`)
  const estado = page.getByRole('combobox', { name: 'Estado del expediente' })
  await expect(estado.locator('option:checked')).toHaveText('Todos los estados')
  if (isMobile) {
    await expect.poll(() => estado.evaluate((select: HTMLSelectElement) => {
      const estilo = getComputedStyle(select)
      const texto = document.createElement('canvas').getContext('2d')!
      texto.font = `${estilo.fontSize} ${estilo.fontFamily}`
      const disponible = select.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight)
      return texto.measureText(select.selectedOptions[0].text).width < disponible
    })).toBe(true)
    await page.setViewportSize({ width: 360, height: 640 })
  }
  await cabecera.getByRole('link', { name: 'Mi cuenta', exact: true }).click()
  await expect(page.getByText('Correo electrónico', { exact: true })).toBeVisible()
  await expect(page.getByText(sim.correo, { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('ID03: registra un expediente con consentimiento y muestra el selector de asignaciones completo', async ({ page, isMobile }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta sintética', permisos: ['adultos:ver', 'adultos:crear', 'adultos:asignar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const candidata = { usuario_id: sim.usuarioId, nombre: 'Mariana Reyes', rol: 'cuidador' }
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
    if (path.endsWith('/asignaciones')) return r.fulfill({ json: { data: { cuidadores: [], voluntarios: [] } } })
    if (path.endsWith('/candidatos/asignacion')) return r.fulfill({ json: pagina([candidata]) })
    return r.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await expect(page).toHaveURL(`${ruta}/cuenta`)
  await expect(page.getByRole('heading', { name: 'Accesos rápidos' })).toBeVisible()
  await expect(page.getByLabel(/^Nombres/)).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Módulos de la cuenta' }).getByRole('link', { name: 'Adultos', exact: true }).click()
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
  await page.getByRole('combobox', { name: /^Parentesco/ }).selectOption('Hermano/a')
  await page.getByLabel(/^Teléfono del contacto/).fill('8095550100')
  await page.getByRole('combobox', { name: /^Quién otorgó el consentimiento/ }).selectOption('adulto')
  await page.getByLabel(/Confirmo que se otorgó el consentimiento/).check()
  await page.getByRole('button', { name: 'Registrar adulto mayor', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Juana Prueba' })).toBeVisible()
  expect(alta).toMatchObject({ cedula: '00112345679', municipio_cod: '0101', consentimiento: { otorgado: true, otorgado_por: 'adulto' },
    contactos: [{ nombres: 'Elena', es_principal: true }] })

  if (isMobile) await page.setViewportSize({ width: 508, height: 618 })
  await page.getByRole('button', { name: 'Asignaciones', exact: true }).click()
  await page.getByRole('button', { name: 'Asignar personal' }).click()
  const persona = page.getByRole('combobox', { name: /^Cuidador o voluntario/ })
  await expect(persona).toHaveValue('')
  await persona.selectOption({ label: 'Mariana Reyes · Cuidador' })
  await expect.poll(() => persona.evaluate((select: HTMLSelectElement) => {
    const campo = select.closest('fieldset')!
    return Math.abs(campo.getBoundingClientRect().width - select.getBoundingClientRect().width) < 1
  })).toBe(true)
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
  await page.getByRole('link', { name: 'Visitas', exact: true }).click()
  await page.getByRole('button', { name: /Visita autorizada/ }).click()
  await page.getByRole('button', { name: 'Registrar realización', exact: true }).click()
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

test('ID04: programa y autoriza una visita con adultos y visitantes seleccionados', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta sintética', permisos: ['visitas:ver', 'visitas:programar', 'visitas:autorizar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const visitante = { usuario_id: sim.usuarioId, nombre: 'Patricia Prueba' }
  const fecha = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const visita = { visita_id: visitaId, razon: 'Seguimiento acordado', fecha, hora_programada: '09:00', estado: 'programada',
    autorizada_por: { usuario_id: sim.usuarioId }, participantes: [visitante], adultos: [adulto] }
  let alta: unknown
  await page.route(`${backend}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname
    if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/envejecientes')) return r.fulfill({ json: pagina([adulto]) })
    if (path.endsWith('/candidatos/visita')) return r.fulfill({ json: pagina([visitante]) })
    if (path.endsWith('/visitas') && r.request().method() === 'POST') {
      alta = r.request().postDataJSON()
      return r.fulfill({ status: 201, json: { data: visita } })
    }
    if (path.endsWith('/visitas')) return r.fulfill({ json: pagina([]) })
    if (path.endsWith(visitaId)) return r.fulfill({ json: { data: visita } })
    return r.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/visitas`)
  await page.getByRole('button', { name: 'Programar visita', exact: true }).click()
  await page.getByLabel(/^Fecha de visita/).fill(fecha)
  await page.getByLabel(/^Hora de visita/).fill('09:00')
  await page.getByLabel(/^Motivo de la visita/).fill(visita.razon)
  const programar = page.getByRole('button', { name: 'Programar visita', exact: true })
  const adultoSeleccion = page.getByRole('checkbox', { name: 'Juana Prueba' })
  await expect(programar).toBeDisabled()
  await adultoSeleccion.check()
  await page.getByRole('checkbox', { name: visitante.nombre }).check()
  await expect(programar).toBeEnabled()
  await page.getByRole('button', { name: 'Quitar Juana Prueba' }).click()
  await expect(programar).toBeDisabled()
  await adultoSeleccion.check()
  await programar.click()
  await expect(page.getByRole('heading', { name: 'Detalle de visita' })).toBeVisible()
  expect(alta).toEqual({ fecha, hora_programada: '09:00', razon: visita.razon, envejeciente_ids: [adultoId], participante_ids: [visitante.usuario_id] })
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

test('RF-19: configura la organización con catálogos dependientes e interruptores', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Organización sintética' })
  const sim = await simular(page, { cuentas: [cuenta] })
  const detalle = {
    cuenta: {
      cuenta_id: cuentaId, nombre: cuenta.nombre, tipo: cuenta.tipo,
      categoria: { categoria_cuenta_id: 3, nombre: 'Iglesia o parroquia' },
      municipio: { municipio_cod: '0101', nombre: 'Santo Domingo de Guzmán', provincia_cod: '01', provincia: 'Distrito Nacional' },
      direccion: null, telefono: null, correo: null, fecha_creacion: '2026-11-07T12:00:00Z',
    },
    contexto: cuenta,
  }
  let datosGuardados: Record<string, unknown> | undefined
  let preferenciasGuardadas: Record<string, unknown> | undefined
  const parametros = [
    { nombre: 'dias_sin_visita_alerta', valor: '15', tipo_dato: 'entero', valor_general: '15', es_propio: false, descripcion: null },
    { nombre: 'notificar_casos_prioritarios', valor: 'false', tipo_dato: 'booleano', valor_general: 'false', es_propio: false, descripcion: null },
  ]
  await page.route(backend, (r) => {
    if (r.request().method() === 'PATCH') datosGuardados = r.request().postDataJSON()
    return r.fulfill({ json: { data: detalle } })
  })
  await page.route(`${backend}/**`, (r) => {
    const path = new URL(r.request().url()).pathname
    if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/configuracion')) {
      if (r.request().method() === 'PATCH') preferenciasGuardadas = r.request().postDataJSON()
      return r.fulfill({ json: { data: parametros } })
    }
    return r.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/configuracion`)
  await expect(page.getByRole('heading', { level: 1, name: 'Configurar organización' })).toBeVisible()

  const contacto = page.getByRole('form', { name: 'Datos de contacto institucional' })
  await contacto.getByRole('combobox', { name: /^Categoría/ }).selectOption('4')
  await contacto.getByRole('combobox', { name: /^Provincia/ }).selectOption('25')
  const municipio = contacto.getByRole('combobox', { name: /^Municipio/ })
  await expect(municipio).toHaveValue('')
  await expect(contacto.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  await municipio.selectOption('2502')
  await contacto.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect.poll(() => datosGuardados).toMatchObject({ categoria_cuenta_id: 4, municipio_cod: '2502' })

  const preferencias = page.getByRole('form', { name: 'Preferencias de la cuenta' })
  const guardarPreferencias = preferencias.getByRole('button', { name: 'Guardar preferencias' })
  await expect(guardarPreferencias).toBeDisabled()
  await preferencias.getByRole('spinbutton', { name: /^Días sin visita/ }).fill('20')
  await preferencias.getByRole('switch', { name: 'Notificar casos prioritarios' }).click()
  await guardarPreferencias.click()
  await expect.poll(() => preferenciasGuardadas).toEqual({ valores: { dias_sin_visita_alerta: '20', notificar_casos_prioritarios: 'true' } })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('RF-16: programa una serie semanal con un cuidador asignado y días ISO', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta sintética', permisos: ['adultos:ver', 'agenda:ver', 'agenda:gestionar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const cuidador = { usuario_id: sim.usuarioId, cuidador_id: '12', nombre: 'Patricia Prueba' }
  let alta: unknown
  await page.route(`${API}/api/v1/catalogos/prioridades`, (r) => r.fulfill({ json: { data: [{ prioridad_id: 2, nombre: 'Media' }] } }))
  await page.route(`${backend}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname
    if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/envejecientes')) return r.fulfill({ json: pagina([adulto]) })
    if (path.endsWith('/asignaciones')) return r.fulfill({ json: { data: { cuidadores: [{ usuario_id: cuidador.usuario_id }] } } })
    if (path.endsWith('/candidatos/agenda')) return r.fulfill({ json: pagina([cuidador]) })
    if (path.endsWith('/tareas') && r.request().method() === 'POST') {
      alta = r.request().postDataJSON()
      return r.fulfill({ status: 201, json: { data: { serie_id: tareaId, tareas: [] } } })
    }
    if (path.endsWith('/tareas')) return r.fulfill({ json: pagina([]) })
    return r.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/agenda`)
  await page.getByRole('button', { name: 'Nueva tarea' }).click()
  await page.getByLabel(/^Título de la tarea/).fill('Seguimiento semanal')
  await page.getByRole('combobox', { name: /^Prioridad/ }).selectOption('2')
  await page.getByRole('combobox', { name: /^Adulto mayor/ }).selectOption(adultoId)
  await page.getByRole('combobox', { name: /^Cuidador asignado/ }).selectOption('12')
  const lunes = new Date()
  lunes.setUTCDate(lunes.getUTCDate() + (8 - lunes.getUTCDay()) % 7 + 7)
  const domingo = new Date(lunes)
  domingo.setUTCDate(lunes.getUTCDate() + 6)
  const fecha = lunes.toISOString().slice(0, 10)
  const hasta = domingo.toISOString().slice(0, 10)
  await page.getByLabel(/^Fecha programada/).fill(fecha)
  await page.getByLabel(/^Hora \(opcional\)/).fill('09:00')
  await page.getByText('Semanal', { exact: true }).click()
  await page.getByText('Lunes', { exact: true }).click()
  await page.getByText('Domingo', { exact: true }).click()
  await page.getByLabel(/^Se repite hasta/).fill(hasta)
  await expect(page.getByText(/Se crearán 2 tareas/)).toBeVisible()
  await page.getByRole('checkbox', { name: 'Requiere evidencia para completar' }).check()
  await page.getByRole('button', { name: 'Crear tarea' }).click()
  await expect.poll(() => alta).toMatchObject({ cuidador_id: '12', prioridad_id: 2, fecha_programada: fecha, hora_programada: '09:00',
    requiere_evidencia: true, repeticion: { frecuencia: 'semanal', hasta, dias_semana: [1, 7] } })
})
