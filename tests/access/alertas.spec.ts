/* Alertas conectadas: permisos por rol, filtros, paginación y errores al resolver · ID06, RF-04/RF-05/RF-18. © 2026 Equipo CuidaRed – INTEC. */
import { expect, test, type Page } from '@playwright/test'
import { API, cuentaActiva, iniciarSesion, simular, type CuentaSim, type Json } from './ayudas-fase2'

const cuentaId = '9007199254740993'
const ruta = `/operacion/${cuentaId}`
const prefijoApi = `/api/v1/cuentas/${cuentaId}`
const fecha = '2026-11-14T14:15:00Z'
const juana = { envejeciente_id: '11111111-1111-4111-8111-111111111111', nombres: 'Juana', apellidos: 'Prueba', estado: 'activo' }
const pedro = { envejeciente_id: '22222222-2222-4222-8222-222222222222', nombres: 'Pedro', apellidos: 'Ejemplo', estado: 'activo' }
const TIPOS = {
  riesgo_alto: { codigo: 'riesgo_alto', nombre: 'Riesgo alto' },
  ausencia_visitas: { codigo: 'ausencia_visitas', nombre: 'Seguimiento familiar' },
}

interface Alerta extends Json {
  alerta_envejeciente_id: string
  envejeciente_id: string
  nombres: string
  apellidos: string
  tipo: { codigo: string; nombre: string }
  estado: string
}
interface Llamada { metodo: string; ruta: string; consulta: URLSearchParams; cuerpo?: Json }
interface Fallo { status: number; code: string; antes?: (alerta: Alerta) => void }
interface Opciones {
  alertas?: Alerta[]
  adultos?: Array<typeof juana>
  avisos?: Json[]
  /** Errores que se devuelven, en orden, a los siguientes POST de resolver o de iniciar atención. */
  fallos?: Fallo[]
}

const crearAlerta = (numero: number, adulto: typeof juana = juana, tipo = TIPOS.riesgo_alto, extra: Json = {}): Alerta => ({
  alerta_envejeciente_id: `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`,
  envejeciente_id: adulto.envejeciente_id,
  nombres: adulto.nombres,
  apellidos: adulto.apellidos,
  tipo,
  prioridad: { nombre: tipo === TIPOS.riesgo_alto ? 'Alta' : 'Media', orden: tipo === TIPOS.riesgo_alto ? 1 : 2 },
  descripcion: 'Detalle verificado.',
  origen: 'sistema',
  estado: 'pendiente',
  fecha_alerta: fecha,
  fecha_atencion: null,
  atendida_por: null,
  cierre_automatico: false,
  accion_tomada: null,
  fuente: { tipo: 'riesgo', referencia_id: '1' },
  es_prioritaria: tipo === TIPOS.riesgo_alto,
  ...extra,
})

const aviso = (numero: number): Json => ({
  notificacion_id: `00000000-0000-4000-8000-0000000009${String(numero).padStart(2, '0')}`,
  alerta_envejeciente_id: '00000000-0000-4000-8000-000000000001',
  mensaje: 'Hay una alerta de caso prioritario por revisar.',
  estado: 'no_leida', fecha_notificacion: fecha, fecha_lectura: null,
})

function paginar(items: unknown[], consulta: URLSearchParams) {
  const page = Number(consulta.get('page') ?? 1)
  const limit = Number(consulta.get('limit') ?? 20)
  return { data: items.slice((page - 1) * limit, page * limit), meta: { page, limit, total: items.length, totalPages: Math.ceil(items.length / limit) } }
}

/** Simula las rutas de alertas, avisos y expediente de la cuenta con el mismo formato que la API (sin tocar ningún servicio real). */
async function montar(page: Page, cuenta: CuentaSim, opciones: Opciones = {}) {
  const alertas = opciones.alertas ?? [crearAlerta(1), crearAlerta(2, juana, TIPOS.ausencia_visitas)]
  const adultos = opciones.adultos ?? [juana, pedro]
  const llamadas: Llamada[] = []
  const fallos = [...(opciones.fallos ?? [])]
  await page.route(`${API}/api/v1/catalogos/tipos-alerta`, (req) => req.fulfill({ json: { data: Object.values(TIPOS) } }))
  await page.route(`${API}${prefijoApi}/**`, async (req) => {
    const peticion = req.request()
    const url = new URL(peticion.url())
    const sub = url.pathname.slice(prefijoApi.length)
    const metodo = peticion.method()
    llamadas.push({ metodo, ruta: sub, consulta: url.searchParams, cuerpo: metodo === 'GET' ? undefined : (peticion.postDataJSON() ?? {}) as Json })
    if (sub === '/contexto') return req.fulfill({ json: { data: cuenta } })
    if (sub === '/casos-prioritarios') return req.fulfill({ json: paginar([], url.searchParams) })
    if (sub === '/notificaciones-alerta') return req.fulfill({ json: paginar(opciones.avisos ?? [], url.searchParams) })
    if (sub === '/envejecientes') return req.fulfill({ json: paginar(adultos, url.searchParams) })
    const adulto = sub.match(/^\/envejecientes\/([^/]+)(\/historial)?$/)
    if (adulto) {
      const encontrado = adultos.find((item) => item.envejeciente_id === adulto[1])
      if (!encontrado) return req.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'mensaje_privado' }, requestId: 'prueba' } })
      return req.fulfill({ json: adulto[2] ? paginar([], url.searchParams) : { data: encontrado } })
    }
    if (sub === '/alertas') {
      const estado = url.searchParams.get('filter[estado]')
      const tipo = url.searchParams.get('filter[tipo]')
      const adultoFiltro = url.searchParams.get('filter[envejeciente_id]')
      const filtradas = alertas.filter((item) => (!estado || item.estado === estado) && (!tipo || item.tipo.codigo === tipo)
        && (!adultoFiltro || item.envejeciente_id === adultoFiltro))
      return req.fulfill({ json: paginar(filtradas, url.searchParams) })
    }
    const accion = sub.match(/^\/alertas\/([^/]+)(?:\/(resolver|en-atencion))?$/)
    if (accion) {
      const alerta = alertas.find((item) => item.alerta_envejeciente_id === accion[1])
      if (!alerta) return req.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'mensaje_privado' }, requestId: 'prueba' } })
      if (metodo === 'POST') {
        const fallo = fallos.shift()
        if (fallo) {
          fallo.antes?.(alerta)
          return req.fulfill({ status: fallo.status, json: { error: { code: fallo.code, message: 'mensaje_privado' }, requestId: 'prueba' } })
        }
        if (accion[2] === 'en-atencion') alerta.estado = 'en_proceso'
        else Object.assign(alerta, { estado: 'resuelta', fecha_atencion: fecha, atendida_por: 'Persona gestora', accion_tomada: llamadas.at(-1)?.cuerpo?.accion_tomada })
      }
      return req.fulfill({ json: { data: alerta } })
    }
    return req.fallback()
  })
  return { llamadas, alertas }
}

const llamadasA = (llamadas: Llamada[], metodo: string, patron: RegExp) =>
  llamadas.filter((llamada) => llamada.metodo === metodo && patron.test(llamada.ruta))

test('RF-04: el Cuidador resuelve una alerta con acción registrada, pero no puede ponerla en atención', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', tipo: 'organizacion', rol: 'cuidador',
    permisos: ['adultos:ver', 'alertas:ver', 'alertas:cerrar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const { llamadas } = await montar(page, cuenta)

  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/alertas`)
  await page.getByRole('button', { name: 'Alertas', exact: true }).click()
  await page.getByRole('button', { name: /Ver alerta: Riesgo alto/ }).click()
  await expect(page.getByText('Detalle verificado.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resolver alerta' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iniciar atención' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Resolver alerta' }).click()
  await page.getByLabel('Acción tomada').fill('Llamé a la familia y confirmé que está bien.')
  await page.getByRole('button', { name: 'Confirmar resolución' }).click()
  await expect(page.getByText('Alerta resuelta.')).toBeVisible()
  await expect(page.getByText('Persona gestora', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resolver alerta' })).toHaveCount(0)
  expect(llamadasA(llamadas, 'POST', /\/resolver$/).map((llamada) => llamada.cuerpo)).toEqual([{ accion_tomada: 'Llamé a la familia y confirmé que está bien.' }])
  expect(llamadasA(llamadas, 'POST', /\/en-atencion$/)).toHaveLength(0)
})

test('RF-04: filtra el listado por tipo de alerta y vuelve a mostrar todas al quitar el filtro', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', permisos: ['adultos:ver', 'alertas:ver', 'alertas:gestionar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const { llamadas } = await montar(page, cuenta)

  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/alertas?bandeja=alertas`)
  const lista = page.getByRole('region', { name: 'Listado de alertas' })
  await expect(lista.getByRole('button', { name: /Ver alerta: Riesgo alto/ })).toBeVisible()
  await expect(lista.getByRole('button', { name: /Ver alerta: Seguimiento familiar/ })).toBeVisible()

  const filtrada = page.waitForRequest((r) => {
    const url = new URL(r.url())
    return url.pathname.endsWith('/alertas') && url.searchParams.get('filter[tipo]') === 'ausencia_visitas'
  })
  await page.getByLabel('Tipo de alerta').selectOption('ausencia_visitas')
  await filtrada
  await expect(lista.getByRole('button', { name: /Ver alerta: Seguimiento familiar/ })).toBeVisible()
  await expect(lista.getByRole('button', { name: /Ver alerta: Riesgo alto/ })).toHaveCount(0)

  await page.getByLabel('Tipo de alerta').selectOption('')
  await expect(lista.getByRole('button', { name: /Ver alerta: Riesgo alto/ })).toBeVisible()
  const ultima = llamadasA(llamadas, 'GET', /^\/alertas$/).at(-1)
  expect(ultima?.consulta.has('filter[tipo]')).toBe(false)
})

test('RF-04: filtra por adulto mayor desde el listado y desde su expediente', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', tipo: 'familia', rol: 'coordinador',
    permisos: ['adultos:ver', 'alertas:ver', 'alertas:gestionar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const alertas = [crearAlerta(1, juana), crearAlerta(2, pedro, TIPOS.ausencia_visitas), crearAlerta(3, juana, TIPOS.ausencia_visitas)]
  const { llamadas } = await montar(page, cuenta, { alertas })

  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/alertas?bandeja=alertas`)
  const lista = page.getByRole('region', { name: 'Listado de alertas' })
  await expect(lista.getByRole('listitem')).toHaveCount(3)
  const filtro = page.getByRole('combobox', { name: 'Adulto mayor' })
  await expect(filtro.locator('option')).toHaveText(['Todos los adultos', 'Juana Prueba', 'Pedro Ejemplo'])

  const delAdulto = page.waitForRequest((r) => {
    const url = new URL(r.url())
    return url.pathname.endsWith('/alertas') && url.searchParams.get('filter[envejeciente_id]') === pedro.envejeciente_id
  })
  await filtro.selectOption(pedro.envejeciente_id)
  await delAdulto
  await expect(lista.getByRole('listitem')).toHaveCount(1)
  await expect(lista.getByRole('listitem').getByText('Pedro Ejemplo')).toBeVisible()
  await filtro.selectOption('')
  await expect(lista.getByRole('listitem')).toHaveCount(3)

  // Desde el expediente de Juana se llega a sus alertas con el filtro ya aplicado.
  await page.goto(`${ruta}/envejecientes`)
  await page.getByRole('button', { name: /Juana Prueba/ }).click()
  await page.getByRole('link', { name: 'Ver alertas de este adulto' }).click()
  await expect(page).toHaveURL(`${ruta}/alertas?bandeja=alertas&adulto=${juana.envejeciente_id}`)
  await expect(page.getByRole('combobox', { name: 'Adulto mayor' })).toHaveValue(juana.envejeciente_id)
  await expect(lista.getByRole('listitem')).toHaveCount(2)
  await expect(lista.getByRole('listitem').getByText('Pedro Ejemplo')).toHaveCount(0)
  expect(llamadasA(llamadas, 'GET', /^\/alertas$/).at(-1)?.consulta.get('filter[envejeciente_id]')).toBe(juana.envejeciente_id)

  // Un identificador que no es UUID en la dirección se ignora en lugar de enviarse al servidor.
  const antes = llamadasA(llamadas, 'GET', /^\/alertas$/).length
  await page.goto(`${ruta}/alertas?bandeja=alertas&adulto=no-es-un-uuid`)
  await expect(lista.getByRole('listitem')).toHaveCount(3)
  const nuevas = llamadasA(llamadas, 'GET', /^\/alertas$/).slice(antes)
  expect(nuevas.length).toBeGreaterThan(0)
  expect(nuevas.every((llamada) => !llamada.consulta.has('filter[envejeciente_id]'))).toBe(true)
})

test('el expediente de un adulto inactivo no ofrece el enlace a sus alertas', async ({ page }) => {
  const inactivo = { ...juana, estado: 'inactivo' }
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', tipo: 'familia', rol: 'coordinador',
    permisos: ['adultos:ver', 'alertas:ver', 'alertas:gestionar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  await montar(page, cuenta, { adultos: [inactivo] })

  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/envejecientes`)
  await page.getByRole('button', { name: /Juana Prueba/ }).click()
  await page.getByRole('tab', { name: 'Historial', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Filtrar historial' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver alertas de este adulto' })).toHaveCount(0)
})

test('RF-04: pagina el listado de alertas y vuelve a la primera página al cambiar un filtro', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', permisos: ['adultos:ver', 'alertas:ver', 'alertas:gestionar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  // 21 alertas con 20 por página: la segunda página trae solo la última.
  const alertas = Array.from({ length: 21 }, (_, indice) =>
    crearAlerta(indice + 1, { ...juana, nombres: `Persona${String(indice + 1).padStart(2, '0')}` }, TIPOS.riesgo_alto, indice === 20 ? { estado: 'resuelta' } : {}))
  const { llamadas } = await montar(page, cuenta, { alertas })

  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/alertas?bandeja=alertas`)
  const lista = page.getByRole('region', { name: 'Listado de alertas' })
  await expect(lista.getByRole('listitem')).toHaveCount(20)
  await expect(lista.getByText('Persona21 Prueba')).toHaveCount(0)
  await expect(lista.getByText('Página 1 de 2')).toBeVisible()
  await expect(lista.getByRole('button', { name: 'Anterior' })).toBeDisabled()

  await lista.getByRole('button', { name: 'Siguiente' }).click()
  await expect(lista.getByText('Página 2 de 2')).toBeVisible()
  await expect(lista.getByRole('listitem')).toHaveCount(1)
  await expect(lista.getByText('Persona21 Prueba')).toBeVisible()
  await expect(lista.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  expect(llamadasA(llamadas, 'GET', /^\/alertas$/).at(-1)?.consulta.get('page')).toBe('2')

  await lista.getByRole('button', { name: 'Anterior' }).click()
  await expect(lista.getByText('Página 1 de 2')).toBeVisible()
  await lista.getByRole('button', { name: 'Siguiente' }).click()
  await expect(lista.getByText('Página 2 de 2')).toBeVisible()

  // Con otro filtro la consulta vuelve a la página 1 y, al caber en una sola, desaparece el paginador.
  await page.getByLabel('Estado de la alerta').selectOption('resuelta')
  await expect(lista.getByRole('listitem')).toHaveCount(1)
  await expect(lista.getByRole('navigation', { name: 'Páginas del listado' })).toHaveCount(0)
  const ultima = llamadasA(llamadas, 'GET', /^\/alertas$/).at(-1)
  expect(ultima?.consulta.get('page')).toBe('1')
  expect(ultima?.consulta.get('filter[estado]')).toBe('resuelta')
})

test('RF-04: un error al resolver conserva el formulario, explica el fallo y permite reintentar', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', permisos: ['adultos:ver', 'alertas:ver', 'alertas:gestionar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const { llamadas } = await montar(page, cuenta, {
    fallos: [{ status: 503, code: 'DEPENDENCY_UNAVAILABLE' }, { status: 403, code: 'FORBIDDEN' }],
  })

  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/alertas?bandeja=alertas`)
  await page.getByRole('button', { name: /Ver alerta: Riesgo alto/ }).click()
  await page.getByRole('button', { name: 'Resolver alerta' }).click()
  const formulario = page.getByRole('form', { name: 'Resolver alerta' })

  // Una acción en blanco no llega al servidor.
  await formulario.getByLabel('Acción tomada').fill('   ')
  await formulario.getByRole('button', { name: 'Confirmar resolución' }).click()
  await expect(formulario.getByRole('alert')).toHaveText('Describe la acción tomada.')
  expect(llamadasA(llamadas, 'POST', /\/resolver$/)).toHaveLength(0)

  // El servicio no disponible no cierra la alerta ni borra lo escrito.
  await formulario.getByLabel('Acción tomada').fill('Coordiné la visita médica.')
  await formulario.getByRole('button', { name: 'Confirmar resolución' }).click()
  await expect(formulario.getByRole('alert')).toHaveText('No se pudo conectar con CuidaRed. Intenta de nuevo.')
  await expect(formulario.getByLabel('Acción tomada')).toHaveValue('Coordiné la visita médica.')
  await expect(page.getByText('Alerta resuelta.')).toHaveCount(0)

  // Un permiso revocado muestra su propio mensaje y el formulario sigue disponible.
  await formulario.getByRole('button', { name: 'Confirmar resolución' }).click()
  await expect(formulario.getByRole('alert')).toHaveText('No tienes permiso para realizar esta acción en esta cuenta.')

  // El tercer intento tiene éxito con el mismo texto.
  await formulario.getByRole('button', { name: 'Confirmar resolución' }).click()
  await expect(page.getByText('Alerta resuelta.')).toBeVisible()
  await expect(page.getByText('Coordiné la visita médica.')).toBeVisible()
  expect(llamadasA(llamadas, 'POST', /\/resolver$/).map((llamada) => llamada.cuerpo)).toEqual(Array(3).fill({ accion_tomada: 'Coordiné la visita médica.' }))
})

test('RF-04: si el motor cierra la alerta mientras se gestiona, se actualiza el detalle sin culpar a otra persona', async ({ page }) => {
  const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', permisos: ['adultos:ver', 'alertas:ver', 'alertas:gestionar'] })
  const sim = await simular(page, { cuentas: [cuenta] })
  const cerrarAutomaticamente = (alerta: Alerta) => {
    Object.assign(alerta, { estado: 'resuelta', cierre_automatico: true, fecha_atencion: fecha, accion_tomada: 'La condición dejó de cumplirse.' })
  }
  await montar(page, cuenta, { fallos: [{ status: 409, code: 'INVALID_STATE', antes: cerrarAutomaticamente }] })

  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/alertas?bandeja=alertas`)
  await page.getByRole('button', { name: /Ver alerta: Riesgo alto/ }).click()
  await page.getByRole('button', { name: 'Iniciar atención' }).click()
  await page.getByRole('button', { name: 'Confirmar inicio' }).click()
  await expect(page.getByText('La alerta ya no admite ese cambio porque cambió de estado. Se actualizó el detalle.')).toBeVisible()
  await expect(page.getByText('La alerta se cerró automáticamente al dejar de cumplirse su causa.')).toBeVisible()
  await expect(page.getByText('Resuelta', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resolver alerta' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Iniciar atención' })).toHaveCount(0)
  await expect(page.getByText(/estado actual de la persona/)).toHaveCount(0)
})

const ALERTAS = ['adultos:ver', 'alertas:ver']
const CASOS_CAMPANA: Array<{ rol: string; tipo: 'familia' | 'organizacion'; permisos: string[]; campana: boolean }> = [
  { rol: 'coordinador', tipo: 'familia', permisos: [...ALERTAS, 'alertas:gestionar'], campana: true },
  { rol: 'coordinador', tipo: 'organizacion', permisos: [...ALERTAS, 'alertas:gestionar'], campana: true },
  { rol: 'administrador', tipo: 'organizacion', permisos: [...ALERTAS, 'alertas:gestionar'], campana: true },
  { rol: 'cuidador', tipo: 'familia', permisos: [...ALERTAS, 'alertas:cerrar'], campana: false },
  { rol: 'cuidador', tipo: 'organizacion', permisos: [...ALERTAS, 'alertas:cerrar'], campana: false },
  { rol: 'familiar', tipo: 'familia', permisos: ['adultos:ver', 'necesidades:ver'], campana: false },
  { rol: 'voluntario', tipo: 'organizacion', permisos: ['adultos:ver', 'visitas:ver'], campana: false },
]

for (const caso of CASOS_CAMPANA) {
  test(`RF-18: ${caso.campana ? 'muestra' : 'oculta'} la campana de notificaciones al ${caso.rol} de ${caso.tipo === 'familia' ? 'una cuenta Familia' : 'una Organización'}`, async ({ page }) => {
    const cuenta = cuentaActiva({ cuenta_id: cuentaId, nombre: 'Cuenta de prueba', tipo: caso.tipo, rol: caso.rol, permisos: caso.permisos })
    const sim = await simular(page, { cuentas: [cuenta] })
    const { llamadas } = await montar(page, cuenta, { avisos: [aviso(1), aviso(2)] })

    await iniciarSesion(page, sim.correo)
    await page.goto(`${ruta}/cuenta`)
    await expect(page.getByRole('heading', { level: 1, name: 'Cuenta de prueba' })).toBeVisible()
    const campana = page.getByRole('banner').getByRole('link', { name: /Notificaciones/ })
    if (caso.campana) {
      await expect(campana).toHaveAccessibleName('Notificaciones, 2 sin leer')
    } else {
      await expect(campana).toHaveCount(0)
      expect(llamadasA(llamadas, 'GET', /^\/notificaciones-alerta$/)).toHaveLength(0)
    }
    if (!caso.permisos.includes('alertas:ver')) return

    // La bandeja de notificaciones solo existe para quien las recibe; el resto cae en Casos prioritarios.
    await page.goto(`${ruta}/alertas?bandeja=avisos`)
    const bandejas = page.getByRole('group', { name: 'Bandeja de alertas' })
    await expect(bandejas.getByRole('button', { name: 'Alertas', exact: true })).toBeVisible()
    if (caso.campana) {
      await expect(bandejas.getByRole('button', { name: 'Notificaciones', exact: true })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Notificaciones de alertas' })).toBeVisible()
    } else {
      await expect(bandejas.getByRole('button', { name: 'Notificaciones', exact: true })).toHaveCount(0)
      await expect(page.getByRole('region', { name: 'Casos prioritarios' })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Notificaciones de alertas' })).toHaveCount(0)
      expect(llamadasA(llamadas, 'GET', /^\/notificaciones-alerta$/)).toHaveLength(0)
    }
  })
}
