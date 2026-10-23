/*
 * useBorrador.ts — Estado de formulario que se conserva si la pantalla se cierra, se recarga o falla algo
 * (SRS §8.2.2.1.22 Robustez: "preservando en todo momento los datos que ya hayan sido ingresados").
 * Módulo: utilidades compartidas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *   const [datos, setDatos, descartar] = useBorrador('visita:a-elena', VALORES_INICIALES)
 *   … al guardar con éxito: descartar()
 * Se guarda en sessionStorage (no sobrevive al cierre del navegador: evita dejar datos sensibles).
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

const PREFIJO = 'cuidared:borrador:'

function leer<T>(clave: string, inicial: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIJO + clave)
    return raw ? ({ ...inicial, ...(JSON.parse(raw) as T) } as T) : inicial
  } catch {
    return inicial
  }
}

export function useBorrador<T extends object>(clave: string, inicial: T): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [valor, setValor] = useState<T>(() => leer(clave, inicial))
  const descartado = useRef(false)

  useEffect(() => {
    if (descartado.current) return
    try {
      sessionStorage.setItem(PREFIJO + clave, JSON.stringify(valor))
    } catch {
      /* sin espacio: el formulario sigue funcionando en memoria */
    }
  }, [clave, valor])

  const descartar = useCallback(() => {
    descartado.current = true
    try {
      sessionStorage.removeItem(PREFIJO + clave)
    } catch {
      /* ignorar */
    }
  }, [clave])

  return [valor, setValor, descartar]
}
