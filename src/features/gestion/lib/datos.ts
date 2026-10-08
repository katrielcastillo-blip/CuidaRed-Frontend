import { nombreCompleto, ROL_LABEL } from '@/domain/auth'
import type { Adulto, Alerta, DB, Necesidad, Usuario, Visita } from '@/domain/types'

/** Fecha (YYYY-MM-DD) de la última visita completada del adulto, si la hay. */
export function ultimaVisitaCompletada(visitas: Visita[], adultoId: string): string | undefined {
  let ultima: string | undefined
  for (const v of visitas) {
    if (v.adultoId === adultoId && v.estado === 'completada' && (!ultima || v.fecha > ultima)) ultima = v.fecha
  }
  return ultima
}

export const necesidadesActivas = (necesidades: Necesidad[], adultoId: string) =>
  necesidades.filter((n) => n.adultoId === adultoId && n.estado === 'activa')

/** Cuidadores activos de una organización (candidatos a asignar). */
export const cuidadoresActivos = (usuarios: Usuario[], orgId: string) =>
  usuarios.filter((u) => u.rol === 'cuidador' && u.estado === 'activo' && u.orgId === orgId)

export const nombreUsuario = (usuarios: Usuario[], id: string | undefined) => {
  const u = usuarios.find((x) => x.id === id)
  return u ? nombreCompleto(u) : undefined
}

const conRol = (u: Usuario) => `${nombreCompleto(u)} (${ROL_LABEL[u.rol]})`

/**
 * Quién reportó la alerta. El modelo no guarda el autor, así que se deduce:
 *  RIESGO ALTO → quien hizo la evaluación · SIN VISITA → el sistema · resto → quien registró la última
 *  necesidad (o, en su defecto, la última visita) del adulto.
 */
export function reportadoPor(db: Pick<DB, 'usuarios' | 'necesidades' | 'visitas'>, alerta: Alerta, adulto?: Adulto): string {
  const sistema = 'Sistema CuidaRed (automático)'
  const usuario = (id: string | undefined) => db.usuarios.find((u) => u.id === id)
  if (alerta.categoria === 'RIESGO ALTO') {
    const u = usuario(adulto?.evaluacion?.evaluadoPor)
    return u ? conRol(u) : sistema
  }
  if (alerta.categoria === 'SIN VISITA') return sistema
  const ultimaNecesidad = db.necesidades
    .filter((n) => n.adultoId === alerta.adultoId)
    .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))[0]
  const porNecesidad = usuario(ultimaNecesidad?.registradaPor)
  if (porNecesidad) return conRol(porNecesidad)
  const ultimaVisita = db.visitas
    .filter((v) => v.adultoId === alerta.adultoId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  const porVisita = usuario(ultimaVisita?.cuidadorId)
  return porVisita ? conRol(porVisita) : sistema
}
