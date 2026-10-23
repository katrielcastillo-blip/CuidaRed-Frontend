/*
 * e2e-cu02-perfil-create.spec.ts — Suite E2E-CU02-PERFIL-CREATE: escenarios Gherkin de CU-02 (SRS §16.1).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Formulario de perfil en tres pasos (modelo V3.0): 1 · Identificación; 2 · Ubicación (provincia → municipio,
 * sector y dirección) y contacto de emergencia principal (Contacto_emergencia); 3 · Condición, nivel de
 * riesgo social + motivo (Env_Riesgo) y consentimiento informado.
 */
import { expect, test, type Page } from '@playwright/test'
import type { Riesgo } from '../../src/domain/types'
import { contactoPrincipal, CUENTAS, iniciarSesion, leerDB, limpiarDatos, sesionDirecta } from './fixtures'

const NUEVO = { nombre: 'Mercedes', apellido: 'Paulino', cedula: '001-4567890-1', telefono: '809 555 1234', nacimiento: '1950-03-15' }
const UBICACION = { provincia: 'Santo Domingo', municipio: 'Santo Domingo Este', sector: 'Los Mina', direccion: 'Calle Respaldo 5 #20' }
const CONTACTO = { nombres: 'Pedro', apellidos: 'Paulino', parentesco: 'Hijo/a', telefono: '829 555 4321' }
const MOTIVO = 'Vive sola y necesita ayuda parcial.'

/** Paso 1 · Identificación. */
async function llenarIdentificacion(page: Page) {
  await page.getByRole('textbox', { name: /^Nombre/ }).fill(NUEVO.nombre)
  await page.getByRole('textbox', { name: /^Apellido/ }).fill(NUEVO.apellido)
  await page.getByRole('textbox', { name: /^Cédula/ }).fill(NUEVO.cedula)
  await page.getByRole('textbox', { name: /^Teléfono/ }).fill(NUEVO.telefono)
  await page.getByLabel(/^Fecha de nacimiento/).fill(NUEVO.nacimiento)
  await page.getByRole('radio', { name: 'Femenino' }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Paso 2 de 3 · Ubicación y contacto')).toBeVisible()
}

/** Paso 2 · Ubicación (provincia → municipio, sector, dirección) y contacto de emergencia principal. */
async function llenarUbicacionYContacto(page: Page) {
  await page.getByRole('combobox', { name: /^Provincia/ }).selectOption({ label: UBICACION.provincia })
  await page.getByRole('combobox', { name: /^Municipio/ }).selectOption({ label: UBICACION.municipio })
  await page.getByRole('combobox', { name: /^Sector o barrio/ }).fill(UBICACION.sector)
  await page.getByRole('textbox', { name: /^Dirección/ }).fill(UBICACION.direccion)
  await page.getByRole('textbox', { name: /^Nombres/ }).fill(CONTACTO.nombres)
  await page.getByRole('textbox', { name: /^Apellidos/ }).fill(CONTACTO.apellidos)
  await page.getByRole('combobox', { name: /^Parentesco/ }).selectOption({ label: CONTACTO.parentesco })
  await page.getByRole('textbox', { name: /^Teléfono/ }).fill(CONTACTO.telefono)
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Paso 3 de 3 · Condición y riesgo')).toBeVisible()
}

/** Paso 3 · Condición, riesgo social (+ motivo) y consentimiento (sin enviar). */
async function llenarCondicion(page: Page, riesgo: Riesgo) {
  await page.getByRole('combobox', { name: /Grado de autonomía/ }).selectOption({ label: 'Necesita ayuda parcial' })
  await page.getByText('Vive solo/a', { exact: true }).click()
  await page.getByRole('radio', { name: `Riesgo ${riesgo}` }).click()
  await page.getByRole('textbox', { name: /^Motivo del nivel de riesgo/ }).fill(MOTIVO)
  await page.getByRole('checkbox', { name: /Se informó y se obtuvo la autorización/ }).check()
}

test.describe('E2E-CU02-PERFIL-CREATE · Registrar perfil de adulto mayor', () => {
  test.beforeEach(async ({ page }) => {
    await limpiarDatos(page)
  })

  test('Escenario: Registrar correctamente un adulto mayor', async ({ page }) => {
    // Dado que el usuario está autenticado con rol de Coordinador
    await iniciarSesion(page, 'coordinador')
    // Y se encuentra en el formulario de registro de adulto mayor
    await page.goto('/coordinador/adultos')
    await page.getByRole('link', { name: 'Nuevo perfil' }).filter({ visible: true }).click()
    await expect(page.getByRole('heading', { name: 'Registrar adulto mayor' })).toBeVisible()
    // Cuando completa todos los campos obligatorios
    await llenarIdentificacion(page)
    await llenarUbicacionYContacto(page)
    // Y asigna un nivel de riesgo social
    await llenarCondicion(page, 'medio')
    // Y confirma el registro
    await page.getByRole('button', { name: 'Registrar' }).click()

    // Entonces el sistema debe crear el perfil del adulto mayor
    await expect(page.getByText('Perfil registrado correctamente')).toBeVisible()
    const db = await leerDB(page)
    const a = db.adultos.find((x) => x.cedula === NUEVO.cedula)
    const municipio = db.catalogos.municipios.find((m) => m.nombre === UBICACION.municipio)!
    expect(a).toMatchObject({
      nombre: NUEVO.nombre,
      apellido: NUEVO.apellido,
      fechaNacimiento: NUEVO.nacimiento,
      sexo: 'Femenino',
      telefono: NUEVO.telefono,
      municipioCod: municipio.cod,
      zona: UBICACION.sector,
      direccion: UBICACION.direccion,
      riesgo: 'medio',
      estado: 'activo',
      registradoPor: CUENTAS.coordinador.id,
      condicionGeneral: { autonomia: 'parcial', condiciones: ['vive_solo'] },
    })
    expect(a?.consentimiento?.otorgado).toBe(true)
    // (contacto de emergencia principal en Contacto_emergencia y clasificación de riesgo en Env_Riesgo)
    expect(contactoPrincipal(db, a!.id)).toMatchObject(CONTACTO)
    expect(db.riesgos.filter((r) => r.adultoId === a!.id && r.estado === 'vigente')).toEqual([
      expect.objectContaining({ riesgoId: 'r-social', nivel: 'medio', motivo: MOTIVO, registradoPor: CUENTAS.coordinador.id }),
    ])
    // Y debe mostrar el perfil como registrado correctamente (vuelve al listado con el nuevo resaltado)
    await page.waitForURL('**/coordinador/adultos')
    const tarjeta = page.getByRole('listitem').filter({ hasText: `${NUEVO.nombre} ${NUEVO.apellido}` })
    await expect(tarjeta).toBeVisible()
    await expect(tarjeta).toContainText('Nuevo')
  })

  test('Escenario: Intentar registrar un perfil sin completar campos obligatorios', async ({ page }) => {
    // Dado que el usuario está en el formulario de registro
    await sesionDirecta(page, CUENTAS.coordinador.id, '/coordinador/adultos/nuevo')
    const antes = (await leerDB(page)).adultos.length
    // Cuando intenta guardar el perfil sin completar uno o más campos obligatorios
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // Entonces el sistema debe impedir el registro
    await expect(page.getByText('Paso 1 de 3 · Identificación')).toBeVisible()
    // Y debe indicar los campos que deben ser completados
    for (const msg of ['Escribe el nombre.', 'Escribe el apellido.', 'Escribe la cédula.', 'Indica la fecha de nacimiento.', 'Selecciona el sexo.']) {
      await expect(page.getByRole('alert').filter({ hasText: msg })).toBeVisible()
    }
    await expect(page.getByRole('textbox', { name: /^Nombre/ })).toHaveAttribute('aria-invalid', 'true')

    // (en el paso 2 tampoco deja avanzar sin la ubicación ni el contacto de emergencia principal)
    await llenarIdentificacion(page)
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(page.getByText('Paso 2 de 3 · Ubicación y contacto')).toBeVisible()
    for (const msg of ['Indica el sector o barrio.', 'Escribe el nombre del contacto.', 'Escribe el apellido del contacto.', 'Selecciona el parentesco.', 'Escribe el teléfono.']) {
      await expect(page.getByRole('alert').filter({ hasText: msg })).toBeVisible()
    }
    await expect(page.getByRole('combobox', { name: /^Sector o barrio/ })).toHaveAttribute('aria-invalid', 'true')

    // (en el paso 3 tampoco deja registrar sin los obligatorios y conserva lo ya escrito)
    await llenarUbicacionYContacto(page)
    await page.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByText('Paso 3 de 3 · Condición y riesgo')).toBeVisible()
    for (const msg of ['Selecciona el grado de autonomía.', 'Asigna el nivel de riesgo social.', 'Confirma que se obtuvo el consentimiento informado.']) {
      await expect(page.getByRole('alert').filter({ hasText: msg })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Atrás' }).click()
    await expect(page.getByRole('combobox', { name: /^Sector o barrio/ })).toHaveValue(UBICACION.sector)
    await expect(page.getByRole('textbox', { name: /^Nombres/ })).toHaveValue(CONTACTO.nombres)
    await page.getByRole('button', { name: 'Atrás' }).click()
    await expect(page.getByRole('textbox', { name: /^Nombre/ })).toHaveValue(NUEVO.nombre)
    expect((await leerDB(page)).adultos.length).toBe(antes)
  })

  test('Escenario: Registrar un adulto mayor con nivel de riesgo', async ({ page }) => {
    // Dado que el usuario (Administrador) ha completado los datos obligatorios del adulto mayor
    await sesionDirecta(page, CUENTAS.admin.id, '/admin/adultos/nuevo')
    await llenarIdentificacion(page)
    await llenarUbicacionYContacto(page)
    // Cuando selecciona un nivel de riesgo social
    await llenarCondicion(page, 'alto')
    await expect(page.getByRole('radio', { name: 'Riesgo alto' })).toHaveAttribute('aria-checked', 'true')
    // Y confirma el registro
    await page.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByText('Perfil registrado correctamente')).toBeVisible()

    // Entonces el sistema debe asociar el nivel de riesgo seleccionado al perfil
    const db = await leerDB(page)
    const a = db.adultos.find((x) => x.cedula === NUEVO.cedula)!
    expect(a.riesgo).toBe('alto')
    expect(db.riesgos.find((r) => r.adultoId === a.id && r.estado === 'vigente')).toMatchObject({ riesgoId: 'r-social', nivel: 'alto', motivo: MOTIVO })
    // (y, por RF-04, genera la alerta de caso prioritario)
    expect(db.alertas.some((al) => al.adultoId === a.id && al.tipo === 'prioritaria' && al.severidad === 'alta')).toBe(true)

    // Y debe permitir consultar posteriormente dicha clasificación
    await page.waitForURL('**/admin/adultos')
    await page.getByRole('combobox', { name: 'Riesgo' }).selectOption({ label: 'Alto' })
    await page.getByRole('link', { name: new RegExp(`${NUEVO.nombre} ${NUEVO.apellido}`) }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/adultos/${a.id}$`))
    await expect(page.getByRole('region', { name: 'Resumen del adulto mayor' })).toContainText('Riesgo ALTO')
  })
})
