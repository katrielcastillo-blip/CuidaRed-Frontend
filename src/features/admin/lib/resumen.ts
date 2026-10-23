/*
 * resumen.ts — Cifras del panel del administrador: visión general de la organización calculada del store.
 * Incluye el uso del plan (Plan.Limite_Envejecientes / Limite_Usuarios) y las tareas de agenda pendientes (Tarea_agenda).
 * Módulo: admin (SRS §13.1 "Panel de gestión y supervisión" · §8.2.2.1.18 Operabilidad · RF-04 · RF-05).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { alertasVisibles, tareasVisibles } from '@/domain/api'
import { useSession } from '@/domain/auth'
import { useDB } from '@/domain/store'
import { diasSinVisita } from '@/domain/reglas'
import { adultosVisibles } from '@/domain/permisos'
import { configOrg, usoDelPlan } from '@/domain/relaciones'
import { todayISO } from '@/domain/dates'
import type { Adulto, Alerta, Rol, SeveridadAlerta, Tarea, TipoNecesidad } from '@/domain/types'
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
export interface SinVisita {
  adulto: Adulto
  dias: number
}
export interface Resumen {
  adultosActivos: number
  /** Crecimiento (%) de altas en los últimos 30 días; null si no hubo altas. */
  tendenciaAdultos: number | null
  /** Alertas de caso prioritario (RF-04) abiertas. */
  prioritariosAbiertos: number
  alertasSinAtender: number
  porUrgencia: Record<SeveridadAlerta, number>
  umbralDias: number
  /** Adultos activos que superan el umbral de días sin visita (RF-05), de más a menos días. */
  sinVisita: SinVisita[]
  usuariosPorRol: Record<Rol, number>
  usuariosActivos: number
  invitados: number
  necesidadesPendientes: number
  necesidadesEnProceso: number
  visitasPorMes: MesVisitas[]
  tiposNecesidad: TipoNecesidadStat[]
  /** Alertas sin atender más urgentes y recientes. */
  alertasRecientes: AlertaReciente[]
  /** Uso de los límites del plan contratado. */
  uso: ReturnType<typeof usoDelPlan>
  /** Tareas de agenda pendientes o en curso (las más próximas primero). */
  tareasPendientes: Array<{ tarea: Tarea; adulto?: Adulto }>
  /** Tareas pendientes con fecha anterior a hoy. */
  tareasAtrasadas: number
}

const TIPOS: Record<TipoNecesidad, { etiqueta: string; color: string }> = {
  medicamentos: { etiqueta: 'Medicamentos', color: '#0c3b6e' },
  compania: { etiqueta: 'Compañía', color: '#b4bbd0' },
  alimentacion: { etiqueta: 'Alimentación', color: '#0b4a3a' },
  transporte: { etiqueta: 'Transporte', color: '#378add' },
  otros: { etiqueta: 'Otros apoyos', color: '#d4880a' },
}

const PESO_SEVERIDAD: Record<SeveridadAlerta, number> = { alta: 0, media: 1, baja: 2 }

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

export function useResumen(): Resumen {
  const { user, org } = useSession()
  const adultos = useDB((s) => s.adultos)
  const usuarios = useDB((s) => s.usuarios)
  const visitas = useDB((s) => s.visitas)
  const alertas = useDB((s) => s.alertas)
  const necesidades = useDB((s) => s.necesidades)
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  const tareas = useDB((s) => s.tareas)
  const cuidadores = useDB((s) => s.cuidadores)

  return useMemo(() => {
    const adultosOrg = adultosVisibles(user, adultos)
    const activos = adultosOrg.filter((a) => a.estado === 'activo')
    const porId = new Map(adultosOrg.map((a) => [a.id, a]))

    // Alertas sin atender (pendientes + en atención), por urgencia
    const abiertas = alertasVisibles({ alertas, adultos }, user).filter((a) => a.estado !== 'atendida')
    const porUrgencia: Record<SeveridadAlerta, number> = { alta: 0, media: 0, baja: 0 }
    for (const a of abiertas) porUrgencia[a.severidad]++
    const prioritariosAbiertos = abiertas.filter((a) => a.tipo === 'prioritaria').length

    // Tendencia de altas en los últimos 30 días
    const desde = new Date(Date.now() - 30 * 86400000).toISOString()
    const nuevos = activos.filter((a) => a.creadoEn >= desde).length
    const previos = activos.length - nuevos
    const tendenciaAdultos = nuevos > 0 && previos > 0 ? Math.round((nuevos / previos) * 100) : null

    // RF-05: días sin visita frente al umbral de la organización
    const umbralDias = configOrg({ catalogos, configuracion }, org?.id).diasSinVisitaAlerta
    const sinVisita = activos
      .map((adulto) => ({ adulto, dias: diasSinVisita({ visitas }, adulto).dias }))
      .filter((x) => x.dias > umbralDias)
      .sort((a, b) => b.dias - a.dias)

    // Usuarios de la organización por rol
    const usuariosOrg = usuarios.filter((u) => u.orgId === org?.id)
    const usuariosPorRol: Record<Rol, number> = { admin: 0, coordinador: 0, voluntario: 0, familiar: 0 }
    for (const u of usuariosOrg) if (u.estado === 'activo') usuariosPorRol[u.rol]++
    const usuariosActivos = usuariosOrg.filter((u) => u.estado === 'activo').length
    const invitados = usuariosOrg.filter((u) => u.estado === 'invitado').length

    // Necesidades
    const necOrg = necesidades.filter((n) => porId.has(n.adultoId))
    const necesidadesPendientes = necOrg.filter((n) => n.estado === 'pendiente').length
    const necesidadesEnProceso = necOrg.filter((n) => n.estado === 'en_proceso').length

    // Visitas por mes (últimos 6 meses, sin canceladas)
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
    for (const n of necOrg) conteo.set(n.tipo, (conteo.get(n.tipo) ?? 0) + 1)
    const tipos = (Object.keys(TIPOS) as TipoNecesidad[]).filter((t) => (conteo.get(t) ?? 0) > 0).sort((a, b) => conteo.get(b)! - conteo.get(a)!)
    const pcts = porcentajes(tipos.map((t) => conteo.get(t)!))
    const tiposNecesidad: TipoNecesidadStat[] = tipos.map((t, i) => ({ tipo: t, etiqueta: TIPOS[t].etiqueta, color: TIPOS[t].color, total: conteo.get(t)!, pct: pcts[i]! }))

    // Alertas sin atender: primero las más urgentes, luego las más recientes
    const alertasRecientes: AlertaReciente[] = [...abiertas]
      .sort((a, b) => PESO_SEVERIDAD[a.severidad] - PESO_SEVERIDAD[b.severidad] || b.creadaEn.localeCompare(a.creadaEn))
      .slice(0, 4)
      .flatMap((alerta) => {
        const adulto = porId.get(alerta.adultoId)
        return adulto ? [{ alerta, adulto }] : []
      })

    // Agenda: tareas abiertas por fecha y hora programada
    const hoyISO = todayISO()
    const abiertasAgenda = tareasVisibles({ tareas, adultos, cuidadores }, user)
      .filter((t) => t.estado === 'pendiente' || t.estado === 'en_curso')
      .sort((a, b) => `${a.fechaProgramada} ${a.horaProgramada}`.localeCompare(`${b.fechaProgramada} ${b.horaProgramada}`))
    const tareasPendientes = abiertasAgenda.map((tarea) => ({ tarea, adulto: porId.get(tarea.adultoId) }))
    const tareasAtrasadas = abiertasAgenda.filter((t) => t.fechaProgramada < hoyISO).length

    return {
      uso: usoDelPlan({ adultos, usuarios, catalogos }, org),
      tareasPendientes,
      tareasAtrasadas,
      adultosActivos: activos.length,
      tendenciaAdultos,
      prioritariosAbiertos,
      alertasSinAtender: abiertas.length,
      porUrgencia,
      umbralDias,
      sinVisita,
      usuariosPorRol,
      usuariosActivos,
      invitados,
      necesidadesPendientes,
      necesidadesEnProceso,
      visitasPorMes,
      tiposNecesidad,
      alertasRecientes,
    }
  }, [user, org, adultos, usuarios, visitas, alertas, necesidades, catalogos, configuracion, tareas, cuidadores])
}
