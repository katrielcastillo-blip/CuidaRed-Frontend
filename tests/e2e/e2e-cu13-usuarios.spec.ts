/*
 * e2e-cu13-usuarios.spec.ts — Suite E2E-CU13-USUARIOS: escenarios Gherkin de CU-13 Gestionar usuarios y roles
 * (SRS §16.8) con las Reglas de Negocio V2: miembros por cuenta (Membresia), «Agregar miembro» por invitación con
 * código, «Editar datos» y «Cambiar rol» por separado, «Desactivar miembro» (cierra la membresía de esa cuenta y
 * conserva el historial), roles según el tipo de cuenta (Familia: 3 · Organización: 5), autorización de familiares y
 * asignación de adultos, y gestión de miembros por el Administrador (Organización) o el Coordinador (Familia).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Rol } from '../../src/domain/types'
import { adultosVinculados, cerrarSesion, CUENTA_FAMILIA, CUENTAS, enviarCredenciales, iniciarSesion, leerDB, limpiarDatos, sesionDirecta } from './fixtures'

const NO_AUTORIZADO = 'Acceso no autorizado'

/**
 * Reglas de Negocio V2: la primera vez que una persona entra con un rol, la app muestra una guía de bienvenida
 * (diálogo de un solo uso, clave `cuidared:onboarding:<userId>:<rol>`). Estas pruebas no la verifican, así que se
 * marca como vista (para los usuarios demo y, si se indica, para otros) antes de entrar.
 */
async function omitirOnboarding(page: Page, ...extra: Array<[usuarioId: string, rol: Rol]>) {
  const pares: Array<[string, string]> = [...Object.entries(CUENTAS).map(([rol, c]): [string, string] => [c.id, rol]), [CUENTA_FAMILIA.id, 'coordinador'], ...extra]
  await page.evaluate((ps) => ps.forEach(([id, rol]) => localStorage.setItem(`cuidared:onboarding:${id}:${rol}`, new Date().toISOString())), pares)
}

/** Roles que ofrece el selector «Rol» del formulario «Agregar miembro». */
const rolesOfrecidos = (page: Page) => page.getByRole('radiogroup', { name: /^Rol/ }).getByRole('radio')

/**
 * Pulsa la ficha de un adulto en el selector de accesos («Adultos mayores…»). Las casillas son visualmente ocultas
 * (sr-only): lo que se toca es su etiqueta; después se comprueba el estado de la casilla.
 */
async function alternarAdulto(raiz: Page | Locator, nombre: RegExp, marcada: boolean) {
  await raiz.locator('label').filter({ hasText: nombre }).click()
  await expect(raiz.getByRole('checkbox', { name: nombre })).toBeChecked({ checked: marcada })
}

/** Código de 6 dígitos que muestra la hoja «Código de activación» (se muestra una sola vez). */
async function leerCodigo(page: Page) {
  const texto = await page.getByTestId('codigo-activacion').innerText()
  return texto.match(/\b\d{6}\b/)![0]
}

test.describe('E2E-CU13-USUARIOS · Gestionar usuarios y roles', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page, ['u-giselle', 'coordinador'])
  })

  test('Escenario: Crear un usuario', async ({ page }) => {
    const email = 'marta.e2e@cuidared.do'
    const password = 'Segura123!'
    // Dado que el usuario está autenticado como Administrador de la Fundación (cuenta Organización)
    await iniciarSesion(page, 'admin')
    // Cuando accede al módulo de gestión de miembros
    await page.goto('/admin/miembros')
    await page.getByRole('link', { name: 'Agregar miembro' }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/admin\/miembros\/nuevo$/)
    // Y registra los datos requeridos de un nuevo miembro
    await page.getByRole('textbox', { name: /^Nombre/ }).fill('Marta')
    await page.getByRole('textbox', { name: /^Apellido/ }).fill('Encarnación')
    await page.getByRole('textbox', { name: /Correo electrónico/ }).fill(email)
    await page.getByRole('textbox', { name: /^Teléfono/ }).fill('809 555 0199')
    // Y asigna un rol válido (una Organización ofrece los 5 roles del sistema)
    await expect(rolesOfrecidos(page)).toHaveText(['Administrador', 'Coordinador', 'Cuidador', 'Voluntario', 'Familiar responsable'])
    await page.getByRole('radio', { name: 'Coordinador' }).click()
    await page.getByRole('radio', { name: 'Definir contraseña' }).click()
    // (la contraseña inicial exige un carácter especial: Clave2026x no sirve)
    await page.getByLabel('Contraseña inicial').fill('Clave2026x')
    await page.getByRole('button', { name: 'Crear miembro' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'carácter especial' })).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/miembros\/nuevo$/)
    await page.getByLabel('Contraseña inicial').fill(password)
    await page.getByRole('button', { name: 'Crear miembro' }).click()

    // Entonces el sistema debe crear la cuenta
    await expect(page.getByText('¡Miembro creado!')).toBeVisible()
    const db = await leerDB(page)
    const u = db.usuarios.find((x) => x.email === email)
    // Y debe asociarla al rol seleccionado, mediante una membresía vigente en esta cuenta
    expect(u).toMatchObject({ nombre: 'Marta', apellido: 'Encarnación', rol: 'coordinador', estado: 'activo', orgId: 'org-1' })
    expect(db.membresias.filter((m) => m.usuarioId === u!.id)).toEqual([expect.objectContaining({ orgId: 'org-1', rol: 'coordinador', estado: 'activa' })])
    await page.waitForURL(`**/admin/miembros/${u!.id}`)
    await expect(page.getByRole('heading', { name: 'Permisos del rol Coordinador' })).toBeVisible()
    // (la nueva cuenta inicia sesión y llega al área de su rol)
    await cerrarSesion(page)
    await enviarCredenciales(page, email, password)
    await page.waitForURL('**/coordinador')
    await expect(page.getByTestId('usuario-actual')).toContainText('Marta Encarnación')
  })

  test('Escenario: Invitar a un miembro con un código de activación y asignarle adultos mayores', async ({ page }) => {
    const email = 'pedro.voluntario.e2e@correo.do'
    const password = 'Segura123!'
    // Dado que el Administrador agrega un miembro con el rol Voluntario
    await sesionDirecta(page, CUENTAS.admin.id, '/admin/miembros/nuevo')
    await page.getByRole('textbox', { name: /^Nombre/ }).fill('Pedro')
    await page.getByRole('textbox', { name: /^Apellido/ }).fill('Gómez')
    await page.getByRole('textbox', { name: /Correo electrónico/ }).fill(email)
    await page.getByRole('textbox', { name: /^Teléfono/ }).fill('829 555 0145')
    await page.getByRole('textbox', { name: /^Cédula/ }).fill('001-5551234-9')
    await page.getByRole('radio', { name: 'Voluntario' }).click()
    // Y le asigna los adultos mayores que podrá visitar (la invitación es el modo por defecto)
    await alternarAdulto(page, /^Camila Torres/, true)
    await page.getByRole('button', { name: 'Guardar y generar invitación' }).click()

    // Entonces la cuenta queda como «Invitado» y el sistema muestra una sola vez el código de activación
    await expect(page.getByTestId('codigo-activacion')).toContainText(email)
    const codigo = await leerCodigo(page)
    const db = await leerDB(page)
    const u = db.usuarios.find((x) => x.email === email)!
    expect(u).toMatchObject({ rol: 'voluntario', estado: 'invitado', orgId: 'org-1' })
    expect(db.invitaciones.filter((i) => i.email === email)).toEqual([expect.objectContaining({ estado: 'pendiente', rol: 'voluntario' })])
    expect(adultosVinculados(db, u.id, 'voluntario_asignado').map((a) => a.id)).toEqual(['a-camila'])
    // (el código se guarda con hash: no se puede leer de la base)
    expect(JSON.stringify(db.invitaciones)).not.toContain(codigo)
    await page.getByRole('button', { name: 'Listo' }).click()
    await page.waitForURL(`**/admin/miembros/${u.id}`)

    // Y la persona invitada activa su cuenta con su correo y el código, y elige su propia contraseña
    await cerrarSesion(page)
    await page.getByRole('link', { name: 'Activar mi cuenta' }).click()
    await expect(page).toHaveURL(/\/registro$/)
    await page.getByRole('textbox', { name: /^Correo electrónico/ }).fill(email)
    await page.getByRole('textbox', { name: /^Código de activación/ }).fill(codigo)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('con el rol Voluntario')).toBeVisible()
    await page.getByRole('textbox', { name: /^Cédula/ }).fill('001-5551234-9')
    await page.getByRole('textbox', { name: /^Nombre/ }).fill('Pedro')
    await page.getByRole('textbox', { name: /^Apellido/ }).fill('Gómez')
    await page.getByRole('textbox', { name: /^Teléfono/ }).fill('829 555 0145')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    await page.getByLabel('Confirmar contraseña', { exact: true }).fill(password)
    await page.getByRole('checkbox', { name: /He leído y acepto/ }).check()
    await page.getByRole('button', { name: 'Activar cuenta' }).click()
    // Entonces entra directo al área de su rol, con la cuenta activa y el código ya gastado
    await page.waitForURL('**/voluntario')
    await expect(page.getByTestId('usuario-actual')).toContainText('Pedro Gómez')
    const despues = await leerDB(page)
    expect(despues.usuarios.find((x) => x.id === u.id)?.estado).toBe('activo')
    expect(despues.invitaciones.find((i) => i.email === email)?.estado).toBe('aceptada')
  })

  test('Escenario: Modificar el rol de un usuario', async ({ page }) => {
    // Dado que existe un usuario activo (Giselle Mejía, cuidadora asignada a Elena Rodríguez y María García)
    const enOrg = (db: Awaited<ReturnType<typeof leerDB>>) => adultosVinculados(db, 'u-giselle', 'cuidador_asignado').filter((a) => a.orgId === 'org-1').map((a) => a.id).sort()
    expect(enOrg(await leerDB(page))).toEqual(['a-elena', 'a-maria'])
    // Y el Administrador tiene permisos de gestión
    await sesionDirecta(page, CUENTAS.admin.id, '/admin/miembros/u-giselle')
    await expect(page.getByRole('heading', { name: 'Giselle Mejía' })).toBeVisible()
    // Cuando modifica el rol del usuario (el cambio de rol es una acción aparte de «Editar datos»)
    await page.getByRole('button', { name: 'Cambiar rol' }).click()
    const hoja = page.getByRole('dialog', { name: 'Cambiar rol' })
    await hoja.getByRole('radio', { name: 'Coordinador' }).click()
    await hoja.getByRole('button', { name: 'Cambiar rol' }).click()
    await expect(page.getByText(/Rol actualizado a Coordinador/)).toBeVisible()

    // Entonces el sistema debe actualizar sus permisos
    const db = await leerDB(page)
    expect(db.usuarios.find((u) => u.id === 'u-giselle')?.rol).toBe('coordinador')
    // (no arrastra los accesos del rol anterior: se quitan sus vínculos de cuidador asignado)
    expect(enOrg(db)).toEqual([])
    // (el cambio queda en el historial de membresías: la de cuidador se cierra y se abre la de coordinador)
    const membresias = db.membresias.filter((m) => m.usuarioId === 'u-giselle')
    expect(membresias.filter((m) => m.estado === 'activa')).toEqual([expect.objectContaining({ orgId: 'org-1', rol: 'coordinador' })])
    expect(membresias.find((m) => m.rol === 'cuidador')).toMatchObject({ estado: 'inactiva', fechaFin: expect.any(String) })
    await expect(page.getByRole('heading', { name: 'Permisos del rol Coordinador' })).toBeVisible()

    // Y el usuario debe acceder únicamente a las funciones correspondientes al nuevo rol
    await cerrarSesion(page)
    await enviarCredenciales(page, 'giselle.mejia@gmail.com')
    await page.waitForURL('**/coordinador')
    await page.goto('/coordinador/resumen')
    await expect(page.getByRole('heading', { name: 'Resumen de seguimiento' })).toBeVisible()
    await page.goto('/cuidador/visitas')
    await expect(page.getByRole('heading', { name: NO_AUTORIZADO })).toBeVisible()
    await page.goto('/coordinador/auditoria')
    await expect(page.getByRole('heading', { name: NO_AUTORIZADO }).first()).toBeVisible()
  })

  test('Escenario: Editar los datos de un miembro sin cambiar su rol', async ({ page }) => {
    // Dado que el Administrador consulta el perfil de Giselle Mejía (cuidadora)
    await sesionDirecta(page, CUENTAS.admin.id, '/admin/miembros/u-giselle')
    // Cuando selecciona «Editar datos» y cambia su teléfono
    await page.getByRole('button', { name: 'Editar datos' }).click()
    const hoja = page.getByRole('dialog', { name: 'Editar datos' })
    // (la hoja solo trae los datos personales: el rol se cambia con «Cambiar rol»)
    await expect(hoja.getByRole('radiogroup')).toHaveCount(0)
    await hoja.getByRole('textbox', { name: /^Teléfono/ }).fill('809 555 0177')
    await hoja.getByRole('button', { name: 'Guardar' }).click()
    // Entonces el sistema actualiza sus datos y conserva su rol y sus asignaciones
    await expect(page.getByText('Cambios guardados')).toBeVisible()
    const db = await leerDB(page)
    expect(db.usuarios.find((u) => u.id === 'u-giselle')).toMatchObject({ telefono: '809 555 0177', rol: 'cuidador', estado: 'activo' })
    expect(adultosVinculados(db, 'u-giselle', 'cuidador_asignado').map((a) => a.id).sort()).toEqual(['a-elena', 'a-maria'])
    expect(db.auditoria.some((e) => e.accion === 'usuario.editar' && e.registroId === 'u-giselle' && e.usuarioId === CUENTAS.admin.id)).toBe(true)
    await expect(page.getByText('809 555 0177')).toBeVisible()
  })

  test('Escenario: Desactivar un usuario', async ({ page, browser }) => {
    // Dado que existe un usuario activo (Miguel Acosta, voluntario) con la sesión abierta en su propio dispositivo
    // (otro contexto de navegador: su propio almacenamiento local)
    const dispositivo = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: page.viewportSize()!, locale: 'es-DO', timezoneId: 'America/Santo_Domingo' })
    const voluntario = await dispositivo.newPage()
    await voluntario.goto('/inicio')
    await omitirOnboarding(voluntario)
    await sesionDirecta(voluntario, CUENTAS.voluntario.id)
    await expect(voluntario.getByTestId('usuario-actual')).toContainText('Miguel Acosta')
    await sesionDirecta(page, CUENTAS.admin.id, '/admin/miembros/u-vol')
    await expect(page.getByRole('heading', { name: 'Miguel Acosta' })).toBeVisible()
    // Cuando el Administrador selecciona la opción de desactivar
    await page.getByRole('button', { name: 'Desactivar', exact: true }).click()
    await page.getByRole('dialog', { name: 'Desactivar miembro' }).getByRole('button', { name: 'Desactivar' }).click()
    await expect(page.getByText('Miguel Acosta ya no puede acceder a esta cuenta.')).toBeVisible()
    // (la membresía se cierra y se conserva: el historial no se borra; sus accesos a adultos se quitan)
    const db = await leerDB(page)
    expect(db.usuarios.find((u) => u.id === 'u-vol')?.estado).toBe('inactivo')
    expect(db.membresias.find((m) => m.usuarioId === 'u-vol' && m.orgId === 'org-1')).toMatchObject({ estado: 'inactiva', fechaFin: expect.any(String), rol: 'voluntario' })
    expect(adultosVinculados(db, 'u-vol', 'voluntario_asignado')).toEqual([])
    expect(db.visitas.filter((v) => v.cuidadorId === 'u-vol').length).toBeGreaterThan(0)

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

  test('Escenario: Desactivar a un miembro que pertenece a dos cuentas solo cierra su membresía en esa cuenta', async ({ page }) => {
    const antes = await leerDB(page)
    const visitasAntes = antes.visitas.filter((v) => v.cuidadorId === 'u-cuid').length
    // Dado que Carlos Ruiz es cuidador de la Fundación Esperanza y de Familia Méndez
    expect(antes.membresias.filter((m) => m.usuarioId === 'u-cuid' && m.estado === 'activa').map((m) => m.orgId).sort()).toEqual(['org-1', 'org-fam'])
    await sesionDirecta(page, CUENTAS.admin.id, '/admin/miembros/u-cuid')
    await expect(page.getByRole('heading', { name: 'Carlos Ruiz' })).toBeVisible()
    // Cuando el Administrador de la Fundación lo desactiva
    await page.getByRole('button', { name: 'Desactivar', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Desactivar miembro' })
    await expect(hoja).toContainText('perderá el acceso a esta cuenta')
    await hoja.getByRole('button', { name: 'Desactivar' }).click()
    await expect(page.getByText('Carlos Ruiz ya no puede acceder a esta cuenta.')).toBeVisible()

    // Entonces pierde el acceso a la Fundación, pero conserva el de Familia Méndez
    const db = await leerDB(page)
    expect(db.membresias.find((m) => m.usuarioId === 'u-cuid' && m.orgId === 'org-1')).toMatchObject({ estado: 'inactiva', fechaFin: expect.any(String) })
    expect(db.membresias.find((m) => m.usuarioId === 'u-cuid' && m.orgId === 'org-fam')).toMatchObject({ estado: 'activa' })
    expect(db.usuarios.find((u) => u.id === 'u-cuid')?.estado).toBe('activo')
    const cuidados = (orgId: string) => adultosVinculados(db, 'u-cuid', 'cuidador_asignado').filter((a) => a.orgId === orgId).map((a) => a.id).sort()
    expect(cuidados('org-1')).toEqual([])
    expect(cuidados('org-fam')).toEqual(['a-ramon', 'a-rosa'])
    // Y su historial se conserva (visitas registradas y membresía cerrada)
    expect(db.visitas.filter((v) => v.cuidadorId === 'u-cuid').length).toBe(visitasAntes)
    await expect(page.getByRole('region', { name: 'Historial de membresías' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reactivar' })).toBeVisible()
    // Y al iniciar sesión entra directo a Familia Méndez, donde ya no ve los adultos de la Fundación
    await cerrarSesion(page)
    await enviarCredenciales(page, CUENTAS.cuidador.email)
    await page.waitForURL('**/cuidador')
    await page.goto('/cuidador/adultos')
    await expect(page.getByText('2 adultos asignados')).toBeVisible()
    await expect(page.getByRole('link', { name: /^Rosa Méndez, riesgo/ })).toBeVisible()
    await page.goto('/cuidador/adultos/a-elena')
    await expect(page.getByText('No encontrado o sin permiso')).toBeVisible()
  })

  test('Escenario: Autorizar a un familiar los adultos mayores que puede ver', async ({ page }) => {
    const deClara = (db: Awaited<ReturnType<typeof leerDB>>, orgId: string) => adultosVinculados(db, 'u-fam', 'familiar_responsable').filter((a) => a.orgId === orgId).map((a) => a.id).sort()
    // Dado que Clara Rodríguez (familiar) tiene autorización para Elena, María y Estefan en la Fundación, y para Rosa en Familia Méndez
    const antes = await leerDB(page)
    expect(deClara(antes, 'org-1')).toEqual(['a-elena', 'a-estefan', 'a-maria'])
    expect(deClara(antes, 'org-fam')).toEqual(['a-rosa'])
    await sesionDirecta(page, CUENTAS.admin.id, '/admin/miembros/u-fam')
    const seccion = page.getByRole('region', { name: /Adultos mayores que puede ver/ })
    await expect(seccion).toContainText('Sin autorización explícita el familiar no ve a ningún adulto mayor')
    // Cuando el Administrador le quita a María García y le autoriza a José Santana
    await alternarAdulto(seccion, /^María García/, false)
    await alternarAdulto(seccion, /^José Santana/, true)
    await seccion.getByRole('button', { name: 'Guardar autorizaciones' }).click()
    await expect(page.getByText('Autorizaciones guardadas')).toBeVisible()

    // Entonces los vínculos «familiar responsable» de la Fundación se actualizan y los de la otra cuenta no se tocan
    const db = await leerDB(page)
    expect(deClara(db, 'org-1')).toEqual(['a-elena', 'a-estefan', 'a-jose'])
    expect(deClara(db, 'org-fam')).toEqual(['a-rosa'])
    // Y Clara solo consulta a los adultos que tiene autorizados
    await cerrarSesion(page)
    await enviarCredenciales(page, CUENTAS.familiar.email)
    await page.waitForURL('**/familiar')
    await page.goto('/familiar/adultos/a-jose')
    await expect(page.getByRole('heading', { name: 'José Santana' })).toBeVisible()
    await page.goto('/familiar/adultos/a-maria')
    await expect(page.getByText('No encontrado o sin permiso')).toBeVisible()
  })

  test('Escenario: Impedir acceso a una función no autorizada', async ({ page }) => {
    // Dado que un usuario está autenticado con un rol determinado (Coordinador de la Fundación)
    await sesionDirecta(page, CUENTAS.coordinador.id)
    // Cuando intenta acceder a una función que no pertenece a sus permisos
    await page.goto('/coordinador/auditoria')
    // Entonces el sistema debe impedir el acceso
    await expect(page.getByTestId('acceso-denegado')).toBeVisible()
    await expect(page.getByRole('heading', { name: NO_AUTORIZADO }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Registro de auditoría' })).toHaveCount(0)
    // (en una Organización la gestión de miembros es del Administrador: el Coordinador no entra a su propia ruta)
    await page.goto('/coordinador/miembros')
    await expect(page.getByTestId('acceso-denegado')).toBeVisible()
    await expect(page.getByRole('heading', { name: NO_AUTORIZADO }).first()).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Buscar miembros' })).toHaveCount(0)
    // (tampoco la del área del administrador)
    await page.goto('/admin/miembros')
    await expect(page.getByTestId('acceso-denegado')).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Buscar miembros' })).toHaveCount(0)
    // (los intentos quedan registrados en la auditoría)
    await expect
      .poll(async () => (await leerDB(page)).auditoria.filter((e) => e.accion === 'acceso.denegado' && e.usuarioId === CUENTAS.coordinador.id).length)
      .toBeGreaterThanOrEqual(3)
  })

  test('Escenario: La coordinadora de una cuenta Familia gestiona los miembros de su cuenta', async ({ page }) => {
    // Dado que Patricia Méndez es la Coordinadora de la cuenta Familia «Familia Méndez»
    await sesionDirecta(page, CUENTA_FAMILIA.id)
    // Cuando accede a la gestión de miembros (en una cuenta Familia la hace el Coordinador, no hay Administrador)
    await page.goto('/coordinador/miembros')
    // Entonces entra y ve solo a los miembros de su cuenta
    await expect(page.getByTestId('acceso-denegado')).toHaveCount(0)
    await expect(page.getByRole('searchbox', { name: 'Buscar miembros' })).toBeVisible()
    const lista = page.getByRole('list').filter({ has: page.getByRole('heading', { name: 'Patricia Méndez' }) })
    await expect(lista.getByRole('listitem')).toHaveCount(3)
    for (const nombre of ['Patricia Méndez', 'Carlos Ruiz', 'Clara Rodríguez']) await expect(lista.getByRole('heading', { name: nombre })).toBeVisible()
    await expect(lista).not.toContainText('Giselle Mejía')

    // Y al agregar un miembro solo se ofrecen los roles de una cuenta Familia
    await page.getByRole('link', { name: 'Agregar miembro' }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/coordinador\/miembros\/nuevo$/)
    await expect(rolesOfrecidos(page)).toHaveText(['Coordinador', 'Cuidador', 'Familiar responsable'])
    // Y puede invitar a un familiar autorizándole explícitamente a un adulto mayor de la familia
    await page.getByRole('textbox', { name: /^Nombre/ }).fill('Elisa')
    await page.getByRole('textbox', { name: /^Apellido/ }).fill('Méndez')
    await page.getByRole('textbox', { name: /Correo electrónico/ }).fill('elisa.mendez.e2e@correo.do')
    await page.getByRole('textbox', { name: /^Teléfono/ }).fill('809 555 0188')
    await page.getByRole('radio', { name: 'Familiar responsable' }).click()
    await expect(page.getByText('Sin autorización explícita el familiar no ve ningún adulto mayor')).toBeVisible()
    // (solo aparecen los adultos de la cuenta Familia, no los de la Fundación)
    await expect(page.getByRole('checkbox', { name: /Elena Rodríguez/ })).toHaveCount(0)
    await alternarAdulto(page, /^Ramón Méndez/, true)
    await page.getByRole('button', { name: 'Guardar y generar invitación' }).click()
    await expect(page.getByTestId('codigo-activacion')).toContainText('elisa.mendez.e2e@correo.do')

    const db = await leerDB(page)
    const u = db.usuarios.find((x) => x.email === 'elisa.mendez.e2e@correo.do')!
    expect(u).toMatchObject({ rol: 'familiar', estado: 'invitado', orgId: 'org-fam' })
    expect(db.membresias.filter((m) => m.usuarioId === u.id)).toEqual([expect.objectContaining({ orgId: 'org-fam', rol: 'familiar', estado: 'activa' })])
    expect(adultosVinculados(db, u.id, 'familiar_responsable').map((a) => a.id)).toEqual(['a-ramon'])
    await page.getByRole('button', { name: 'Listo' }).click()
    await page.waitForURL(`**/coordinador/miembros/${u.id}`)
    await expect(page.getByRole('heading', { name: 'Elisa Méndez' })).toBeVisible()
    // Y no puede abrir el perfil de un miembro de otra cuenta
    await page.goto('/coordinador/miembros/u-giselle')
    await expect(page.getByText('Miembro no encontrado')).toBeVisible()
  })
})
