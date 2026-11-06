/* Contratos de colecciones de la API conectada · CR-162. © 2026 Equipo CuidaRed – INTEC. */
export interface CollectionQuery {
  page?: number
  limit?: number
  sort?: string[]
  filters?: Record<string, string | number | boolean>
}
export interface PageMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}
export interface PaginatedResponse<T> {
  data: T[]
  meta: PageMeta
}

export function collectionSearch(query: CollectionQuery = {}) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger((page - 1) * limit)
  ) {
    throw new Error('Revisa los parámetros de consulta.')
  }
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (query.sort !== undefined) {
    const fields = query.sort.map((field) => field.replace(/^-/, ''))
    if (!query.sort.length || query.sort.some((field) => !/^-?[a-z][a-z0-9_]*$/.test(field)) || new Set(fields).size !== fields.length) {
      throw new Error('Revisa los parámetros de consulta.')
    }
    params.set('sort', query.sort.join(','))
  }
  for (const [field, value] of Object.entries(query.filters ?? {})) {
    if (
      !/^[a-z][a-z0-9_]*$/.test(field) ||
      !['string', 'number', 'boolean'].includes(typeof value) ||
      (typeof value === 'number' && !Number.isFinite(value))
    ) {
      throw new Error('Revisa los parámetros de consulta.')
    }
    params.set(`filter[${field}]`, String(value))
  }
  return params.toString()
}

export function readPaginatedResponse<T>(body: unknown): PaginatedResponse<T> {
  const response = body as Partial<PaginatedResponse<T>> | null
  const meta = response?.meta
  if (
    !Array.isArray(response?.data) ||
    !meta ||
    !Number.isSafeInteger(meta.page) ||
    meta.page < 1 ||
    !Number.isSafeInteger(meta.limit) ||
    meta.limit < 1 ||
    meta.limit > 100 ||
    !Number.isSafeInteger(meta.total) ||
    meta.total < 0 ||
    meta.totalPages !== Math.ceil(meta.total / meta.limit) ||
    response.data.length > meta.limit ||
    response.data.length > meta.total ||
    (response.data.length > 0 && (meta.page - 1) * meta.limit >= meta.total)
  ) {
    throw new Error('No se pudo interpretar el listado. Intenta de nuevo.')
  }
  return { data: response.data, meta }
}
