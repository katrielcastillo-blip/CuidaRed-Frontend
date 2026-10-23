/*
 * datos.ts — Consultas derivadas del store para las pantallas de gestión (sin escrituras): usuarios
 * candidatos a vincular (Vinculo), nombres de catálogo, autoría de alertas y necesidad ligada a una alerta.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { nombreCompleto, ROL_LABEL } from '@/domain/auth'
import type { Alerta, ItemCatalogo, Necesidad, Usuario } from '@/domain/types'
import { necesidadAbierta } from './formato'

/** Necesidades del adulto aún por resolver (pendientes o en proceso). */
export const necesidadesPendientes = (necesidades: Necesidad[], adultoId: string) =>
  necesidades.filter((n) => n.adultoId === adultoId && necesidadAbierta(n.estado))

/** Voluntarios activos de una organización (candidatos al vínculo «voluntario_asignado»). */
export const voluntariosActivos = (usuarios: Usuario[], orgId: string) =>
  usuarios.filter((u) => u.rol === 'voluntario' && u.estado === 'activo' && u.orgId === orgId)

/** Familiares responsables activos de una organización (candidatos al vínculo «familiar_responsable»). */
export const familiaresActivos = (usuarios: Usuario[], orgId: string) =>
  usuarios.filter((u) => u.rol === 'familiar' && u.estado === 'activo' && u.orgId === orgId)

export const nombreUsuario = (usuarios: Usuario[], id: string | undefined) => {
  if (id === 'sistema') return 'Sistema CuidaRed'
  const u = usuarios.find((x) => x.id === id)
  return u ? nombreCompleto(u) : undefined
}

/** Nombre de un elemento de catálogo (o el propio id si no existe). */
export const nombreCatalogo = (lista: ItemCatalogo[], id: string | undefined) => lista.find((x) => x.id === id)?.nombre ?? id ?? '—'

/** Quién generó la alerta: el motor automático (RF-04 / RF-05) o la persona que la registró. */
export function autorAlerta(usuarios: Usuario[], alerta: Pick<Alerta, 'generadaPor'>): string {
  if (alerta.generadaPor === 'sistema') return 'Sistema CuidaRed (automática)'
  const u = usuarios.find((x) => x.id === alerta.generadaPor)
  return u ? `${nombreCompleto(u)} (${ROL_LABEL[u.rol]})` : 'Usuario no disponible'
}

/** Alerta abierta: pendiente o en atención. */
export const alertaAbierta = (a: Pick<Alerta, 'estado'>) => a.estado !== 'atendida'

/** Necesidad que originó una alerta "NECESIDAD ATRASADA" (campo necesidadId; la firma `nec:<id>` es el respaldo). */
export function necesidadDeAlerta(alerta: Pick<Alerta, 'firma' | 'tipo' | 'necesidadId'>, necesidades: Necesidad[]): Necesidad | undefined {
  if (alerta.tipo !== 'necesidad') return undefined
  const id = alerta.necesidadId ?? (alerta.firma?.startsWith('nec:') ? alerta.firma.slice(4) : undefined)
  return id ? necesidades.find((n) => n.id === id) : undefined
}
