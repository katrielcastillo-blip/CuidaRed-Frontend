import type { Rol } from '@/domain/types'

/** Figma: la cédula bajo el nombre solo aparece en Cuidador y Familiar. */
export const muestraCedula = (rol: Rol) => rol === 'cuidador' || rol === 'familiar'

/** Figma: "Eliminar Cuenta" solo aparece en Editar Mi Perfil de Cuidador y Familiar. */
export const puedeEliminarCuenta = (rol: Rol) => rol === 'cuidador' || rol === 'familiar'
