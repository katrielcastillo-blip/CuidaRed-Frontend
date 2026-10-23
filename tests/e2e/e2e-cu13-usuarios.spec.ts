/*
 * e2e-cu13-usuarios.spec.ts — Suite E2E-CU13-USUARIOS: escenarios Gherkin de CU-13 (SRS §16.8).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { adultosVinculados, cerrarSesion, CUENTAS, enviarCredenciales, iniciarSesion, leerDB, limpiarDatos, sesionDirecta } from './fixtures'

const NO_AUTORIZADO = 'Acceso no autorizado'

test.describe('E2E-CU13-USUARIOS · Gestionar usuarios y roles', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Crear un usuario', async ({ page }) => {
    const email = 'marta.e2e@cuidared.do'
    const password = 'Clave2026x'
    // Dado que el usuario está autenticado como Administrador
    await iniciarSesion(page, 'admin')
    // Cuando accede al módulo de gestión de usuarios
    await page.goto('/admin/miembros')
    await page.getByRole('link', { name: 'Agregar usuario' }).first().click()
    await expect(page).toHaveURL(/\/admin\/miembros\/nuevo$/)
    // Y registra los datos requeridos de un nuevo usuario
    await page.getByRole('textbox', { name: /^Nombre/ }).fill('Marta')
    await page.getByRole('textbox', { name: /^Apellido/ }).fill('Encarnación')
    await page.getByRole('textbox', { name: /Correo electrónico/ }).fill(email)
    await page.getByRole('textbox', { name: /^Teléfono/ }).fill('809 555 0199')
    // Y asigna un rol válido
    await page.getByRole('radio', { name: 'Coordinador' }).click()
    await page.getByRole('radio', { name: 'Definir contraseña' }).click()
    await page.getByLabel('Contraseña inicial').fill(password)
    await page.getByRole('button', { name: 'Crear usuario' }).click()

    // Entonces el sistema debe crear la cuenta
    await expect(page.getByText('¡Usuario creado!')).toBeVisible()
    const u = (await leerDB(page)).usuarios.find((x) => x.email === email)
    // Y debe asociarla al rol seleccionado
    expect(u).toMatchObject({ nombre: 'Marta', apellido: 'Encarnación', rol: 'coordinador', estado: 'activo' })
    await page.waitForURL(`**/admin/miembros/${u!.id}`)
    await expect(page.getByRole('heading', { name: 'Permisos del rol Coordinador' })).toBeVisible()
    // (la nueva cuenta inicia sesión y llega al área de su rol)
    await cerrarSesion(page)
    await enviarCredenciales(page, email, password)
    await page.waitForURL('**/coordinador')
    await expect(page.getByTestId('usuario-actual')).toContainText('Marta Encarnación')
  })

  test('Escenario: Modificar el rol de un usuario', async ({ page }) => {
    // Dado que existe un usuario activo (Giselle Mejía, voluntaria asignada a Elena Rodríguez y María García)
    expect(adultosVinculados(await leerDB(page), 'u-giselle', 'voluntario_asignado').map((a) => a.id).sort()).toEqual(['a-elena', 'a-maria'])
    // Y el Administrador tiene permisos de gestión
    await sesionDirecta(page, CUENTAS.admin.id, '/admin/miembros/u-giselle')
    await expect(page.getByRole('heading', { name: 'Giselle Mejía' })).toBeVisible()
    // Cuando modifica el rol del usuario
    await page.getByRole('button', { name: 'Editar datos y rol' }).click()
    const hoja = page.getByRole('dialog', { name: 'Editar datos y rol' })
    await hoja.getByRole('radio', { name: 'Coordinador' }).click()
    await hoja.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText(/Rol actualizado a Coordinador/)).toBeVisible()

    // Entonces el sistema debe actualizar sus permisos
    const db = await leerDB(page)
    expect(db.usuarios.find((u) => u.id === 'u-giselle')?.rol).toBe('coordinador')
    // (no arrastra los accesos del rol anterior: se quitan sus vínculos de voluntario asignado)
    expect(adultosVinculados(db, 'u-giselle', 'voluntario_asignado')).toEqual([])
    // (el cambio queda en el historial de membresías: la de voluntario se cierra y se abre la de coordinador)
    const membresias = db.membresias.filter((m) => m.usuarioId === 'u-giselle')
    expect(membresias.filter((m) => m.estado === 'activa')).toEqual([expect.objectContaining({ rol: 'coordinador' })])
    expect(membresias.find((m) => m.rol === 'voluntario')).toMatchObject({ estado: 'inactiva', fechaFin: expect.any(String) })
    await expect(page.getByRole('heading', { name: 'Permisos del rol Coordinador' })).toBeVisible()

    // Y el usuario debe acceder únicamente a las funciones correspondientes al nuevo rol
    await cerrarSesion(page)
    await enviarCredenciales(page, 'giselle.mejia@gmail.com')
    await page.waitForURL('**/coordinador')
    await page.goto('/coordinador/resumen')
    await expect(page.getByRole('heading', { name: 'Resumen de seguimiento' })).toBeVisible()
    await page.goto('/voluntario/visitas')
    await expect(page.getByRole('heading', { name: NO_AUTORIZADO })).toBeVisible()
    await page.goto('/coordinador/auditoria')
    await expect(page.getByRole('heading', { name: NO_AUTORIZADO }).first()).toBeVisible()
  })

  test('Escenario: Desactivar un usuario', async ({ page, browser }) => {
    // Dado que existe un usuario activo (Carlos Ruiz, voluntario) con la sesión abierta en su propio dispositivo
    // (otro contexto de navegador: su propio almacenamiento local)
    const dispositivo = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: page.viewportSize()!, locale: 'es-DO', timezoneId: 'America/Santo_Domingo' })
    const voluntario = await dispositivo.newPage()
    await voluntario.goto('/inicio')
    await sesionDirecta(voluntario, CUENTAS.voluntario.id)
    await expect(voluntario.getByTestId('usuario-actual')).toContainText('Carlos Ruiz')
    await sesionDirecta(page, CUENTAS.admin.id, '/admin/miembros/u-cuid')
    await expect(page.getByRole('heading', { name: 'Carlos Ruiz' })).toBeVisible()
    // Cuando el Administrador selecciona la opción de desactivar
    await page.getByRole('button', { name: 'Desactivar' }).click()
    await page.getByRole('dialog', { name: 'Desactivar usuario' }).getByRole('button', { name: 'Desactivar' }).click()
    await expect(page.getByText('Carlos Ruiz ya no puede acceder a CuidaRed.')).toBeVisible()
    expect((await leerDB(page)).usuarios.find((u) => u.id === 'u-cuid')?.estado).toBe('inactivo')

    // Entonces el sistema debe restringir el acceso del usuario: la sesión abierta se cierra en cuanto su
    // dispositivo recibe el cambio del servidor (se replica 'cuidared:db' desde otra pestaña de ese dispositivo)
    const servidor = await page.evaluate(() => localStorage.getItem('cuidared:db'))
    const replica = await dispositivo.newPage()
    await replica.goto('/inicio')
    await replica.evaluate((json) => localStorage.setItem('cuidared:db', json!), servidor)
    await expect(voluntario).toHaveURL(/\/inicio$/)
    await expect(voluntario.getByText('Tu sesión se cerró porque tu cuenta ya no está activa.')).toBeVisible()
    await dispositivo.close()

    // Y no puede volver a iniciar sesión
    await cerrarSesion(page)
    await enviarCredenciales(page, CUENTAS.voluntario.email)
    await expect(page.getByRole('alert')).toContainText('no está activa')
    await expect(page).toHaveURL(/\/inicio$/)

    // Y el usuario no debe poder acceder a las funciones protegidas (una sesión que tuviera abierta se invalida)
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva')
    await expect(page).toHaveURL(/\/inicio$/)
    expect(await page.evaluate(() => localStorage.getItem('cuidared:sesion'))).toBeNull()
  })

  test('Escenario: Impedir acceso a una función no autorizada', async ({ page }) => {
    // Dado que un usuario está autenticado con un rol determinado (Coordinador)
    await sesionDirecta(page, CUENTAS.coordinador.id)
    // Cuando intenta acceder a una función que no pertenece a sus permisos
    await page.goto('/coordinador/auditoria')
    // Entonces el sistema debe impedir el acceso
    await expect(page.getByTestId('acceso-denegado')).toBeVisible()
    await expect(page.getByRole('heading', { name: NO_AUTORIZADO }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Registro de auditoría' })).toHaveCount(0)
    // (también fuera de su área: la gestión de usuarios del administrador)
    await page.goto('/admin/miembros')
    await expect(page.getByTestId('acceso-denegado')).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Buscar usuarios' })).toHaveCount(0)
    // (el intento queda registrado en la auditoría)
    await expect
      .poll(async () => (await leerDB(page)).auditoria.filter((e) => e.accion === 'acceso.denegado' && e.usuarioId === CUENTAS.coordinador.id).length)
      .toBeGreaterThanOrEqual(2)
  })
})
