/*
 * agenda.ts — Datos y formatos compartidos del módulo de agenda (tablas Tarea_agenda y Evidencias):
 * tareas visibles según permisos y alcance (tareasVisibles), nombres de cuidadores (Cuidador + Usuario +
 * Tipo_Cuidado), indicaciones relacionadas y etiquetas de estado, prioridad y validación.
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { tareasVisibles } from '@/domain/api'
import { nombreCompleto, useUser } from '@/domain/auth'
import { addDays, fechaCorta, hhmmA12, toISODate, todayISO } from '@/domain/dates'
import { adultosVisibles, puede } from '@/domain/permisos'
import { cuidadorDeUsuario, nombreUsuario } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Tone } from '@/components/ui'
import type { Adulto, Cuidador, Evidencia, EstadoTarea, IndicacionMedica, Prioridad, Tarea } from '@/domain/types'

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

/** ¿Una evidencia sirve para completar la tarea? (las rechazadas no cuentan). */
export const evidenciaValida = (e: Evidencia) => e.estadoValidacion !== 'rechazada'

/* ───────────── Datos ───────────── */

export interface InfoCuidador {
  cuidador: Cuidador
  nombre: string
  tipo: string
  usuarioId: string
  activo: boolean
}

/**
 * Datos de agenda que el usuario puede consultar, ya indexados. Todo se deriva con useMemo sobre
 * referencias del store (nunca se crean arrays dentro del selector).
 */
export function useAgenda() {
  const user = useUser()
  const tareasAll = useDB((s) => s.tareas)
  const evidenciasAll = useDB((s) => s.evidencias)
  const adultosAll = useDB((s) => s.adultos)
  const cuidadoresAll = useDB((s) => s.cuidadores)
  const usuarios = useDB((s) => s.usuarios)
  const indicacionesAll = useDB((s) => s.indicaciones)
  const vinculos = useDB((s) => s.vinculos)
  const catalogos = useDB((s) => s.catalogos)

  return useMemo(() => {
    const db = { tareas: tareasAll, adultos: adultosAll, cuidadores: cuidadoresAll }
    const tareas = tareasVisibles(db, user)
    const tareaIds = new Set(tareas.map((t) => t.id))
    const evidencias = evidenciasAll.filter((e) => tareaIds.has(e.tareaId))

    // Adultos que aparecen en la agenda: los que el usuario alcanza + los de sus propias tareas.
    const adultoPorId = new Map<string, Adulto>(adultosVisibles(user, adultosAll, vinculos).map((a) => [a.id, a]))
    for (const t of tareas) {
      const a = adultosAll.find((x) => x.id === t.adultoId)
      if (a && !adultoPorId.has(a.id)) adultoPorId.set(a.id, a)
    }

    const hoy = todayISO()
    const cuidadorPorId = new Map<string, InfoCuidador>()
    for (const c of cuidadoresAll) {
      const u = usuarios.find((x) => x.id === c.usuarioId)
      if (!u || u.orgId !== user.orgId) continue
      cuidadorPorId.set(c.id, {
        cuidador: c,
        nombre: nombreCompleto(u),
        tipo: catalogos.tiposCuidado.find((t) => t.id === c.tipoCuidadoId)?.nombre ?? 'Cuidador',
        usuarioId: u.id,
        activo: u.estado === 'activo' && (!c.fechaFin || c.fechaFin >= hoy),
      })
    }

    const indicacionPorId = new Map<string, IndicacionMedica>(indicacionesAll.map((i) => [i.id, i]))
    const miCuidador = cuidadorDeUsuario(cuidadoresAll, user.id)
    const nombreDe = (id: string | undefined) => nombreUsuario(usuarios, id)

    /** ¿Puede ver la indicación médica relacionada? (el permiso indicaciones:ver sobre el adulto) */
    const veIndicacion = (t: Tarea) => {
      const a = adultoPorId.get(t.adultoId)
      return !!a && puede(user, 'indicaciones:ver', a, vinculos)
    }

    return { user, tareas, evidencias, adultoPorId, cuidadorPorId, indicacionPorId, miCuidador, nombreDe, veIndicacion, vinculos, catalogos }
  }, [user, tareasAll, evidenciasAll, adultosAll, cuidadoresAll, usuarios, indicacionesAll, vinculos, catalogos])
}

/** "08:00" → "8:00 a.m." */
export const horaTarea = (hhmm: string) => hhmmA12(hhmm).replace(/^0/, '')

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
