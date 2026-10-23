/*
 * TextareaAbreviado.tsx — Área de texto con soporte de abreviaturas (RF-06): "pa " → "presión arterial ".
 * La expansión ocurre al escribir un espacio o signo de puntuación tras la abreviatura; la lista se
 * muestra como ayuda en línea.
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ChangeEvent, TextareaHTMLAttributes } from 'react'
import { ABREVIATURAS } from '@/domain/catalogos'
import { TextareaField } from './Fields'

/** Expande la última palabra si es una abreviatura conocida y va seguida de espacio o puntuación. */
export function expandirAbreviatura(texto: string): string {
  const m = /(^|[\s(¿¡])([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\.?([\s,.;:!?)])$/.exec(texto)
  if (!m) return texto
  const palabra = m[2]!
  const exp = ABREVIATURAS[palabra.toLowerCase()]
  if (!exp) return texto
  const inicio = texto.length - (m[0].length - m[1]!.length)
  // Conserva la mayúscula inicial si la abreviatura empieza una oración.
  const reemplazo = palabra[0] === palabra[0]!.toUpperCase() && palabra.length > 1 && palabra !== palabra.toUpperCase() ? exp[0]!.toUpperCase() + exp.slice(1) : exp
  return texto.slice(0, inicio) + reemplazo + m[3]
}

export const AYUDA_ABREVIATURAS = Object.entries(ABREVIATURAS)
  .map(([a, e]) => `${a} → ${e}`)
  .join(' · ')

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  label?: string
  error?: string
  hint?: string
  value: string
  onValueChange: (v: string) => void
}

export function TextareaAbreviado({ value, onValueChange, hint, ...rest }: Props) {
  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const nuevo = e.target.value
    // Solo al añadir texto al final (no al borrar ni al editar en medio).
    const alFinal = nuevo.length === value.length + 1 && e.target.selectionStart === nuevo.length
    onValueChange(alFinal ? expandirAbreviatura(nuevo) : nuevo)
  }
  return (
    <TextareaField
      {...rest}
      value={value}
      onChange={onChange}
      hint={hint ?? 'Puedes usar abreviaturas: se completan solas (toca ? para ver la lista).'}
      help={<span>Abreviaturas disponibles: {AYUDA_ABREVIATURAS}</span>}
    />
  )
}
