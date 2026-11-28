/*
 * catalogos.ts — Cliente tipado de los catálogos de referencia que usan los formularios (CR-165).
 * Módulo: access-real · API.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Contrato: CuidaRed-Backend/docs/contratos/cuentas.md (sección Catálogos). Exigen sesión pero no cuenta. Los
 * filtros de los catálogos son simples (`?tipo=`, `?provincia_cod=`), no `filter[...]`, por eso no usan `apiPage`.
 */
import { api, type TipoCuenta } from '../client'

export interface CategoriaCuenta {
  categoria_cuenta_id: number
  nombre: string
  tipo_cuenta_id: number
  tipo: TipoCuenta
}
export interface Provincia {
  provincia_cod: string
  nombre: string
}
export interface Municipio {
  municipio_cod: string
  nombre: string
  provincia_cod: string
}

/** Una respuesta que no es una lista es un contrato roto: no se disfraza de catálogo vacío. */
function lista<T>(valor: unknown): T[] {
  if (!Array.isArray(valor)) throw new Error('No se pudo interpretar el catálogo.')
  return valor as T[]
}

/** Categorías activas del tipo de cuenta indicado. */
export async function listarCategoriasCuenta(token: string, tipo: TipoCuenta) {
  return lista<CategoriaCuenta>(await api(`/catalogos/categorias-cuenta?tipo=${encodeURIComponent(tipo)}`, token))
}

export async function listarProvincias(token: string) {
  return lista<Provincia>(await api('/catalogos/provincias', token))
}

/** Municipios de una provincia (paginado en el servidor; 100 es el máximo y sobra para una provincia). */
export async function listarMunicipios(token: string, provinciaCod: string) {
  return lista<Municipio>(await api(`/catalogos/municipios?provincia_cod=${encodeURIComponent(provinciaCod)}&limit=100`, token))
}
