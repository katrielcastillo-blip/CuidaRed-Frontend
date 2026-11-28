/*
 * resumen.ts — Lógica pura del módulo de Seguimiento (RF-07 · CU-11): prioridad, estado de atención, orden,
 * filtros y agrupación de los casos activos, con su ubicación (municipio + sector) y el personal asignado
 * (cuidadores y voluntarios, tabla Vinculo). Sin React ni store: se puede probar de forma aislada.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *  Prioridad (riesgo + alertas abiertas)
 *    Alta   alerta abierta de caso prioritario o de emergencia, o nivel de riesgo "Alto".
 *    Media  alerta abierta de seguimiento familiar o de necesidad, necesidades pendientes o riesgo "Medio".
 *    Baja   en cualquier otro caso.
 *  Estado de atención (del más al menos urgente)
 *    Alerta pendiente → En atención → Visita vencida → Necesidades pendientes → Al día.
 *  Fecha de última visita
 *    Solo cuentan las visitas realizadas (estado «completada»), incluidas las compartidas del hogar.
 *  Personal asignado
 *    asignadosDe(): cuidadores (cuidador_asignado) y voluntarios (voluntario_asignado) con cuenta activa.
 *    Se recalcula con cada cambio de vínculos o de estado de usuarios (el store es reactivo).
 */
import { DIAS_SIN_VISITA_POR_DEFECTO, diasSinVisita } from '@/domain/reglas'
import { asignadosDe, cuidadoresDe } from '@/domain/relaciones'
import type { Adulto, Alerta, DB, Riesgo, Vinculo } from '@/domain/types'
import { necesidadAbierta, nombreAdulto, norm, PESO_RIESGO } from './formato'
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

/** Texto del sentido del orden según el criterio: «primero lo más urgente» (o su inverso). */
export const SENTIDO_ORDEN: Record<CriterioOrden, [normal: string, invertido: string]> = {
  prioridad: ['alta primero', 'baja primero'],
  estado: ['más urgente primero', 'menos urgente primero'],
  ultima_visita: ['más antigua primero', 'más reciente primero'],
  riesgo: ['alto primero', 'bajo primero'],
}

export interface CasoResumen {
  id: string
  nombre: string
  /** "Sector · Municipio". */
  zona: string
  municipioCod: string
  sector: string
  /** Personal asignado con cuenta activa (cuidadores + voluntarios, sin repetir). */
  personal: number
  cuidadores: number
  voluntarios: number
  /** Ids del personal asignado (para el filtro «Asignado a»). */
  personalIds: string[]
  riesgo: Riesgo
  prioridad: Prioridad
  /** Razones legibles de la prioridad asignada. */
  motivos: string[]
  estado: EstadoAtencion
  /** Días calendario desde la última visita realizada (o desde el registro si no tiene visitas). */
  diasSinVisita: number
  /** Fecha/instante de la última visita realizada; undefined si nunca fue visitado. */
  ultimaVisita?: string
  /** Fecha de registro del perfil (referencia para quienes nunca fueron visitados). */
  registrado: string
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

/**
 * Personal asignado a un adulto con cuenta activa. Usa asignadosDe (cuidadores y voluntarios) y descarta a quien
 * fue desactivado o aún no activó su cuenta: no puede visitar, así que no cuenta como cobertura.
 */
export function personalAsignado(vinculos: Vinculo[], activos: ReadonlySet<string>, adultoId: string) {
  const ids = asignadosDe(vinculos, adultoId).filter((id) => activos.has(id))
  const deCuidador = new Set(cuidadoresDe(vinculos, adultoId))
  const cuidadores = ids.filter((id) => deCuidador.has(id)).length
  return { ids, cuidadores, voluntarios: ids.length - cuidadores }
}

/** Ids de los usuarios con cuenta activa. */
export const usuariosActivos = (usuarios: DB['usuarios']): Set<string> => new Set(usuarios.filter((u) => u.estado === 'activo').map((u) => u.id))

/** Construye los casos activos a partir de los adultos que el usuario puede ver. */
export function casosResumen(
  db: Pick<DB, 'visitas' | 'necesidades' | 'alertas' | 'vinculos' | 'usuarios' | 'catalogos'>,
  adultos: Adulto[],
  { umbral = DIAS_SIN_VISITA_POR_DEFECTO, ahora = new Date() }: OpcionesResumen = {},
): CasoResumen[] {
  const activos = usuariosActivos(db.usuarios)
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
      const personal = personalAsignado(db.vinculos, activos, a.id)
      if (personal.ids.length === 0) motivos.push('Sin personal asignado')

      const estado: EstadoAtencion =
        pendientesAl.length > 0 ? 'alerta_pendiente' : abiertas.length > 0 ? 'en_atencion' : vencida ? 'visita_vencida' : necesidades > 0 ? 'necesidades' : 'al_dia'

      return {
        id: a.id,
        nombre: nombreAdulto(a),
        zona: ubicacionCorta(db.catalogos, a),
        municipioCod: a.municipioCod,
        sector: a.zona,
        personal: personal.ids.length,
        cuidadores: personal.cuidadores,
        voluntarios: personal.voluntarios,
        personalIds: personal.ids,
        riesgo: a.riesgo,
        prioridad,
        motivos,
        estado,
        diasSinVisita: visita.dias,
        ultimaVisita: visita.conVisitas ? visita.referencia : undefined,
        registrado: a.creadoEn,
        visitaVencida: vencida,
        necesidadesPendientes: necesidades,
        alertasAbiertas: abiertas.length,
        alertasPendientes: pendientesAl.length,
      }
    })
}

const instante = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/**
 * Ordena (copia) los casos según el criterio elegido. Los empates se resuelven con criterios de urgencia y,
 * al final, por nombre. `invertir` entrega el orden contrario (menos urgente / más reciente primero).
 *  - Prioridad: prioridad → estado → alertas abiertas → riesgo → días sin visita.
 *  - Fecha de última visita: la visita realizada más antigua primero; quien nunca fue visitado va antes (por
 *    fecha de registro).
 */
export function ordenarCasos(casos: CasoResumen[], criterio: CriterioOrden, invertir = false): CasoResumen[] {
  const porPrioridad = (x: CasoResumen, y: CasoResumen) => PESO_PRIORIDAD[x.prioridad] - PESO_PRIORIDAD[y.prioridad]
  const porEstado = (x: CasoResumen, y: CasoResumen) => PESO_ESTADO[x.estado] - PESO_ESTADO[y.estado]
  const porRiesgo = (x: CasoResumen, y: CasoResumen) => PESO_RIESGO[x.riesgo] - PESO_RIESGO[y.riesgo]
  const porAlertas = (x: CasoResumen, y: CasoResumen) => y.alertasAbiertas - x.alertasAbiertas
  const porDias = (x: CasoResumen, y: CasoResumen) => y.diasSinVisita - x.diasSinVisita
  const porNombre = (x: CasoResumen, y: CasoResumen) => x.nombre.localeCompare(y.nombre, 'es')
  const porUltimaVisita = (x: CasoResumen, y: CasoResumen) => {
    if (!x.ultimaVisita && !y.ultimaVisita) return instante(x.registrado) - instante(y.registrado)
    if (!x.ultimaVisita) return -1
    if (!y.ultimaVisita) return 1
    return instante(x.ultimaVisita) - instante(y.ultimaVisita)
  }
  const cadenas: Record<CriterioOrden, Array<(x: CasoResumen, y: CasoResumen) => number>> = {
    prioridad: [porPrioridad, porEstado, porAlertas, porRiesgo, porDias, porNombre],
    estado: [porEstado, porPrioridad, porAlertas, porDias, porNombre],
    ultima_visita: [porUltimaVisita, porPrioridad, porNombre],
    riesgo: [porRiesgo, porPrioridad, porAlertas, porDias, porNombre],
  }
  const cadena = cadenas[criterio]
  const signo = invertir ? -1 : 1
  return [...casos].sort((x, y) => {
    for (const f of cadena) {
      const r = f(x, y)
      if (r !== 0) return r * signo
    }
    return 0
  })
}

/** Agrupa los casos (ya ordenados) por estado de atención; solo devuelve los grupos con casos. */
export function agruparPorEstado(casos: CasoResumen[]) {
  return ESTADOS_ATENCION.map((e) => ({ ...e, casos: casos.filter((c) => c.estado === e.value) })).filter((g) => g.casos.length > 0)
}

/* ───────────── Filtros y búsqueda ───────────── */
/** Valores especiales del filtro «Asignado a»; cualquier otro valor es el id de un usuario. */
export const ASIGNACION_SIN_PERSONAL = 'sin'
export const ASIGNACION_CON_PERSONAL = 'con'

export interface FiltrosResumen {
  /** Texto libre: nombre, sector o municipio. */
  busqueda: string
  estado: '' | EstadoAtencion
  prioridad: '' | Prioridad
  riesgo: '' | Riesgo
  /** Municipio_Cod ('' = todos). */
  municipio: string
  sector: string
  /** '' = todos · 'sin' · 'con' · id del cuidador o voluntario. */
  asignacion: string
}

export const FILTROS_RESUMEN_INICIALES: FiltrosResumen = { busqueda: '', estado: '', prioridad: '', riesgo: '', municipio: '', sector: '', asignacion: '' }

/** ¿Hay algún filtro o búsqueda aplicados? */
export const hayFiltrosResumen = (f: FiltrosResumen) => Object.values(f).some((v) => v !== '')

/** Aplica la búsqueda y los filtros a los casos (conserva el orden recibido). */
export function filtrarCasos(casos: CasoResumen[], f: FiltrosResumen): CasoResumen[] {
  const q = norm(f.busqueda)
  return casos.filter(
    (c) =>
      (!q || norm(`${c.nombre} ${c.zona}`).includes(q)) &&
      (!f.estado || c.estado === f.estado) &&
      (!f.prioridad || c.prioridad === f.prioridad) &&
      (!f.riesgo || c.riesgo === f.riesgo) &&
      (!f.municipio || c.municipioCod === f.municipio) &&
      (!f.sector || c.sector === f.sector) &&
      (!f.asignacion ||
        (f.asignacion === ASIGNACION_SIN_PERSONAL ? c.personal === 0 : f.asignacion === ASIGNACION_CON_PERSONAL ? c.personal > 0 : c.personalIds.includes(f.asignacion))),
  )
}

/** Indicadores de la cabecera del seguimiento. */
export function indicadoresResumen(casos: CasoResumen[]) {
  return {
    activos: casos.length,
    prioridadAlta: casos.filter((c) => c.prioridad === 'alta').length,
    alertasPendientes: casos.reduce((t, c) => t + c.alertasPendientes, 0),
    visitaVencida: casos.filter((c) => c.visitaVencida).length,
    necesidadesPendientes: casos.reduce((t, c) => t + c.necesidadesPendientes, 0),
    sinPersonal: casos.filter((c) => c.personal === 0).length,
  }
}

/** "1 cuidador · 2 voluntarios" (vacío si no hay nadie). */
export function detallePersonal(c: Pick<CasoResumen, 'cuidadores' | 'voluntarios'>): string {
  return [c.cuidadores > 0 && `${c.cuidadores} ${c.cuidadores === 1 ? 'cuidador' : 'cuidadores'}`, c.voluntarios > 0 && `${c.voluntarios} ${c.voluntarios === 1 ? 'voluntario' : 'voluntarios'}`]
    .filter(Boolean)
    .join(' · ')
}
