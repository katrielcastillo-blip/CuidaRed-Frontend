/*
 * useBorrador.ts — Estado de formulario que se conserva si la pantalla se cierra, se recarga o falla algo
 * (SRS §8.2.2.1.22 Robustez: "preservando en todo momento los datos que ya hayan sido ingresados").
 * Módulo: utilidades compartidas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *   const [datos, setDatos, descartar] = useBorrador('visita:a-elena', VALORES_INICIALES)
 *   … al guardar con éxito: descartar()
 * Se guarda en sessionStorage (no sobrevive al cierre del navegador: evita dejar datos sensibles).
 *
 * Detalles:
 *  - No se escribe nada hasta que la persona cambia algún valor: abrir y cerrar un formulario vacío no deja
 *    borradores (y no se ofrece "recuperar" lo que nunca se escribió).
 *  - `useBorradorCompleto` es la variante que usa `useFormulario`: además indica si se recuperó un borrador
 *    (para mostrar el aviso "Recuperamos lo que estabas escribiendo"), permite empezar de nuevo y puede dejar
 *    campos fuera del borrador (contraseñas, códigos…).
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

const PREFIJO = 'cuidared:borrador:'

type Registro = Record<string, unknown>

const sinCampos = (o: object, campos: readonly string[]): Registro => {
  const copia = { ...(o as Registro) }
  for (const c of campos) delete copia[c]
  return copia
}

function leer<T extends object>(clave: string, inicial: T, excluir: readonly string[]): { valor: T; recuperado: boolean } {
  try {
    const raw = sessionStorage.getItem(PREFIJO + clave)
    if (!raw) return { valor: inicial, recuperado: false }
    const guardado: unknown = JSON.parse(raw)
    if (!guardado || typeof guardado !== 'object' || Array.isArray(guardado)) return { valor: inicial, recuperado: false }
    // Lo guardado se superpone a los valores iniciales; los campos excluidos nunca se restauran.
    const valor = { ...inicial, ...sinCampos(guardado, excluir) } as T
    return { valor, recuperado: JSON.stringify(sinCampos(valor, excluir)) !== JSON.stringify(sinCampos(inicial, excluir)) }
  } catch {
    return { valor: inicial, recuperado: false }
  }
}

export interface OpcionesBorrador {
  /** Campos que no se guardan en el borrador (p. ej. contraseñas). */
  excluir?: readonly string[]
}

export interface BorradorCompleto<T> {
  valor: T
  setValor: Dispatch<SetStateAction<T>>
  /** Borra el borrador guardado (al guardar con éxito). El valor en pantalla no cambia y deja de guardarse. */
  descartar: () => void
  /** true si al abrir el formulario se restauró un borrador distinto de los valores iniciales. */
  recuperado: boolean
  /** Oculta el aviso de recuperación sin tocar los valores. */
  cerrarAviso: () => void
  /** Vuelve a los valores iniciales, borra el borrador y oculta el aviso (botón "Descartar"). */
  reiniciar: () => void
}

export function useBorradorCompleto<T extends object>(clave: string, inicial: T, opciones: OpcionesBorrador = {}): BorradorCompleto<T> {
  const excluir = opciones.excluir ?? []
  const excluirClave = excluir.join('|')
  const inicialRef = useRef(inicial)
  const [estado] = useState(() => leer(clave, inicial, excluir))
  const [valor, setValorInterno] = useState<T>(estado.valor)
  const [recuperado, setRecuperado] = useState(estado.recuperado)
  const descartado = useRef(false)
  const modificado = useRef(false)

  // El cambio de clave dentro del mismo componente no está soportado (las pantallas usan `key={clave}`).
  const setValor = useCallback<Dispatch<SetStateAction<T>>>((a) => {
    modificado.current = true
    setValorInterno(a)
  }, [])

  useEffect(() => {
    if (descartado.current || !modificado.current) return
    try {
      sessionStorage.setItem(PREFIJO + clave, JSON.stringify(sinCampos(valor, excluirClave ? excluirClave.split('|') : [])))
    } catch {
      /* sin espacio: el formulario sigue funcionando en memoria */
    }
  }, [clave, valor, excluirClave])

  const quitar = useCallback(() => {
    try {
      sessionStorage.removeItem(PREFIJO + clave)
    } catch {
      /* ignorar */
    }
  }, [clave])

  const descartar = useCallback(() => {
    descartado.current = true
    quitar()
  }, [quitar])

  const reiniciar = useCallback(() => {
    quitar()
    descartado.current = false
    modificado.current = false
    setValorInterno(inicialRef.current)
    setRecuperado(false)
  }, [quitar])

  const cerrarAviso = useCallback(() => setRecuperado(false), [])

  return { valor, setValor, descartar, recuperado, cerrarAviso, reiniciar }
}

export function useBorrador<T extends object>(clave: string, inicial: T): [T, Dispatch<SetStateAction<T>>, () => void] {
  const { valor, setValor, descartar } = useBorradorCompleto(clave, inicial)
  return [valor, setValor, descartar]
}
