/*
 * necesidades.ts — Servicios de necesidades pendientes (RF-03 · CU-07 · CU-08), con soporte sin conexión (RF-10).
 * Módulo: dominio · servicios.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { auditar } from '../auditoria'
import { ESTADOS_NECESIDAD, TIPOS_NECESIDAD_TEXTO } from '../catalogos'
import { estaEnLinea } from '../conectividad'
import { getDB, mutate, uid } from '../store'
import { encolar } from '../sync'
import type { EstadoNecesidad, Necesidad, Prioridad, TipoNecesidad, Usuario } from '../types'
import { enLista, errorTexto, hayErrores } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_VALIDACION, exito, fallo, verificar, type Resultado } from './comun'

export interface DatosNecesidad {
  adultoId: string
  tipo: TipoNecesidad | ''
  /** Elemento del catálogo Necesidad (opcional). */
  catalogoId: string
  descripcion: string
  cantidad: string
  unidad: string
  recurrente: boolean
  prioridad: Prioridad | ''
  /** Indicación médica relacionada (opcional). */
  indicacionId: string
  visitaId?: string
}

export const DATOS_NECESIDAD_VACIOS: Omit<DatosNecesidad, 'adultoId'> = { tipo: '', catalogoId: '', descripcion: '', cantidad: '', unidad: '', recurrente: false, prioridad: '', indicacionId: '' }

/** Unidades de medida predefinidas (Env_Necesidad.Unidad_Medida). */
export const UNIDADES = ['unidades', 'tabletas', 'cajas', 'frascos', 'libras', 'canastas', 'latas', 'paquetes', 'viajes', 'horas', 'visitas']

const TIPOS = Object.keys(TIPOS_NECESIDAD_TEXTO) as TipoNecesidad[]
const ESTADOS = ESTADOS_NECESIDAD.map((e) => e.value)

export function validarNecesidad(d: DatosNecesidad) {
  return {
    adulto: d.adultoId ? undefined : 'Selecciona el adulto mayor.',
    tipo: enLista(d.tipo, TIPOS) ? undefined : 'Selecciona la categoría de la necesidad.',
    descripcion: errorTexto(d.descripcion, 'la descripción', 5, 500),
    cantidad: d.cantidad && !(Number(d.cantidad) > 0 && Number(d.cantidad) <= 10000) ? 'Indica una cantidad válida.' : undefined,
    unidad: d.cantidad && !d.unidad ? 'Selecciona la unidad.' : undefined,
    prioridad: d.prioridad && !['alta', 'media', 'baja'].includes(d.prioridad) ? 'Prioridad no válida.' : undefined,
  }
}

/** Registra una necesidad con estado inicial "pendiente". */
export async function registrarNecesidad(actor: Usuario, d: DatosNecesidad): Promise<Resultado<Necesidad>> {
  const errores = validarNecesidad(d)
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)
  const adulto = getDB().adultos.find((a) => a.id === d.adultoId && a.estado === 'activo')
  if (!adulto) return fallo(ERROR_VALIDACION, { adulto: 'Selecciona un perfil de adulto mayor válido.' })
  const denegado = verificar(actor, 'necesidades:registrar', 'necesidad', adulto)
  if (denegado) return denegado

  const ahora = new Date().toISOString()
  const necesidad: Necesidad = {
    id: uid('n'),
    adultoId: adulto.id,
    registradaPor: actor.id,
    tipo: d.tipo as TipoNecesidad,
    ...(d.catalogoId ? { catalogoId: d.catalogoId } : {}),
    descripcion: d.descripcion.trim(),
    ...(d.cantidad ? { cantidad: Number(d.cantidad), unidad: d.unidad } : {}),
    recurrente: d.recurrente,
    // Medicamentos: prioridad alta por defecto (RF-04).
    prioridad: (d.prioridad || (d.tipo === 'medicamentos' ? 'alta' : 'media')) as Prioridad,
    ...(d.indicacionId ? { indicacionId: d.indicacionId } : {}),
    estado: 'pendiente',
    creadaEn: ahora,
    historial: [{ estado: 'pendiente', fecha: ahora, usuarioId: actor.id }],
    visitaId: d.visitaId,
    actualizadoEn: ahora,
    actualizadoPor: actor.id,
  }
  if (!estaEnLinea()) {
    await encolar('necesidad', necesidad, actor)
    return exito(necesidad, true)
  }
  mutate((draft) => {
    draft.necesidades.push(necesidad)
    auditar(draft, actor, { accion: 'necesidad.crear', entidad: 'necesidad', registroId: necesidad.id, detalle: `Categoría ${TIPOS_NECESIDAD_TEXTO[necesidad.tipo]}` })
  })
  return exito(necesidad)
}

/** Cambia el estado de una necesidad (CU-08) y deja constancia en su historial. */
/**
 * Cambia el estado de una necesidad (CU-08) y deja constancia en su historial. Al resolverla (satisfecha o
 * inactiva) la nota es el motivo de resolución (Env_Necesidad.motivo_resolucion). `responsableId` permite
 * asignar o cambiar el responsable (User_responsable).
 */
export async function cambiarEstadoNecesidad(actor: Usuario, necesidadId: string, estado: EstadoNecesidad, nota = '', responsableId?: string): Promise<Resultado<Necesidad>> {
  if (!enLista(estado, ESTADOS)) return fallo('Estado no válido.')
  if (nota.length > 300) return fallo(ERROR_VALIDACION, { nota: 'Máximo 300 caracteres.' })
  const db = getDB()
  const n = db.necesidades.find((x) => x.id === necesidadId)
  if (!n) return fallo(ERROR_NO_ENCONTRADO)
  const adulto = db.adultos.find((a) => a.id === n.adultoId)
  const denegado = verificar(actor, 'necesidades:actualizar', 'necesidad', adulto, necesidadId)
  if (denegado) return denegado
  if (n.estado === estado && responsableId === undefined) return exito(n)
  if (n.estado !== estado && (estado === 'satisfecha' || estado === 'inactiva') && nota.trim().length < 3) return fallo(ERROR_VALIDACION, { nota: 'Indica el motivo de la resolución.' })

  const ahora = new Date().toISOString()
  const nueva: Necesidad = {
    ...n,
    estado,
    satisfechaEn: estado === 'satisfecha' || estado === 'inactiva' ? (n.estado === estado ? n.satisfechaEn : ahora) : undefined,
    satisfechaPor: estado === 'satisfecha' || estado === 'inactiva' ? (n.estado === estado ? n.satisfechaPor : actor.id) : undefined,
    motivoResolucion: estado === 'satisfecha' || estado === 'inactiva' ? (n.estado === estado ? n.motivoResolucion : nota.trim()) : undefined,
    responsableId: responsableId === undefined ? n.responsableId : responsableId || undefined,
    historial: n.estado === estado ? n.historial : [...n.historial, { estado, fecha: ahora, usuarioId: actor.id, ...(nota.trim() ? { nota: nota.trim() } : {}) }],
    actualizadoEn: ahora,
    actualizadoPor: actor.id,
  }
  delete nueva.pendienteSync
  if (!estaEnLinea()) {
    await encolar('necesidad', nueva, actor)
    return exito(nueva, true)
  }
  mutate((draft) => {
    const i = draft.necesidades.findIndex((x) => x.id === necesidadId)
    if (i >= 0) draft.necesidades[i] = nueva
    if (n.estado !== estado) auditar(draft, actor, { accion: 'necesidad.estado', entidad: 'necesidad', registroId: necesidadId, detalle: `${n.estado} → ${estado}` })
    if (responsableId !== undefined && (responsableId || undefined) !== n.responsableId) {
      auditar(draft, actor, { accion: 'necesidad.responsable', entidad: 'necesidad', registroId: necesidadId, detalle: responsableId ? `Responsable: ${responsableId}` : 'Sin responsable' })
    }
  })
  return exito(nueva)
}
