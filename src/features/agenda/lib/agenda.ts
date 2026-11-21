/*
 * agenda.ts — Datos y formatos compartidos del módulo de agenda (tablas Tarea_agenda y Evidencias):
 * tareas visibles según permisos, alcance y cuenta activa (tareasVisibles), nombres de cuidadores (Cuidador +
 * Usuario + Tipo_Cuidado), cuidadores asignables a cada adulto, indicaciones relacionadas, situación de la evidencia
 * de cada tarea y etiquetas de estado, prioridad y validación.
 * Cuenta activa: un usuario puede tener varias cuentas (membresías); aquí solo se consideran los adultos, las tareas
 * y los cuidadores de la cuenta en la que actúa (`useUser().orgId`).
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { cuidadoresAsignables, esCuidadorDeCuenta, tareasVisibles, type EvidenciaDetallada } from '@/domain/api'
import { nombreCompleto, useUser } from '@/domain/auth'
import { addDays, fechaCorta, toISODate, todayISO } from '@/domain/dates'
import { adultosVisibles, puede } from '@/domain/permisos'
import { cuidadorDeUsuario, nombreUsuario } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Tone } from '@/components/ui'
import type { Adulto, Cuidador, EstadoTarea, Evidencia, IndicacionMedica, Prioridad, Tarea } from '@/domain/types'
import { horaTarea } from './fechas'

export { DIAS_SEMANA, fechaDiaCorta, fechaDiaLarga, fechaHoraBreve, horaTarea, sumarDias } from './fechas'

/* ───────────── Etiquetas ───────────── */

export const ESTADO_TAREA: Record<EstadoTarea, { label: string; tono: Tone }> = {
  pendiente: { label: 'Pendiente', tono: 'warning' },
  en_curso: { label: 'En curso', tono: 'info' },
  completada: { label: 'Completada', tono: 'success' },
  cancelada: { label: 'Cancelada', tono: 'neutral' },
}

export const PRIORIDAD: Record<Prioridad, { label: string; tono: Tone }> = {
  alta: { label: 'Prioridad alta', tono: 'danger' },
  media: { label: 'Prioridad media', tono: 'warning' },
  baja: { label: 'Prioridad baja', tono: 'success' },
}

export const PRIORIDADES: Array<{ value: Prioridad; label: string }> = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
]

export const ESTADO_EVIDENCIA: Record<Evidencia['estadoValidacion'], { label: string; tono: Tone }> = {
  pendiente: { label: 'Por validar', tono: 'warning' },
  validada: { label: 'Validada', tono: 'success' },
  rechazada: { label: 'Rechazada', tono: 'danger' },
}

/** Tarea abierta (aún se puede iniciar o completar). */
export const tareaAbierta = (t: Pick<Tarea, 'estado'>) => t.estado === 'pendiente' || t.estado === 'en_curso'

/** Clave para ordenar por fecha y hora programadas. */
export const claveTarea = (t: Pick<Tarea, 'fechaProgramada' | 'horaProgramada'>) => `${t.fechaProgramada} ${t.horaProgramada}`

/** ¿La evidencia sirve para completar la tarea? Solo las validadas (las pendientes y rechazadas no cuentan). */
export const evidenciaValida = (e: Pick<Evidencia, 'estadoValidacion'>) => e.estadoValidacion === 'validada'

/** Situación de la evidencia de una tarea, de la más a la menos favorable. */
export type SituacionEvidencia = 'validada' | 'pendiente' | 'rechazada' | 'sin_evidencia'

export function situacionEvidencia(evidencias: Array<Pick<Evidencia, 'estadoValidacion'>>): SituacionEvidencia {
  if (evidencias.some((e) => e.estadoValidacion === 'validada')) return 'validada'
  if (evidencias.some((e) => e.estadoValidacion === 'pendiente')) return 'pendiente'
  if (evidencias.length > 0) return 'rechazada'
  return 'sin_evidencia'
}

/** Última evidencia rechazada (la que explica por qué la tarea volvió a pendiente). */
export const ultimoRechazo = (evidencias: EvidenciaDetallada[]): EvidenciaDetallada | undefined =>
  evidencias
    .filter((e) => e.estadoValidacion === 'rechazada')
    .sort((a, b) => (b.validadaEn ?? b.fechaRegistro).localeCompare(a.validadaEn ?? a.fechaRegistro))[0]

/**
 * Rechazo que el cuidador todavía debe atender: la última evidencia rechazada, siempre que la tarea no tenga una
 * evidencia validada ni el cuidador haya adjuntado otra después del rechazo.
 */
export function rechazoVigente(evidencias: EvidenciaDetallada[]): EvidenciaDetallada | undefined {
  if (evidencias.some((e) => e.estadoValidacion === 'validada')) return undefined
  const r = ultimoRechazo(evidencias)
  if (!r) return undefined
  const cuando = r.validadaEn ?? r.fechaRegistro
  return evidencias.some((e) => e.estadoValidacion === 'pendiente' && e.fechaRegistro > cuando) ? undefined : r
}

/* ───────────── Datos ───────────── */

export interface InfoCuidador {
  cuidador: Cuidador
  nombre: string
  tipo: string
  usuarioId: string
  /** Usuario activo, perfil vigente y miembro (como cuidador) de la cuenta activa. */
  activo: boolean
}

/**
 * Datos de agenda que el usuario puede consultar en su cuenta activa, ya indexados. Todo se deriva con useMemo sobre
 * referencias del store (nunca se crean arrays dentro del selector).
 */
export function useAgenda() {
  const user = useUser()
  const tareasAll = useDB((s) => s.tareas)
  const evidenciasAll = useDB((s) => s.evidencias)
  const adultosAll = useDB((s) => s.adultos)
  const cuidadoresAll = useDB((s) => s.cuidadores)
  const usuarios = useDB((s) => s.usuarios)
  const membresias = useDB((s) => s.membresias)
  const indicacionesAll = useDB((s) => s.indicaciones)
  const vinculos = useDB((s) => s.vinculos)
  const catalogos = useDB((s) => s.catalogos)

  return useMemo(() => {
    const tareas = tareasVisibles({ tareas: tareasAll, adultos: adultosAll, cuidadores: cuidadoresAll }, user)
    const tareaIds = new Set(tareas.map((t) => t.id))
    const evidencias = evidenciasAll.filter((e) => tareaIds.has(e.tareaId)) as EvidenciaDetallada[]

    // Adultos de la cuenta activa que el usuario alcanza + los de sus propias tareas (también de esta cuenta).
    const adultosCuenta = adultosAll.filter((a) => a.orgId === user.orgId)
    const adultoPorId = new Map<string, Adulto>(adultosVisibles(user, adultosCuenta, vinculos).map((a) => [a.id, a]))
    for (const t of tareas) {
      const a = adultosCuenta.find((x) => x.id === t.adultoId)
      if (a && !adultoPorId.has(a.id)) adultoPorId.set(a.id, a)
    }

    // Cuidadores de la cuenta activa (por membresía) y los de las tareas visibles, aunque ya no sean miembros.
    const conTareas = new Set(tareas.map((t) => t.cuidadorId))
    const dbCuentas = { usuarios, membresias }
    const cuidadorPorId = new Map<string, InfoCuidador>()
    for (const c of cuidadoresAll) {
      const u = usuarios.find((x) => x.id === c.usuarioId)
      if (!u) continue
      const activo = esCuidadorDeCuenta(dbCuentas, c, user.orgId)
      const miembro = membresias.some((m) => m.usuarioId === u.id && m.orgId === user.orgId && m.rol === 'cuidador')
      if (!activo && !miembro && !conTareas.has(c.id)) continue
      cuidadorPorId.set(c.id, {
        cuidador: c,
        nombre: nombreCompleto(u),
        tipo: catalogos.tiposCuidado.find((t) => t.id === c.tipoCuidadoId)?.nombre ?? 'Cuidador',
        usuarioId: u.id,
        activo,
      })
    }

    /** Cuidadores que se pueden asignar a las tareas de un adulto: vínculo `cuidador_asignado` en la cuenta activa. */
    const cuidadoresDeAdulto = (adultoId: string): InfoCuidador[] => {
      const a = adultosCuenta.find((x) => x.id === adultoId)
      return cuidadoresAsignables({ vinculos, cuidadores: cuidadoresAll, usuarios, membresias }, a)
        .map((c) => cuidadorPorId.get(c.id))
        .filter((c): c is InfoCuidador => !!c)
        .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
    }

    const indicacionPorId = new Map<string, IndicacionMedica>(indicacionesAll.map((i) => [i.id, i]))
    const miCuidador = cuidadorDeUsuario(cuidadoresAll, user.id)
    const nombreDe = (id: string | undefined) => nombreUsuario(usuarios, id)

    /** ¿Puede ver la indicación médica relacionada? (el permiso indicaciones:ver sobre el adulto) */
    const veIndicacion = (t: Tarea) => {
      const a = adultoPorId.get(t.adultoId)
      return !!a && puede(user, 'indicaciones:ver', a, vinculos)
    }

    return { user, tareas, evidencias, adultoPorId, cuidadorPorId, cuidadoresDeAdulto, indicacionPorId, miCuidador, nombreDe, veIndicacion, vinculos, catalogos }
  }, [user, tareasAll, evidenciasAll, adultosAll, cuidadoresAll, usuarios, membresias, indicacionesAll, vinculos, catalogos])
}

/** Evidencias de cada tarea, indexadas por id de tarea (más recientes primero). */
export function evidenciasPorTarea(evidencias: EvidenciaDetallada[]): Map<string, EvidenciaDetallada[]> {
  const m = new Map<string, EvidenciaDetallada[]>()
  for (const e of [...evidencias].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro))) {
    const lista = m.get(e.tareaId)
    if (lista) lista.push(e)
    else m.set(e.tareaId, [e])
  }
  return m
}

/* ───────────── Formatos ───────────── */

/** "Hoy" · "Mañana" · "Ayer" · "24/08/2026" para una fecha YYYY-MM-DD. */
export function etiquetaDia(fecha: string) {
  if (fecha === todayISO()) return 'Hoy'
  if (fecha === toISODate(addDays(new Date(), 1))) return 'Mañana'
  if (fecha === toISODate(addDays(new Date(), -1))) return 'Ayer'
  return fechaCorta(fecha)
}

/** "Hoy · 8:00 a.m." */
export const cuandoTarea = (t: Pick<Tarea, 'fechaProgramada' | 'horaProgramada'>) => `${etiquetaDia(t.fechaProgramada)} · ${horaTarea(t.horaProgramada)}`

/** Minúsculas y sin tildes (búsquedas). */
export const normaliza = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
