/*
 * Informe médico por adulto en el expediente conectado (fase 7): permiso `informe:exportar`, secciones omitidas, PDF y errores · ID07.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { cuentaActiva, iniciarSesion, simular, type CuentaSim } from './ayudas-fase2'
import { hoyRD, juanaId, montarReportes, ruta, type OpcionesReportes } from './ayudas-reportes'

const SENSIBLES = ['adultos:ver', 'adultos:ver-sensible', 'indicaciones:ver', 'visitas:ver']
type Rol = { nombre: string; tipo: 'familia' | 'organizacion'; rol: string; permisos: string[]; informe: boolean }
const ROLES: Rol[] = [
  { nombre: 'Coordinador de una Familia', tipo: 'familia', rol: 'coordinador', permisos: [...SENSIBLES, 'informe:exportar'], informe: true },
  { nombre: 'Coordinador de una Organización', tipo: 'organizacion', rol: 'coordinador', permisos: [...SENSIBLES, 'informe:exportar'], informe: true },
  { nombre: 'Cuidador', tipo: 'organizacion', rol: 'cuidador', permisos: [...SENSIBLES, 'informe:exportar'], informe: true },
  { nombre: 'Administrador de una Organización', tipo: 'organizacion', rol: 'administrador', permisos: [...SENSIBLES, 'resumen:ver', 'reportes:ver'], informe: false },
  { nombre: 'Familiar', tipo: 'familia', rol: 'familiar', permisos: ['adultos:ver', 'necesidades:ver'], informe: false },
  { nombre: 'Voluntario', tipo: 'organizacion', rol: 'voluntario', permisos: ['adultos:ver', 'visitas:ver'], informe: false },
]

const cuentaDe = (datos: Partial<CuentaSim> = {}) =>
  cuentaActiva({ cuenta_id: '9007199254740993', nombre: 'Fundación Esperanza', tipo: 'organizacion', rol: 'coordinador', permisos: [...SENSIBLES, 'informe:exportar'], funcionalidades: [], ...datos })

/** Rediseño: el informe es una pantalla propia que se abre desde «Más acciones» → «Informe PDF». */
async function abrirInforme(page: Page) {
  await page.getByRole('button', { name: 'Más acciones' }).click()
  await page.getByRole('dialog', { name: 'Más acciones' }).getByRole('button', { name: 'Informe PDF' }).click()
}

async function abrirExpediente(page: Page, cuenta: CuentaSim, opciones: OpcionesReportes = {}, abrir = true) {
  const sim = await simular(page, { cuentas: [cuenta] })
  const api = await montarReportes(page, cuenta, opciones)
  await iniciarSesion(page, sim.correo)
  await page.goto(`${ruta}/envejecientes?adulto=${juanaId}`)
  await expect(page.getByRole('heading', { level: 2, name: 'Juana Pérez Díaz' })).toBeVisible()
  if (abrir) await abrirInforme(page)
  return api
}

for (const caso of ROLES) {
  test(`el ${caso.nombre} ${caso.informe ? 'puede' : 'no puede'} generar el informe médico`, async ({ page }) => {
    const { de } = await abrirExpediente(page, cuentaDe({ tipo: caso.tipo, rol: caso.rol, permisos: caso.permisos }), {}, false)
    // Sin el permiso no existe ni la acción «Informe PDF» ni el botón para generarlo.
    await page.getByRole('button', { name: 'Más acciones' }).click()
    await expect(page.getByRole('dialog', { name: 'Más acciones' }).getByRole('button', { name: 'Informe PDF' })).toHaveCount(caso.informe ? 1 : 0)
    if (caso.informe) await page.getByRole('dialog', { name: 'Más acciones' }).getByRole('button', { name: 'Informe PDF' }).click()
    const boton = page.getByRole('button', { name: 'Generar informe médico' })
    await expect(boton).toHaveCount(caso.informe ? 1 : 0)
    if (caso.informe) await expect(boton).toBeEnabled()
    // Hasta que la persona lo pide no se consulta (cada consulta queda auditada).
    expect(de(/informe-medico$/)).toHaveLength(0)
  })
}

test('el informe muestra identificación, indicaciones, riesgo, visitas, aviso, quién y cuándo lo generó', async ({ page }) => {
  const { de } = await abrirExpediente(page, cuentaDe())
  await page.getByRole('button', { name: 'Generar informe médico' }).click()
  const informe = page.getByLabel('Informe médico generado')
  await expect(informe.getByRole('heading', { level: 3, name: 'Informe médico de Juana Pérez Díaz' })).toBeVisible()
  await expect(informe).toContainText('Laura Mejía (Coordinador) · Fundación Esperanza')
  await expect(informe).toContainText('Constancia: 9a3c5e10-2b4f-4c6d-8e1a-7f0b9c2d3e41')
  await expect(informe.getByTestId('secciones-omitidas')).toHaveCount(0)

  const identificacion = informe.getByRole('region', { name: '1. Datos de identificación' })
  await expect(identificacion).toContainText('00112345678')
  await expect(identificacion).toContainText('12/03/1944 (82 años)')
  await expect(identificacion).toContainText('Santo Domingo de Guzmán, Distrito Nacional')
  await expect(identificacion).toContainText('Activo')

  const indicaciones = informe.getByRole('region', { name: '2. Indicaciones médicas vigentes' })
  await expect(indicaciones).toContainText('Losartán 50 mg')
  await expect(indicaciones).toContainText('Una tableta en la mañana.')
  await expect(indicaciones).toContainText('Registrada por Ana Gómez')
  await expect(indicaciones).toContainText('No se incluyen 2 indicaciones fuera de vigencia.')

  // El código del factor y del nivel puede ser null en filas heredadas: se muestra su nombre.
  const riesgo = informe.getByRole('region', { name: '3. Riesgo vigente e historial' })
  await expect(riesgo).toContainText('Riesgo de caída · Alto')
  await expect(riesgo).toContainText('Caída reciente en el baño')
  await expect(riesgo.getByRole('table')).toContainText('Riesgo de caída')

  const visitas = informe.getByRole('region', { name: '4. Visitas recientes' })
  await expect(visitas).toContainText('Refiere mareos por la mañana.')
  await expect(visitas).toContainText('Requiere atención')
  await expect(visitas).toContainText('7 visitas realizadas en total')

  await expect(informe).toContainText('CuidaRed no diagnostica ni sustituye al médico tratante.')
  expect(de(/informe-medico$/)).toHaveLength(1)
})

test('Familia: el informe muestra qué secciones omitió el servidor y por qué', async ({ page }) => {
  await abrirExpediente(page, cuentaDe({ tipo: 'familia' }), { omitidas: ['visitas'] })
  await page.getByRole('button', { name: 'Generar informe médico' }).click()
  const informe = page.getByLabel('Informe médico generado')
  await expect(informe.getByTestId('secciones-omitidas')).toHaveText('Secciones omitidas según tus permisos: Visitas.')
  await expect(informe.getByRole('region', { name: '4. Visitas recientes' }).getByRole('note')).toHaveText('Las visitas no están disponibles para esta cuenta o para tu rol.')
  await expect(informe.getByRole('region', { name: '2. Indicaciones médicas vigentes' })).toContainText('Losartán 50 mg')
})

test('sin permisos sensibles se omiten indicaciones y riesgo y la identificación sigue siendo mínima', async ({ page }) => {
  await abrirExpediente(page, cuentaDe({ rol: 'cuidador', permisos: ['adultos:ver', 'visitas:ver', 'informe:exportar'] }), { omitidas: ['indicaciones', 'riesgo'] })
  await page.getByRole('button', { name: 'Generar informe médico' }).click()
  const informe = page.getByLabel('Informe médico generado')
  await expect(informe.getByTestId('secciones-omitidas')).toHaveText('Secciones omitidas según tus permisos: Indicaciones médicas, Riesgo.')
  await expect(informe.getByRole('region', { name: '2. Indicaciones médicas vigentes' }).getByRole('note')).toHaveText('Las indicaciones médicas no están disponibles para tu rol.')
  await expect(informe.getByRole('region', { name: '3. Riesgo vigente e historial' }).getByRole('note')).toHaveText('La información de riesgo no está disponible para tu rol.')
  await expect(informe.getByRole('region', { name: '1. Datos de identificación' })).toContainText('Juana Pérez Díaz')
  await expect(informe).not.toContainText('Losartán')
  await expect(informe).not.toContainText('Direcci')
  await expect(informe).not.toContainText('Teléfono')
})

test('el PDF se arma con los datos ya consultados, sin volver a consultar el servidor', async ({ page }) => {
  test.setTimeout(60_000)
  const { de, orden } = await abrirExpediente(page, cuentaDe())
  await page.getByRole('button', { name: 'Generar informe médico' }).click()
  await expect(page.getByLabel('Informe médico generado')).toBeVisible()
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 45_000 }), page.getByRole('button', { name: 'Descargar informe en PDF' }).click()])
  expect(descarga.suggestedFilename()).toBe(`informe-medico-perez-diaz-juana-${hoyRD()}.pdf`)
  expect(readFileSync((await descarga.path())!).subarray(0, 4).toString('latin1')).toBe('%PDF')
  expect(orden).toEqual(['descarga'])
  expect(de(/informe-medico$/)).toHaveLength(1)
  expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain('cuidared:db')
  await page.getByRole('button', { name: 'Cerrar informe' }).click()
  await expect(page.getByLabel('Informe médico generado')).toHaveCount(0)
})

for (const [estado, codigo, mensaje] of [
  [403, 'FORBIDDEN', 'No tienes permiso para generar el informe médico de este adulto mayor.'],
  [404, 'NOT_FOUND', 'No se encontró el expediente, o ya no está disponible para ti.'],
  [403, 'SUBSCRIPTION_INACTIVE', 'La cuenta no tiene una prueba o un plan vigente.'],
  [503, 'DEPENDENCY_UNAVAILABLE', 'No se pudo conectar con CuidaRed. Intenta de nuevo.'],
] as const) {
  test(`un error ${estado} ${codigo} al generar el informe se explica y no deja un informe a medias`, async ({ page }) => {
    await abrirExpediente(page, cuentaDe(), { errorInforme: { status: estado, code: codigo } })
    await page.getByRole('button', { name: 'Generar informe médico' }).click()
    await expect(page.getByRole('alert').filter({ hasText: mensaje })).toBeVisible()
    await expect(page.getByLabel('Informe médico generado')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Descargar informe en PDF' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Generar informe médico' })).toBeEnabled()
  })
}

test('sin conexión el informe está deshabilitado y explica por qué', async ({ page }) => {
  await abrirExpediente(page, cuentaDe())
  await page.context().setOffline(true)
  await expect(page.getByRole('button', { name: 'Generar informe médico' })).toBeDisabled()
  await expect(page.getByText('Sin conexión: el informe necesita Internet para quedar registrado en la auditoría.')).toBeVisible()
  await page.context().setOffline(false)
  await expect(page.getByRole('button', { name: 'Generar informe médico' })).toBeEnabled()
})

test('el informe no se desborda en pantallas estrechas', async ({ page }) => {
  await abrirExpediente(page, cuentaDe())
  await page.getByRole('button', { name: 'Generar informe médico' }).click()
  await expect(page.getByLabel('Informe médico generado')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
