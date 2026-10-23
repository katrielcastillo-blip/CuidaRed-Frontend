/*
 * adultos.ts — Servicios de perfiles de adultos mayores (RF-01 · CU-02, CU-03, CU-04): tabla Envejeciente y sus
 * relaciones Contacto_emergencia, Vinculo y Env_Riesgo (+ evaluación de riesgo).
 * Módulo: dominio · servicios.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { auditar } from '../auditoria'
import { AUTONOMIAS, CONDICIONES } from '../catalogos'
import { contactoPrincipal } from '../relaciones'
import { getDB, mutate, uid } from '../store'
import type { Adulto, Autonomia, ContactoEmergencia, DB, EnvRiesgo, Evaluacion, Riesgo, TipoVinculo, Usuario } from '../types'
import { enLista, errorCedula, errorFechaNacimiento, errorNombre, errorTelefono, errorTexto, hayErrores, limpiarTexto } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from './comun'

/** Parentescos predefinidos para los contactos de emergencia (Contacto_emergencia.Contacto_Parentesco). */
export const PARENTESCOS = ['Hijo/a', 'Esposo/a', 'Hermano/a', 'Nieto/a', 'Sobrino/a', 'Otro familiar', 'Vecino/a', 'Amigo/a', 'Otro']

/** Datos del formulario de perfil (registro y edición). El contacto es el principal (los demás se gestionan en el perfil). */
export interface DatosAdulto {
  nombre: string
  apellido: string
  cedula: string
  fechaNacimiento: string
  sexo: Adulto['sexo'] | ''
  telefono: string
  provinciaCod: string
  municipioCod: string
  zona: string
  direccion: string
  contactoNombres: string
  contactoApellidos: string
  contactoParentesco: string
  contactoTelefono: string
  autonomia: Autonomia | ''
  condiciones: string[]
  notaCondicion: string
  riesgo: Riesgo | ''
  /** Motivo de la clasificación de riesgo (Env_Riesgo.Riesgo_Motivo). */
  motivoRiesgo: string
  consentimiento: boolean
  consentimientoPor: 'adulto' | 'representante'
}

export const DATOS_ADULTO_VACIOS: DatosAdulto = {
  nombre: '',
  apellido: '',
  cedula: '',
  fechaNacimiento: '',
  sexo: '',
  telefono: '',
  provinciaCod: '',
  municipioCod: '',
  zona: '',
  direccion: '',
  contactoNombres: '',
  contactoApellidos: '',
  contactoParentesco: '',
  contactoTelefono: '',
  autonomia: '',
  condiciones: [],
  notaCondicion: '',
  riesgo: '',
  motivoRiesgo: '',
  consentimiento: false,
  consentimientoPor: 'adulto',
}

export function datosDesdeAdulto(a: Adulto, db: Pick<DB, 'contactos' | 'catalogos' | 'riesgos'> = getDB()): DatosAdulto {
  const c = contactoPrincipal(db.contactos, a.id)
  const ultimoSocial = db.riesgos.filter((r) => r.adultoId === a.id && r.riesgoId === 'r-social').sort((x, y) => y.fecha.localeCompare(x.fecha))[0]
  return {
    nombre: a.nombre,
    apellido: a.apellido,
    cedula: a.cedula,
    fechaNacimiento: a.fechaNacimiento,
    sexo: a.sexo,
    telefono: a.telefono,
    provinciaCod: db.catalogos.municipios.find((m) => m.cod === a.municipioCod)?.provinciaCod ?? '',
    municipioCod: a.municipioCod,
    zona: a.zona,
    direccion: a.direccion,
    contactoNombres: c?.nombres ?? '',
    contactoApellidos: c?.apellidos ?? '',
    contactoParentesco: c?.parentesco ?? '',
    contactoTelefono: c?.telefono ?? '',
    autonomia: a.condicionGeneral.autonomia,
    condiciones: [...a.condicionGeneral.condiciones],
    notaCondicion: a.condicionGeneral.nota ?? '',
    riesgo: a.riesgo,
    motivoRiesgo: ultimoSocial?.motivo ?? '',
    consentimiento: a.consentimiento?.otorgado ?? false,
    consentimientoPor: a.consentimiento?.otorgadoPor ?? 'adulto',
  }
}

const RIESGOS: Riesgo[] = ['bajo', 'medio', 'alto']
const PESO: Record<Riesgo, number> = { bajo: 0, medio: 1, alto: 2 }
const AUTONOMIA_VALORES = AUTONOMIAS.map((x) => x.value)
const CONDICION_VALORES = CONDICIONES.map((x) => x.value)

/** Validación completa del perfil; `idActual` evita marcar como duplicada la cédula del propio perfil. */
export function validarAdulto(d: DatosAdulto, adultos: Adulto[], idActual?: string, orgId?: string, municipios = getDB().catalogos.municipios) {
  const cedulaDuplicada = d.cedula && adultos.some((a) => a.id !== idActual && a.cedula === d.cedula.trim() && (!orgId || a.orgId === orgId))
  return {
    nombre: errorNombre(d.nombre, 'nombre'),
    apellido: errorNombre(d.apellido, 'apellido'),
    cedula: errorCedula(d.cedula) ?? (cedulaDuplicada ? 'Ya existe un perfil registrado con esta cédula.' : undefined),
    fechaNacimiento: errorFechaNacimiento(d.fechaNacimiento),
    sexo: d.sexo === 'Femenino' || d.sexo === 'Masculino' ? undefined : 'Selecciona el sexo.',
    telefono: errorTelefono(d.telefono, false),
    provinciaCod: d.provinciaCod ? undefined : 'Selecciona la provincia.',
    municipioCod: municipios.some((m) => m.cod === d.municipioCod && m.provinciaCod === d.provinciaCod) ? undefined : 'Selecciona el municipio.',
    zona: d.zona.trim() ? (d.zona.length > 60 ? 'Máximo 60 caracteres.' : undefined) : 'Indica el sector o barrio.',
    direccion: d.direccion.length > 150 ? 'Máximo 150 caracteres.' : undefined,
    contactoNombres: errorNombre(d.contactoNombres, 'nombre del contacto'),
    contactoApellidos: errorNombre(d.contactoApellidos, 'apellido del contacto'),
    contactoParentesco: d.contactoParentesco ? undefined : 'Selecciona el parentesco.',
    contactoTelefono: errorTelefono(d.contactoTelefono),
    autonomia: enLista(d.autonomia, AUTONOMIA_VALORES) ? undefined : 'Selecciona el grado de autonomía.',
    condiciones: d.condiciones.every((c) => CONDICION_VALORES.includes(c)) ? undefined : 'Hay condiciones no válidas.',
    notaCondicion: d.notaCondicion.length > 200 ? 'Máximo 200 caracteres.' : undefined,
    riesgo: enLista(d.riesgo, RIESGOS) ? undefined : 'Asigna el nivel de riesgo social.',
    motivoRiesgo: d.motivoRiesgo.length > 200 ? 'Máximo 200 caracteres.' : undefined,
    consentimiento: d.consentimiento ? undefined : 'Confirma que se obtuvo el consentimiento informado.',
  }
}

/**
 * [desnormalizado] El nivel de riesgo del adulto es el más alto entre sus registros de Env_Riesgo vigentes
 * (si no hay ninguno vigente, se conserva el último conocido). Se llama dentro de un mutate.
 */
export function recalcularRiesgo(db: DB, adultoId: string) {
  const a = db.adultos.find((x) => x.id === adultoId)
  if (!a) return
  const vigentes = db.riesgos.filter((r) => r.adultoId === adultoId && r.estado === 'vigente')
  if (vigentes.length === 0) return
  a.riesgo = vigentes.reduce<Riesgo>((max, r) => (PESO[r.nivel] > PESO[max] ? r.nivel : max), 'bajo')
}

/** Registra la clasificación general de riesgo social (r-social) y deja superada la anterior. */
function clasificarRiesgoSocial(db: DB, adultoId: string, nivel: Riesgo, motivo: string, actor: Usuario, ahora: string) {
  for (const r of db.riesgos) if (r.adultoId === adultoId && r.riesgoId === 'r-social' && r.estado === 'vigente') r.estado = 'superado'
  db.riesgos.push({ id: uid('er'), adultoId, riesgoId: 'r-social', fecha: ahora, nivel, estado: 'vigente', motivo: motivo.trim() || 'Clasificación asignada en el perfil.', registradoPor: actor.id })
  recalcularRiesgo(db, adultoId)
}

const contactoDesdeDatos = (d: DatosAdulto, adultoId: string, id = uid('ce')): ContactoEmergencia => ({
  id,
  adultoId,
  nombres: limpiarTexto(d.contactoNombres),
  apellidos: limpiarTexto(d.contactoApellidos),
  parentesco: d.contactoParentesco,
  telefono: d.contactoTelefono.trim(),
  esPrincipal: true,
})

/** Crea el perfil (Envejeciente), su contacto principal y su clasificación de riesgo inicial (CU-02). */
export function crearAdulto(actor: Usuario, d: DatosAdulto): Resultado<Adulto> {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, 'adultos:crear', 'adulto')
  if (denegado) return denegado
  const errores = validarAdulto(d, getDB().adultos, undefined, actor.orgId)
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)

  const ahora = new Date().toISOString()
  const id = uid('a')
  let creado: Adulto | undefined
  mutate((db) => {
    creado = {
      id,
      orgId: actor.orgId,
      nombre: limpiarTexto(d.nombre),
      apellido: limpiarTexto(d.apellido),
      cedula: d.cedula.trim(),
      fechaNacimiento: d.fechaNacimiento,
      sexo: d.sexo as Adulto['sexo'],
      telefono: d.telefono.trim(),
      municipioCod: d.municipioCod,
      zona: limpiarTexto(d.zona),
      direccion: limpiarTexto(d.direccion),
      riesgo: d.riesgo as Riesgo,
      condicionGeneral: { autonomia: d.autonomia as Autonomia, condiciones: [...d.condiciones], ...(d.notaCondicion.trim() ? { nota: d.notaCondicion.trim() } : {}) },
      consentimiento: { otorgado: true, otorgadoPor: d.consentimientoPor, fecha: ahora, registradoPor: actor.id },
      estado: 'activo',
      registradoPor: actor.id,
      creadoEn: ahora,
      actualizadoEn: ahora,
      actualizadoPor: actor.id,
    }
    db.adultos.push(creado)
    db.contactos.push(contactoDesdeDatos(d, id))
    clasificarRiesgoSocial(db, id, d.riesgo as Riesgo, d.motivoRiesgo, actor, ahora)
    auditar(db, actor, { accion: 'adulto.crear', entidad: 'adulto', registroId: id, detalle: `Riesgo asignado: ${d.riesgo}` })
  })
  return creado ? exito(creado) : fallo('No se pudo registrar el perfil.')
}

/** Edita el perfil (CU-03): datos, contacto principal y, si cambió, la clasificación de riesgo. */
export function actualizarAdulto(actor: Usuario, id: string, d: DatosAdulto): Resultado<Adulto> {
  const offline = sinConexion()
  if (offline) return offline
  const actual = getDB().adultos.find((a) => a.id === id)
  if (!actual) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'adultos:editar', 'adulto', actual)
  if (denegado) return denegado
  const errores = validarAdulto(d, getDB().adultos, id, actor.orgId)
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)

  const cambios: string[] = []
  let resultado: Adulto | undefined
  mutate((db) => {
    const a = db.adultos.find((x) => x.id === id)
    if (!a) return
    const ahora = new Date().toISOString()
    a.nombre = limpiarTexto(d.nombre)
    a.apellido = limpiarTexto(d.apellido)
    a.cedula = d.cedula.trim()
    a.fechaNacimiento = d.fechaNacimiento
    a.telefono = d.telefono.trim()
    a.sexo = d.sexo as Adulto['sexo']
    a.municipioCod = d.municipioCod
    a.zona = limpiarTexto(d.zona)
    a.direccion = limpiarTexto(d.direccion)
    a.condicionGeneral = { autonomia: d.autonomia as Autonomia, condiciones: [...d.condiciones], ...(d.notaCondicion.trim() ? { nota: d.notaCondicion.trim() } : {}) }
    if (!a.consentimiento?.otorgado || a.consentimiento.otorgadoPor !== d.consentimientoPor) {
      a.consentimiento = { otorgado: true, otorgadoPor: d.consentimientoPor, fecha: ahora, registradoPor: actor.id }
    }
    // Contacto principal
    const principal = db.contactos.find((c) => c.adultoId === id && c.esPrincipal)
    if (principal) Object.assign(principal, contactoDesdeDatos(d, id, principal.id))
    else db.contactos.push(contactoDesdeDatos(d, id))
    // Riesgo: un cambio de clasificación queda en el historial (Env_Riesgo)
    const socialVigente = db.riesgos.find((r) => r.adultoId === id && r.riesgoId === 'r-social' && r.estado === 'vigente')
    if (!socialVigente || socialVigente.nivel !== d.riesgo) {
      cambios.push(`riesgo social ${socialVigente?.nivel ?? '—'} → ${d.riesgo}`)
      clasificarRiesgoSocial(db, id, d.riesgo as Riesgo, d.motivoRiesgo, actor, ahora)
    }
    a.actualizadoEn = ahora
    a.actualizadoPor = actor.id
    resultado = a
    auditar(db, actor, { accion: 'adulto.editar', entidad: 'adulto', registroId: id, detalle: cambios.join('; ') || 'Datos del perfil' })
  })
  return resultado ? exito(resultado) : fallo(ERROR_NO_ENCONTRADO)
}

export function cambiarEstadoAdulto(actor: Usuario, id: string, estado: Adulto['estado']): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const a = getDB().adultos.find((x) => x.id === id)
  if (!a) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'adultos:desactivar', 'adulto', a)
  if (denegado) return denegado
  mutate((db) => {
    const x = db.adultos.find((y) => y.id === id)
    if (!x) return
    x.estado = estado
    x.actualizadoEn = new Date().toISOString()
    x.actualizadoPor = actor.id
    auditar(db, actor, { accion: estado === 'activo' ? 'adulto.reactivar' : 'adulto.desactivar', entidad: 'adulto', registroId: id })
  })
  return exito(undefined)
}

/* ───────────── Contactos de emergencia ───────────── */

export interface DatosContacto {
  nombres: string
  apellidos: string
  parentesco: string
  telefono: string
  esPrincipal: boolean
}

export function validarContacto(d: DatosContacto) {
  return {
    nombres: errorNombre(d.nombres, 'nombre'),
    apellidos: errorNombre(d.apellidos, 'apellido'),
    parentesco: d.parentesco ? undefined : 'Selecciona el parentesco.',
    telefono: errorTelefono(d.telefono),
  }
}

/** Crea o edita un contacto de emergencia. Si es principal, los demás dejan de serlo (uno solo principal). */
export function guardarContacto(actor: Usuario, adultoId: string, d: DatosContacto, contactoId?: string): Resultado<ContactoEmergencia> {
  const offline = sinConexion()
  if (offline) return offline
  const a = getDB().adultos.find((x) => x.id === adultoId)
  if (!a) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'adultos:editar', 'adulto', a)
  if (denegado) return denegado
  const errores = validarContacto(d)
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  let guardado: ContactoEmergencia | undefined
  mutate((db) => {
    const lista = db.contactos.filter((c) => c.adultoId === adultoId)
    const principal = d.esPrincipal || lista.length === 0 || (lista.length === 1 && lista[0]!.id === contactoId)
    if (principal) for (const c of lista) c.esPrincipal = false
    const datos = { nombres: limpiarTexto(d.nombres), apellidos: limpiarTexto(d.apellidos), parentesco: d.parentesco, telefono: d.telefono.trim(), esPrincipal: principal }
    const existente = contactoId ? db.contactos.find((c) => c.id === contactoId && c.adultoId === adultoId) : undefined
    if (existente) {
      Object.assign(existente, datos)
      guardado = existente
    } else {
      guardado = { id: uid('ce'), adultoId, ...datos }
      db.contactos.push(guardado)
    }
    auditar(db, actor, { accion: 'adulto.contacto', entidad: 'adulto', registroId: adultoId, detalle: `${existente ? 'Edición' : 'Alta'} de contacto (${d.parentesco})` })
  })
  return guardado ? exito(guardado) : fallo(ERROR_NO_ENCONTRADO)
}

export function eliminarContacto(actor: Usuario, contactoId: string): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const c = getDB().contactos.find((x) => x.id === contactoId)
  if (!c) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'adultos:editar', 'adulto', getDB().adultos.find((a) => a.id === c.adultoId))
  if (denegado) return denegado
  if (getDB().contactos.filter((x) => x.adultoId === c.adultoId).length <= 1) return fallo('El perfil debe conservar al menos un contacto de emergencia.')
  mutate((db) => {
    db.contactos = db.contactos.filter((x) => x.id !== contactoId)
    if (c.esPrincipal) {
      const siguiente = db.contactos.find((x) => x.adultoId === c.adultoId)
      if (siguiente) siguiente.esPrincipal = true
    }
    auditar(db, actor, { accion: 'adulto.contacto', entidad: 'adulto', registroId: c.adultoId, detalle: 'Contacto eliminado' })
  })
  return exito(undefined)
}

/* ───────────── Vínculos (Vinculo) ───────────── */

/**
 * Reemplaza los usuarios vinculados al adulto con un tipo de vínculo (p. ej. voluntarios asignados o
 * familiares responsables). Valida que el rol del usuario corresponda al tipo de vínculo.
 */
export function asignarVinculos(actor: Usuario, adultoId: string, tipo: TipoVinculo, usuarioIds: string[]): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const a = getDB().adultos.find((x) => x.id === adultoId)
  if (!a) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'adultos:asignar', 'adulto', a)
  if (denegado) return denegado
  const rolEsperado = tipo === 'voluntario_asignado' ? 'voluntario' : tipo === 'familiar_responsable' ? 'familiar' : null
  const validos = getDB().usuarios.filter((u) => usuarioIds.includes(u.id) && u.orgId === a.orgId && (!rolEsperado || u.rol === rolEsperado))
  if (validos.length !== usuarioIds.length) return fallo(rolEsperado ? `Solo se pueden vincular usuarios con rol ${rolEsperado} de la organización.` : 'Hay usuarios no válidos.')
  mutate((db) => {
    const ahora = new Date().toISOString()
    const previos = db.vinculos.filter((v) => v.adultoId === adultoId && v.tipoVinculoId === tipo)
    db.vinculos = db.vinculos.filter((v) => !(v.adultoId === adultoId && v.tipoVinculoId === tipo && !usuarioIds.includes(v.usuarioId)))
    for (const u of usuarioIds) {
      if (!previos.some((v) => v.usuarioId === u)) {
        // Un usuario tiene un solo vínculo por adulto (PK Env_Id + User_Id): se reemplaza el anterior.
        db.vinculos = db.vinculos.filter((v) => !(v.adultoId === adultoId && v.usuarioId === u))
        db.vinculos.push({ adultoId, usuarioId: u, tipoVinculoId: tipo, creadoEn: ahora })
      }
    }
    const x = db.adultos.find((y) => y.id === adultoId)
    if (x) {
      x.actualizadoEn = ahora
      x.actualizadoPor = actor.id
    }
    auditar(db, actor, { accion: 'adulto.asignar', entidad: 'adulto', registroId: adultoId, detalle: `${tipo}: ${usuarioIds.length} usuario(s)` })
  })
  return exito(undefined)
}

/** Compatibilidad: asignar voluntarios = vínculos "voluntario_asignado". */
export const asignarVoluntarios = (actor: Usuario, adultoId: string, voluntarioIds: string[]) => asignarVinculos(actor, adultoId, 'voluntario_asignado', voluntarioIds)

/* ───────────── Riesgos (Env_Riesgo) ───────────── */

export interface DatosRiesgo {
  riesgoId: string
  nivel: Riesgo | ''
  motivo: string
  observacion: string
}

/** Registra un factor de riesgo identificado (Env_Riesgo). Puede elevar el nivel del adulto y disparar RF-04. */
export function registrarRiesgo(actor: Usuario, adultoId: string, d: DatosRiesgo): Resultado<EnvRiesgo> {
  const offline = sinConexion()
  if (offline) return offline
  const a = getDB().adultos.find((x) => x.id === adultoId)
  if (!a) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'adultos:evaluar', 'adulto', a)
  if (denegado) return denegado
  const errores = {
    riesgoId: getDB().catalogos.riesgos.some((r) => r.id === d.riesgoId) ? undefined : 'Selecciona el factor de riesgo.',
    nivel: enLista(d.nivel, RIESGOS) ? undefined : 'Selecciona el nivel.',
    motivo: errorTexto(d.motivo, 'el motivo', 5, 200),
    observacion: d.observacion.length > 300 ? 'Máximo 300 caracteres.' : undefined,
  }
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  const registro: EnvRiesgo = { id: uid('er'), adultoId, riesgoId: d.riesgoId, fecha: new Date().toISOString(), nivel: d.nivel as Riesgo, estado: 'vigente', motivo: d.motivo.trim(), ...(d.observacion.trim() ? { observacion: d.observacion.trim() } : {}), registradoPor: actor.id }
  mutate((db) => {
    db.riesgos.push(registro)
    recalcularRiesgo(db, adultoId)
    auditar(db, actor, { accion: 'adulto.riesgo', entidad: 'adulto', registroId: adultoId, detalle: `Factor ${d.riesgoId} · nivel ${d.nivel}` })
  })
  return exito(registro)
}

/** Marca un factor de riesgo como superado (o vuelve a ponerlo vigente) y recalcula el nivel. */
export function cambiarEstadoRiesgo(actor: Usuario, registroId: string, estado: EnvRiesgo['estado'], observacion = ''): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const r = getDB().riesgos.find((x) => x.id === registroId)
  if (!r) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'adultos:evaluar', 'adulto', getDB().adultos.find((a) => a.id === r.adultoId))
  if (denegado) return denegado
  if (estado === 'superado' && getDB().riesgos.filter((x) => x.adultoId === r.adultoId && x.estado === 'vigente').length <= 1) {
    return fallo('Debe quedar al menos un registro de riesgo vigente: registra la nueva clasificación antes de cerrar esta.')
  }
  mutate((db) => {
    const x = db.riesgos.find((y) => y.id === registroId)
    if (!x) return
    x.estado = estado
    if (observacion.trim()) x.observacion = observacion.trim()
    recalcularRiesgo(db, x.adultoId)
    auditar(db, actor, { accion: 'adulto.riesgo', entidad: 'adulto', registroId: x.adultoId, detalle: `Factor ${x.riesgoId} → ${estado}` })
  })
  return exito(undefined)
}

/** Guarda la evaluación de riesgo (cuestionario) como registro de Env_Riesgo "r-evaluacion". */
export function guardarEvaluacionRiesgo(actor: Usuario, adultoId: string, evaluacion: Omit<Evaluacion, 'fecha' | 'evaluadoPor'>): Resultado<Evaluacion> {
  const offline = sinConexion()
  if (offline) return offline
  const a = getDB().adultos.find((x) => x.id === adultoId)
  if (!a) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'adultos:evaluar', 'adulto', a)
  if (denegado) return denegado
  if (!RIESGOS.includes(evaluacion.nivel) || evaluacion.puntaje < 0 || evaluacion.puntaje > 100) return fallo('Evaluación no válida.')
  const completa: Evaluacion = { ...evaluacion, fecha: new Date().toISOString(), evaluadoPor: actor.id }
  mutate((db) => {
    const x = db.adultos.find((y) => y.id === adultoId)
    if (!x) return
    x.evaluacion = completa
    // La evaluación reemplaza la clasificación general anterior (social y evaluaciones previas).
    for (const r of db.riesgos) if (r.adultoId === adultoId && (r.riesgoId === 'r-social' || r.riesgoId === 'r-evaluacion') && r.estado === 'vigente') r.estado = 'superado'
    db.riesgos.push({ id: uid('er'), adultoId, riesgoId: 'r-evaluacion', fecha: completa.fecha, nivel: completa.nivel, estado: 'vigente', motivo: `Evaluación de riesgo: ${completa.puntaje} de 100 puntos.`, registradoPor: actor.id })
    recalcularRiesgo(db, adultoId)
    x.actualizadoEn = completa.fecha
    x.actualizadoPor = actor.id
    auditar(db, actor, { accion: 'adulto.riesgo', entidad: 'adulto', registroId: adultoId, detalle: `Puntaje ${completa.puntaje} · nivel ${completa.nivel}` })
  })
  return exito(completa)
}

/**
 * Anonimiza un perfil inactivo según la política de retención (SRS §8.2.2.3.4 f): elimina los datos que
 * identifican a la persona (y sus contactos) y conserva los registros para las estadísticas. No se puede deshacer.
 */
export function anonimizarAdulto(actor: Usuario, id: string): Resultado {
  const offline = sinConexion()
  if (offline) return offline
  const a = getDB().adultos.find((x) => x.id === id)
  if (!a) return fallo(ERROR_NO_ENCONTRADO)
  const denegado = verificar(actor, 'adultos:anonimizar', 'adulto', a)
  if (denegado) return denegado
  if (a.estado !== 'inactivo') return fallo('Solo se pueden anonimizar perfiles inactivos.')
  mutate((db) => {
    const x = db.adultos.find((y) => y.id === id)
    if (!x) return
    x.nombre = 'Perfil'
    x.apellido = 'anonimizado'
    x.cedula = '000-0000000-0'
    x.telefono = ''
    x.direccion = ''
    x.condicionGeneral = { autonomia: x.condicionGeneral.autonomia, condiciones: [] }
    delete x.evaluacion
    delete x.foto
    x.anonimizado = true
    x.actualizadoEn = new Date().toISOString()
    x.actualizadoPor = actor.id
    db.contactos = db.contactos.filter((c) => c.adultoId !== id)
    db.vinculos = db.vinculos.filter((v) => v.adultoId !== id)
    for (const r of db.riesgos) if (r.adultoId === id) delete r.observacion
    for (const im of db.indicaciones) if (im.adultoId === id) im.descripcion = '[Anonimizado]'
    for (const v of db.visitas) if (v.adultoId === id) v.observaciones = v.observaciones ? '[Anonimizado]' : v.observaciones
    for (const n of db.necesidades) if (n.adultoId === id) n.descripcion = '[Anonimizado]'
    auditar(db, actor, { accion: 'adulto.anonimizar', entidad: 'adulto', registroId: id })
  })
  return exito(undefined)
}
