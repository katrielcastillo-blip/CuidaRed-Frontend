/*
 * controles.tsx — Formularios, consultas y paginación de los módulos conectados.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type HTMLInputTypeAttribute, type InputHTMLAttributes, type ReactNode } from 'react'
import { Button, Checkbox, SelectField, TextField, TextareaField } from '@/components/ui'
import { suscribirConectividad } from '@/domain/conectividad'
import { api, apiPage, ApiError } from '../client'
import { mensajeDeError } from '../errores'
import type { CollectionQuery, PaginatedResponse } from '@/lib/api-contract'

type Consulta<T> = { clave: string; token: string; datos?: T; error?: true }

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
      (datos) => { if (vigente) setResultado({ clave, token, datos: datos as T }) },
      () => { if (vigente) setResultado({ clave, token, error: true }) },
    )
    return () => { vigente = false }
  }, [ruta, clave, token, revision, reintento, consulta, enLinea])
  const actual = clave && resultado?.clave === clave && resultado.token === token ? resultado : undefined
  return { datos: actual?.datos, error: actual?.error, sinConexion: !enLinea, reintentar: () => setReintento((n) => n + 1) }
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
    return <p role="status" className="rounded-md border border-line-soft bg-warning-100 p-4 text-ink">Sin conexión. Los datos se consultarán cuando vuelva Internet.</p>
  }
  if (consulta.error) {
    return <div className="flex flex-wrap items-center gap-3 rounded-md border border-danger bg-danger-100 p-4 text-ink">
      <span role="alert">No se pudo consultar. Comprueba tu acceso o conexión.</span>
      <Button variant="outline" onClick={consulta.reintentar}>Reintentar</Button>
    </div>
  }
  if (consulta.datos === undefined) return <p role="status" className="py-2 text-sm text-muted">Consultando…</p>
  return vacio ? <p role="status" className="rounded-md border border-line-soft bg-surface p-5 text-center text-ink-2">{vacio}</p> : null
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
  options?: { value: string; label: string }[]
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
}

function CampoFormulario({ name, label, type, options, value, optional, checked, disabled, hint, placeholder, max, min, maxNumber, step, inputMode, autoComplete }: Campo) {
  const compartido = { name, label, hint, disabled, required: !optional }
  const minLength = typeof min === 'number' && (type === undefined || type === 'text' || type === 'textarea') ? min : undefined
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

export function Formulario({ titulo, campos, children, enviar, accion = 'Guardar', disabled, submitDisabled, cancelar, cancelLabel = 'Cancelar', exito = 'Cambios guardados.' }: {
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
}) {
  const id = useId()
  const [mensaje, setMensaje] = useState<{ error: boolean; texto: string }>()
  const [guardando, setGuardando] = useState(false)
  const ocupado = useRef(false)
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
  return <form aria-labelledby={id} aria-busy={guardando} className="flex flex-col gap-4 rounded-md border border-line-soft bg-surface p-4 sm:p-5" onSubmit={guardar}>
    <h3 id={id} className="text-lg font-semibold text-ink">{titulo}</h3>
    {(campos.length > 0 || children) && <fieldset disabled={guardando || disabled} className="grid min-w-0 gap-4 sm:grid-cols-2">
      {campos.map((dato) => <CampoFormulario key={dato.name} {...dato} />)}
      {children && <div className="grid min-w-0 gap-4 sm:col-span-2">{children}</div>}
    </fieldset>}
    {mensaje && <p role={mensaje.error ? 'alert' : 'status'} className={mensaje.error ? 'rounded-md bg-danger-100 p-3 text-danger-700' : 'rounded-md bg-success-100 p-3 text-success-700'}>{mensaje.texto}</p>}
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button type="submit" disabled={disabled || submitDisabled} loading={guardando}>{accion}</Button>
      {cancelar && <Button variant="outline" onClick={cancelar} disabled={guardando}>{cancelLabel}</Button>}
    </div>
  </form>
}

export const campo = (datos: FormData, name: string) => String(datos.get(name) ?? '').trim()
export const opciones = (...valores: string[]) => valores.map((value) => ({ value, label: value.replaceAll('_', ' ') }))
export const idRuta = (id: string) => encodeURIComponent(id)
