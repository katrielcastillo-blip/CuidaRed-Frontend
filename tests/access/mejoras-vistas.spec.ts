/* Mejoras PWA: activación alineada, navegación integrada, calendario, tareas y perfil. © 2026 Equipo CuidaRed – INTEC. */
import { expect, test, type Page } from '@playwright/test'
import { API, cuentaActiva, iniciarSesion, miembro, simular } from './ayudas-fase2'

const raiz = '/operacion/25'
const backend = `${API}/api/v1/cuentas/25`
const fecha = '2026-11-28'
const permisos = ['adultos:ver', 'visitas:ver', 'visitas:autorizar', 'visitas:programar', 'agenda:ver', 'agenda:gestionar', 'agenda:ejecutar', 'usuarios:gestionar', 'reportes:ver', 'resumen:ver', 'alertas:ver', 'cuenta:suscripcion']
const visita = (id: string, hora: string, fin: string) => ({ visita_id: id, fecha, hora_programada: hora, hora_fin_programada: fin, razon: `Visita ${id}`, estado: 'programada', participantes: [], adultos: [], autorizada_por: null, fecha_actualizacion: '2026-11-25T12:00:00Z', pendiente_autorizacion: false })
const citas = [visita('11111111-1111-4111-8111-111111111111', '10:00', '11:00'), visita('22222222-2222-4222-8222-222222222222', '10:30', '11:30')]
const tareas = ['pendiente', 'en_progreso', 'completada', 'cancelada'].map((estado, i) => ({ tarea_id: String(i + 1), titulo: `Cuidado ${i + 1}`, estado, envejeciente_id: 'adulto', envejeciente_nombre: 'Juana Prueba', cuidador_id: 'cuidador', cuidador_nombre: 'Laura Díaz', fecha_programada: fecha, hora_programada: '09:00', prioridad: 'media', requiere_evidencia: false, es_repetitiva: false, evidencias: { validadas: 0, pendientes: 0, rechazadas: 0 } }))
const pagina = (data: unknown[], total = data.length) => ({ data, meta: { page: 1, limit: 100, total, totalPages: total ? 1 : 0 } })

async function preparar(page: Page) {
  const cuenta = cuentaActiva({ cuenta_id: '25', nombre: 'Fundación Esperanza', es_titular: true, permisos })
  const sim = await simular(page, { cuentas: [cuenta], miembros: { '25': [miembro('1', 'María', 'Reyes', 'cuidador')] } })
  await page.route(`${backend}/**`, ruta => {
    const path = new URL(ruta.request().url()).pathname
    if (path.endsWith('/contexto')) return ruta.fulfill({ json: { data: cuenta } })
    if (path.endsWith('/visitas')) return ruta.fulfill({ json: pagina(citas) })
    if (path.endsWith('/tareas')) return ruta.fulfill({ json: pagina(tareas) })
    if (path.endsWith('/envejecientes') || path.endsWith('/candidatos/agenda')) return ruta.fulfill({ json: pagina([]) })
    if (path.endsWith('/tareas/1')) return ruta.fulfill({ json: { data: tareas[0] } })
    if (path.includes('/evidencias') || path.endsWith('/solicitudes-visita') || path.endsWith('/notificaciones-alerta')) return ruta.fulfill({ json: pagina([]) })
    const cita = citas.find(c => path.endsWith('/visitas/' + c.visita_id))
    if (cita) return ruta.fulfill({ json: { data: cita } })
    return ruta.fallback()
  })
  await iniciarSesion(page, sim.correo)
  return sim
}

test('activación coloca el correo y el código en filas del mismo ancho', async ({ page, isMobile }, info) => {
  await page.setViewportSize({ width: isMobile ? 360 : 1280, height: 800 })
  await simular(page)
  await page.goto('/registro')
  await page.evaluate(() => document.fonts.ready)
  const correo = await page.getByLabel(/^Correo electrónico/).boundingBox()
  const codigo = await page.getByLabel(/^Código de invitación/).boundingBox()
  expect(codigo!.y).toBeGreaterThan(correo!.y + correo!.height)
  expect(Math.abs(codigo!.width - correo!.width)).toBeLessThan(1)
  await page.screenshot({ path: info.outputPath('activacion.png'), fullPage: true, scale: 'css' })
})

test('miembros conserva el menú y las subopciones se despliegan sin alterar permisos', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await preparar(page)
  const menu = page.getByRole('navigation', { name: 'Módulos de la cuenta' })
  await menu.getByRole('link', { name: 'Miembros', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Miembros', exact: true })).toBeVisible()
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Inicio', exact: true })).toBeVisible()
  await expect(page.getByText('María Reyes', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('miembros-integrado.png'), scale: 'css' })
  await expect(menu.getByRole('link', { name: 'Solicitudes', exact: true })).toHaveCount(0)
  await menu.getByRole('link', { name: 'Visitas', exact: true }).click()
  await expect(menu.getByRole('link', { name: 'Solicitudes', exact: true })).toBeVisible()
  await menu.getByRole('link', { name: 'Solicitudes', exact: true }).click()
  await expect(page).toHaveURL(`${raiz}/solicitudes-visita`)
  await menu.getByRole('link', { name: 'Reportes', exact: true }).click()
  await expect(menu.getByRole('link', { name: 'Resumen', exact: true })).toBeVisible()
})

test('el calendario separa citas simultáneas y abre su detalle existente', async ({ page, isMobile }, info) => {
  await preparar(page)
  await page.goto(`${raiz}/visitas?accion=calendario`)
  await page.getByRole('tab', { name: 'Día', exact: true }).click()
  await page.getByLabel('Fecha del calendario', { exact: true }).fill(fecha)
  const eventos = page.getByRole('region', { name: 'Horario de visitas', exact: true }).getByRole('button', { name: /Abrir visita:/ })
  await expect(eventos).toHaveCount(2)
  const a = (await eventos.nth(0).boundingBox())!, b = (await eventos.nth(1).boundingBox())!
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1)
  await page.screenshot({ path: info.outputPath('calendario-dia.png'), fullPage: true, scale: 'css' })
  await page.getByRole('tab', { name: 'Semana', exact: true }).click()
  await expect(eventos).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth))
  if (!isMobile) await page.screenshot({ path: info.outputPath('calendario-semana.png'), fullPage: true, scale: 'css' })
  await eventos.first().click()
  await expect(page).toHaveURL(new RegExp(`visita=${citas[0].visita_id}`))
  await expect(page.getByRole('button', { name: 'Reprogramar visita', exact: true })).toBeVisible()
})

test('el tablero usa las mismas tareas y conserva los formularios de ejecución', async ({ page }, info) => {
  await preparar(page)
  await page.goto(`${raiz}/agenda`)
  await expect(page.getByRole('heading', { name: 'Cuidado 1', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Tablero', exact: true }).click()
  const tablero = page.getByLabel('Tablero de tareas', { exact: true })
  await expect(tablero.getByRole('region', { name: 'Pendiente', exact: true }).getByRole('heading', { name: 'Cuidado 1' })).toBeVisible()
  await expect(tablero.getByRole('region', { name: 'Completada', exact: true }).getByRole('heading', { name: 'Cuidado 3' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('tablero-tareas.png'), fullPage: true, scale: 'css' })
  await page.getByRole('button', { name: 'Ver detalle: Cuidado 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Iniciar', exact: true })).toBeVisible()
})

test('perfil presenta datos reales y permite editar sin perder el cambio de cuenta', async ({ page }, info) => {
  await preparar(page)
  await page.getByRole('link', { name: 'Mi cuenta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Laura Díaz', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Información personal', exact: true })).toContainText('laura@example.test')
  await expect(page.getByRole('link', { name: /Restablecer contraseña/ })).toHaveAttribute('href', '/recuperar')
  await expect(page.getByLabel(/^Nombres/)).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('perfil-consulta.png'), fullPage: true, scale: 'css' })
  await page.getByRole('link', { name: 'Editar perfil', exact: true }).click()
  await expect(page.getByLabel(/^Nombres/)).toHaveValue('Laura')
  await expect(page.getByRole('button', { name: /Fundación Esperanza/ })).toBeVisible()
})

test('notificaciones agrupa por día y actualiza lectura usando la API existente', async ({ page }, info) => {
  await preparar(page)
  const ahora = new Date().toISOString()
  let leida = false
  await page.route(`${backend}/notificaciones-alerta*`, ruta => {
    const noLeidas = new URL(ruta.request().url()).searchParams.get('filter[estado]') === 'no_leida'
    return ruta.fulfill({ json: pagina(noLeidas && leida ? [] : [{ notificacion_id: 'aviso-1', alerta_envejeciente_id: null, mensaje: 'Revisar el seguimiento comunitario', estado: leida ? 'leida' : 'no_leida', fecha_notificacion: ahora, fecha_lectura: leida ? ahora : null }]) })
  })
  await page.route(`${backend}/notificaciones-alerta/aviso-1/leer`, ruta => { leida = true; return ruta.fulfill({ status: 204 }) })
  await page.goto(`${raiz}/alertas?bandeja=avisos`)
  const bandeja = page.getByRole('region', { name: 'Notificaciones de alertas', exact: true })
  await expect(bandeja.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('notificaciones.png'), fullPage: true, scale: 'css' })
  await bandeja.getByRole('button', { name: 'Marcar como leída', exact: true }).click()
  await expect(bandeja.getByRole('button', { name: 'Sin leer (0)', exact: true })).toBeVisible()
  await expect(bandeja.getByText('Leída', { exact: true })).toBeVisible()
  expect(leida).toBe(true)
})
