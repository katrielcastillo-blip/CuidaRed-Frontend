/*
 * permisos.ts — Control de acceso basado en roles (RBAC) y alcance de los datos.
 * Módulo: dominio · seguridad (RF-09 · CU-13 · SRS §8.2.2.3.4 b/c · §8.2.2.3.5 c/d).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Única fuente de verdad de "quién puede hacer qué". Se aplica en dos capas:
 *  - Interfaz: guards de rutas (<RequirePermiso>) y botones que solo aparecen si puede(...).
 *  - "Backend" local (domain/api/*): cada operación vuelve a comprobar el permiso y el alcance antes de
 *    escribir, y registra en auditoría los intentos denegados. Ocultar un botón no es el control.
 */
import { tieneVinculo } from './relaciones'
import type { Adulto, Rol, Usuario, Vinculo } from './types'

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
  // Necesidades (CU-07, CU-08)
  | 'necesidades:ver'
  | 'necesidades:registrar'
  | 'necesidades:actualizar'
  // Alertas (CU-09, CU-10)
  | 'alertas:ver'
  | 'alertas:gestionar'
  // Resumen y reportes (CU-11, CU-12)
  | 'resumen:ver'
  | 'reportes:ver'
  // Administración (CU-13)
  | 'usuarios:gestionar'
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

/** Matriz de permisos por rol (principio de mínimo privilegio). */
export const MATRIZ: Record<Rol, readonly Accion[]> = {
  admin: [
    'adultos:ver', 'adultos:crear', 'adultos:editar', 'adultos:desactivar', 'adultos:asignar', 'adultos:evaluar', 'adultos:anonimizar', 'adultos:ver-sensible',
    'visitas:ver', 'necesidades:ver',
    'alertas:ver', 'alertas:gestionar',
    'resumen:ver', 'reportes:ver',
    'usuarios:gestionar', 'organizacion:configurar', 'auditoria:ver',
    'indicaciones:ver', 'indicaciones:gestionar', 'agenda:ver', 'agenda:gestionar', 'evidencias:validar',
    'cuenta:suscripcion', 'cuidadores:gestionar', 'catalogos:ver',
  ],
  coordinador: [
    'adultos:ver', 'adultos:crear', 'adultos:editar', 'adultos:desactivar', 'adultos:asignar', 'adultos:evaluar', 'adultos:ver-sensible',
    'visitas:ver', 'visitas:registrar', 'visitas:programar',
    'necesidades:ver', 'necesidades:registrar', 'necesidades:actualizar',
    'alertas:ver', 'alertas:gestionar',
    'resumen:ver', 'reportes:ver',
    'sync:usar',
    'indicaciones:ver', 'indicaciones:gestionar', 'agenda:ver', 'agenda:gestionar', 'evidencias:validar',
  ],
  voluntario: [
    'adultos:ver', 'adultos:ver-sensible',
    'visitas:ver', 'visitas:registrar',
    'necesidades:ver', 'necesidades:registrar', 'necesidades:actualizar',
    'sync:usar',
    'indicaciones:ver', 'agenda:ver', 'agenda:ejecutar',
  ],
  familiar: ['adultos:ver', 'visitas:ver', 'necesidades:ver'],
}

/** Descripción legible de cada rol (pantalla de gestión de usuarios). */
export const DESCRIPCION_ROL: Record<Rol, string> = {
  admin: 'Gestiona usuarios, roles y la configuración de la organización. Acceso total a perfiles, alertas y reportes.',
  coordinador: 'Supervisa el seguimiento: registra perfiles, programa visitas, atiende alertas y consulta resumen y reportes.',
  voluntario: 'Trabajo de campo: registra visitas y necesidades de los adultos mayores que tiene asignados (vínculo «voluntario asignado»), incluso sin conexión, y cumple las tareas de su agenda.',
  familiar: 'Consulta el historial de visitas y el estado de las necesidades del adulto mayor con el que tiene vínculo «familiar responsable». No modifica registros.',
}

/**
 * Origen de la tabla Vinculo cuando no se pasa explícitamente (el store la registra al iniciar). Evita
 * tener que pasar los vínculos en cada llamada a puede() desde las pantallas.
 */
let fuenteVinculos: () => Vinculo[] = () => []
export function registrarFuenteVinculos(fn: () => Vinculo[]) {
  fuenteVinculos = fn
}

/**
 * Alcance: ¿el usuario puede ver/operar sobre este adulto? (tabla Vinculo)
 *  - Administrador y coordinador: todos los adultos de su cuenta (organización).
 *  - Voluntario: solo los adultos con vínculo "voluntario_asignado".
 *  - Familiar responsable: solo los adultos con vínculo "familiar_responsable".
 */
export function alcanzaAdulto(u: Usuario, a: Adulto, vinculos: Vinculo[] = fuenteVinculos()): boolean {
  if (a.orgId !== u.orgId) return false
  switch (u.rol) {
    case 'admin':
    case 'coordinador':
      return true
    case 'voluntario':
      return tieneVinculo(vinculos, u.id, a.id, 'voluntario_asignado')
    case 'familiar':
      return tieneVinculo(vinculos, u.id, a.id, 'familiar_responsable')
  }
}

/** ¿Puede el usuario realizar la acción (opcionalmente sobre un adulto concreto)? */
export function puede(u: Usuario | null | undefined, accion: Accion, adulto?: Adulto, vinculos?: Vinculo[]): boolean {
  if (!u || u.estado !== 'activo') return false
  if (!MATRIZ[u.rol].includes(accion)) return false
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
