/*
 * validacion.ts — Reglas de validación de datos compartidas por los formularios (interfaz) y por la capa
 * de servicios (domain/api), que vuelve a validar todo lo que recibe (SRS §8.2.2.1.16 · §8.2.2.3.5 g).
 * Módulo: dominio.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { todayISO } from './dates'

export type Errores<K extends string = string> = Partial<Record<K, string>>

export const soloDigitos = (s: string) => s.replace(/\D/g, '')
export const limpiarTexto = (s: string) => s.replace(/\s+/g, ' ').trim()

export const cedulaValida = (v: string) => /^\d{3}-\d{7}-\d$/.test(v.trim())
export const telefonoValido = (v: string) => soloDigitos(v).length === 10
export const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
export const fechaValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00`))

/** Nombre o apellido: letras, espacios, apóstrofo y guion; 2 a 60 caracteres. */
export function errorNombre(v: string, campo = 'nombre'): string | undefined {
  const t = limpiarTexto(v)
  if (!t) return `Escribe el ${campo}.`
  if (t.length < 2) return `El ${campo} es demasiado corto.`
  if (t.length > 60) return `El ${campo} no puede pasar de 60 caracteres.`
  if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(t)) return `El ${campo} solo puede contener letras.`
  return undefined
}

export function errorCedula(v: string, obligatoria = true): string | undefined {
  if (!v.trim()) return obligatoria ? 'Escribe la cédula.' : undefined
  if (!cedulaValida(v)) return 'Usa el formato 000-0000000-0.'
  return undefined
}

export function errorTelefono(v: string, obligatorio = true): string | undefined {
  if (!v.trim()) return obligatorio ? 'Escribe el teléfono.' : undefined
  if (!telefonoValido(v)) return 'Usa 10 dígitos, ej. 809 555 0100.'
  return undefined
}

export function errorEmail(v: string): string | undefined {
  if (!v.trim()) return 'Escribe el correo electrónico.'
  if (!emailValido(v)) return 'Escribe un correo válido (ej. nombre@correo.com).'
  return undefined
}

/** Fecha de nacimiento de un adulto mayor: válida, no futura y con 60 años o más (Ley 352-98). */
export function errorFechaNacimiento(v: string): string | undefined {
  if (!v) return 'Indica la fecha de nacimiento.'
  if (!fechaValida(v)) return 'La fecha no es válida.'
  if (v > todayISO()) return 'La fecha no puede ser futura.'
  const n = new Date(`${v}T00:00:00`)
  const h = new Date()
  let e = h.getFullYear() - n.getFullYear()
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--
  if (e < 60) return 'CuidaRed da seguimiento a personas de 60 años o más.'
  if (e > 120) return 'Revisa la fecha: la edad resultante no es válida.'
  return undefined
}

/** Fecha de una visita ya realizada: válida y no futura. */
export function errorFechaPasada(v: string, campo = 'la fecha'): string | undefined {
  if (!v) return `Indica ${campo}.`
  if (!fechaValida(v)) return 'La fecha no es válida.'
  if (v > todayISO()) return 'No puede ser una fecha futura.'
  return undefined
}

/** Texto libre obligatorio con longitud mínima y máxima. */
export function errorTexto(v: string, campo: string, min = 3, max = 500): string | undefined {
  const t = v.trim()
  if (!t) return `Escribe ${campo}.`
  if (t.length < min) return `Escribe al menos ${min} caracteres en ${campo}.`
  if (t.length > max) return `Máximo ${max} caracteres en ${campo}.`
  return undefined
}

/** true si el objeto de errores tiene algún mensaje. */
export const hayErrores = (e: Record<string, string | undefined>) => Object.values(e).some(Boolean)

/** Valor permitido de una lista. */
export const enLista = <T extends string>(v: string, permitidos: readonly T[]): v is T => (permitidos as readonly string[]).includes(v)
