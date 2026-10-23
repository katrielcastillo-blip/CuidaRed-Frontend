/*
 * datos.ts — Datos y formatos del panel de gestión del coordinador: alcance de la organización según
 * permisos (RF-09), indicadores de seguimiento (RF-05; umbral desde Configuracion_Cuenta con configOrg),
 * vínculos (Vinculo) y etiquetas de visitas y alertas.
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { useDB } from '@/domain/store'
import { useSession, useUser } from '@/domain/auth'
import { alertasVisibles } from '@/domain/api'
import { adultosVisibles } from '@/domain/permisos'
import { diasSinVisita } from '@/domain/reglas'
import { configOrg } from '@/domain/relaciones'
import { fechaCorta, hhmmA12, relativo } from '@/domain/dates'
import type { Tone } from '@/components/ui'
import type { Adulto, Alerta, EstadoVisita, SeveridadAlerta, Usuario, Visita } from '@/domain/types'

/**
 * Datos que el coordinador puede consultar (adultosVisibles / alertasVisibles), ya indexados.
 * Todo se deriva con useMemo sobre referencias del store (nunca se crean arrays dentro del selector).
 */
export function useOrgData() {
  const user = useUser()
  const { org } = useSession()
  const adultosAll = useDB((s) => s.adultos)
  const visitasAll = useDB((s) => s.visitas)
  const alertasAll = useDB((s) => s.alertas)
  const necesidadesAll = useDB((s) => s.necesidades)
  const usuariosAll = useDB((s) => s.usuarios)
  const vinculos = useDB((s) => s.vinculos)
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)

  return useMemo(() => {
    const adultos = adultosVisibles(user, adultosAll, vinculos)
    const adultoPorId = new Map<string, Adulto>(adultos.map((a) => [a.id, a]))
    const usuarios = usuariosAll.filter((u) => u.orgId === user.orgId)
    const usuarioPorId = new Map<string, Usuario>(usuarios.map((u) => [u.id, u]))
    const voluntarios = usuarios.filter((u) => u.rol === 'voluntario')
    // Visitas de los adultos a su alcance (como adulto principal o adicional del hogar · DetalleVisita).
    const visitas = visitasAll.filter((v) => adultoPorId.has(v.adultoId) || v.detallesAdicionales.some((d) => adultoPorId.has(d.adultoId)))
    const alertas = alertasVisibles({ alertas: alertasAll, adultos: adultosAll }, user)
    const necesidades = necesidadesAll.filter((n) => adultoPorId.has(n.adultoId))
    const umbral = configOrg({ catalogos, configuracion }, org?.id ?? user.orgId).diasSinVisitaAlerta
    return { user, adultos, adultoPorId, usuarios, usuarioPorId, voluntarios, visitas, alertas, necesidades, umbral, vinculos }
  }, [user, org, adultosAll, visitasAll, alertasAll, necesidadesAll, usuariosAll, vinculos, catalogos, configuracion])
}

/** Adultos activos que superan el umbral de días sin visita (RF-05), del que lleva más días al que menos. */
export function sinVisitaReciente(adultos: Adulto[], visitas: Visita[], umbral: number) {
  return adultos
    .filter((a) => a.estado === 'activo')
    .map((a) => ({ adulto: a, ...diasSinVisita({ visitas }, a) }))
    .filter((x) => x.dias > umbral)
    .sort((a, b) => b.dias - a.dias)
}

/* ───────────── Formato ───────────── */

/** "Elena Rodríguez" → "Elena R." (tarjetas de alerta). */
export const nombreCorto = (p: { nombre: string; apellido: string }) => `${p.nombre} ${p.apellido.trim().charAt(0).toUpperCase()}.`.trim()

/** "10:30" → "10:30 a.m." · "15:00" → "3:00 p.m." */
export const horaPautada12 = (hhmm: string) => hhmmA12(hhmm).replace(/^0/, '')

/** "10:30 a.m. · 24/08/2026" */
export const cuandoVisita = (v: Pick<Visita, 'horaPautada' | 'fecha'>) => `${horaPautada12(v.horaPautada)} · ${fechaCorta(v.fecha)}`

/** "Hace 10 min" · "Hace 2 horas" · "Ayer" · "24/08/2026". */
export function haceTiempo(iso: string, ahora = Date.now()) {
  const t = new Date(iso).getTime()
  const min = Math.round((ahora - t) / 60000)
  if (min < 0) return relativo(iso)
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

export const ESTADO_VISITA: Record<EstadoVisita, { label: string; tono: Tone }> = {
  pendiente: { label: 'Pendiente', tono: 'warning' },
  en_curso: { label: 'En curso', tono: 'info' },
  completada: { label: 'Completada', tono: 'success' },
  cancelada: { label: 'Cancelada', tono: 'neutral' },
}

export const SEVERIDAD: Record<SeveridadAlerta, { label: string; tono: Tone }> = {
  alta: { label: 'Urgencia alta', tono: 'danger' },
  media: { label: 'Urgencia media', tono: 'warning' },
  baja: { label: 'Urgencia baja', tono: 'success' },
}

export const esAlertaAbierta = (a: Alerta) => a.estado !== 'atendida'

/** Motivos predefinidos de visita (Visit_razon). "Otra" permite escribir uno distinto. */
export const RAZONES_VISITA = [
  'Seguimiento periódico',
  'Control de presión arterial',
  'Revisión de medicamentos',
  'Seguimiento de una necesidad',
  'Entrega de apoyo o insumos',
  'Visita familiar conjunta',
  'Atención tras una alerta',
] as const
export const RAZON_OTRA = 'Otra'
