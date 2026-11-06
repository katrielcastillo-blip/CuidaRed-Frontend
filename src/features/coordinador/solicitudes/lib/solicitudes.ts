/*
 * solicitudes.ts — Datos y formatos de las solicitudes de visita de personas externas (visitantes) que ve un
 * usuario principal (Administrador, o Coordinador en una cuenta Familia): lista de la cuenta con las pendientes
 * primero, adultos activos entre los que confirmar la visita y etiquetas de estado (V2 · visitas:autorizar).
 * Módulo: coordinador · solicitudes de visita.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import type { Tone } from '@/components/ui'
import { solicitudesDeCuenta } from '@/domain/api/solicitudes'
import { nombreCompleto, useUser } from '@/domain/auth'
import { adultosVisibles } from '@/domain/permisos'
import { nombreUsuario } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto, SolicitudVisita } from '@/domain/types'
import { haceTiempo } from '../../lib/datos'

export type EstadoSolicitud = SolicitudVisita['estado']

/** Estados en el orden en que se ofrecen como filtro. */
export const ESTADOS_SOLICITUD: EstadoSolicitud[] = ['pendiente', 'autorizada', 'realizada', 'rechazada', 'cancelada']

export const TONO_SOLICITUD: Record<EstadoSolicitud, Tone> = {
  pendiente: 'warning',
  autorizada: 'info',
  realizada: 'success',
  rechazada: 'danger',
  cancelada: 'neutral',
}

/** Etiqueta corta para los filtros (la larga está en ESTADO_SOLICITUD del dominio). */
export const FILTRO_SOLICITUD: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendientes',
  autorizada: 'Autorizadas',
  realizada: 'Realizadas',
  rechazada: 'No autorizadas',
  cancelada: 'Canceladas',
}

/** "hace 3 horas" · "ayer" · "el 24/08/2026" (para "Recibida …"). */
export function cuandoRecibida(iso: string): string {
  const t = haceTiempo(iso)
  return /^d/.test(t) ? `el ${t}` : t.toLowerCase()
}

export const nombreVisitante = (s: Pick<SolicitudVisita, 'visitante'>) => `${s.visitante.nombres} ${s.visitante.apellidos}`.trim()

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * ¿El adulto coincide con lo que escribió el visitante? Todas las palabras del nombre (de 3 letras o más) deben
 * aparecer en el texto ("Doña Elena Rodríguez (Renacimiento)" → Elena Rodríguez). Solo sirve para ordenar y sugerir:
 * quien autoriza siempre confirma el adulto.
 */
export function coincideConTexto(adulto: Pick<Adulto, 'nombre' | 'apellido'>, texto: string): boolean {
  const t = norm(texto)
  const palabras = norm(`${adulto.nombre} ${adulto.apellido}`)
    .split(/\s+/)
    .filter((p) => p.length >= 3)
  return palabras.length > 0 && palabras.every((p) => t.includes(p))
}

/**
 * Solicitudes de la cuenta activa (las pendientes primero) y datos para resolverlas, ya indexados.
 * Todo se deriva con useMemo sobre referencias del store (nunca se crean arrays dentro del selector).
 */
export function useSolicitudes() {
  const user = useUser()
  const todas = useDB((s) => s.solicitudesVisita)
  const adultosAll = useDB((s) => s.adultos)
  const usuariosAll = useDB((s) => s.usuarios)
  const vinculos = useDB((s) => s.vinculos)

  return useMemo(() => {
    const solicitudes = solicitudesDeCuenta({ solicitudesVisita: todas }, user.orgId)
    const pendientes = solicitudes.filter((s) => s.estado === 'pendiente')
    const adultos = adultosVisibles(user, adultosAll, vinculos)
    const adultoPorId = new Map<string, Adulto>(adultos.map((a) => [a.id, a]))
    const adultosActivos = adultos.filter((a) => a.estado === 'activo').sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'))
    const nombreDe = (id: string | undefined) => nombreUsuario(usuariosAll, id)
    return { user, solicitudes, pendientes, adultoPorId, adultosActivos, nombreDe }
  }, [user, todas, adultosAll, usuariosAll, vinculos])
}
