/*
 * invitaciones-resumen.spec.ts — "Mi cuenta" con invitaciones pendientes (aceptar y rechazar) y resumen de la cuenta
 * activa con el estado de la suscripción (fase 2), con Auth y API interceptados.
 * Módulo: pruebas · access-real.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { cuentaActiva, invitacionPendiente, iniciarSesionEnMiCuenta, PERMISOS_CAMPO, simular, suscripcionDePrueba } from './ayudas-fase2'

const CORREO = 'laura@example.test'

const cuentasConInvitacion = () => [
  cuentaActiva({ cuenta_id: 'org-a', nombre: 'Fundación Esperanza', rol: 'cuidador', permisos: PERMISOS_CAMPO }),
  invitacionPendiente({ cuenta_id: 'org-luz', nombre: 'Fundación Luz', rol: 'coordinador', membresia_id: '41' }),
]

test('aceptar una invitación refresca el listado independiente de cuentas', async ({ page }) => {
  const sim = await simular(page, { cuentas: cuentasConInvitacion() })
  await iniciarSesionEnMiCuenta(page, CORREO)

  const invitaciones = page.getByTestId('invitaciones-pendientes')
  await expect(invitaciones).toContainText('Te invitaron a Fundación Luz como Coordinador')
  // La invitación no es una cuenta activa: aún no aparece en la lista ni da permisos.
  await expect(page.getByTestId('cuentas-conectadas').getByRole('button')).toHaveCount(1)

  const consultasAntes = sim.llamadas('GET', '/cuentas').length
  await invitaciones.getByRole('button', { name: 'Aceptar' }).click()

  await expect(page.getByText('Aceptaste la invitación a Fundación Luz.')).toBeVisible()
  await expect(invitaciones.getByRole('button', { name: 'Aceptar' })).toHaveCount(0)
  await expect(page.getByTestId('cuentas-conectadas').getByRole('button')).toHaveCount(2)
  await expect(page.getByTestId('cuentas-conectadas').getByRole('button', { name: /Fundación Luz/ })).toBeVisible()
  expect(sim.llamadas('POST', '/me/membresias/41/aceptar')).toHaveLength(1)
  expect(sim.llamadas('POST', '/me/membresias/41/aceptar')[0]!.cuerpo).toEqual({})
  expect(sim.llamadas('GET', '/cuentas').length).toBeGreaterThan(consultasAntes)
})

test('rechazar una invitación pendiente: POST de rechazo y la invitación desaparece', async ({ page }) => {
  const sim = await simular(page, { cuentas: cuentasConInvitacion() })
  await iniciarSesionEnMiCuenta(page, CORREO)
  await page.getByTestId('invitaciones-pendientes').getByRole('button', { name: 'Rechazar' }).click()

  await expect(page.getByText('Rechazaste la invitación a Fundación Luz.')).toBeVisible()
  await expect(page.getByText('Te invitaron a Fundación Luz')).toHaveCount(0)
  expect(sim.llamadas('POST', '/me/membresias/41/rechazar')).toHaveLength(1)
  expect(sim.llamadas('POST', '/me/membresias/41/aceptar')).toHaveLength(0)
  await expect(page.getByTestId('cuentas-conectadas').getByRole('button')).toHaveCount(1)
})

test('si el cupo del plan cambió, aceptar muestra el motivo y la invitación sigue disponible', async ({ page }) => {
  const sim = await simular(page, { cuentas: cuentasConInvitacion(), errorAlAceptar: { estado: 409, codigo: 'PLAN_LIMIT_REACHED' } })
  await iniciarSesionEnMiCuenta(page, CORREO)
  const invitaciones = page.getByTestId('invitaciones-pendientes')
  await invitaciones.getByRole('button', { name: 'Aceptar' }).click()

  await expect(invitaciones.getByRole('alert')).toContainText('Se alcanzó el límite de personas del plan de la cuenta.')
  await expect(page.locator('body')).not.toContainText('mensaje_privado')
  await expect(invitaciones).toContainText('Te invitaron a Fundación Luz como Coordinador')
  await expect(invitaciones.getByRole('button', { name: 'Aceptar' })).toBeEnabled()
  await expect(page.getByTestId('cuentas-conectadas').getByRole('button')).toHaveCount(1)

  // Cuando el cupo se libera, el mismo botón la acepta.
  sim.opciones.errorAlAceptar = undefined
  await invitaciones.getByRole('button', { name: 'Aceptar' }).click()
  await expect(page.getByTestId('cuentas-conectadas').getByRole('button')).toHaveCount(2)
})

test('resumen de la cuenta activa: tipo, rol, suscripción y días de prueba, y se recarga al cambiar de cuenta', async ({ page }) => {
  const sim = await simular(page, {
    cuentas: [
      cuentaActiva({ cuenta_id: 'fam-b', nombre: 'Familia Méndez', tipo: 'familia', rol: 'coordinador', estado_suscripcion: 'prueba', es_titular: true }),
      cuentaActiva({ cuenta_id: 'org-a', nombre: 'Fundación Esperanza', rol: 'cuidador', permisos: PERMISOS_CAMPO, estado_suscripcion: 'vencida', acceso_operativo: false }),
    ],
    suscripciones: {
      'fam-b': suscripcionDePrueba(3),
      'org-a': suscripcionDePrueba(0, {
        estado: 'vencida',
        acceso_operativo: false,
        prueba: { gratuita: true, vigente: false, fecha_inicio: '2026-10-01', fecha_fin: '2026-10-08', dias_restantes: 0 },
      }),
    },
  })
  await iniciarSesionEnMiCuenta(page, CORREO)

  const resumen = page.getByTestId('resumen-cuenta')
  await expect(resumen).toContainText('Resumen de Familia Méndez')
  await expect(resumen).toContainText('Familia')
  await expect(resumen).toContainText('Coordinador · titular')
  await expect(resumen).toContainText('Prueba gratuita')
  await expect(resumen).toContainText('Con acceso operativo')
  await expect(resumen).toContainText('La prueba gratuita termina el')
  await expect(resumen).not.toContainText('no tiene acceso operativo')
  expect(sim.llamadas('GET', '/cuentas/fam-b/suscripcion').length).toBeGreaterThan(0)

  // Cuenta vencida: aviso de "sin acceso operativo" y sin días de prueba.
  await page.getByTestId('cuentas-conectadas').getByRole('button', { name: /Fundación Esperanza/ }).click()
  await expect(resumen).toContainText('Resumen de Fundación Esperanza')
  await expect(resumen).toContainText('Sin acceso operativo')
  await expect(resumen).toContainText('Esta cuenta no tiene acceso operativo.')
  await expect(resumen).not.toContainText('La prueba gratuita termina el')
  // Como cuidador no gestiona miembros: el resumen no ofrece ese acceso.
  await expect(resumen.getByRole('link', { name: 'Miembros de la cuenta' })).toHaveCount(0)
  expect(sim.llamadas('GET', '/cuentas/org-a/suscripcion').length).toBeGreaterThan(0)
})

test('si no se puede consultar la suscripción, el resumen sigue con lo que informa /me y permite reintentar', async ({ page }) => {
  const sim = await simular(page, { cuentas: [cuentaActiva({ cuenta_id: 'org-a', nombre: 'Fundación Esperanza', estado_suscripcion: 'vencida', acceso_operativo: false })] })
  // Primer intento: la API de suscripción no responde bien.
  await page.route('http://localhost:3301/api/v1/cuentas/org-a/suscripcion', async (route) => {
    await route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'mensaje_privado' } } })
  })
  await iniciarSesionEnMiCuenta(page, CORREO)
  const resumen = page.getByTestId('resumen-cuenta')
  await expect(resumen).toContainText('No se pudo consultar el detalle de la suscripción.')
  await expect(resumen).toContainText('Sin acceso operativo')
  await expect(page.locator('body')).not.toContainText('mensaje_privado')

  await page.unroute('http://localhost:3301/api/v1/cuentas/org-a/suscripcion')
  await resumen.getByRole('button', { name: 'Reintentar' }).click()
  await expect(resumen).not.toContainText('No se pudo consultar')
  expect(sim.llamadas('GET', '/cuentas/org-a/suscripcion').length).toBeGreaterThanOrEqual(1)
})
