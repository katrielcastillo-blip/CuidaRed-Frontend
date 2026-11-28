/*
 * TextareaAbreviado.tsx — Área de texto con soporte de abreviaturas (RF-06 · CU-07): "pa " → "presión arterial ".
 *  - Al escribir un espacio o signo de puntuación tras la sigla, esta se expande sola.
 *  - Mientras se escribe aparecen sugerencias (teclado y táctil, ≥ 48 px): al elegir una se expande la sigla.
 *  - El botón "Procesar abreviaturas" expande todas las siglas del texto de una vez.
 *  - Funciona sin conexión: el catálogo está en IndexedDB y en la lista empaquetada (`@/domain/abreviaturas`).
 * La lista completa se muestra como ayuda en línea ("?").
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ChangeEvent, TextareaHTMLAttributes } from 'react'
import { textoAyudaAbreviaturas, useAbreviaturas, type Abreviatura } from '@/domain/abreviaturas'
import { TextareaField } from './Fields'

// Se conserva la API histórica: la lógica vive ahora en el dominio (catálogo en IndexedDB).
export { expandirAbreviatura } from '@/domain/abreviaturas'

/** Texto de ayuda con la lista de siglas empaquetada ("pa → presión arterial · …"). */
export const AYUDA_ABREVIATURAS = textoAyudaAbreviaturas()

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  label?: string
  error?: string
  hint?: string
  value: string
  onValueChange: (v: string) => void
  /** Muestra el botón "Procesar abreviaturas" (por defecto sí). */
  botonProcesar?: boolean
}

export function TextareaAbreviado({ value, onValueChange, hint, botonProcesar = true, ...rest }: Props) {
  const catalogo: Abreviatura[] = useAbreviaturas()
  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => onValueChange(e.target.value)
  return (
    <TextareaField
      {...rest}
      value={value}
      onChange={onChange}
      abreviaturas
      procesarAbreviaturas={botonProcesar}
      hint={hint ?? 'Puedes usar abreviaturas: se completan solas (toca ? para ver la lista).'}
      help={
        <span className="block">
          <span className="block font-semibold">Abreviaturas disponibles</span>
          <span className="mt-1 block columns-2 gap-x-3">
            {catalogo.map((a) => (
              <span key={a.sigla} className="block break-inside-avoid py-0.5">
                <b>{a.sigla}</b> → {a.expansion}
              </span>
            ))}
          </span>
        </span>
      }
    />
  )
}
