/*
 * permisos.ts — Control de acceso basado en roles (RBAC) y alcance de los datos.
 * Módulo: dominio · seguridad (RF-09 · CU-13 · SRS §8.2.2.3.4 b/c · §8.2.2.3.5 c/d · Reglas de Negocio V2).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Única fuente de verdad de "quién puede hacer qué". Se aplica en dos capas:
 *  - Interfaz: guards de rutas (<RequirePermiso>) y botones que solo aparecen si puede(...).
 *  - "Backend" local (domain/api/*): cada operación vuelve a comprobar el permiso y el alcance antes de
 *    escribir, y registra en auditoría los intentos denegados. Ocultar un botón no es el control.
 *
 * V2: los permisos dependen del rol de la membresía activa y del tipo de cuenta (Familia u Organización).
 */
import { tipoDeCuenta, type TipoCuenta } from './planes'
import { tieneVinculo } from './relaciones'
import type { Adulto, Organizacion, Rol, Usuario, Vinculo } from './types'

export type Accion =
  // Perfiles de adultos mayores (CU-02, CU-03, CU-04)
  | 'adultos:ver'
  | 'adultos:crear'
  | 'adultos:editar'
  | 'adultos:desactivar'
  | 'adultos:asignar'
  | 'adultos:evaluar'
  | 'adultos:anonimizar'
  | 'adultos:ver-sensible' // evaluación de riesgo, condición general y situación socioeconómica
  // Visitas (CU-05, CU-06)
  | 'visitas:ver'
  | 'visitas:registrar'
  | 'visitas:programar'
  | 'visitas:autorizar' // V2: un usuario principal autoriza la visita de un visitante concreto
  // Necesidades (CU-07, CU-08)
  | 'necesidades:ver'
  | 'necesidades:registrar'
  | 'necesidades:actualizar'
  // Alertas (CU-09, CU-10)
  | 'alertas:ver'
  | 'alertas:gestionar'
  | 'alertas:cerrar' // V2: el Cuidador puede cerrar alertas de sus adultos asignados
  // Resumen y reportes (CU-11, CU-12)
  | 'resumen:ver'
  | 'reportes:ver'
  | 'informe:exportar' // V2: informe médico (Coordinador y Cuidador)
  // Administración (CU-13)
  | 'usuarios:gestionar'
  | 'familiares:autorizar' // V2: permiso explícito de un familiar sobre un envejeciente
  | 'organizacion:configurar'
  | 'auditoria:ver'
  // Offline (CU-14)
  | 'sync:usar'
  // Módulos del modelo de datos V3.0
  | 'indicaciones:ver' // Indicacion_Medica (información de salud: acceso restringido)
  | 'indicaciones:gestionar'
  | 'agenda:ver' // Tarea_agenda
  | 'agenda:gestionar' // crear y asignar tareas
  | 'agenda:ejecutar' // completar tareas propias y subir evidencias
  | 'evidencias:validar' // Evidencias.Estado_validacion
  | 'cuenta:suscripcion' // Plan, Pago, Cuenta (suscripción)
  | 'cuidadores:gestionar' // Cuidador
  | 'catalogos:ver' // tablas de referencia y parámetros

/**
 * Matriz base de permisos por rol (principio de mínimo privilegio), según las Reglas de Negocio V2.
 * Los ajustes por tipo de cuenta están en AJUSTES_POR_TIPO (p. ej., en Familia el Coordinador gestiona accesos).
 */
export const MATRIZ: Record<Rol, readonly Accion[]> = {
  // Solo existe en cuentas Organización.
  admin: [
    'adultos:ver', 'adultos:crear', 'adultos:editar', 'adultos:desactivar', 'adultos:asignar', 'adultos:evaluar', 'adultos:anonimizar', 'adultos:ver-sensible',
    'visitas:ver', 'visitas:programar', 'visitas:autorizar',
    'necesidades:ver', 'necesidades:registrar', 'necesidades:actualizar',
    'alertas:ver', 'alertas:gestionar',
    'resumen:ver', 'reportes:ver',
    'usuarios:gestionar', 'familiares:autorizar', 'organizacion:configurar', 'auditoria:ver',
    'indicaciones:ver', 'agenda:ver', 'agenda:gestionar', 'evidencias:validar',
    'cuenta:suscripcion', 'cuidadores:gestionar', 'catalogos:ver',
  ],
  coordinador: [
    'adultos:ver', 'adultos:crear', 'adultos:editar', 'adultos:desactivar', 'adultos:asignar', 'adultos:evaluar', 'adultos:ver-sensible',
    'visitas:ver', 'visitas:registrar', 'visitas:programar', 'visitas:autorizar',
    'necesidades:ver', 'necesidades:registrar', 'necesidades:actualizar',
    'alertas:ver', 'alertas:gestionar',
    'resumen:ver', 'reportes:ver', 'informe:exportar',
    'sync:usar',
    'indicaciones:ver', 'indicaciones:gestionar', 'agenda:ver', 'agenda:gestionar', 'evidencias:validar',
  ],
  // V2 §Cuidador: visitas, necesidades, indicaciones médicas, tareas y evidencias de sus asignados; consulta el
  // riesgo sin modificarlo y puede cerrar alertas.
  cuidador: [
    'adultos:ver', 'adultos:ver-sensible',
    'visitas:ver', 'visitas:registrar',
    'necesidades:ver', 'necesidades:registrar', 'necesidades:actualizar',
    'alertas:ver', 'alertas:cerrar',
    'informe:exportar',
    'sync:usar',
    'indicaciones:ver', 'indicaciones:gestionar', 'agenda:ver', 'agenda:ejecutar',
  ],
  // V2 §Visita: el Voluntario únicamente registra que la visita ocurrió y deja una observación. Sin datos médicos
  // ni necesidades.
  voluntario: ['adultos:ver', 'visitas:ver', 'visitas:registrar', 'sync:usar'],
  // V2 §Indicacion_Medica: el Familiar consulta la información médica del envejeciente autorizado, sin modificarla.
  familiar: ['adultos:ver', 'visitas:ver', 'necesidades:ver', 'indicaciones:ver'],
}

/** Permisos adicionales según el tipo de cuenta (V2 §Cuenta, roles por tipo). */
export const AJUSTES_POR_TIPO: Record<TipoCuenta, Partial<Record<Rol, readonly Accion[]>>> = {
  // En Familia no hay Administrador: el Coordinador gestiona accesos, autoriza familiares y administra la cuenta.
  familia: {
    coordinador: ['usuarios:gestionar', 'familiares:autorizar', 'organizacion:configurar', 'cuenta:suscripcion', 'cuidadores:gestionar', 'auditoria:ver', 'catalogos:ver'],
  },
  organizacion: {},
}

/** Roles válidos por tipo de cuenta: un rol que no existe en ese tipo no recibe permisos. */
const ROL_VALIDO_EN: Record<TipoCuenta, readonly Rol[]> = {
  familia: ['coordinador', 'cuidador', 'familiar'],
  organizacion: ['admin', 'coordinador', 'cuidador', 'familiar', 'voluntario'],
}

/** Permisos efectivos de un rol en un tipo de cuenta. */
export function permisosDe(rol: Rol, tipo: TipoCuenta = 'organizacion'): readonly Accion[] {
  if (!ROL_VALIDO_EN[tipo].includes(rol)) return []
  return [...MATRIZ[rol], ...(AJUSTES_POR_TIPO[tipo][rol] ?? [])]
}

/** Descripción legible de cada rol (pantalla de gestión de usuarios). */
export const DESCRIPCION_ROL: Record<Rol, string> = {
  admin: 'Gestiona miembros, autoriza familiares y configura la organización y su suscripción. Acceso a perfiles, alertas y reportes.',
  coordinador:
    'Supervisa el seguimiento: registra perfiles, asigna cuidadores y tareas, autoriza visitas y atiende alertas. En una cuenta Familia también gestiona los accesos.',
  cuidador:
    'Registra visitas, necesidades e indicaciones médicas de los adultos mayores que tiene asignados, completa sus tareas con evidencia y puede cerrar alertas. Funciona sin conexión.',
  voluntario: 'Registra que la visita ocurrió y deja una observación sobre los adultos mayores que tiene asignados. No ve información médica ni necesidades.',
  familiar: 'Consulta visitas, necesidades e indicaciones de los adultos mayores para los que recibió permiso explícito. No modifica registros.',
}

/**
 * Origen de las tablas Vinculo y Cuenta cuando no se pasan explícitamente (el store las registra al iniciar).
 * Evita tener que pasarlas en cada llamada a puede() desde las pantallas.
 */
let fuenteVinculos: () => Vinculo[] = () => []
let fuenteOrgs: () => Organizacion[] = () => []
export function registrarFuenteVinculos(fn: () => Vinculo[]) {
  fuenteVinculos = fn
}
export function registrarFuenteOrgs(fn: () => Organizacion[]) {
  fuenteOrgs = fn
}

/** Tipo de la cuenta en la que actúa el usuario (según su membresía activa: Usuario.orgId). */
export const tipoCuentaDeUsuario = (u: Pick<Usuario, 'orgId'>): TipoCuenta => tipoDeCuenta(fuenteOrgs().find((o) => o.id === u.orgId))

/**
 * Alcance: ¿el usuario puede ver/operar sobre este adulto? (tabla Vinculo, V2 §Vínculo)
 *  - Administrador y coordinador: todos los adultos de su cuenta.
 *  - Cuidador: solo los adultos con vínculo "cuidador_asignado".
 *  - Voluntario: solo los adultos con vínculo "voluntario_asignado".
 *  - Familiar responsable: solo los adultos con permiso explícito ("familiar_responsable").
 */
export function alcanzaAdulto(u: Usuario, a: Adulto, vinculos: Vinculo[] = fuenteVinculos()): boolean {
  if (a.orgId !== u.orgId) return false
  switch (u.rol) {
    case 'admin':
    case 'coordinador':
      return true
    case 'cuidador':
      return tieneVinculo(vinculos, u.id, a.id, 'cuidador_asignado')
    case 'voluntario':
      return tieneVinculo(vinculos, u.id, a.id, 'voluntario_asignado')
    case 'familiar':
      return tieneVinculo(vinculos, u.id, a.id, 'familiar_responsable')
  }
}

/** ¿Puede el usuario realizar la acción (opcionalmente sobre un adulto concreto)? */
export function puede(u: Usuario | null | undefined, accion: Accion, adulto?: Adulto, vinculos?: Vinculo[]): boolean {
  if (!u || u.estado !== 'activo') return false
  if (!permisosDe(u.rol, tipoCuentaDeUsuario(u)).includes(accion)) return false
  return adulto ? alcanzaAdulto(u, adulto, vinculos) : true
}

/** Adultos que el usuario puede consultar. */
export function adultosVisibles(u: Usuario | null | undefined, adultos: Adulto[], vinculos?: Vinculo[]): Adulto[] {
  if (!u || !puede(u, 'adultos:ver')) return []
  return adultos.filter((a) => alcanzaAdulto(u, a, vinculos))
}

/** Error que lanza la capa de servicios cuando falta permiso. */
export class ErrorPermiso extends Error {
  constructor(mensaje = 'No tienes permiso para realizar esta acción.') {
    super(mensaje)
    this.name = 'ErrorPermiso'
  }
}
