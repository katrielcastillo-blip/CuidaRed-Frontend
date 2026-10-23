/*
 * agenda.ts — Servicios de Indicacion_Medica, Tarea_agenda y Evidencias (modelo de datos V3.0).
 * Fuera del núcleo funcional del SRS: dan un lugar para registrar y consultar estos datos respetando la
 * minimización de información de salud (Ley 42-01): solo se transcribe lo indicado por personal de salud.
 * Módulo: dominio · servicios.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { auditar } from '../auditoria'
import { puede } from '../permisos'
import { cuidadorDeUsuario } from '../relaciones'
import { getDB, mutate, uid } from '../store'
import type { Adulto, DB, Evidencia, IndicacionMedica, Prioridad, Tarea, Usuario } from '../types'
import { errorTexto, fechaValida, hayErrores } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_PERMISO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from './comun'

const PRIORIDADES: Prioridad[] = ['alta', 'media', 'baja']

/* ───────────── Indicaciones médicas ───────────── */

export interface DatosIndicacion {
  tipoIndicacionId: string
  titulo: string
  descripcion: string
  frecuenciaHorario: string
  fechaInicio: string
  fechaFin: string
  estado: IndicacionMedica['estado']
  evidencia: string
}

export const DATOS_INDICACION_VACIOS: DatosIndicacion = { tipoIndicacionId: '', titulo: '', descripcion: '', frecuenciaHorario: '', fechaInicio: '', fechaFin: '', estado: 'vigente', evidencia: '' }

export function validarIndicacion(d: DatosIndicacion, db: Pick<DB, 'catalogos'> = getDB()) {
  return {
    tipoIndicacionId: db.catalogos.tiposIndicacion.some((t) => t.id === d.tipoIndicacionId) ? undefined : 'Selecciona el tipo de indicación.',
    titulo: errorTexto(d.titulo, 'el título', 3, 80),
    descripcion: errorTexto(d.descripcion, 'la descripción', 5, 300),
    frecuenciaHorario: errorTexto(d.frecuenciaHorario, 'la frecuencia u horario', 3, 60),
    fechaInicio: fechaValida(d.fechaInicio) ? undefined : 'Indica la fecha de inicio.',
    fechaFin: d.fechaFin && (!fechaValida(d.fechaFin) || d.fechaFin < d.fechaInicio) ? 'La fecha de fin debe ser posterior al inicio.' : undefined,
  }
}

export function guardarIndicacion(actor: Usuario, adultoId: string, d: DatosIndicacion, indicacionId?: string): Resultado<IndicacionMedica> {
  const offline = sinConexion()
  if (offline) return offline
  const adulto = getDB().adultos.find((a) => a.id === adultoId)
  if (!adulto) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'indicaciones:gestionar', 'indicacion', adulto)
  if (denegado) return denegado
  const errores = validarIndicacion(d)
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  let guardada: IndicacionMedica | undefined
  mutate((db) => {
    const ahora = new Date().toISOString()
    const datos = {
      tipoIndicacionId: d.tipoIndicacionId,
      titulo: d.titulo.trim(),
      descripcion: d.descripcion.trim(),
      frecuenciaHorario: d.frecuenciaHorario.trim(),
      fechaInicio: d.fechaInicio,
      fechaFin: d.fechaFin || undefined,
      estado: d.estado,
      evidencia: d.evidencia || undefined,
      actualizadoEn: ahora,
    }
    const existente = indicacionId ? db.indicaciones.find((x) => x.id === indicacionId && x.adultoId === adultoId) : undefined
    if (existente) {
      Object.assign(existente, datos)
      guardada = existente
    } else {
      guardada = { id: uid('im'), adultoId, registradaPor: actor.id, ...datos }
      db.indicaciones.push(guardada)
    }
    auditar(db, actor, { accion: existente ? 'indicacion.editar' : 'indicacion.crear', entidad: 'indicacion', registroId: guardada.id, detalle: `${d.estado}` })
  })
  return guardada ? exito(guardada) : fallo(ERROR_NO_ENCONTRADO)
}

/* ───────────── Tareas de agenda ───────────── */

export interface DatosTarea {
  adultoId: string
  cuidadorId: string
  indicacionId: string
  titulo: string
  fechaProgramada: string
  horaProgramada: string
  prioridad: Prioridad | ''
  requiereEvidencia: boolean
  repetitiva: boolean
}

export const DATOS_TAREA_VACIOS: DatosTarea = { adultoId: '', cuidadorId: '', indicacionId: '', titulo: '', fechaProgramada: '', horaProgramada: '', prioridad: '', requiereEvidencia: false, repetitiva: false }

export function validarTarea(d: DatosTarea, db: Pick<DB, 'adultos' | 'cuidadores' | 'indicaciones'> = getDB()) {
  return {
    adultoId: db.adultos.some((a) => a.id === d.adultoId && a.estado === 'activo') ? undefined : 'Selecciona el adulto mayor.',
    cuidadorId: db.cuidadores.some((c) => c.id === d.cuidadorId) ? undefined : 'Selecciona el cuidador.',
    indicacionId: d.indicacionId && !db.indicaciones.some((i) => i.id === d.indicacionId && i.adultoId === d.adultoId) ? 'La indicación no corresponde a este adulto.' : undefined,
    titulo: errorTexto(d.titulo, 'el título', 3, 80),
    fechaProgramada: fechaValida(d.fechaProgramada) ? undefined : 'Indica la fecha.',
    horaProgramada: /^\d{2}:\d{2}$/.test(d.horaProgramada) ? undefined : 'Indica la hora.',
    prioridad: PRIORIDADES.includes(d.prioridad as Prioridad) ? undefined : 'Selecciona la prioridad.',
  }
}

export function guardarTarea(actor: Usuario, d: DatosTarea, tareaId?: string): Resultado<Tarea> {
  const offline = sinConexion()
  if (offline) return offline
  const adulto = getDB().adultos.find((a) => a.id === d.adultoId)
  const denegado = verificar(actor, 'agenda:gestionar', 'tarea', adulto)
  if (denegado) return denegado
  const errores = validarTarea(d)
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  let guardada: Tarea | undefined
  mutate((db) => {
    const ahora = new Date().toISOString()
    const datos = {
      adultoId: d.adultoId,
      cuidadorId: d.cuidadorId,
      indicacionId: d.indicacionId || undefined,
      titulo: d.titulo.trim(),
      fechaProgramada: d.fechaProgramada,
      horaProgramada: d.horaProgramada,
      prioridad: d.prioridad as Prioridad,
      requiereEvidencia: d.requiereEvidencia,
      repetitiva: d.repetitiva,
      actualizadoEn: ahora,
    }
    const existente = tareaId ? db.tareas.find((t) => t.id === tareaId) : undefined
    if (existente) {
      Object.assign(existente, datos)
      guardada = existente
    } else {
      guardada = { id: uid('ta'), estado: 'pendiente', creadaPor: actor.id, ...datos }
      db.tareas.push(guardada)
    }
    auditar(db, actor, { accion: existente ? 'tarea.editar' : 'tarea.crear', entidad: 'tarea', registroId: guardada.id, detalle: d.titulo.trim() })
  })
  return guardada ? exito(guardada) : fallo(ERROR_NO_ENCONTRADO)
}

/** ¿El usuario es el cuidador asignado a la tarea? */
const esSuTarea = (db: Pick<DB, 'cuidadores'>, u: Usuario, t: Tarea) => cuidadorDeUsuario(db.cuidadores, u.id)?.id === t.cuidadorId

/** Tareas que el usuario puede ver: las de los adultos a su alcance (o las suyas como cuidador). */
export function tareasVisibles(db: Pick<DB, 'tareas' | 'adultos' | 'cuidadores'>, u: Usuario | null): Tarea[] {
  if (!u || !puede(u, 'agenda:ver')) return []
  return db.tareas.filter((t) => {
    const a = db.adultos.find((x) => x.id === t.adultoId)
    return (a && puede(u, 'agenda:ver', a)) || esSuTarea(db, u, t)
  })
}

/**
 * Cambia el estado de una tarea. El cuidador asignado puede iniciarla o completarla; quien gestiona la agenda
 * puede además cancelarla. Si la tarea requiere evidencia, para completarla debe haber al menos una registrada.
 * Una tarea repetitiva completada genera la del día siguiente.
 */
export function cambiarEstadoTarea(actor: Usuario, tareaId: string, estado: Tarea['estado']): Resultado<Tarea> {
  const offline = sinConexion()
  if (offline) return offline
  const db = getDB()
  const t = db.tareas.find((x) => x.id === tareaId)
  if (!t) return fallo(ERROR_NO_ENCONTRADO)
  const adulto: Adulto | undefined = db.adultos.find((a) => a.id === t.adultoId)
  const gestiona = puede(actor, 'agenda:gestionar', adulto)
  const ejecuta = puede(actor, 'agenda:ejecutar') && esSuTarea(db, actor, t)
  if (!gestiona && !ejecuta) return fallo(ERROR_PERMISO)
  if (estado === 'cancelada' && !gestiona) return fallo(ERROR_PERMISO)
  if (estado === 'completada' && t.requiereEvidencia && !db.evidencias.some((e) => e.tareaId === t.id && e.estadoValidacion !== 'rechazada')) {
    return fallo('Esta tarea requiere evidencia: adjunta una foto o documento antes de completarla.')
  }
  let actualizada: Tarea | undefined
  mutate((draft) => {
    const x = draft.tareas.find((y) => y.id === tareaId)
    if (!x) return
    const ahora = new Date().toISOString()
    x.estado = estado
    x.actualizadoEn = ahora
    actualizada = x
    if (estado === 'completada' && x.repetitiva) {
      const d = new Date(`${x.fechaProgramada}T00:00:00`)
      d.setDate(d.getDate() + 1)
      const siguiente = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!draft.tareas.some((y) => y.titulo === x.titulo && y.adultoId === x.adultoId && y.fechaProgramada === siguiente)) {
        draft.tareas.push({ ...x, id: uid('ta'), fechaProgramada: siguiente, estado: 'pendiente', actualizadoEn: ahora })
      }
    }
    auditar(draft, actor, { accion: 'tarea.estado', entidad: 'tarea', registroId: tareaId, detalle: estado })
  })
  return actualizada ? exito(actualizada) : fallo(ERROR_NO_ENCONTRADO)
}

/* ───────────── Evidencias ───────────── */

export function registrarEvidencia(actor: Usuario, tareaId: string, archivo: string, observacion: string): Resultado<Evidencia> {
  const offline = sinConexion()
  if (offline) return offline
  const db = getDB()
  const t = db.tareas.find((x) => x.id === tareaId)
  if (!t) return fallo(ERROR_NO_ENCONTRADO)
  const adulto = db.adultos.find((a) => a.id === t.adultoId)
  if (!(puede(actor, 'agenda:gestionar', adulto) || (puede(actor, 'agenda:ejecutar') && esSuTarea(db, actor, t)))) return fallo(ERROR_PERMISO)
  if (!archivo) return fallo(ERROR_VALIDACION, { archivo: 'Adjunta una foto o documento.' })
  if (observacion.length > 300) return fallo(ERROR_VALIDACION, { observacion: 'Máximo 300 caracteres.' })
  const evidencia: Evidencia = { id: uid('ev'), tareaId, fechaRegistro: new Date().toISOString(), archivo, ...(observacion.trim() ? { observacion: observacion.trim() } : {}), estadoValidacion: 'pendiente', registradaPor: actor.id }
  mutate((draft) => {
    draft.evidencias.push(evidencia)
    auditar(draft, actor, { accion: 'tarea.evidencia', entidad: 'tarea', registroId: tareaId })
  })
  return exito(evidencia)
}

export function validarEvidencia(actor: Usuario, evidenciaId: string, estado: 'validada' | 'rechazada'): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const db = getDB()
  const ev = db.evidencias.find((x) => x.id === evidenciaId)
  if (!ev) return fallo(ERROR_NO_ENCONTRADO)
  const t = db.tareas.find((x) => x.id === ev.tareaId)
  const denegado = verificar(actor, 'evidencias:validar', 'tarea', db.adultos.find((a) => a.id === t?.adultoId), ev.tareaId)
  if (denegado) return denegado
  mutate((draft) => {
    const x = draft.evidencias.find((y) => y.id === evidenciaId)
    if (!x) return
    x.estadoValidacion = estado
    x.validadaPor = actor.id
    auditar(draft, actor, { accion: 'tarea.evidencia', entidad: 'tarea', registroId: ev.tareaId, detalle: `Evidencia ${estado}` })
  })
  return exito(undefined)
}
