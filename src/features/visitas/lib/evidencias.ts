/*
 * evidencias.ts — Evidencias adjuntas a una visita (fotos reducidas o nombres de archivo).
 * Módulo: visitas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */

/**
 * Evidencias de una visita. El store guarda strings: una miniatura (dataURL JPEG) para las imágenes
 * o simplemente el nombre del archivo para el resto. Las imágenes se reducen para no agotar localStorage.
 */
const MAX_LADO = 480
export const MAX_EVIDENCIAS = 4

export const esMiniatura = (ev: string) => ev.startsWith('data:image/')

function miniatura(file: File): Promise<string> {
  return new Promise((resolve) => {
    const nombre = () => resolve(file.name)
    const reader = new FileReader()
    reader.onerror = nombre
    reader.onload = () => {
      const img = new Image()
      img.onerror = nombre
      img.onload = () => {
        const k = Math.min(1, MAX_LADO / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * k))
        canvas.height = Math.max(1, Math.round(img.height * k))
        const ctx = canvas.getContext('2d')
        if (!ctx) return nombre()
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

/** Convierte los archivos elegidos en las cadenas que se guardan en `Visita.evidencias`. */
export function procesarEvidencias(files: FileList | File[]): Promise<string[]> {
  return Promise.all(Array.from(files).map((f) => (f.type.startsWith('image/') ? miniatura(f) : Promise.resolve(f.name))))
}
