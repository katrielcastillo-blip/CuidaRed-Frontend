/*
 * Abreviaturas.tsx — Ayuda de abreviaturas para campos de texto del kit (RF-06 · CU-07): expansión al escribir,
 * lista de sugerencias (teclado y táctil, ≥ 48 px) y botón "Procesar abreviaturas". Funciona sin conexión
 * porque lee el catálogo de `@/domain/abreviaturas` (memoria + IndexedDB + lista empaquetada).
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * No se usa directamente: lo activan `TextareaAbreviado` y la prop `abreviaturas` de `TextField` / `TextareaField`.
 * Patrón de accesibilidad: el campo mantiene el foco; las sugerencias son una lista (`role="listbox"`) que se
 * recorre con ↑ ↓, se elige con Intro y se cierra con Esc (`aria-activedescendant`). Con el dedo se toca
 * la opción directamente.
 */
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { WandSparkles } from 'lucide-react'
import { ajustarMayusculas, expandirAbreviatura, expandirAbreviaturasConConteo, sugerencias, useAbreviaturas, type Abreviatura } from '@/domain/abreviaturas'
import { avisar } from '@/domain/avisos'
import { cn } from '@/lib/cn'
import { Button } from './Button'

type Campo = HTMLInputElement | HTMLTextAreaElement

/** Mínimo de letras escritas para ofrecer sugerencias (evita ruido con cada letra suelta). */
const MIN_LETRAS = 2
const MAX_SUGERENCIAS = 4

interface Fragmento {
  inicio: number
  fin: number
  texto: string
  /** Largo total del campo cuando se calculó (para respetar maxLength al sugerir). */
  largo: number
}

/** Trozo de letras que termina en el cursor (la palabra que se está escribiendo), o null si no aplica. */
function fragmentoEnCursor(el: Campo): Fragmento | null {
  const { value, selectionStart: ini, selectionEnd: fin } = el
  if (ini === null || ini !== fin) return null
  let i = ini
  while (i > 0 && /\p{L}/u.test(value[i - 1]!)) i--
  if (i === ini) return null
  const antes = value[i - 1]
  // Debe empezar la palabra (no "120pa" ni "a/pa") y el cursor no estar en medio de otra.
  if (antes !== undefined && !/[\s(¿¡"'“«]/u.test(antes)) return null
  const despues = value[ini]
  if (despues !== undefined && /[\p{L}\p{N}]/u.test(despues)) return null
  return { inicio: i, fin: ini, texto: value.slice(i, ini), largo: value.length }
}

/**
 * Cambia el valor de un campo como si la persona lo hubiera escrito: dispara su `onChange` de React, así
 * funciona igual con campos controlados por el formulario, por `useFormulario` o por `onValueChange`.
 */
function escribirEnCampo(el: Campo, texto: string, cursor: number, despues?: () => void) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const asignar = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (asignar) asignar.call(el, texto)
  else el.value = texto
  el.dispatchEvent(new Event('input', { bubbles: true }))
  requestAnimationFrame(() => {
    el.focus()
    try {
      el.setSelectionRange(cursor, cursor)
    } catch {
      /* tipos de campo sin cursor (number, date…) */
    }
    despues?.()
  })
}

interface Manejadores<E extends Campo> {
  onChange?: (e: ChangeEvent<E>) => void
  onKeyDown?: (e: KeyboardEvent<E>) => void
  onKeyUp?: (e: KeyboardEvent<E>) => void
  onClick?: (e: MouseEvent<E>) => void
  onFocus?: (e: FocusEvent<E>) => void
  onBlur?: (e: FocusEvent<E>) => void
}

export function useAyudaAbreviaturas<E extends Campo>({
  maxLength,
  valor,
  deshabilitado,
  botonProcesar = true,
  manejadores,
}: {
  maxLength?: number
  /** Valor controlado actual (si lo hay): sirve para saber si la persona acaba de añadir un solo carácter. */
  valor?: unknown
  deshabilitado?: boolean
  botonProcesar?: boolean
  manejadores: Manejadores<E>
}) {
  useAbreviaturas() // vuelve a pintar cuando el catálogo termina de cargar o se sincroniza
  const idLista = useId()
  const ref = useRef<E>(null)
  const refLista = useRef<HTMLDivElement>(null)
  const previo = useRef(0)
  const ultimo = useRef<Fragmento | null>(null)
  const [fragmento, setFragmento] = useState<Fragmento | null>(null)
  const [activa, setActiva] = useState(-1)
  const [cerrada, setCerrada] = useState(false)
  const [resultado, setResultado] = useState('')

  const cabe = (largo: number) => maxLength === undefined || maxLength < 0 || largo <= maxLength

  const opciones = useMemo<Abreviatura[]>(() => {
    if (!fragmento || cerrada || deshabilitado || fragmento.texto.length < MIN_LETRAS) return []
    const sinFragmento = fragmento.largo - fragmento.texto.length
    const cabeEn = (extra: number) => maxLength === undefined || maxLength < 0 || sinFragmento + extra <= maxLength
    return sugerencias(fragmento.texto, MAX_SUGERENCIAS).filter((a) => cabeEn(a.expansion.length + 1))
  }, [fragmento, cerrada, deshabilitado, maxLength])

  const abierta = opciones.length > 0
  // Para lectores de pantalla: cuántas sugerencias hay o, tras elegir una, qué se expandió.
  const anuncio = abierta
    ? `${opciones.length} ${opciones.length === 1 ? 'sugerencia' : 'sugerencias'} de abreviaturas. Usa las flechas para elegir y Intro para aceptar.`
    : resultado

  const actualizar = (el: Campo) => {
    const nuevo = fragmentoEnCursor(el)
    const ant = ultimo.current
    if (nuevo?.inicio === ant?.inicio && nuevo?.texto === ant?.texto && nuevo?.largo === ant?.largo) return
    ultimo.current = nuevo
    setFragmento(nuevo)
    setActiva(-1)
    setCerrada(false)
    setResultado('')
  }

  // La lista aparece debajo del campo: se asegura de que no quede fuera de la pantalla (p. ej. con el teclado abierto).
  useEffect(() => {
    if (abierta) refLista.current?.scrollIntoView?.({ block: 'nearest' })
  }, [abierta])

  const elegir = (a: Abreviatura) => {
    const el = ref.current
    if (!el || !fragmento) return
    const texto = ajustarMayusculas(fragmento.texto, a.expansion)
    const antes = el.value.slice(0, fragmento.inicio)
    const despues = el.value.slice(fragmento.fin)
    const espacio = /^[\s.,;:!?)]/.test(despues) ? '' : ' '
    escribirEnCampo(el, antes + texto + espacio + despues, antes.length + texto.length + espacio.length, () => actualizar(el))
    ultimo.current = null
    setFragmento(null)
    setActiva(-1)
    setResultado(`«${a.sigla}» se expandió a «${texto}».`)
  }

  const alCambiar = (e: ChangeEvent<E>) => {
    const el = e.currentTarget
    const nuevo = el.value
    const base = typeof valor === 'string' ? valor.length : previo.current
    // Solo al añadir un carácter al final (no al borrar, pegar ni editar en medio).
    const alFinal = nuevo.length === base + 1 && el.selectionStart === nuevo.length
    // Con el teclado predictivo (IME) el texto aún se está componiendo: no se toca (usa las sugerencias o el botón).
    const componiendo = (e.nativeEvent as InputEvent | undefined)?.isComposing === true
    if (alFinal && !componiendo) {
      const expandido = expandirAbreviatura(nuevo)
      if (expandido !== nuevo && cabe(expandido.length)) {
        el.value = expandido // el onChange del formulario ya lee el texto expandido
        try {
          el.setSelectionRange(expandido.length, expandido.length)
        } catch {
          /* sin cursor */
        }
      }
    }
    previo.current = el.value.length
    manejadores.onChange?.(e)
    actualizar(el)
  }

  const alTecla = (e: KeyboardEvent<E>) => {
    manejadores.onKeyDown?.(e)
    if (e.defaultPrevented || !abierta) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiva((i) => (i + 1) % opciones.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiva((i) => (i <= 0 ? opciones.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activa >= 0) {
      e.preventDefault()
      elegir(opciones[activa]!)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setCerrada(true)
      setActiva(-1)
    }
  }

  const alSoltarTecla = (e: KeyboardEvent<E>) => {
    manejadores.onKeyUp?.(e)
    actualizar(e.currentTarget)
  }

  const alHacerClic = (e: MouseEvent<E>) => {
    manejadores.onClick?.(e)
    actualizar(e.currentTarget)
  }

  const alEnfocar = (e: FocusEvent<E>) => {
    manejadores.onFocus?.(e)
    previo.current = e.currentTarget.value.length
    actualizar(e.currentTarget)
  }

  const alSalir = (e: FocusEvent<E>) => {
    manejadores.onBlur?.(e)
    // Tocar una sugerencia no cuenta como salir del campo.
    if (refLista.current && e.relatedTarget instanceof Node && refLista.current.contains(e.relatedTarget)) return
    ultimo.current = null
    setFragmento(null)
    setActiva(-1)
  }

  const procesar = () => {
    const el = ref.current
    if (!el) return
    const { texto, cambios } = expandirAbreviaturasConConteo(el.value)
    if (cambios === 0) {
      avisar('No encontramos abreviaturas para expandir en el texto.', 'info')
      return
    }
    if (!cabe(texto.length)) {
      avisar(`Al expandir las abreviaturas el texto pasaría de ${maxLength} caracteres. Acórtalo e inténtalo de nuevo.`, 'error')
      return
    }
    escribirEnCampo(el, texto, texto.length)
    avisar(cambios === 1 ? 'Se expandió 1 abreviatura.' : `Se expandieron ${cambios} abreviaturas.`, 'ok')
  }

  const lista: ReactNode = (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>
      {abierta && (
        <div
          ref={refLista}
          id={idLista}
          role="listbox"
          aria-label="Sugerencias de abreviaturas"
          className="absolute inset-x-0 top-full z-30 mt-1 flex flex-col gap-1 rounded-md border border-line bg-surface p-1 shadow-2"
        >
          {opciones.map((a, i) => (
            <button
              key={a.sigla}
              id={`${idLista}-${i}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={i === activa}
              aria-label={`${a.sigla}: ${a.expansion}`}
              className={cn(
                'flex min-h-12 items-center gap-2 rounded-sm px-3 text-left text-base text-ink',
                i === activa ? 'bg-blue-100 outline-2 outline-navy' : 'hover:bg-blue-100',
              )}
              // Mantiene el foco (y el teclado abierto) en el campo mientras se toca la opción.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(a)}
            >
              <span className="font-bold text-navy">{a.sigla}</span>
              <span aria-hidden className="text-muted">
                →
              </span>
              <span className="min-w-0 flex-1 truncate text-ink-2">{a.expansion}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )

  const boton: ReactNode = botonProcesar ? (
    <Button variant="light" size="sm" icon={<WandSparkles size={18} aria-hidden />} onClick={procesar} disabled={deshabilitado}>
      Procesar abreviaturas
    </Button>
  ) : null

  return {
    ref,
    /** Propiedades que se añaden al <input> / <textarea>. */
    campoProps: {
      onChange: alCambiar,
      onKeyDown: alTecla,
      onKeyUp: alSoltarTecla,
      onClick: alHacerClic,
      onFocus: alEnfocar,
      onBlur: alSalir,
      'aria-autocomplete': 'list' as const,
      'aria-controls': abierta ? idLista : undefined,
      'aria-activedescendant': abierta && activa >= 0 ? `${idLista}-${activa}` : undefined,
    },
    /** Lista de sugerencias: va dentro de un contenedor `relative` justo después del campo. */
    lista,
    /** Botón "Procesar abreviaturas": va al pie del campo. */
    boton,
  }
}
