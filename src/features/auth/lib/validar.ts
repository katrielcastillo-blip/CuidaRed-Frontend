/*
 * validar.ts — Máscaras de entrada (cédula, teléfono) y validaciones propias de los formularios de cuenta.
 * Las reglas de datos (nombre, cédula, teléfono, correo) viven en @/domain/validacion y la política de
 * contraseñas en @/domain/seguridad: aquí solo se reexportan para los formularios de auth y perfil.
 * Módulo: auth.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { soloDigitos } from '@/domain/validacion'

export { errorCedula, errorEmail, errorNombre, errorTelefono, errorTexto, hayErrores, emailValido } from '@/domain/validacion'

/** "00112345678" → "001-1234567-8" (máscara progresiva mientras se escribe). */
export function formatCedula(valor: string) {
  const d = soloDigitos(valor).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`
}

/** "8097771234" → "809 777 1234". Acepta pegados con prefijo "1" o símbolos. */
export function formatTelefono(valor: string) {
  let d = soloDigitos(valor)
  if (d.length > 10 && d.startsWith('1')) d = d.slice(1)
  d = d.slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}

export const normalizarEmail = (v: string) => v.trim().toLowerCase()

export function errorConfirmacion(p: string, c: string): string | undefined {
  if (!c) return 'Confirma la contraseña.'
  if (p !== c) return 'Las contraseñas no coinciden.'
  return undefined
}

/** Código de recuperación: exactamente 6 dígitos. */
export function errorCodigo(v: string): string | undefined {
  if (!v.trim()) return 'Escribe el código de 6 dígitos.'
  if (!/^\d{6}$/.test(v.trim())) return 'El código tiene 6 dígitos.'
  return undefined
}
