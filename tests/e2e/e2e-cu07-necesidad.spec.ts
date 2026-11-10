/*
 * e2e-cu07-necesidad.spec.ts — Suite E2E-CU07-NECESIDAD: escenarios Gherkin de CU-07 (SRS §16.3).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reglas de Negocio V2 (§Necesidad): registran necesidades el coordinador (y el administrador) y el CUIDADOR sobre los
 * adultos que tiene asignados (/cuidador/necesidades/nueva); el VOLUNTARIO no tiene necesidades ni datos médicos: no existe
 * /voluntario/necesidades/nueva. El formulario usa useFormulario: valida por campo al salir de él y al enviar, lleva el
 * foco al primer campo inválido y conserva lo escrito como borrador. Las pruebas omiten el onboarding de un solo uso
 * (se verifica en la suite de CU-01).
 */
import { expect, test, type Page } from '@playwright/test'
import { alturaDocumento, CUENTA_FAMILIA, CUENTAS, iniciarSesion, leerDB, limpiarDatos, objetivosPequenos, sesionDirecta } from './fixtures'

/** Marca como vista la guía de onboarding de los usuarios demo (clave `cuidared:onboarding:<userId>:<rol>`). */
async function omitirOnboarding(page: Page) {
  const claves = [...Object.entries(CUENTAS).map(([rol, c]) => `${c.id}:${rol}`), `${CUENTA_FAMILIA.id}:coordinador`].map((k) => `cuidared:onboarding:${k}`)
  await page.evaluate((ks) => ks.forEach((k) => localStorage.setItem(k, new Date().toISOString())), claves)
}

test.describe('E2E-CU07-NECESIDAD · Registrar necesidad pendiente', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page)
  })

  test('Escenario: Registrar una necesidad pendiente', async ({ page }) => {
    const descripcion = 'Necesita transporte para su cita del viernes en el hospital.'
    // Dado que existe un adulto mayor con perfil activo (Alicia Castillo)
    // Y el usuario está autenticado como Coordinador
    await iniciarSesion(page, 'coordinador')
    await page.goto('/coordinador/adultos/a-alicia')
    await page.getByRole('link', { name: 'Agregar necesidad' }).click()
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(form).toBeVisible()
    // Cuando selecciona una categoría de necesidad
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Transporte' })
    // (y, opcionalmente, la necesidad concreta del catálogo de esa categoría)
    await form.getByRole('combobox', { name: /^Necesidad/ }).selectOption({ label: 'Traslado a cita médica' })
    // Y registra la descripción de la necesidad
    await form.getByRole('textbox', { name: /Descripción/ }).fill(descripcion)
    // Y confirma el registro
    await form.getByRole('button', { name: 'Registrar necesidad' }).click()

    // Entonces el sistema debe crear la necesidad
    await expect(page.getByText('Necesidad registrada correctamente')).toBeVisible()
    const n = (await leerDB(page)).necesidades.find((x) => x.descripcion === descripcion)
    // Y debe asociarla al adulto mayor y establecerla inicialmente como pendiente
    expect(n).toMatchObject({ adultoId: 'a-alicia', tipo: 'transporte', catalogoId: 'nc-cita', estado: 'pendiente', prioridad: 'media', recurrente: false, registradaPor: CUENTAS.coordinador.id })
    expect(n?.historial).toEqual([expect.objectContaining({ estado: 'pendiente', usuarioId: CUENTAS.coordinador.id })])
    // (la confirmación lleva al detalle, que muestra el estado inicial y el adulto)
    await page.waitForURL(`**/coordinador/necesidades/${n!.id}`)
    await expect(page.getByText('PENDIENTE', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Alicia Castillo' })).toBeVisible()
  })

  test('Escenario: El cuidador registra una necesidad de un adulto que tiene asignado', async ({ page }) => {
    const descripcion = 'Necesita una silla de ruedas para sus citas médicas.'
    // Dado que el usuario está autenticado como Cuidador (Carlos Ruiz) y tiene asignada a Elena Rodríguez
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/adultos/a-elena')
    // Cuando abre «Agregar necesidad» desde el perfil
    await page.getByRole('link', { name: 'Agregar necesidad' }).click()
    await expect(page).toHaveURL(/\/cuidador\/necesidades\/nueva\?adulto=a-elena$/)
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(form).toBeVisible()
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Otros apoyos' })
    await form.getByRole('textbox', { name: /Descripción/ }).fill(descripcion)
    await form.getByRole('button', { name: 'Registrar necesidad' }).click()

    // Entonces el sistema la registra como pendiente a su nombre y abre su detalle, donde puede gestionarla
    await expect(page.getByText('Necesidad registrada correctamente')).toBeVisible()
    const n = (await leerDB(page)).necesidades.find((x) => x.descripcion === descripcion)
    expect(n).toMatchObject({ adultoId: 'a-elena', tipo: 'otros', estado: 'pendiente', prioridad: 'media', registradaPor: CUENTAS.cuidador.id })
    await page.waitForURL(`**/cuidador/necesidades/${n!.id}`)
    await expect(page.getByRole('heading', { name: 'Actualizar estado' })).toBeVisible()
    // Un adulto que no tiene asignado (Alicia es de un voluntario) no se puede abrir: mismo mensaje que si no existiera
    await page.goto('/cuidador/necesidades/nueva?adulto=a-alicia')
    await expect(page.getByText('No encontrado o sin permiso')).toBeVisible()
  })

  test('Escenario: Registrar una necesidad de medicamentos', async ({ page }) => {
    const descripcion = 'Reposición de losartán de 50 miligramos para el mes.'
    // Dado que el usuario (cuidador) está registrando una necesidad para Camila Torres
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/necesidades/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    // Cuando selecciona la categoría "Medicamentos"
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Medicamentos' })
    await expect(form.getByRole('note')).toContainText('Generará una alerta de caso prioritario')
    // (la prioridad pasa a Alta por defecto en medicamentos)
    await expect(form.getByRole('radio', { name: 'Alta' })).toHaveAttribute('aria-checked', 'true')
    // Y completa la información requerida
    await form.getByRole('textbox', { name: /Descripción/ }).fill(descripcion)
    await form.getByRole('button', { name: 'Registrar necesidad' }).click()

    // Entonces el sistema debe registrar la necesidad como pendiente
    await expect(page.getByText('Necesidad registrada correctamente')).toBeVisible()
    const db = await leerDB(page)
    const n = db.necesidades.find((x) => x.descripcion === descripcion)
    // Y debe asociarla al adulto mayor correspondiente
    expect(n).toMatchObject({ adultoId: 'a-camila', tipo: 'medicamentos', estado: 'pendiente', prioridad: 'alta', registradaPor: CUENTAS.cuidador.id })
    // (RF-04: la necesidad de medicamentos pendiente genera la alerta de caso prioritario)
    expect(db.alertas.some((a) => a.adultoId === 'a-camila' && a.tipo === 'prioritaria' && a.estado === 'pendiente')).toBe(true)
  })

  test('Escenario: Registrar una necesidad detectada durante una visita queda asociada a ella', async ({ page }) => {
    const observaciones = 'Se le acabó la crema para la piel y no tiene cómo comprarla.'
    const descripcion = 'Necesita crema hidratante para la piel seca.'
    // Dado que el cuidador acaba de registrar una visita a Camila Torres
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    const visita = page.getByRole('form', { name: 'Registro de visita' })
    await visita.getByRole('radio', { name: 'Estable' }).click()
    await visita.getByRole('textbox', { name: /Observaciones/ }).fill(observaciones)
    await visita.getByRole('button', { name: 'Registrar visita' }).click()
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    const visitaId = (await leerDB(page)).visitas.find((v) => v.observaciones === observaciones)!.id
    // Cuando elige «Registrar necesidad» en la confirmación (¿Detectaste alguna necesidad durante la visita?)
    await page.getByRole('link', { name: 'Registrar necesidad' }).click()
    await expect(page).toHaveURL(new RegExp(`/cuidador/necesidades/nueva\\?adulto=a-camila&visita=${visitaId}$`))
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(form.getByText('Se asociará a la visita que acabas de registrar.')).toBeVisible()
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Otros apoyos' })
    await form.getByRole('textbox', { name: /Descripción/ }).fill(descripcion)
    await form.getByRole('button', { name: 'Registrar necesidad' }).click()
    // Entonces la necesidad queda ligada a esa visita y su detalle enlaza con ella
    await expect(page.getByText('Necesidad registrada correctamente')).toBeVisible()
    const n = (await leerDB(page)).necesidades.find((x) => x.descripcion === descripcion)
    expect(n).toMatchObject({ adultoId: 'a-camila', visitaId, estado: 'pendiente' })
    await page.waitForURL(`**/cuidador/necesidades/${n!.id}`)
    await expect(page.getByRole('link', { name: 'Ver la visita' })).toHaveAttribute('href', `/cuidador/visitas/${visitaId}`)
  })

  test('Escenario: Registrar una necesidad sin conexión', async ({ page, context }) => {
    const descripcion = 'Requiere acompañamiento por las tardes durante la semana.'
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/necesidades/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(form).toBeVisible()
    // Dado que el usuario no dispone de conexión a internet
    await context.setOffline(true)
    await expect(form.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible()
    // Cuando registra una necesidad pendiente válida
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Compañía' })
    await form.getByRole('textbox', { name: /Descripción/ }).fill(descripcion)
    await form.getByRole('button', { name: 'Registrar necesidad' }).click()

    // Entonces el sistema debe permitir completar el registro
    await expect(page.getByText('Necesidad registrada correctamente')).toBeVisible()
    // Y debe marcar la información como pendiente de sincronización
    await expect(page.getByText('Guardada en el dispositivo · Pendiente de sincronización')).toBeVisible()
    await page.waitForURL(/\/cuidador\/necesidades\/n-/)
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toBeVisible()
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    expect((await leerDB(page)).necesidades.some((x) => x.descripcion === descripcion)).toBe(false)
  })

  test('Escenario: El formulario valida cada campo junto a él y lleva el foco al primero inválido', async ({ page }) => {
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/necesidades/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(form).toBeVisible()
    const antes = (await leerDB(page)).necesidades.length
    const categoria = form.getByRole('combobox', { name: /Categoría/ })
    const descripcion = form.getByRole('textbox', { name: /Descripción/ })

    // Al salir de un campo obligatorio sin completarlo, su mensaje aparece junto a él (sin enviar el formulario)
    await expect(form.getByRole('alert')).toHaveCount(0)
    await descripcion.fill('abc')
    await descripcion.blur()
    await expect(form.getByRole('alert').filter({ hasText: 'Escribe al menos 5 caracteres en la descripción.' })).toBeVisible()
    await expect(descripcion).toHaveAttribute('aria-invalid', 'true')
    // y desaparece en cuanto se corrige
    await descripcion.fill('Necesita pañales para adulto.')
    await expect(form.getByRole('alert').filter({ hasText: 'Escribe al menos 5 caracteres' })).toHaveCount(0)
    await descripcion.fill('')

    // Una cantidad sin unidad también se señala junto al campo de la unidad
    await form.getByRole('spinbutton', { name: /Cantidad/ }).fill('3')

    // Cuando intenta registrar con la categoría vacía, la descripción vacía y la cantidad sin unidad
    await form.getByRole('button', { name: 'Registrar necesidad' }).click()
    // Entonces no se guarda nada y cada error aparece junto a su campo
    expect((await leerDB(page)).necesidades.length).toBe(antes)
    await expect(page.getByText('Necesidad registrada correctamente')).toHaveCount(0)
    await expect(form.getByRole('alert').filter({ hasText: 'Selecciona la categoría de la necesidad.' })).toBeVisible()
    await expect(form.getByRole('alert').filter({ hasText: 'Escribe la descripción.' })).toBeVisible()
    await expect(form.getByRole('alert').filter({ hasText: 'Selecciona la unidad.' })).toBeVisible()
    await expect(categoria).toHaveAttribute('aria-invalid', 'true')
    // Y el foco va al primer campo inválido en pantalla (la categoría)
    await expect(categoria).toBeFocused()
  })

  test('Escenario: Recuperar lo escrito (borrador) de una necesidad al recargar', async ({ page }) => {
    const descripcion = 'Necesita bastón nuevo; el actual se rompió.'
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/necesidades/nueva?adulto=a-camila')
    let form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(page.getByText('Recuperamos lo que estabas escribiendo.')).toHaveCount(0)
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Otros apoyos' })
    await form.getByRole('textbox', { name: /Descripción/ }).fill(descripcion)
    await page.reload()
    form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(form.getByText('Recuperamos lo que estabas escribiendo.')).toBeVisible()
    await expect(form.getByRole('combobox', { name: /Categoría/ })).toHaveValue('otros')
    await expect(form.getByRole('textbox', { name: /Descripción/ })).toHaveValue(descripcion)
    await form.getByRole('button', { name: 'Descartar el borrador y empezar de nuevo' }).click()
    await expect(form.getByRole('textbox', { name: /Descripción/ })).toHaveValue('')
    await expect(form.getByRole('combobox', { name: /Categoría/ })).toHaveValue('')
  })

  test('Escenario: El voluntario no tiene necesidades ni puede registrarlas', async ({ page }) => {
    const antes = (await leerDB(page)).necesidades.length
    // Dado que el usuario está autenticado como Voluntario (Miguel Acosta, asignado a Alicia Castillo)
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario')
    // Entonces su portal no ofrece necesidades en ninguna parte: navegación, acciones ni enlaces
    await expect(page.getByRole('navigation').getByRole('link', { name: /necesidad|indicaci|agenda|alerta/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /necesidad/i })).toHaveCount(0)
    // Cuando intenta abrir el formulario de necesidades por la dirección (con o sin adulto asignado)
    for (const ruta of ['/voluntario/necesidades/nueva', '/voluntario/necesidades/nueva?adulto=a-alicia', '/voluntario/necesidades/n-1']) {
      await page.goto(ruta)
      // Entonces la ruta no existe para su rol: «No encontramos esta página», sin formulario ni datos de necesidades
      await expect(page.getByTestId('no-encontrada')).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`${ruta.replace(/[?]/g, '\\?')}$`))
      await expect(page.getByRole('form', { name: 'Registro de necesidad' })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Registrar necesidad' })).toHaveCount(0)
    }
    // Y no se creó ninguna necesidad
    expect((await leerDB(page)).necesidades.length).toBe(antes)
  })

  test('Escenario: El voluntario tampoco ve las necesidades de sus adultos al registrar una visita', async ({ page }) => {
    // Alicia (asignada a Miguel) tiene la necesidad n-8 (inactiva); José Martínez tiene n-7 (pendiente, alta)
    const db = await leerDB(page)
    expect(db.necesidades.some((n) => n.adultoId === 'a-josem' && n.estado === 'pendiente')).toBe(true)
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva?adulto=a-josem')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    await expect(page.getByText('Reparación de la rampa de acceso a la vivienda.')).toHaveCount(0)
    await expect(page.getByText(/necesidad pendiente|Necesidades abiertas/i)).toHaveCount(0)
    await form.getByText('La visita se realizó').click()
    await form.getByRole('textbox', { name: /Observación/ }).fill('Lo visité por la tarde y conversamos.')
    await form.getByRole('button', { name: 'Guardar visita' }).click()
    await expect(page.getByRole('heading', { name: 'Tu visita quedó registrada' })).toBeVisible()
    // La confirmación del voluntario no propone registrar necesidades (eso solo lo hace quien tiene el permiso)
    await expect(page.getByRole('link', { name: /necesidad/i })).toHaveCount(0)
  })

  test('RF-06: formulario de necesidad con objetivos táctiles ≥ 48 px y un solo desplazamiento a 360×640', async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'RF-06 se verifica en la resolución de referencia (proyecto movil, 360×640)')
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/necesidades/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await expect(form).toBeVisible()
    // (el cuidador ve además «Indicación médica relacionada»: Camila tiene una indicación vigente)
    await expect(form.getByRole('combobox', { name: /Indicación médica relacionada/ })).toBeVisible()
    expect(page.viewportSize()).toEqual({ width: 360, height: 640 })
    expect(await objetivosPequenos(form)).toEqual([])
    expect(await alturaDocumento(page)).toBeLessThanOrEqual(2 * 640)
  })

  // BUG DE LA APP (RF-06): con la categoría «Medicamentos» (aviso de alerta prioritaria + necesidad del catálogo) el formulario del
  // cuidador mide 1324 px a 360×640 y el criterio de RF-06 es ≤ 1280 px (dos pantallas). Sin categoría mide 1164 px y con «Compañía»,
  // 1264 px; el coordinador con Alicia (sin indicaciones vigentes) mide 1224 px. El botón «Cancelar» sigue visible en móvil
  // (en el formulario de visita se oculta hasta tablet para ahorrar altura). Se mantiene la aserción estricta hasta que se corrija.
  test('RF-06: con la categoría «Medicamentos» el formulario del cuidador sigue cabiendo en dos pantallas a 360×640', async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'RF-06 se verifica en la resolución de referencia (proyecto movil, 360×640)')
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/necesidades/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de necesidad' })
    await form.getByRole('combobox', { name: /Categoría/ }).selectOption({ label: 'Medicamentos' }) // muestra también el aviso
    await expect(form.getByRole('note')).toBeVisible()
    expect(await objetivosPequenos(form)).toEqual([])
    expect(await alturaDocumento(page)).toBeLessThanOrEqual(2 * 640)
  })
})
