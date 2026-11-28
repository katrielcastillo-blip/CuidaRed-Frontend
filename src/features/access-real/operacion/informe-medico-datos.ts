/*
 * informe-medico-datos.ts — Reglas puras del informe médico conectado (fase 7): textos de las secciones omitidas,
 * vigencia de una indicación y nombre del archivo.
 * Módulo: access-real (ID07). Sin React ni red: se prueba de forma aislada.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { fechaCorta } from '@/domain/dates'
import type { InformeMedicoApi, SeccionInforme } from '../api/reportes'

export const SECCION_TEXTO: Record<SeccionInforme, string> = { indicaciones: 'Indicaciones médicas', riesgo: 'Riesgo', visitas: 'Visitas' }

/** Por qué falta cada sección: el servidor la omite según `indicaciones:ver`, `adultos:ver-sensible` y `visitas:ver`. */
export const MOTIVO_OMISION: Record<SeccionInforme, string> = {
  indicaciones: 'Las indicaciones médicas no están disponibles para tu rol.',
  riesgo: 'La información de riesgo no está disponible para tu rol.',
  visitas: 'Las visitas no están disponibles para esta cuenta o para tu rol.',
}

export const SIN_PERMISO = 'No disponible para tu rol'

/** «Indicaciones médicas, Riesgo» a partir de `secciones_omitidas`; vacío si no se omitió ninguna. */
export const resumenOmitidas = (secciones: SeccionInforme[]) => secciones.map((s) => SECCION_TEXTO[s] ?? s).join(', ')

/** «Desde 01/10/2026 · sin fecha de fin» o «Desde 01/10/2026 hasta 31/12/2026». */
export const vigenciaIndicacion = (inicio: string, fin: string | null) => `Desde ${fechaCorta(inicio)}${fin ? ` hasta ${fechaCorta(fin)}` : ' · sin fecha de fin'}`

/** `informe-medico-perez-diaz-juana-2026-11-20.pdf`: sin acentos, espacios ni signos. */
export function nombreArchivoInforme(identificacion: Pick<InformeMedicoApi['identificacion'], 'nombres' | 'apellidos'>, hoy: string) {
  const slug = `${identificacion.apellidos} ${identificacion.nombres}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `informe-medico-${slug || 'adulto'}-${hoy}.pdf`
}
