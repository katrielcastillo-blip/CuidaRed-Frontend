/*
 * avatar.ts — Lectura y recorte de la foto de perfil (dataURL JPEG cuadrada y liviana).
 * Módulo: perfil.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */

/**
 * Lee una imagen del usuario y la devuelve como dataURL JPEG cuadrada de, como máximo, `max` px de lado
 * (recorte centrado + canvas). Así el avatar cabe sin problema en localStorage.
 */
export function leerAvatar(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecciona un archivo de imagen (JPG, PNG o WebP).'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const lado = Math.min(img.naturalWidth, img.naturalHeight)
      if (!lado) {
        reject(new Error('No se pudo leer la imagen.'))
        return
      }
      const destino = Math.min(max, lado)
      const canvas = document.createElement('canvas')
      canvas.width = destino
      canvas.height = destino
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Tu navegador no puede procesar la imagen.'))
        return
      }
      ctx.imageSmoothingQuality = 'high'
      ctx.fillStyle = '#ffffff' // PNG con transparencia → fondo blanco al pasar a JPEG
      ctx.fillRect(0, 0, destino, destino)
      const sx = (img.naturalWidth - lado) / 2
      const sy = (img.naturalHeight - lado) / 2
      ctx.drawImage(img, sx, sy, lado, lado, 0, 0, destino, destino)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    img.src = url
  })
}
