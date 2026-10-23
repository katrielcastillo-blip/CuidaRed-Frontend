/*
 * permisos-seguridad.spec.ts — Pruebas unitarias del control de acceso por roles (RF-09 · CU-13) y de la
 * protección de contraseñas (SRS §8.2.2.3.5 b, n).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { adultosVisibles, MATRIZ, puede, type Accion } from '../../src/domain/permisos'
import { hashSecreto, protegerPassword, validarPassword, verificarSecreto } from '../../src/domain/seguridad'
import { buildSeed, DEMO_PASSWORD } from '../../src/domain/seed'
import type { Rol } from '../../src/domain/types'

const seed = buildSeed()
const usuario = (id: string) => seed.usuarios.find((u) => u.id === id)!
const adulto = (id: string) => seed.adultos.find((a) => a.id === id)!

test.describe('RF-09 · Control de acceso por roles', () => {
  const casos: Array<[Rol, Accion, boolean]> = [
    ['admin', 'usuarios:gestionar', true],
    ['admin', 'auditoria:ver', true],
    ['admin', 'visitas:registrar', false],
    ['coordinador', 'usuarios:gestionar', false],
    ['coordinador', 'resumen:ver', true],
    ['coordinador', 'reportes:ver', true],
    ['coordinador', 'alertas:gestionar', true],
    ['voluntario', 'visitas:registrar', true],
    ['voluntario', 'necesidades:registrar', true],
    ['voluntario', 'reportes:ver', false],
    ['voluntario', 'alertas:gestionar', false],
    ['familiar', 'adultos:ver', true],
    ['familiar', 'visitas:registrar', false],
    ['familiar', 'necesidades:actualizar', false],
    ['familiar', 'adultos:ver-sensible', false],
    ['familiar', 'indicaciones:ver', false],
    ['voluntario', 'indicaciones:ver', true],
    ['voluntario', 'indicaciones:gestionar', false],
    ['voluntario', 'agenda:ejecutar', true],
    ['coordinador', 'evidencias:validar', true],
    ['coordinador', 'cuenta:suscripcion', false],
    ['admin', 'cuenta:suscripcion', true],
  ]
  for (const [rol, accion, esperado] of casos) {
    test(`${rol} ${esperado ? 'puede' : 'NO puede'} ${accion}`, () => {
      expect(MATRIZ[rol].includes(accion)).toBe(esperado)
    })
  }

  test('Un usuario desactivado no tiene ningún permiso', () => {
    const u = { ...usuario('u-coord'), estado: 'inactivo' as const }
    expect(puede(u, 'adultos:ver')).toBe(false)
  })

  test('El voluntario solo alcanza a los adultos con vínculo "voluntario asignado"', () => {
    const vol = usuario('u-cuid')
    expect(puede(vol, 'visitas:registrar', adulto('a-elena'), seed.vinculos)).toBe(true)
    expect(puede(vol, 'visitas:registrar', adulto('a-maria'), seed.vinculos)).toBe(false)
    const visibles = adultosVisibles(vol, seed.adultos, seed.vinculos)
    expect(visibles.length).toBeGreaterThan(0)
    expect(visibles.every((a) => seed.vinculos.some((v) => v.usuarioId === vol.id && v.adultoId === a.id && v.tipoVinculoId === 'voluntario_asignado'))).toBe(true)
  })

  test('El familiar responsable solo ve los adultos con vínculo "familiar responsable"', () => {
    const fam = usuario('u-fam')
    const visibles = adultosVisibles(fam, seed.adultos, seed.vinculos)
    expect(visibles.length).toBeGreaterThan(0)
    expect(visibles.every((a) => seed.vinculos.some((v) => v.usuarioId === fam.id && v.adultoId === a.id && v.tipoVinculoId === 'familiar_responsable'))).toBe(true)
    expect(puede(fam, 'adultos:ver', adulto('a-jose'), seed.vinculos)).toBe(false)
  })

  test('Un vínculo "referente" no otorga acceso', () => {
    const fam = usuario('u-fam')
    const vinculos = [{ usuarioId: 'u-fam', adultoId: 'a-jose', tipoVinculoId: 'referente', creadoEn: '' }]
    expect(puede(fam, 'adultos:ver', adulto('a-jose'), vinculos)).toBe(false)
  })

  test('Administrador y coordinador ven todos los adultos de su organización', () => {
    expect(adultosVisibles(usuario('u-admin'), seed.adultos, seed.vinculos)).toHaveLength(seed.adultos.length)
    expect(adultosVisibles(usuario('u-coord'), seed.adultos, seed.vinculos)).toHaveLength(seed.adultos.length)
  })

  test('La semilla cubre todas las tablas del modelo de BD V3.0', () => {
    for (const tabla of ['orgs', 'configuracion', 'pagos', 'usuarios', 'membresias', 'cuidadores', 'adultos', 'contactos', 'vinculos', 'riesgos', 'indicaciones', 'visitas', 'necesidades', 'alertas', 'tareas', 'evidencias'] as const) {
      expect(seed[tabla].length, tabla).toBeGreaterThan(0)
    }
    expect(seed.visitas.some((v) => v.detallesAdicionales.length > 0)).toBe(true)
    expect(seed.catalogos.municipios.length).toBeGreaterThan(100)
  })
})

test.describe('Seguridad de contraseñas', () => {
  test('La semilla no guarda contraseñas en texto plano y el hash verifica la contraseña demo', async () => {
    const u = usuario('u-admin')
    expect(JSON.stringify(seed)).not.toContain(DEMO_PASSWORD)
    expect(await verificarSecreto(DEMO_PASSWORD, u.passwordSalt, u.passwordHash)).toBe(true)
    expect(await verificarSecreto('otra', u.passwordSalt, u.passwordHash)).toBe(false)
  })

  test('Cada contraseña nueva usa una sal distinta', async () => {
    const a = await protegerPassword('Segura123')
    const b = await protegerPassword('Segura123')
    expect(a.passwordSalt).not.toBe(b.passwordSalt)
    expect(a.passwordHash).not.toBe(b.passwordHash)
    expect(await hashSecreto('Segura123', a.passwordSalt)).toBe(a.passwordHash)
  })

  test('Política de contraseñas robustas', () => {
    expect(validarPassword('corta1A')).toBeTruthy()
    expect(validarPassword('sinmayusculas1')).toBeTruthy()
    expect(validarPassword('SINMINUSCULAS1')).toBeTruthy()
    expect(validarPassword('SinNumeros')).toBeTruthy()
    expect(validarPassword('Segura123')).toBeUndefined()
  })
})
