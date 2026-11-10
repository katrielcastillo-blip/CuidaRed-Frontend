/*
 * e2e-cu04-perfil-view.spec.ts — Suite E2E-CU04-PERFIL-VIEW: escenarios de CU-04 Consultar perfil de adulto mayor
 * (RF-01 · RF-09 · Anexo B: el SRS no detalla Gherkin; se derivan del criterio de aceptación y del alcance por rol).
 * Reglas de Negocio V2: el alcance combina el rol y el vínculo con el adulto dentro de la cuenta activa (el cuidador
 * ve a sus asignados, el voluntario solo una ficha mínima en «Registrar visita» y el familiar, a los autorizados).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page } from '@playwright/test'
import { adultosVinculados, CUENTA_FAMILIA, CUENTAS, leerDB, limpiarDatos, sesionDirecta } from './fixtures'


/**
 * Reglas de Negocio V2: la primera vez que una persona entra con un rol, la app muestra una guía de bienvenida
 * (diálogo de un solo uso, clave `cuidared:onboarding:<userId>:<rol>`). Estas pruebas no la verifican, así que se
 * marca como vista (para los usuarios demo) antes de entrar.
 */
async function omitirOnboarding(page: Page) {
  const claves = [...Object.entries(CUENTAS).map(([rol, c]) => `${c.id}:${rol}`), `${CUENTA_FAMILIA.id}:coordinador`].map((k) => `cuidared:onboarding:${k}`)
  await page.evaluate((ks) => ks.forEach((k) => localStorage.setItem(k, new Date().toISOString())), claves)
}

test.describe('E2E-CU04-PERFIL-VIEW · Consultar perfil de adulto mayor', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page)
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
    // Y los cuidadores asignados (V2: vínculos "Cuidador asignado"), los familiares autorizados y su historial
    const db = await leerDB(page)
    const vinculos = page.getByRole('region', { name: 'Vínculos' })
    const cuidadores = vinculos.getByTestId('vinculos-cuidador_asignado')
    const asignados = db.vinculos.filter((v) => v.adultoId === 'a-elena' && v.tipoVinculoId === 'cuidador_asignado')
    await expect(cuidadores.getByRole('listitem')).toHaveCount(asignados.length)
    await expect(cuidadores).toContainText('Carlos Ruiz')
    await expect(cuidadores).toContainText('Giselle Mejía')
    await expect(vinculos.getByTestId('vinculos-familiar_responsable')).toContainText('Clara Rodríguez')
    // (Elena no tiene voluntarios asignados)
    await expect(vinculos.getByTestId('vinculos-voluntario_asignado')).toContainText('Aún no tiene voluntarios asignados.')
    await expect(page.getByRole('region', { name: 'Historial consolidado' })).toBeVisible()
  })

  test('Escenario: El cuidador solo consulta los adultos mayores que tiene asignados en la cuenta activa', async ({ page }) => {
    const db = await leerDB(page)
    // Carlos Ruiz es cuidador en dos cuentas: en Fundación Esperanza atiende a 3 adultos y en Familia Méndez, a 2
    const enOrg = (orgId: string) => adultosVinculados(db, CUENTAS.cuidador.id, 'cuidador_asignado').filter((a) => a.orgId === orgId).map((a) => a.id).sort()
    expect(enOrg('org-1')).toEqual(['a-camila', 'a-elena', 'a-jose'])
    expect(enOrg('org-fam')).toEqual(['a-ramon', 'a-rosa'])
    // Dado que el usuario está autenticado como Cuidador (cuenta Fundación Esperanza)
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/adultos')
    // Cuando consulta la lista de adultos mayores
    // Entonces solo ve los adultos de esa cuenta que tiene asignados
    await expect(page.getByText('3 adultos asignados')).toBeVisible()
    for (const a of db.adultos) {
      const tarjeta = page.getByRole('link', { name: new RegExp(`^${a.nombre} ${a.apellido}, riesgo`) })
      await expect(tarjeta).toHaveCount(enOrg('org-1').includes(a.id) ? 1 : 0)
    }
    // Y puede abrir el perfil de uno asignado, con sus acciones de trabajo de campo
    await page.getByRole('link', { name: /^Camila Torres, riesgo/ }).click()
    await expect(page).toHaveURL(/\/cuidador\/adultos\/a-camila$/)
    await expect(page.getByRole('heading', { name: 'Camila Torres' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Registrar visita' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Agregar necesidad' })).toBeVisible()
    // Y el perfil de un adulto no asignado, o de la otra cuenta, no se muestra
    for (const id of ['a-alicia', 'a-rosa']) {
      await page.goto(`/cuidador/adultos/${id}`)
      await expect(page.getByText('No encontrado o sin permiso')).toBeVisible()
    }
    await expect(page.getByRole('heading', { name: 'Alicia Castillo' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Rosa Méndez' })).toHaveCount(0)
  })

  test('Escenario: El voluntario solo ve a los adultos mayores que tiene asignados (vista mínima)', async ({ page }) => {
    const db = await leerDB(page)
    const asignados = adultosVinculados(db, CUENTAS.voluntario.id, 'voluntario_asignado')
    expect(asignados.map((a) => a.id).sort()).toEqual(['a-alicia', 'a-josem'])
    // Dado que el usuario está autenticado como Voluntario
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva')
    // Cuando elige a quién visitó
    const lista = page.getByRole('combobox', { name: /^Adulto mayor visitado/ })
    // Entonces solo puede elegir a los adultos que tiene asignados
    await expect(lista.locator('option:not([value=""])')).toHaveText(['Alicia Castillo', 'José Martínez'])
    // Y de la persona elegida solo se muestra cómo llegar y su contacto: ni riesgo, ni condición, ni necesidades
    await lista.selectOption({ label: 'Alicia Castillo' })
    await expect(page.getByText('Calle Santiago #210')).toBeVisible()
    await expect(page.getByRole('link', { name: /Llamar a Katriel Castillo/ })).toBeVisible()
    for (const sensible of [/Riesgo/, /Condición general/, /Necesidades/, /Indicaciones/]) await expect(page.getByText(sensible)).toHaveCount(0)
    // Y no existe un perfil del adulto para su rol: la ruta no existe en su área
    await page.goto('/voluntario/adultos/a-alicia')
    await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Alicia Castillo' })).toHaveCount(0)
    // Y un adulto que no tiene asignado no se puede visitar ni consultar
    await page.goto('/voluntario/visitas/nueva?adulto=a-camila')
    await expect(page.getByText('No encontrado o sin permiso')).toBeVisible()
    // Y las pantallas de perfiles de los otros roles le quedan vedadas
    for (const ruta of ['/cuidador/adultos/a-alicia', '/coordinador/adultos/a-alicia']) {
      await page.goto(ruta)
      await expect(page.getByTestId('acceso-denegado')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Alicia Castillo' })).toHaveCount(0)
    }
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
    // Y tampoco a los de la otra cuenta en la que participa (Familia Méndez) mientras actúa en la Fundación
    await page.goto('/familiar/adultos/a-rosa')
    await expect(page.getByText('No encontrado o sin permiso')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Rosa Méndez' })).toHaveCount(0)
  })
})
