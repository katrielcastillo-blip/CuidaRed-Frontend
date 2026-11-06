/*
 * permisos.ts — Textos legibles de las acciones de la matriz de permisos (MATRIZ de domain/permisos.ts),
 * agrupadas por función, y textos de alcance de los 5 roles (Administrador, Coordinador, Cuidador, Voluntario y
 * Familiar responsable). Solo etiqueta: quién puede qué se lee SIEMPRE de permisosDe() (rol + tipo de cuenta).
 * Módulo: admin (RF-09 · CU-13 · SRS §8.2.2.3.5 d). Incluye las acciones del modelo V3.0 (indicaciones, agenda,
 * suscripción, cuidadores y catálogos) y de las Reglas de Negocio V2 (autorizar familiares, cerrar alertas…).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { permisosDe, type Accion } from '@/domain/permisos'
import { ROLES_POR_TIPO_CUENTA, type TipoCuenta } from '@/domain/planes'
import type { Rol } from '@/domain/types'

export const GRUPOS = ['Perfiles', 'Indicaciones y agenda', 'Visitas', 'Necesidades', 'Alertas', 'Resumen y reportes', 'Administración', 'Cuenta y catálogos', 'Trabajo sin conexión'] as const
export type Grupo = (typeof GRUPOS)[number]

/** Record completo: si se añade una acción al dominio, TypeScript obliga a darle un texto aquí. */
export const ACCION_TEXTO: Record<Accion, { grupo: Grupo; texto: string }> = {
  'adultos:ver': { grupo: 'Perfiles', texto: 'Consultar perfiles de adultos mayores' },
  'adultos:crear': { grupo: 'Perfiles', texto: 'Registrar perfiles' },
  'adultos:editar': { grupo: 'Perfiles', texto: 'Editar perfiles' },
  'adultos:desactivar': { grupo: 'Perfiles', texto: 'Desactivar o reactivar perfiles' },
  'adultos:asignar': { grupo: 'Perfiles', texto: 'Asignar cuidadores y voluntarios a un adulto mayor' },
  'adultos:evaluar': { grupo: 'Perfiles', texto: 'Evaluar nivel de riesgo' },
  'adultos:anonimizar': { grupo: 'Perfiles', texto: 'Anonimizar datos personales' },
  'adultos:ver-sensible': { grupo: 'Perfiles', texto: 'Ver datos sensibles (riesgo, condición, situación social)' },
  'visitas:ver': { grupo: 'Visitas', texto: 'Consultar historial de visitas' },
  'visitas:registrar': { grupo: 'Visitas', texto: 'Registrar visitas (el voluntario solo la visita y su observación)' },
  'visitas:programar': { grupo: 'Visitas', texto: 'Programar visitas' },
  'visitas:autorizar': { grupo: 'Visitas', texto: 'Autorizar visitas solicitadas por visitantes' },
  'necesidades:ver': { grupo: 'Necesidades', texto: 'Consultar necesidades' },
  'necesidades:registrar': { grupo: 'Necesidades', texto: 'Registrar necesidades' },
  'necesidades:actualizar': { grupo: 'Necesidades', texto: 'Cambiar estado de necesidades' },
  'alertas:ver': { grupo: 'Alertas', texto: 'Consultar alertas' },
  'alertas:gestionar': { grupo: 'Alertas', texto: 'Atender y cerrar alertas' },
  'alertas:cerrar': { grupo: 'Alertas', texto: 'Cerrar alertas de sus adultos asignados' },
  'resumen:ver': { grupo: 'Resumen y reportes', texto: 'Resumen de seguimiento' },
  'reportes:ver': { grupo: 'Resumen y reportes', texto: 'Reportes y estadísticas' },
  'informe:exportar': { grupo: 'Resumen y reportes', texto: 'Exportar el informe médico' },
  'usuarios:gestionar': { grupo: 'Administración', texto: 'Gestionar miembros y roles de la cuenta' },
  'familiares:autorizar': { grupo: 'Administración', texto: 'Autorizar a cada familiar los adultos mayores que puede ver' },
  'organizacion:configurar': { grupo: 'Administración', texto: 'Configurar la organización o la cuenta familiar' },
  'auditoria:ver': { grupo: 'Administración', texto: 'Consultar registro de auditoría' },
  'sync:usar': { grupo: 'Trabajo sin conexión', texto: 'Capturar sin conexión y sincronizar' },
  'indicaciones:ver': { grupo: 'Indicaciones y agenda', texto: 'Consultar indicaciones médicas' },
  'indicaciones:gestionar': { grupo: 'Indicaciones y agenda', texto: 'Registrar y editar indicaciones médicas' },
  'agenda:ver': { grupo: 'Indicaciones y agenda', texto: 'Consultar la agenda de tareas' },
  'agenda:gestionar': { grupo: 'Indicaciones y agenda', texto: 'Crear y asignar tareas de agenda' },
  'agenda:ejecutar': { grupo: 'Indicaciones y agenda', texto: 'Cumplir sus tareas y subir evidencias' },
  'evidencias:validar': { grupo: 'Indicaciones y agenda', texto: 'Validar evidencias de tareas' },
  'cuenta:suscripcion': { grupo: 'Cuenta y catálogos', texto: 'Consultar plan, cambiarlo y registrar pagos' },
  'cuidadores:gestionar': { grupo: 'Cuenta y catálogos', texto: 'Gestionar perfiles de cuidador' },
  'catalogos:ver': { grupo: 'Cuenta y catálogos', texto: 'Consultar catálogos y parámetros' },
}

/** Los 5 roles del sistema, en el orden en que se muestran. */
export const ORDEN_ROLES: Rol[] = ['admin', 'coordinador', 'cuidador', 'voluntario', 'familiar']

/** Roles que admite una cuenta según su tipo (Familia: 3 · Organización: 5), en orden de presentación. */
export const rolesDeTipo = (tipo: TipoCuenta): Rol[] => ORDEN_ROLES.filter((r) => ROLES_POR_TIPO_CUENTA[tipo].includes(r))

export interface FilaPermiso {
  accion: Accion
  texto: string
  roles: Partial<Record<Rol, boolean>>
}

/** Filas de la matriz agrupadas por función, generadas desde los permisos efectivos de cada rol en el tipo de cuenta. */
export function matrizPorGrupo(tipo: TipoCuenta = 'organizacion'): Array<{ grupo: Grupo; filas: FilaPermiso[] }> {
  const acciones = Object.keys(ACCION_TEXTO) as Accion[]
  const roles = rolesDeTipo(tipo)
  return GRUPOS.map((grupo) => ({
    grupo,
    filas: acciones
      .filter((a) => ACCION_TEXTO[a].grupo === grupo)
      .map((accion) => ({
        accion,
        texto: ACCION_TEXTO[accion].texto,
        roles: Object.fromEntries(roles.map((r) => [r, permisosDe(r, tipo).includes(accion)])) as Partial<Record<Rol, boolean>>,
      })),
  })).filter((g) => g.filas.length > 0)
}

/** Permisos efectivos de un rol en el tipo de cuenta, agrupados (perfil del miembro). */
export function permisosDeRol(rol: Rol, tipo: TipoCuenta = 'organizacion'): Array<{ grupo: Grupo; textos: string[] }> {
  const permisos = permisosDe(rol, tipo)
  return GRUPOS.map((grupo) => ({
    grupo,
    textos: permisos.filter((a) => ACCION_TEXTO[a].grupo === grupo).map((a) => ACCION_TEXTO[a].texto),
  })).filter((g) => g.textos.length > 0)
}

/** Alcance de los datos por rol (SRS §8.2.2.3.4 c · §8.2.2.3.5 d · Reglas de Negocio V2 §Vínculo). */
export const ALCANCE_ROL: Record<Rol, string> = {
  admin: 'Todos los adultos mayores y miembros de la organización.',
  coordinador: 'Todos los adultos mayores de la cuenta.',
  cuidador: 'Solo los adultos mayores que tiene asignados («cuidador asignado»), con su información de salud.',
  voluntario: 'Solo los adultos mayores que tiene asignados, sin información médica ni necesidades.',
  familiar: 'Solo los adultos mayores para los que recibió permiso explícito («familiar responsable»). Sin autorización no ve ninguno.',
}

/** Alcance del rol en el tipo de cuenta (en Familia, el Coordinador también gestiona los accesos). */
export const alcanceDeRol = (rol: Rol, tipo: TipoCuenta) =>
  rol === 'coordinador' && tipo === 'familia' ? `${ALCANCE_ROL.coordinador} Además gestiona los miembros y autoriza a los familiares.` : ALCANCE_ROL[rol]

/** Texto destacado de los roles que lo necesitan (se muestra al elegirlos). */
export const NOTA_ROL: Partial<Record<Rol, string>> = {
  voluntario: 'Voluntario ocasional: registra visitas sin plan propio. No cuenta para el límite de usuarios de tu plan.',
  familiar: 'Sin autorización explícita el familiar no ve ningún adulto mayor: indica cuáles puede ver.',
}
