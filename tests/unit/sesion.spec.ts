/*
 * sesion.spec.ts — Expiración de la sesión del prototipo (RS-003 · SRS §8.2.2.3.5 i): 30 minutos sin interacción y
 * 12 horas desde el inicio, y cambio de cuenta sin reiniciar la sesión (V2, varias membresías).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { HORAS_MAXIMAS, MINUTOS_INACTIVIDAD, motivoExpiracion, type Sesion } from '../../src/domain/sesion'

const MIN = 60_000
const ahora = Date.parse('2026-11-06T15:00:00.000Z')
const sesion = (minutosDesdeInicio: number, minutosSinUso: number): Sesion => ({
  usuarioId: 'u-cuid',
  membresiaId: 'm-3',
  inicio: new Date(ahora - minutosDesdeInicio * MIN).toISOString(),
  ultimaActividad: new Date(ahora - minutosSinUso * MIN).toISOString(),
})

test.describe('RS-003 · Expiración de la sesión', () => {
  test('los límites son 30 minutos sin uso y 12 horas en total', () => {
    expect(MINUTOS_INACTIVIDAD).toBe(30)
    expect(HORAS_MAXIMAS).toBe(12)
  })

  test('sigue vigente con actividad reciente', () => {
    expect(motivoExpiracion(sesion(60, 5), ahora)).toBeNull()
    expect(motivoExpiracion(sesion(60, 30), ahora)).toBeNull()
  })

  test('vence por inactividad pasado el límite', () => {
    expect(motivoExpiracion(sesion(60, 31), ahora)).toBe('inactividad')
  })

  test('vence por duración máxima aunque haya actividad', () => {
    expect(motivoExpiracion(sesion(12 * 60 + 1, 1), ahora)).toBe('duracion')
    expect(motivoExpiracion(sesion(12 * 60 - 1, 1), ahora)).toBeNull()
  })
})
