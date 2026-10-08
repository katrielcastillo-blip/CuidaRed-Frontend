import { useMemo } from 'react'
import { useSession } from '@/domain/auth'
import { useDB } from '@/domain/store'
import { addDays, toISODate } from '@/domain/dates'
import type { Adulto, Alerta, TipoNecesidad } from '@/domain/types'
import { mesCorto, pad2 } from './datos'

export interface MesVisitas {
  clave: string
  etiqueta: string
  total: number
}
export interface TipoNecesidadStat {
  tipo: TipoNecesidad
  etiqueta: string
  color: string
  total: number
  pct: number
}
export interface AlertaReciente {
  alerta: Alerta
  adulto: Adulto
}
export interface Resumen {
  alertasActivas: number
  adultos: number
  /** Crecimiento (%) de adultos mayores registrados en los últimos 30 días; null si no hubo altas. */
  tendenciaAdultos: number | null
  cuidadores: number
  solicitudesPendientes: number
  prioritarios: number
  visitasPorMes: MesVisitas[]
  tiposNecesidad: TipoNecesidadStat[]
  alertasRecientes: AlertaReciente[]
}

const TIPOS: Record<TipoNecesidad, { etiqueta: string; color: string }> = {
  medicamentos: { etiqueta: 'Médica', color: '#0c3b6e' },
  compania: { etiqueta: 'Social', color: '#b4bbd0' },
  alimentacion: { etiqueta: 'Nutrición', color: '#0b4a3a' },
  transporte: { etiqueta: 'Transporte', color: '#378add' },
  otros: { etiqueta: 'Otros', color: '#d4880a' },
}

/** Reparte 100 entre los valores (método del mayor resto) para que la suma siempre sea 100. */
function porcentajes(valores: number[]): number[] {
  const total = valores.reduce((a, b) => a + b, 0)
  if (!total) return valores.map(() => 0)
  const brutos = valores.map((v) => (v * 100) / total)
  const base = brutos.map(Math.floor)
  let resto = 100 - base.reduce((a, b) => a + b, 0)
  const orden = brutos.map((b, i) => ({ i, r: b - base[i]! })).sort((a, b) => b.r - a.r)
  for (const o of orden) {
    if (resto <= 0) break
    base[o.i]!++
    resto--
  }
  return base
}

/** Todas las cifras del dashboard del administrador, calculadas del store (nada hardcodeado). */
export function useResumen(): Resumen {
  const { org } = useSession()
  const adultos = useDB((s) => s.adultos)
  const usuarios = useDB((s) => s.usuarios)
  const visitas = useDB((s) => s.visitas)
  const alertas = useDB((s) => s.alertas)
  const necesidades = useDB((s) => s.necesidades)

  return useMemo(() => {
    const orgId = org?.id
    const adultosOrg = adultos.filter((a) => a.orgId === orgId)
    const activos = adultosOrg.filter((a) => a.estado === 'activo')
    const porId = new Map(adultosOrg.map((a) => [a.id, a]))

    // Alertas no atendidas (pendientes + en atención)
    const alertasOrg = alertas.filter((a) => porId.has(a.adultoId))
    const alertasActivas = alertasOrg.filter((a) => a.estado !== 'atendida').length

    // Tendencia de altas en los últimos 30 días
    const desde = toISODate(addDays(new Date(), -30))
    const nuevos = activos.filter((a) => a.creadoEn >= desde).length
    const previos = activos.length - nuevos
    const tendenciaAdultos = nuevos > 0 && previos > 0 ? Math.round((nuevos / previos) * 100) : null

    // Cuidadores activos y solicitudes (invitaciones sin aceptar)
    const miembrosOrg = usuarios.filter((u) => u.orgId === orgId)
    const cuidadores = miembrosOrg.filter((u) => u.rol === 'cuidador' && u.estado === 'activo').length
    const solicitudesPendientes = miembrosOrg.filter((u) => u.estado === 'invitado').length

    const prioritarios = activos.filter((a) => a.riesgo === 'alto').length

    // Visitas por mes (últimos 6 meses, sin contar las canceladas)
    const hoy = new Date()
    const visitasPorMes: MesVisitas[] = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1)
      return { clave: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`, etiqueta: mesCorto(d.getMonth()), total: 0 }
    })
    for (const v of visitas) {
      if (v.estado === 'cancelada' || !porId.has(v.adultoId)) continue
      const mes = visitasPorMes.find((m) => m.clave === v.fecha.slice(0, 7))
      if (mes) mes.total++
    }

    // Distribución de necesidades por tipo
    const conteo = new Map<TipoNecesidad, number>()
    for (const n of necesidades) {
      if (!porId.has(n.adultoId)) continue
      conteo.set(n.tipo, (conteo.get(n.tipo) ?? 0) + 1)
    }
    const tipos = (Object.keys(TIPOS) as TipoNecesidad[])
      .filter((t) => (conteo.get(t) ?? 0) > 0)
      .sort((a, b) => conteo.get(b)! - conteo.get(a)!)
    const pcts = porcentajes(tipos.map((t) => conteo.get(t)!))
    const tiposNecesidad: TipoNecesidadStat[] = tipos.map((t, i) => ({
      tipo: t,
      etiqueta: TIPOS[t].etiqueta,
      color: TIPOS[t].color,
      total: conteo.get(t)!,
      pct: pcts[i]!,
    }))

    // Alertas más recientes (todas, atendidas o no)
    const alertasRecientes: AlertaReciente[] = [...alertasOrg]
      .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
      .slice(0, 4)
      .map((alerta) => ({ alerta, adulto: porId.get(alerta.adultoId)! }))

    return {
      alertasActivas,
      adultos: activos.length,
      tendenciaAdultos,
      cuidadores,
      solicitudesPendientes,
      prioritarios,
      visitasPorMes,
      tiposNecesidad,
      alertasRecientes,
    }
  }, [org, adultos, usuarios, visitas, alertas, necesidades])
}
