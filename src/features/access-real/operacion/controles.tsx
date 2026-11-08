/*
 * controles.tsx — Formularios, consultas y paginación de los módulos conectados.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button, SelectField, TextField, TextareaField } from '@/components/ui'
import { api, apiPage } from '../client'
import { ApiError } from '../client'
import { mensajeDeError } from '../errores'
import type { PaginatedResponse } from '@/lib/api-contract'

type Consulta<T> = { clave: string; datos?: T; error?: true }

function useConsulta<T>(clave: string | null, token: string, revision: number, paginada: boolean, pagina: number) {
  const [resultado, setResultado] = useState<Consulta<T>>()
  const [reintento, setReintento] = useState(0)
  const id = clave ? `${clave}|${pagina}` : null
  useEffect(() => {
    if (!clave || !id || !navigator.onLine) return
    let vigente = true
    const consulta = paginada ? apiPage(clave, token, { page: pagina }) : api(clave, token)
    void consulta.then(
      (datos) => { if (vigente) setResultado({ clave: id, datos: datos as T }) },
      () => { if (vigente) setResultado({ clave: id, error: true }) },
    )
    return () => { vigente = false }
  }, [clave, id, token, revision, reintento, paginada, pagina])
  return { ...(id && resultado?.clave === id ? resultado : {}), reintentar: () => setReintento((n) => n + 1) }
}

export function useDatos<T>(ruta: string | null, token: string, revision = 0) {
  return useConsulta<T>(ruta, token, revision, false, 1)
}

export function usePagina<T>(ruta: string | null, token: string, revision = 0) {
  const [pagina, cambiar] = useState(1)
  const consulta = useConsulta<PaginatedResponse<T>>(ruta, token, revision, true, pagina)
  return { ...consulta, pagina, cambiar }
}

export function Estado({ consulta, vacio }: { consulta: { datos?: unknown; error?: true; reintentar: () => void }; vacio?: string }) {
  if (consulta.error) return <div role="alert" className="flex flex-wrap items-center gap-2">
    <span>No se pudo consultar. Comprueba tu acceso o conexión.</span>
    <Button variant="outline" onClick={consulta.reintentar}>Reintentar</Button>
  </div>
  if (consulta.datos === undefined) return <p role="status">Consultando…</p>
  return vacio ? <p className="text-muted">{vacio}</p> : null
}

export function Paginador({ pagina, total, cambiar }: { pagina: number; total: number; cambiar: (n: number) => void }) {
  if (pagina === 1 && total <= 1) return null
  return <nav aria-label="Páginas del listado" className="flex flex-wrap items-center gap-2">
    <Button variant="outline" disabled={pagina <= 1} onClick={() => cambiar(pagina - 1)}>Anterior</Button>
    <span>Página {pagina}</span>
    <Button variant="outline" disabled={pagina >= total} onClick={() => cambiar(pagina + 1)}>Siguiente</Button>
  </nav>
}

export interface Campo {
  name: string
  label: string
  type?: string
  options?: { value: string; label: string }[]
  value?: string
  optional?: boolean
  max?: number
}

export function Formulario({ titulo, campos, children, enviar, accion = 'Guardar', disabled }: {
  titulo: string; campos: Campo[]; children?: ReactNode; enviar: (datos: FormData) => Promise<void>; accion?: string; disabled?: boolean
}) {
  const [mensaje, setMensaje] = useState<{ error: boolean; texto: string }>()
  const [guardando, setGuardando] = useState(false)
  const ocupado = useRef(false)
  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (ocupado.current || disabled) return
    ocupado.current = true
    setGuardando(true)
    setMensaje(undefined)
    try {
      await enviar(new FormData(event.currentTarget))
      setMensaje({ error: false, texto: 'Operación completada.' })
    } catch (issue) {
      setMensaje({ error: true, texto: issue instanceof ApiError ? mensajeDeError(issue) :
        issue instanceof Error ? issue.message : 'No se pudo completar la operación.' })
    } finally {
      ocupado.current = false
      setGuardando(false)
    }
  }
  return <form className="flex flex-col gap-3 rounded-md border border-line-soft p-4" onSubmit={guardar}>
    <h3 className="font-semibold">{titulo}</h3>
    <fieldset disabled={guardando || disabled} className="grid gap-3 md:grid-cols-2">
      {campos.map(({ name, label, type, options, value, optional, max }) => options
        ? <SelectField key={name} name={name} label={label} options={options} defaultValue={value ?? ''} placeholder="Selecciona" required={!optional} />
        : type === 'textarea'
          ? <TextareaField key={name} name={name} label={label} defaultValue={value} maxLength={max} required={!optional} />
          : <TextField key={name} name={name} label={label} type={type ?? 'text'} defaultValue={value} maxLength={max} required={!optional} />)}
      {children}
    </fieldset>
    {mensaje && <p role={mensaje.error ? 'alert' : 'status'} className={mensaje.error ? 'text-danger-700' : 'text-ink'}>{mensaje.texto}</p>}
    <Button type="submit" className="self-start" disabled={disabled} loading={guardando}>{accion}</Button>
  </form>
}

export const campo = (datos: FormData, name: string) => String(datos.get(name) ?? '').trim()
export const opciones = (...valores: string[]) => valores.map((value) => ({ value, label: value.replaceAll('_', ' ') }))
export const idRuta = (id: string) => encodeURIComponent(id)
