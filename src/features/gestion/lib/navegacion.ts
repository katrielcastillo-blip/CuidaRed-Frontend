/*
 * navegacion.ts — «Volver» robusto para las pantallas de gestión (historial de la app o ruta de respaldo).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * «Volver» robusto: si hay historial dentro de la app retrocede; si se entró directo por URL va a `fallback`.
 *  - `back`   → valor para <Page back={…}> (true = navigate(-1); string = ruta).
 *  - `volver` → función para los botones «Cancelar».
 */
export function useVolver(fallback: string) {
  const navigate = useNavigate()
  useLocation() // re-renderiza al cambiar de entrada del historial
  // react-router guarda el índice de la entrada en history.state.idx: > 0 ⇒ hay una pantalla anterior de la app.
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  const hayHistorial = idx > 0
  const volver = useCallback(() => {
    if (hayHistorial) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [hayHistorial, fallback, navigate])
  return { back: hayHistorial ? true : fallback, volver } as { back: boolean | string; volver: () => void }
}
