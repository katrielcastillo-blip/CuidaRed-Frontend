/*
 * e2e-cu09-alerta-prior.spec.ts — Suite E2E-CU09-ALERTA-PRIOR: escenarios Gherkin de CU-09 (SRS §16.4).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * "Cuando el sistema evalúa las condiciones de prioridad": se prepara el estado en el servidor simulado y se
 * recarga la app, que ejecuta el motor de reglas al arrancar (evaluación continua, RF-04).
 * Modelo V3.0: el nivel de riesgo vigente se registra en Env_Riesgo (`riesgos`) y se copia en Adulto.riesgo
 * (el más alto de los vigentes); la urgencia de la alerta usa el catálogo Prioridad ("Prioridad Alta").
 * Reglas de Negocio V2: la bandeja y el detalle de alertas (pendiente → en atención → atendida, con la acción tomada
 * obligatoria para resolver, DFP6-04) los usan el coordinador/administrador (alertas:gestionar) y el cuidador, que
 * solo ve las alertas de sus adultos con vínculo `cuidador_asignado` y puede cerrarlas (alertas:cerrar), nunca
 * dejarlas "en atención". Las pruebas omiten el onboarding de un solo uso (se verifica en su propia suite).
 */
import { expect, test, type Page } from '@playwright/test'
import { adultosVinculados, CUENTAS, editarDB, leerDB, limpiarDatos, necesidadPendiente, sesionDirecta } from './fixtures'

/** Marca como vista la guía de onboarding de todos los usuarios y roles demo (clave `cuidared:onboarding:<userId>:<rol>`). */
async function omitirOnboarding(page: Page) {
  await page.evaluate(() => {
    const ids = ['u-admin', 'u-coord', 'u-cuid', 'u-vol', 'u-fam', 'u-giselle', 'u-ctorres', 'u-eduardo', 'u-fcoord']
    const roles = ['admin', 'coordinador', 'cuidador', 'voluntario', 'familiar']
    for (const id of ids) for (const rol of roles) localStorage.setItem(`cuidared:onboarding:${id}:${rol}`, new Date().toISOString())
  })
}

/**
 * El motor de reglas se evalúa cuando la app monta (no al cargar el módulo): se espera a que genere la alerta del
 * tipo indicado para el adulto y se devuelve su registro del servidor simulado.
 */
async function alertaGenerada(page: Page, adultoId: string, tipo: 'prioritaria' | 'seguimiento') {
  const buscar = async () => (await leerDB(page)).alertas.find((a) => a.adultoId === adultoId && a.tipo === tipo)
  await expect.poll(async () => !!(await buscar()), { message: `el motor de reglas debe generar la alerta ${tipo} de ${adultoId}` }).toBe(true)
  return (await buscar())!
}

/** Bandeja de alertas del coordinador filtrada por el nombre del adulto. */
async function alertasDe(page: Page, nombre: string) {
  await page.goto('/coordinador/alertas')
  await page.getByRole('searchbox', { name: 'Buscar alertas' }).fill(nombre)
  return page.getByRole('list', { name: 'Alertas' }).getByRole('link').filter({ hasText: nombre })
}

test.describe('E2E-CU09-ALERTA-PRIOR · Generar alerta de caso prioritario', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page)
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
    const alerta = await alertaGenerada(page, 'a-camila', 'prioritaria')
    expect(alerta).toMatchObject({ severidad: 'alta', estado: 'pendiente', generadaPor: 'sistema' })
    expect(alerta.condiciones).toContain('Nivel de riesgo social "Alto"')

    // Y la alerta debe quedar disponible para los usuarios autorizados (urgencia visible)
    const tarjetas = await alertasDe(page, 'Camila Torres')
    await expect(tarjetas).toHaveCount(1)
    await expect(tarjetas.first()).toContainText('Caso prioritario')
    await expect(tarjetas.first()).toContainText('Prioridad Alta')
    await expect(tarjetas.first()).toContainText('Pendiente')
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
    const alerta = await alertaGenerada(page, 'a-alicia', 'prioritaria')
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

    // Entonces no debe generar una alerta de urgencia "Alta" (se mira la bandeja cuando la app ya montó y evaluó las reglas)
    const tarjetas = await alertasDe(page, 'Camila Torres')
    await expect(tarjetas).toHaveCount(0)
    await expect(page.getByText('Sin alertas', { exact: true })).toBeVisible()
    const despues = await leerDB(page)
    expect(despues.alertas.filter((a) => a.adultoId === 'a-camila' && a.severidad === 'alta')).toEqual([])
  })

  test('Escenario: El cuidador cierra una alerta de su adulto asignado registrando la acción tomada', async ({ page }) => {
    // Dado que Carlos Ruiz es cuidador asignado de Elena Rodríguez, que tiene una alerta de emergencia pendiente (al-1)
    const db = await leerDB(page)
    expect(adultosVinculados(db, CUENTAS.cuidador.id, 'cuidador_asignado').map((a) => a.id)).toContain('a-elena')
    expect(db.alertas.find((a) => a.id === 'al-1')).toMatchObject({ adultoId: 'a-elena', tipo: 'emergencia', severidad: 'alta', estado: 'pendiente' })
    // Y la alerta de María García (al-5) pertenece a un adulto que NO tiene asignado
    expect(adultosVinculados(db, CUENTAS.cuidador.id, 'cuidador_asignado').map((a) => a.id)).not.toContain('a-maria')

    // Cuando el cuidador abre la bandeja de alertas de su área
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/alertas')
    await expect(page.getByText('Ves las alertas de tus adultos asignados. Puedes cerrarlas indicando la acción tomada.')).toBeVisible()
    const lista = page.getByRole('list', { name: 'Alertas' })
    // Entonces solo ve las alertas de sus adultos asignados
    await expect(lista.getByRole('link').filter({ hasText: 'Elena Rodríguez' })).toHaveCount(1)
    await expect(lista.getByRole('link').filter({ hasText: 'María García' })).toHaveCount(0)
    await lista.getByRole('link').filter({ hasText: 'Elena Rodríguez' }).click()
    await expect(page.getByRole('heading', { name: 'Elena Rodríguez' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Estado de la alerta' }).locator('[aria-current="step"]')).toContainText('Pendiente')

    // Y solo puede cerrarla: el formulario se llama «Cerrar alerta» y la acción tomada es obligatoria (DFP6-04)
    const form = page.getByRole('form', { name: 'Cerrar alerta' })
    await expect(form).toBeVisible()
    await form.getByRole('button', { name: 'Cerrar alerta' }).click()
    await expect(form.getByText('Describe la acción tomada (mínimo 5 caracteres).')).toBeVisible()
    expect((await leerDB(page)).alertas.find((a) => a.id === 'al-1')).toMatchObject({ estado: 'pendiente' })

    // Cuando registra la acción tomada y cierra la alerta
    const accion = 'Se llamó a la familia y se coordinó el traslado a la consulta.'
    await form.getByRole('textbox', { name: /Acción tomada/ }).fill(accion)
    await form.getByRole('button', { name: 'Cerrar alerta' }).click()

    // Entonces la alerta queda atendida con su acción tomada, quién la atendió y el historial
    await expect(page.getByText('Alerta cerrada: quedó registrada la acción tomada')).toBeVisible()
    const cerrada = (await leerDB(page)).alertas.find((a) => a.id === 'al-1')!
    expect(cerrada).toMatchObject({ estado: 'atendida', atendidaPor: CUENTAS.cuidador.id, notaAtencion: accion })
    expect(cerrada.atendidaEn).toBeTruthy()
    expect(cerrada.acciones.at(-1)).toMatchObject({ usuarioId: CUENTAS.cuidador.id, estado: 'atendida', nota: accion })
    await expect(page.getByRole('list', { name: 'Estado de la alerta' }).locator('[aria-current="step"]')).toContainText('Atendida')
    await expect(page.getByText('Esta alerta ya está cerrada.')).toBeVisible()
    await expect(page.getByRole('form', { name: 'Cerrar alerta' })).toHaveCount(0)
    await expect(page.getByRole('definition').filter({ hasText: accion })).toBeVisible() // fila «Acción tomada»
    await expect(page.getByRole('definition').filter({ hasText: /Carlos Ruiz/ })).toBeVisible() // fila «Atendida por»

    // Y deja de aparecer entre las alertas abiertas de la bandeja
    await page.goto('/cuidador/alertas')
    await expect(page.getByRole('list', { name: 'Alertas' }).getByRole('link').filter({ hasText: 'Elena Rodríguez' })).toHaveCount(0)
  })

  test('Escenario: El cuidador no puede dejar una alerta "en atención" (solo cerrarla)', async ({ page }) => {
    // Dado que Carlos Ruiz (cuidador, alertas:cerrar sin alertas:gestionar) abre la alerta pendiente de su adulto asignado
    await sesionDirecta(page, CUENTAS.cuidador.id, '/cuidador/alertas/al-1')
    await expect(page.getByRole('heading', { name: 'Elena Rodríguez' })).toBeVisible()

    // Entonces la pantalla no le ofrece pasarla a «En atención» ni registrar avances (esas opciones son del coordinador)
    await expect(page.getByRole('form', { name: 'Cerrar alerta' })).toBeVisible()
    await expect(page.getByRole('form', { name: 'Gestionar alerta' })).toHaveCount(0)
    await expect(page.getByRole('radiogroup', { name: '¿Qué quieres hacer?' })).toHaveCount(0)
    await expect(page.getByRole('radio', { name: 'Poner en atención' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Poner en atención' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Registrar avance' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Resolver alerta' })).toHaveCount(0)
    expect((await leerDB(page)).alertas.find((a) => a.id === 'al-1')).toMatchObject({ estado: 'pendiente' })

    // Y la capa de servicios tampoco lo permite: gestionarAlerta rechaza «en atención» para el cuidador (RF-09: ocultar el botón no es el control)
    const resultado = await page.evaluate(async () => {
      const { gestionarAlerta } = await import('/src/domain/api/alertas.ts')
      const db = JSON.parse(localStorage.getItem('cuidared:db') ?? 'null')
      const actor = db.usuarios.find((u: { id: string }) => u.id === 'u-cuid')
      return gestionarAlerta(actor, 'al-1', 'en_atencion', 'Intento de dejarla en atención.')
    })
    expect(resultado).toMatchObject({ ok: false, error: 'Puedes cerrar la alerta registrando la acción tomada.' })
    expect((await leerDB(page)).alertas.find((a) => a.id === 'al-1')).toMatchObject({ estado: 'pendiente' })
    expect((await leerDB(page)).alertas.find((a) => a.id === 'al-1')!.acciones).toEqual([])

    // Y las alertas de adultos que no tiene asignados ni siquiera se encuentran (alcance por vínculo)
    await page.goto('/cuidador/alertas/al-5')
    await expect(page.getByRole('form')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'María García' })).toHaveCount(0)
  })
})
