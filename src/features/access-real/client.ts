/* Supabase Auth real y API de perfil · ID01. © 2026 Equipo CuidaRed – INTEC. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { collectionSearch, readPaginatedResponse, type CollectionQuery, type PaginatedResponse } from '../../lib/api-contract'

export const STORAGE_KEY = 'cuidared.auth.real'
let singleton: SupabaseClient | undefined

function configuration() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  const api = import.meta.env.VITE_API_URL as string | undefined
  if (!url || !key?.startsWith('sb_publishable_') || !api) {
    throw new Error('Falta configurar el acceso a CuidaRed. Consulta al equipo responsable.')
  }
  for (const value of [url, api]) {
    const parsed = new URL(value)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    if (
      (parsed.protocol !== 'https:' && !(import.meta.env.DEV && local && parsed.protocol === 'http:')) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('La configuración de conexión no es válida.')
    }
  }
  return { url, key, api: api.replace(/\/$/, '') }
}

export function getClient() {
  const { url, key } = configuration()
  singleton ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: window.sessionStorage,
      storageKey: STORAGE_KEY,
    },
  })
  return singleton
}

// Invitación y recuperación usan una sesión efímera independiente de la sesión del navegador.
export function temporaryClient() {
  const { url, key } = configuration()
  return createClient(url, key, {
    auth: {
      storageKey: `cuidared.auth.temporary.${crypto.randomUUID()}`,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function apiResponse(path: string, token: string, method = 'GET', data?: unknown): Promise<Response> {
  const { api: base } = configuration()
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = typeof body?.error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(body.error.code) ? body.error.code : undefined
    const message =
      res.status === 401
        ? 'Tu sesión venció. Inicia sesión de nuevo.'
        : res.status === 403
          ? 'Tu usuario no tiene acceso.'
          : res.status === 404
            ? 'Recurso no encontrado.'
            : res.status === 409
              ? method === 'GET'
                ? 'El perfil de tu invitación no está disponible. Contacta a la persona responsable.'
                : 'No se pudo guardar el perfil con esos datos.'
              : res.status === 422
                ? 'Revisa los datos del formulario.'
                : 'No se pudo conectar con CuidaRed. Intenta de nuevo.'
    throw new ApiError(res.status, message, code)
  }
  return res
}

export async function api<T>(path: string, token: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await apiResponse(path, token, method, data)
  return res.status === 204 ? (undefined as T) : ((await res.json()).data as T)
}

export async function apiPage<T>(path: string, token: string, query: CollectionQuery = {}): Promise<PaginatedResponse<T>> {
  if (path.includes('?') || path.includes('#')) throw new Error('La ruta del listado no debe contener parámetros.')
  const res = await apiResponse(`${path}?${collectionSearch(query)}`, token)
  return readPaginatedResponse<T>(await res.json())
}

export interface Profile {
  id: string
  cedula: string
  nombres: string
  apellidos: string
  correo: string
  telefono: string | null
  estado: 'activo'
}
export interface CurrentUser {
  identity: { id: string; email: string }
  profile: Profile
}

export function passwordError(value: string) {
  return value.length < 8 || !/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value) || !/[^a-zA-Z0-9\s]/.test(value)
    ? 'Usa al menos 8 caracteres con mayúscula, minúscula, número y símbolo.'
    : undefined
}

export async function logout() {
  const client = getClient()
  const { data } = await client.auth.getSession()
  let revoked = true
  if (data.session) {
    try {
      await api('/session/logout', data.session.access_token, 'POST')
    } catch {
      revoked = false
    }
  }
  try {
    await client.auth.signOut({ scope: 'local' })
  } finally {
    window.sessionStorage.removeItem(STORAGE_KEY)
    window.location.assign(revoked ? '/inicio' : '/inicio?cierre=pendiente')
  }
}
