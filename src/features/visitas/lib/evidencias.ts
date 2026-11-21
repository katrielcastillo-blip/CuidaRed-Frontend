/*
 * evidencias.ts — Preparación de las evidencias adjuntas (visitas y tareas de la agenda) según RS-013.
 *  - Tipos permitidos: JPG, PNG, WEBP y PDF. Tamaño máximo del archivo: 5 MB. Se comprueban el tipo declarado,
 *    la extensión y la firma real del archivo (no basta con renombrar un archivo).
 *  - Las imágenes se reducen en el cliente (canvas, máximo 1600 px de lado mayor, JPEG con calidad 0,8): esa es la
 *    versión que se enviaría al servidor. En el dispositivo solo se guarda una miniatura (dataURL) para no agotar
 *    localStorage; de un PDF se guarda el nombre del archivo.
 * Módulo: visitas (compartido con agenda).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { errorArchivoEvidencia, EVIDENCIA_EXTENSIONES, EVIDENCIA_MAX_BYTES, EVIDENCIA_TIPOS } from '@/domain/api'

export { EVIDENCIA_EXTENSIONES, EVIDENCIA_MAX_BYTES, EVIDENCIA_TIPOS }

/** Máximo de evidencias que se adjuntan a una visita. */
export const MAX_EVIDENCIAS = 4

/** Lado mayor de la imagen reducida (la que se enviaría) y calidad JPEG. */
export const MAX_LADO_REDUCIDA = 1600
export const CALIDAD_REDUCIDA = 0.8
/** Lado mayor y calidad de la miniatura que se guarda en el dispositivo. */
const MAX_LADO_MINIATURA = 480
const CALIDAD_MINIATURA = 0.7

/** Texto de ayuda con los límites, para mostrarlo junto a los botones de adjuntar. */
export const AYUDA_LIMITES_EVIDENCIA = `JPG, PNG, WEBP o PDF · máximo ${EVIDENCIA_MAX_BYTES / 1024 / 1024} MB`

/** Valor del atributo `accept` del selector de archivos. */
export const ACCEPT_EVIDENCIA = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf'

export const esMiniatura = (ev: string) => ev.startsWith('data:image/')

/** "1,4 MB" · "230 KB" */
export function tamanoLegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Evidencia lista para guardar. */
export interface EvidenciaProcesada {
  /** Miniatura (dataURL JPEG) de una imagen, o el nombre del archivo si es un PDF. Es lo que guarda el dominio. */
  archivo: string
  nombre: string
  /** Tipo MIME real (según la firma del archivo). */
  tipo: string
  /** Tamaño del archivo original en bytes. */
  tamano: number
  /** Solo imágenes: dimensiones y versión reducida (≤ 1600 px, JPEG 0,8) que se enviaría al servidor. */
  ancho?: number
  alto?: number
  reducida?: Blob
}

export type ResultadoEvidencia = { ok: true; evidencia: EvidenciaProcesada } | { ok: false; error: string }

/* ───────────── Validación ───────────── */

/** Tipo MIME según los primeros bytes del archivo (undefined si no es JPG, PNG, WEBP ni PDF). */
async function tipoPorFirma(file: Blob): Promise<string | undefined> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const igual = (...bytes: number[]) => bytes.every((v, i) => b[i] === v)
  if (igual(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (igual(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (igual(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  if (igual(0x25, 0x50, 0x44, 0x46)) return 'application/pdf'
  return undefined
}

/** Mensaje claro si el tipo o el tamaño del archivo no cumplen RS-013 (sin leer su contenido); undefined si pasa. */
export const errorTipoTamano = (file: Pick<File, 'name' | 'type' | 'size'>) => errorArchivoEvidencia({ nombre: file.name, tipo: file.type, tamano: file.size })

/* ───────────── Imágenes ───────────── */

function cargarImagen(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('imagen'))
    }
    img.src = url
  })
}

/** Dibuja la imagen con el lado mayor limitado a `maxLado` (sin ampliar) sobre fondo blanco. */
function dibujar(img: HTMLImageElement, maxLado: number): HTMLCanvasElement {
  const k = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

const aBlobJpeg = (canvas: HTMLCanvasElement, calidad: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', calidad))

/* ───────────── API ───────────── */

const ERROR_ILEGIBLE = 'No se pudo leer el archivo. Elige otra foto o documento.'

/**
 * Valida (tipo, firma y tamaño) y prepara un archivo como evidencia. Las imágenes se reducen a ≤ 1600 px (JPEG 0,8)
 * y se genera su miniatura; un PDF se guarda por su nombre. Si no cumple RS-013 devuelve un mensaje para la persona.
 */
export async function prepararEvidencia(file: File): Promise<ResultadoEvidencia> {
  const invalido = errorTipoTamano(file)
  if (invalido) return { ok: false, error: invalido }
  let tipo: string | undefined
  try {
    tipo = await tipoPorFirma(file)
  } catch {
    return { ok: false, error: ERROR_ILEGIBLE }
  }
  if (!tipo) return { ok: false, error: 'El contenido del archivo no corresponde a una foto JPG, PNG o WEBP ni a un PDF.' }
  const base = { nombre: file.name, tipo, tamano: file.size }
  if (tipo === 'application/pdf') return { ok: true, evidencia: { ...base, archivo: file.name } }
  try {
    const img = await cargarImagen(file)
    const reducida = dibujar(img, MAX_LADO_REDUCIDA)
    const blob = await aBlobJpeg(reducida, CALIDAD_REDUCIDA)
    const miniatura = dibujar(img, MAX_LADO_MINIATURA).toDataURL('image/jpeg', CALIDAD_MINIATURA)
    return { ok: true, evidencia: { ...base, archivo: miniatura, ancho: reducida.width, alto: reducida.height, reducida: blob } }
  } catch {
    return { ok: false, error: 'No se pudo leer la imagen. Elige otra foto.' }
  }
}

/**
 * Prepara varios archivos: devuelve los válidos y un mensaje por cada archivo rechazado ("foto.bmp: Tipo de
 * archivo no permitido…"), para mostrarlos junto al botón de adjuntar.
 */
export async function prepararEvidencias(files: FileList | File[]): Promise<{ validas: EvidenciaProcesada[]; errores: string[] }> {
  const lista = Array.from(files)
  const resultados = await Promise.all(lista.map((f) => prepararEvidencia(f)))
  const validas: EvidenciaProcesada[] = []
  const errores: string[] = []
  resultados.forEach((r, i) => {
    if (r.ok) validas.push(r.evidencia)
    else errores.push(lista.length > 1 ? `${lista[i]!.name}: ${r.error}` : r.error)
  })
  return { validas, errores }
}

/** Convierte los archivos elegidos en las cadenas que se guardan en `Visita.evidencias` (solo los válidos). */
export async function procesarEvidencias(files: FileList | File[]): Promise<string[]> {
  return (await prepararEvidencias(files)).validas.map((e) => e.archivo)
}
