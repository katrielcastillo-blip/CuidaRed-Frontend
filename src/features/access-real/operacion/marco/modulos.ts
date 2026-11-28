/*
 * modulos.ts — Secciones de la cuenta, pestañas de la barra inferior por rol y pantallas propias del marco.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import type { NombreIcono } from '@/components/ui'
import type { CuentaMe } from '../../client'

export type Seccion = {
  id: string
  nombre: string
  titulo: string
  descripcion: string
  icono: NombreIcono
  permiso?: string
  soloOrganizacion?: boolean
}

export const secciones: Seccion[] = [
  { id: 'cuenta', nombre: 'Inicio', titulo: 'Datos de cuenta', descripcion: 'Datos y suscripción de la cuenta activa', icono: 'home' },
  { id: 'envejecientes', nombre: 'Adultos', titulo: 'Envejecientes', descripcion: 'Expedientes y seguimiento', icono: 'elderly', permiso: 'adultos:ver' },
  { id: 'visitas', nombre: 'Visitas', titulo: 'Mis visitas', descripcion: 'Visitas programadas e historial', icono: 'calendar_month', permiso: 'visitas:ver', soloOrganizacion: true },
  { id: 'agenda', nombre: 'Agenda', titulo: 'Agenda', descripcion: 'Tareas de cuidado y evidencias', icono: 'checklist', permiso: 'agenda:ver' },
  { id: 'necesidades', nombre: 'Necesidades', titulo: 'Necesidades', descripcion: 'Necesidades activas y su seguimiento', icono: 'volunteer_activism', permiso: 'necesidades:ver' },
  { id: 'alertas', nombre: 'Alertas', titulo: 'Alertas', descripcion: 'Casos prioritarios y notificaciones', icono: 'notifications_active', permiso: 'alertas:ver' },
  { id: 'resumen', nombre: 'Resumen', titulo: 'Resumen de casos', descripcion: 'Casos activos, prioridad y estado de atención', icono: 'assignment', permiso: 'resumen:ver' },
  { id: 'reportes', nombre: 'Reportes', titulo: 'Reportes y estadísticas', descripcion: 'Indicadores, gráficos y exportaciones', icono: 'bar_chart', permiso: 'reportes:ver' },
  { id: 'miembros', nombre: 'Miembros', titulo: 'Miembros de la cuenta', descripcion: 'Personas, invitaciones y roles', icono: 'group', permiso: 'usuarios:gestionar' },
  { id: 'configuracion', nombre: 'Configuración', titulo: 'Configurar cuenta', descripcion: 'Datos de contacto y preferencias', icono: 'settings', permiso: 'organizacion:configurar' },
  { id: 'solicitudes-visita', nombre: 'Solicitudes', titulo: 'Solicitudes de visita', descripcion: 'Revisar solicitudes recibidas', icono: 'inbox', permiso: 'visitas:autorizar', soloOrganizacion: true },
  { id: 'auditoria', nombre: 'Auditoría', titulo: 'Auditoría', descripcion: 'Actividad registrada en la cuenta', icono: 'fact_check', permiso: 'auditoria:ver' },
]

export const mas: Seccion = { id: 'mas', nombre: 'Más', titulo: 'Más opciones', descripcion: 'Más módulos de la cuenta', icono: 'more_horiz' }

/** Pantallas del marco (no son módulos con permiso): siempre secundarias. */
export const PANTALLAS_MARCO = {
  notificaciones: 'Notificaciones',
  conexion: 'Conexión y sincronización',
  aprende: 'Aprende a usar CuidaRed',
  preguntas: 'Preguntas frecuentes',
  idioma: 'Cambiar idioma',
  soporte: 'Contactar soporte',
  tema: 'Modo claro u oscuro',
  accesibilidad: 'Accesibilidad',
} as const
export type PantallaMarco = keyof typeof PANTALLAS_MARCO
export const esPantallaMarco = (id: string): id is PantallaMarco => Object.hasOwn(PANTALLAS_MARCO, id)

/** Pestañas de la barra inferior (sin «Más») según el rol. Administrador: Inicio, Adultos y Miembros; coordinador: Inicio, Adultos, Visitas y Alertas (Figma 13:25593). */
export function idsPestanas(rol: CuentaMe['rol']): string[] {
  if (rol === 'administrador') return ['cuenta', 'envejecientes', 'miembros']
  if (rol === 'coordinador') return ['cuenta', 'envejecientes', 'visitas', 'alertas']
  return ['cuenta', 'envejecientes', 'visitas', 'agenda']
}

export function iniciales(nombre: string) {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]!.toUpperCase()).join('') || '?'
}

/** Reparte los módulos permitidos entre las pestañas de la barra inferior y la hoja «Más». */
export function repartirModulos(rol: CuentaMe['rol'], modulos: Seccion[]) {
  const orden = idsPestanas(rol)
  return {
    pestanas: orden.flatMap((id) => modulos.filter((modulo) => modulo.id === id)),
    adicionales: modulos.filter((modulo) => !orden.includes(modulo.id)),
  }
}

