/*
 * accesibilidad.ts — «Tamaño del texto» (Accesibilidad): tres tamaños que cambian el font-size raíz de <html>.
 * La elección vive solo en este dispositivo (localStorage, nunca en la URL) y se aplica al iniciar la app (main.tsx).
 * Los tamaños de texto y los espacios del sistema de diseño están en rem, así que todo escala junto.
 * © 2026 Equipo CuidaRed – INTEC.
 */
export type TamanoTexto = 'normal' | 'grande' | 'muy-grande'

export const CLAVE_TAMANO_TEXTO = 'cuidared.accesibilidad.tamano-texto'

export const TAMANOS_TEXTO: { id: TamanoTexto; nombre: string; porcentaje: number }[] = [
  { id: 'normal', nombre: 'Normal', porcentaje: 100 },
  { id: 'grande', nombre: 'Grande', porcentaje: 112.5 },
  { id: 'muy-grande', nombre: 'Muy grande', porcentaje: 125 },
]

const esTamano = (valor: unknown): valor is TamanoTexto => TAMANOS_TEXTO.some((tamano) => tamano.id === valor)

export function leerTamanoTexto(): TamanoTexto {
  try {
    const guardado = window.localStorage.getItem(CLAVE_TAMANO_TEXTO)
    return esTamano(guardado) ? guardado : 'normal'
  } catch {
    return 'normal'
  }
}

/** Aplica el tamaño al <html>. `normal` quita el estilo para respetar el tamaño base del navegador. */
export function aplicarTamanoTexto(tamano: TamanoTexto) {
  const porcentaje = TAMANOS_TEXTO.find((item) => item.id === tamano)?.porcentaje ?? 100
  document.documentElement.style.fontSize = porcentaje === 100 ? '' : `${porcentaje}%`
}

export function guardarTamanoTexto(tamano: TamanoTexto) {
  try {
    if (tamano === 'normal') window.localStorage.removeItem(CLAVE_TAMANO_TEXTO)
    else window.localStorage.setItem(CLAVE_TAMANO_TEXTO, tamano)
  } catch {
    /* modo privado o almacenamiento bloqueado: el tamaño dura lo que la pantalla */
  }
  aplicarTamanoTexto(tamano)
}

/** Se llama una vez al iniciar la aplicación. */
export function aplicarTamanoTextoGuardado() {
  aplicarTamanoTexto(leerTamanoTexto())
}
