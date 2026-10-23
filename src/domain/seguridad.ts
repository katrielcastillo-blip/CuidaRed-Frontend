/*
 * seguridad.ts — Hash de contraseñas (PBKDF2-SHA256 con sal) y política de contraseñas robustas.
 * Módulo: dominio · seguridad (SRS §8.2.2.3.5 b: no almacenar contraseñas en texto plano).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */

const ITERACIONES = 100_000
const enc = new TextEncoder()

const aHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

function deHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function nuevaSal(): string {
  return aHex(crypto.getRandomValues(new Uint8Array(16)))
}

/** Deriva el hash (hex) de un secreto con la sal dada. */
export async function hashSecreto(secreto: string, salHex: string): Promise<string> {
  const clave = await crypto.subtle.importKey('raw', enc.encode(secreto), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deHex(salHex), iterations: ITERACIONES }, clave, 256)
  return aHex(bits)
}

/** Comparación en tiempo constante (evita filtrar información por tiempos de respuesta). */
function igualesSeguro(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function verificarSecreto(secreto: string, salHex: string, hashHex: string): Promise<boolean> {
  return igualesSeguro(await hashSecreto(secreto, salHex), hashHex)
}

/** Crea hash + sal para una contraseña nueva. */
export async function protegerPassword(password: string): Promise<{ passwordHash: string; passwordSalt: string }> {
  const passwordSalt = nuevaSal()
  return { passwordHash: await hashSecreto(password, passwordSalt), passwordSalt }
}

/* ───────────── Política de contraseñas robustas ───────────── */
export const REGLAS_PASSWORD = [
  { id: 'largo', texto: 'Al menos 8 caracteres', ok: (p: string) => p.length >= 8 },
  { id: 'mayus', texto: 'Una letra mayúscula', ok: (p: string) => /[A-ZÁÉÍÓÚÑ]/.test(p) },
  { id: 'minus', texto: 'Una letra minúscula', ok: (p: string) => /[a-záéíóúñ]/.test(p) },
  { id: 'numero', texto: 'Un número', ok: (p: string) => /\d/.test(p) },
] as const

/** Devuelve el mensaje de error de la política, o undefined si la contraseña es válida. */
export function validarPassword(p: string): string | undefined {
  if (!p) return 'Ingresa una contraseña.'
  const falla = REGLAS_PASSWORD.find((r) => !r.ok(p))
  return falla ? `La contraseña debe tener: ${REGLAS_PASSWORD.map((r) => r.texto.toLowerCase()).join(', ')}.` : undefined
}

/* ───────────── Bloqueo por intentos fallidos ───────────── */
export const MAX_INTENTOS_LOGIN = 5
export const MINUTOS_BLOQUEO = 5

/* ───────────── Códigos de recuperación ───────────── */
export const MINUTOS_CODIGO_RECUPERACION = 15
export function generarCodigo(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000
  return String(n).padStart(6, '0')
}
/** Sal fija para códigos de recuperación (son de un solo uso y caducan; el hash evita guardarlos en claro). */
export const SAL_CODIGOS = '5a17c0d1e5ca1dad0000c0d160000001'
