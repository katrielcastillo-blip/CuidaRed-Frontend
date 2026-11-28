/*
 * controles.tsx — Formularios, consultas y paginación de los módulos conectados.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type HTMLInputTypeAttribute, type InputHTMLAttributes, type ReactNode } from 'react'
import { Aviso, Button, Checkbox, Icono, SelectField, TextField, TextareaField, type NombreIcono } from '@/components/ui'
import { cn } from '@/lib/cn'
import { suscribirConectividad } from '@/domain/conectividad'
import { api, apiPage, ApiError } from '../client'
import { mensajeDeError } from '../errores'
import type { CollectionQuery, PaginatedResponse } from '@/lib/api-contract'

type Consulta<T> = { clave: string; token: string; revision: number; datos?: T; error?: true; fallo?: unknown }

const conexionReal = () => typeof navigator === 'undefined' || navigator.onLine
export const useConexionReal = () => useSyncExternalStore(suscribirConectividad, conexionReal, conexionReal)

function useConsulta<T>(ruta: string | null, token: string, revision: number, consulta?: string) {
  const enLinea = useConexionReal()
  const [resultado, setResultado] = useState<Consulta<T>>()
  const [reintento, setReintento] = useState(0)
  const clave = ruta ? `${ruta}|${consulta ?? ''}` : null
  useEffect(() => {
    if (!ruta || !clave || !enLinea) return
    let vigente = true
    const respuesta = consulta === undefined ? api<T>(ruta, token) : apiPage(ruta, token, JSON.parse(consulta) as CollectionQuery)
    void respuesta.then(
      (datos) => { if (vigente) setResultado({ clave, token, revision, datos: datos as T }) },
      (fallo: unknown) => { if (vigente) setResultado({ clave, token, revision, error: true, fallo }) },
    )
    return () => { vigente = false }
  }, [ruta, clave, token, revision, reintento, consulta, enLinea])
  const actual = clave && resultado?.clave === clave && resultado.token === token ? resultado : undefined
  return { datos: actual?.datos, error: actual?.error, fallo: actual?.fallo, revisionConsultada: actual?.revision, sinConexion: !enLinea, reintentar: () => setReintento((n) => n + 1) }
}

export function useDatos<T>(ruta: string | null, token: string, revision = 0) {
  return useConsulta<T>(ruta, token, revision)
}

export function usePagina<T>(ruta: string | null, token: string, revision = 0, filtros: Omit<CollectionQuery, 'page'> = {}) {
  const clave = `${ruta}|${JSON.stringify(filtros)}`
  const [navegacion, setNavegacion] = useState({ clave, pagina: 1 })
  if (navegacion.clave !== clave) setNavegacion({ clave, pagina: 1 })
  const pagina = navegacion.clave === clave ? navegacion.pagina : 1
  const consulta = useConsulta<PaginatedResponse<T>>(ruta, token, revision, JSON.stringify({ ...filtros, page: pagina }))
  const cambiar = (n: number) => setNavegacion({ clave, pagina: Math.max(1, n) })
  return { ...consulta, pagina, cambiar }
}

export function Estado({ consulta, vacio }: { consulta: { datos?: unknown; error?: true; sinConexion?: boolean; reintentar: () => void }; vacio?: string }) {
  if (consulta.sinConexion && consulta.datos === undefined) {
    return <Aviso tipo="advertencia" icono="wifi_off" role="status">Sin conexión. Los datos se consultarán cuando vuelva Internet.</Aviso>
  }
  if (consulta.error) {
    return <div className="flex flex-col items-start gap-3">
      <Aviso tipo="error" className="w-full">No se pudo consultar. Comprueba tu acceso o conexión.</Aviso>
      <Button variant="outline" size="sm" onClick={consulta.reintentar}>Reintentar</Button>
    </div>
  }
  if (consulta.datos === undefined) return <p role="status" className="py-2 text-ayuda text-muted">Consultando…</p>
  return vacio ? <p role="status" className="rounded-md border border-surface-2 bg-surface p-5 text-center text-cuerpo text-ink-2 wrap-anywhere">{vacio}</p> : null
}

export function Paginador({ pagina, total, cambiar }: { pagina: number; total: number; cambiar: (n: number) => void }) {
  if (pagina === 1 && total <= 1) return null
  return <nav aria-label="Páginas del listado" className="flex flex-wrap items-center justify-center gap-3">
    <Button variant="outline" disabled={pagina <= 1} onClick={() => cambiar(pagina - 1)}>Anterior</Button>
    <span aria-live="polite" className="text-sm text-ink-2">Página {pagina} de {Math.max(total, pagina)}</span>
    <Button variant="outline" disabled={pagina >= total} onClick={() => cambiar(pagina + 1)}>Siguiente</Button>
  </nav>
}

export interface Campo {
  name: string
  label: string
  type?: HTMLInputTypeAttribute | 'textarea'
  options?: OpcionRadio[]
  value?: string
  optional?: boolean
  checked?: boolean
  disabled?: boolean
  hint?: string
  placeholder?: string
  max?: number
  min?: string | number
  maxNumber?: string | number
  step?: string | number
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  /** Con `options`: muestra las opciones como tarjetas de elección (radio) en vez de un desplegable. */
  tarjetas?: VarianteRadio
  /** Solo en formularios `variante="pagina"`: `mitad` deja dos campos lado a lado (p. ej. fecha de inicio y fecha final). */
  ancho?: 'mitad'
}

export type VarianteRadio = 'lista' | 'fila' | 'pildoras'
export interface OpcionRadio { value: string; label: string; icono?: NombreIcono; claseIcono?: string }

const OBLIGATORIO = <><span aria-hidden> *</span><span className="sr-only"> (obligatorio)</span></>

/**
 * Elección única en tarjetas (Figma «Opción»): radios nativos (con `name`, así que viajan en el `FormData`), tarjeta de
 * 48 px o más, borde grueso + fondo + marca de verificación al elegir (nunca solo color). Controlado (`value` + `onChange`)
 * o no controlado (`defaultValue`). `lista` = una por fila con círculo · `fila` = columnas iguales · `pildoras` = píldoras.
 */
export function OpcionesRadio({ name, label, options, variante = 'lista', value, defaultValue, onChange, required, disabled, hint }: {
  name: string
  label: string
  options: OpcionRadio[]
  variante?: VarianteRadio
  value?: string
  defaultValue?: string
  onChange?: (valor: string) => void
  required?: boolean
  disabled?: boolean
  hint?: string
}) {
  const id = useId()
  const columnas = options.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'
  return <fieldset disabled={disabled} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" aria-describedby={hint ? `${id}-hint` : undefined}>
    <legend className="mb-2 text-cuerpo font-semibold text-ink wrap-anywhere">{label}{required && OBLIGATORIO}</legend>
    <div className={cn(variante === 'lista' && 'grid grid-cols-1 gap-2', variante === 'fila' && `grid ${columnas} gap-2`, variante === 'pildoras' && 'flex flex-wrap gap-2')}>
      {options.map((opcion) => <label key={opcion.value} className={cn(
        'relative flex min-h-12 cursor-pointer items-center gap-3 border-2 text-cuerpo text-ink transition',
        'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55',
        'border-surface-2 bg-surface has-[:checked]:border-blue-principal has-[:checked]:bg-blue-100 has-[:checked]:font-semibold',
        variante === 'lista' && 'min-h-14 rounded-xl px-4 py-3',
        variante === 'fila' && 'justify-center gap-2 rounded-xl px-3 py-3 text-center',
        variante === 'pildoras' && 'gap-2 rounded-pill px-5 py-2',
      )}>
        <input type="radio" name={name} value={opcion.value} required={required} className="peer absolute inset-0 m-0 size-full cursor-[inherit] opacity-0"
          {...(value === undefined ? { defaultChecked: defaultValue === opcion.value } : { checked: value === opcion.value })}
          onChange={() => onChange?.(opcion.value)} />
        {variante === 'lista' && <>
          <Icono nombre="radio_button_unchecked" tamano={24} className="flex-none text-muted peer-checked:hidden" />
          <Icono nombre="check_circle" tamano={24} className="hidden flex-none text-blue-principal peer-checked:block" />
        </>}
        {variante !== 'lista' && <Icono nombre="check" tamano={20} className="hidden flex-none text-blue-principal peer-checked:block" />}
        {opcion.icono && <Icono nombre={opcion.icono} tamano={18} className={cn('flex-none', opcion.claseIcono)} />}
        <span className="min-w-0 wrap-anywhere">{opcion.label}</span>
      </label>)}
    </div>
    {hint && <p id={`${id}-hint`} className="text-ayuda text-muted">{hint}</p>}
  </fieldset>
}

function CampoFormulario({ name, label, type, options, value, optional, checked, disabled, hint, placeholder, max, min, maxNumber, step, inputMode, autoComplete, tarjetas }: Campo) {
  const compartido = { name, label, hint, disabled, required: !optional }
  const minLength = typeof min === 'number' && (type === undefined || type === 'text' || type === 'textarea') ? min : undefined
  if (options && tarjetas) return <OpcionesRadio {...compartido} options={options} variante={tarjetas} defaultValue={value} />
  if (options) {
    return <SelectField {...compartido} defaultValue={value ?? ''}
      options={optional ? [{ value: '', label: placeholder ?? 'Sin seleccionar' }, ...options] : options}
      placeholder={optional ? undefined : placeholder ?? 'Selecciona una opción'} />
  }
  if (type === 'checkbox') return <Checkbox {...compartido} defaultChecked={checked} value={value ?? 'true'} />
  if (type === 'textarea') return <TextareaField {...compartido} defaultValue={value} minLength={minLength} maxLength={max} placeholder={placeholder} />
  return <TextField {...compartido} type={type ?? 'text'} defaultValue={value} minLength={minLength} maxLength={max}
    min={min} max={maxNumber} step={step} inputMode={inputMode} autoComplete={autoComplete} placeholder={placeholder} />
}

export function Formulario({ titulo, campos, children, enviar, accion = 'Guardar', disabled, submitDisabled, cancelar, cancelLabel = 'Cancelar', exito = 'Cambios guardados.', variante = 'tarjeta', contexto, peligro }: {
  titulo: string
  campos: Campo[]
  children?: ReactNode
  enviar: (datos: FormData) => Promise<void>
  accion?: string
  disabled?: boolean
  submitDisabled?: boolean
  cancelar?: () => void
  cancelLabel?: string
  exito?: string
  /** `tarjeta` (por defecto): recuadro dentro de la página · `pagina`: formulario de pantalla completa del Figma (una columna, botones apilados). */
  variante?: 'tarjeta' | 'pagina'
  /** Solo `pagina`: persona o elemento al que se refiere el formulario (p. ej. el nombre del adulto), sobre los campos. */
  contexto?: ReactNode
  /** El botón de enviar usa el estilo de peligro (retirar un consentimiento). */
  peligro?: boolean
}) {
  const id = useId()
  const [mensaje, setMensaje] = useState<{ error: boolean; texto: string }>()
  const [guardando, setGuardando] = useState(false)
  const ocupado = useRef(false)
  const pagina = variante === 'pagina'
  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (ocupado.current || disabled || submitDisabled) return
    ocupado.current = true
    setGuardando(true)
    setMensaje(undefined)
    try {
      await enviar(new FormData(event.currentTarget))
      if (exito) setMensaje({ error: false, texto: exito })
    } catch (issue) {
      setMensaje({ error: true, texto: issue instanceof ApiError ? mensajeDeError(issue) :
        issue instanceof Error ? issue.message : 'No se pudo completar la operación.' })
    } finally {
      ocupado.current = false
      setGuardando(false)
    }
  }
  return <form aria-labelledby={id} aria-busy={guardando} onSubmit={guardar}
    className={pagina ? 'flex w-full max-w-form flex-col gap-5' : 'flex flex-col gap-4 rounded-md border border-line-soft bg-surface p-4 sm:p-5'}>
    {/* En `pagina` el título ya está en la barra secundaria: aquí queda solo como encabezado accesible. */}
    <h3 id={id} className={pagina ? 'sr-only' : 'break-words text-tarjeta text-ink'}>{titulo}</h3>
    {pagina && contexto && <p className="text-seccion text-ink wrap-anywhere">{contexto}</p>}
    {(campos.length > 0 || children) && <fieldset disabled={guardando || disabled}
      className={pagina ? 'm-0 grid min-w-0 grid-cols-2 gap-x-3 gap-y-5 border-0 p-0' : 'grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2'}>
      {campos.map((dato) => pagina
        ? <div key={dato.name} className={cn('min-w-0', dato.ancho === 'mitad' ? 'col-span-1' : 'col-span-2')}><CampoFormulario {...dato} /></div>
        : <CampoFormulario key={dato.name} {...dato} />)}
      {children && <div className={cn('grid min-w-0', pagina ? 'col-span-2 gap-5' : 'gap-4 sm:col-span-2')}>{children}</div>}
    </fieldset>}
    {mensaje && <Aviso tipo={mensaje.error ? 'error' : 'exito'}>{mensaje.texto}</Aviso>}
    <div className={cn('flex flex-col gap-3', !pagina && 'sm:flex-row')}>
      <Button type="submit" variant={peligro ? 'danger-soft' : 'primary'} fullWidth={pagina || undefined} disabled={disabled || submitDisabled} loading={guardando}>{accion}</Button>
      {cancelar && <Button variant="outline" fullWidth={pagina || undefined} onClick={cancelar} disabled={guardando}>{cancelLabel}</Button>}
    </div>
  </form>
}

export const campo = (datos: FormData, name: string) => String(datos.get(name) ?? '').trim()
export const opciones = (...valores: string[]) => valores.map((value) => ({ value, label: value.replaceAll('_', ' ') }))
export const idRuta = (id: string) => encodeURIComponent(id)
