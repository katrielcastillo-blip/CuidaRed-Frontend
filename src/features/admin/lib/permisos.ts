/*
 * permisos.ts — Textos legibles de las acciones de la matriz de permisos (MATRIZ de domain/permisos.ts),
 * agrupadas por función. Solo etiqueta: quién puede qué se lee SIEMPRE de MATRIZ.
 * Módulo: admin (RF-09 · CU-13 · SRS §8.2.2.3.5 d). Incluye las acciones del modelo V3.0 (indicaciones, agenda,
 * suscripción, cuidadores y catálogos).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { MATRIZ, type Accion } from '@/domain/permisos'
import type { Rol } from '@/domain/types'

export const GRUPOS = ['Perfiles', 'Indicaciones y agenda', 'Visitas', 'Necesidades', 'Alertas', 'Resumen y reportes', 'Administración', 'Cuenta y catálogos', 'Trabajo sin conexión'] as const
export type Grupo = (typeof GRUPOS)[number]

/** Record completo: si se añade una acción al dominio, TypeScript obliga a darle un texto aquí. */
export const ACCION_TEXTO: Record<Accion, { grupo: Grupo; texto: string }> = {
  'adultos:ver': { grupo: 'Perfiles', texto: 'Consultar perfiles de adultos mayores' },
  'adultos:crear': { grupo: 'Perfiles', texto: 'Registrar perfiles' },
  'adultos:editar': { grupo: 'Perfiles', texto: 'Editar perfiles' },
  'adultos:desactivar': { grupo: 'Perfiles', texto: 'Desactivar o reactivar perfiles' },
  'adultos:asignar': { grupo: 'Perfiles', texto: 'Asignar voluntarios' },
  'adultos:evaluar': { grupo: 'Perfiles', texto: 'Evaluar nivel de riesgo' },
  'adultos:anonimizar': { grupo: 'Perfiles', texto: 'Anonimizar datos personales' },
  'adultos:ver-sensible': { grupo: 'Perfiles', texto: 'Ver datos sensibles (riesgo, condición, situación social)' },
  'visitas:ver': { grupo: 'Visitas', texto: 'Consultar historial de visitas' },
  'visitas:registrar': { grupo: 'Visitas', texto: 'Registrar visitas' },
  'visitas:programar': { grupo: 'Visitas', texto: 'Programar visitas' },
  'necesidades:ver': { grupo: 'Necesidades', texto: 'Consultar necesidades' },
  'necesidades:registrar': { grupo: 'Necesidades', texto: 'Registrar necesidades' },
  'necesidades:actualizar': { grupo: 'Necesidades', texto: 'Cambiar estado de necesidades' },
  'alertas:ver': { grupo: 'Alertas', texto: 'Consultar alertas' },
  'alertas:gestionar': { grupo: 'Alertas', texto: 'Atender y cerrar alertas' },
  'resumen:ver': { grupo: 'Resumen y reportes', texto: 'Resumen de seguimiento' },
  'reportes:ver': { grupo: 'Resumen y reportes', texto: 'Reportes estadísticos' },
  'usuarios:gestionar': { grupo: 'Administración', texto: 'Gestionar usuarios y roles' },
  'organizacion:configurar': { grupo: 'Administración', texto: 'Configurar la organización' },
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

export const ORDEN_ROLES: Rol[] = ['admin', 'coordinador', 'voluntario', 'familiar']

export interface FilaPermiso {
  accion: Accion
  texto: string
  roles: Record<Rol, boolean>
}

/** Filas de la matriz agrupadas por función, generadas desde MATRIZ. */
export function matrizPorGrupo(): Array<{ grupo: Grupo; filas: FilaPermiso[] }> {
  const acciones = Object.keys(ACCION_TEXTO) as Accion[]
  return GRUPOS.map((grupo) => ({
    grupo,
    filas: acciones
      .filter((a) => ACCION_TEXTO[a].grupo === grupo)
      .map((accion) => ({
        accion,
        texto: ACCION_TEXTO[accion].texto,
        roles: Object.fromEntries(ORDEN_ROLES.map((r) => [r, MATRIZ[r].includes(accion)])) as Record<Rol, boolean>,
      })),
  })).filter((g) => g.filas.length > 0)
}

/** Permisos efectivos de un rol, agrupados (perfil del usuario). */
export function permisosDeRol(rol: Rol): Array<{ grupo: Grupo; textos: string[] }> {
  return GRUPOS.map((grupo) => ({
    grupo,
    textos: MATRIZ[rol].filter((a) => ACCION_TEXTO[a].grupo === grupo).map((a) => ACCION_TEXTO[a].texto),
  })).filter((g) => g.textos.length > 0)
}

/** Alcance de los datos por rol (SRS §8.2.2.3.4 c · §8.2.2.3.5 d). */
export const ALCANCE_ROL: Record<Rol, string> = {
  admin: 'Todos los adultos mayores y usuarios de la organización.',
  coordinador: 'Todos los adultos mayores de la organización.',
  voluntario: 'Solo los adultos mayores que tiene asignados.',
  familiar: 'Solo los adultos mayores con los que tiene vínculo «familiar responsable».',
}
