/*
 * resumen.ts — Lógica pura del Módulo de Resumen de Seguimiento (RF-07 · CU-11): prioridad, estado de
 * atención, orden y agrupación de los casos activos, con su ubicación (municipio + sector) y los voluntarios
 * asignados (Vinculo). Sin React ni store: se puede probar de forma aislada.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *  Prioridad
 *    Alta   alerta abierta de caso prioritario o de emergencia, o nivel de riesgo "Alto".
 *    Media  alerta abierta de seguimiento familiar o de necesidad, necesidades pendientes o riesgo "Medio".
 *    Baja   en cualquier otro caso.
 *  Estado de atención (del más al menos urgente)
 *    Alerta pendiente → En atención → Visita vencida → Necesidades pendientes → Al día.
 */
import { DIAS_SIN_VISITA_POR_DEFECTO, diasSinVisita } from '@/domain/reglas'
import { voluntariosDe } from '@/domain/relaciones'
import type { Adulto, Alerta, DB, Riesgo } from '@/domain/types'
import { necesidadAbierta, nombreAdulto, PESO_RIESGO } from './formato'
import { ubicacionCorta } from './ubicacion'

export type Prioridad = 'alta' | 'media' | 'baja'
export type EstadoAtencion = 'alerta_pendiente' | 'en_atencion' | 'visita_vencida' | 'necesidades' | 'al_dia'
export type CriterioOrden = 'prioridad' | 'estado' | 'ultima_visita' | 'riesgo'

export const PRIORIDAD_TEXTO: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }
export const PESO_PRIORIDAD: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 }

/** Estados de atención en orden de urgencia (el orden del array es el orden de "Ordenar por estado"). */
export const ESTADOS_ATENCION: Array<{ value: EstadoAtencion; label: string; descripcion: string }> = [
  { value: 'alerta_pendiente', label: 'Alerta pendiente', descripcion: 'Tiene al menos una alerta que nadie ha empezado a atender.' },
  { value: 'en_atencion', label: 'En atención', descripcion: 'Sus alertas abiertas ya están siendo atendidas por el equipo.' },
  { value: 'visita_vencida', label: 'Visita vencida', descripcion: 'Superó el límite de días sin visita comunitaria.' },
  { value: 'necesidades', label: 'Necesidades pendientes', descripcion: 'Sin alertas abiertas, pero con necesidades por resolver.' },
  { value: 'al_dia', label: 'Al día', descripcion: 'Sin alertas abiertas, sin necesidades pendientes y con visitas al día.' },
]
const PESO_ESTADO = Object.fromEntries(ESTADOS_ATENCION.map((e, i) => [e.value, i])) as Record<EstadoAtencion, number>
export const ESTADO_ATENCION_TEXTO = Object.fromEntries(ESTADOS_ATENCION.map((e) => [e.value, e.label])) as Record<EstadoAtencion, string>

export const CRITERIOS_ORDEN: Array<{ value: CriterioOrden; label: string }> = [
  { value: 'prioridad', label: 'Prioridad' },
  { value: 'estado', label: 'Estado de atención' },
  { value: 'ultima_visita', label: 'Fecha de última visita' },
  { value: 'riesgo', label: 'Nivel de riesgo' },
]

export interface CasoResumen {
  id: string
  nombre: string
  /** "Sector · Municipio". */
  zona: string
  municipioCod: string
  sector: string
  /** Voluntarios con vínculo «voluntario_asignado». */
  voluntarios: number
  riesgo: Riesgo
  prioridad: Prioridad
  /** Razones legibles de la prioridad asignada. */
  motivos: string[]
  estado: EstadoAtencion
  /** Días calendario desde la última visita completada (o desde el registro si no tiene visitas). */
  diasSinVisita: number
  /** Fecha/instante de la última visita completada; undefined si nunca fue visitado. */
  ultimaVisita?: string
  visitaVencida: boolean
  necesidadesPendientes: number
  alertasAbiertas: number
  alertasPendientes: number
}

export interface OpcionesResumen {
  /** Umbral de RF-05 (días sin visita); por defecto 15. */
  umbral?: number
  ahora?: Date
}

const ABRE_ALTA: Array<Alerta['tipo']> = ['prioritaria', 'emergencia']

/** Construye los casos activos a partir de los adultos que el usuario puede ver. */
export function casosResumen(
  db: Pick<DB, 'visitas' | 'necesidades' | 'alertas' | 'vinculos' | 'catalogos'>,
  adultos: Adulto[],
  { umbral = DIAS_SIN_VISITA_POR_DEFECTO, ahora = new Date() }: OpcionesResumen = {},
): CasoResumen[] {
  return adultos
    .filter((a) => a.estado === 'activo' && !a.anonimizado)
    .map((a) => {
      const abiertas = db.alertas.filter((al) => al.adultoId === a.id && al.estado !== 'atendida')
      const pendientesAl = abiertas.filter((al) => al.estado === 'pendiente')
      const necesidades = db.necesidades.filter((n) => n.adultoId === a.id && necesidadAbierta(n.estado)).length
      const visita = diasSinVisita(db, a, ahora)
      const vencida = visita.dias > umbral

      const motivos: string[] = []
      let prioridad: Prioridad = 'baja'
      const altas = abiertas.filter((al) => ABRE_ALTA.includes(al.tipo))
      if (altas.length > 0 || a.riesgo === 'alto') {
        prioridad = 'alta'
        if (altas.some((al) => al.tipo === 'prioritaria')) motivos.push('Alerta de caso prioritario abierta')
        if (altas.some((al) => al.tipo === 'emergencia')) motivos.push('Emergencia abierta')
        if (a.riesgo === 'alto') motivos.push('Riesgo social alto')
      } else {
        const medias = abiertas.filter((al) => al.tipo === 'seguimiento' || al.tipo === 'necesidad')
        if (medias.length > 0 || necesidades > 0 || a.riesgo === 'medio') {
          prioridad = 'media'
          if (medias.some((al) => al.tipo === 'seguimiento')) motivos.push('Alerta de seguimiento familiar abierta')
          if (medias.some((al) => al.tipo === 'necesidad')) motivos.push('Alerta de necesidad abierta')
          if (necesidades > 0) motivos.push(necesidades === 1 ? '1 necesidad pendiente' : `${necesidades} necesidades pendientes`)
          if (a.riesgo === 'medio') motivos.push('Riesgo social medio')
        } else {
          motivos.push('Sin alertas ni necesidades pendientes')
        }
      }
      const voluntarios = voluntariosDe(db.vinculos, a.id).length
      if (voluntarios === 0) motivos.push('Sin voluntario asignado')

      const estado: EstadoAtencion =
        pendientesAl.length > 0 ? 'alerta_pendiente' : abiertas.length > 0 ? 'en_atencion' : vencida ? 'visita_vencida' : necesidades > 0 ? 'necesidades' : 'al_dia'

      return {
        id: a.id,
        nombre: nombreAdulto(a),
        zona: ubicacionCorta(db.catalogos, a),
        municipioCod: a.municipioCod,
        sector: a.zona,
        voluntarios,
        riesgo: a.riesgo,
        prioridad,
        motivos,
        estado,
        diasSinVisita: visita.dias,
        ultimaVisita: visita.conVisitas ? visita.referencia : undefined,
        visitaVencida: vencida,
        necesidadesPendientes: necesidades,
        alertasAbiertas: abiertas.length,
        alertasPendientes: pendientesAl.length,
      }
    })
}

/** Ordena (copia) los casos según el criterio elegido. Los empates se resuelven por prioridad, días sin visita y nombre. */
export function ordenarCasos(casos: CasoResumen[], criterio: CriterioOrden): CasoResumen[] {
  const porPrioridad = (x: CasoResumen, y: CasoResumen) => PESO_PRIORIDAD[x.prioridad] - PESO_PRIORIDAD[y.prioridad]
  const porEstado = (x: CasoResumen, y: CasoResumen) => PESO_ESTADO[x.estado] - PESO_ESTADO[y.estado]
  const porRiesgo = (x: CasoResumen, y: CasoResumen) => PESO_RIESGO[x.riesgo] - PESO_RIESGO[y.riesgo]
  const porDias = (x: CasoResumen, y: CasoResumen) => y.diasSinVisita - x.diasSinVisita
  const porNombre = (x: CasoResumen, y: CasoResumen) => x.nombre.localeCompare(y.nombre, 'es')
  const cadenas: Record<CriterioOrden, Array<(x: CasoResumen, y: CasoResumen) => number>> = {
    prioridad: [porPrioridad, porEstado, porRiesgo, porDias, porNombre],
    estado: [porEstado, porPrioridad, porDias, porNombre],
    ultima_visita: [porDias, porPrioridad, porNombre],
    riesgo: [porRiesgo, porPrioridad, porDias, porNombre],
  }
  const cadena = cadenas[criterio]
  return [...casos].sort((x, y) => {
    for (const f of cadena) {
      const r = f(x, y)
      if (r !== 0) return r
    }
    return 0
  })
}

/** Agrupa los casos (ya ordenados) por estado de atención; solo devuelve los grupos con casos. */
export function agruparPorEstado(casos: CasoResumen[]) {
  return ESTADOS_ATENCION.map((e) => ({ ...e, casos: casos.filter((c) => c.estado === e.value) })).filter((g) => g.casos.length > 0)
}

/** Indicadores de la cabecera del resumen. */
export function indicadoresResumen(casos: CasoResumen[]) {
  return {
    activos: casos.length,
    prioridadAlta: casos.filter((c) => c.prioridad === 'alta').length,
    alertasPendientes: casos.reduce((t, c) => t + c.alertasPendientes, 0),
    visitaVencida: casos.filter((c) => c.visitaVencida).length,
    necesidadesPendientes: casos.reduce((t, c) => t + c.necesidadesPendientes, 0),
  }
}
