/*
 * e2e-cu06-hist-visitas.spec.ts — Suite E2E-CU06-HIST-VISITAS: escenarios de CU-06 Consultar historial de visitas
 * (RF-02 · Anexo B: el SRS no detalla Gherkin; se derivan de la postcondición de CU-05 "la visita queda reflejada
 * en el historial del perfil correspondiente").
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reglas de Negocio V2: en el perfil del adulto (coordinador, administrador y cuidador) el historial es una línea de
 * tiempo consolidada (región «Historial consolidado») con filtros por tipo y período y «Ver más»; el cuidador además tiene
 * «Mis visitas» (Hoy · Próximas · Historial) con las visitas de la cuenta activa; el voluntario solo ve «Registradas»
 * con su propia observación (sin detalle, estado del adulto ni datos médicos); el familiar consulta la pestaña «Visitas».
 * Las pruebas omiten el onboarding de un solo uso (se verifica en la suite de CU-01).
 */
import { expect, test, type Page } from '@playwright/test'
import { CUENTA_FAMILIA, CUENTAS, editarDB, haceDiasISO, haceDiasInstante, leerDB, limpiarDatos, sesionDirecta, visitaCompletada } from './fixtures'

/** Marca como vista la guía de onboarding de los usuarios demo (clave `cuidared:onboarding:<userId>:<rol>`). */
async function omitirOnboarding(page: Page) {
  const claves = [...Object.entries(CUENTAS).map(([rol, c]) => `${c.id}:${rol}`), `${CUENTA_FAMILIA.id}:coordinador`].map((k) => `cuidared:onboarding:${k}`)
  await page.evaluate((ks) => ks.forEach((k) => localStorage.setItem(k, new Date().toISOString())), claves)
}

/** Instante en que se cerró la visita (el historial ordena por él). */
const instanteVisita = (v: { fin?: string; inicio?: string; fecha: string; horaPautada: string }) => v.fin ?? v.inicio ?? `${v.fecha}T${v.horaPautada}`

test.describe('E2E-CU06-HIST-VISITAS · Consultar historial de visitas', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page)
  })

  test('Escenario: Consultar el historial de visitas de un adulto mayor', async ({ page }) => {
    // Visitas de Elena (principal o adulto adicional del hogar) que el historial muestra: realizadas y canceladas
    const db = await leerDB(page)
    const visitas = db.visitas.filter(
      (v) => (v.adultoId === 'a-elena' || v.detallesAdicionales.some((d) => d.adultoId === 'a-elena')) && (v.estado === 'completada' || v.estado === 'cancelada'),
    )
    expect(visitas.length).toBeGreaterThan(5)
    const masReciente = [...visitas].sort((a, b) => instanteVisita(b).localeCompare(instanteVisita(a)))[0]!
    // Dado que el usuario está autenticado como Coordinador y abre el perfil de Elena Rodríguez
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/adultos/a-elena')
    const historial = page.getByRole('region', { name: 'Historial consolidado' })
    await expect(historial).toBeVisible()
    // Cuando filtra la línea de tiempo por «Visitas»
    await historial.getByRole('combobox', { name: 'Tipo' }).selectOption({ label: `Visitas (${visitas.length})` })
    // Entonces el sistema muestra todas sus visitas, de la más reciente a la más antigua
    const mostrando = historial.getByText(new RegExp(`Mostrando \\d+ de ${visitas.length} eventos`))
    await expect(mostrando).toBeVisible()
    // (diez a la vez: «Ver más» muestra el resto)
    while (await historial.getByRole('button', { name: /^Ver más/ }).isVisible()) await historial.getByRole('button', { name: /^Ver más/ }).click()
    await expect(historial.getByText(`Mostrando ${visitas.length} de ${visitas.length} eventos`)).toBeVisible()
    const items = historial.getByRole('list', { name: 'Línea de tiempo del adulto mayor' }).getByRole('listitem')
    await expect(items).toHaveCount(visitas.length)
    const [d, m, y] = [masReciente.fecha.slice(8, 10), masReciente.fecha.slice(5, 7), masReciente.fecha.slice(0, 4)]
    await expect(items.first()).toContainText(`${d}/${m}/${y}`)
    await expect(items.first()).toContainText('Realizada')
    // Y puede abrir el detalle de una visita
    await items.first().getByRole('link', { name: /Ver detalle/ }).click()
    await expect(page).toHaveURL(new RegExp(`/coordinador/visitas/${masReciente.id}$`))
    await expect(page.getByRole('heading', { name: masReciente.tipo })).toBeVisible()
  })

  test('Escenario: El cuidador consulta el historial de sus visitas realizadas', async ({ page }) => {
    const db = await leerDB(page)
    const hoy = haceDiasISO(0)
    // Solo cuentan los adultos que Carlos tiene asignados en la cuenta activa (Fundación Esperanza), no los de Familia Méndez
    const adultosOrg = db.adultos.filter((a) => a.orgId === 'org-1' && db.vinculos.some((v) => v.adultoId === a.id && v.usuarioId === CUENTAS.cuidador.id && v.tipoVinculoId === 'cuidador_asignado')).map((a) => a.id)
    expect(adultosOrg.sort()).toEqual(['a-camila', 'a-elena', 'a-jose'])
    const historial = db.visitas.filter((v) => v.cuidadorId === CUENTAS.cuidador.id && adultosOrg.includes(v.adultoId) && v.fecha < hoy)
    expect(historial.length).toBeGreaterThan(0)
    // (la visita de Familia Méndez de hace dos días es suya pero de otra cuenta)
    expect(db.visitas.find((v) => v.id === 'v-11')).toMatchObject({ cuidadorId: CUENTAS.cuidador.id, adultoId: 'a-ramon', estado: 'completada' })
    // Dado que el usuario está autenticado como Cuidador
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas')
    // Cuando selecciona la pestaña "Historial" de sus visitas
    await page.getByRole('tab', { name: 'Historial' }).click()
    // Entonces ve las visitas que realizó en esta cuenta, con su estado
    const tarjetas = page.getByRole('tabpanel').getByRole('link').filter({ hasText: 'Ver más' })
    await expect(tarjetas).toHaveCount(historial.length)
    await expect(tarjetas.first()).toContainText('COMPLETADA')
    await expect(tarjetas.filter({ hasText: 'Ramón Méndez' })).toHaveCount(0)
    // Y puede abrir el detalle con las observaciones registradas (la más reciente a Elena es v-1, de ayer)
    const v1 = db.visitas.find((v) => v.id === 'v-1')!
    await tarjetas.filter({ hasText: 'Elena Rodríguez' }).first().click()
    await expect(page).toHaveURL(/\/cuidador\/visitas\/v-1$/)
    await expect(page.getByRole('heading', { name: 'Detalle de visita' })).toBeVisible()
    await expect(page.getByText(v1.observaciones!)).toBeVisible()
    await expect(page.getByText('Estado del adulto', { exact: true })).toBeVisible()
  })

  test('Escenario: El cuidador solo ve las visitas de la cuenta activa al cambiar de cuenta', async ({ page }) => {
    // Dado que Carlos Ruiz también es cuidador de la cuenta Familia Méndez (visita v-11 a Ramón, hace dos días)
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas')
    await page.getByRole('tab', { name: 'Historial' }).click()
    await expect(page.getByRole('tabpanel').getByRole('link').filter({ hasText: 'Ramón Méndez' })).toHaveCount(0)
    // Cuando cambia a la cuenta Familia Méndez desde el selector de cuenta
    await page.getByTestId('usuario-actual').click()
    await page.getByTestId('lista-cuentas').getByRole('button', { name: /Familia Méndez/ }).click()
    await expect(page).toHaveURL(/\/cuidador$/)
    await page.goto('/cuidador/visitas')
    await page.getByRole('tab', { name: 'Historial' }).click()
    // Entonces solo ve las visitas de esa cuenta y ninguna de la Fundación
    const tarjetas = page.getByRole('tabpanel').getByRole('link').filter({ hasText: 'Ver más' })
    await expect(tarjetas).toHaveCount(1)
    await expect(tarjetas.first()).toContainText('Ramón Méndez')
    await expect(page.getByRole('link').filter({ hasText: /Elena Rodríguez|José Santana|Camila Torres/ })).toHaveCount(0)
  })

  test('Escenario: El voluntario consulta el historial de sus visitas registradas (solo su observación)', async ({ page }) => {
    const db = await leerDB(page)
    const registradas = db.visitas.filter((v) => v.cuidadorId === CUENTAS.voluntario.id && v.estado === 'completada')
    expect(registradas.length).toBeGreaterThan(0)
    const v10 = db.visitas.find((v) => v.id === 'v-10')!
    // Dado que el usuario está autenticado como Voluntario
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas')
    // Cuando selecciona la pestaña "Registradas" de sus visitas
    await page.getByRole('tab', { name: `Registradas (${registradas.length})` }).click()
    // Entonces ve las visitas que registró, con el adulto y la observación que dejó
    const tarjetas = page.getByRole('tabpanel').getByRole('heading', { level: 3 })
    await expect(tarjetas).toHaveCount(registradas.length)
    await expect(page.getByRole('tabpanel')).toContainText('José Martínez')
    await expect(page.getByText(v10.observaciones!)).toBeVisible()
    // Y no tiene acceso al detalle clínico: sin estado del adulto, aspectos verificados ni enlaces al detalle
    await expect(page.getByRole('tabpanel').getByRole('link')).toHaveCount(0)
    await expect(page.getByText(/Estado del adulto|Aspectos verificados/)).toHaveCount(0)
    await page.goto('/voluntario/visitas/v-10')
    await expect(page.getByTestId('no-encontrada')).toBeVisible()
    await expect(page.getByText(v10.observaciones!)).toHaveCount(0)
  })

  test('Escenario: El voluntario no ve la observación de una visita que otra persona registró a su nombre', async ({ page }) => {
    // Dado que el coordinador registró una visita de Alicia a nombre de Miguel, con información de salud en la observación
    await editarDB(
      page,
      (db, v) => {
        db.visitas.push(v)
      },
      visitaCompletada({
        id: 'v-e2e-otro',
        adultoId: 'a-alicia',
        cuidadorId: 'u-vol',
        fecha: haceDiasISO(2),
        instante: haceDiasInstante(2),
        creadaPor: 'u-coord',
        actualizadoPor: 'u-coord',
        observaciones: 'Presión alta (150/95); se ajustó el tratamiento con el médico.',
      }),
    )
    // Cuando el voluntario abre sus visitas registradas
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas')
    await page.getByRole('tab', { name: /^Registradas/ }).click()
    // Entonces ve que la registró otra persona del equipo, sin su contenido
    await expect(page.getByText('Esta visita la registró otra persona del equipo.')).toBeVisible()
    await expect(page.getByText('Presión alta')).toHaveCount(0)
  })

  test('Escenario: El familiar responsable consulta las visitas del adulto a su cargo', async ({ page }) => {
    const visitas = (await leerDB(page)).visitas.filter((v) => v.adultoId === 'a-elena' && v.estado !== 'cancelada')
    // Dado que el usuario está autenticado como Familiar responsable de Elena Rodríguez
    await sesionDirecta(page, CUENTAS.familiar.id, '/familiar/adultos/a-elena')
    // Cuando consulta la pestaña de visitas
    await page.getByRole('tab', { name: 'Visitas' }).click()
    // Entonces ve el historial de visitas registradas
    const panel = page.getByRole('tabpanel', { name: 'Historial de visitas' })
    await expect(panel.getByRole('link')).toHaveCount(visitas.length)
    // Y puede abrir el detalle de una visita (solo lectura)
    await panel.getByRole('link').first().click()
    await expect(page).toHaveURL(/\/familiar\/visitas\//)
    await expect(page.getByRole('button', { name: /Guardar|Registrar/ })).toHaveCount(0)
  })
})
