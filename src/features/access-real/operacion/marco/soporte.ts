/*
 * soporte.ts — Correo de soporte y construcción del mailto para «Contactar soporte».
 * No existe un endpoint de soporte: el mensaje se redacta en la app de correo del dispositivo.
 * © 2026 Equipo CuidaRed – INTEC.
 */

/** Valida el correo configurado; devuelve `null` si falta o no es una dirección válida. */
export function correoConfigurado(valor: unknown): string | null {
  const texto = String(valor ?? '').trim()
  return /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(texto) ? texto : null
}

/**
 * Destino del soporte: VITE_CONTACTO_EMAIL (el mismo contacto de la portada pública). Si no está definido es `null`:
 * la pantalla muestra el formulario con un aviso y NO abre ningún correo a una dirección inventada.
 * PENDIENTE: confirmar la dirección real del equipo y definirla en el entorno de despliegue.
 */
export const CORREO_SOPORTE: string | null = correoConfigurado(import.meta.env.VITE_CONTACTO_EMAIL)

export function enlaceSoporte({ correo, tema, asunto, mensaje, cuenta }: { correo: string; tema: string; asunto: string; mensaje: string; cuenta: string }) {
  const cuerpo = `${mensaje}\n\n—\nTema: ${tema}\nCuenta: ${cuenta}`
  return `mailto:${correo}?subject=${encodeURIComponent(`[CuidaRed] ${asunto}`)}&body=${encodeURIComponent(cuerpo)}`
}
