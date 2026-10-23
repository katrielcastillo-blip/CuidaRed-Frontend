/*
 * e2e-cu09-alerta-prior.spec.ts — Suite E2E-CU09-ALERTA-PRIOR: escenarios Gherkin de CU-09 (SRS §16.4).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * "Cuando el sistema evalúa las condiciones de prioridad": se prepara el estado en el servidor simulado y se
 * recarga la app, que ejecuta el motor de reglas al arrancar (evaluación continua, RF-04).
 * Modelo V3.0: el nivel de riesgo vigente se registra en Env_Riesgo (`riesgos`) y se copia en Adulto.riesgo
 * (el más alto de los vigentes); la urgencia de la alerta usa el catálogo Prioridad ("Prioridad Alta").
 */
import { expect, test, type Page } from '@playwright/test'
import { CUENTAS, editarDB, leerDB, limpiarDatos, necesidadPendiente, sesionDirecta } from './fixtures'

/** Bandeja de alertas del coordinador filtrada por el nombre del adulto. */
async function alertasDe(page: Page, nombre: string) {
  await page.goto('/coordinador/alertas')
  await page.getByRole('searchbox', { name: 'Buscar alertas' }).fill(nombre)
  return page.getByRole('list', { name: 'Alertas' }).getByRole('link').filter({ hasText: nombre })
}

test.describe('E2E-CU09-ALERTA-PRIOR · Generar alerta de caso prioritario', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Generar alerta por riesgo alto', async ({ page }) => {
    // Dado que existe un perfil de adulto mayor activo (Camila Torres, riesgo bajo, sin alertas abiertas)
    expect((await leerDB(page)).alertas.some((a) => a.adultoId === 'a-camila' && a.tipo === 'prioritaria')).toBe(false)
    // Y el perfil está clasificado con nivel de riesgo "Alto" (nuevo registro vigente en Env_Riesgo)
    // Cuando el sistema evalúa las condiciones de prioridad
    await editarDB(
      page,
      (db, fecha) => {
        for (const r of db.riesgos) if (r.adultoId === 'a-camila' && r.riesgoId === 'r-social') r.estado = 'superado'
        db.riesgos.push({ id: 'er-e2e-alto', adultoId: 'a-camila', riesgoId: 'r-social', fecha, nivel: 'alto', estado: 'vigente', motivo: 'Quedó sin apoyo familiar.', registradoPor: 'u-coord' })
        db.adultos.find((a) => a.id === 'a-camila')!.riesgo = 'alto' // [desnormalizado] nivel vigente más alto
      },
      new Date().toISOString(),
    )
    await sesionDirecta(page, CUENTAS.coordinador.id)

    // Entonces debe generar una alerta de urgencia "Alta"
    const alerta = (await leerDB(page)).alertas.find((a) => a.adultoId === 'a-camila' && a.tipo === 'prioritaria')
    expect(alerta).toMatchObject({ severidad: 'alta', estado: 'pendiente', generadaPor: 'sistema' })
    expect(alerta?.condiciones).toContain('Nivel de riesgo social "Alto"')

    // Y la alerta debe quedar disponible para los usuarios autorizados (urgencia visible)
    const tarjetas = await alertasDe(page, 'Camila Torres')
    await expect(tarjetas).toHaveCount(1)
    await expect(tarjetas.first()).toContainText('Caso prioritario')
    await expect(tarjetas.first()).toContainText('Prioridad Alta')
    await tarjetas.first().click()
    await expect(page.getByRole('heading', { name: 'Camila Torres' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: /^Nivel de riesgo social "Alto"$/ })).toBeVisible()
  })

  test('Escenario: Generar alerta por necesidad de medicamentos', async ({ page }) => {
    // Dado que existe un adulto mayor con perfil activo (Alicia Castillo, riesgo bajo)
    // Y tiene una necesidad pendiente de categoría "Medicamentos"
    // Cuando el sistema evalúa las condiciones de prioridad
    await editarDB(
      page,
      (db, n) => {
        db.necesidades.push(n)
      },
      necesidadPendiente({ id: 'n-e2e-med', adultoId: 'a-alicia', catalogoId: 'nc-medicamento', registradaPor: 'u-coord', tipo: 'medicamentos', descripcion: 'Reposición de metformina.' }),
    )
    await sesionDirecta(page, CUENTAS.coordinador.id)

    // Entonces debe generar una alerta de urgencia "Alta"
    const alerta = (await leerDB(page)).alertas.find((a) => a.adultoId === 'a-alicia' && a.tipo === 'prioritaria')
    // Y debe asociarla al adulto mayor correspondiente
    expect(alerta).toMatchObject({ adultoId: 'a-alicia', severidad: 'alta', estado: 'pendiente', condiciones: ['Necesidad de medicamentos pendiente'] })
    const tarjetas = (await alertasDe(page, 'Alicia Castillo')).filter({ hasText: 'Caso prioritario' })
    await expect(tarjetas).toHaveCount(1)
    await expect(tarjetas.first()).toContainText('Prioridad Alta')
    await expect(tarjetas.first()).toContainText('Necesidad de medicamentos pendiente')
  })

  test('Escenario: No generar alerta de urgencia alta cuando no se cumple ninguna condición', async ({ page }) => {
    // Dado que el adulto mayor no tiene riesgo "Alto" (Camila Torres: riesgo bajo)
    // Y no posee una necesidad pendiente de categoría "Medicamentos" (su necesidad de medicamentos está satisfecha)
    const db = await leerDB(page)
    const camila = db.adultos.find((a) => a.id === 'a-camila')!
    expect(camila.riesgo).not.toBe('alto')
    expect(db.riesgos.filter((r) => r.adultoId === 'a-camila' && r.estado === 'vigente' && r.nivel === 'alto')).toEqual([])
    expect(db.necesidades.some((n) => n.adultoId === 'a-camila' && n.tipo === 'medicamentos' && n.estado === 'pendiente')).toBe(false)

    // Cuando el sistema evalúa las condiciones de prioridad
    await sesionDirecta(page, CUENTAS.coordinador.id)

    // Entonces no debe generar una alerta de urgencia "Alta"
    const despues = await leerDB(page)
    expect(despues.alertas.filter((a) => a.adultoId === 'a-camila' && a.severidad === 'alta')).toEqual([])
    const tarjetas = await alertasDe(page, 'Camila Torres')
    await expect(tarjetas).toHaveCount(0)
    await expect(page.getByText('Sin alertas', { exact: true })).toBeVisible()
  })
})
