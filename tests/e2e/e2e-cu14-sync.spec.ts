/*
 * e2e-cu14-sync.spec.ts — Suite E2E-CU14-SYNC: escenarios Gherkin de CU-14 (SRS §16.9).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reglas de Negocio V2: trabajan sin conexión el CUIDADOR (visitas completas y necesidades) y el VOLUNTARIO (visita
 * mínima con observación). Sincronización reescrita (src/domain/sync.ts): envío por lotes de 25, reintentos con espera
 * exponencial, idempotencia por UUID de cliente (`claveCliente`: reintentar la misma operación no duplica el registro) y
 * Last-Write-Wins por marca de tiempo UTC. Las pruebas omiten el onboarding de un solo uso (se verifica en la suite de CU-01).
 *
 * Sin conexión real: context.setOffline(true) (navigator.onLine = false + evento "offline").
 * Conflicto Last-Write-Wins y reintentos: dos pestañas del MISMO contexto actúan como dos dispositivos que comparten el
 * "servidor" (localStorage) y la cola local (IndexedDB). Una pestaña queda sin conexión con la simulación por pestaña de la
 * app (sessionStorage 'cuidared:simular-sin-conexion') y la otra sigue en línea.
 */
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { CUENTA_FAMILIA, CUENTAS, haceDiasISO, haceDiasInstante, leerDB, limpiarDatos, sesionDirecta, visitaCompletada } from './fixtures'

const OBSERVACIONES = 'Visita registrada sin conexión durante la prueba E2E.'
const OBSERVACION_VOLUNTARIO = 'Conversamos un rato sin conexión; estaba de buen ánimo.'
const DESCRIPCION = 'Necesidad registrada sin conexión durante la prueba E2E.'
const MOTIVO = 'Acompañamiento cubierto por la parroquia.'
const COMPLETADA = 'Sincronización completada: 1 registro(s) enviado(s).'

/** Marca como vista la guía de onboarding de los usuarios demo (clave `cuidared:onboarding:<userId>:<rol>`). */
async function omitirOnboarding(page: Page) {
  const claves = [...Object.entries(CUENTAS).map(([rol, c]) => `${c.id}:${rol}`), `${CUENTA_FAMILIA.id}:coordinador`].map((k) => `cuidared:onboarding:${k}`)
  await page.evaluate((ks) => ks.forEach((k) => localStorage.setItem(k, new Date().toISOString())), claves)
}

interface FilaCola {
  id: string
  entidad: string
  registroId: string
  usuarioId: string
  claveCliente?: string
  intentos: number
  datos: { observaciones?: string }
}

/** Registros pendientes en la cola offline del dispositivo (IndexedDB 'cuidared-offline'). */
const colaOffline = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<FilaCola[]>((resolve) => {
        const req = indexedDB.open('cuidared-offline')
        req.onsuccess = () => {
          const r = req.result.transaction('pendientes').objectStore('pendientes').getAll()
          r.onsuccess = () => resolve(r.result)
        }
        req.onerror = () => resolve([])
      }),
  )

/** Registra una visita a Camila Torres desde el formulario completo del cuidador (ya abierto). */
async function registrarVisita(page: Page) {
  const form = page.getByRole('form', { name: 'Registro de visita' })
  await form.getByRole('radio', { name: 'Estable' }).click()
  await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
  await form.getByRole('button', { name: 'Registrar visita' }).click()
  await expect(page.getByText('Guardada en el dispositivo · Pendiente de sincronización')).toBeVisible()
}

/** Cambia el estado de la necesidad abierta en `page` (pantalla de detalle). Resolverla exige el motivo. */
async function cambiarEstado(page: Page, estado: 'En proceso' | 'Satisfecha') {
  await page.getByRole('radio', { name: estado }).click()
  if (estado === 'Satisfecha') await page.getByRole('textbox', { name: /^Motivo de la resolución/ }).fill(MOTIVO)
  await page.getByRole('button', { name: 'Guardar cambio de estado' }).click()
}

/** Abre otra pestaña del mismo contexto (otro «dispositivo») sin conexión simulada y con la ruta indicada. */
async function dispositivoSinRed(context: BrowserContext, ruta: string) {
  const pagina = await context.newPage()
  await pagina.goto('/inicio')
  await pagina.evaluate(() => sessionStorage.setItem('cuidared:simular-sin-conexion', '1'))
  await pagina.goto(ruta)
  await expect(pagina.getByTestId('indicador-conexion')).toContainText('Sin conexión')
  return pagina
}

/** Abre «Conexión y sincronización» desde el indicador de la barra superior. */
async function abrirSincronizacion(page: Page) {
  await page.getByTestId('indicador-conexion').click()
  await expect(page.getByTestId('estado-conexion')).toBeVisible()
}

/**
 * Activa o desactiva un interruptor con el teclado (Espacio). Se usa en «Modo de práctica», el último bloque de la página:
 * a 360 px con registros pendientes la barra superior desborda (ver el test fixme de RF-06 más abajo) y el navegador amplía la
 * ventana de diseño, de modo que el clic del ratón/táctil cae fuera del interruptor aunque sea visible.
 */
async function alternar(interruptor: Locator) {
  await interruptor.focus()
  await interruptor.press('Space')
}

const interruptorSinRed = (page: Page) => page.getByRole('switch', { name: 'Simular sin conexión en este dispositivo' })

test.describe('E2E-CU14-SYNC · Sincronizar datos offline', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page)
  })

  test('Escenario: Sincronizar una visita registrada sin conexión', async ({ page, context }) => {
    // Dado que el usuario (cuidador) registró una visita mientras no tenía conexión
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    await expect(page.getByRole('form', { name: 'Registro de visita' })).toBeVisible()
    await context.setOffline(true)
    await registrarVisita(page)
    // Y la visita quedó pendiente de sincronización
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    expect((await leerDB(page)).visitas.some((v) => v.observaciones === OBSERVACIONES)).toBe(false)

    // Cuando se restablece la conexión
    await context.setOffline(false)

    // Entonces el sistema debe sincronizar la visita con la base de datos central
    await expect(page.getByText(COMPLETADA)).toBeVisible({ timeout: 10_000 })
    const visita = (await leerDB(page)).visitas.find((v) => v.observaciones === OBSERVACIONES)
    expect(visita).toMatchObject({ adultoId: 'a-camila', cuidadorId: CUENTAS.cuidador.id, estado: 'completada' })
    expect(visita?.pendienteSync).toBeUndefined()
    // Y debe actualizar su estado como sincronizado (indicador de conexión, cola local y detalle de la visita)
    await expect(page.getByTestId('pendientes-sync')).toHaveCount(0)
    expect(await colaOffline(page)).toEqual([])
    await page.getByRole('link', { name: 'Ver la visita' }).click()
    await expect(page).toHaveURL(new RegExp(`/cuidador/visitas/${visita!.id}$`))
    await expect(page.getByText(OBSERVACIONES)).toBeVisible()
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toHaveCount(0)
  })

  test('La confirmación de una visita registrada sin conexión se actualiza al sincronizarse', async ({ page, context }) => {
    // CU-14: "debe actualizar su estado como sincronizado" también en la pantalla de confirmación abierta.
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    await expect(page.getByRole('form', { name: 'Registro de visita' })).toBeVisible()
    await context.setOffline(true)
    await registrarVisita(page)
    await context.setOffline(false)
    await expect(page.getByText(COMPLETADA)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('pendientes-sync')).toHaveCount(0)
    // La confirmación deja de mostrar el registro como pendiente.
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toHaveCount(0, { timeout: 3_000 })
    await expect(page.getByTestId('visita-sincronizada')).toContainText('Ya se sincronizó con el servidor')
  })

  test('Escenario: Sincronizar la visita mínima de un voluntario registrada sin conexión', async ({ page, context }) => {
    // Dado que el voluntario (Miguel Acosta) registró sin conexión la visita a Alicia Castillo con su observación
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva?adulto=a-alicia')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    await context.setOffline(true)
    await form.getByText('La visita se realizó').click()
    await form.getByRole('textbox', { name: /Observación/ }).fill(OBSERVACION_VOLUNTARIO)
    await form.getByRole('button', { name: 'Guardar visita' }).click()
    await expect(page.getByText('Guardada en el dispositivo · Pendiente de sincronización')).toBeVisible()
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    expect((await leerDB(page)).visitas.some((v) => v.observaciones === OBSERVACION_VOLUNTARIO)).toBe(false)

    // Cuando se restablece la conexión
    await context.setOffline(false)

    // Entonces la visita llega al servidor con la misma forma mínima (sin estado del adulto, aspectos ni evidencias)
    await expect(page.getByText(COMPLETADA)).toBeVisible({ timeout: 10_000 })
    const visita = (await leerDB(page)).visitas.find((v) => v.observaciones === OBSERVACION_VOLUNTARIO)
    expect(visita).toMatchObject({ adultoId: 'a-alicia', cuidadorId: CUENTAS.voluntario.id, estado: 'completada', checklist: [], evidencias: [] })
    expect(visita?.estadoAdulto || '').toBe('')
    expect(visita?.pendienteSync).toBeUndefined()
    // Y se actualiza como sincronizada: sin pendientes en el dispositivo y registrada en «Registradas»
    await expect(page.getByTestId('pendientes-sync')).toHaveCount(0)
    expect(await colaOffline(page)).toEqual([])
    await page.getByRole('link', { name: 'Ver mis visitas' }).click()
    await page.getByRole('tab', { name: /^Registradas/ }).click()
    await expect(page.getByText(OBSERVACION_VOLUNTARIO)).toBeVisible()
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toHaveCount(0)
  })

  test('Escenario: Sincronizar una necesidad registrada sin conexión', async ({ page, context }) => {
    // Dado que el usuario (cuidador) registró una necesidad mientras no tenía conexión
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/necesidades/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(form).toBeVisible()
    await context.setOffline(true)
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Alimentación' })
    await form.getByRole('textbox', { name: /Descripción/ }).fill(DESCRIPCION)
    await form.getByRole('button', { name: 'Registrar necesidad' }).click()
    // Y la necesidad quedó pendiente de sincronización
    await page.waitForURL(/\/cuidador\/necesidades\/n-/)
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toBeVisible()
    expect((await leerDB(page)).necesidades.some((n) => n.descripcion === DESCRIPCION)).toBe(false)

    // Cuando se restablece la conexión
    await context.setOffline(false)

    // Entonces el sistema debe sincronizar la necesidad con la base de datos central
    await expect(page.getByText(COMPLETADA)).toBeVisible({ timeout: 10_000 })
    const n = (await leerDB(page)).necesidades.find((x) => x.descripcion === DESCRIPCION)
    expect(n).toMatchObject({ adultoId: 'a-camila', tipo: 'alimentacion', estado: 'pendiente', registradaPor: CUENTAS.cuidador.id })
    // Y debe actualizar su estado como sincronizado
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('pendientes-sync')).toHaveCount(0)
    expect(await colaOffline(page)).toEqual([])
  })

  test('Escenario: Mantener datos pendientes cuando la conexión continúa ausente', async ({ page, context }) => {
    await page.clock.install()
    // Dado que existen registros pendientes de sincronización
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    await expect(page.getByRole('form', { name: 'Registro de visita' })).toBeVisible()
    await context.setOffline(true)
    await registrarVisita(page)
    // Y el dispositivo continúa sin conexión
    await page.getByTestId('indicador-conexion').click()
    await expect(page.getByTestId('estado-conexion')).toHaveText('Sin conexión')

    // Cuando el sistema intenta sincronizar los registros (reintento automático periódico)
    await page.clock.fastForward('01:05')
    await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toBeDisabled()

    // Entonces debe conservar los registros pendientes
    await expect(page.getByRole('heading', { name: 'Pendientes de sincronización (1)' })).toBeVisible()
    await expect(page.getByTestId('lista-pendientes').getByText('Pendiente de sincronización')).toHaveCount(1)
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    expect(await colaOffline(page)).toEqual([expect.objectContaining({ entidad: 'visita', intentos: 0 })])
    // Y no debe indicar que fueron sincronizados correctamente
    await expect(page.getByText(/Sincronización completada/)).toHaveCount(0)
    await expect(page.getByTestId('ultimo-resultado')).toHaveCount(0)
    expect((await leerDB(page)).visitas.some((v) => v.observaciones === OBSERVACIONES)).toBe(false)
  })

  test('Escenario: Un error del servidor mantiene el registro pendiente y se reenvía con «Sincronizar ahora»', async ({ page, context }) => {
    // Dado que hay una visita pendiente y el servidor no responde (flujo alternativo B: fallo simulado)
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    await expect(page.getByRole('form', { name: 'Registro de visita' })).toBeVisible()
    await context.setOffline(true)
    await registrarVisita(page)
    await abrirSincronizacion(page)
    const falloServidor = page.getByRole('switch', { name: 'Simular error del servidor al sincronizar' })
    await alternar(falloServidor)
    await expect(falloServidor).toBeChecked()

    // Cuando vuelve la conexión y el servidor rechaza el envío
    await context.setOffline(false)

    // Entonces el registro sigue en el dispositivo, anotando el intento fallido y la espera antes de reintentar
    await expect(page.getByText('No se pudieron sincronizar 1 registro(s). Siguen guardados en el dispositivo y se reintentará.')).toBeVisible({ timeout: 10_000 })
    const lista = page.getByTestId('lista-pendientes')
    await expect(lista).toContainText('El servidor no respondió (fallo simulado). (1 de 8 intentos)')
    await expect(lista).toContainText('Próximo reintento automático')
    await expect(page.getByTestId('ultimo-resultado')).toContainText('Se reintentará (intento 1 de 8)')
    await expect(page.getByTestId('ultimo-resultado')).not.toContainText('1 registro(s) enviado(s)')
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    expect((await leerDB(page)).visitas.some((v) => v.observaciones === OBSERVACIONES)).toBe(false)
    expect(await colaOffline(page)).toEqual([expect.objectContaining({ entidad: 'visita', intentos: 1 })])

    // Y cuando el servidor vuelve a responder, «Sincronizar ahora» lo envía sin esperar el turno de reintento
    await alternar(falloServidor)
    await expect(falloServidor).not.toBeChecked()
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click()
    await expect(page.getByText(COMPLETADA)).toBeVisible({ timeout: 10_000 })
    expect((await leerDB(page)).visitas.filter((v) => v.observaciones === OBSERVACIONES)).toHaveLength(1)
    await expect(page.getByTestId('pendientes-sync')).toHaveCount(0)
    expect(await colaOffline(page)).toEqual([])
  })

  test('Escenario: Un reintento de la misma operación no duplica la visita (otro dispositivo la envió primero)', async ({ page, context }) => {
    // Dado que la misma visita pendiente está en dos pestañas del mismo usuario (la cola local es común, cada pestaña la carga)
    await sesionDirecta(page, CUENTAS.cuidador.id, '/inicio')
    await page.evaluate(() => sessionStorage.setItem('cuidared:simular-sin-conexion', '1'))
    await page.goto('/cuidador/visitas/nueva?adulto=a-camila')
    await expect(page.getByTestId('indicador-conexion')).toContainText('Sin conexión')
    await registrarVisita(page)
    const cola = await colaOffline(page)
    expect(cola).toHaveLength(1)
    const clave = cola[0]!.claveCliente
    expect(clave).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const segunda = await dispositivoSinRed(context, '/cuidador')
    await expect(segunda.getByTestId('pendientes-sync')).toHaveText('1')

    // Cuando la primera pestaña recupera la conexión y envía la visita
    await abrirSincronizacion(page)
    await interruptorSinRed(page).click()
    await expect(page.getByText(COMPLETADA)).toBeVisible({ timeout: 10_000 })
    const idVisita = cola[0]!.registroId
    expect((await leerDB(page)).visitas.filter((v) => v.observaciones === OBSERVACIONES)).toHaveLength(1)
    expect((await leerDB(page)).visitas.find((v) => v.id === idVisita)).toBeTruthy()
    // (la segunda pestaña aún cree que está pendiente: no se enteró de que el servidor ya la tiene)
    await expect(segunda.getByTestId('pendientes-sync')).toHaveText('1')

    // Y la segunda pestaña reintenta la MISMA operación (misma clave de cliente) al recuperar la conexión
    await abrirSincronizacion(segunda)
    await interruptorSinRed(segunda).click()
    // Entonces el servidor la reconoce como duplicada: no crea otra visita y la pestaña queda sin pendientes
    await expect(segunda.getByTestId('pendientes-sync')).toHaveCount(0, { timeout: 10_000 })
    await expect(segunda.getByTestId('ultimo-resultado')).toContainText('1 ya estaba(n) en el servidor y no se duplicaron.')
    const db = await leerDB(page)
    expect(db.visitas.filter((v) => v.observaciones === OBSERVACIONES)).toHaveLength(1)
    expect(db.visitas.filter((v) => v.id === idVisita)).toHaveLength(1)
    // (y deja una sola constancia de la operación en la auditoría)
    expect(db.auditoria.filter((e) => e.accion === 'sync.registro' && e.registroId === idVisita)).toHaveLength(1)
    expect(db.auditoria.filter((e) => e.accion === 'visita.registrar' && e.registroId === idVisita)).toHaveLength(1)
    expect(await colaOffline(page)).toEqual([])
  })

  test('Escenario: Un reintento de la misma operación no duplica la visita (el dispositivo la conservó tras enviarla)', async ({ page, context }) => {
    // Dado que una visita registrada sin conexión ya llegó al servidor
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    await expect(page.getByRole('form', { name: 'Registro de visita' })).toBeVisible()
    await context.setOffline(true)
    await registrarVisita(page)
    const [operacion] = await colaOffline(page)
    expect(operacion).toBeTruthy()
    await context.setOffline(false)
    await expect(page.getByText(COMPLETADA)).toBeVisible({ timeout: 10_000 })
    expect(await colaOffline(page)).toEqual([])
    expect((await leerDB(page)).visitas.filter((v) => v.observaciones === OBSERVACIONES)).toHaveLength(1)

    // Cuando el navegador se cerró antes de borrar la operación del dispositivo (la misma fila vuelve a la cola) y se reabre la app
    await page.evaluate(
      (fila) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('cuidared-offline')
          req.onsuccess = () => {
            const t = req.result.transaction('pendientes', 'readwrite')
            t.objectStore('pendientes').put(fila)
            t.oncomplete = () => resolve()
            t.onerror = () => reject(t.error)
          }
        }),
      operacion!,
    )
    await page.goto('/cuidador')
    // Entonces el sistema la reconoce como ya enviada: la descarta del dispositivo sin crear otra visita
    await expect.poll(async () => (await colaOffline(page)).length, { message: 'la operación ya enviada debe retirarse de la cola local' }).toBe(0)
    await expect(page.getByTestId('pendientes-sync')).toHaveCount(0)
    const db = await leerDB(page)
    expect(db.visitas.filter((v) => v.observaciones === OBSERVACIONES)).toHaveLength(1)
    expect(db.auditoria.filter((e) => e.accion === 'visita.registrar' && e.registroId === operacion!.registroId)).toHaveLength(1)
  })

  test('Escenario: Sincronizar más de 25 registros pendientes los envía todos por lotes', async ({ page }) => {
    const TOTAL = 27 // un lote completo (25) y otro de 2
    const ids = Array.from({ length: TOTAL }, (_, i) => `v-e2e-lote-${String(i + 1).padStart(2, '0')}`)
    // Dado que el cuidador tiene 27 visitas capturadas sin conexión en el dispositivo (cola local en IndexedDB)
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador')
    await expect(page.getByTestId('usuario-actual')).toContainText('Cuidador')
    const filas = ids.map((id, i) => {
      const instante = haceDiasInstante(1 + i / 100)
      const datos = visitaCompletada({ id, adultoId: 'a-camila', cuidadorId: CUENTAS.cuidador.id, fecha: haceDiasISO(1), instante, observaciones: `Visita ${i + 1} de la cola, registrada sin conexión.` })
      return {
        id: `op-e2e-${i + 1}`,
        usuarioId: CUENTAS.cuidador.id,
        entidad: 'visita',
        tipo: 'crear',
        registroId: id,
        datos,
        baseActualizadoEn: null,
        actualizadoEn: instante,
        creadaEn: instante,
        intentos: 0,
        claveCliente: crypto.randomUUID(),
        orden: i + 1,
      }
    })
    await page.evaluate(
      (rows) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('cuidared-offline')
          req.onsuccess = () => {
            const t = req.result.transaction('pendientes', 'readwrite')
            for (const r of rows) t.objectStore('pendientes').put(r)
            t.oncomplete = () => resolve()
            t.onerror = () => reject(t.error)
          }
        }),
      filas,
    )
    expect((await leerDB(page)).visitas.some((v) => ids.includes(v.id))).toBe(false)

    // Cuando la app se abre con conexión
    await page.goto('/cuidador/sincronizacion')

    // Entonces envía los 27 registros (en dos peticiones) y los retira del dispositivo
    await expect(page.getByText(`Sincronización completada: ${TOTAL} registro(s) enviado(s).`)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('ultimo-resultado')).toContainText(`${TOTAL} registro(s) enviado(s) al servidor.`)
    const db = await leerDB(page)
    expect(db.visitas.filter((v) => ids.includes(v.id))).toHaveLength(TOTAL)
    expect(await colaOffline(page)).toEqual([])
    await expect(page.getByTestId('pendientes-sync')).toHaveCount(0)
  })

  // BUG DE LA APP (RF-06): con registros pendientes, el cuidador con dos cuentas (selector de cuenta en la barra superior) ve la
  // barra desbordar a 360 px: scrollWidth 369 sin conexión y 385 en línea con «Por sincronizar» + contador, en cualquier pantalla
  // (solo al estar sin red o con pendientes; con 0 pendientes y en línea mide 360). El chevron del botón de cuenta (BUTTON de
  // SelectorCuenta, con min-w-0 y el icono con flex-none) queda fuera de la ventana y el navegador móvil amplía la ventana de diseño
  // (innerWidth 369-385 en lugar de 360). Se mantiene la aserción estricta hasta que se corrija.
  test('RF-06: con registros pendientes la barra superior no desborda a 360 px (cuidador con dos cuentas)', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'movil', 'RF-06 se verifica en la resolución de referencia (proyecto movil, 360×640)')
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    await expect(page.getByRole('form', { name: 'Registro de visita' })).toBeVisible()
    await context.setOffline(true)
    await registrarVisita(page)
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    const { scrollWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth }))
    expect(page.viewportSize()).toEqual({ width: 360, height: 640 })
    expect(scrollWidth).toBeLessThanOrEqual(360)
  })

  for (const caso of [
    { gana: 'servidor', primero: 'dispositivo', esperado: 'satisfecha', texto: 'se conservó la versión del servidor (más reciente)' },
    { gana: 'dispositivo', primero: 'servidor', esperado: 'en_proceso', texto: 'se conservó la versión de este dispositivo' },
  ] as const) {
    test(`Escenario: Resolver conflicto de sincronización (gana la versión más reciente: ${caso.gana})`, async ({ page, context }) => {
      // Dos "dispositivos" del mismo cuidador sobre la necesidad n-1 (Elena Rodríguez, pendiente)
      await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/necesidades/n-1')
      const enLinea = page // dispositivo B: en línea
      const sinRed = await dispositivoSinRed(context, '/cuidador/necesidades/n-1') // dispositivo A: sin conexión (simulada solo en esta pestaña)
      await expect(enLinea.getByRole('heading', { name: 'Actualizar estado' })).toBeVisible()
      const base = (await leerDB(page)).necesidades.find((n) => n.id === 'n-1')!
      expect(base.estado).toBe('pendiente')

      // Dado que un registro fue modificado localmente y también fue modificado en el servidor
      // (el orden de las dos ediciones decide qué marca de tiempo UTC es más reciente)
      const editarSinRed = async () => {
        await cambiarEstado(sinRed, 'En proceso')
        await expect(sinRed.getByText(/Guardado en el dispositivo · Pendiente de sincronización/)).toBeVisible()
      }
      const editarEnLinea = async () => {
        await cambiarEstado(enLinea, 'Satisfecha')
        await expect(enLinea.getByText('Necesidad marcada como «Satisfecha»')).toBeVisible()
      }
      if (caso.primero === 'dispositivo') {
        await editarSinRed()
        await enLinea.waitForTimeout(20) // marcas de tiempo distintas
        await editarEnLinea()
      } else {
        await editarEnLinea()
        await sinRed.waitForTimeout(20)
        await editarSinRed()
      }
      const enServidor = (await leerDB(page)).necesidades.find((n) => n.id === 'n-1')!
      expect(enServidor.estado).toBe('satisfecha')

      // Cuando se restablece la conexión y se detecta el conflicto
      await sinRed.getByTestId('indicador-conexion').click()
      await expect(sinRed.getByText('Necesidad · modificada')).toBeVisible()
      await interruptorSinRed(sinRed).click()

      // Entonces el sistema debe resolver el conflicto aplicando la regla de "última escritura gana"
      const resultado = sinRed.getByTestId('ultimo-resultado')
      await expect(resultado).toContainText('Conflictos resueltos', { timeout: 10_000 })
      await expect(resultado).toContainText(`Necesidad n-1: ${caso.texto}.`)
      await expect(sinRed.getByText(/1 conflicto\(s\) resuelto\(s\) con "última escritura gana"/)).toBeVisible()
      const db = await leerDB(page)
      const final = db.necesidades.find((n) => n.id === 'n-1')!
      expect(final.estado).toBe(caso.esperado)
      // (se conserva el registro completo de la versión ganadora: resolución incluida o ninguna)
      if (caso.gana === 'servidor') expect(final).toMatchObject({ motivoResolucion: MOTIVO, satisfechaPor: CUENTAS.cuidador.id })
      else expect(final.motivoResolucion ?? final.satisfechaEn).toBeUndefined()
      // Y debe utilizar la marca de tiempo UTC asociada a cada modificación
      const conflicto = db.auditoria.find((e) => e.accion === 'sync.conflicto' && e.registroId === 'n-1')
      expect(conflicto?.detalle).toMatch(/local \d{4}-\d{2}-\d{2}T[\d:.]+Z · servidor \d{4}-\d{2}-\d{2}T[\d:.]+Z/)
      const [, local, servidor] = conflicto!.detalle!.match(/local (\S+) · servidor (\S+)\)/)!
      expect(caso.gana === 'dispositivo' ? local! > servidor! : servidor! > local!).toBe(true)
      expect(final.actualizadoEn).toBe(caso.gana === 'dispositivo' ? local : servidor)
      await expect(sinRed.getByTestId('pendientes-sync')).toHaveCount(0)
    })
  }
})
