/*
 * useFormulario.ts — Estado de formulario con validación por campo, errores accesibles y borrador local (CR-178).
 * Base de CU-02 (perfil), CU-03 (editar perfil) y CU-07 (visita y necesidad): RF-06.
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Qué resuelve
 *  - Valores del formulario guardados como borrador (`useBorrador`, sessionStorage): nunca se pierde lo escrito.
 *  - Validación por campo al salir de él (`touched`) y validación completa al enviar.
 *  - El mensaje de error aparece junto al campo (el kit pone aria-invalid y aria-describedby).
 *  - Al enviar con errores, el foco va al primer campo inválido (en el orden del formulario).
 *  - Errores del servicio (`Resultado.errores`) se muestran igual que los locales.
 *  - Si lo escrito se recuperó de un borrador, `borradorRecuperado` permite avisarlo (`AvisoBorrador`).
 *
 * Ejemplo
 *   const f = useFormulario({
 *     clave: `necesidad:${user.id}`,
 *     inicial: { adultoId: '', descripcion: '', prioridad: '' as Prioridad | '' },
 *     reglas: { adultoId: requerido('Elige el adulto.'), descripcion: (v) => (v.trim().length < 5 ? 'Describe la necesidad.' : undefined) },
 *   })
 *   <form onSubmit={f.enviar((v) => registrarNecesidad(user, v))} noValidate>
 *     <SelectField label="Adulto" options={…} {...f.campo('adultoId')} />
 *     <TextareaAbreviado label="Descripción" {...f.abreviado('descripcion')} />
 *     <ChoicePills label="Prioridad" options={…} {...f.valor('prioridad')} />
 *     <Button type="submit" loading={f.enviando}>Guardar</Button>
 *   </form>
 */
import { useCallback, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useBorradorCompleto } from '@/lib/useBorrador'

type Clave<T> = keyof T & string
/** Claves de T cuyo valor es de tipo V. */
type ClavesDe<T, V> = { [K in keyof T & string]: T[K] extends V ? K : never }[keyof T & string]

/** Mensaje de error por campo; vacío o undefined = válido. */
export type ErroresFormulario = Record<string, string | undefined>

/** Regla de un campo: recibe su valor y todos los valores (para reglas cruzadas); devuelve el mensaje o nada. */
export type ReglaCampo<T, K extends keyof T> = (valor: T[K], valores: T) => string | undefined | false | null
export type ReglasFormulario<T> = { [K in Clave<T>]?: ReglaCampo<T, K> }

/** Respuesta que `enviar` entiende de la acción: la `Resultado` del dominio (`{ ok, errores? }`); cualquier otra cosa cuenta como éxito. */
export interface RespuestaEnvio {
  ok: boolean
  errores?: ErroresFormulario
}

export interface OpcionesFormulario<T extends object> {
  /** Clave del borrador (única por formulario y usuario), p. ej. `visita:${user.id}:${adultoId}`. */
  clave: string
  inicial: T
  /** Reglas por campo (validación al salir del campo y al enviar). */
  reglas?: ReglasFormulario<T>
  /** Validación completa o cruzada (p. ej. `validarAdulto`). Se combina con `reglas`; manda esta si ambas fallan. */
  validar?: (valores: T) => ErroresFormulario
  /** Orden de los campos en pantalla: define cuál recibe el foco primero. Por defecto, el orden de `inicial`. */
  campos?: Array<Clave<T>>
  /** Campos que no se guardan en el borrador (contraseñas, códigos). */
  excluirDeBorrador?: Array<Clave<T>>
}

export interface Formulario<T extends object> {
  valores: T
  /** Errores que se muestran: campo ya tocado, tras intentar enviar, o devueltos por el servicio. */
  errores: ErroresFormulario
  /** Campos por los que ya se pasó (o que se cambiaron). */
  touched: Partial<Record<Clave<T>, boolean>>
  /** true tras el primer intento de enviar (o de avanzar de paso). */
  intentado: boolean
  /** true si no hay ningún error de validación (aunque no se vea todavía). */
  valido: boolean
  enviando: boolean
  /** Prefijo común de los `id` (`${prefijo}-${campo}`): permite enlazar y enfocar campos. */
  prefijo: string
  idDe: (campo: Clave<T>) => string

  set: <K extends Clave<T>>(campo: K, valor: T[K]) => void
  setValores: (parcial: Partial<T>) => void
  tocar: (campo: Clave<T>) => void

  /** Para TextField / SelectField / TextareaField: `<TextField {...f.campo('nombre')} />`. */
  campo: <K extends ClavesDe<T, string>>(campo: K) => CamposEvento<T, K>
  /** Para Checkbox: `<Checkbox label="…" {...f.casilla('consentimiento')} />`. */
  casilla: <K extends ClavesDe<T, boolean>>(campo: K) => CasillaProps<K>
  /** Para ChoicePills y CheckboxGroup (onChange recibe el valor): `<ChoicePills {...f.valor('sexo')} />`. */
  valor: <K extends Clave<T>>(campo: K) => ValorProps<T, K>
  /** Para TextareaAbreviado: `<TextareaAbreviado {...f.abreviado('observaciones')} />`. */
  abreviado: <K extends ClavesDe<T, string>>(campo: K) => AbreviadoProps<K>

  /**
   * Valida estos campos (todos si no se indica), los marca como tocados y lleva el foco al primero inválido.
   * Devuelve true si todos son válidos. Es lo que usa cada paso de `FormPasos` al pulsar "Siguiente".
   */
  validarCampos: (campos?: Array<Clave<T>>) => boolean
  /** Primer campo con error de validación (en el orden del formulario), sin mostrar nada. */
  primerError: (campos?: Array<Clave<T>>) => Clave<T> | undefined
  /** Lleva el foco (y el desplazamiento) al campo. */
  enfocar: (campo: string) => void
  /**
   * Devuelve el manejador de `onSubmit`: valida todo; si hay errores enfoca el primero y no envía; si no, llama a
   * `accion(valores)`. Si la acción responde `{ ok: false, errores }` los muestra junto a cada campo y enfoca el
   * primero; si responde bien (o no responde), descarta el borrador. Resuelve con el campo en error, si lo hubo.
   */
  enviar: (accion: (valores: T) => unknown) => (e?: FormEvent) => Promise<string | undefined>
  /** Muestra errores devueltos por el servicio y enfoca el primero. Devuelve ese campo. */
  aplicarErrores: (errores?: ErroresFormulario) => string | undefined

  /** true si lo que hay en pantalla se recuperó de un borrador al abrir el formulario. */
  borradorRecuperado: boolean
  /** Botón "Descartar" del aviso: vuelve a los valores iniciales y borra el borrador. */
  descartarBorrador: () => void
  /** Cierra el aviso sin tocar lo escrito. */
  cerrarAvisoBorrador: () => void
  /** Borra el borrador guardado sin cambiar lo que hay en pantalla (al guardar con éxito, `enviar` ya lo hace). */
  limpiarBorrador: () => void
}

export interface CamposEvento<T, K extends keyof T> {
  id: string
  name: K
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  onBlur: () => void
  error: string | undefined
}
export interface CasillaProps<K> {
  id: string
  name: K
  checked: boolean
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
  error: string | undefined
}
export interface ValorProps<T, K extends keyof T> {
  id: string
  value: T[K]
  onChange: (v: T[K]) => void
  error: string | undefined
}
export interface AbreviadoProps<K> {
  id: string
  name: K
  value: string
  onValueChange: (v: string) => void
  onBlur: () => void
  error: string | undefined
}

/** Regla "obligatorio" para textos (se ignoran los espacios), listas y casillas marcadas. */
export const requerido =
  (mensaje: string) =>
  (valor: unknown): string | undefined => {
    const lleno = typeof valor === 'string' ? valor.trim() !== '' : Array.isArray(valor) ? valor.length > 0 : typeof valor === 'boolean' ? valor : valor !== undefined && valor !== null
    return lleno ? undefined : mensaje
  }

const reduceMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function useFormulario<T extends object>(opciones: OpcionesFormulario<T>): Formulario<T> {
  const { clave, inicial, reglas, validar, campos, excluirDeBorrador } = opciones
  const prefijo = useId()
  const { valor: valores, setValor, descartar, recuperado, cerrarAviso, reiniciar } = useBorradorCompleto<T>(clave, inicial, { excluir: excluirDeBorrador })
  const [touched, setTouched] = useState<Partial<Record<Clave<T>, boolean>>>({})
  const [intentado, setIntentado] = useState(false)
  const [servidor, setServidor] = useState<ErroresFormulario>({})
  const [enviando, setEnviando] = useState(false)
  const enCurso = useRef(false)
  const orden: string[] = campos ?? Object.keys(inicial)

  const idDe = useCallback((campo: string) => `${prefijo}-${campo}`, [prefijo])

  /* ───────────── Validación ───────────── */
  const calculados: ErroresFormulario = {}
  for (const k of Object.keys(reglas ?? {}) as Array<Clave<T>>) {
    const regla = reglas?.[k] as ReglaCampo<T, typeof k> | undefined
    const msg = regla?.(valores[k], valores)
    if (msg) calculados[k] = msg
  }
  if (validar) {
    for (const [k, msg] of Object.entries(validar(valores))) if (msg) calculados[k] = msg
  }

  const visibles: ErroresFormulario = {}
  for (const k of Object.keys(calculados)) {
    if (touched[k as Clave<T>] || intentado) visibles[k] = calculados[k]
  }
  for (const [k, msg] of Object.entries(servidor)) if (msg) visibles[k] = msg

  const primerError = (lista?: Array<Clave<T>>): Clave<T> | undefined => {
    const candidatos = lista ?? (orden as Array<Clave<T>>)
    // Campos con error que no están en la lista de orden se revisan al final.
    const ordenados = lista ? candidatos : [...candidatos, ...(Object.keys(calculados).filter((k) => !candidatos.includes(k as Clave<T>)) as Array<Clave<T>>)]
    return ordenados.find((k) => calculados[k])
  }

  /* ───────────── Foco ───────────── */
  const enfocar = useCallback(
    (campo: string) => {
      const id = idDe(campo)
      // Se reintenta por tiempo (no por número de fotogramas): en equipos lentos el paso puede tardar en pintarse.
      const limite = performance.now() + 2000
      const intentar = () => {
        const el = document.getElementById(id)
        // Un grupo (casillas, píldoras) enfoca su primer control.
        const objetivo = el?.matches('input,select,textarea,button')
          ? el
          : el?.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])')
        if (objetivo) {
          objetivo.focus({ preventScroll: true })
          objetivo.scrollIntoView?.({ block: 'center', behavior: reduceMovimiento() ? 'auto' : 'smooth' })
          return
        }
        // El campo puede estar en otro paso que aún se está pintando.
        if (performance.now() < limite) requestAnimationFrame(intentar)
      }
      requestAnimationFrame(intentar)
    },
    [idDe],
  )

  /* ───────────── Cambios ───────────── */
  const tocar = useCallback((campo: Clave<T>) => setTouched((t) => (t[campo] ? t : { ...t, [campo]: true })), [])

  const quitarErrorServidor = (campo: string) => setServidor((s) => (s[campo] ? { ...s, [campo]: undefined } : s))

  const set = <K extends Clave<T>>(campo: K, v: T[K]) => {
    setValor((x) => ({ ...x, [campo]: v }))
    quitarErrorServidor(campo)
  }

  const setValores = (parcial: Partial<T>) => {
    setValor((x) => ({ ...x, ...parcial }))
    setServidor((s) => {
      const resto = { ...s }
      for (const k of Object.keys(parcial)) delete resto[k]
      return resto
    })
  }

  /* ───────────── Props para los campos del kit ───────────── */
  const campo = <K extends ClavesDe<T, string>>(n: K): CamposEvento<T, K> => ({
    id: idDe(n),
    name: n,
    value: valores[n] as unknown as string,
    onChange: (e) => set(n, e.target.value as T[K]),
    onBlur: () => tocar(n),
    error: visibles[n],
  })

  const casilla = <K extends ClavesDe<T, boolean>>(n: K): CasillaProps<K> => ({
    id: idDe(n),
    name: n,
    checked: valores[n] as unknown as boolean,
    onChange: (e) => {
      set(n, e.target.checked as T[K])
      tocar(n)
    },
    onBlur: () => tocar(n),
    error: visibles[n],
  })

  const valor = <K extends Clave<T>>(n: K): ValorProps<T, K> => ({
    id: idDe(n),
    value: valores[n],
    // Estos controles no tienen "salida" (blur): se consideran tocados al cambiar.
    onChange: (v) => {
      set(n, v)
      tocar(n)
    },
    error: visibles[n],
  })

  const abreviado = <K extends ClavesDe<T, string>>(n: K): AbreviadoProps<K> => ({
    id: idDe(n),
    name: n,
    value: valores[n] as unknown as string,
    onValueChange: (v) => set(n, v as T[K]),
    onBlur: () => tocar(n),
    error: visibles[n],
  })

  /* ───────────── Envío ───────────── */
  const validarCampos = (lista?: Array<Clave<T>>): boolean => {
    setTouched((t) => {
      const siguiente = { ...t }
      for (const k of lista ?? (orden as Array<Clave<T>>)) siguiente[k] = true
      return siguiente
    })
    const malo = primerError(lista)
    if (malo) {
      enfocar(malo)
      return false
    }
    return true
  }

  const aplicarErrores = (errores?: ErroresFormulario): string | undefined => {
    const limpios: ErroresFormulario = {}
    for (const [k, msg] of Object.entries(errores ?? {})) if (msg) limpios[k] = msg
    setServidor(limpios)
    const primero = [...orden, ...Object.keys(limpios)].find((k) => limpios[k])
    if (primero) enfocar(primero)
    return primero
  }

  const enviar =
    (accion: (v: T) => unknown) =>
    async (e?: FormEvent): Promise<string | undefined> => {
      e?.preventDefault()
      if (enCurso.current) return undefined
      setIntentado(true)
      const malo = primerError()
      if (malo) {
        enfocar(malo)
        return malo
      }
      enCurso.current = true
      setEnviando(true)
      try {
        const respuesta = (await accion(valores)) as Partial<RespuestaEnvio> | null | undefined
        if (respuesta && typeof respuesta === 'object' && respuesta.ok === false) return aplicarErrores(respuesta.errores)
        setServidor({})
        descartar()
        return undefined
      } finally {
        enCurso.current = false
        setEnviando(false)
      }
    }

  const limpiarBorrador = descartar
  const descartarBorrador = () => {
    reiniciar()
    setTouched({})
    setIntentado(false)
    setServidor({})
  }

  return {
    valores,
    errores: visibles,
    touched,
    intentado,
    valido: Object.keys(calculados).length === 0,
    enviando,
    prefijo,
    idDe,
    set,
    setValores,
    tocar,
    campo,
    casilla,
    valor,
    abreviado,
    validarCampos,
    primerError,
    enfocar,
    enviar,
    aplicarErrores,
    borradorRecuperado: recuperado,
    descartarBorrador,
    cerrarAvisoBorrador: cerrarAviso,
    limpiarBorrador,
  }
}
