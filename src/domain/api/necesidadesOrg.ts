/*
 * necesidadesOrg.ts — Servicios de necesidades institucionales (tabla Org_Necesidad · plan Gestión Comunitaria
 * Avanzada): necesidades de la organización que no son de un envejeciente concreto (p. ej. insumos para el centro o
 * transporte para una jornada). Solo el Administrador y el Coordinador escriben; requieren conexión.
 * Módulo: dominio · servicios (CR-186).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { auditar } from '../auditoria'
import { ESTADOS_NECESIDAD, TIPOS_NECESIDAD_TEXTO } from '../catalogos'
import { cuentaTieneFuncionalidad } from '../planes'
import { getDB, mutate, uid } from '../store'
import type { EstadoNecesidad, NecesidadOrganizacion, Organizacion, Prioridad, Rol, TipoNecesidad, Usuario } from '../types'
import { enLista, errorTexto, hayErrores } from '../validacion'
import { ERROR_NO_ENCONTRADO, ERROR_PERMISO, ERROR_VALIDACION, exito, fallo, sinConexion, verificar, type Resultado } from './comun'

export interface DatosNecesidadOrg {
  tipo: TipoNecesidad | ''
  /** Elemento del catálogo Necesidad (opcional). */
  catalogoId: string
  descripcion: string
  cantidad: string
  unidad: string
  prioridad: Prioridad | ''
  /** Usuario a cargo de gestionarla (opcional). */
  responsableId: string
}

export const DATOS_NECESIDAD_ORG_VACIOS: DatosNecesidadOrg = { tipo: '', catalogoId: '', descripcion: '', cantidad: '', unidad: '', prioridad: 'media', responsableId: '' }

const TIPOS = Object.keys(TIPOS_NECESIDAD_TEXTO) as TipoNecesidad[]
const ESTADOS = ESTADOS_NECESIDAD.map((e) => e.value)
const PRIORIDADES: Prioridad[] = ['alta', 'media', 'baja']

/** Roles que registran y actualizan necesidades institucionales. */
const ROLES_ESCRITURA: readonly Rol[] = ['admin', 'coordinador']
/** Roles que pueden ser responsables de una necesidad institucional. */
export const ROLES_RESPONSABLE_ORG: readonly Rol[] = ['admin', 'coordinador', 'cuidador']

/** ¿Puede el usuario registrar y actualizar necesidades institucionales? (permiso + rol Admin o Coordinador) */
export const puedeEscribirNecesidadesOrg = (actor: Pick<Usuario, 'rol'>, tienePermiso: boolean) => tienePermiso && ROLES_ESCRITURA.includes(actor.rol)

export function validarNecesidadOrg(d: DatosNecesidadOrg) {
  return {
    tipo: enLista(d.tipo, TIPOS) ? undefined : 'Selecciona la categoría de la necesidad.',
    descripcion: errorTexto(d.descripcion, 'la descripción', 5, 500),
    cantidad: d.cantidad && !(Number(d.cantidad) > 0 && Number(d.cantidad) <= 10000) ? 'Indica una cantidad válida.' : undefined,
    unidad: d.cantidad && !d.unidad ? 'Selecciona la unidad.' : undefined,
    prioridad: d.prioridad && !enLista(d.prioridad, PRIORIDADES) ? 'Prioridad no válida.' : undefined,
  }
}

/**
 * Comprobaciones comunes de escritura: hay conexión, el actor tiene el permiso, es Admin o Coordinador y el plan de su
 * cuenta incluye `org_necesidad`. Los intentos de otros roles quedan en auditoría como accesos denegados.
 */
function prepararEscritura(actor: Usuario, accion: 'necesidades:registrar' | 'necesidades:actualizar'): Resultado<never> | { org: Organizacion } {
  const offline = sinConexion()
  if (offline) return offline
  const denegado = verificar(actor, accion, 'necesidad')
  if (denegado) return denegado
  if (!ROLES_ESCRITURA.includes(actor.rol)) {
    mutate((db) => auditar(db, actor, { accion: 'acceso.denegado', entidad: 'necesidad', resultado: 'denegado', detalle: 'Necesidades institucionales: solo Administrador o Coordinador' }), { silencioso: true })
    return fallo(ERROR_PERMISO)
  }
  const db = getDB()
  const org = db.orgs.find((o) => o.id === actor.orgId)
  if (!org) return fallo(ERROR_NO_ENCONTRADO)
  if (!cuentaTieneFuncionalidad(db.catalogos, org, 'org_necesidad')) return fallo('Tu plan no incluye las necesidades institucionales.')
  return { org }
}

/** El responsable debe ser un miembro activo de la cuenta con un rol de gestión. */
const responsableValido = (orgId: string, id: string) => getDB().usuarios.some((u) => u.id === id && u.orgId === orgId && u.estado === 'activo' && ROLES_RESPONSABLE_ORG.includes(u.rol))

/** Registra una necesidad institucional con estado inicial «pendiente». */
export function crearNecesidadOrg(actor: Usuario, d: DatosNecesidadOrg): Resultado<NecesidadOrganizacion> {
  const previo = prepararEscritura(actor, 'necesidades:registrar')
  if (!('org' in previo)) return previo
  const { org } = previo
  const errores: Record<string, string | undefined> = {
    ...validarNecesidadOrg(d),
    catalogoId: d.catalogoId && !getDB().catalogos.necesidades.some((n) => n.id === d.catalogoId && n.tipo === d.tipo) ? 'Selecciona una necesidad de la categoría elegida.' : undefined,
    responsableId: d.responsableId && !responsableValido(org.id, d.responsableId) ? 'Selecciona un responsable válido.' : undefined,
  }
  if (hayErrores(errores)) return fallo(ERROR_VALIDACION, errores)

  const ahora = new Date().toISOString()
  const necesidad: NecesidadOrganizacion = {
    id: uid('no'),
    orgId: org.id,
    ...(d.catalogoId ? { catalogoId: d.catalogoId } : {}),
    tipo: d.tipo as TipoNecesidad,
    descripcion: d.descripcion.trim(),
    ...(d.cantidad ? { cantidad: Number(d.cantidad), unidad: d.unidad } : {}),
    prioridad: (d.prioridad || 'media') as Prioridad,
    estado: 'pendiente',
    registradaPor: actor.id,
    creadaEn: ahora,
    ...(d.responsableId ? { responsableId: d.responsableId } : {}),
    historial: [{ estado: 'pendiente', fecha: ahora, usuarioId: actor.id }],
    actualizadoEn: ahora,
  }
  mutate((draft) => {
    draft.necesidadesOrg.push(necesidad)
    auditar(draft, actor, { accion: 'necesidad.crear', entidad: 'necesidad', registroId: necesidad.id, detalle: `Necesidad institucional · ${TIPOS_NECESIDAD_TEXTO[necesidad.tipo]}` })
  })
  return exito(necesidad)
}

/**
 * Cambia el estado de una necesidad institucional y deja constancia en su historial. Al resolverla (satisfecha o
 * inactiva) la nota es el motivo de resolución y es obligatoria. `responsableId` asigna o quita el responsable.
 */
export function cambiarEstadoNecesidadOrg(actor: Usuario, necesidadId: string, estado: EstadoNecesidad, nota = '', responsableId?: string): Resultado<NecesidadOrganizacion> {
  const previo = prepararEscritura(actor, 'necesidades:actualizar')
  if (!('org' in previo)) return previo
  const { org } = previo
  if (!enLista(estado, ESTADOS)) return fallo('Estado no válido.')
  if (nota.length > 300) return fallo(ERROR_VALIDACION, { nota: 'Máximo 300 caracteres.' })
  const n = getDB().necesidadesOrg.find((x) => x.id === necesidadId && x.orgId === org.id)
  if (!n) return fallo(ERROR_NO_ENCONTRADO)
  if (n.estado === estado && responsableId === undefined) return exito(n)
  const resuelve = estado === 'satisfecha' || estado === 'inactiva'
  if (n.estado !== estado && resuelve && nota.trim().length < 3) return fallo(ERROR_VALIDACION, { nota: 'Indica el motivo de la resolución.' })
  if (responsableId && !responsableValido(org.id, responsableId)) return fallo(ERROR_VALIDACION, { responsableId: 'Selecciona un responsable válido.' })

  const ahora = new Date().toISOString()
  const cambia = n.estado !== estado
  const nueva: NecesidadOrganizacion = {
    ...n,
    estado,
    satisfechaEn: resuelve ? (cambia ? ahora : n.satisfechaEn) : undefined,
    motivoResolucion: resuelve ? (cambia ? nota.trim() : n.motivoResolucion) : undefined,
    responsableId: responsableId === undefined ? n.responsableId : responsableId || undefined,
    historial: cambia ? [...n.historial, { estado, fecha: ahora, usuarioId: actor.id, ...(nota.trim() ? { nota: nota.trim() } : {}) }] : n.historial,
    actualizadoEn: ahora,
  }
  mutate((draft) => {
    const i = draft.necesidadesOrg.findIndex((x) => x.id === necesidadId)
    if (i >= 0) draft.necesidadesOrg[i] = nueva
    if (cambia) auditar(draft, actor, { accion: 'necesidad.estado', entidad: 'necesidad', registroId: necesidadId, detalle: `Necesidad institucional: ${n.estado} → ${estado}` })
    if (responsableId !== undefined && (responsableId || undefined) !== n.responsableId) {
      auditar(draft, actor, { accion: 'necesidad.responsable', entidad: 'necesidad', registroId: necesidadId, detalle: responsableId ? `Necesidad institucional · responsable: ${responsableId}` : 'Necesidad institucional · sin responsable' })
    }
  })
  return exito(nueva)
}
