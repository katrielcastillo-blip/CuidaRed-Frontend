/*
 * datos.ts — Datos del portal del voluntario (vista mínima): adultos asignados, visitas propias y ficha mínima de
 * cada adulto (nombre, dirección para llegar y contacto principal).
 * Módulo: voluntario (Reglas de Negocio V2 §Visita: el voluntario solo registra que la visita ocurrió y deja una
 * observación; no ve riesgo, condición, indicaciones médicas, necesidades ni datos sensibles).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Todo el acceso pasa por `adultosVisibles` (alcance por vínculo «voluntario asignado» de la cuenta activa): ninguna
 * visita se muestra si su adulto ya no está asignado al voluntario.
 */
import { useCallback, useMemo, useState } from 'react'
import { nombreCompleto, useUser } from '@/domain/auth'
import { addDays, fechaCorta, toISODate, todayISO } from '@/domain/dates'
import { adultosVisibles } from '@/domain/permisos'
import { contactoPrincipal, direccionCompleta, nombreContacto } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto, Visita } from '@/domain/types'

/** Motivo con el que se guarda la visita del voluntario (Visit_razon). */
export const RAZON_VOLUNTARIO = 'Visita de acompañamiento'

/** Observación: longitud permitida por la capa de servicios. */
export const OBSERVACION_MIN = 3
export const OBSERVACION_MAX = 1000

/* ───────────── Adultos asignados ───────────── */

/** Adultos activos con vínculo «voluntario asignado» con el usuario, en orden alfabético. */
export function useMisAdultos(): Adulto[] {
  const user = useUser()
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  return useMemo(
    () => adultosVisibles(user, adultos, vinculos).filter((a) => a.estado === 'activo').sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b))),
    [user, adultos, vinculos],
  )
}

/** Lo único que el voluntario ve de un adulto: nombre, cómo llegar y a quién llamar. */
export interface FichaAdulto {
  nombre: string
  /** Dirección completa (calle, sector, municipio y provincia). */
  direccion: string
  contacto?: { nombre: string; parentesco: string; telefono: string }
}

/** Devuelve una función que arma la ficha mínima de un adulto. */
export function useFicha(): (adulto: Adulto) => FichaAdulto {
  const catalogos = useDB((s) => s.catalogos)
  const contactos = useDB((s) => s.contactos)
  return useCallback(
    (adulto) => {
      const c = contactoPrincipal(contactos, adulto.id)
      return {
        nombre: nombreCompleto(adulto),
        direccion: direccionCompleta(catalogos, adulto),
        contacto: c ? { nombre: nombreContacto(c), parentesco: c.parentesco, telefono: c.telefono } : undefined,
      }
    },
    [catalogos, contactos],
  )
}

/* ───────────── Visitas propias ───────────── */

const porFechaAsc = (a: Visita, b: Visita) => `${a.fecha}T${a.horaPautada}`.localeCompare(`${b.fecha}T${b.horaPautada}`)
/** Instante (ISO) en que se registró o estaba prevista la visita. */
const instante = (v: Visita) => v.fin ?? v.inicio ?? new Date(`${v.fecha}T${v.horaPautada}:00`).toISOString()

export interface MisVisitas {
  /** Programadas para hoy y aún sin registrar. */
  hoy: Visita[]
  /** Programadas para días siguientes. */
  proximas: Visita[]
  /** Programadas para un día que ya pasó y siguen sin registrar. */
  atrasadas: Visita[]
  /** Todas las programadas por registrar (atrasadas, hoy y próximas, en orden). */
  programadas: Visita[]
  /** Visitas que el voluntario ya registró, la más reciente primero. */
  registradas: Visita[]
  registradasHoy: number
  /** Ficha mínima del adulto de una visita (undefined si ya no está asignado al voluntario). */
  fichaDe: (v: Visita) => FichaAdulto | undefined
}

/** Visitas de las que el usuario es responsable y cuyo adulto sigue asignado a él. */
export function useMisVisitas(): MisVisitas {
  const user = useUser()
  const visitas = useDB((s) => s.visitas)
  const adultos = useMisAdultos()
  const ficha = useFicha()
  const grupos = useMemo(() => {
    const dia = todayISO()
    const ids = new Set(adultos.map((a) => a.id))
    const propias = visitas.filter((v) => v.cuidadorId === user.id && ids.has(v.adultoId))
    const porRegistrar = propias.filter((v) => v.estado === 'pendiente' || v.estado === 'en_curso').sort(porFechaAsc)
    const registradas = propias.filter((v) => v.estado === 'completada').sort((a, b) => instante(b).localeCompare(instante(a)))
    return {
      hoy: porRegistrar.filter((v) => v.fecha === dia),
      proximas: porRegistrar.filter((v) => v.fecha > dia),
      atrasadas: porRegistrar.filter((v) => v.fecha < dia),
      programadas: porRegistrar,
      registradas,
      registradasHoy: registradas.filter((v) => v.fecha === dia).length,
    }
  }, [visitas, adultos, user.id])
  const fichaDe = useCallback(
    (v: Visita) => {
      const a = adultos.find((x) => x.id === v.adultoId)
      return a ? ficha(a) : undefined
    },
    [adultos, ficha],
  )
  return { ...grupos, fichaDe }
}

/**
 * ¿La observación de la visita la escribió este voluntario? Si otra persona del equipo registró la visita a su
 * nombre, su texto puede incluir información que el voluntario no debe ver, así que no se muestra.
 */
export const observacionPropia = (v: Visita, usuarioId: string) => (v.actualizadoPor ?? v.creadaPor) === usuarioId

/* ───────────── Presentación ───────────── */

/** "Hoy" · "Mañana" · "Ayer" · "24/08/2026". */
export function etiquetaDia(fecha: string): string {
  const ahora = new Date()
  if (fecha === toISODate(ahora)) return 'Hoy'
  if (fecha === toISODate(addDays(ahora, 1))) return 'Mañana'
  if (fecha === toISODate(addDays(ahora, -1))) return 'Ayer'
  return fechaCorta(fecha)
}

/** Teléfono para el enlace `tel:` (solo dígitos y +). */
export const telefonoParaLlamar = (t: string) => t.replace(/[^\d+]/g, '')

/* ───────────── Mensaje de bienvenida ───────────── */

const CLAVE_BIENVENIDA = 'cuidared:voluntario:bienvenida:'

/**
 * La primera vez que el voluntario entra al portal se le explica qué puede hacer. Se recuerda en este dispositivo
 * (solo una comodidad: si el almacenamiento no está disponible, el aviso simplemente se vuelve a mostrar).
 */
export function useBienvenida(usuarioId: string): [boolean, () => void] {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_BIENVENIDA + usuarioId) !== '1'
    } catch {
      return true
    }
  })
  const cerrar = useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(CLAVE_BIENVENIDA + usuarioId, '1')
    } catch {
      /* sin almacenamiento: se mostrará de nuevo la próxima vez */
    }
  }, [usuarioId])
  return [visible, cerrar]
}
