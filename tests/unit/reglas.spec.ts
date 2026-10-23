/*
 * reglas.spec.ts — Pruebas unitarias del motor de alertas automáticas (RF-04 · CU-09 y RF-05 · CU-10).
 * Cada prueba corresponde a un escenario Gherkin del SRS §16.4 y §16.5.
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { expect, test } from '@playwright/test'
import { catalogosIniciales } from '../../src/domain/datosMaestros'
import { aplicarReglas } from '../../src/domain/reglas'
import type { Adulto, DB, Necesidad, Visita } from '../../src/domain/types'

const HOY = new Date('2026-10-22T15:00:00')
const haceDias = (n: number) => {
  const d = new Date(HOY)
  d.setDate(d.getDate() - n)
  return d
}
const diaISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function adulto(p: Partial<Adulto> = {}): Adulto {
  return {
    id: 'a-1', orgId: 'org', nombre: 'Ana', apellido: 'Pérez', cedula: '001-0000000-1', fechaNacimiento: '1950-01-01',
    sexo: 'Femenino', telefono: '', municipioCod: 'P01-01', zona: 'Z', direccion: '',
    riesgo: 'bajo', condicionGeneral: { autonomia: 'independiente', condiciones: [] }, estado: 'activo', registradoPor: 'u',
    creadoEn: haceDias(100).toISOString(), actualizadoEn: haceDias(100).toISOString(), ...p,
  }
}

function visita(diasAtras: number, adultoId = 'a-1'): Visita {
  const d = haceDias(diasAtras)
  return { id: `v-${diasAtras}`, adultoId, cuidadorId: 'u', razon: 'Seguimiento', tipo: 'Visita', fecha: diaISO(d), horaPautada: '10:00', inicio: d.toISOString(), fin: d.toISOString(), estado: 'completada', detallesAdicionales: [], checklist: [], evidencias: [], actualizadoEn: d.toISOString() }
}

function necesidad(p: Partial<Necesidad> = {}): Necesidad {
  return { id: 'n-1', adultoId: 'a-1', registradaPor: 'u', tipo: 'medicamentos', descripcion: 'Losartán', recurrente: false, prioridad: 'alta', estado: 'pendiente', creadaEn: haceDias(1).toISOString(), historial: [], actualizadoEn: haceDias(1).toISOString(), ...p }
}

function db(p: Partial<DB> = {}): DB {
  return {
    version: 4,
    catalogos: catalogosIniciales(),
    orgs: [{ id: 'org', nombre: 'Org', tipoCuentaId: 'tc-fundacion', categoriaCuentaId: 'cc-comunitaria', municipioCod: 'P01-01', direccion: '', telefono: '', correo: '', suscripcionEstado: 'activa', creadoEn: haceDias(400).toISOString(), pruebaGratuita: false, planId: 'plan-basico', planPrecio: 0, usuarioTitularId: 'u-admin' }],
    configuracion: [], pagos: [], membresias: [], cuidadores: [], notificaciones: [], contactos: [], vinculos: [], riesgos: [], indicaciones: [], tareas: [], evidencias: [],
    usuarios: [{ id: 'u-coord', rol: 'coordinador', nombre: 'Laura', apellido: 'N', cedula: '', email: 'c@x.do', telefono: '', passwordHash: '', passwordSalt: '', etiqueta: '', estado: 'activo', orgId: 'org', creadoEn: '2026-01-01' }],
    adultos: [adulto()], visitas: [visita(2)], necesidades: [], alertas: [], invitaciones: [], auditoria: [], bloqueos: {}, recuperaciones: [],
    ...p,
  }
}

const prioritarias = (d: DB) => d.alertas.filter((a) => a.tipo === 'prioritaria')
const seguimiento = (d: DB) => d.alertas.filter((a) => a.tipo === 'seguimiento')

test.describe('CU-09 · Generar alerta de caso prioritario (RF-04)', () => {
  test('Escenario: Generar alerta por riesgo alto', () => {
    const d = db({ adultos: [adulto({ riesgo: 'alto' })] })
    aplicarReglas(d, HOY)
    expect(prioritarias(d)).toHaveLength(1)
    expect(prioritarias(d)[0]).toMatchObject({ severidad: 'alta', estado: 'pendiente', adultoId: 'a-1' })
  })

  test('Escenario: Generar alerta por necesidad de medicamentos', () => {
    const d = db({ necesidades: [necesidad()] })
    aplicarReglas(d, HOY)
    expect(prioritarias(d)).toHaveLength(1)
    expect(prioritarias(d)[0]!.severidad).toBe('alta')
    expect(prioritarias(d)[0]!.adultoId).toBe('a-1')
  })

  test('Escenario: No generar alerta de urgencia alta cuando no se cumple ninguna condición', () => {
    const d = db({ necesidades: [necesidad({ tipo: 'transporte' }), necesidad({ id: 'n-2', estado: 'satisfecha' })] })
    aplicarReglas(d, HOY)
    expect(d.alertas.filter((a) => a.severidad === 'alta')).toHaveLength(0)
  })

  test('Ambas condiciones a la vez generan UNA sola alerta (sin duplicidad)', () => {
    const d = db({ adultos: [adulto({ riesgo: 'alto' })], necesidades: [necesidad()] })
    aplicarReglas(d, HOY)
    aplicarReglas(d, HOY)
    expect(prioritarias(d)).toHaveLength(1)
    expect(prioritarias(d)[0]!.condiciones).toHaveLength(2)
  })

  test('Se cierra sola cuando dejan de cumplirse las condiciones', () => {
    const d = db({ necesidades: [necesidad()] })
    aplicarReglas(d, HOY)
    d.necesidades[0]!.estado = 'satisfecha'
    aplicarReglas(d, HOY)
    expect(prioritarias(d)[0]!.estado).toBe('atendida')
  })

  test('Una alerta atendida no se regenera por la misma causa, pero sí por una necesidad nueva', () => {
    const d = db({ necesidades: [necesidad()] })
    aplicarReglas(d, HOY)
    prioritarias(d)[0]!.estado = 'atendida'
    aplicarReglas(d, HOY)
    expect(prioritarias(d)).toHaveLength(1)
    d.necesidades.push(necesidad({ id: 'n-3' }))
    aplicarReglas(d, HOY)
    expect(prioritarias(d).filter((a) => a.estado !== 'atendida')).toHaveLength(1)
  })

  test('Cada alerta generada queda registrada en auditoría', () => {
    const d = db({ adultos: [adulto({ riesgo: 'alto' })] })
    aplicarReglas(d, HOY)
    expect(d.auditoria.some((r) => r.accion === 'alerta.generar' && r.usuarioId === 'sistema')).toBe(true)
  })
})

test.describe('Env_Necesidad.Umbral_alerta · necesidades atrasadas', () => {
  test('Una necesidad sin resolver que supera su umbral genera una alerta y se cierra al resolverla', () => {
    const d = db({ necesidades: [necesidad({ tipo: 'transporte', prioridad: 'media', umbralAlertaDias: 3, creadaEn: haceDias(5).toISOString() })] })
    aplicarReglas(d, HOY)
    const al = d.alertas.find((a) => a.tipo === 'necesidad')
    expect(al).toBeTruthy()
    expect(al!.severidad).toBe('media')
    d.necesidades[0]!.estado = 'satisfecha'
    aplicarReglas(d, HOY)
    expect(d.alertas.find((a) => a.tipo === 'necesidad')!.estado).toBe('atendida')
  })
})

test.describe('CU-10 · Gestionar alerta de seguimiento familiar (RF-05)', () => {
  test('Escenario: Generar alerta después de 15 días sin contacto', () => {
    const d = db({ visitas: [visita(16)] })
    aplicarReglas(d, HOY)
    expect(seguimiento(d)).toHaveLength(1)
    expect(seguimiento(d)[0]!.estado).toBe('pendiente')
  })

  test('Escenario: No generar alerta cuando el contacto ocurrió dentro del período permitido', () => {
    for (const dias of [0, 7, 15]) {
      const d = db({ visitas: [visita(dias)] })
      aplicarReglas(d, HOY)
      expect(seguimiento(d), `con ${dias} días`).toHaveLength(0)
    }
  })

  test('Escenario: Generar alerta cuando no existe historial de contacto', () => {
    const d = db({ adultos: [adulto({ creadoEn: haceDias(20).toISOString() })], visitas: [] })
    aplicarReglas(d, HOY)
    expect(seguimiento(d)).toHaveLength(1)
    expect(seguimiento(d)[0]!.estado).toBe('pendiente')
  })

  test('Perfil nuevo sin visitas (≤15 días) no genera alerta', () => {
    const d = db({ adultos: [adulto({ creadoEn: haceDias(10).toISOString() })], visitas: [] })
    aplicarReglas(d, HOY)
    expect(seguimiento(d)).toHaveLength(0)
  })

  test('Al registrar una visita la alerta se cierra automáticamente', () => {
    const d = db({ visitas: [visita(30)] })
    aplicarReglas(d, HOY)
    d.visitas.push(visita(0))
    aplicarReglas(d, HOY)
    expect(seguimiento(d)[0]!.estado).toBe('atendida')
  })

  test('Respeta el umbral configurado por la organización', () => {
    const d = db({ visitas: [visita(10)], configuracion: [{ orgId: 'org', parametroId: 'prm-1', valor: '7', actualizadoEn: '' }] })
    aplicarReglas(d, HOY)
    expect(seguimiento(d)).toHaveLength(1)
  })

  test('Una visita donde el adulto aparece como adicional (DetalleVisita) cuenta como contacto', () => {
    const conjunta = { ...visita(1, 'a-otro'), detallesAdicionales: [{ adultoId: 'a-1', observacion: 'Bien' }] }
    const d = db({ visitas: [visita(40), conjunta] })
    aplicarReglas(d, HOY)
    expect(seguimiento(d)).toHaveLength(0)
  })

  test('La alerta generada se notifica a los coordinadores (tabla Notificacion)', () => {
    const d = db({ visitas: [visita(20)] })
    aplicarReglas(d, HOY)
    expect(d.notificaciones.some((n) => n.usuarioId === 'u-coord' && n.alertaId === seguimiento(d)[0]!.id && n.estado === 'no_leida')).toBe(true)
  })

  test('Perfiles inactivos no generan alertas', () => {
    const d = db({ adultos: [adulto({ estado: 'inactivo', riesgo: 'alto' })], visitas: [] })
    aplicarReglas(d, HOY)
    expect(d.alertas).toHaveLength(0)
  })
})
