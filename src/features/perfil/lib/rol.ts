/*
 * rol.ts — Reglas de presentación del perfil que dependen del rol.
 * Módulo: perfil.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { Rol } from '@/domain/types'

/** Figma: la cédula bajo el nombre solo aparece en Voluntario y Familiar responsable. */
export const muestraCedula = (rol: Rol) => rol === 'voluntario' || rol === 'familiar'

/**
 * Eliminar la propia cuenta (derecho de cancelación del titular) solo para Voluntario y Familiar responsable:
 * las cuentas de Administrador y Coordinador las gestiona la organización (siempre debe quedar un administrador).
 */
export const puedeEliminarCuenta = (rol: Rol) => rol === 'voluntario' || rol === 'familiar'
