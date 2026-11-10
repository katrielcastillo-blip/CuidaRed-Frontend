/*
 * agenda.ts — Servicios de Indicacion_Medica, Tarea_agenda y Evidencias (modelo de datos V3.0).
 * Fuera del núcleo funcional del SRS: dan un lugar para registrar y consultar estos datos respetando la
 * minimización de información de salud (Ley 42-01): solo se transcribe lo indicado por personal de salud.
 *
 * Reglas de negocio V2 que aplica este módulo:
 *  - Tarea_agenda: cada ocurrencia de cuidado es una tarea individual. Una repetición (diaria o semanal con fecha
 *    de fin, máximo MAX_OCURRENCIAS) crea una Tarea por ocurrencia con `repetitiva: true` y un `serieId` común,
 *    que permite editar o cancelar «esta y las siguientes».
 *  - Asignación: solo a cuidadores con vínculo `cuidador_asignado` con el adulto, de la cuenta activa.
 *    `Tarea.cuidadorId` es el id del perfil de `db.cuidadores`, no el del usuario.
 *  - Evidencias (RS-013): jpg, png, webp o pdf de hasta 5 MB. Nacen `pendiente`; solo quien tiene
 *    `evidencias:validar` las valida o rechaza (el rechazo exige motivo). Una tarea que requiere evidencia no se
 *    completa sin una evidencia validada; si se rechaza, la tarea vuelve a pendiente.
 *  - Cuenta activa: solo se ven y operan las tareas de los adultos de la cuenta en la que actúa el usuario.
 * Módulo: dominio · servicios.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { auditar } from '../auditoria'
import { estaEnLinea } from '../conectividad'
import { todayISO } from '../dates'
import { nombreCompleto } from '../nombres'
import { puede } from '../permisos'
import { fechasDeSerie, MAX_OCURRENCIAS, type Repeticion } from '../recurrencia'
import { cuidadoresDe, cuidadorDeUsuario } from '../relaciones'
import { getDB, mutate, uid } from '../store'
import type { Adulto, Cuidador, DB, Evidencia, IndicacionMedica, Prioridad, Tarea, Usuario } from '../types'
import { errorTexto, fechaValida, hayErrores } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_PERMISO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from './comun'

const PRIORIDADES: Prioridad[] = ['alta', 'media', 'baja']

/* ───────────── Campos que aún no están en types.ts ───────────── */

/**
 * Tarea con su serie. `serieId` agrupa las ocurrencias creadas juntas (también se deriva de claveSerie para las
 * tareas repetitivas anteriores). Pendiente de pasar a `Tarea` en types.ts.
 */
export type TareaConSerie = Tarea & { serieId?: string }

/**
 * Evidencia con los datos de la revisión (`validadaEn`, `motivoRechazo`) y del archivo (nombre, tipo y tamaño en
 * bytes). Pendiente de pasar a `Evidencia` en types.ts.
 */
export type EvidenciaDetallada = Evidencia & {
  validadaEn?: string
  motivoRechazo?: string
  nombreArchivo?: string
  tipoArchivo?: string
  tamano?: number
}

/* ───────────── Límites de evidencias (RS-013) ───────────── */

/** Tipos MIME permitidos para una evidencia. */
export const EVIDENCIA_TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
/** Extensiones permitidas (cuando el navegador no informa el tipo MIME). */
export const EVIDENCIA_EXTENSIONES = ['jpg', 'jpeg', 'png', 'webp', 'pdf'] as const
/** Tamaño máximo de un archivo de evidencia: 5 MB. */
export const EVIDENCIA_MAX_BYTES = 5 * 1024 * 1024
/** Evidencias no rechazadas que puede tener una tarea. */
export const EVIDENCIA_MAX_POR_TAREA = 5
export const MAX_OBSERVACION_EVIDENCIA = 300
export const MAX_MOTIVO_RECHAZO = 200
/** Tope de la miniatura guardada (dataURL) para no agotar el almacenamiento del dispositivo. */
const MAX_MINIATURA_CHARS = 250_000

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

/* ───────────── Series de tareas (una Tarea por ocurrencia) ───────────── */

export { fechasDeSerie, MAX_OCURRENCIAS, type Repeticion } from '../recurrencia'

/**
 * Clave que agrupa las ocurrencias de una serie: su `serieId` o, en las tareas repetitivas anteriores a las series,
 * el adulto, el cuidador, el título y la hora. `undefined` si la tarea no se repite.
 */
export const claveSerie = (t: TareaConSerie): string | undefined =>
  t.serieId ?? (t.repetitiva ? `${t.adultoId}|${t.cuidadorId}|${t.titulo}|${t.horaProgramada}` : undefined)

/** Ocurrencias de la misma serie que `t` (incluida ella), ordenadas por fecha y hora. */
export function ocurrenciasDeSerie(tareas: Tarea[], t: TareaConSerie): Tarea[] {
  const clave = claveSerie(t)
  if (!clave) return [t]
  return tareas
    .filter((x) => claveSerie(x) === clave)
    .sort((a, b) => `${a.fechaProgramada} ${a.horaProgramada}`.localeCompare(`${b.fechaProgramada} ${b.horaProgramada}`))
}

const abierta = (t: Pick<Tarea, 'estado'>) => t.estado === 'pendiente' || t.estado === 'en_curso'

/** Ocurrencias abiertas de la serie desde esta tarea (inclusive) hacia adelante. */
export const siguientesDeSerie = (tareas: Tarea[], t: TareaConSerie): Tarea[] =>
  ocurrenciasDeSerie(tareas, t).filter((x) => x.id === t.id || (abierta(x) && `${x.fechaProgramada} ${x.horaProgramada}` > `${t.fechaProgramada} ${t.horaProgramada}`))

/* ───────────── Cuidadores asignables ───────────── */

/** ¿El perfil de cuidador está activo y pertenece (como cuidador) a la cuenta? */
export function esCuidadorDeCuenta(db: Pick<DB, 'usuarios' | 'membresias'>, c: Cuidador, orgId: string): boolean {
  const u = db.usuarios.find((x) => x.id === c.usuarioId)
  if (!u || u.estado !== 'activo') return false
  if (c.fechaFin && c.fechaFin < todayISO()) return false
  const ms = db.membresias.filter((m) => m.usuarioId === u.id)
  return ms.length > 0 ? ms.some((m) => m.orgId === orgId && m.rol === 'cuidador' && m.estado === 'activa') : u.orgId === orgId
}

/** Perfiles de cuidador que se pueden asignar a las tareas del adulto: vínculo `cuidador_asignado`, en su cuenta. */
export function cuidadoresAsignables(db: Pick<DB, 'vinculos' | 'cuidadores' | 'usuarios' | 'membresias'>, adulto: Pick<Adulto, 'id' | 'orgId'> | undefined): Cuidador[] {
  if (!adulto) return []
  const ids = new Set(cuidadoresDe(db.vinculos, adulto.id))
  return db.cuidadores.filter((c) => ids.has(c.usuarioId) && esCuidadorDeCuenta(db, c, adulto.orgId))
}

/* ───────────── Tareas de agenda ───────────── */

export interface DatosTarea {
  adultoId: string
  cuidadorId: string
  indicacionId: string
  titulo: string
  /** Fecha de la tarea o, si se repite, de la primera ocurrencia. */
  fechaProgramada: string
  horaProgramada: string
  prioridad: Prioridad | ''
  requiereEvidencia: boolean
  repeticion: Repeticion
  /** Días de la semana de una repetición semanal (0 = domingo … 6 = sábado). */
  diasSemana: number[]
  /** Última fecha de la repetición (obligatoria si la tarea se repite). */
  fechaFin: string
}

export const DATOS_TAREA_VACIOS: DatosTarea = {
  adultoId: '',
  cuidadorId: '',
  indicacionId: '',
  titulo: '',
  fechaProgramada: '',
  horaProgramada: '',
  prioridad: '',
  requiereEvidencia: false,
  repeticion: 'ninguna',
  diasSemana: [],
  fechaFin: '',
}

type DbValidarTarea = Pick<DB, 'adultos' | 'cuidadores' | 'indicaciones' | 'vinculos' | 'usuarios' | 'membresias'>

/**
 * Validación por campo. Con `existente` (edición) el adulto no cambia, la fecha puede ser pasada y se admite
 * conservar el cuidador ya asignado aunque su vínculo haya cambiado.
 */
export function validarTarea(d: DatosTarea, db: DbValidarTarea = getDB(), contexto: { actor?: Usuario; existente?: Tarea } = {}) {
  const { actor, existente } = contexto
  const adulto = db.adultos.find((a) => a.id === d.adultoId)
  const adultoValido = !!adulto && adulto.estado === 'activo' && (!actor || adulto.orgId === actor.orgId)
  const asignables = cuidadoresAsignables(db, adulto)
  const cuidadorValido = asignables.some((c) => c.id === d.cuidadorId) || (!!existente && existente.cuidadorId === d.cuidadorId && db.cuidadores.some((c) => c.id === d.cuidadorId))
  const fechas = fechasDeSerie(d)
  const seRepite = d.repeticion !== 'ninguna'
  let fechaFin: string | undefined
  if (seRepite && !existente) {
    if (!d.fechaFin) fechaFin = 'Indica hasta cuándo se repite la tarea.'
    else if (!fechaValida(d.fechaFin)) fechaFin = 'La fecha de fin no es válida.'
    else if (d.fechaFin < d.fechaProgramada) fechaFin = 'La fecha de fin no puede ser anterior a la del inicio.'
    else if (fechas.length > MAX_OCURRENCIAS) fechaFin = `La repetición crearía más de ${MAX_OCURRENCIAS} tareas. Elige una fecha de fin más cercana.`
    else if (fechas.length === 0) fechaFin = 'Con estos días no se crea ninguna tarea. Revisa los días y la fecha de fin.'
  }
  return {
    adultoId: adultoValido ? undefined : 'Selecciona el adulto mayor.',
    cuidadorId: !d.cuidadorId
      ? 'Selecciona el cuidador.'
      : cuidadorValido
        ? undefined
        : 'Solo puedes asignar cuidadores vinculados a este adulto en tu cuenta.',
    indicacionId: d.indicacionId && !db.indicaciones.some((i) => i.id === d.indicacionId && i.adultoId === d.adultoId) ? 'La indicación no corresponde a este adulto.' : undefined,
    titulo: errorTexto(d.titulo, 'el título', 3, 80),
    fechaProgramada: !fechaValida(d.fechaProgramada)
      ? 'Indica la fecha.'
      : !existente && d.fechaProgramada < todayISO()
        ? 'La fecha no puede ser anterior a hoy.'
        : undefined,
    horaProgramada: /^([01]\d|2[0-3]):[0-5]\d$/.test(d.horaProgramada) ? undefined : 'Indica la hora.',
    prioridad: PRIORIDADES.includes(d.prioridad as Prioridad) ? undefined : 'Selecciona la prioridad.',
    diasSemana: seRepite && !existente && d.repeticion === 'semanal' && d.diasSemana.length === 0 ? 'Elige al menos un día de la semana.' : undefined,
    fechaFin,
  }
}

/** Notificación interna a un usuario de la cuenta (dentro de un mutate). */
function notificar(db: DB, usuarioId: string, orgId: string, mensaje: string) {
  db.notificaciones.push({ id: uid('nt'), usuarioId, fecha: new Date().toISOString(), mensaje, orgId, estado: 'no_leida' })
}

const usuarioDeCuidador = (db: Pick<DB, 'cuidadores'>, cuidadorId: string) => db.cuidadores.find((c) => c.id === cuidadorId)?.usuarioId

/** Fecha y hora para los avisos: "09/11/2026 8:00". */
const cuando = (t: Pick<Tarea, 'fechaProgramada' | 'horaProgramada'>) => `${t.fechaProgramada.split('-').reverse().join('/')} ${t.horaProgramada}`

/**
 * Crea y asigna una tarea. Si se repite (diaria o semanal con fecha de fin) crea **una Tarea por ocurrencia**, todas con
 * `repetitiva: true` y el mismo `serieId`. El cuidador recibe un aviso. Devuelve las tareas creadas, en orden.
 */
export function crearTareas(actor: Usuario, d: DatosTarea): Resultado<Tarea[]> {
  const offline = sinConexion()
  if (offline) return offline
  const adulto = getDB().adultos.find((a) => a.id === d.adultoId)
  const denegado = verificar(actor, 'agenda:gestionar', 'tarea', adulto)
  if (denegado) return denegado
  const errores = validarTarea(d, getDB(), { actor })
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  const fechas = fechasDeSerie(d)
  if (fechas.length === 0) return fallo(ERROR_VALIDACION, { fechaFin: 'No se pudo calcular ninguna fecha. Revisa la repetición.' })
  const creadas: Tarea[] = []
  mutate((db) => {
    const ahora = new Date().toISOString()
    const seRepite = d.repeticion !== 'ninguna'
    const serieId = seRepite ? uid('se') : undefined
    for (const fecha of fechas) {
      const t: TareaConSerie = {
        id: uid('ta'),
        cuidadorId: d.cuidadorId,
        ...(d.indicacionId ? { indicacionId: d.indicacionId } : {}),
        adultoId: d.adultoId,
        titulo: d.titulo.trim(),
        fechaProgramada: fecha,
        horaProgramada: d.horaProgramada,
        prioridad: d.prioridad as Prioridad,
        estado: 'pendiente',
        requiereEvidencia: d.requiereEvidencia,
        repetitiva: seRepite,
        ...(serieId ? { serieId } : {}),
        creadaPor: actor.id,
        actualizadoEn: ahora,
      }
      db.tareas.push(t)
      creadas.push(t)
    }
    const primera = creadas[0]!
    auditar(db, actor, {
      accion: 'tarea.crear',
      entidad: 'tarea',
      registroId: primera.id,
      detalle: creadas.length > 1 ? `${primera.titulo} · ${creadas.length} ocurrencias (${fechas[0]} a ${fechas[fechas.length - 1]})` : primera.titulo,
    })
    const usuarioId = usuarioDeCuidador(db, d.cuidadorId)
    const a = db.adultos.find((x) => x.id === d.adultoId)
    if (usuarioId && usuarioId !== actor.id) {
      notificar(
        db,
        usuarioId,
        actor.orgId,
        creadas.length > 1
          ? `Se te asignaron ${creadas.length} tareas «${primera.titulo}»${a ? ` para ${nombreCompleto(a)}` : ''}, del ${cuando(primera)} al ${cuando(creadas[creadas.length - 1]!)}.`
          : `Se te asignó la tarea «${primera.titulo}»${a ? ` para ${nombreCompleto(a)}` : ''}: ${cuando(primera)}.`,
      )
    }
  })
  return creadas.length > 0 ? exito(creadas) : fallo(ERROR_NO_ENCONTRADO)
}

/**
 * Edita una tarea existente. Con `aplicarASiguientes` los cambios (cuidador, indicación, título, hora, prioridad y
 * evidencia requerida) también se aplican a las ocurrencias abiertas posteriores de la serie; la fecha solo cambia en
 * esta. Sin `tareaId` crea la tarea (y sus repeticiones): usa crearTareas para obtener todas las ocurrencias.
 */
export function guardarTarea(actor: Usuario, d: DatosTarea, tareaId?: string, opciones: { aplicarASiguientes?: boolean } = {}): Resultado<Tarea> {
  if (!tareaId) {
    const r = crearTareas(actor, d)
    return r.ok ? exito(r.valor[0]!, r.offline) : r
  }
  const offline = sinConexion()
  if (offline) return offline
  const db0 = getDB()
  const previa = db0.tareas.find((t) => t.id === tareaId)
  if (!previa) return fallo(ERROR_NO_ENCONTRADO)
  const adulto = db0.adultos.find((a) => a.id === previa.adultoId)
  const denegado = verificar(actor, 'agenda:gestionar', 'tarea', adulto)
  if (denegado) return denegado
  if (!abierta(previa)) return fallo(`Esta tarea ya está ${previa.estado === 'completada' ? 'completada' : 'cancelada'} y no se puede editar.`)
  // El adulto de una tarea creada no se cambia.
  const datos: DatosTarea = { ...d, adultoId: previa.adultoId }
  const errores = validarTarea(datos, db0, { actor, existente: previa })
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  let guardada: Tarea | undefined
  let afectadas = 1
  mutate((db) => {
    const t = db.tareas.find((x) => x.id === tareaId) as TareaConSerie | undefined
    if (!t) return
    const ahora = new Date().toISOString()
    const cambios = {
      cuidadorId: datos.cuidadorId,
      indicacionId: datos.indicacionId || undefined,
      titulo: datos.titulo.trim(),
      horaProgramada: datos.horaProgramada,
      prioridad: datos.prioridad as Prioridad,
      requiereEvidencia: datos.requiereEvidencia,
      actualizadoEn: ahora,
    }
    const cuidadorAntes = t.cuidadorId
    let objetivos: TareaConSerie[] = [t]
    if (opciones.aplicarASiguientes && claveSerie(t)) {
      const serie = siguientesDeSerie(db.tareas, t) as TareaConSerie[]
      // Se fija el serieId antes de cambiar título, cuidador u hora (de los que depende la clave derivada).
      const serieId = t.serieId ?? uid('se')
      for (const m of ocurrenciasDeSerie(db.tareas, t) as TareaConSerie[]) m.serieId = serieId
      objetivos = serie
    }
    for (const x of objetivos) Object.assign(x, cambios)
    t.fechaProgramada = datos.fechaProgramada
    afectadas = objetivos.length
    guardada = t
    auditar(db, actor, { accion: 'tarea.editar', entidad: 'tarea', registroId: t.id, detalle: afectadas > 1 ? `${cambios.titulo} · ${afectadas} ocurrencias` : cambios.titulo })
    // Aviso al cuidador nuevo (si cambió la asignación) o al actual (si cambió la tarea).
    const nuevoUsuario = usuarioDeCuidador(db, t.cuidadorId)
    if (nuevoUsuario && nuevoUsuario !== actor.id) {
      notificar(
        db,
        nuevoUsuario,
        actor.orgId,
        cuidadorAntes !== t.cuidadorId ? `Se te asignó la tarea «${t.titulo}»: ${cuando(t)}.` : `Se actualizó la tarea «${t.titulo}»: ${cuando(t)}.`,
      )
    }
    const anterior = usuarioDeCuidador(db, cuidadorAntes)
    if (cuidadorAntes !== t.cuidadorId && anterior && anterior !== actor.id) {
      notificar(db, anterior, actor.orgId, `La tarea «${t.titulo}» (${cuando(t)}) ya no está asignada a ti.`)
    }
  })
  return guardada ? exito(guardada) : fallo(ERROR_NO_ENCONTRADO)
}

/** ¿El usuario es el cuidador asignado a la tarea (en la cuenta del adulto)? */
function esSuTarea(db: Pick<DB, 'cuidadores' | 'adultos'>, u: Usuario, t: Tarea): boolean {
  if (cuidadorDeUsuario(db.cuidadores, u.id)?.id !== t.cuidadorId) return false
  // Un cuidador con varias cuentas solo opera las tareas de la cuenta en la que actúa.
  return db.adultos.find((a) => a.id === t.adultoId)?.orgId === u.orgId
}

/**
 * Tareas que el usuario puede ver en su cuenta activa: las de los adultos a su alcance (o las suyas como cuidador).
 * Nunca incluye tareas de adultos de otra cuenta aunque el usuario pertenezca a ambas.
 */
export function tareasVisibles(db: Pick<DB, 'tareas' | 'adultos' | 'cuidadores'>, u: Usuario | null): Tarea[] {
  if (!u || !puede(u, 'agenda:ver')) return []
  return db.tareas.filter((t) => {
    const a = db.adultos.find((x) => x.id === t.adultoId)
    if (!a || a.orgId !== u.orgId) return false
    return puede(u, 'agenda:ver', a) || esSuTarea(db, u, t)
  })
}

/** Registra un intento de operar una tarea sin permiso y devuelve el error. */
function sinPermiso(actor: Usuario, tareaId: string, requerido: string) {
  if (estaEnLinea()) {
    mutate((db) => auditar(db, actor, { accion: 'acceso.denegado', entidad: 'tarea', registroId: tareaId, resultado: 'denegado', detalle: `Permiso requerido: ${requerido}` }), { silencioso: true })
  }
  return fallo(ERROR_PERMISO)
}

/** Motivo por el que una tarea que requiere evidencia no se puede completar (o undefined si ya se puede). */
export function motivoSinEvidenciaValidada(t: Pick<Tarea, 'requiereEvidencia'>, evidencias: Array<Pick<Evidencia, 'estadoValidacion'>>): string | undefined {
  if (!t.requiereEvidencia || evidencias.some((e) => e.estadoValidacion === 'validada')) return undefined
  if (evidencias.some((e) => e.estadoValidacion === 'pendiente')) return 'La evidencia aún está por validar. La tarea se completa cuando la coordinación la valide.'
  if (evidencias.length > 0) return 'La evidencia fue rechazada. Adjunta una nueva para poder completar la tarea.'
  return 'Esta tarea requiere evidencia: adjunta una foto o documento y espera su validación para completarla.'
}

/**
 * Cambia el estado de una tarea abierta. El cuidador asignado puede iniciarla o completarla; quien gestiona la agenda
 * puede además cancelarla. Una tarea que requiere evidencia solo se completa con una evidencia **validada**.
 * Cada ocurrencia es independiente: completar una tarea repetitiva no crea la siguiente (ya existe).
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
  if (!gestiona && !ejecuta) return sinPermiso(actor, tareaId, 'agenda:ejecutar')
  if (estado === 'cancelada' && !gestiona) return sinPermiso(actor, tareaId, 'agenda:gestionar')
  if (!abierta(t)) return fallo(`Esta tarea ya está ${t.estado === 'completada' ? 'completada' : 'cancelada'} y no se puede modificar.`)
  if (estado === 'pendiente' || (estado === 'en_curso' && t.estado !== 'pendiente')) return fallo('Ese cambio de estado no es válido para esta tarea.')
  if (estado === 'completada') {
    const motivo = motivoSinEvidenciaValidada(t, db.evidencias.filter((e) => e.tareaId === t.id))
    if (motivo) return fallo(motivo)
  }
  let actualizada: Tarea | undefined
  mutate((draft) => {
    const x = draft.tareas.find((y) => y.id === tareaId)
    if (!x) return
    x.estado = estado
    x.actualizadoEn = new Date().toISOString()
    actualizada = x
    auditar(draft, actor, { accion: 'tarea.estado', entidad: 'tarea', registroId: tareaId, detalle: estado })
    const usuarioId = usuarioDeCuidador(draft, x.cuidadorId)
    if (estado === 'cancelada' && usuarioId && usuarioId !== actor.id) {
      notificar(draft, usuarioId, actor.orgId, `Se canceló la tarea «${x.titulo}» (${cuando(x)}).`)
    }
  })
  return actualizada ? exito(actualizada) : fallo(ERROR_NO_ENCONTRADO)
}

/**
 * Cancela una tarea o, con `alcance: 'siguientes'`, esta y las siguientes ocurrencias abiertas de su serie.
 * Solo con `agenda:gestionar`. Devuelve cuántas tareas se cancelaron.
 */
export function cancelarTarea(actor: Usuario, tareaId: string, alcance: 'esta' | 'siguientes' = 'esta'): Resultado<number> {
  const offline = sinConexion()
  if (offline) return offline
  const db = getDB()
  const t = db.tareas.find((x) => x.id === tareaId)
  if (!t) return fallo(ERROR_NO_ENCONTRADO)
  const adulto = db.adultos.find((a) => a.id === t.adultoId)
  const denegado = verificar(actor, 'agenda:gestionar', 'tarea', adulto, tareaId)
  if (denegado) return denegado
  if (!abierta(t)) return fallo(`Esta tarea ya está ${t.estado === 'completada' ? 'completada' : 'cancelada'}.`)
  let total = 0
  mutate((draft) => {
    const x = draft.tareas.find((y) => y.id === tareaId)
    if (!x) return
    const objetivos = alcance === 'siguientes' && claveSerie(x) ? siguientesDeSerie(draft.tareas, x) : [x]
    const ahora = new Date().toISOString()
    for (const o of objetivos) {
      o.estado = 'cancelada'
      o.actualizadoEn = ahora
    }
    total = objetivos.length
    auditar(draft, actor, {
      accion: 'tarea.estado',
      entidad: 'tarea',
      registroId: tareaId,
      detalle: total > 1 ? `cancelada · ${total} ocurrencias de «${x.titulo}»` : 'cancelada',
    })
    const usuarioId = usuarioDeCuidador(draft, x.cuidadorId)
    if (usuarioId && usuarioId !== actor.id) {
      notificar(draft, usuarioId, actor.orgId, total > 1 ? `Se cancelaron ${total} tareas «${x.titulo}», desde el ${cuando(x)}.` : `Se canceló la tarea «${x.titulo}» (${cuando(x)}).`)
    }
  })
  return total > 0 ? exito(total) : fallo(ERROR_NO_ENCONTRADO)
}

/* ───────────── Evidencias ───────────── */

/** Metadatos del archivo elegido (para comprobar RS-013 también en la capa de servicios). */
export interface MetaArchivoEvidencia {
  nombre: string
  /** Tipo MIME informado por el navegador (puede estar vacío: entonces cuenta la extensión del nombre). */
  tipo: string
  /** Tamaño del archivo original, en bytes. */
  tamano: number
}

const extensionDe = (nombre: string) => nombre.split('.').pop()?.toLowerCase() ?? ''

/** Mensaje si el tipo o el tamaño del archivo no cumplen RS-013; undefined si son válidos. */
export function errorArchivoEvidencia(meta: Pick<MetaArchivoEvidencia, 'nombre' | 'tipo' | 'tamano'>): string | undefined {
  const tipoOk = meta.tipo ? (EVIDENCIA_TIPOS as readonly string[]).includes(meta.tipo) : (EVIDENCIA_EXTENSIONES as readonly string[]).includes(extensionDe(meta.nombre))
  if (!tipoOk) return 'Tipo de archivo no permitido. Usa una foto JPG, PNG o WEBP, o un documento PDF.'
  if (meta.tamano <= 0) return 'El archivo está vacío.'
  if (meta.tamano > EVIDENCIA_MAX_BYTES) {
    return `El archivo pesa ${(meta.tamano / 1024 / 1024).toFixed(1).replace('.', ',')} MB y el máximo es ${EVIDENCIA_MAX_BYTES / 1024 / 1024} MB.`
  }
  return undefined
}

/**
 * Adjunta una evidencia a la tarea. `archivo` es la miniatura (dataURL) de una imagen o el nombre de un PDF. Queda
 * en estado `pendiente` hasta que quien tiene `evidencias:validar` la valide o la rechace. Observación opcional.
 */
export function registrarEvidencia(actor: Usuario, tareaId: string, archivo: string, observacion: string, meta?: MetaArchivoEvidencia): Resultado<Evidencia> {
  const offline = sinConexion()
  if (offline) return offline
  const db = getDB()
  const t = db.tareas.find((x) => x.id === tareaId)
  if (!t) return fallo(ERROR_NO_ENCONTRADO)
  const adulto = db.adultos.find((a) => a.id === t.adultoId)
  const gestiona = puede(actor, 'agenda:gestionar', adulto)
  const ejecuta = puede(actor, 'agenda:ejecutar') && esSuTarea(db, actor, t)
  if (!gestiona && !ejecuta) return sinPermiso(actor, tareaId, 'agenda:ejecutar')
  if (t.estado === 'cancelada') return fallo('La tarea está cancelada: ya no admite evidencias.')
  const errores: Record<string, string | undefined> = {}
  const nombre = meta?.nombre ?? archivo
  if (!archivo) errores.archivo = 'Adjunta una foto o un documento PDF.'
  else if (meta) errores.archivo = errorArchivoEvidencia(meta)
  else if (!archivo.startsWith('data:image/') && !(EVIDENCIA_EXTENSIONES as readonly string[]).includes(extensionDe(archivo))) {
    errores.archivo = 'Tipo de archivo no permitido. Usa una foto JPG, PNG o WEBP, o un documento PDF.'
  }
  if (!errores.archivo && archivo.length > MAX_MINIATURA_CHARS) errores.archivo = 'La imagen es demasiado grande para guardarla. Elige otra foto.'
  if (observacion.length > MAX_OBSERVACION_EVIDENCIA) errores.observacion = `Máximo ${MAX_OBSERVACION_EVIDENCIA} caracteres.`
  const vigentes = db.evidencias.filter((e) => e.tareaId === tareaId && e.estadoValidacion !== 'rechazada').length
  if (!errores.archivo && vigentes >= EVIDENCIA_MAX_POR_TAREA) errores.archivo = `Una tarea admite hasta ${EVIDENCIA_MAX_POR_TAREA} evidencias.`
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  const evidencia: EvidenciaDetallada = {
    id: uid('ev'),
    tareaId,
    fechaRegistro: new Date().toISOString(),
    archivo,
    ...(observacion.trim() ? { observacion: observacion.trim() } : {}),
    estadoValidacion: 'pendiente',
    registradaPor: actor.id,
    ...(meta ? { nombreArchivo: nombre, tipoArchivo: meta.tipo || undefined, tamano: meta.tamano } : {}),
  }
  mutate((draft) => {
    draft.evidencias.push(evidencia)
    auditar(draft, actor, { accion: 'tarea.evidencia', entidad: 'tarea', registroId: tareaId, detalle: 'Evidencia adjuntada, pendiente de validación' })
  })
  return exito(evidencia)
}

/**
 * Valida o rechaza una evidencia pendiente (solo con `evidencias:validar` sobre el adulto de la tarea). Guarda quién y
 * cuándo, lo audita y avisa a quien la registró y al cuidador de la tarea. El rechazo exige un motivo.
 *  - Validada: si la tarea requiere evidencia y sigue abierta, queda completada.
 *  - Rechazada: si la tarea requiere evidencia y no tiene otra validada, vuelve a pendiente (con el motivo visible).
 */
export function validarEvidencia(actor: Usuario, evidenciaId: string, estado: 'validada' | 'rechazada', motivo = ''): Resultado<{ tareaCompletada: boolean }> {
  const offline = sinConexion()
  if (offline) return offline
  const db = getDB()
  const ev = db.evidencias.find((x) => x.id === evidenciaId)
  if (!ev) return fallo(ERROR_NO_ENCONTRADO)
  const t = db.tareas.find((x) => x.id === ev.tareaId)
  const denegado = verificar(actor, 'evidencias:validar', 'tarea', db.adultos.find((a) => a.id === t?.adultoId), ev.tareaId)
  if (denegado) return denegado
  if (!t) return fallo(ERROR_NO_ENCONTRADO)
  if (ev.estadoValidacion !== 'pendiente') return fallo(`Esta evidencia ya fue ${ev.estadoValidacion === 'validada' ? 'validada' : 'rechazada'}.`)
  const motivoLimpio = motivo.trim()
  if (estado === 'rechazada') {
    if (motivoLimpio.length < 5) return fallo(ERROR_VALIDACION, { motivo: 'Indica el motivo del rechazo (mínimo 5 caracteres) para que el cuidador sepa qué corregir.' })
    if (motivoLimpio.length > MAX_MOTIVO_RECHAZO) return fallo(ERROR_VALIDACION, { motivo: `Máximo ${MAX_MOTIVO_RECHAZO} caracteres.` })
  }
  let tareaCompletada = false
  mutate((draft) => {
    const x = draft.evidencias.find((y) => y.id === evidenciaId) as EvidenciaDetallada | undefined
    const tarea = draft.tareas.find((y) => y.id === ev.tareaId)
    if (!x || !tarea) return
    const ahora = new Date().toISOString()
    x.estadoValidacion = estado
    x.validadaPor = actor.id
    x.validadaEn = ahora
    if (estado === 'rechazada') x.motivoRechazo = motivoLimpio
    auditar(draft, actor, {
      accion: 'tarea.evidencia',
      entidad: 'tarea',
      registroId: tarea.id,
      detalle: estado === 'validada' ? 'Evidencia validada' : `Evidencia rechazada: ${motivoLimpio}`,
    })

    let efecto = ''
    if (tarea.requiereEvidencia && estado === 'validada' && abierta(tarea)) {
      tarea.estado = 'completada'
      tarea.actualizadoEn = ahora
      tareaCompletada = true
      efecto = ' La tarea quedó completada.'
      auditar(draft, actor, { accion: 'tarea.estado', entidad: 'tarea', registroId: tarea.id, detalle: 'completada (evidencia validada)' })
    } else if (
      tarea.requiereEvidencia &&
      estado === 'rechazada' &&
      tarea.estado !== 'cancelada' &&
      tarea.estado !== 'pendiente' &&
      !draft.evidencias.some((y) => y.tareaId === tarea.id && y.id !== evidenciaId && y.estadoValidacion === 'validada')
    ) {
      tarea.estado = 'pendiente'
      tarea.actualizadoEn = ahora
      efecto = ' La tarea volvió a pendiente.'
      auditar(draft, actor, { accion: 'tarea.estado', entidad: 'tarea', registroId: tarea.id, detalle: 'pendiente (evidencia rechazada)' })
    }

    // Aviso a quien registró la evidencia y al cuidador de la tarea (sin duplicar ni avisar a quien decide).
    const destinatarios = new Set([x.registradaPor, usuarioDeCuidador(draft, tarea.cuidadorId)].filter((id): id is string => !!id && id !== actor.id))
    for (const usuarioId of destinatarios) {
      notificar(
        draft,
        usuarioId,
        actor.orgId,
        estado === 'validada'
          ? `Tu evidencia de la tarea «${tarea.titulo}» fue validada.${efecto}`
          : `Tu evidencia de la tarea «${tarea.titulo}» fue rechazada: ${motivoLimpio}.${efecto} Adjunta una nueva.`,
      )
    }
  })
  return exito({ tareaCompletada })
}
