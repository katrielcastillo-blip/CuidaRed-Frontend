/*
 * visitas.ts — Servicios de visitas comunitarias (RF-02 · CU-05 · CU-06), con soporte sin conexión (RF-10).
 * Módulo: dominio · servicios.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { ASPECTOS_VISITA } from '../catalogos'
import { auditar } from '../auditoria'
import { estaEnLinea } from '../conectividad'
import { nombreCompleto } from '../nombres'
import { getDB, mutate, uid } from '../store'
import { encolar } from '../sync'
import { notificarAlerta } from '../reglas'
import { tieneVinculo } from '../relaciones'
import type { Alerta, DetalleVisita, EstadoAdultoVisita, Usuario, Visita } from '../types'
import { enLista, errorFechaPasada, errorTexto, fechaValida, hayErrores } from '../validacion'
import { todayISO } from '../dates'
import { ERROR_NO_ENCONTRADO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from './comun'

export interface DatosVisita {
  /** Si viene, se completa esa visita programada; si no, se crea una visita nueva ya realizada. */
  visitaId?: string
  adultoId: string
  /** Responsable de la visita (por defecto, el usuario activo). */
  responsableId: string
  /** Motivo de la visita (Visit_razon). */
  razon: string
  /** Otros adultos del mismo hogar atendidos en la visita (filas adicionales de DetalleVisita). */
  detallesAdicionales: DetalleVisita[]
  fecha: string // YYYY-MM-DD
  hora: string // HH:MM
  estadoAdulto: EstadoAdultoVisita | ''
  observaciones: string
  checklist: string[]
  evidencias: string[]
}

const ESTADOS_ADULTO: EstadoAdultoVisita[] = ['estable', 'requiere_atencion', 'situacion_critica']
const ASPECTOS = ASPECTOS_VISITA.map((a) => a.value)

export function validarVisita(d: DatosVisita) {
  const errores: Record<string, string | undefined> = {
    adulto: d.adultoId ? undefined : 'Selecciona un perfil de adulto mayor válido.',
    responsable: d.responsableId ? undefined : 'Indica el responsable de la visita.',
    razon: errorTexto(d.razon, 'el motivo de la visita', 3, 120),
    detallesAdicionales:
      d.detallesAdicionales.some((x) => x.adultoId === d.adultoId) || new Set(d.detallesAdicionales.map((x) => x.adultoId)).size !== d.detallesAdicionales.length
        ? 'Cada adulto puede aparecer una sola vez en la visita.'
        : d.detallesAdicionales.some((x) => x.observacion.trim().length < 3)
          ? 'Escribe una observación para cada adulto adicional.'
          : undefined,
    fecha: errorFechaPasada(d.fecha, 'la fecha de la visita'),
    estadoAdulto: enLista(d.estadoAdulto, ESTADOS_ADULTO) ? undefined : 'Indica el estado del adulto durante la visita.',
    observaciones: errorTexto(d.observaciones, 'las observaciones', 3, 1000),
    checklist: d.checklist.every((c) => ASPECTOS.includes(c)) ? undefined : 'Hay aspectos no válidos en la lista.',
  }
  return errores
}

/** Registra una visita realizada (en línea se guarda en el servidor; sin conexión, en el dispositivo). */
export async function registrarVisita(actor: Usuario, d: DatosVisita): Promise<Resultado<Visita>> {
  const errores = validarVisita(d)
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  const db = getDB()
  const adulto = db.adultos.find((a) => a.id === d.adultoId && a.estado === 'activo')
  if (!adulto) return fallo('Selecciona un perfil de adulto mayor válido.', { adulto: 'Selecciona un perfil de adulto mayor válido.' })
  const denegado = verificar(actor, 'visitas:registrar', 'visita', adulto)
  if (denegado) return denegado
  for (const det of d.detallesAdicionales) {
    const otro = db.adultos.find((a) => a.id === det.adultoId && a.estado === 'activo')
    if (!otro) return fallo(ERROR_VALIDACION, { detallesAdicionales: 'Uno de los adultos adicionales no es válido.' })
    const den = verificar(actor, 'visitas:registrar', 'visita', otro)
    if (den) return den
  }
  const responsable = db.usuarios.find((u) => u.id === d.responsableId && u.estado === 'activo')
  if (!responsable) return fallo(ERROR_VALIDACION, { responsable: 'El responsable no es un usuario activo.' })

  const previa = d.visitaId ? db.visitas.find((v) => v.id === d.visitaId) : undefined
  if (d.visitaId && !previa) return fallo(ERROR_NO_ENCONTRADO)
  if (previa && (previa.estado === 'completada' || previa.estado === 'cancelada')) return fallo('Esta visita ya fue cerrada.')

  const ahora = new Date().toISOString()
  const visita: Visita = {
    ...(previa ?? { id: uid('v'), tipo: 'Visita de Seguimiento', creadaPor: actor.id, horaPautada: d.hora }),
    adultoId: adulto.id,
    cuidadorId: responsable.id,
    autorizadaPor: previa?.autorizadaPor ?? (actor.rol === 'coordinador' ? actor.id : undefined),
    razon: d.razon.trim(),
    detallesAdicionales: d.detallesAdicionales.map((x) => ({ adultoId: x.adultoId, observacion: x.observacion.trim() })),
    fecha: d.fecha,
    horaPautada: previa?.horaPautada ?? d.hora,
    inicio: previa?.inicio ?? new Date(`${d.fecha}T${d.hora}:00`).toISOString(),
    fin: ahora,
    estado: 'completada',
    estadoAdulto: d.estadoAdulto as EstadoAdultoVisita,
    observaciones: d.observaciones.trim(),
    checklist: [...d.checklist],
    evidencias: [...d.evidencias],
    actualizadoEn: ahora,
    actualizadoPor: actor.id,
  } as Visita
  delete visita.pendienteSync

  if (!estaEnLinea()) {
    await encolar('visita', visita, actor)
    return exito(visita, true)
  }

  mutate((draft) => {
    const i = draft.visitas.findIndex((v) => v.id === visita.id)
    if (i >= 0) draft.visitas[i] = visita
    else draft.visitas.push(visita)
    auditar(draft, actor, { accion: 'visita.registrar', entidad: 'visita', registroId: visita.id, detalle: `Adulto ${adulto.id} · estado ${visita.estadoAdulto}` })
    if (visita.estadoAdulto === 'situacion_critica') {
      const alerta: Alerta = {
        id: uid('al'),
        adultoId: adulto.id,
        tipo: 'emergencia',
        severidad: 'alta',
        categoria: 'EMERGENCIA MÉDICA',
        titulo: 'Situación crítica reportada en visita',
        descripcion: `${nombreCompleto(actor)} reportó una situación crítica durante la visita: ${visita.observaciones}`,
        condiciones: ['Situación crítica reportada en visita'],
        creadaEn: ahora,
        estado: 'pendiente',
        generadaPor: actor.id,
        acciones: [],
        leidaPor: [],
        actualizadoEn: ahora,
      }
      draft.alertas.push(alerta)
      notificarAlerta(draft, alerta)
      auditar(draft, actor, { accion: 'alerta.generar', entidad: 'alerta', registroId: alerta.id, detalle: 'Emergencia reportada en visita' })
    }
  })
  return exito(visita)
}

/** Marca una visita programada como "en curso" (funciona sin conexión). */
export async function iniciarVisita(actor: Usuario, visitaId: string): Promise<Resultado<Visita>> {
  const db = getDB()
  const v = db.visitas.find((x) => x.id === visitaId)
  if (!v) return fallo(ERROR_NO_ENCONTRADO)
  const adulto = db.adultos.find((a) => a.id === v.adultoId)
  const denegado = verificar(actor, 'visitas:registrar', 'visita', adulto, visitaId)
  if (denegado) return denegado
  if (v.estado !== 'pendiente') return exito(v)
  const ahora = new Date().toISOString()
  const nueva: Visita = { ...v, estado: 'en_curso', inicio: ahora, actualizadoEn: ahora, actualizadoPor: actor.id }
  delete nueva.pendienteSync
  if (!estaEnLinea()) {
    await encolar('visita', nueva, actor)
    return exito(nueva, true)
  }
  mutate((draft) => {
    const i = draft.visitas.findIndex((x) => x.id === visitaId)
    if (i >= 0) draft.visitas[i] = nueva
    auditar(draft, actor, { accion: 'visita.iniciar', entidad: 'visita', registroId: visitaId })
  })
  return exito(nueva)
}

export interface DatosProgramacion {
  adultoId: string
  responsableId: string
  /** Motivo de la visita (Visit_razon). */
  razon: string
  fecha: string
  hora: string
  notas: string
}

/** Programa una visita futura y la asigna a un voluntario (coordinador). Requiere conexión. */
export function programarVisita(actor: Usuario, d: DatosProgramacion): Resultado<Visita> {
  const offline = sinConexion()
  if (offline) return offline
  const db = getDB()
  const adulto = db.adultos.find((a) => a.id === d.adultoId && a.estado === 'activo')
  const errores: Record<string, string | undefined> = {
    adulto: adulto ? undefined : 'Selecciona un adulto mayor.',
    responsable: db.usuarios.some((u) => u.id === d.responsableId && u.estado === 'activo') ? undefined : 'Selecciona el responsable.',
    fecha: !fechaValida(d.fecha) ? 'Indica la fecha.' : d.fecha < todayISO() ? 'No puedes programar una visita en una fecha pasada.' : undefined,
    hora: !/^\d{2}:\d{2}$/.test(d.hora)
      ? 'Indica la hora.'
      : d.fecha === todayISO() && new Date(`${d.fecha}T${d.hora}:00`) < new Date()
        ? 'La hora ya pasó.'
        : db.visitas.some((v) => v.cuidadorId === d.responsableId && v.fecha === d.fecha && v.horaPautada === d.hora && v.estado !== 'cancelada')
          ? 'El responsable ya tiene una visita a esa hora.'
          : undefined,
    notas: d.notas.length > 300 ? 'Máximo 300 caracteres.' : undefined,
    razon: errorTexto(d.razon, 'el motivo de la visita', 3, 120),
  }
  if (hayErrores(errores) || !adulto) return fallo(ERROR_VALIDACION, errores)
  const denegado = verificar(actor, 'visitas:programar', 'visita', adulto)
  if (denegado) return denegado
  const ahora = new Date().toISOString()
  const visita: Visita = {
    id: uid('v'),
    adultoId: adulto.id,
    cuidadorId: d.responsableId,
    autorizadaPor: actor.id,
    razon: d.razon.trim(),
    tipo: 'Visita de Seguimiento',
    fecha: d.fecha,
    horaPautada: d.hora,
    estado: 'pendiente',
    detallesAdicionales: [],
    notas: d.notas.trim() || undefined,
    checklist: [],
    evidencias: [],
    creadaPor: actor.id,
    actualizadoEn: ahora,
    actualizadoPor: actor.id,
  }
  mutate((draft) => {
    draft.visitas.push(visita)
    // El responsable pasa a tener vínculo "voluntario asignado" con el adulto (para que lo vea en su lista).
    const resp = draft.usuarios.find((u) => u.id === d.responsableId)
    if (resp?.rol === 'voluntario' && !tieneVinculo(draft.vinculos, resp.id, adulto.id, 'voluntario_asignado')) {
      draft.vinculos = draft.vinculos.filter((v) => !(v.adultoId === adulto.id && v.usuarioId === resp.id))
      draft.vinculos.push({ adultoId: adulto.id, usuarioId: resp.id, tipoVinculoId: 'voluntario_asignado', creadoEn: new Date().toISOString() })
    }
    auditar(draft, actor, { accion: 'visita.programar', entidad: 'visita', registroId: visita.id, detalle: `Para ${d.fecha} ${d.hora}` })
  })
  return exito(visita)
}

/** Cancela una visita programada (coordinador). */
export function cancelarVisita(actor: Usuario, visitaId: string): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const db = getDB()
  const v = db.visitas.find((x) => x.id === visitaId)
  if (!v) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'visitas:programar', 'visita', db.adultos.find((a) => a.id === v.adultoId), visitaId)
  if (denegado) return denegado
  mutate((draft) => {
    const x = draft.visitas.find((y) => y.id === visitaId)
    if (!x) return
    x.estado = 'cancelada'
    x.actualizadoEn = new Date().toISOString()
    x.actualizadoPor = actor.id
    auditar(draft, actor, { accion: 'visita.cancelar', entidad: 'visita', registroId: visitaId })
  })
  return exito(undefined)
}
