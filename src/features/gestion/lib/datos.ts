/*
 * datos.ts — Consultas derivadas del store para las pantallas de gestión (sin escrituras): usuarios
 * candidatos a vincular (Vinculo), nombres de catálogo, autoría de alertas y necesidad ligada a una alerta.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { nombreCompleto, ROL_LABEL } from '@/domain/auth'
import type { Alerta, ItemCatalogo, Membresia, Necesidad, Rol, Usuario } from '@/domain/types'
import { necesidadAbierta } from './formato'

/** Necesidades del adulto aún por resolver (pendientes o en proceso). */
export const necesidadesPendientes = (necesidades: Necesidad[], adultoId: string) =>
  necesidades.filter((n) => n.adultoId === adultoId && necesidadAbierta(n.estado))

/**
 * Usuarios activos con ese rol en la cuenta. Con `membresias` se usa la membresía activa de cada usuario en la
 * cuenta (V2: una persona puede pertenecer a varias cuentas con roles distintos); sin ellas, el rol y la cuenta
 * vigentes del usuario.
 */
function activosConRol(usuarios: Usuario[], orgId: string, rol: Rol, membresias?: Membresia[]) {
  return usuarios.filter((u) => {
    if (u.estado !== 'activo') return false
    if (!membresias) return u.rol === rol && u.orgId === orgId
    return membresias.some((m) => m.usuarioId === u.id && m.orgId === orgId && m.rol === rol && m.estado === 'activa')
  })
}

/** Voluntarios activos de una organización (candidatos al vínculo «voluntario_asignado»). */
export const voluntariosActivos = (usuarios: Usuario[], orgId: string, membresias?: Membresia[]) => activosConRol(usuarios, orgId, 'voluntario', membresias)

/** Cuidadores activos de la cuenta (candidatos al vínculo «cuidador_asignado»). */
export const cuidadoresActivos = (usuarios: Usuario[], orgId: string, membresias?: Membresia[]) => activosConRol(usuarios, orgId, 'cuidador', membresias)

/** Familiares responsables activos de una organización (candidatos al vínculo «familiar_responsable»). */
export const familiaresActivos = (usuarios: Usuario[], orgId: string, membresias?: Membresia[]) => activosConRol(usuarios, orgId, 'familiar', membresias)

export const nombreUsuario = (usuarios: Usuario[], id: string | undefined) => {
  if (id === 'sistema') return 'Sistema CuidaRed'
  const u = usuarios.find((x) => x.id === id)
  return u ? nombreCompleto(u) : undefined
}

/** «Carlos Ruiz · Cuidador» (quién actuó, con su rol) para historiales de acciones. */
export const nombreConRol = (usuarios: Usuario[], id: string | undefined) => {
  if (id === 'sistema') return 'Sistema CuidaRed'
  const u = usuarios.find((x) => x.id === id)
  return u ? `${nombreCompleto(u)} · ${ROL_LABEL[u.rol]}` : undefined
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
