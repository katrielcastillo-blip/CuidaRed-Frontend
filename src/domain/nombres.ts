/*
 * nombres.ts — Nombres legibles de personas y roles (sin dependencias, para evitar ciclos de importación).
 * Módulo: dominio.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { Rol, Usuario } from './types'

export const ROL_LABEL: Record<Rol, string> = {
  voluntario: 'Voluntario',
  familiar: 'Familiar responsable',
  admin: 'Administrador',
  coordinador: 'Coordinador',
}

export function nombreCompleto(u: Pick<Usuario, 'nombre' | 'apellido'>) {
  return `${u.nombre} ${u.apellido}`.trim()
}
