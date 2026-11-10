/*
 * miembros.spec.ts — Gestión de miembros de la cuenta activa (fase 2): lista paginada con filtros, invitaciones,
 * cambio de rol, desactivar y reactivar, y acceso solo con `usuarios:gestionar`, con Auth y API interceptados.
 * Módulo: pruebas · access-real.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page } from '@playwright/test'
import { cuentaActiva, iniciarSesionEnMiCuenta, miembro, PERMISOS_CAMPO, simular, type MiembroSim } from './ayudas-fase2'

const CORREO = 'laura@example.test'
/** Identificador de la persona que inicia sesión en el simulador (para su propia membresía). */
const YO = 'c0a80101-0000-4000-8000-0000000000aa'

const organizacion = (extra = {}) => cuentaActiva({ cuenta_id: 'org-a', nombre: 'Fundación Esperanza', es_titular: true, ...extra })
const familia = (extra = {}) => cuentaActiva({ cuenta_id: 'fam-b', nombre: 'Familia Méndez', tipo: 'familia', rol: 'coordinador', es_titular: true, ...extra })

/** Equipo de una organización: la persona que entra (administradora y titular) y once más para paginar. */
function equipo(): MiembroSim[] {
  const yo = miembro('1', 'Laura', 'Díaz', 'administrador', 'activa', { es_titular: true })
  yo.usuario.id = YO
  return [
    yo,
    miembro('2', 'Diego', 'Cuidador', 'cuidador'),
    miembro('3', 'Elena', 'Coordina', 'coordinador'),
    miembro('4', 'Fabio', 'Familiar', 'familiar'),
    miembro('5', 'Gloria', 'Voluntaria', 'voluntario', 'inactiva'),
    miembro('6', 'Hugo', 'Pendiente', 'cuidador', 'pendiente'),
    ...[7, 8, 9, 10, 11, 12].map((n) => miembro(String(n), `Persona${n}`, 'Prueba', 'cuidador')),
  ]
}

async function abrirMiembros(page: Page) {
  await iniciarSesionEnMiCuenta(page, CORREO)
  await page.getByRole('link', { name: 'Miembros de la cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Miembros', exact: true })).toBeVisible()
}

const filas = (page: Page) => page.getByTestId('lista-miembros').getByRole('listitem')

async function abrirInvitacion(page: Page) {
  await page.getByRole('button', { name: 'Agregar miembros', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Agregar miembro', exact: true })).toBeVisible()
  await expect(page.getByLabel(/^Correo electrónico de la persona/)).toBeVisible()
}

async function abrirPerfil(page: Page, nombre: string) {
  await page.getByRole('button', { name: `Ver más de ${nombre}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Perfil miembro' })).toBeVisible()
  await expect(page.getByRole('heading', { name: nombre, exact: true })).toBeVisible()
}

async function llenarInvitacion(page: Page, rol = 'Cuidador') {
  await page.getByLabel(/^Correo electrónico de la persona/).fill('Nuevo.Cuidador@Example.test')
  await page.getByLabel(/^Cédula de la persona/).fill('00298765432')
  await page.getByLabel(/^Nombres de la persona/).fill('Nuria')
  await page.getByLabel(/^Apellidos de la persona/).fill('Santos')
  await page.getByLabel(/^Rol en la cuenta/).selectOption({ label: rol })
}

test('lista paginada con filtros de rol y estado, con la consulta del contrato', async ({ page }) => {
  const sim = await simular(page, { cuentas: [organizacion()], miembros: { 'org-a': equipo() } })
  await abrirMiembros(page)

  await expect(filas(page)).toHaveCount(10)
  await expect(page.getByText('12 personas · Página 1 de 2')).toBeVisible()
  await expect(filas(page).first()).toContainText('Laura Díaz')
  await expect(filas(page).first()).toContainText('Titular')
  await expect(filas(page).first()).toContainText('Tú')
  const primera = sim.llamadas('GET', '/cuentas/org-a/miembros')[0]!
  expect(Object.fromEntries(primera.consulta)).toEqual({ page: '1', limit: '10' })
  expect(primera.autorizacion).toBe(`Bearer ${sim.token}`)

  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('12 personas · Página 2 de 2')).toBeVisible()
  await expect(filas(page)).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  expect(sim.llamadas('GET', '/cuentas/org-a/miembros').at(-1)!.consulta.get('page')).toBe('2')

  // Cambiar un filtro vuelve a la primera página y pide solo lo filtrado al servidor.
  await page.getByLabel('Filtrar por rol').selectOption({ label: 'Cuidador' })
  await expect(filas(page)).toHaveCount(8)
  const filtrada = sim.llamadas('GET', '/cuentas/org-a/miembros').at(-1)!
  expect(filtrada.consulta.get('filter[rol]')).toBe('cuidador')
  expect(filtrada.consulta.get('page')).toBe('1')
  await expect(page.getByText('8 personas · Página 1 de 1')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Siguiente' })).toHaveCount(0)

  await page.getByLabel('Filtrar por estado').selectOption({ label: 'Invitación pendiente' })
  await expect(filas(page)).toHaveCount(1)
  await expect(filas(page).first()).toContainText('Hugo Pendiente')
  await expect(filas(page).first()).toContainText('Invitación pendiente')
  expect(sim.llamadas('GET', '/cuentas/org-a/miembros').at(-1)!.consulta.get('filter[estado]')).toBe('pendiente')

  await page.getByLabel('Filtrar por rol').selectOption({ label: 'Voluntario' })
  await expect(page.getByText('No hay resultados', { exact: true })).toBeVisible()
})

test('busca miembros fuera de la página actual y abre su perfil', async ({ page }) => {
  const sim = await simular(page, { cuentas: [organizacion()], miembros: { 'org-a': equipo() } })
  await abrirMiembros(page)
  await expect(filas(page)).toHaveCount(10)
  await expect(filas(page).filter({ hasText: 'Persona12 Prueba' })).toHaveCount(0)

  await page.getByRole('searchbox', { name: 'Buscar miembros por nombre o correo' }).fill('persona12')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(filas(page)).toHaveCount(1)
  await expect(filas(page).first()).toContainText('Persona12 Prueba')
  expect(sim.llamadas('GET', '/cuentas/org-a/miembros').at(-1)!.consulta.get('limit')).toBe('100')

  await abrirPerfil(page, 'Persona12 Prueba')
  await expect(page.getByText('Correo electrónico', { exact: true })).toBeVisible()
  expect(sim.llamadas('GET', '/cuentas/org-a/miembros/12').length).toBeGreaterThan(0)
})

test('invitar con éxito: roles válidos de la organización, cuerpo estricto y lista actualizada', async ({ page }) => {
  const sim = await simular(page, { cuentas: [organizacion()], miembros: { 'org-a': equipo() } })
  await abrirMiembros(page)
  await abrirInvitacion(page)

  await expect(page.getByLabel(/^Rol en la cuenta/).locator('option')).toHaveText(['Selecciona un rol', 'Administrador', 'Coordinador', 'Cuidador', 'Familiar responsable', 'Voluntario'])
  await llenarInvitacion(page)
  await page.getByRole('button', { name: 'Guardar y enviar invitación' }).click()

  await expect(page.getByText('Invitación enviada a nuevo.cuidador@example.test. Recibirá un código por correo para activar su cuenta.')).toBeVisible()
  await expect(page.getByLabel(/^Correo electrónico de la persona/)).toHaveCount(0)
  const envio = sim.llamadas('POST', '/cuentas/org-a/miembros')
  expect(envio).toHaveLength(1)
  expect(envio[0]!.cuerpo).toEqual({ correo: 'nuevo.cuidador@example.test', cedula: '00298765432', nombres: 'Nuria', apellidos: 'Santos', rol: 'cuidador' })

  // La lista se vuelve a pedir y la persona aparece como invitación pendiente.
  await expect(page.getByText('13 personas · Página 1 de 2')).toBeVisible()
  await page.getByLabel('Filtrar por estado').selectOption({ label: 'Invitación pendiente' })
  await expect(page.getByText('Nuria Santos')).toBeVisible()
})

test('invitar en una Familia ofrece solo los roles de Familia', async ({ page }) => {
  const yo = miembro('1', 'Laura', 'Díaz', 'coordinador', 'activa', { es_titular: true })
  yo.usuario.id = YO
  await simular(page, { cuentas: [familia()], miembros: { 'fam-b': [yo] } })
  await abrirMiembros(page)
  await expect(page.getByLabel('Filtrar por rol').locator('option')).toHaveText(['Rol: Todos', 'Coordinador', 'Cuidador', 'Familiar responsable'])
  await abrirInvitacion(page)
  await expect(page.getByLabel(/^Rol en la cuenta/).locator('option')).toHaveText(['Selecciona un rol', 'Coordinador', 'Cuidador', 'Familiar responsable'])
})

test('invitar con el plan lleno muestra PLAN_LIMIT_REACHED y conserva lo escrito', async ({ page }) => {
  const sim = await simular(page, { cuentas: [organizacion()], miembros: { 'org-a': equipo() }, limiteDePlan: true })
  await abrirMiembros(page)
  await abrirInvitacion(page)
  await llenarInvitacion(page, 'Voluntario')
  await page.getByRole('button', { name: 'Guardar y enviar invitación' }).click()

  await expect(page.getByRole('alert')).toContainText('Se alcanzó el límite de personas del plan de la cuenta.')
  await expect(page.locator('body')).not.toContainText('mensaje_privado')
  await expect(page.getByLabel(/^Correo electrónico de la persona/)).toHaveValue('Nuevo.Cuidador@Example.test')
  await expect(page.getByLabel(/^Cédula de la persona/)).toHaveValue('00298765432')
  await expect(page.getByLabel(/^Nombres de la persona/)).toHaveValue('Nuria')
  await expect(page.getByLabel(/^Rol en la cuenta/)).toHaveValue('voluntario')
  await expect(page.getByRole('heading', { name: 'Agregar miembro', exact: true })).toBeVisible()
  await expect(page.getByTestId('lista-miembros')).toHaveCount(0)
  expect(sim.llamadas('POST', '/cuentas/org-a/miembros')).toHaveLength(1)

  // Al liberar un cupo basta con volver a enviar, sin reescribir nada.
  sim.opciones.limiteDePlan = false
  await page.getByRole('button', { name: 'Guardar y enviar invitación' }).click()
  await expect(page.getByText(/^Invitación enviada a/)).toBeVisible()
})

test('INVITATIONS_UNAVAILABLE (503) explica que todavía no se pueden invitar personas nuevas', async ({ page }) => {
  await simular(page, { cuentas: [organizacion()], miembros: { 'org-a': equipo() }, invitacionesNoDisponibles: true })
  await abrirMiembros(page)
  await abrirInvitacion(page)
  await llenarInvitacion(page)
  await page.getByRole('button', { name: 'Guardar y enviar invitación' }).click()
  await expect(page.getByRole('alert')).toHaveText('Todavía no se pueden invitar personas nuevas. Puedes invitar a alguien que ya tenga un perfil en CuidaRed.')
  await expect(page.getByLabel(/^Apellidos de la persona/)).toHaveValue('Santos')
})

test('valida la invitación junto a cada campo antes de enviarla', async ({ page }) => {
  const sim = await simular(page, { cuentas: [organizacion()], miembros: { 'org-a': equipo() } })
  await abrirMiembros(page)
  await abrirInvitacion(page)
  expect(await page.locator('form input:not([type="checkbox"])').count()).toBeLessThanOrEqual(5)
  await page.getByRole('button', { name: 'Guardar y enviar invitación' }).click()
  await expect(page.getByText('Escribe un correo válido, por ejemplo nombre@correo.com.')).toBeVisible()
  await expect(page.getByText('La cédula debe tener exactamente 11 dígitos.')).toBeVisible()
  await expect(page.getByText('Escribe los nombres.')).toBeVisible()
  await expect(page.getByText('Escribe los apellidos.')).toBeVisible()
  await expect(page.getByText('Elige el rol que tendrá en la cuenta.')).toBeVisible()
  expect(sim.llamadas('POST', '/cuentas/org-a/miembros')).toHaveLength(0)
})

test('cambiar el rol pide confirmación y muestra los errores de protección del titular y del último gestor', async ({ page }) => {
  const miembros = equipo()
  miembros[2]!.es_titular = true // Elena es la titular de la cuenta
  const sim = await simular(page, { cuentas: [organizacion({ es_titular: false })], miembros: { 'org-a': miembros }, ultimoGestor: '4' })
  await abrirMiembros(page)

  // Cambio correcto, con confirmación.
  await abrirPerfil(page, 'Diego Cuidador')
  await page.getByRole('button', { name: 'Cambiar rol', exact: true }).click()
  const dialogo = page.getByRole('dialog', { name: 'Cambiar el rol de Diego Cuidador' })
  await expect(dialogo).toContainText('Rol actual de Diego Cuidador: Cuidador.')
  await expect(dialogo.getByLabel(/^Nuevo rol/).locator('option')).toHaveText(['Elige un rol', 'Administrador', 'Coordinador', 'Familiar responsable', 'Voluntario'])
  await dialogo.getByRole('button', { name: 'Cambiar rol', exact: true }).click()
  await expect(dialogo.getByText('Elige el nuevo rol.')).toBeVisible()
  expect(sim.llamadas('PATCH', '/cuentas/org-a/miembros/2')).toHaveLength(0)
  await dialogo.getByLabel(/^Nuevo rol/).selectOption({ label: 'Coordinador' })
  await dialogo.getByRole('button', { name: 'Cambiar rol', exact: true }).click()
  await expect(dialogo).toHaveCount(0)
  await expect(page.getByText('Se cambió el rol de Diego Cuidador a Coordinador.')).toBeVisible()
  expect(sim.llamadas('PATCH', '/cuentas/org-a/miembros/2')[0]!.cuerpo).toEqual({ rol: 'coordinador' })

  // La titular debe transferir la cuenta antes de cambiar su acceso.
  await abrirPerfil(page, 'Elena Coordina')
  await expect(page.getByRole('button', { name: 'Cambiar rol', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Desactivar miembro', exact: true })).toHaveCount(0)
  await expect(page.getByText(/primero transfiere la titularidad/)).toBeVisible()
  expect(sim.llamadas('PATCH', '/cuentas/org-a/miembros/3')).toHaveLength(0)
  await page.getByRole('button', { name: 'Volver', exact: true }).click()

  // Último gestor: tampoco se puede dejar la cuenta sin una persona gestora.
  await abrirPerfil(page, 'Fabio Familiar')
  await page.getByRole('button', { name: 'Desactivar miembro', exact: true }).click()
  const dialogoGestor = page.getByRole('dialog', { name: 'Desactivar a Fabio Familiar' })
  await dialogoGestor.getByRole('button', { name: 'Desactivar', exact: true }).click()
  await expect(dialogoGestor.getByRole('alert')).toContainText('La cuenta debe conservar al menos una persona gestora activa.')
  await expect(page.locator('body')).not.toContainText('mensaje_privado')
})

test('desactivar y reactivar piden confirmación y actualizan el estado de la persona', async ({ page }) => {
  const sim = await simular(page, { cuentas: [organizacion()], miembros: { 'org-a': equipo() } })
  await abrirMiembros(page)

  // Volver desde la confirmación no cambia nada.
  await abrirPerfil(page, 'Diego Cuidador')
  await page.getByRole('button', { name: 'Desactivar miembro', exact: true }).click()
  const dialogo = page.getByRole('dialog', { name: 'Desactivar a Diego Cuidador' })
  await expect(dialogo).toContainText('Diego Cuidador perderá el acceso a Fundación Esperanza de inmediato.')
  await dialogo.getByRole('button', { name: 'Volver' }).click()
  await expect(dialogo).toHaveCount(0)
  expect(sim.llamadas('POST', '/cuentas/org-a/miembros/2/desactivar')).toHaveLength(0)

  await page.getByRole('button', { name: 'Desactivar miembro', exact: true }).click()
  await dialogo.getByRole('button', { name: 'Desactivar', exact: true }).click()
  await expect(page.getByText('Diego Cuidador ya no tiene acceso a la cuenta.')).toBeVisible()
  expect(sim.llamadas('POST', '/cuentas/org-a/miembros/2/desactivar')[0]!.cuerpo).toEqual({})
  const fila = filas(page).filter({ hasText: 'Diego Cuidador' })
  await expect(fila).toContainText('Inactiva')
  await abrirPerfil(page, 'Diego Cuidador')
  await expect(page.getByRole('button', { name: 'Cambiar rol', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Reactivar miembro', exact: true }).click()
  const dialogoReactivar = page.getByRole('dialog', { name: 'Reactivar a Diego Cuidador' })
  await expect(dialogoReactivar).toContainText('volverá a tener acceso a Fundación Esperanza como Cuidador')
  await dialogoReactivar.getByRole('button', { name: 'Reactivar', exact: true }).click()
  await expect(page.getByText('Diego Cuidador volvió a tener acceso a la cuenta.')).toBeVisible()
  expect(sim.llamadas('POST', '/cuentas/org-a/miembros/2/reactivar')).toHaveLength(1)
  await expect(filas(page).filter({ hasText: 'Diego Cuidador' })).toContainText('Activa')

  // Una invitación pendiente se cancela con el mismo endpoint.
  await abrirPerfil(page, 'Hugo Pendiente')
  await page.getByRole('button', { name: 'Cancelar invitación', exact: true }).click()
  const dialogoInvitacion = page.getByRole('dialog', { name: 'Cancelar la invitación a Hugo Pendiente' })
  await dialogoInvitacion.getByRole('button', { name: 'Cancelar invitación', exact: true }).click()
  await expect(page.getByText('Se canceló la invitación a Hugo Pendiente.')).toBeVisible()
  expect(sim.llamadas('POST', '/cuentas/org-a/miembros/6/desactivar')).toHaveLength(1)
})

test('sin usuarios:gestionar no hay acceso a Miembros ni se consulta la lista', async ({ page }) => {
  const sim = await simular(page, {
    cuentas: [cuentaActiva({ cuenta_id: 'org-a', nombre: 'Fundación Esperanza', rol: 'cuidador', permisos: PERMISOS_CAMPO })],
    miembros: { 'org-a': equipo() },
  })
  await iniciarSesionEnMiCuenta(page, CORREO)
  await expect(page.getByTestId('resumen-cuenta')).toBeVisible()
  await expect(page.getByRole('link', { name: /Miembros/ })).toHaveCount(0)

  // Entrar por la dirección tampoco muestra personas: explica el motivo y ofrece volver.
  await page.goto('/cuenta/miembros')
  await expect(page.getByRole('heading', { name: 'Miembros', exact: true })).toBeVisible()
  await expect(page.getByText('No tienes permiso para gestionar miembros en Fundación Esperanza.')).toBeVisible()
  await expect(page.getByTestId('lista-miembros')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Agregar miembros', exact: true })).toHaveCount(0)
  expect(sim.llamadas('GET', /^\/cuentas\/[^/]+\/miembros/)).toHaveLength(0)
  await page.getByRole('link', { name: 'Volver a mi cuenta' }).click()
  await expect(page).toHaveURL(/\/cuenta$/)
})

test('al cambiar de cuenta activa se recargan los datos y los permisos de la nueva cuenta', async ({ page }) => {
  const sim = await simular(page, {
    cuentas: [
      organizacion(),
      familia(),
      cuentaActiva({ cuenta_id: 'org-c', nombre: 'Casa Hogar Aurora', rol: 'voluntario', permisos: PERMISOS_CAMPO }),
    ],
    miembros: {
      'org-a': equipo(),
      'fam-b': [miembro('31', 'Marta', 'Méndez', 'familiar'), miembro('32', 'Pedro', 'Méndez', 'cuidador')],
    },
  })
  await abrirMiembros(page)
  await expect(page.getByText('12 personas · Página 1 de 2')).toBeVisible()
  expect(sim.llamadas('GET', '/cuentas/fam-b/miembros')).toHaveLength(0)

  // Familia: otra lista, otros roles.
  await page.getByRole('button', { name: 'Volver' }).click()
  await page.getByTestId('cuentas-conectadas').getByRole('button', { name: /Familia Méndez/ }).click()
  await page.getByRole('link', { name: 'Miembros de la cuenta' }).click()
  await expect(page.getByText('2 personas · Página 1 de 1')).toBeVisible()
  await expect(filas(page)).toHaveCount(2)
  await expect(page.getByText('Marta Méndez')).toBeVisible()
  await expect(page.getByLabel('Filtrar por rol').locator('option')).toHaveText(['Rol: Todos', 'Coordinador', 'Cuidador', 'Familiar responsable'])
  expect(sim.llamadas('GET', '/cuentas/fam-b/miembros').length).toBeGreaterThan(0)

  // Cuenta donde solo es voluntaria: desaparece el acceso a Miembros.
  await page.getByRole('button', { name: 'Volver' }).click()
  await page.getByTestId('cuentas-conectadas').getByRole('button', { name: /Casa Hogar Aurora/ }).click()
  await expect(page.getByTestId('resumen-cuenta')).toContainText('Resumen de Casa Hogar Aurora')
  await expect(page.getByRole('link', { name: /Miembros/ })).toHaveCount(0)
})
