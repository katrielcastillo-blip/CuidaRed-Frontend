/*
 * historial.ts — Historial consolidado del adulto mayor (CU-06 · RF-3.4): une en una sola línea de tiempo las
 * visitas (realizadas, canceladas y de visitante externo), las necesidades con sus cambios de estado, las alertas
 * con sus acciones y los factores de riesgo (Env_Riesgo). Funciones puras: reciben las tablas y los permisos ya
 * resueltos, de modo que no se incluye nada que el rol no pueda consultar.
 * Módulo: gestión (reutilizable por cualquier área).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { Tone } from '@/components/ui'
import { fechaCorta, fechaHora, hhmmA12 } from '@/domain/dates'
import { observacionPara, visitaIncluye } from '@/domain/relaciones'
import type { Adulto, Alerta, Catalogos, EnvRiesgo, EstadoAdultoVisita, Necesidad, Riesgo, SeveridadAlerta, Usuario, Visita } from '@/domain/types'
import { nombreCatalogo, nombreUsuario } from './datos'
import { ESTADO_ALERTA_TEXTO, ESTADO_NECESIDAD_TEXTO, ESTADO_RIESGO_TEXTO, nombreAdulto, TIPO_NECESIDAD_TEXTO, TONO_ALERTA, TONO_NECESIDAD, TONO_RIESGO_ESTADO } from './formato'

export type TipoEvento = 'visita' | 'necesidad' | 'alerta' | 'riesgo'

export interface EventoHistorial {
  id: string
  tipo: TipoEvento
  /** Instante (ms) para ordenar y filtrar por rango. */
  instante: number
  /** Fecha y hora legibles («05/11/2026 04:30 p.m.»). */
  cuando: string
  titulo: string
  /** Texto principal del evento (observación, nota, motivo…). */
  detalle?: string
  /** Estado que se muestra como insignia. */
  estado: string
  tono: Tone
  /** Datos adicionales cortos («Visitante externo», «Responsable: …»). */
  extras: string[]
  /** Quién lo registró. */
  autor?: string
  /** Ruta relativa a la base del rol de su pantalla de detalle (`visitas/v-1`). */
  ruta?: string
  /** Riesgo: nivel del factor (para la insignia con forma). */
  nivel?: Riesgo
  /** Alerta: prioridad. */
  severidad?: SeveridadAlerta
  pendienteSync?: boolean
  /** Visita: true si fue realizada (estado «completada»). */
  realizada?: boolean
}

/** Qué tipos de evento puede consultar el rol (se resuelve con `puede()` en la pantalla). */
export interface PermisosHistorial {
  visitas: boolean
  necesidades: boolean
  alertas: boolean
  riesgos: boolean
  /** Muestra las observaciones de las visitas (dato sensible). */
  observaciones: boolean
}

export interface FuentesHistorial {
  adultos: Adulto[]
  visitas: Visita[]
  necesidades: Necesidad[]
  alertas: Alerta[]
  riesgos: EnvRiesgo[]
  usuarios: Usuario[]
  catalogos: Catalogos
}

export const TIPO_EVENTO_TEXTO: Record<TipoEvento, string> = { visita: 'Visitas', necesidad: 'Necesidades', alerta: 'Alertas', riesgo: 'Riesgos' }

export const ESTADO_ADULTO_TEXTO: Record<EstadoAdultoVisita, string> = { estable: 'Estable', requiere_atencion: 'Requiere atención', situacion_critica: 'Situación crítica' }

/** Instante de una fecha (`YYYY-MM-DD`, `YYYY-MM-DDTHH:MM` local o ISO UTC). */
export const instanteDe = (valor: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T00:00:00` : valor).getTime()

/** Visitas: solo las realizadas y las canceladas; las programadas o en curso pertenecen a la agenda, no al historial. */
function eventosDeVisitas(adulto: Adulto, f: FuentesHistorial, verObservaciones: boolean): EventoHistorial[] {
  const nombreDe = (id: string) => {
    const a = f.adultos.find((x) => x.id === id)
    return a ? nombreAdulto(a) : 'otro adulto'
  }
  return f.visitas
    .filter((v) => visitaIncluye(v, adulto.id) && (v.estado === 'completada' || v.estado === 'cancelada'))
    .map((v): EventoHistorial => {
      const realizada = v.estado === 'completada'
      const otros = [v.adultoId, ...v.detallesAdicionales.map((d) => d.adultoId)].filter((id) => id !== adulto.id)
      const obs = verObservaciones ? observacionPara(v, adulto.id) : undefined
      const extras: string[] = []
      if (v.visitante) extras.push('Visitante externo')
      extras.push(`${v.visitante ? 'Autorizada por' : 'Responsable'}: ${nombreUsuario(f.usuarios, v.cuidadorId) ?? '—'}`)
      if (realizada && verObservaciones && v.estadoAdulto) extras.push(`Estado del adulto: ${ESTADO_ADULTO_TEXTO[v.estadoAdulto]}`)
      if (otros.length > 0) extras.push(`Visita compartida con ${otros.map(nombreDe).join(', ')}`)
      const referencia = realizada ? (v.fin ?? v.inicio ?? `${v.fecha}T${v.horaPautada}`) : `${v.fecha}T${v.horaPautada}`
      return {
        id: `visita-${v.id}`,
        tipo: 'visita',
        instante: instanteDe(referencia),
        cuando: v.inicio && realizada ? fechaHora(v.inicio) : `${fechaCorta(v.fecha)} ${hhmmA12(v.horaPautada)}`,
        titulo: v.visitante ? `Visita de ${v.visitante.nombre}` : v.razon || v.tipo,
        detalle: obs || undefined,
        estado: realizada ? 'Realizada' : 'Cancelada',
        tono: realizada ? 'success' : 'neutral',
        extras,
        ruta: `visitas/${v.id}`,
        pendienteSync: v.pendienteSync,
        realizada,
      }
    })
}

/** Necesidades: el registro y cada cambio de estado (Env_Necesidad + historial). */
function eventosDeNecesidades(adulto: Adulto, f: FuentesHistorial): EventoHistorial[] {
  const eventos: EventoHistorial[] = []
  for (const n of f.necesidades.filter((x) => x.adultoId === adulto.id)) {
    const nombre = n.catalogoId ? nombreCatalogo(f.catalogos.necesidades, n.catalogoId) : TIPO_NECESIDAD_TEXTO[n.tipo]
    const historial = n.historial.length > 0 ? n.historial : [{ estado: 'pendiente' as const, fecha: n.creadaEn, usuarioId: n.registradaPor }]
    historial.forEach((h, i) => {
      const registro = i === 0 && h.estado === 'pendiente'
      eventos.push({
        id: `necesidad-${n.id}-${i}`,
        tipo: 'necesidad',
        instante: instanteDe(h.fecha),
        cuando: fechaHora(h.fecha),
        titulo: registro ? `Necesidad registrada: ${nombre}` : `Necesidad «${nombre}» pasó a ${ESTADO_NECESIDAD_TEXTO[h.estado].toLowerCase()}`,
        detalle: registro ? n.descripcion : h.nota,
        estado: ESTADO_NECESIDAD_TEXTO[h.estado],
        tono: TONO_NECESIDAD[h.estado],
        extras: [TIPO_NECESIDAD_TEXTO[n.tipo]],
        autor: nombreUsuario(f.usuarios, h.usuarioId),
        ruta: `necesidades/${n.id}`,
        pendienteSync: registro ? n.pendienteSync : undefined,
      })
    })
  }
  return eventos
}

/** Alertas: su generación y cada acción tomada (AlertaEnvejeciente + acciones). */
function eventosDeAlertas(adulto: Adulto, f: FuentesHistorial): EventoHistorial[] {
  const eventos: EventoHistorial[] = []
  for (const a of f.alertas.filter((x) => x.adultoId === adulto.id)) {
    const tipo = nombreCatalogo(f.catalogos.alertas, a.tipo)
    eventos.push({
      id: `alerta-${a.id}-creada`,
      tipo: 'alerta',
      instante: instanteDe(a.creadaEn),
      cuando: fechaHora(a.creadaEn),
      titulo: `Alerta generada: ${a.titulo}`,
      detalle: a.descripcion,
      estado: ESTADO_ALERTA_TEXTO.pendiente,
      tono: TONO_ALERTA.pendiente,
      extras: [tipo, a.generadaPor === 'sistema' ? 'Generada automáticamente' : 'Registrada por una persona'],
      autor: nombreUsuario(f.usuarios, a.generadaPor),
      ruta: `alertas/${a.id}`,
      severidad: a.severidad,
    })
    a.acciones.forEach((ac, i) => {
      eventos.push({
        id: `alerta-${a.id}-${ac.id || i}`,
        tipo: 'alerta',
        instante: instanteDe(ac.fecha),
        cuando: fechaHora(ac.fecha),
        titulo: `Alerta «${a.titulo}»: ${ESTADO_ALERTA_TEXTO[ac.estado].toLowerCase()}`,
        detalle: ac.nota,
        estado: ESTADO_ALERTA_TEXTO[ac.estado],
        tono: TONO_ALERTA[ac.estado],
        extras: [tipo],
        autor: nombreUsuario(f.usuarios, ac.usuarioId),
        ruta: `alertas/${a.id}`,
        severidad: a.severidad,
      })
    })
  }
  return eventos
}

/** Riesgos: cada factor registrado (Env_Riesgo) con su nivel y estado. */
function eventosDeRiesgos(adulto: Adulto, f: FuentesHistorial): EventoHistorial[] {
  return f.riesgos
    .filter((r) => r.adultoId === adulto.id)
    .map((r) => ({
      id: `riesgo-${r.id}`,
      tipo: 'riesgo' as const,
      instante: instanteDe(r.fecha),
      cuando: fechaHora(r.fecha),
      titulo: `Factor de riesgo: ${nombreCatalogo(f.catalogos.riesgos, r.riesgoId)}`,
      detalle: [r.motivo, r.observacion ? `Observación: ${r.observacion}` : ''].filter(Boolean).join(' · '),
      estado: ESTADO_RIESGO_TEXTO[r.estado],
      tono: TONO_RIESGO_ESTADO[r.estado],
      extras: [],
      autor: nombreUsuario(f.usuarios, r.registradoPor),
      nivel: r.nivel,
    }))
}

/**
 * Línea de tiempo del adulto, de lo más reciente a lo más antiguo. Solo incluye los tipos que el rol puede
 * consultar: sin permiso sobre necesidades, por ejemplo, no se calcula ni un solo evento de ese tipo.
 */
export function construirHistorial(adulto: Adulto, fuentes: FuentesHistorial, permisos: PermisosHistorial): EventoHistorial[] {
  return [
    ...(permisos.visitas ? eventosDeVisitas(adulto, fuentes, permisos.observaciones) : []),
    ...(permisos.necesidades ? eventosDeNecesidades(adulto, fuentes) : []),
    ...(permisos.alertas ? eventosDeAlertas(adulto, fuentes) : []),
    ...(permisos.riesgos ? eventosDeRiesgos(adulto, fuentes) : []),
  ].sort((a, b) => b.instante - a.instante || a.id.localeCompare(b.id))
}

/* ───────────── Filtros ───────────── */

export type Periodo = 'todo' | '30' | '90' | 'anio' | 'personalizado'

/** Orden de las opciones (las claves numéricas de un objeto se ordenarían antes que «todo»). */
export const PERIODOS: Periodo[] = ['todo', '30', '90', 'anio', 'personalizado']

export const PERIODO_TEXTO: Record<Periodo, string> = {
  todo: 'Todo el historial',
  '30': 'Últimos 30 días',
  '90': 'Últimos 90 días',
  anio: 'Último año',
  personalizado: 'Rango de fechas',
}

export interface FiltroHistorial {
  tipo: '' | TipoEvento
  periodo: Periodo
  /** `YYYY-MM-DD` (solo con periodo «personalizado»). */
  desde: string
  hasta: string
}

export const FILTRO_VACIO: FiltroHistorial = { tipo: '', periodo: 'todo', desde: '', hasta: '' }

/** Error del rango personalizado (se muestra junto al campo). */
export function errorRango(f: Pick<FiltroHistorial, 'periodo' | 'desde' | 'hasta'>): string | undefined {
  if (f.periodo !== 'personalizado') return undefined
  if (f.desde && f.hasta && f.hasta < f.desde) return 'La fecha final no puede ser anterior a la inicial.'
  return undefined
}

/** Aplica el filtro por tipo y rango. Un rango personalizado inválido no filtra por fechas (el error se muestra aparte). */
export function filtrarHistorial(eventos: EventoHistorial[], f: FiltroHistorial, ahora = new Date()): EventoHistorial[] {
  let desde = -Infinity
  let hasta = Infinity
  if (f.periodo === '30' || f.periodo === '90' || f.periodo === 'anio') {
    const dias = f.periodo === 'anio' ? 365 : Number(f.periodo)
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - dias)
    desde = inicio.getTime()
  } else if (f.periodo === 'personalizado' && !errorRango(f)) {
    if (f.desde) desde = instanteDe(f.desde)
    if (f.hasta) hasta = instanteDe(f.hasta) + 86_400_000 - 1
  }
  return eventos.filter((e) => (!f.tipo || e.tipo === f.tipo) && e.instante >= desde && e.instante <= hasta)
}
