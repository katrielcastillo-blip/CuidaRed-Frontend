/*
 * useActualizadoEn.ts — Momento en que se recalcularon por última vez los datos de una pantalla ("Datos
 * actualizados: 05/11/2026 04:30 p.m."). Cambia cada vez que cambia `clave` (el resultado derivado del store).
 * Módulo: gestión (reportes y seguimiento).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState } from 'react'

const ahora = () => new Date()

export function useActualizadoEn(clave: unknown): Date {
  const [estado, setEstado] = useState(() => ({ clave, momento: ahora() }))
  // Ajuste de estado durante el render cuando cambia la clave (patrón recomendado por React, sin efecto).
  if (estado.clave !== clave) setEstado({ clave, momento: ahora() })
  return estado.momento
}
