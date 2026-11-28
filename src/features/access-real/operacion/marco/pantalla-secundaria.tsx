/*
 * pantalla-secundaria.tsx — Contrato para que un módulo pida el marco de pantalla secundaria (Barra secundaria con
 * volver + título, sin barra inferior ni ayuda) cuando muestra una subvista de detalle o formulario dentro de su sección.
 *
 * Uso dentro del módulo:
 *   usePantallaSecundaria(perfil ? { titulo: 'Perfil', volver: () => setPerfil(undefined) } : null)
 *   usePantallaSecundaria({ titulo: 'Registrar adulto', volver: `${raiz}/envejecientes` })
 *
 * `volver` string = ruta a la que se navega; función = se llama al pulsar Volver. Con `null` (o al desmontarse el
 * componente) vuelve el marco normal de la sección. Se puede pasar un objeto y una función nuevos en cada render:
 * solo `titulo`, la ruta y si hay función cuentan para actualizar el marco, así que no hay bucles de render.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { createContext, useContext, useEffect, useRef } from 'react'

export type PantallaSecundaria = { titulo: string; ruta?: string; accion?: () => void }
export type FijarPantallaSecundaria = (pantalla: PantallaSecundaria | null) => void

/** Lo provee `Portal`; fuera de él (pruebas de módulos aislados) no hace nada. */
export const ContextoPantallaSecundaria = createContext<FijarPantallaSecundaria>(() => {})

export function usePantallaSecundaria(opciones: { titulo: string; volver: string | (() => void) } | null): void {
  const fijar = useContext(ContextoPantallaSecundaria)
  const accion = useRef<(() => void) | undefined>(undefined)
  const titulo = opciones?.titulo ?? null
  const ruta = typeof opciones?.volver === 'string' ? opciones.volver : undefined
  const conFuncion = typeof opciones?.volver === 'function'
  useEffect(() => {
    accion.current = typeof opciones?.volver === 'function' ? opciones.volver : undefined
  })
  useEffect(() => {
    if (titulo === null) return
    fijar({ titulo, ruta, accion: conFuncion ? () => accion.current?.() : undefined })
    return () => fijar(null)
  }, [fijar, titulo, ruta, conFuncion])
}
