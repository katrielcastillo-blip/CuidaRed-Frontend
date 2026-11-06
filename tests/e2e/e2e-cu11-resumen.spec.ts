/*
 * e2e-cu11-resumen.spec.ts — Suite E2E-CU11-RESUMEN: escenarios Gherkin de CU-11 (SRS §16.6).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reglas de Negocio V2: el resumen (ruta `resumen`, «Resumen de seguimiento») lista SOLO los adultos activos de la
 * cuenta activa del usuario (Fundación Esperanza org-1: 7 adultos; Familia Méndez org-fam: 2), por lo que los
 * esperados se calculan filtrando por `orgId` con leerDB. Ordena por prioridad (por defecto), estado de atención,
 * fecha de la última visita REALIZADA (estado «completada») y nivel de riesgo, en ambos sentidos, y cuenta el
 * personal asignado = cuidadores + voluntarios con cuenta activa. Las alertas siguen el flujo pendiente → en atención
 * → atendida, con la acción tomada obligatoria para resolver (DFP6-04). Las pruebas omiten el onboarding de un solo uso.
 */
import { expect, test, type Page } from '@playwright/test'
import { CUENTA_FAMILIA, CUENTAS, editarDB, iniciarSesion, leerDB, limpiarDatos, sesionDirecta, visibles, visitaCompletada } from './fixtures'
import type { Adulto, DB } from '../../src/domain/types'

const PESO_PRIORIDAD: Record<string, number> = { 'Prioridad Alta': 0, 'Prioridad Media': 1, 'Prioridad Baja': 2 }
const ORDEN_ESTADOS = ['Alerta pendiente', 'En atención', 'Visita vencida', 'Necesidades pendientes', 'Al día']

/** Marca como vista la guía de onboarding de todos los usuarios y roles demo (clave `cuidared:onboarding:<userId>:<rol>`). */
async function omitirOnboarding(page: Page) {
  await page.evaluate(() => {
    const ids = ['u-admin', 'u-coord', 'u-cuid', 'u-vol', 'u-fam', 'u-giselle', 'u-ctorres', 'u-eduardo', 'u-fcoord']
    const roles = ['admin', 'coordinador', 'cuidador', 'voluntario', 'familiar']
    for (const id of ids) for (const rol of roles) localStorage.setItem(`cuidared:onboarding:${id}:${rol}`, new Date().toISOString())
  })
}

/** Casos que se ven en pantalla (tarjetas en móvil, tabla en escritorio). */
const casos = (page: Page) => visibles(page.getByTestId('caso-resumen'))

async function columna(page: Page, testId: 'prioridad-caso' | 'estado-atencion') {
  return (await casos(page).getByTestId(testId).allTextContents()).map((t) => t.trim())
}

const noDecreciente = (xs: number[]) => xs.every((x, i) => i === 0 || xs[i - 1]! <= x)

const nombreCompleto = (a: Adulto) => `${a.nombre} ${a.apellido}`

/** Adultos activos (no anonimizados) de la cuenta del usuario: los que muestra el resumen. */
function casosActivosDe(db: DB, usuarioId: string) {
  const orgId = db.usuarios.find((u) => u.id === usuarioId)!.orgId
  return db.adultos.filter((a) => a.orgId === orgId && a.estado === 'activo' && !a.anonimizado)
}

/** Nombres de los casos en el orden en que se ven en pantalla. */
async function nombresEnPantalla(page: Page, adultos: Adulto[]) {
  const textos = await casos(page).evaluateAll((els) => els.map((e) => e.textContent ?? ''))
  return textos.map((t) => adultos.find((a) => t.includes(nombreCompleto(a)))!)
}

/** Instante de la última visita REALIZADA (completada) del adulto, incluidas las compartidas del hogar; null si nunca fue visitado. */
function ultimaRealizada(db: DB, adultoId: string): number | null {
  const t = db.visitas
    .filter((v) => v.estado === 'completada' && [v.adultoId, ...v.detallesAdicionales.map((d) => d.adultoId)].includes(adultoId))
    .map((v) => Date.parse(v.fin ?? v.fecha))
  return t.length ? Math.max(...t) : null
}

test.describe('E2E-CU11-RESUMEN · Consultar módulo de resumen', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
    await omitirOnboarding(page)
  })

  test('Escenario: Visualizar casos activos', async ({ page }) => {
    // Dado que existen casos activos registrados en CuidaRed (en la cuenta del usuario: Fundación Esperanza, 7 adultos)
    const db = await leerDB(page)
    const activos = casosActivosDe(db, CUENTAS.admin.id)
    expect(activos).toHaveLength(7)
    expect(db.adultos.length).toBeGreaterThan(activos.length) // hay adultos de otra cuenta (Familia Méndez) que no se mezclan
    // Y el usuario está autenticado como Administrador
    await iniciarSesion(page, 'admin')
    // Cuando accede al módulo de resumen
    await page.goto('/admin/resumen')
    await expect(page.getByRole('heading', { name: 'Resumen de seguimiento' })).toBeVisible()

    // Entonces el sistema debe mostrar los casos activos
    await expect(casos(page)).toHaveCount(activos.length)
    await expect(page.getByText(`${activos.length} casos activos`)).toBeVisible()
    for (const a of activos) await expect(casos(page).filter({ hasText: nombreCompleto(a) })).toHaveCount(1)
    // Y debe mostrar su estado y prioridad
    expect(await columna(page, 'prioridad-caso')).toHaveLength(activos.length)
    expect(await columna(page, 'estado-atencion')).toHaveLength(activos.length)
    for (const p of await columna(page, 'prioridad-caso')) expect(Object.keys(PESO_PRIORIDAD)).toContain(p)
    for (const e of await columna(page, 'estado-atencion')) expect(ORDEN_ESTADOS).toContain(e)
  })

  test('Escenario: El resumen muestra solo los casos de la cuenta activa', async ({ page }) => {
    // Dado que la cuenta Familia Méndez tiene 2 adultos activos y la Fundación Esperanza otros 7
    const db = await leerDB(page)
    const familia = casosActivosDe(db, CUENTA_FAMILIA.id)
    const fundacion = casosActivosDe(db, CUENTAS.coordinador.id)
    expect(familia.map((a) => a.id).sort()).toEqual(['a-ramon', 'a-rosa'])
    expect(fundacion).toHaveLength(7)

    // Cuando la coordinadora de la cuenta Familia consulta el resumen
    await sesionDirecta(page, CUENTA_FAMILIA.id, '/coordinador/resumen')
    await expect(page.getByRole('heading', { name: 'Resumen de seguimiento' })).toBeVisible()

    // Entonces solo ve los casos de su cuenta, con su personal asignado (el cuidador de la familia)
    await expect(casos(page)).toHaveCount(familia.length)
    await expect(page.getByText(`${familia.length} casos activos`)).toBeVisible()
    for (const a of familia) await expect(casos(page).filter({ hasText: nombreCompleto(a) })).toHaveCount(1)
    for (const a of fundacion) await expect(casos(page).filter({ hasText: nombreCompleto(a) })).toHaveCount(0)
    for (const c of await casos(page).all()) await expect(c.getByTestId('personal-asignado')).toHaveAttribute('data-personal', '1')

    // Y al cambiar a la Fundación, la coordinadora de esa cuenta ve sus 7 casos y ninguno de la familia
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/resumen')
    await expect(casos(page)).toHaveCount(fundacion.length)
    for (const a of familia) await expect(casos(page).filter({ hasText: nombreCompleto(a) })).toHaveCount(0)
  })

  test('Escenario: Ordenar casos por prioridad', async ({ page }) => {
    // Dado que existen varios casos activos con diferentes niveles de prioridad
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/resumen')
    await expect(casos(page).first()).toBeVisible()
    // Cuando el usuario selecciona ordenar por prioridad (primero cambia a otro criterio y vuelve)
    const orden = page.getByRole('combobox', { name: /Ordenar por/ })
    await orden.selectOption({ label: 'Nivel de riesgo' })
    await orden.selectOption({ label: 'Prioridad' })
    await expect(page.getByText(/ordenados por prioridad/)).toBeVisible()

    // Entonces el sistema debe mostrar los casos ordenados según el criterio seleccionado
    const pesos = (await columna(page, 'prioridad-caso')).map((p) => PESO_PRIORIDAD[p]!)
    expect(new Set(pesos).size).toBeGreaterThan(1)
    expect(noDecreciente(pesos)).toBe(true)

    // Y puede invertir el sentido (baja primero)
    await page.getByRole('button', { name: /Orden: alta primero/ }).click()
    await expect(page.getByText(/ordenados por prioridad \(baja primero\)/)).toBeVisible()
    const invertidos = (await columna(page, 'prioridad-caso')).map((p) => PESO_PRIORIDAD[p]!)
    expect(noDecreciente(invertidos.map((p) => -p))).toBe(true)
  })

  test('Escenario: Ordenar casos por estado', async ({ page }) => {
    // Dado que existen casos con diferentes estados de atención
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/resumen')
    await expect(casos(page).first()).toBeVisible()
    // Cuando el usuario selecciona ordenar por estado
    await page.getByRole('combobox', { name: /Ordenar por/ }).selectOption({ label: 'Estado de atención' })
    await expect(page.getByText(/ordenados por estado de atención/)).toBeVisible()

    // Entonces el sistema debe mostrar los casos ordenados según su estado
    const pesos = (await columna(page, 'estado-atencion')).map((e) => ORDEN_ESTADOS.indexOf(e))
    expect(pesos.every((p) => p >= 0)).toBe(true)
    expect(new Set(pesos).size).toBeGreaterThan(1)
    expect(noDecreciente(pesos)).toBe(true)

    // Y también puede agruparlos por estado de atención
    await page.getByRole('switch', { name: /Agrupar por estado de atención/ }).click()
    const grupos = (await page.locator('h2[id^="grupo-"]').getByTestId('estado-atencion').allTextContents()).map((t) => ORDEN_ESTADOS.indexOf(t.trim()))
    expect(grupos.length).toBeGreaterThan(1)
    expect(noDecreciente(grupos)).toBe(true)
  })

  test('Escenario: Ordenar casos por la fecha de la última visita realizada', async ({ page }) => {
    // Dado que cada caso tiene su última visita REALIZADA, y que el caso de visita más antigua tiene además visitas
    // programadas (pendientes) recientes, que no cuentan como contacto
    const db = await leerDB(page)
    const activos = casosActivosDe(db, CUENTAS.coordinador.id)
    const antiguo = [...activos].sort((x, y) => (ultimaRealizada(db, x.id) ?? 0) - (ultimaRealizada(db, y.id) ?? 0))[0]!
    expect(ultimaRealizada(db, antiguo.id)).not.toBeNull()
    await editarDB(
      page,
      (d, v) => {
        delete v.inicio
        delete v.fin
        v.estado = 'pendiente'
        delete v.estadoAdulto
        d.visitas.push(v)
      },
      visitaCompletada({ id: 'v-e2e-programada', adultoId: antiguo.id, cuidadorId: 'u-cuid', fecha: new Date().toISOString().slice(0, 10), instante: new Date().toISOString(), horaPautada: '16:00' }),
    )
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/resumen')
    await expect(casos(page).first()).toBeVisible()

    // Cuando el usuario ordena por fecha de última visita
    await page.getByRole('combobox', { name: /Ordenar por/ }).selectOption({ label: 'Fecha de última visita' })
    await expect(page.getByText(/ordenados por fecha de última visita \(más antigua primero\)/)).toBeVisible()

    // Entonces los casos quedan de la visita realizada más antigua a la más reciente (la visita pendiente no cuenta)
    const antes = await nombresEnPantalla(page, activos)
    expect(antes).toHaveLength(activos.length)
    expect(antes[0]!.id).toBe(antiguo.id)
    const instantes = antes.map((a) => ultimaRealizada(db, a.id) ?? 0)
    expect(instantes.every((t, i) => i === 0 || instantes[i - 1]! <= t)).toBe(true)

    // Y al invertir el sentido (más reciente primero) el orden se invierte
    await page.getByRole('button', { name: /Orden: más antigua primero/ }).click()
    await expect(page.getByText(/ordenados por fecha de última visita \(más reciente primero\)/)).toBeVisible()
    const despues = await nombresEnPantalla(page, activos)
    expect(despues.map((a) => a.id)).toEqual(antes.map((a) => a.id).reverse())
  })

  test('Escenario: Mostrar el personal asignado (cuidadores y voluntarios) y filtrar por él', async ({ page }) => {
    // Dado que cada adulto tiene vínculos de cuidador_asignado y/o voluntario_asignado con usuarios activos
    const db = await leerDB(page)
    const activos = casosActivosDe(db, CUENTAS.coordinador.id)
    const activosIds = new Set(db.usuarios.filter((u) => u.estado === 'activo').map((u) => u.id))
    const asignados = (id: string) => db.vinculos.filter((v) => v.adultoId === id && (v.tipoVinculoId === 'cuidador_asignado' || v.tipoVinculoId === 'voluntario_asignado') && activosIds.has(v.usuarioId))
    const sinPersonal = activos.filter((a) => asignados(a.id).length === 0)
    expect(sinPersonal.map((a) => a.id)).toEqual(['a-estefan'])
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/resumen')
    await expect(casos(page).first()).toBeVisible()

    // Entonces cada caso muestra cuántas personas tiene asignadas (cuidadores + voluntarios)
    for (const a of activos) {
      await expect(casos(page).filter({ hasText: nombreCompleto(a) }).getByTestId('personal-asignado')).toHaveAttribute('data-personal', String(asignados(a.id).length))
    }
    // (Elena: 2 cuidadores · José Martínez: 1 voluntario · Estefan: nadie)
    const detalle = (nombre: string) => casos(page).filter({ hasText: nombre }).getByTestId('personal-asignado')
    await expect(detalle('Elena Rodríguez')).toContainText('2')
    await expect(detalle('José Martínez')).toHaveAttribute('data-personal', '1')
    await expect(detalle('Estefan Durán')).toContainText('Sin personal asignado')

    // Y puede filtrar los casos que no tienen a nadie asignado
    await page.getByRole('combobox', { name: 'Asignado a' }).selectOption({ label: 'Sin personal asignado' })
    await expect(casos(page)).toHaveCount(sinPersonal.length)
    await expect(casos(page).first()).toContainText('Estefan Durán')
    await expect(page.getByText(/1 de 7 casos activos/)).toBeVisible()
  })

  test('Escenario: Actualización del resumen', async ({ page }) => {
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/resumen')
    const elena = casos(page).filter({ hasText: 'Elena Rodríguez' })
    await expect(elena.getByTestId('estado-atencion')).toHaveText('Alerta pendiente')

    // Dado que un caso cambia de estado (el coordinador empieza a atender su alerta de emergencia)
    await page.goto('/coordinador/alertas/al-1')
    await page.getByRole('radio', { name: 'Poner en atención' }).click()
    await page.getByRole('textbox', { name: /Nota del avance/ }).fill('Se llamó a la familia y se coordinó la visita médica.')
    await page.getByRole('button', { name: 'Poner en atención' }).click()
    await expect(page.getByText('Alerta marcada como "En atención"')).toBeVisible()

    // Cuando el usuario consulta nuevamente el módulo de resumen
    await page.goto('/coordinador/resumen')
    // Entonces el sistema debe mostrar el nuevo estado del caso
    await expect(elena.getByTestId('estado-atencion')).toHaveText('En atención')

    // Y al resolver la alerta (la acción tomada es obligatoria, DFP6-04) el caso deja de tener alertas abiertas
    await page.goto('/coordinador/alertas/al-1')
    await page.getByRole('radio', { name: 'Resolver' }).click()
    await page.getByRole('button', { name: 'Resolver alerta' }).click()
    await expect(page.getByText('Describe la acción tomada (mínimo 5 caracteres).')).toBeVisible()
    expect((await leerDB(page)).alertas.find((a) => a.id === 'al-1')).toMatchObject({ estado: 'en_atencion' })
    await page.getByRole('textbox', { name: /Acción tomada/ }).fill('La familia confirmó que ya recibió atención médica.')
    await page.getByRole('button', { name: 'Resolver alerta' }).click()
    await expect(page.getByText('Alerta cerrada: quedó registrada la acción tomada')).toBeVisible()
    await page.goto('/coordinador/resumen')
    await expect(elena.getByTestId('estado-atencion')).toHaveText('Necesidades pendientes') // sin alertas abiertas; queda su necesidad n-1
  })
})
