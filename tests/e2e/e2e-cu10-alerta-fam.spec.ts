/*
 * e2e-cu10-alerta-fam.spec.ts — Suite E2E-CU10-ALERTA-FAM: escenarios Gherkin de CU-10 (SRS §16.5).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * El paso del tiempo se simula moviendo las fechas en 'cuidared:db' antes de cargar la app: la última visita
 * completada de Camila Torres (o la creación de un perfil nuevo sin visitas) queda N días en el pasado.
 * El umbral es el parámetro DIAS_SIN_VISITA_ALERTA (prm-1) de la configuración de la cuenta (15 por defecto) y
 * las notificaciones al coordinador se guardan en la tabla Notificacion (campana de la barra superior).
 */
import { expect, test, type Page } from '@playwright/test'
import { CUENTAS, editarDB, haceDiasInstante, haceDiasISO, leerDB, limpiarDatos, sesionDirecta, umbralDiasSinVisita, visitaCompletada } from './fixtures'

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

/** Tarjetas de la bandeja de alertas del coordinador para el adulto. */
async function alertasDe(page: Page, nombre: string) {
  await page.goto('/coordinador/alertas')
  await page.getByRole('searchbox', { name: 'Buscar alertas' }).fill(nombre)
  return page.getByRole('list', { name: 'Alertas' }).getByRole('link').filter({ hasText: nombre })
}

test.describe('E2E-CU10-ALERTA-FAM · Gestionar alerta de seguimiento familiar', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Generar alerta después de 15 días sin contacto', async ({ page }) => {
    // Dado que existe un adulto mayor con un perfil activo
    // Y han transcurrido más de 15 días calendario desde la última visita o contacto registrado
    expect(umbralDiasSinVisita(await leerDB(page))).toBe(15)
    await ultimaVisitaHace(page, 20)
    // Cuando el sistema realiza la evaluación del seguimiento
    await sesionDirecta(page, CUENTAS.coordinador.id)

    // Entonces debe generar una alerta de seguimiento
    const alerta = (await leerDB(page)).alertas.find((a) => a.adultoId === 'a-camila' && a.tipo === 'seguimiento')
    // Y la alerta debe quedar en estado "Pendiente"
    expect(alerta).toMatchObject({ estado: 'pendiente', titulo: '20 días sin visita comunitaria', generadaPor: 'sistema' })
    // Y debe ser visible para los coordinadores responsables (notificación y bandeja de alertas)
    const notificacion = (await leerDB(page)).notificaciones.find((n) => n.usuarioId === CUENTAS.coordinador.id && n.alertaId === alerta!.id)
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

    // Entonces no debe generar una alerta por superar el umbral de seguimiento
    const db = await leerDB(page)
    expect(db.alertas.filter((a) => a.adultoId === 'a-camila' && a.tipo === 'seguimiento')).toEqual([])
    expect(db.notificaciones.filter((n) => n.mensaje.includes('Camila Torres') && n.mensaje.startsWith('Seguimiento familiar'))).toEqual([])
    const tarjetas = await alertasDe(page, 'Camila Torres')
    await expect(tarjetas.filter({ hasText: 'Seguimiento familiar' })).toHaveCount(0)
    // (el perfil indica los días transcurridos sin marcarlos como vencidos)
    await page.goto('/coordinador/adultos/a-camila')
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
    const alerta = (await leerDB(page)).alertas.find((a) => a.adultoId === 'a-e2e-nuevo' && a.tipo === 'seguimiento')
    expect(alerta).toMatchObject({ estado: 'pendiente', titulo: '18 días sin visita comunitaria' })
    expect(alerta?.descripcion).toContain('No hay visitas registradas desde la creación del perfil')
    // Y debe mostrarla como pendiente
    const tarjetas = await alertasDe(page, 'Rosa Almonte')
    await expect(tarjetas).toHaveCount(1)
    await expect(tarjetas.first()).toContainText('Seguimiento familiar')
    await expect(tarjetas.first()).toContainText('Pendiente')
  })
})
