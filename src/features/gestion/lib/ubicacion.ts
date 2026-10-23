/*
 * ubicacion.ts — Ubicación de los adultos mayores (Envejeciente.Municipio_Cod + Env_Direccion → sector y
 * dirección): sectores en uso para sugerencias y filtros, municipios presentes y textos cortos.
 * Sustituye a zonas.ts: el municipio ya no se guarda como texto, sino como código del catálogo Municipio.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { nombreMunicipio, provinciaDe } from '@/domain/relaciones'
import type { Adulto, Catalogos } from '@/domain/types'

type CatUbicacion = Pick<Catalogos, 'municipios' | 'provincias'>

const ordenar = (x: string, y: string) => x.localeCompare(y, 'es')

/** Sectores o barrios (zona) registrados, opcionalmente solo los de un municipio. */
export function sectoresEnUso(adultos: Adulto[], municipioCod?: string): string[] {
  const lista = adultos.filter((a) => !municipioCod || a.municipioCod === municipioCod).map((a) => a.zona.trim())
  return [...new Set(lista.filter(Boolean))].sort(ordenar)
}

/** Municipios con al menos un adulto registrado (para el filtro), con su provincia entre paréntesis si se repite el nombre. */
export function municipiosEnUso(cat: CatUbicacion, adultos: Adulto[]): Array<{ value: string; label: string }> {
  const cods = [...new Set(adultos.map((a) => a.municipioCod).filter(Boolean))]
  return cods
    .map((cod) => ({ value: cod, label: nombreMunicipio(cat, cod) || cod }))
    .sort((x, y) => ordenar(x.label, y.label))
}

/** "Renacimiento · Santo Domingo de Guzmán" (sector + municipio). */
export function ubicacionCorta(cat: CatUbicacion, a: Pick<Adulto, 'zona' | 'municipioCod'>): string {
  return [a.zona, nombreMunicipio(cat, a.municipioCod)].filter(Boolean).join(' · ')
}

/** "Santo Domingo de Guzmán, Distrito Nacional" (municipio + provincia). */
export function municipioYProvincia(cat: CatUbicacion, municipioCod: string | undefined): string {
  return [nombreMunicipio(cat, municipioCod), provinciaDe(cat, municipioCod)?.nombre].filter(Boolean).join(', ')
}

/** Filtro por municipio (código) y sector (texto exacto); cadena vacía = todos. */
export const enUbicacion = (a: Pick<Adulto, 'zona' | 'municipioCod'>, municipioCod: string, sector: string) =>
  (!municipioCod || a.municipioCod === municipioCod) && (!sector || a.zona === sector)
