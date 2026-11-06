/*
 * useImagenesGraficos.ts — Imágenes PNG de los gráficos del reporte (chart.toBase64Image()) para el PDF y la hoja
 * imprimible. Se generan fuera de pantalla con el mismo código que dibuja los gráficos, poco después de cada cambio
 * del reporte, y `asegurar()` las espera si el usuario exporta antes de que estén listas.
 * Módulo: gestión · reportes (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useEffect, useState } from 'react'
import type { GraficoReporte } from '../../lib/reportes'
import type { ImagenGrafico } from './tipos'

type Imagenes = Record<string, ImagenGrafico>
const SIN_IMAGENES: Imagenes = {}

async function generar(graficos: GraficoReporte[]): Promise<Imagenes> {
  const { imagenDeGrafico } = await import('./configGrafico')
  const imagenes: Imagenes = {}
  for (const g of graficos) {
    try {
      imagenes[g.id] = imagenDeGrafico(g)
    } catch {
      /* Sin imagen: la exportación incluye igualmente la tabla de datos. */
    }
  }
  return imagenes
}

/** `graficos` debe ser estable entre renders (useMemo): su identidad indica que el reporte no cambió. */
export function useImagenesGraficos(graficos: GraficoReporte[]) {
  const [estado, setEstado] = useState<{ ref: GraficoReporte[] | null; imagenes: Imagenes }>({ ref: null, imagenes: SIN_IMAGENES })

  useEffect(() => {
    if (graficos.length === 0) return
    let cancelado = false
    const espera = setTimeout(() => {
      void generar(graficos).then((imagenes) => {
        if (!cancelado) setEstado({ ref: graficos, imagenes })
      })
    }, 250)
    return () => {
      cancelado = true
      clearTimeout(espera)
    }
  }, [graficos])

  const vigentes = estado.ref === graficos
  const imagenes = vigentes ? estado.imagenes : SIN_IMAGENES

  /** Devuelve las imágenes del reporte actual (las genera ya mismo si aún no están). */
  const asegurar = useCallback(async (): Promise<Imagenes> => {
    if (vigentes || graficos.length === 0) return imagenes
    const nuevas = await generar(graficos)
    setEstado({ ref: graficos, imagenes: nuevas })
    return nuevas
  }, [vigentes, graficos, imagenes])

  return { imagenes, asegurar }
}
