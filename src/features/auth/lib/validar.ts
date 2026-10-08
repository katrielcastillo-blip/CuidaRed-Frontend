/** Máscaras y validaciones compartidas por los formularios de auth y de perfil. */

export const soloDigitos = (s: string) => s.replace(/\D/g, '')

/** "00112345678" → "001-1234567-8" (máscara progresiva mientras se escribe). */
export function formatCedula(valor: string) {
  const d = soloDigitos(valor).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`
}
export const cedulaValida = (v: string) => /^\d{3}-\d{7}-\d$/.test(v.trim())

/** "8097771234" → "809 777 1234". Acepta pegados con prefijo "1" o símbolos. */
export function formatTelefono(valor: string) {
  let d = soloDigitos(valor)
  if (d.length > 10 && d.startsWith('1')) d = d.slice(1)
  d = d.slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}
export const telefonoValido = (v: string) => soloDigitos(v).length === 10

export const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
export const normalizarEmail = (v: string) => v.trim().toLowerCase()

export const PASSWORD_MIN = 8

export function errorPassword(p: string): string | undefined {
  if (!p) return 'Escribe una contraseña.'
  if (p.length < PASSWORD_MIN) return `Debe tener al menos ${PASSWORD_MIN} caracteres.`
  return undefined
}

export function errorConfirmacion(p: string, c: string): string | undefined {
  if (!c) return 'Confirma la contraseña.'
  if (p !== c) return 'Las contraseñas no coinciden.'
  return undefined
}

export function errorEmail(v: string): string | undefined {
  if (!v.trim()) return 'Escribe tu correo electrónico.'
  if (!emailValido(v)) return 'Escribe un correo válido (ej. nombre@correo.com).'
  return undefined
}

export function errorNombre(v: string, campo: string): string | undefined {
  const t = v.trim()
  if (!t) return `Escribe tu ${campo}.`
  if (t.length < 2) return `El ${campo} es demasiado corto.`
  return undefined
}

export function errorCedula(v: string): string | undefined {
  if (!v.trim()) return 'Escribe tu cédula.'
  if (!cedulaValida(v)) return 'Usa el formato 000-0000000-0.'
  return undefined
}

export function errorTelefono(v: string): string | undefined {
  if (!v.trim()) return 'Escribe tu teléfono.'
  if (!telefonoValido(v)) return 'Usa 10 dígitos, ej. 809 555 0100.'
  return undefined
}

/** true si el objeto de errores tiene algún mensaje. */
export const hayErrores = (e: Record<string, string | undefined>) => Object.values(e).some(Boolean)
