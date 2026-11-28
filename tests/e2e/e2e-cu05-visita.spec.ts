/*
 * e2e-cu05-visita.spec.ts — Suite E2E-CU05-VISITA: escenarios Gherkin de CU-05 (SRS §16.2).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reglas de Negocio V2 (§Visita): hay dos portales de campo.
 *  - Cuidador (/cuidador): registro completo (estado del adulto, aspectos verificados, evidencias, adultos del hogar),
 *    necesidades e indicaciones; trabaja sin conexión. Carlos Ruiz (u-cuid) tiene asignados a Elena, José y Camila.
 *  - Voluntario (/voluntario): registro mínimo, solo "La visita se realizó" + una observación; sin necesidades ni datos
 *    médicos; también sin conexión. Miguel Acosta (u-vol) tiene asignados a Alicia y José Martínez.
 * El coordinador conserva el formulario completo y elige al responsable. Las pruebas omiten el onboarding de un solo uso
 * (diálogo modal que intercepta los clics tras el primer inicio de sesión; se verifica en la suite de CU-01).
 */
import { expect, test, type Page } from '@playwright/test'
import { alturaDocumento, CUENTAS, CUENTA_FAMILIA, haceDiasISO, iniciarSesion, leerDB, limpiarDatos, objetivosPequenos, sesionDirecta } from './fixtures'

const OBSERVACIONES = 'Visita de prueba E2E sin novedades, buen estado general.'
const OBSERVACION_VOLUNTARIO = 'Conversamos un rato en el balcón; estaba de buen ánimo.'
const OBSERVACION_ADICIONAL = 'Estaba en la sala con ella; se queja de dolor de espalda.'

/** PNG válido de 1×1 px (la app comprueba la firma real del archivo y lo decodifica para reducirlo). */
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/** Marca como vista la guía de onboarding de los usuarios demo (clave `cuidared:onboarding:<userId>:<rol>`). */
async function omitirOnboarding(page: Page) {
  const claves = [...Object.entries(CUENTAS).map(([rol, c]) => `${c.id}:${rol}`), `${CUENTA_FAMILIA.id}:coordinador`].map((k) => `cuidared:onboarding:${k}`)
  await page.evaluate((ks) => ks.forEach((k) => localStorage.setItem(k, new Date().toISOString())), claves)
}

/** Registros de la cola offline del dispositivo (IndexedDB 'cuidared-offline'). */
const colaOffline = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Array<{ entidad: string; usuarioId: string; datos: { observaciones?: string; adultoId?: string } }>>((resolve) => {
        const req = indexedDB.open('cuidared-offline')
        req.onsuccess = () => {
          const r = req.result.transaction('pendientes').objectStore('pendientes').getAll()
          r.onsuccess = () => resolve(r.result)
        }
      }),
  )

test.describe('E2E-CU05-VISITA · Registrar visita comunitaria', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page)
  })

  test('Escenario: Registrar una visita correctamente', async ({ page }) => {
    // Dado que el usuario está autenticado como Coordinador
    await iniciarSesion(page, 'coordinador')
    // Y existe un perfil activo de adulto mayor (Camila Torres)
    await page.goto('/coordinador/adultos/a-camila')
    await page.getByRole('link', { name: 'Registrar visita' }).click()
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    // Cuando registra la fecha de la visita
    const fecha = haceDiasISO(1)
    await form.getByLabel('Fecha').fill(fecha)
    // Y registra al responsable (el coordinador puede indicar al cuidador asignado que hizo la visita)
    await form.getByRole('combobox', { name: /Responsable/ }).selectOption({ label: 'Carlos Ruiz' })
    await form.getByRole('radio', { name: 'Estable' }).click()
    await form.getByText('Alimentación adecuada').click()
    // Y completa las observaciones correspondientes
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    // Y confirma el registro
    await form.getByRole('button', { name: 'Registrar visita' }).click()

    // Entonces el sistema debe guardar la visita
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    const db = await leerDB(page)
    const visita = db.visitas.find((v) => v.observaciones === OBSERVACIONES)
    expect(visita).toMatchObject({ adultoId: 'a-camila', cuidadorId: 'u-cuid', fecha, estado: 'completada', estadoAdulto: 'estable', checklist: ['alimentacion'] })
    expect(visita?.pendienteSync).toBeUndefined()

    // Y debe asociarla al perfil del adulto mayor y mostrarla en su historial de visitas
    await page.getByRole('link', { name: 'Volver al perfil de Camila' }).click()
    await expect(page).toHaveURL(/\/coordinador\/adultos\/a-camila$/)
    const historial = page.getByRole('region', { name: 'Historial consolidado' })
    const evento = historial.getByRole('list', { name: 'Línea de tiempo del adulto mayor' }).getByRole('listitem').filter({ hasText: OBSERVACIONES })
    await expect(evento).toHaveCount(1)
    await expect(evento).toContainText('Realizada')
    await expect(evento).toContainText('Responsable: Carlos Ruiz')
  })

  test('Escenario: El cuidador registra una visita completa desde el perfil del adulto', async ({ page }) => {
    // Dado que el usuario está autenticado como Cuidador y tiene asignada a Camila Torres
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/adultos/a-camila')
    // (la acción rápida del perfil lleva al formulario; sin omitir el onboarding, su diálogo modal intercepta este clic y la pantalla se queda en el perfil)
    await page.getByRole('link', { name: 'Registrar visita' }).click()
    await expect(page).toHaveURL(/\/cuidador\/visitas\/nueva\?adulto=a-camila$/)
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    // El responsable es él mismo (solo quien programa visitas elige a otro)
    await expect(form.locator('p').filter({ hasText: 'Responsable:' })).toContainText('Carlos Ruiz')
    await expect(form.getByRole('combobox', { name: /Responsable/ })).toHaveCount(0)
    // Cuando registra el estado del adulto, los aspectos verificados y las observaciones
    await form.getByRole('radio', { name: 'Requiere atención' }).click()
    await form.getByText('Toma de medicamentos').click()
    await form.getByText('Alimentación adecuada').click()
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    await form.getByRole('button', { name: 'Registrar visita' }).click()

    // Entonces el sistema guarda la visita completa, asociada al cuidador y al adulto
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    const visita = (await leerDB(page)).visitas.find((v) => v.observaciones === OBSERVACIONES)
    expect(visita).toMatchObject({ adultoId: 'a-camila', cuidadorId: CUENTAS.cuidador.id, estado: 'completada', estadoAdulto: 'requiere_atencion', fecha: haceDiasISO(0) })
    expect([...(visita?.checklist ?? [])].sort()).toEqual(['alimentacion', 'medicamentos'])
    // Y le ofrece el siguiente paso de campo: registrar una necesidad detectada durante la visita
    await expect(page.getByRole('link', { name: 'Registrar necesidad' })).toHaveAttribute('href', `/cuidador/necesidades/nueva?adulto=a-camila&visita=${visita!.id}`)
    await page.getByRole('link', { name: 'Ver la visita' }).click()
    await expect(page).toHaveURL(new RegExp(`/cuidador/visitas/${visita!.id}$`))
    await expect(page.getByText(OBSERVACIONES)).toBeVisible()
  })

  test('Escenario: Intentar registrar una visita sin seleccionar un adulto mayor', async ({ page }) => {
    // Dado que el usuario está registrando una visita (sin adulto preseleccionado)
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/visitas/nueva')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    const adulto = form.getByRole('combobox', { name: /Adulto mayor visitado/ })
    await expect(adulto).toHaveValue('')
    const antes = (await leerDB(page)).visitas.length

    // Cuando intenta guardar la visita sin asociarla a un adulto mayor
    await form.getByRole('radio', { name: 'Estable' }).click()
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    await form.getByRole('button', { name: 'Registrar visita' }).click()

    // Entonces el sistema debe impedir el registro
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toHaveCount(0)
    expect((await leerDB(page)).visitas.length).toBe(antes)
    // Y debe solicitar la selección de un perfil válido (mensaje junto al campo, sin perder lo escrito)
    await expect(adulto).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByRole('alert').filter({ hasText: 'Selecciona un perfil de adulto mayor válido.' })).toBeVisible()
    await expect(form.getByRole('textbox', { name: /Observaciones/ })).toHaveValue(OBSERVACIONES)
    // (RF-06) el foco pasa al primer campo inválido
    await expect(adulto).toBeFocused()
  })

  test('RF-06: con varios errores el foco va al primer campo inválido y el mensaje queda junto a cada campo', async ({ page }) => {
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    const antes = (await leerDB(page)).visitas.length
    // Sin elegir el estado del adulto ni escribir observaciones
    await form.getByRole('button', { name: 'Registrar visita' }).click()

    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toHaveCount(0)
    expect((await leerDB(page)).visitas.length).toBe(antes)
    await expect(form.getByRole('alert').filter({ hasText: 'Indica el estado del adulto durante la visita.' })).toBeVisible()
    const observaciones = form.getByRole('textbox', { name: /Observaciones/ })
    await expect(observaciones).toHaveAttribute('aria-invalid', 'true')
    // El primer campo inválido en pantalla es el estado del adulto (un grupo: enfoca su primera opción)
    await expect(form.getByRole('radio', { name: 'Estable' })).toBeFocused()
    // Al corregir el campo, su error desaparece sin reenviar
    await form.getByRole('radio', { name: 'Estable' }).click()
    await expect(form.getByRole('alert').filter({ hasText: 'Indica el estado del adulto durante la visita.' })).toHaveCount(0)
  })

  test('Escenario: El cuidador registra una visita a dos adultos del hogar con el estado de cada uno', async ({ page }) => {
    // Dado que Carlos Ruiz (cuidador) tiene asignados a Camila, Elena y José
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    // Cuando registra el estado y la observación del adulto principal
    await form.getByRole('radio', { name: 'Estable' }).click()
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    // Y añade a otro adulto con su propio estado y su observación
    await form.getByRole('button', { name: /¿Visitaste a otro adulto del hogar\?/ }).click()
    const fila = form.getByTestId('fila-adicional')
    await fila.getByRole('combobox', { name: /Adulto mayor/ }).selectOption('a-jose')
    await fila.getByRole('radio', { name: 'Requiere atención' }).click()
    await fila.getByRole('textbox', { name: /Observación/ }).fill(OBSERVACION_ADICIONAL)
    await form.getByRole('button', { name: 'Registrar visita' }).click()

    // Entonces el sistema guarda el estado de cada adulto en su fila de DetalleVisita
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    const visita = (await leerDB(page)).visitas.find((v) => v.observaciones === OBSERVACIONES)
    expect(visita).toMatchObject({
      adultoId: 'a-camila',
      estadoAdulto: 'estable',
      detallesAdicionales: [{ adultoId: 'a-jose', estadoAdulto: 'requiere_atencion', observacion: OBSERVACION_ADICIONAL }],
    })
    // Y el detalle de la visita muestra el estado de cada adulto junto a su observación
    await page.getByRole('link', { name: 'Ver la visita' }).click()
    await expect(page).toHaveURL(new RegExp(`/cuidador/visitas/${visita!.id}$`))
    const adultos = page.getByRole('region', { name: /Adultos visitados \(2\)/ })
    await expect(adultos.getByRole('listitem').filter({ hasText: 'Camila Torres' })).toContainText('Estable')
    const jose = adultos.getByRole('listitem').filter({ hasText: 'José Santana' })
    await expect(jose).toContainText('Requiere atención')
    await expect(jose).toContainText(OBSERVACION_ADICIONAL)
  })

  test('Escenario: Un adulto adicional sin estado impide registrar la visita', async ({ page }) => {
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    const antes = (await leerDB(page)).visitas.length
    // Dado que el estado del principal y la observación están completos, y el adulto adicional tiene observación pero no estado
    await form.getByRole('radio', { name: 'Estable' }).click()
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    await form.getByRole('button', { name: /¿Visitaste a otro adulto del hogar\?/ }).click()
    const fila = form.getByTestId('fila-adicional')
    await fila.getByRole('combobox', { name: /Adulto mayor/ }).selectOption('a-jose')
    await fila.getByRole('textbox', { name: /Observación/ }).fill(OBSERVACION_ADICIONAL)
    // Cuando intenta registrar la visita
    await form.getByRole('button', { name: 'Registrar visita' }).click()

    // Entonces el sistema no la guarda y pide el estado junto a la fila de ese adulto (con foco en su primera opción)
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toHaveCount(0)
    expect((await leerDB(page)).visitas.length).toBe(antes)
    await expect(fila.getByRole('alert').filter({ hasText: 'Indica el estado de este adulto.' })).toBeVisible()
    await expect(fila.getByRole('radiogroup', { name: /Estado del adulto adicional 1/ })).toHaveAttribute('aria-invalid', 'true')
    await expect(fila.getByRole('radio', { name: 'Estable' })).toBeFocused()
    // Y no se pierde lo escrito
    await expect(form.getByRole('textbox', { name: /Observaciones/ })).toHaveValue(OBSERVACIONES)
    await expect(fila.getByRole('textbox', { name: /Observación/ })).toHaveValue(OBSERVACION_ADICIONAL)

    // Al elegir el estado el error desaparece y la visita se registra
    await fila.getByRole('radio', { name: 'Situación crítica' }).click()
    await expect(fila.getByRole('alert')).toHaveCount(0)
    await form.getByRole('button', { name: 'Registrar visita' }).click()
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    const db = await leerDB(page)
    expect(db.visitas.find((v) => v.observaciones === OBSERVACIONES)?.detallesAdicionales).toEqual([
      { adultoId: 'a-jose', estadoAdulto: 'situacion_critica', observacion: OBSERVACION_ADICIONAL },
    ])
    // Y la situación crítica de José genera su alerta de emergencia (la de Camila, que está estable, no)
    expect(db.alertas.filter((a) => a.titulo === 'Situación crítica reportada en visita' && a.generadaPor === CUENTAS.cuidador.id).map((a) => a.adultoId)).toEqual(['a-jose'])
  })

  test('Escenario: Registrar una visita sin conexión', async ({ page, context }) => {
    // Dado que el usuario está autenticado como Cuidador (trabajo de campo completo, también sin conexión)
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    // Y el dispositivo no tiene conexión a internet
    await context.setOffline(true)
    await expect(form.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible()

    // Cuando registra una visita con todos los datos requeridos
    await form.getByRole('radio', { name: 'Requiere atención' }).click()
    await form.getByText('Toma de medicamentos').click()
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    await form.getByRole('button', { name: 'Registrar visita' }).click()

    // Entonces el sistema debe permitir completar el registro
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    // Y debe marcarlo como pendiente de sincronización
    await expect(page.getByText('Guardada en el dispositivo · Pendiente de sincronización')).toBeVisible()
    await expect(page.getByText('Pendiente de sincronización', { exact: true })).toBeVisible()
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    // (no llegó al servidor: solo está en la cola local del dispositivo)
    expect((await leerDB(page)).visitas.some((v) => v.observaciones === OBSERVACIONES)).toBe(false)
    const cola = await colaOffline(page)
    expect(cola).toEqual([expect.objectContaining({ entidad: 'visita', usuarioId: CUENTAS.cuidador.id, datos: expect.objectContaining({ observaciones: OBSERVACIONES }) })])
  })

  test('Escenario: El voluntario registra una visita mínima con una observación', async ({ page }) => {
    // Dado que el usuario está autenticado como Voluntario (Miguel Acosta) y tiene una visita de hoy por registrar
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario')
    await expect(page.getByRole('heading', { name: 'Visitas de hoy' })).toBeVisible()
    const antes = (await leerDB(page)).visitas.find((v) => v.id === 'v-9')!
    expect(antes).toMatchObject({ adultoId: 'a-alicia', cuidadorId: CUENTAS.voluntario.id, estado: 'pendiente' })
    // Su portal no ofrece necesidades ni información médica
    await expect(page.getByRole('link', { name: /necesidad|indicaci|agenda|alerta/i })).toHaveCount(0)

    // Cuando abre la visita programada desde el inicio
    await page.getByRole('link', { name: 'Registrar visita' }).click()
    await expect(page).toHaveURL(/\/voluntario\/visitas\/nueva\?visita=v-9$/)
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    await expect(form.getByText('Alicia Castillo')).toBeVisible()
    // El formulario solo pide confirmar la visita y la observación: sin estado del adulto, aspectos ni evidencias
    await expect(form.getByRole('radio')).toHaveCount(0)
    await expect(form.getByText(/Estado del adulto|Aspectos verificados|Evidencias|Tomar foto/)).toHaveCount(0)
    await expect(page.getByRole('link', { name: /necesidad|indicaci/i })).toHaveCount(0)
    // Y confirma que la visita se realizó y deja su observación
    await form.getByText('La visita se realizó').click()
    await expect(form.getByRole('checkbox', { name: /La visita se realizó/ })).toBeChecked()
    await form.getByRole('textbox', { name: /Observación/ }).fill(OBSERVACION_VOLUNTARIO)
    await form.getByRole('button', { name: 'Guardar visita' }).click()

    // Entonces el sistema guarda la visita con su observación, sin datos clínicos
    await expect(page.getByRole('heading', { name: 'Tu visita quedó registrada' })).toBeVisible()
    const db = await leerDB(page)
    const visita = db.visitas.find((v) => v.id === 'v-9')!
    expect(visita).toMatchObject({ adultoId: 'a-alicia', cuidadorId: CUENTAS.voluntario.id, estado: 'completada', observaciones: OBSERVACION_VOLUNTARIO, checklist: [], evidencias: [] })
    expect(visita.estadoAdulto || '').toBe('')
    expect(db.visitas.filter((v) => v.observaciones === OBSERVACION_VOLUNTARIO)).toHaveLength(1)
    expect(visita.pendienteSync).toBeUndefined()
    // Y no le propone registrar necesidades (no tiene ese permiso)
    await expect(page.getByRole('link', { name: /necesidad/i })).toHaveCount(0)
    // La visita aparece en «Registradas» con su observación
    await page.getByRole('link', { name: 'Ver mis visitas' }).click()
    await page.getByRole('tab', { name: /^Registradas/ }).click()
    await expect(page.getByText(OBSERVACION_VOLUNTARIO)).toBeVisible()
  })

  test('Escenario: El voluntario no puede guardar sin confirmar la visita ni escribir la observación', async ({ page }) => {
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva?adulto=a-alicia')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    const antes = (await leerDB(page)).visitas.length
    // Cuando intenta guardar sin nada
    await form.getByRole('button', { name: 'Guardar visita' }).click()
    // Entonces el sistema indica qué falta junto a cada campo y no guarda nada
    await expect(form.getByRole('alert').filter({ hasText: 'Confirma que la visita se realizó.' })).toBeVisible()
    await expect(form.getByRole('textbox', { name: /Observación/ })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('heading', { name: 'Tu visita quedó registrada' })).toHaveCount(0)
    expect((await leerDB(page)).visitas.length).toBe(antes)
    // Un adulto que no tiene asignado (Camila es de un cuidador) no se puede visitar: mismo mensaje que si no existiera
    await page.goto('/voluntario/visitas/nueva?adulto=a-camila')
    await expect(page.getByText('No encontrado o sin permiso')).toBeVisible()
  })

  test('Escenario: El voluntario registra una visita sin conexión', async ({ page, context }) => {
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva?adulto=a-alicia')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    await context.setOffline(true)
    await expect(form.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible()

    await form.getByText('La visita se realizó').click()
    await form.getByRole('textbox', { name: /Observación/ }).fill(OBSERVACION_VOLUNTARIO)
    await form.getByRole('button', { name: 'Guardar visita' }).click()

    await expect(page.getByRole('heading', { name: 'Tu visita quedó registrada' })).toBeVisible()
    await expect(page.getByText('Guardada en el dispositivo · Pendiente de sincronización')).toBeVisible()
    await expect(page.getByTestId('pendientes-sync')).toHaveText('1')
    expect((await leerDB(page)).visitas.some((v) => v.observaciones === OBSERVACION_VOLUNTARIO)).toBe(false)
    expect(await colaOffline(page)).toEqual([expect.objectContaining({ entidad: 'visita', usuarioId: CUENTAS.voluntario.id, datos: expect.objectContaining({ adultoId: 'a-alicia', observaciones: OBSERVACION_VOLUNTARIO }) })])
  })

  test('Escenario: Adjuntar una evidencia válida a la visita (foto o documento)', async ({ page }) => {
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    await expect(form.getByRole('button', { name: 'Tomar foto' })).toBeVisible()
    // Cuando elige una foto PNG con «Elegir archivo»
    const [selector] = await Promise.all([page.waitForEvent('filechooser'), form.getByRole('button', { name: 'Elegir archivo' }).click()])
    await selector.setFiles([{ name: 'pastillero.png', mimeType: 'image/png', buffer: PNG_1X1 }])
    // Entonces se adjunta como miniatura y se puede quitar
    await expect(form.getByRole('list', { name: 'Evidencias adjuntas' }).getByRole('img', { name: 'Evidencia 1' })).toBeVisible()
    await expect(form.getByRole('alert').filter({ hasText: /Tipo de archivo|contenido|pesa/ })).toHaveCount(0)
    // y un PDF se adjunta por su nombre
    const [selector2] = await Promise.all([page.waitForEvent('filechooser'), form.getByRole('button', { name: 'Elegir archivo' }).click()])
    await selector2.setFiles([{ name: 'receta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF') }])
    await expect(form.getByRole('list', { name: 'Evidencias adjuntas' }).getByText('receta.pdf')).toBeVisible()
    await form.getByRole('button', { name: 'Quitar evidencia 1' }).click()
    await expect(form.getByRole('img', { name: 'Evidencia 1' })).toHaveCount(0)

    // Y al registrar la visita la evidencia queda guardada con ella
    await form.getByRole('radio', { name: 'Estable' }).click()
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    await form.getByRole('button', { name: 'Registrar visita' }).click()
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    const visita = (await leerDB(page)).visitas.find((v) => v.observaciones === OBSERVACIONES)
    expect(visita?.evidencias).toEqual(['receta.pdf'])
  })

  test('Escenario: La evidencia rechaza un archivo que no es imagen ni PDF', async ({ page }) => {
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    const antes = (await leerDB(page)).visitas.length
    const lista = form.getByRole('list', { name: 'Evidencias adjuntas' })
    const mensaje = form.getByRole('alert')

    // Cuando intenta adjuntar un documento de texto
    const [a] = await Promise.all([page.waitForEvent('filechooser'), form.getByRole('button', { name: 'Elegir archivo' }).click()])
    await a.setFiles([{ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('Notas sueltas de la visita.') }])
    // Entonces el sistema lo rechaza con un mensaje claro y no lo adjunta
    await expect(mensaje.filter({ hasText: 'Tipo de archivo no permitido. Usa una foto JPG, PNG o WEBP, o un documento PDF.' })).toBeVisible()
    await expect(lista).toHaveCount(0)

    // Y tampoco basta con cambiar la extensión: se comprueba el contenido real del archivo
    const [b] = await Promise.all([page.waitForEvent('filechooser'), form.getByRole('button', { name: 'Elegir archivo' }).click()])
    await b.setFiles([{ name: 'falsa.png', mimeType: 'image/png', buffer: Buffer.from('esto no es una imagen') }])
    await expect(mensaje.filter({ hasText: 'El contenido del archivo no corresponde a una foto JPG, PNG o WEBP ni a un PDF.' })).toBeVisible()
    await expect(lista).toHaveCount(0)

    // Un archivo válido pero de más de 5 MB también se rechaza, indicando el límite
    const [c] = await Promise.all([page.waitForEvent('filechooser'), form.getByRole('button', { name: 'Elegir archivo' }).click()])
    await c.setFiles([{ name: 'grande.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 1024, 0x20) }])
    await expect(mensaje.filter({ hasText: 'el máximo es 5 MB' })).toBeVisible()
    await expect(lista).toHaveCount(0)

    // La visita no se guarda con ningún archivo y el formulario sigue disponible
    await form.getByRole('radio', { name: 'Estable' }).click()
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    await form.getByRole('button', { name: 'Registrar visita' }).click()
    await expect(page.getByRole('heading', { name: 'Visita registrada correctamente' })).toBeVisible()
    const db = await leerDB(page)
    expect(db.visitas.length).toBe(antes + 1)
    expect(db.visitas.find((v) => v.observaciones === OBSERVACIONES)?.evidencias).toEqual([])
  })

  test('Escenario: Recuperar lo escrito (borrador) al volver al formulario', async ({ page }) => {
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    let form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    await expect(page.getByText('Recuperamos lo que estabas escribiendo.')).toHaveCount(0)
    // Cuando escribe parte de la visita y la pantalla se recarga (p. ej., el teléfono cierra la pestaña)
    await form.getByRole('radio', { name: 'Requiere atención' }).click()
    await form.getByRole('textbox', { name: /Observaciones/ }).fill(OBSERVACIONES)
    await page.reload()
    // Entonces la app avisa que recuperó el borrador y conserva lo escrito
    form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form.getByText('Recuperamos lo que estabas escribiendo.')).toBeVisible()
    await expect(form.getByRole('textbox', { name: /Observaciones/ })).toHaveValue(OBSERVACIONES)
    await expect(form.getByRole('radio', { name: 'Requiere atención' })).toHaveAttribute('aria-checked', 'true')
    // Y puede descartarlo para empezar de nuevo
    await form.getByRole('button', { name: 'Descartar el borrador y empezar de nuevo' }).click()
    await expect(page.getByText('Recuperamos lo que estabas escribiendo.')).toHaveCount(0)
    await expect(form.getByRole('textbox', { name: /Observaciones/ })).toHaveValue('')
    expect((await leerDB(page)).visitas.some((v) => v.observaciones === OBSERVACIONES)).toBe(false)
  })

  test('RF-06: formulario de visita con objetivos táctiles ≥ 48 px y un solo desplazamiento a 360×640', async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'RF-06 se verifica en la resolución de referencia (proyecto movil, 360×640)')
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/visitas/nueva?adulto=a-camila')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    expect(page.viewportSize()).toEqual({ width: 360, height: 640 })
    // Ningún elemento interactivo visible del formulario mide menos de 48×48 px
    expect(await objetivosPequenos(form)).toEqual([])
    // Un solo desplazamiento: la página completa no supera dos alturas de pantalla
    expect(await alturaDocumento(page)).toBeLessThanOrEqual(2 * 640)
  })

  test('RF-06: formulario mínimo del voluntario con objetivos táctiles ≥ 48 px y un solo desplazamiento a 360×640', async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'RF-06 se verifica en la resolución de referencia (proyecto movil, 360×640)')
    await sesionDirecta(page, CUENTAS.voluntario.id, '/voluntario/visitas/nueva?adulto=a-alicia')
    const form = page.getByRole('form', { name: 'Registro de visita' })
    await expect(form).toBeVisible()
    expect(await objetivosPequenos(form)).toEqual([])
    expect(await alturaDocumento(page)).toBeLessThanOrEqual(2 * 640)
  })
})
