import { useCallback, useState } from 'react'

/** Valor especial del selector: sin filtrar por familia. */
export const TODAS = 'todas'

const clave = (userId: string) => `cuidared:familia:${userId}`

function leer(userId: string): string | null {
  try {
    return localStorage.getItem(clave(userId))
  } catch {
    return null
  }
}

/**
 * Familia seleccionada en el Dashboard ("▾ Flia. Rodríguez"). Se recuerda por usuario en localStorage
 * (`cuidared:familia:<userId>`). Si no hay valor guardado, o la familia ya no pertenece al usuario, usa la primera.
 */
export function useFamiliaSeleccionada(userId: string, familiaIds: string[]): [string, (valor: string) => void] {
  const [guardada, setGuardada] = useState<string | null>(() => leer(userId))
  const valida = guardada === TODAS || (guardada !== null && familiaIds.includes(guardada))
  const actual = valida && guardada ? guardada : (familiaIds[0] ?? TODAS)

  const cambiar = useCallback(
    (valor: string) => {
      setGuardada(valor)
      try {
        localStorage.setItem(clave(userId), valor)
      } catch {
        /* modo privado: la selección solo dura la sesión */
      }
    },
    [userId],
  )
  return [actual, cambiar]
}
