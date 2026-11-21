/*
 * e2e-cu12-reportes.spec.ts — Suite E2E-CU12-REPORTES: escenarios Gherkin de CU-12 (SRS §16.7).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reglas de Negocio V2: los reportes (admin y coordinador, `reportes:ver`) solo incluyen los adultos de la cuenta
 * activa (Fundación Esperanza org-1: 7 adultos; Familia Méndez org-fam: 2), así que los esperados se calculan
 * filtrando por `orgId` con leerDB. Cada reporte tiene gráficos Chart.js con su tabla de datos, tabla de detalle y
 * exportación a CSV, PDF, Excel e impresión; el análisis avanzado (comparativo por zona y tendencias) y la
 * exportación a Excel dependen del plan de la cuenta (`reportes_avanzados`: la Fundación tiene «Gestión Comunitaria
 * Avanzada»; la cuenta Familia en prueba no). El familiar y el voluntario no ven reportes (RF-09). Las pruebas omiten
 * el onboarding de un solo uso (se verifica en su propia suite).
 */
import { expect, test, type Page } from '@playwright/test'
import { CUENTA_FAMILIA, CUENTAS, editarDB, haceDiasInstante, haceDiasISO, iniciarSesion, leerDB, limpiarDatos, sesionDirecta, visitaCompletada } from './fixtures'
import type { DB } from '../../src/domain/types'

const SIN_DATOS = 'No existen datos disponibles para este reporte con los filtros seleccionados.'

/** Marca como vista la guía de onboarding de todos los usuarios y roles demo (clave `cuidared:onboarding:<userId>:<rol>`). */
async function omitirOnboarding(page: Page) {
  await page.evaluate(() => {
    const ids = ['u-admin', 'u-coord', 'u-cuid', 'u-vol', 'u-fam', 'u-giselle', 'u-ctorres', 'u-eduardo', 'u-fcoord']
    const roles = ['admin', 'coordinador', 'cuidador', 'voluntario', 'familiar']
    for (const id of ids) for (const rol of roles) localStorage.setItem(`cuidared:onboarding:${id}:${rol}`, new Date().toISOString())
  })
}

/** Adultos de la cuenta del usuario (los que ve en los reportes, activos o no). */
function adultosDe(db: DB, usuarioId: string) {
  const orgId = db.usuarios.find((u) => u.id === usuarioId)!.orgId
  return db.adultos.filter((a) => a.orgId === orgId)
}

/** Elige el tipo de reporte y espera a que se genere. */
async function elegirReporte(page: Page, tipo: string) {
  await page.getByRole('radio', { name: tipo }).click()
  await expect(page.getByRole('radio', { name: tipo })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('#titulo-reporte')).toHaveText(tipo)
}

/** Valor del indicador (KPI) con la etiqueta dada. */
const kpi = (page: Page, etiqueta: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: etiqueta, exact: true }) }).locator('p').first()

/** Tabla de detalle del reporte. */
const tabla = (page: Page) => page.locator('section[aria-labelledby="tabla-reporte"]').getByRole('table')

test.describe('E2E-CU12-REPORTES · Generar reporte estadístico', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page)
  })

  test('Escenario: Generar reporte de adultos mayores registrados', async ({ page }) => {
    // Dado que el usuario está autenticado como Coordinador (de la Fundación Esperanza)
    await iniciarSesion(page, 'coordinador')
    await page.goto('/coordinador/reportes')
    // Cuando selecciona el reporte de adultos mayores registrados
    await elegirReporte(page, 'Adultos mayores registrados')
    // Entonces el sistema debe generar el reporte (solo los adultos de su cuenta: 7 de los 9 del sistema)
    const db = await leerDB(page)
    const total = adultosDe(db, CUENTAS.coordinador.id).length
    expect(total).toBe(7)
    expect(db.adultos.length).toBeGreaterThan(total)
    await expect(kpi(page, 'Adultos registrados')).toHaveText(String(total))
    await expect(tabla(page).locator('tbody tr')).toHaveCount(total)
    await expect(tabla(page).getByRole('row', { name: /Rosa Méndez/ })).toHaveCount(0) // adulta de la cuenta Familia
    await expect(page.getByText(/Datos actualizados:/)).toBeVisible()

    // Y debe mostrar información actualizada de los registros existentes (se registra un perfil más)
    await editarDB(page, (db, creadoEn) => {
      const base = db.adultos.find((a) => a.id === 'a-alicia')!
      db.adultos.push({ ...base, id: 'a-e2e-rep', nombre: 'Teresa', apellido: 'Valdez', cedula: '001-7070707-0', creadoEn, actualizadoEn: creadoEn })
    }, new Date().toISOString())
    await elegirReporte(page, 'Adultos mayores registrados')
    await expect(kpi(page, 'Adultos registrados')).toHaveText(String(total + 1))
    await expect(tabla(page).getByRole('row', { name: /Teresa Valdez/ })).toBeVisible()
  })

  test('Escenario: Generar reporte de visitas realizadas', async ({ page }) => {
    // Dado que existen visitas registradas (las realizadas de los adultos de la cuenta del administrador)
    const db = await leerDB(page)
    const ids = new Set(adultosDe(db, CUENTAS.admin.id).map((a) => a.id))
    const realizadas = (d: DB) => d.visitas.filter((v) => v.estado === 'completada' && [v.adultoId, ...v.detallesAdicionales.map((x) => x.adultoId)].some((id) => ids.has(id))).length
    const completadas = realizadas(db)
    expect(completadas).toBeGreaterThan(0)
    expect(db.visitas.filter((v) => v.estado === 'completada').length).toBeGreaterThan(completadas) // hay visitas de la cuenta Familia que no cuentan
    await sesionDirecta(page, CUENTAS.admin.id, '/admin/reportes')
    // Cuando el usuario selecciona el reporte de visitas
    await elegirReporte(page, 'Visitas realizadas')
    // Entonces el sistema debe generar el reporte
    await expect(kpi(page, 'Visitas realizadas')).toHaveText(String(completadas))
    await expect(page.getByRole('heading', { name: 'Visitas por mes' })).toBeVisible()
    await expect(tabla(page).locator('tbody tr')).toHaveCount(completadas)

    // Y debe mostrar información actualizada de las visitas (se registra una visita nueva)
    await editarDB(
      page,
      (db, v) => {
        db.visitas.push(v)
      },
      visitaCompletada({ id: 'v-e2e-rep', adultoId: 'a-alicia', cuidadorId: 'u-coord', fecha: haceDiasISO(0), instante: haceDiasInstante(0), horaPautada: '09:00', observaciones: 'Visita para el reporte.' }),
    )
    await elegirReporte(page, 'Visitas realizadas')
    await expect(kpi(page, 'Visitas realizadas')).toHaveText(String(completadas + 1))
  })

  test('Escenario: Generar reporte de necesidades frecuentes', async ({ page }) => {
    // Dado que existen necesidades registradas (las de los adultos de la cuenta del coordinador)
    const db = await leerDB(page)
    const ids = new Set(adultosDe(db, CUENTAS.coordinador.id).map((a) => a.id))
    const necesidades = db.necesidades.filter((n) => ids.has(n.adultoId))
    expect(necesidades.length).toBeGreaterThan(0)
    expect(db.necesidades.length).toBeGreaterThan(necesidades.length) // hay necesidades de la cuenta Familia que no cuentan
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/reportes')
    // Cuando el usuario selecciona el reporte de necesidades frecuentes
    await elegirReporte(page, 'Necesidades frecuentes')
    // Entonces el sistema debe generar el reporte
    await expect(kpi(page, 'Necesidades registradas')).toHaveText(String(necesidades.length))
    await expect(page.getByRole('heading', { name: 'Necesidades por categoría' })).toBeVisible()
    // Y debe presentar la información correspondiente a las categorías registradas
    const etiqueta: Record<string, string> = { medicamentos: 'Medicamentos', alimentacion: 'Alimentación', transporte: 'Transporte', compania: 'Compañía', otros: 'Otros apoyos' }
    const porTipo = new Map<string, number>()
    for (const n of necesidades) porTipo.set(n.tipo, (porTipo.get(n.tipo) ?? 0) + 1)
    for (const [tipo, total] of porTipo) {
      const fila = tabla(page).getByRole('row').filter({ has: page.getByRole('cell', { name: etiqueta[tipo], exact: true }) })
      await expect(fila.getByRole('cell').nth(1)).toHaveText(String(total))
    }
    // (filtro opcional por categoría)
    await page.getByRole('combobox', { name: 'Categoría' }).selectOption({ label: 'Medicamentos' })
    await expect(kpi(page, 'Necesidades registradas')).toHaveText(String(porTipo.get('medicamentos') ?? 0))
  })

  test('Escenario: Generar reporte de casos prioritarios', async ({ page }) => {
    // Dado que existen casos clasificados como prioritarios (alertas de urgencia Alta: caso prioritario o emergencia)
    // en la cuenta del coordinador (el motor de reglas ya evaluó al montar la app en limpiarDatos)
    const db = await leerDB(page)
    const ids = new Set(adultosDe(db, CUENTAS.coordinador.id).map((a) => a.id))
    const casos = new Set(db.alertas.filter((a) => (a.tipo === 'prioritaria' || a.tipo === 'emergencia') && ids.has(a.adultoId)).map((a) => a.adultoId))
    expect(casos.size).toBeGreaterThan(0)
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/reportes')
    // Cuando el usuario selecciona el reporte de casos prioritarios
    await elegirReporte(page, 'Casos prioritarios')
    // Entonces el sistema debe generar el reporte
    await expect(kpi(page, 'Casos prioritarios')).toHaveText(String(casos.size))
    // Y debe mostrar información actualizada de dichos casos
    await expect(tabla(page).locator('tbody tr')).toHaveCount(casos.size)
    for (const id of casos) {
      const a = db.adultos.find((x) => x.id === id)!
      await expect(tabla(page).getByRole('row', { name: new RegExp(`${a.nombre} ${a.apellido}`) })).toBeVisible()
    }
  })

  test('Escenario: Consultar un reporte sin datos', async ({ page }) => {
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/reportes')
    await elegirReporte(page, 'Visitas realizadas')
    // Dado que no existen registros para el tipo de reporte seleccionado (período sin actividad)
    await page.getByRole('combobox', { name: 'Período' }).selectOption({ label: 'Personalizado (desde / hasta)' })
    await page.getByLabel('Desde').fill('2001-01-01')
    await page.getByLabel('Hasta').fill('2001-01-31')
    // Cuando el usuario solicita el reporte
    // Entonces el sistema debe mostrar que no existen datos disponibles
    await expect(page.getByRole('status').filter({ hasText: SIN_DATOS })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled()
    await expect(page.getByRole('table')).toHaveCount(0)
  })

  /* ───────────── Reglas de Negocio V2: permisos y plan de la cuenta ───────────── */

  for (const rol of ['familiar', 'voluntario'] as const) {
    test(`Escenario: El ${rol} no puede acceder a los reportes (Acceso no autorizado)`, async ({ page }) => {
      // Dado que el usuario está autenticado como ${rol} (sin el permiso reportes:ver)
      await sesionDirecta(page, CUENTAS[rol].id)
      await expect(page.getByTestId('usuario-actual')).toContainText(CUENTAS[rol].etiqueta)
      await expect(page.getByRole('link', { name: /Reportes/ })).toHaveCount(0) // su área no ofrece reportes

      // Cuando intenta abrir los reportes por URL (del coordinador o del administrador)
      for (const ruta of ['/coordinador/reportes', '/admin/reportes']) {
        await page.goto(ruta)
        // Entonces el sistema debe impedir el acceso
        await expect(page.getByTestId('acceso-denegado')).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Acceso no autorizado' })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Reportes y estadísticas' })).toHaveCount(0)
        await expect(page.getByRole('radio', { name: 'Adultos mayores registrados' })).toHaveCount(0)
      }

      // Y el intento queda registrado en la auditoría
      await expect
        .poll(async () => (await leerDB(page)).auditoria.some((e) => e.accion === 'acceso.denegado' && e.usuarioId === CUENTAS[rol].id && (e.detalle ?? '').includes('/coordinador/reportes')))
        .toBe(true)
    })
  }

  test('Escenario: En la cuenta Familia (prueba gratuita) el análisis avanzado muestra el aviso de plan', async ({ page }) => {
    // Dado que la cuenta Familia Méndez está en prueba gratuita y su plan no incluye `reportes_avanzados`
    const db = await leerDB(page)
    const plan = db.catalogos.planes.find((p) => p.id === 'plan-gestion-avanzada')!
    expect(plan.funcionalidades).toContain('reportes_avanzados')
    // Cuando su coordinadora abre los reportes
    await sesionDirecta(page, CUENTA_FAMILIA.id, '/coordinador/reportes')
    await expect(page.getByRole('heading', { name: 'Reportes y estadísticas' })).toBeVisible()
    await expect(page.getByTestId('banner-prueba')).toBeVisible()
    // (el reporte básico sí se genera, con los 2 adultos de su cuenta)
    await expect(kpi(page, 'Adultos registrados')).toHaveText('2')

    // Entonces el análisis avanzado no se dibuja y explica qué plan lo incluye
    const avanzado = page.getByTestId('analisis-avanzado')
    await expect(avanzado.getByRole('heading', { name: 'Análisis avanzado' })).toBeVisible()
    const bloqueado = avanzado.getByTestId('analisis-avanzado-bloqueado')
    await expect(bloqueado).toBeVisible()
    await expect(bloqueado).toContainText('Comparativo por zona y tendencias no incluidos en tu plan')
    await expect(bloqueado.getByTestId('aviso-plan')).toContainText(`Disponible en el plan ${plan.nombre}`)
    await expect(bloqueado.getByTestId('aviso-plan')).toContainText('Tu cuenta está en prueba gratuita')
    await expect(avanzado.getByTestId('grafico-reporte')).toHaveCount(0)
    await expect(avanzado.getByRole('table')).toHaveCount(0)

    // Y la exportación a Excel queda deshabilitada con su propio aviso, mientras CSV, PDF e imprimir siguen disponibles
    await expect(page.getByRole('button', { name: 'Exportar Excel' })).toBeDisabled()
    await expect(page.locator('#aviso-plan-excel')).toContainText(`Disponible en el plan ${plan.nombre}`)
    for (const nombre of ['Exportar CSV', 'Exportar PDF', 'Imprimir']) await expect(page.getByRole('button', { name: nombre })).toBeEnabled()
  })

  test('Escenario: En la Fundación Esperanza (plan avanzado) se muestra el análisis avanzado y se puede exportar a Excel', async ({ page }) => {
    // Dado que la Fundación Esperanza tiene el plan Gestión Comunitaria Avanzada
    // Cuando el coordinador abre los reportes
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/reportes')
    await expect(page.getByRole('heading', { name: 'Reportes y estadísticas' })).toBeVisible()

    // Entonces ve el comparativo por zona y las tendencias, sin avisos de plan
    const avanzado = page.getByTestId('analisis-avanzado')
    await expect(avanzado.getByRole('heading', { name: 'Comparativo por zona', exact: true })).toBeVisible()
    await expect(avanzado.getByRole('heading', { name: 'Tendencias mensuales', exact: true }).first()).toBeVisible()
    await expect(avanzado.getByRole('heading', { name: 'Comparativo por zona (sector)' })).toBeVisible()
    await expect(page.getByTestId('analisis-avanzado-bloqueado')).toHaveCount(0)
    await expect(page.getByTestId('aviso-plan')).toHaveCount(0)
    // Y puede exportar a Excel
    await expect(page.getByRole('button', { name: 'Exportar Excel' })).toBeEnabled()
  })
})
