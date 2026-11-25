/* Seguimiento externo y confirmación organizativa con datos interceptados. © 2026 Equipo CuidaRed – INTEC. */
import { expect, test } from '@playwright/test'
import { API, cuentaActiva, iniciarSesion, simular } from './ayudas-fase2'
const cuentaId = '71',
  visitaId = '22222222-2222-4222-8222-222222222222'
const adultoId = '33333333-3333-4333-8333-333333333333'
const base = `${API}/api/v1/cuentas/${cuentaId}`,
  ruta = `/operacion/${cuentaId}/visitas`
const pagina = (data: unknown[]) => ({
  data,
  meta: { page: 1, limit: 25, total: data.length, totalPages: data.length ? 1 : 0 },
})
const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo' }).format(new Date())

test('la programación institucional identifica al grupo y conserva un responsable interno', async ({ page }, info) => {
  const cuenta = cuentaActiva({
    cuenta_id: cuentaId,
    nombre: 'Organización de prueba',
    permisos: ['visitas:ver', 'visitas:programar', 'visitas:autorizar'],
  })
  const sim = await simular(page, { cuentas: [cuenta] })
  let body: Record<string, unknown> | undefined
  const visita = {
    visita_id: visitaId,
    fecha,
    hora_programada: '09:00',
    hora_fin_programada: '10:00',
    estado: 'programada',
    razon: 'Actividad comunitaria',
    tipo_visita: 'institucional',
    participantes: [],
    adultos: [],
    autorizada_por: { usuario_id: sim.usuarioId },
  }
  await page.route(`${base}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname
    if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/envejecientes') || path.endsWith('/candidatos/visita')) return r.fulfill({ json: pagina([]) })
    if (path.endsWith('/visitas') && r.request().method() === 'POST') {
      body = r.request().postDataJSON()
      return r.fulfill({ status: 201, json: { data: visita } })
    }
    if (path.endsWith('/visitas')) return r.fulfill({ json: pagina([]) })
    if (path.endsWith(visitaId)) return r.fulfill({ json: { data: visita } })
    return r.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await page.goto(ruta)
  await page.getByRole('button', { name: 'Programar visita', exact: true }).click()
  await page.getByRole('radio', { name: 'Institución o grupo', exact: true }).check()
  await page.getByLabel(/^Tipo de institución o grupo/).selectOption('fundacion')
  await page.getByLabel(/^Nombre de la institución o grupo/).fill('Fundación de prueba')
  await page.getByLabel(/^Nombre del contacto responsable/).fill('Contacto de prueba')
  await page.getByLabel(/^Correo del visitante/).fill('contacto@example.test')
  await page.getByLabel(/^Cantidad de visitantes/).fill('12')
  await page.screenshot({ path: info.outputPath('contacto-visitante.png'), fullPage: true, scale: 'css' })
  await page.getByRole('button', { name: 'Continuar con el horario' }).click()
  await page.getByLabel(/^Motivo de la visita/).fill(visita.razon)
  await page.getByLabel(/^Fecha de la visita/).fill(fecha)
  await page.getByLabel(/^Hora de inicio/).fill('09:00')
  await page.getByLabel(/^Hora de fin/).fill('10:00')
  await expect(page.getByRole('checkbox', { name: 'Yo coordino la visita' })).toBeChecked()
  await expect(page.getByRole('button', { name: 'Programar y autorizar visita' })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('programacion-visita.png'), fullPage: true, scale: 'css' })
  await page.getByRole('button', { name: 'Programar y autorizar visita' }).click()
  await expect(page.getByRole('heading', { name: 'Detalle de visita' })).toBeVisible()
  expect(body).toMatchObject({
    autorizar: true,
    envejeciente_ids: [],
    participante_ids: [sim.usuarioId],
    visitante_externo: {
      tipo: 'institucional',
      nombre: 'Contacto de prueba',
      correo: 'contacto@example.test',
      entidad: 'Fundación de prueba',
      tipo_entidad: 'fundacion',
      cantidad: 12,
    },
  })
})

test('la revisión externa precarga el horario completo y el historial ofrece los rechazos', async ({ page }) => {
  const cuenta = cuentaActiva({
    cuenta_id: cuentaId,
    nombre: 'Organización de prueba',
    permisos: ['visitas:ver', 'visitas:autorizar', 'visitas:programar'],
  })
  const sim = await simular(page, { cuentas: [cuenta] })
  const consultas: string[] = []
  await page.route(`${base}/**`, async (r) => {
    const url = new URL(r.request().url()),
      path = url.pathname
    if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/solicitudes-visita')) {
      consultas.push(url.searchParams.get('filter[estado]') ?? '')
      return r.fulfill({
        json: pagina([
          {
            solicitud_visita_id: visitaId,
            estado: 'pendiente',
            visitante: { nombres: 'Contacto', apellidos: 'Sintético', correo: 'contacto@example.test' },
            tipo_visita: 'institucional',
            entidad_visitante: 'Grupo de prueba',
            cantidad_visitantes: 8,
            fecha_propuesta: fecha,
            hora_propuesta: '10:15',
            hora_fin_propuesta: '11:45',
            motivo: 'Actividad comunitaria',
          },
        ]),
      })
    }
    if (path.endsWith('/visitas') || path.endsWith('/candidatos/visita')) return r.fulfill({ json: pagina([]) })
    return r.fallback()
  })
  await iniciarSesion(page, sim.correo)
  await page.goto(ruta)
  await page.getByText('Historial', { exact: true }).click()
  await page.getByRole('button', { name: 'Ver solicitudes rechazadas' }).click()
  await expect.poll(() => consultas.includes('rechazada')).toBe(true)
  await page.getByLabel(/^Estado de la solicitud/).selectOption('pendiente')
  await page.getByRole('button', { name: 'Revisar y autorizar' }).click()
  await expect(page.getByLabel(/^Hora de inicio/)).toHaveValue('10:15')
  await expect(page.getByLabel(/^Hora de fin/)).toHaveValue('11:45')
  await expect(page.getByLabel(/^Responsable de la organización/)).toHaveValue(sim.usuarioId)
  await expect(page.getByText('No hay responsables disponibles en esta página.', { exact: true })).toHaveCount(0)
})

for (const [rol, realizada] of [
  ['administrador', true],
  ['coordinador', true],
  ['administrador', false],
] as const)
  test(`${rol} confirma ${realizada ? 'la realización' : 'que no se realizó'} después del horario`, async ({
    page,
  }, info) => {
    const cuenta = cuentaActiva({
      cuenta_id: cuentaId,
      nombre: 'Organización de prueba',
      rol,
      permisos: ['visitas:ver', 'visitas:autorizar', 'visitas:programar'],
    })
    const sim = await simular(page, { cuentas: [cuenta] })
    let confirmacion: unknown
    const visita = {
      visita_id: visitaId,
      fecha,
      hora_programada: '09:00',
      hora_fin_programada: '10:00',
      estado: 'programada',
      razon: 'Visita por confirmar',
      tipo_visita: 'personal',
      participantes: [],
      adultos: [{ envejeciente_id: adultoId, nombres: 'Persona', apellidos: 'Sintética' }],
      autorizada_por: { usuario_id: sim.usuarioId },
      puede_confirmar_realizacion: true,
    }
    await page.route(`${base}/**`, async (r) => {
      const path = new URL(r.request().url()).pathname
      if (path.endsWith('/contexto')) return r.fulfill({ json: { data: cuenta } })
      if (path.endsWith('/confirmar-realizacion')) {
        confirmacion = r.request().postDataJSON()
        Object.assign(visita, {
          estado: realizada ? 'completada' : 'cancelada',
          puede_confirmar_realizacion: false,
          confirmada_en: new Date().toISOString(),
          confirmacion_notas: realizada ? 'La organización comprobó la realización.' : 'El visitante no pudo asistir.',
        })
        return r.fulfill({ json: { data: visita } })
      }
      if (path.endsWith(visitaId)) return r.fulfill({ json: { data: visita } })
      if (path.endsWith('/visitas')) return r.fulfill({ json: pagina([]) })
      return r.fallback()
    })
    await iniciarSesion(page, sim.correo)
    await page.goto(ruta + '?visita=' + visitaId)
    await page.getByRole('button', { name: 'Confirmar si se realizó' }).click()
    await page.getByLabel(/^Resultado de la visita/).selectOption(realizada ? 'realizada' : 'no_realizada')
    const nota = realizada ? 'La organización comprobó la realización.' : 'El visitante no pudo asistir.'
    await page.getByLabel(realizada ? /^Constancia de realización/ : /^Motivo por el que no se realizó/).fill(nota)
    await page.screenshot({ path: info.outputPath('confirmacion-visita.png'), fullPage: true, scale: 'css' })
    await page.getByRole('button', { name: 'Guardar confirmación' }).click()
    await expect(
      page.getByText(
        realizada ? 'Realización verificada por la organización' : 'Se confirmó que la visita no se realizó',
        { exact: true }
      )
    ).toBeVisible()
    expect(confirmacion).toEqual({ realizada, nota })
  })

test('el visitante aporta observaciones y una foto antes de la confirmación organizativa', async ({ page }, info) => {
  const codigo = 'VIS-ABCD-2345'
  let observacion: string | null = null
  const evidencias: { evidencia_id: string; nombre_archivo: string; fecha: string }[] = []
  const estado = () => ({
    organizacion: 'Organización de prueba',
    estado: 'autorizada',
    estado_texto: 'Autorizada',
    fecha,
    hora: '09:00',
    hora_fin_programada: '10:00',
    motivo_rechazo: null,
    observacion,
    puede_registrar_observacion: !observacion,
    puede_adjuntar_evidencias: evidencias.length < 3,
    evidencias,
  })
  await page.route(`${API}/api/v1/publico/**`, async (r) => {
    const path = new URL(r.request().url()).pathname,
      body = r.request().postDataJSON()
    expect(r.request().headers().authorization).toBeUndefined()
    expect(body.codigo).toBe(codigo)
    if (path.endsWith('/observacion')) observacion = body.observacion
    if (path.endsWith('/evidencias')) {
      expect(body.archivo).toMatch(/^[A-Za-z0-9+/]+=*$/)
      evidencias.push({ evidencia_id: body.id, nombre_archivo: body.nombre, fecha: new Date().toISOString() })
    }
    await r.fulfill({ json: { data: estado() } })
  })
  await page.goto('/solicitud-visita#observaciones')
  await page.getByLabel('Código de seguimiento').fill(codigo)
  await page.getByRole('button', { name: 'Consultar solicitud' }).click()
  await page
    .getByRole('textbox', { name: 'Tu observación', exact: true })
    .fill('La actividad transcurrió según lo previsto.')
  await page.getByRole('button', { name: 'Guardar observación' }).click()
  await expect(page.getByText(/La confirmación de realización por la organización sigue pendiente/)).toBeVisible()
  await page
    .getByLabel('Selecciona una fotografía')
    .setInputFiles({
      name: 'actividad.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        'base64'
      ),
    })
  await page.getByRole('button', { name: 'Adjuntar fotografía' }).click()
  await expect(page.getByText('actividad.png', { exact: true })).toBeVisible()
  await expect(page.getByText('Adjunta', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('aportes-visitante.png'), fullPage: true, scale: 'css' })
})
