/*
 * rol.ts — Reglas de presentación del perfil que dependen del rol y del tipo de cuenta.
 * Módulo: perfil.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { TipoCuenta } from '@/domain/planes'
import type { Rol } from '@/domain/types'

/** Figma: la cédula bajo el nombre solo aparece en Cuidador, Voluntario y Familiar responsable. */
export const muestraCedula = (rol: Rol) => rol === 'cuidador' || rol === 'voluntario' || rol === 'familiar'

/*
 * Antes (`puedeEliminarCuenta`) solo el Voluntario y el Familiar responsable podían "eliminar" su cuenta. V2 la
 * reemplaza por DESACTIVAR (se conserva el historial) y la regla ya no depende del rol: la puede pedir cualquier
 * persona, salvo que sea titular de una cuenta o el único administrador de una organización (esa regla depende de
 * los datos, no del rol: `bloqueosDesactivacion` en @/domain/api/perfil).
 */

/**
 * Quién gestiona los accesos de la cuenta, con la preposición incluida ("contacta al administrador…", "pide a la
 * persona coordinadora…"): sirve para decir a quién acudir (corregir la cédula, reactivar el acceso…).
 */
export const aResponsableDeCuenta = (tipo: TipoCuenta) => (tipo === 'familia' ? 'a la persona coordinadora de tu familia' : 'al administrador de tu organización')
