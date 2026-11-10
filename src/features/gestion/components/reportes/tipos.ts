/*
 * tipos.ts — Contexto común de la exportación del reporte (PDF, Excel, impresión).
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { AnalisisAvanzado, Reporte } from '../../lib/reportes'

/** Imagen PNG de un gráfico (chart.toBase64Image()) con su tamaño en píxeles. */
export interface ImagenGrafico {
  dataUrl: string
  ancho: number
  alto: number
}

export interface ContextoExportacion {
  reporte: Reporte
  /** Filtros aplicados, ya redactados ("Período: Todo el tiempo"). */
  filtros: string[]
  /** "Organización · Cuenta Organización · Plan Gestión Comunitaria Avanzada". */
  cuenta: string
  generadoPor: string
  generado: Date
  /** Análisis avanzado (comparativo por zona y tendencias); null si el plan de la cuenta no lo incluye. */
  avanzado: AnalisisAvanzado | null
  /** Aviso de plan cuando `avanzado` es null ("Disponible en el plan …"). */
  avisoAvanzado: string
  /** Imágenes de los gráficos por id (puede faltar alguna: se exportan las tablas). */
  imagenes: Record<string, ImagenGrafico>
}
