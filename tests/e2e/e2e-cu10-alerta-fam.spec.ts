/*
 * e2e-cu10-alerta-fam.spec.ts — Suite E2E-CU10-ALERTA-FAM: escenarios Gherkin de CU-10 (SRS §16.5).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * El paso del tiempo se simula moviendo las fechas en 'cuidared:db' antes de cargar la app: la última visita
 * completada de Camila Torres (o la creación de un perfil nuevo sin visitas) queda N días en el pasado.
 * El umbral es el parámetro DIAS_SIN_VISITA_ALERTA (prm-1) de la configuración de la cuenta (15 por defecto) y
 * las notificaciones al coordinador se guardan en la tabla Notificacion (campana de la barra superior).
 * Reglas de Negocio V2: la evaluación corre cuando la app monta (se espera a que genere la alerta) y solo las visitas
 * realizadas (estado «completada») cuentan como contacto; las alertas se notifican a los administradores y
 * coordinadores de la cuenta del adulto. Las pruebas omiten el onboarding de un solo uso (tiene su propia suite).
 */
import { expect, test, type Page } from '@playwright/test'
import { CUENTAS, editarDB, haceDiasInstante, haceDiasISO, leerDB, limpiarDatos, sesionDirecta, umbralDiasSinVisita, visitaCompletada } from './fixtures'

/** Marca como vista la guía de onboarding de todos los usuarios y roles demo (clave `cuidared:onboarding:<userId>:<rol>`). */
async function omitirOnboarding(page: Page) {
  await page.evaluate(() => {
    const ids = ['u-admin', 'u-coord', 'u-cuid', 'u-vol', 'u-fam', 'u-giselle', 'u-ctorres', 'u-eduardo', 'u-fcoord']
    const roles = ['admin', 'coordinador', 'cuidador', 'voluntario', 'familiar']
    for (const id of ids) for (const rol of roles) localStorage.setItem(`cuidared:onboarding:${id}:${rol}`, new Date().toISOString())
  })
}

/** Deja a Camila Torres con una única visita completada hace `dias` días (como adulto principal o adicional del hogar). */
async function ultimaVisitaHace(page: Page, dias: number) {
  await editarDB(
    page,
    (db, v) => {
      db.visitas = db.visitas.filter(
        (x) => !(x.estado === 'completada' && (x.adultoId === 'a-camila' || x.detallesAdicionales.some((d) => d.adultoId === 'a-camila'))),
      )
      db.visitas.push(v)
    },
    visitaCompletada({
      id: 'v-e2e-ultima',
      adultoId: 'a-camila',
      cuidadorId: 'u-cuid',
      fecha: haceDiasISO(dias),
      instante: haceDiasInstante(dias),
      observaciones: 'Última visita registrada.',
    }),
  )
}

/**
 * El motor de reglas se evalúa cuando la app monta (no al cargar el módulo): se espera a que genere la alerta de
 * seguimiento del adulto y se devuelve su registro del servidor simulado.
 */
async function seguimientoGenerado(page: Page, adultoId: string) {
  const buscar = async () => (await leerDB(page)).alertas.find((a) => a.adultoId === adultoId && a.tipo === 'seguimiento')
  await expect.poll(async () => !!(await buscar()), { message: `el motor de reglas debe generar la alerta de seguimiento de ${adultoId}` }).toBe(true)
  return (await buscar())!
}

/** Tarjetas de la bandeja de alertas del coordinador para el adulto. */
async function alertasDe(page: Page, nombre: string) {
  await page.goto('/coordinador/alertas')
  await page.getByRole('searchbox', { name: 'Buscar alertas' }).fill(nombre)
  return page.getByRole('list', { name: 'Alertas' }).getByRole('link').filter({ hasText: nombre })
}

test.describe('E2E-CU10-ALERTA-FAM · Gestionar alerta de seguimiento familiar', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page)
  })

  test('Escenario: Generar alerta después de 15 días sin contacto', async ({ page }) => {
    // Dado que existe un adulto mayor con un perfil activo
    // Y han transcurrido más de 15 días calendario desde la última visita o contacto registrado
    expect(umbralDiasSinVisita(await leerDB(page))).toBe(15)
    await ultimaVisitaHace(page, 20)
    // Cuando el sistema realiza la evaluación del seguimiento
    await sesionDirecta(page, CUENTAS.coordinador.id)

    // Entonces debe generar una alerta de seguimiento
    const alerta = await seguimientoGenerado(page, 'a-camila')
    // Y la alerta debe quedar en estado "Pendiente"
    expect(alerta).toMatchObject({ estado: 'pendiente', titulo: '20 días sin visita comunitaria', generadaPor: 'sistema' })
    // Y debe ser visible para los coordinadores responsables (notificación y bandeja de alertas)
    const notificacion = (await leerDB(page)).notificaciones.find((n) => n.usuarioId === CUENTAS.coordinador.id && n.alertaId === alerta.id)
    expect(notificacion).toMatchObject({ estado: 'no_leida', mensaje: 'Seguimiento familiar: 20 días sin visita comunitaria · Camila Torres' })
    await page.getByTestId('notificaciones').click()
    await expect(page.getByRole('dialog', { name: 'Notificaciones' }).getByRole('button').filter({ hasText: 'Camila Torres' })).toContainText('20 días sin visita comunitaria')
    await page.keyboard.press('Escape')
    const tarjetas = await alertasDe(page, 'Camila Torres')
    await expect(tarjetas).toHaveCount(1)
    await expect(tarjetas.first()).toContainText('Seguimiento familiar')
    await expect(tarjetas.first()).toContainText('20 días sin visita comunitaria')
    await expect(tarjetas.first()).toContainText('Pendiente')
  })

  test('Escenario: No generar alerta cuando el contacto ocurrió dentro del período permitido', async ({ page }) => {
    // Dado que existe un adulto mayor con un perfil activo
    // Y han transcurrido 15 días calendario o menos desde el último contacto registrado (límite exacto: 15)
    expect(umbralDiasSinVisita(await leerDB(page))).toBe(15)
    await ultimaVisitaHace(page, 15)
    // Cuando el sistema realiza la evaluación del seguimiento
    await sesionDirecta(page, CUENTAS.coordinador.id)

    // Entonces no debe generar una alerta por superar el umbral de seguimiento (se mira la bandeja, que ya montó la app y evaluó las reglas)
    const tarjetas = await alertasDe(page, 'Camila Torres')
    await expect(tarjetas.filter({ hasText: 'Seguimiento familiar' })).toHaveCount(0)
    const db = await leerDB(page)
    expect(db.alertas.filter((a) => a.adultoId === 'a-camila' && a.tipo === 'seguimiento')).toEqual([])
    expect(db.notificaciones.filter((n) => n.mensaje.includes('Camila Torres') && n.mensaje.startsWith('Seguimiento familiar'))).toEqual([])
    // (el perfil indica los días transcurridos sin marcarlos como vencidos)
    await page.goto('/coordinador/adultos/a-camila')
    await expect(page.getByRole('heading', { name: 'Camila Torres' }).first()).toBeVisible()
    await expect(page.getByText('Superó el límite de')).toHaveCount(0)
  })

  test('Escenario: Generar alerta cuando no existe historial de contacto', async ({ page }) => {
    // Dado que existe un adulto mayor con perfil activo
    // Y no existe ningún contacto o visita registrada (perfil nuevo, sin visitas como adulto principal ni adicional)
    // Cuando han transcurrido más de 15 días calendario desde la creación del perfil
    await editarDB(
      page,
      (db, creadoEn) => {
        const base = db.adultos.find((a) => a.id === 'a-alicia')!
        db.adultos.push({
          ...base,
          id: 'a-e2e-nuevo',
          nombre: 'Rosa',
          apellido: 'Almonte',
          cedula: '001-9090909-0',
          creadoEn,
          actualizadoEn: creadoEn,
        })
      },
      haceDiasInstante(18),
    )
    await sesionDirecta(page, CUENTAS.coordinador.id)

    // Entonces el sistema debe generar una alerta de seguimiento
    const alerta = await seguimientoGenerado(page, 'a-e2e-nuevo')
    expect(alerta).toMatchObject({ estado: 'pendiente', titulo: '18 días sin visita comunitaria' })
    expect(alerta.descripcion).toContain('No hay visitas registradas desde la creación del perfil')
    // Y debe mostrarla como pendiente
    const tarjetas = await alertasDe(page, 'Rosa Almonte')
    await expect(tarjetas).toHaveCount(1)
    await expect(tarjetas.first()).toContainText('Seguimiento familiar')
    await expect(tarjetas.first()).toContainText('Pendiente')
  })

  test('Escenario: El coordinador gestiona la alerta de seguimiento (en atención, resolver con la acción tomada y reabrir con motivo)', async ({ page }) => {
    // Dado que existe una alerta de seguimiento pendiente (Camila Torres, 20 días sin visita)
    await ultimaVisitaHace(page, 20)
    await sesionDirecta(page, CUENTAS.coordinador.id)
    const alertaId = (await seguimientoGenerado(page, 'a-camila')).id
    const estadoActual = () => page.getByRole('list', { name: 'Estado de la alerta' }).locator('[aria-current="step"]')
    const estadoEnBD = async () => (await leerDB(page)).alertas.find((a) => a.id === alertaId)!

    // Cuando el coordinador la abre, la pone en atención (la nota del avance es opcional)
    await page.goto(`/coordinador/alertas/${alertaId}`)
    await expect(page.getByRole('heading', { name: 'Camila Torres' })).toBeVisible()
    await expect(estadoActual()).toContainText('Pendiente')
    await expect(page.getByRole('form', { name: 'Gestionar alerta' })).toBeVisible()
    await page.getByRole('radio', { name: 'Poner en atención' }).click()
    await page.getByRole('button', { name: 'Poner en atención' }).click()
    await expect(page.getByText('Alerta marcada como "En atención"')).toBeVisible()
    await expect(estadoActual()).toContainText('En atención')
    expect(await estadoEnBD()).toMatchObject({ estado: 'en_atencion' })

    // Entonces no puede resolverla sin describir la acción tomada (DFP6-04)
    await page.getByRole('radio', { name: 'Resolver' }).click()
    await page.getByRole('button', { name: 'Resolver alerta' }).click()
    await expect(page.getByText('Describe la acción tomada (mínimo 5 caracteres).')).toBeVisible()
    expect(await estadoEnBD()).toMatchObject({ estado: 'en_atencion' })

    // Y al registrarla queda atendida, con quién la atendió y la acción en el historial
    const accion = 'Se llamó a la familia y se programó una visita para el jueves.'
    await page.getByRole('textbox', { name: /Acción tomada/ }).fill(accion)
    await page.getByRole('button', { name: 'Resolver alerta' }).click()
    await expect(page.getByText('Alerta cerrada: quedó registrada la acción tomada')).toBeVisible()
    await expect(estadoActual()).toContainText('Atendida')
    expect(await estadoEnBD()).toMatchObject({ estado: 'atendida', atendidaPor: CUENTAS.coordinador.id, notaAtencion: accion })
    await expect(page.getByRole('definition').filter({ hasText: /Laura Núñez/ })).toBeVisible() // fila «Atendida por»

    // Y reabrirla exige el motivo de la reapertura: vuelve a «En atención»
    await expect(page.getByRole('form', { name: 'Reabrir alerta' })).toBeVisible()
    await page.getByRole('button', { name: 'Reabrir alerta' }).click()
    await expect(page.getByText('Indica el motivo de la reapertura (mínimo 5 caracteres).')).toBeVisible()
    expect(await estadoEnBD()).toMatchObject({ estado: 'atendida' })
    await page.getByRole('textbox', { name: /Motivo de la reapertura/ }).fill('La familia reportó que sigue sin recibir visitas.')
    await page.getByRole('button', { name: 'Reabrir alerta' }).click()
    await expect(estadoActual()).toContainText('En atención')
    const reabierta = await estadoEnBD()
    expect(reabierta).toMatchObject({ estado: 'en_atencion' })
    expect(reabierta.atendidaPor).toBeUndefined()
    expect(reabierta.acciones.map((a) => a.estado)).toEqual(['en_atencion', 'atendida', 'en_atencion'])
  })
})
