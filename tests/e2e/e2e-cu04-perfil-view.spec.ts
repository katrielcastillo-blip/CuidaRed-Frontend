/*
 * e2e-cu04-perfil-view.spec.ts — Suite E2E-CU04-PERFIL-VIEW: escenarios de CU-04 Consultar perfil de adulto mayor
 * (RF-01 · RF-09 · Anexo B: el SRS no detalla Gherkin; se derivan del criterio de aceptación y del alcance por rol).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { adultosVinculados, CUENTAS, leerDB, limpiarDatos, sesionDirecta } from './fixtures'

test.describe('E2E-CU04-PERFIL-VIEW · Consultar perfil de adulto mayor', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Consultar el perfil completo de un adulto mayor', async ({ page }) => {
    // Dado que el usuario está autenticado como Coordinador
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/adultos')
    // Cuando busca a Elena Rodríguez en el listado y abre su perfil
    await page.getByRole('searchbox', { name: 'Buscar adultos' }).fill('Elena')
    await expect(page.getByRole('list', { name: 'Adultos mayores' }).getByRole('listitem')).toHaveCount(1)
    await page.getByRole('link', { name: /Elena Rodríguez/ }).click()

    // Entonces el sistema muestra su identificación, nivel de riesgo y condición general
    await expect(page).toHaveURL(/\/coordinador\/adultos\/a-elena$/)
    const resumen = page.getByRole('region', { name: 'Resumen del adulto mayor' })
    await expect(resumen.getByRole('heading', { name: 'Elena Rodríguez' })).toBeVisible()
    await expect(resumen).toContainText('001-0012154-2')
    await expect(resumen).toContainText('Riesgo MEDIO')
    const info = page.getByRole('region', { name: 'Identificación y ubicación' })
    await expect(info).toContainText('Santo Domingo de Guzmán')
    await expect(info).toContainText('Renacimiento')
    // (contactos de emergencia: el principal destacado)
    const contactos = page.getByRole('region', { name: 'Contactos de emergencia' })
    const principal = contactos.getByRole('listitem').filter({ has: page.getByText('Principal', { exact: true }) })
    await expect(principal).toHaveCount(1)
    await expect(principal).toContainText('Clara Rodríguez')
    await expect(principal).toContainText('Hijo/a')
    await expect(principal).toContainText('849 787 0348')
    const condicion = page.getByRole('region', { name: 'Condición general' })
    await expect(condicion).toContainText('Necesita ayuda parcial')
    await expect(condicion).toContainText('Enfermedad crónica')
    await expect(condicion).toContainText('Vive solo/a')
    // Y los voluntarios asignados (vínculos "Voluntario asignado") y su historial
    const db = await leerDB(page)
    const vinculos = page.getByRole('region', { name: 'Vínculos' })
    const voluntarios = vinculos.getByTestId('vinculos-voluntario_asignado')
    const asignados = db.vinculos.filter((v) => v.adultoId === 'a-elena' && v.tipoVinculoId === 'voluntario_asignado')
    await expect(voluntarios.getByRole('listitem')).toHaveCount(asignados.length)
    await expect(voluntarios).toContainText('Carlos Ruiz')
    await expect(voluntarios).toContainText('Giselle Mejía')
    await expect(vinculos.getByTestId('vinculos-familiar_responsable')).toContainText('Clara Rodríguez')
    await expect(page.getByRole('region', { name: 'Historial del adulto mayor' })).toBeVisible()
  })

  test('Escenario: El voluntario solo consulta los adultos mayores que tiene asignados', async ({ page }) => {
    const db = await leerDB(page)
    const asignados = adultosVinculados(db, CUENTAS.voluntario.id, 'voluntario_asignado')
    expect(asignados.map((a) => a.id).sort()).toEqual(['a-camila', 'a-elena', 'a-jose'])
    // Dado que el usuario está autenticado como Voluntario
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/adultos')
    // Cuando consulta la lista de adultos mayores
    // Entonces solo ve los adultos que tiene asignados
    for (const a of db.adultos) {
      const tarjeta = page.getByRole('link', { name: new RegExp(`${a.nombre} ${a.apellido}`) })
      await expect(tarjeta).toHaveCount(asignados.some((x) => x.id === a.id) ? 1 : 0)
    }
    // Y puede abrir el perfil de uno asignado
    await page.getByRole('link', { name: /Camila Torres/ }).click()
    await expect(page.getByRole('heading', { name: 'Camila Torres' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Registrar visita' })).toBeVisible()
    // Y el perfil de un adulto no asignado no se muestra
    await page.goto('/voluntario/adultos/a-alicia')
    await expect(page.getByText('No encontrado o sin permiso')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Alicia Castillo' })).toHaveCount(0)
  })

  test('Escenario: El familiar responsable consulta el perfil en modo de solo lectura', async ({ page }) => {
    // Dado que el usuario está autenticado como Familiar responsable de Elena Rodríguez
    await sesionDirecta(page, CUENTAS.familiar.id)
    // Cuando abre el perfil del adulto mayor a su cargo
    await page.getByRole('link', { name: /Elena Rodríguez/ }).click()
    await expect(page).toHaveURL(/\/familiar\/adultos\/a-elena$/)
    // Entonces ve sus datos y su seguimiento
    await expect(page.getByRole('heading', { name: 'Elena Rodríguez' })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Necesidades/ })).toBeVisible()
    // Y no tiene acciones de modificación
    for (const accion of ['Editar perfil', 'Registrar visita', 'Agregar necesidad', 'Evaluación de riesgo']) {
      await expect(page.getByRole('link', { name: accion })).toHaveCount(0)
    }
    // Y no puede consultar a adultos con los que no tiene vínculo de familiar responsable
    await page.goto('/familiar/adultos/a-jose')
    await expect(page.getByText('No encontrado o sin permiso')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'José Santana' })).toHaveCount(0)
  })
})
