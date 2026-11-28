/*
 * responsive-operacion.spec.ts — Los módulos operativos se ven y funcionan en teléfonos, tableta, portátil y escritorio ancho.
 * Para cada pantalla (con datos largos y muchas filas) recorre 320, 360, 390, 414, 768, 1024, 1280 y 1440 px y comprueba:
 * sin desborde horizontal de la página, tablas y contenido ancho con scroll propio, textos que no se salen de su caja,
 * controles táctiles de 44 px o más y campos de 16 px en pantallas táctiles, acciones principales dentro del ancho y el
 * final del contenido sin quedar bajo la barra inferior. Corre solo en el proyecto `desktop` (el ancho lo fija cada paso).
 * Las capturas (320, 768 y 1440) se guardan en `test-results/responsive-operacion/`, ignorado por git.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { ANCHOS, abrirOperacion, cuentaCompleta, esperarCarga, juanaId, recorrerAnchos, ruta, tareaId, visitaCursoId, visitaId, type OpcionesAuditoria, type OpcionesMontaje } from './ayudas-responsive'

test.beforeEach(({ browserName: _navegador }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'La matriz de anchos fija su propio viewport.')
  test.setTimeout(150_000)
})

/** Acumula los hallazgos de todos los pasos de una prueba y falla una sola vez, con el detalle completo. */
function auditor(page: Page, testInfo: TestInfo, prefijo: string) {
  const hallazgos: string[] = []
  return {
    async paso(nombre: string, opciones: OpcionesAuditoria = {}) {
      await esperarCarga(page)
      const encontrados = await recorrerAnchos(page, testInfo, `${prefijo}-${nombre}`, opciones)
      hallazgos.push(...encontrados.map((texto) => `{${nombre}} ${texto}`))
      await page.setViewportSize({ width: 1280, height: 900 })
    },
    verificar() {
      expect(hallazgos, `Problemas de diseño adaptable (${ANCHOS.join(', ')} px):\n${hallazgos.join('\n')}`).toEqual([])
    },
  }
}

async function recorrer(page: Page, testInfo: TestInfo, nombre: string, seccion: string, opciones: OpcionesMontaje = {}) {
  await abrirOperacion(page, seccion, opciones)
  return auditor(page, testInfo, nombre)
}

const boton = (page: Page, nombre: string | RegExp) => page.getByRole('button', { name: nombre })

/* ───────────── Inicio, Más y cuenta ───────────── */
test('Inicio: panel de gestión (Figma «Inicio v3») sin accesos ni bloques de cuenta', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'cuenta', 'cuenta')
  await expect(page.getByRole('region', { name: 'Resumen de hoy' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Accesos rápidos' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Datos de la cuenta' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Perfiles globales de cuidadores' })).toHaveCount(0)
  await a.paso('inicio')
  a.verificar()
})

test('Más opciones: accesos a todos los módulos', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'mas', 'mas')
  // Rediseño: /mas abre la hoja «Más» (diálogo) sobre Inicio.
  await expect(page.getByRole('dialog', { name: 'Más opciones' }).getByRole('heading', { level: 2, name: 'Más opciones' })).toBeVisible()
  await a.paso('mas')
  a.verificar()
})

test('Configuración: datos, preferencias, titularidad y perfiles de cuidadores', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'configuracion', 'configuracion')
  await expect(page.getByRole('heading', { name: 'Datos de la organización' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Perfiles globales de cuidadores' })).toBeVisible()
  await a.paso('datos')
  await page.getByRole('button', { name: 'Editar datos' }).click()
  await expect(page.getByRole('heading', { name: 'Datos de contacto institucional' })).toBeVisible()
  await a.paso('formulario')
  await page.getByRole('button', { name: 'Transferir titularidad' }).click()
  await a.paso('titularidad')
  a.verificar()
})

/* ───────────── Adultos mayores ───────────── */
test('Adultos: listado con 45 expedientes, búsqueda y retiros de consentimiento', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'adultos', 'envejecientes')
  const registrar = boton(page, 'Registrar adulto mayor')
  await expect(registrar).toBeVisible()
  await a.paso('lista', { visibles: [registrar, page.getByRole('group', { name: 'Estado del expediente' })] })
  await page.getByPlaceholder('Nombre o sector').fill('Ruizdelacruz')
  await a.paso('busqueda')
  await page.getByPlaceholder('Nombre o sector').fill('sin-coincidencia')
  await a.paso('sin-resultados')
  await page.getByPlaceholder('Nombre o sector').fill('')
  await boton(page, 'Retiros de consentimiento').click()
  await expect(page.getByRole('heading', { name: 'Retiros de consentimiento', level: 3 })).toBeVisible()
  await a.paso('retiros')
  a.verificar()
})

test('Adultos: alta en tres pasos', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'alta', 'envejecientes')
  await boton(page, 'Registrar adulto mayor').click()
  // El título «Registrar adulto mayor» está en la barra secundaria del marco.
  await expect(page.getByRole('heading', { name: 'Registrar adulto mayor' })).toBeVisible()
  await a.paso('paso1', { visibles: [boton(page, 'Continuar')] })
  await page.getByLabel(/^Nombres/).fill('María de los Ángeles Concepción')
  await page.getByLabel(/^Apellidos/).fill('Fernández de la Cruz Rodríguez')
  await page.getByLabel(/^Cédula del adulto/).fill('00112345679')
  await page.getByLabel(/^Fecha de nacimiento/).fill('1945-05-06')
  await page.getByRole('radio', { name: 'Femenino' }).check()
  await boton(page, 'Continuar').click()
  await expect(page.getByLabel(/^Provincia/)).toBeVisible()
  await a.paso('paso2', { visibles: [boton(page, 'Continuar')] })
  await page.getByLabel(/^Provincia/).selectOption('01')
  await page.getByLabel(/^Municipio/).selectOption('0101')
  await page.getByLabel(/^Sector o zona/).fill('Ensanche Luperón de la Zona Colonial Norte')
  await page.getByRole('radio', { name: 'Necesita ayuda parcial' }).check()
  await boton(page, 'Continuar').click()
  await expect(page.getByLabel(/^Nombres del contacto/)).toBeVisible()
  await page.getByRole('radio', { name: 'Su representante' }).check()
  await a.paso('paso3', { visibles: [boton(page, 'Registrar adulto mayor')] })
  a.verificar()
})

/** Rediseño: las acciones del expediente viven en la hoja «Más acciones»; cada una abre una pantalla con «Volver» en el marco. */
async function abrirAccion(page: Page, texto: string) {
  await boton(page, 'Más acciones').click()
  await page.getByRole('dialog', { name: 'Más acciones' }).getByRole('button', { name: texto, exact: true }).click()
}
const volverAlPerfil = (page: Page) => page.getByRole('link', { name: 'Volver', exact: true }).click()

test('Expediente: resumen, pestañas y datos largos', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'expediente', `envejecientes?adulto=${juanaId}`)
  await expect(page.getByRole('heading', { level: 2, name: /María de los Ángeles/ })).toBeVisible()
  await a.paso('resumen', { visibles: [boton(page, 'Más acciones')] })
  for (const [nombre, pestana] of [['historial', 'Historial'], ['necesidades', 'Necesidades'], ['riesgo', 'Riesgo']] as const) {
    await page.getByRole('tab', { name: pestana, exact: true }).click()
    await a.paso(nombre)
  }
  a.verificar()
})

test('Expediente: formularios de edición, evaluación y retiro del consentimiento', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'expediente-formularios', `envejecientes?adulto=${juanaId}`)
  await expect(boton(page, 'Más acciones')).toBeVisible()
  for (const [nombre, texto, visible] of [
    ['identificacion', 'Datos personales', (p: Page) => p.getByText('Editar identificación', { exact: true }).first()],
    ['ubicacion', 'Ubicación y cuidado', (p: Page) => p.getByText('Ubicación y cuidado', { exact: true }).first()],
    ['contactos', 'Contactos', (p: Page) => p.getByRole('region', { name: 'Contactos de emergencia' })],
    ['estado', 'Cambiar estado', (p: Page) => p.getByText('Cambiar estado del expediente', { exact: true }).first()],
    ['retiro', 'Registrar retiro del consentimiento', (p: Page) => p.getByText('Retirar consentimiento', { exact: true }).first()],
  ] as const) {
    await abrirAccion(page, texto)
    await expect(visible(page)).toBeVisible()
    await a.paso(nombre)
    await volverAlPerfil(page)
  }
  await abrirAccion(page, 'Evaluar riesgo')
  await expect(page.getByRole('heading', { name: 'Evaluación de riesgo (100 puntos)' })).toBeVisible()
  await a.paso('evaluacion', { visibles: [boton(page, 'Continuar')] })
  a.verificar()
})

test('Expediente: informe médico generado y formularios de indicaciones y asignación', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'expediente-informe', `envejecientes?adulto=${juanaId}`)
  await abrirAccion(page, 'Informe PDF')
  await boton(page, 'Generar informe médico').click()
  await expect(page.getByRole('heading', { name: /Informe médico de/ })).toBeVisible()
  await a.paso('informe', { visibles: [boton(page, 'Descargar informe en PDF')] })
  await volverAlPerfil(page)
  await abrirAccion(page, 'Cuidador')
  await expect(page.getByRole('radiogroup', { name: /^Cuidador o voluntario/ })).toBeVisible()
  await a.paso('asignar')
  await volverAlPerfil(page)
  await abrirAccion(page, 'Indicaciones')
  await boton(page, 'Registrar indicación').click()
  await expect(page.getByRole('heading', { name: 'Registrar indicación', level: 3 })).toBeVisible()
  await a.paso('indicacion-nueva')
  await volverAlPerfil(page)
  await boton(page, 'Ver adjuntos').first().click()
  await a.paso('adjuntos')
  a.verificar()
})

/* ───────────── Visitas ───────────── */
test('Visitas: resumen, pestañas de período y listado paginado', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'visitas', 'visitas')
  await expect(page.getByRole('heading', { name: 'Mis visitas', level: 2 })).toBeVisible()
  await a.paso('hoy', { visibles: [boton(page, 'Programar visita'), boton(page, 'Solicitudes externas'), boton(page, 'Calendario de visitas')] })
  await page.getByRole('tab', { name: 'Próximas' }).click()
  await a.paso('proximas')
  await page.getByRole('tab', { name: 'Historial' }).click()
  await a.paso('historial')
  a.verificar()
})

test('Visitas: programar visita con serie recurrente', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'visitas-programar', 'visitas?accion=programar')
  await expect(page.getByRole('heading', { name: 'Programar visita', level: 3 })).toBeVisible()
  await expect(page.getByText('Adultos de la visita (0/4)')).toBeVisible()
  await a.paso('formulario', { visibles: [boton(page, 'Guardar visita pendiente')] })
  await page.getByRole('combobox', { name: 'Repetición' }).selectOption('semanal')
  await page.getByRole('checkbox', { name: /Ruizdelacruz/ }).first().check({ force: true }).catch(() => undefined)
  await a.paso('serie-semanal', { visibles: [boton(page, 'Programar serie')] })
  a.verificar()
})

test('Visitas: solicitudes externas y calendario', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'visitas-solicitudes', 'visitas?accion=solicitudes')
  await expect(page.getByRole('heading', { name: /Solicitudes externas/ })).toBeVisible()
  await a.paso('lista')
  await boton(page, 'Revisar y autorizar').first().click()
  await expect(page.getByRole('heading', { name: 'Autorizar solicitud de visita' })).toBeVisible()
  await a.paso('autorizar', { visibles: [boton(page, 'Autorizar y agendar')] })
  await page.goto(`${ruta}/visitas?accion=calendario`)
  await expect(page.getByRole('region', { name: 'Calendario de disponibilidad' })).toBeVisible()
  await a.paso('calendario')
  a.verificar()
})

test('Visita: detalle programada con autorización, evidencias y acciones', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'visita-detalle', `visitas?visita=${visitaId}`)
  await expect(page.getByRole('heading', { name: 'Detalle de visita' })).toBeVisible()
  await a.paso('detalle', { visibles: [boton(page, 'Reprogramar visita'), boton(page, 'Cancelar visita')] })
  await boton(page, 'Reprogramar visita').click()
  await expect(page.getByRole('heading', { name: 'Reprogramar visita', level: 3 })).toBeVisible()
  await a.paso('reprogramar', { visibles: [boton(page, 'Confirmar nuevo horario')] })
  await page.goto(`${ruta}/visitas?visita=${visitaId}&accion=cancelar`)
  await expect(page.getByRole('heading', { name: 'Cancelar visita', level: 3 })).toBeVisible()
  await a.paso('cancelar', { visibles: [boton(page, 'Confirmar cancelación')] })
  a.verificar()
})

test('Visita en curso: evidencias, revisión y registro de la realización', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'visita-curso', `visitas?visita=${visitaCursoId}`)
  await expect(boton(page, 'Registrar realización')).toBeVisible()
  await a.paso('detalle', { visibles: [boton(page, 'Registrar realización')] })
  await page.goto(`${ruta}/visitas?visita=${visitaCursoId}&accion=registrar`)
  await expect(page.getByRole('heading', { name: 'Registrar visita' })).toBeVisible()
  await a.paso('registrar', { visibles: [boton(page, 'Registrar visita')] })
  a.verificar()
})

test('Visita en curso como cuidador: adjuntar evidencia', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'visita-cuidador', `visitas?visita=${visitaCursoId}`, { cuenta: cuentaCompleta({ rol: 'cuidador' }) })
  await expect(boton(page, 'Adjuntar evidencia')).toBeVisible()
  await boton(page, 'Adjuntar evidencia').click()
  await expect(page.getByRole('heading', { name: 'Adjuntar evidencia privada' })).toBeVisible()
  await a.paso('adjuntar', { visibles: [boton(page, 'Adjuntar archivo')] })
  a.verificar()
})

/* ───────────── Solicitudes internas y agenda ───────────── */
test('Solicitudes de visita: bandeja, autorizar y rechazar', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'solicitudes', 'solicitudes-visita')
  await expect(page.getByRole('region', { name: 'Bandeja interna de solicitudes' })).toBeVisible()
  await a.paso('lista')
  await boton(page, 'Autorizar', ).first().click()
  await a.paso('autorizar')
  await boton(page, 'Cancelar').first().click()
  await boton(page, 'Rechazar').first().click()
  await a.paso('rechazar')
  a.verificar()
})

test('Agenda: filtros, tareas, detalle, edición y cancelación', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'agenda', 'agenda')
  await expect(page.getByRole('heading', { name: 'Agenda de cuidado' })).toBeVisible()
  await a.paso('lista', { visibles: [boton(page, 'Nueva tarea')] })
  await page.goto(`${ruta}/agenda?tarea=${tareaId}`)
  await expect(page.getByRole('heading', { level: 2, name: /Administrar el medicamento/ })).toBeVisible()
  await a.paso('detalle', { visibles: [boton(page, 'Editar tarea'), boton(page, 'Cancelar tarea')] })
  await page.goto(`${ruta}/agenda?tarea=${tareaId}&accion=editar`)
  await expect(page.getByRole('heading', { name: 'Editar tarea', level: 3 })).toBeVisible()
  await a.paso('editar', { visibles: [boton(page, 'Guardar cambios')] })
  await page.goto(`${ruta}/agenda?tarea=${tareaId}&accion=cancelar`)
  await expect(page.getByRole('heading', { name: 'Cancelar tarea', level: 3 })).toBeVisible()
  await a.paso('cancelar', { visibles: [boton(page, 'Confirmar cancelación')] })
  a.verificar()
})

test('Agenda: nueva tarea repetitiva', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'agenda-nueva', 'agenda?accion=nueva')
  await expect(page.getByRole('heading', { name: 'Nueva tarea de cuidado', level: 3 })).toBeVisible()
  await a.paso('formulario', { visibles: [boton(page, 'Crear tarea')] })
  await page.getByRole('radio', { name: 'Semanal' }).click()
  await a.paso('repeticion')
  a.verificar()
})

/* ───────────── Necesidades ───────────── */
test('Necesidades: filtros, tarjetas, detalle con historial y edición', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'necesidades', 'necesidades')
  await expect(boton(page, 'Registrar necesidad')).toBeVisible()
  await a.paso('lista', { visibles: [boton(page, 'Registrar necesidad')] })
  await page.getByRole('button', { name: /^Ver necesidad:/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Historial de la necesidad' })).toBeVisible()
  await a.paso('detalle', { visibles: [boton(page, 'Cambiar estado')] })
  await boton(page, 'Editar prioridad y responsable').click()
  await a.paso('editar')
  await boton(page, 'Cancelar').first().click()
  await boton(page, 'Cambiar estado').click()
  await page.getByRole('combobox', { name: /^Nuevo estado/ }).selectOption('resuelta')
  await a.paso('estado')
  a.verificar()
})

test('Necesidades: registrar con datos opcionales', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'necesidades-registrar', 'necesidades')
  await boton(page, 'Registrar necesidad').click()
  await expect(page.getByRole('heading', { name: 'Registrar necesidad', level: 3 })).toBeVisible()
  await page.getByRole('combobox', { name: /^Categoría de la necesidad/ }).selectOption('1')
  await page.getByText('Datos opcionales').click()
  await page.getByLabel(/^Cantidad/).fill('3')
  await a.paso('formulario', { visibles: [boton(page, 'Registrar necesidad').last()] })
  a.verificar()
})

/* ───────────── Alertas ───────────── */
test('Alertas: casos prioritarios, alertas, notificaciones y detalle', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'alertas', 'alertas')
  await expect(page.getByRole('region', { name: 'Casos prioritarios' })).toBeVisible()
  await a.paso('casos')
  await page.getByRole('button', { name: 'Alertas', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Listado de alertas' })).toBeVisible()
  await a.paso('alertas')
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Notificaciones de alertas' })).toBeVisible()
  await a.paso('notificaciones')
  await page.getByRole('button', { name: /^Ver alerta$/ }).first().click()
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
  await a.paso('detalle')
  a.verificar()
})

test('Alerta: detalle con atención y resolución', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'alerta-detalle', 'alertas?bandeja=alertas')
  await page.getByRole('button', { name: /^Ver alerta:/ }).first().click()
  await expect(boton(page, 'Resolver alerta')).toBeVisible()
  await a.paso('detalle', { visibles: [boton(page, 'Resolver alerta')] })
  await boton(page, 'Resolver alerta').click()
  await expect(page.getByRole('heading', { name: 'Resolver alerta', level: 3 })).toBeVisible()
  await a.paso('resolver', { visibles: [boton(page, 'Confirmar resolución')] })
  a.verificar()
})

/* ───────────── Resumen, reportes y auditoría ───────────── */
test('Resumen de casos: indicadores, filtros y tarjetas', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'resumen', 'resumen')
  await expect(page.getByRole('region', { name: 'Resumen de casos' })).toBeVisible()
  await expect(page.getByTestId('caso-resumen').first()).toBeVisible()
  await a.paso('resumen')
  a.verificar()
})

test('Reportes: gráficos, tablas con scroll propio y análisis avanzado', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'reportes', 'reportes')
  await expect(page.getByRole('heading', { name: 'Análisis avanzado' })).toBeVisible()
  await expect(page.getByTestId('grafico-reporte').first()).toBeVisible()
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
  await a.paso('adultos', { visibles: [boton(page, 'Descargar CSV'), boton(page, 'Exportar PDF'), boton(page, 'Exportar Excel')] })
  for (const [nombre, etiqueta] of [['visitas', /Visitas/], ['necesidades', /Necesidades/], ['casos', /Casos prioritarios/]] as const) {
    await page.getByRole('radio', { name: etiqueta }).click()
    await expect(page.getByTestId('indicadores-reporte')).toBeVisible()
    await a.paso(nombre)
  }
  a.verificar()
})

test('Reportes: filtro personalizado con fechas', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'reportes-fechas', 'reportes')
  await expect(page.getByTestId('indicadores-reporte')).toBeVisible()
  await page.getByLabel('Período').selectOption('personalizado')
  await expect(page.getByLabel('Desde')).toBeVisible()
  await a.paso('fechas')
  a.verificar()
})

test('Auditoría: eventos de la cuenta', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'auditoria', 'auditoria')
  await expect(page.getByRole('region', { name: 'Actividad de la cuenta' })).toBeVisible()
  await a.paso('auditoria')
  a.verificar()
})

/* ───────────── Suscripción ───────────── */
test('Suscripción: estado, planes, pagos y confirmación en hoja', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'suscripcion', 'suscripcion')
  await expect(page.getByRole('heading', { name: 'Estado de la suscripción' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Historial de pagos' })).toBeVisible()
  await a.paso('suscripcion')
  await boton(page, 'Cancelar renovación').click()
  const hoja = page.getByRole('dialog')
  await expect(hoja).toBeVisible()
  const cabe = async (ancho: number) => {
    await page.setViewportSize({ width: ancho, height: ancho < 768 ? 700 : 900 })
    await page.waitForTimeout(500)
    const caja = await hoja.boundingBox()
    expect(caja, `la hoja debe medirse a ${ancho}px`).not.toBeNull()
    expect(caja!.x, `la hoja se sale por la izquierda a ${ancho}px`).toBeGreaterThanOrEqual(-1)
    expect(caja!.x + caja!.width, `la hoja se sale por la derecha a ${ancho}px`).toBeLessThanOrEqual(ancho + 1)
    expect(caja!.y + caja!.height, `la hoja se sale por abajo a ${ancho}px`).toBeLessThanOrEqual((ancho < 768 ? 700 : 900) + 1)
    await expect(hoja.getByRole('button', { name: 'Confirmar' })).toBeInViewport()
  }
  for (const ancho of ANCHOS) await cabe(ancho)
  await a.paso('hoja')
  a.verificar()
})

test('Suscripción de una familia: planes familiares sin cotización', async ({ page }, testInfo) => {
  const a = await recorrer(page, testInfo, 'suscripcion-familia', 'suscripcion', { cuenta: cuentaCompleta({ tipo: 'familia', nombre: 'Familia Fernández de la Cruz Rodríguez de los Santos' }) })
  await expect(page.getByRole('heading', { name: 'Estado de la suscripción' })).toBeVisible()
  await a.paso('suscripcion')
  a.verificar()
})
