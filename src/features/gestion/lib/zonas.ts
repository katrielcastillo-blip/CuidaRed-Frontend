import type { Adulto } from '@/domain/types'

export interface ZonaMunicipio {
  zona: string
  municipio: string
}

/** Catálogo base de zonas/municipios (se completa con las que ya existan en los datos). */
export const ZONAS_CATALOGO: ZonaMunicipio[] = [
  { zona: 'D.N., Renacimiento', municipio: 'Santo Domingo' },
  { zona: 'D.N., El Millón', municipio: 'Santo Domingo' },
  { zona: 'D.N., Gazcue', municipio: 'Santo Domingo' },
  { zona: 'D.N., Naco', municipio: 'Santo Domingo' },
  { zona: 'D.N., Ciudad Nueva', municipio: 'Santo Domingo' },
  { zona: 'D.N., Villa Consuelo', municipio: 'Santo Domingo' },
  { zona: 'D.N., Los Mina', municipio: 'Santo Domingo Este' },
  { zona: 'D.N., Villa Mella', municipio: 'Santo Domingo Norte' },
  { zona: 'D.N., Herrera', municipio: 'Santo Domingo Oeste' },
]

/** Zonas disponibles para el formulario: catálogo + las usadas por adultos + (opcional) la actual. */
export function zonasDisponibles(adultos: Adulto[], actual?: ZonaMunicipio): ZonaMunicipio[] {
  const mapa = new Map<string, ZonaMunicipio>()
  for (const z of ZONAS_CATALOGO) mapa.set(z.zona, z)
  for (const a of adultos) if (a.zona && !mapa.has(a.zona)) mapa.set(a.zona, { zona: a.zona, municipio: a.municipio })
  if (actual?.zona && !mapa.has(actual.zona)) mapa.set(actual.zona, actual)
  return [...mapa.values()].sort((x, y) => x.zona.localeCompare(y.zona, 'es'))
}

/** Zonas distintas presentes en una lista de adultos (para los chips de filtro). */
export function zonasEnUso(adultos: Adulto[]): string[] {
  return [...new Set(adultos.map((a) => a.zona).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es'))
}
