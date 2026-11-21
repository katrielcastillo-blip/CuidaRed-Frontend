/*
 * datos.ts — Datos y formatos del panel de gestión del coordinador: alcance de la organización según
 * permisos (RF-09), indicadores de seguimiento (RF-05; umbral desde Configuracion_Cuenta con configOrg),
 * monitoreo de visitas (realizadas, pendientes, días sin visita realizada, adultos sin personal asignado),
 * próximos eventos (visitas y tareas), vínculos (Vinculo) y etiquetas de visitas y alertas.
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { useDB } from '@/domain/store'
import { useSession, useUser } from '@/domain/auth'
import { alertasVisibles } from '@/domain/api'
import { adultosVisibles } from '@/domain/permisos'
import { diasSinVisita } from '@/domain/reglas'
import { asignadosDe, configOrg, esRolDeCampo, nombreUsuario } from '@/domain/relaciones'
import { addDays, fechaCorta, hhmmA12, relativo, toISODate, todayISO } from '@/domain/dates'
import type { Tone } from '@/components/ui'
import type { Adulto, Alerta, EstadoVisita, SeveridadAlerta, Tarea, Usuario, Vinculo, Visita } from '@/domain/types'

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
    // Personal de campo (cuidadores y voluntarios).
    const voluntarios = usuarios.filter((u) => esRolDeCampo(u.rol))
    // Visitas de los adultos a su alcance (como adulto principal o adicional del hogar · DetalleVisita).
    const visitas = visitasAll.filter((v) => adultoPorId.has(v.adultoId) || v.detallesAdicionales.some((d) => adultoPorId.has(d.adultoId)))
    const alertas = alertasVisibles({ alertas: alertasAll, adultos: adultosAll }, user)
    const necesidades = necesidadesAll.filter((n) => adultoPorId.has(n.adultoId))
    const umbral = configOrg({ catalogos, configuracion }, org?.id ?? user.orgId).diasSinVisitaAlerta
    // Nombre de cualquier usuario (también el de quien autorizó una visita desde otra de sus cuentas).
    const nombreDe = (id: string | undefined) => nombreUsuario(usuariosAll, id)
    return { user, adultos, adultoPorId, usuarios, usuarioPorId, nombreDe, voluntarios, visitas, alertas, necesidades, umbral, vinculos }
  }, [user, org, adultosAll, visitasAll, alertasAll, necesidadesAll, usuariosAll, vinculos, catalogos, configuracion])
}

export interface AdultoSinVisita {
  adulto: Adulto
  /** Días calendario desde la última visita REALIZADA (completada); sin visitas, desde la creación del perfil. */
  dias: number
  conVisitas: boolean
  /** ¿Supera el umbral de la cuenta (RF-05)? */
  supera: boolean
}

/**
 * Monitoreo de seguimiento: todos los adultos activos con sus días sin visita realizada (las visitas programadas o
 * canceladas no cuentan), del que lleva más días al que menos. `supera` marca los que pasan el umbral de la cuenta.
 */
export function monitoreoSinVisita(adultos: Adulto[], visitas: Visita[], umbral: number): AdultoSinVisita[] {
  return adultos
    .filter((a) => a.estado === 'activo')
    .map((a) => {
      const d = diasSinVisita({ visitas }, a)
      return { adulto: a, dias: d.dias, conVisitas: d.conVisitas, supera: d.dias > umbral }
    })
    .sort((a, b) => b.dias - a.dias)
}

/** Adultos activos que superan el umbral de días sin visita realizada (RF-05). */
export const sinVisitaReciente = (adultos: Adulto[], visitas: Visita[], umbral: number) =>
  monitoreoSinVisita(adultos, visitas, umbral).filter((x) => x.supera)

/**
 * Adultos activos sin personal de campo asignado: ningún cuidador (`cuidador_asignado`) ni voluntario
 * (`voluntario_asignado`) activo de la cuenta.
 */
export function sinPersonalAsignado(adultos: Adulto[], vinculos: Vinculo[], usuarioPorId: Map<string, Usuario>): Adulto[] {
  return adultos.filter((a) => a.estado === 'activo' && !asignadosDe(vinculos, a.id).some((id) => usuarioPorId.get(id)?.estado === 'activo'))
}

/** Resumen de las visitas del día: realizadas, pendientes (por hacer o en curso) y total (sin canceladas). */
export function resumenVisitasHoy(visitas: Visita[], hoy = todayISO()) {
  const delDia = visitas.filter((v) => v.fecha === hoy && v.estado !== 'cancelada')
  const realizadas = delDia.filter((v) => v.estado === 'completada').length
  return { total: delDia.length, realizadas, pendientes: delDia.length - realizadas }
}

/** Alerta activa: pendiente o en atención (no atendida). */
export const esAlertaAbierta = (a: Alerta) => a.estado !== 'atendida'

/** Orden de las alertas por urgencia: alta, media, baja. */
const ORDEN_SEVERIDAD: Record<SeveridadAlerta, number> = { alta: 0, media: 1, baja: 2 }

/** Alertas activas (pendientes y en atención), de mayor a menor urgencia y, a igual urgencia, las más recientes primero. */
export const alertasActivas = (alertas: Alerta[]) =>
  alertas.filter(esAlertaAbierta).sort((a, b) => ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad] || b.creadaEn.localeCompare(a.creadaEn))

/** Próximo evento del coordinador: una visita programada o una tarea de la agenda. */
export type EventoProximo =
  | { tipo: 'visita'; id: string; fecha: string; hora: string; visita: Visita }
  | { tipo: 'tarea'; id: string; fecha: string; hora: string; tarea: Tarea }

/**
 * Visitas programadas (pendientes o en curso) y tareas abiertas de hoy y de los próximos `dias` días,
 * en orden cronológico. Las tareas atrasadas no entran: se cuentan aparte (`tareasVencidas`).
 */
export function proximosEventos(visitas: Visita[], tareas: Tarea[], dias = 7, hoy = todayISO()): EventoProximo[] {
  const limite = toISODate(addDays(new Date(), dias))
  const eventos: EventoProximo[] = [
    ...visitas
      .filter((v) => (v.estado === 'pendiente' || v.estado === 'en_curso') && v.fecha >= hoy && v.fecha <= limite)
      .map((v): EventoProximo => ({ tipo: 'visita', id: v.id, fecha: v.fecha, hora: v.horaPautada, visita: v })),
    ...tareas
      .filter((t) => (t.estado === 'pendiente' || t.estado === 'en_curso') && t.fechaProgramada >= hoy && t.fechaProgramada <= limite)
      .map((t): EventoProximo => ({ tipo: 'tarea', id: t.id, fecha: t.fechaProgramada, hora: t.horaProgramada, tarea: t })),
  ]
  return eventos.sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`) || a.tipo.localeCompare(b.tipo))
}

/** Tareas de agenda abiertas cuya fecha ya pasó. */
export const tareasVencidas = (tareas: Tarea[], hoy = todayISO()) => tareas.filter((t) => (t.estado === 'pendiente' || t.estado === 'en_curso') && t.fechaProgramada < hoy)

/** "Visitante: Pedro Castillo (autorizada por Laura Núñez)" para visitas de personas externas; undefined si no lo es. */
export function textoVisitante(visita: Pick<Visita, 'visitante' | 'autorizadaPor'>, nombreDe: (id: string | undefined) => string): string | undefined {
  if (!visita.visitante) return undefined
  return `Visitante: ${visita.visitante.nombre}${visita.autorizadaPor ? ` (autorizada por ${nombreDe(visita.autorizadaPor)})` : ''}`
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
