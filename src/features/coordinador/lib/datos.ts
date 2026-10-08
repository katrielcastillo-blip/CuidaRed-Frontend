import { useMemo } from 'react'
import { useDB } from '@/domain/store'
import { useUser } from '@/domain/auth'
import { fechaCorta, hhmmA12, relativo } from '@/domain/dates'
import type { Adulto, Alerta, EstadoVisita, Necesidad, SeveridadAlerta, TipoNecesidad, Usuario, Visita } from '@/domain/types'

/**
 * Datos de la organización del coordinador, ya filtrados y listos para derivar métricas.
 * Todo se calcula con useMemo sobre referencias del store (nunca se crean arrays dentro del selector).
 */
export function useOrgData() {
  const user = useUser()
  const adultosAll = useDB((s) => s.adultos)
  const visitasAll = useDB((s) => s.visitas)
  const alertasAll = useDB((s) => s.alertas)
  const necesidadesAll = useDB((s) => s.necesidades)
  const usuariosAll = useDB((s) => s.usuarios)

  return useMemo(() => {
    const adultos = adultosAll.filter((a) => a.orgId === user.orgId)
    const adultoPorId = new Map<string, Adulto>(adultos.map((a) => [a.id, a]))
    const usuarios = usuariosAll.filter((u) => u.orgId === user.orgId)
    const usuarioPorId = new Map<string, Usuario>(usuarios.map((u) => [u.id, u]))
    const cuidadores = usuarios.filter((u) => u.rol === 'cuidador')
    const visitas = visitasAll.filter((v) => adultoPorId.has(v.adultoId))
    const alertas = alertasAll.filter((a) => adultoPorId.has(a.adultoId))
    const necesidades = necesidadesAll.filter((n) => adultoPorId.has(n.adultoId))
    return { user, adultos, adultoPorId, usuarios, usuarioPorId, cuidadores, visitas, alertas, necesidades }
  }, [user, adultosAll, visitasAll, alertasAll, necesidadesAll, usuariosAll])
}

/* ───────────── Formato ───────────── */

/** "Elena Rodríguez" → "Elena R." (como en las tarjetas de alerta del Figma). */
export const nombreCorto = (p: { nombre: string; apellido: string }) =>
  `${p.nombre} ${p.apellido.trim().charAt(0).toUpperCase()}.`.trim()

/** "10:30" → "10:30 a.m." · "15:00" → "3:00 p.m." (sin cero a la izquierda, como el Figma). */
export const horaPautada12 = (hhmm: string) => hhmmA12(hhmm).replace(/^0/, '')

/** "10:30 a.m. - 24/08/2026" */
export const cuandoVisita = (v: Pick<Visita, 'horaPautada' | 'fecha'>) => `${horaPautada12(v.horaPautada)} - ${fechaCorta(v.fecha)}`

/** "Hace 10 min" · "Hace 2 horas" · "Ayer" · "24/08/2026". */
export function haceTiempo(iso: string, ahora = Date.now()) {
  const t = new Date(iso).getTime()
  const min = Math.round((ahora - t) / 60000)
  if (min < 0) return relativo(iso) // programada a futuro: "Hoy, 05:00 p.m."
  if (min < 1) return 'Ahora'
  if (min < 60) return `Hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return h === 1 ? 'Hace 1 hora' : `Hace ${h} horas`
  const hoy = new Date(ahora)
  const d = new Date(iso)
  const dias = Math.round(
    (new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000,
  )
  if (dias === 1) return 'Ayer'
  if (dias < 7) return `Hace ${dias} días`
  return fechaCorta(d)
}

export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const ESTADO_VISITA_LABEL: Record<EstadoVisita, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

export const SEVERIDAD_LABEL: Record<SeveridadAlerta, string> = { alta: 'ALTA', media: 'MEDIA', baja: 'BAJA' }

/* ───────────── Métricas ───────────── */

/** Reparte 100 % entre los valores con el método del mayor resto (la suma siempre da 100). */
export function porcentajes(valores: number[]): number[] {
  const total = valores.reduce((a, b) => a + b, 0)
  if (total === 0) return valores.map(() => 0)
  const exactos = valores.map((v) => (v / total) * 100)
  const base = exactos.map(Math.floor)
  let resto = 100 - base.reduce((a, b) => a + b, 0)
  const orden = exactos.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac)
  for (const { i } of orden) {
    if (resto <= 0) break
    base[i]!++
    resto--
  }
  return base
}

/** Grupos de necesidad del Figma: Médica · Social · Nutrición. */
export const GRUPO_NECESIDAD: Record<TipoNecesidad, 'medica' | 'social' | 'nutricion'> = {
  medicamentos: 'medica',
  alimentacion: 'nutricion',
  compania: 'social',
  transporte: 'social',
  otros: 'social',
}

/** Una necesidad es "urgente" si pide medicamentos o es de un adulto con riesgo alto. */
export const esUrgente = (n: Necesidad, adultoPorId: Map<string, Adulto>) =>
  n.tipo === 'medicamentos' || adultoPorId.get(n.adultoId)?.riesgo === 'alto'

export const esAlertaActiva = (a: Alerta) => a.estado !== 'atendida'
