/*
 * datos.ts — Hooks de datos del Portal Familiar (solo lectura): UNO por pantalla o sección. Hoy leen el store
 * local del prototipo; con la API conectada cada hook pasará a llamar a su función de `contrato-api.ts`
 * (listarEnvejecientes, obtenerEnvejeciente, listarVisitas…) y devolverá el mismo modelo de `modelos.ts`, con
 * `cargando` y `error` reales. Las pantallas no cambian.
 *
 * Autorización (Reglas de Negocio V2 §Vínculo · Seguridad §4): el Familiar solo ve los envejecientes con
 * permiso explícito (vínculo "familiar_responsable") EN LA CUENTA ACTIVA. Todo se decide con `puede()` y
 * `adultosVisibles()` de domain/permisos: el id de la URL nunca basta. Un id ajeno o inexistente produce la
 * misma respuesta (`no_encontrado`), para no revelar si existe. Aquí tampoco se exponen riesgo, condición
 * general ni datos del visitante externo (salvo su nombre).
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { nombreCompleto, useMisCuentas, useSession, useUser } from '@/domain/auth'
import { edad, todayISO } from '@/domain/dates'
import { adultosVisibles, puede } from '@/domain/permisos'
import {
  adultosDeVisita,
  configOrg,
  contactosDe,
  cuidadoresDe,
  direccionCompleta,
  nombreContacto,
  observacionPara,
  visitaIncluye,
  voluntariosDe,
} from '@/domain/relaciones'
import { diasSinVisita, ultimaVisitaCompletada } from '@/domain/reglas'
import { useDB } from '@/domain/store'
import type { Adulto, Necesidad, NecesidadCatalogo, Usuario, Vinculo, Visita } from '@/domain/types'
import { necesidadAbierta } from './etiquetas'
import type {
  Consulta,
  ConsultaPendiente,
  CuentaActivaVista,
  EnvejecientePerfil,
  EnvejecienteTarjeta,
  EvidenciaVista,
  IndicacionVista,
  NecesidadDetalleVista,
  NecesidadVista,
  SeguimientoVista,
  VisitaDetalleVista,
  VisitaResumenVista,
} from './modelos'

/* ───────────── Utilidades internas ───────────── */

/** Misma respuesta para "no existe" y "sin permiso": no se filtra cuál de los dos casos ocurre. */
const NO_ENCONTRADO: ConsultaPendiente = { estado: 'error', tipo: 'no_encontrado', mensaje: 'No encontrado o sin permiso.' }
const listo = <T>(datos: T): Consulta<T> => ({ estado: 'listo', datos })

const nombreDe = (usuarios: Usuario[], id: string | undefined, alternativa: string) => {
  if (id === 'sistema') return 'Sistema'
  const u = usuarios.find((x) => x.id === id)
  return u ? nombreCompleto(u) : alternativa
}

const esImagen = (e: string) => e.startsWith('data:image')

/** Fecha+hora pautada de la visita como ISO local, para ordenar. */
const isoPautado = (v: Visita) => `${v.fecha}T${v.horaPautada}:00`

/** Próxima visita (programada o en curso, de hoy en adelante) que incluye al adulto. */
const proximaVisita = (visitas: Visita[], adultoId: string): Visita | undefined => {
  const hoy = todayISO()
  return visitas
    .filter((v) => visitaIncluye(v, adultoId) && (v.estado === 'pendiente' || v.estado === 'en_curso') && v.fecha >= hoy)
    .sort((a, b) => isoPautado(a).localeCompare(isoPautado(b)))[0]
}

/** Tipo de vínculo con el que el usuario accede al adulto (Tipo_vinculo), p. ej. "Familiar responsable". */
const vinculoDe = (vinculos: Vinculo[], tipos: Array<{ id: string; nombre: string }>, usuarioId: string, adultoId: string) => {
  const v = vinculos.find((x) => x.usuarioId === usuarioId && x.adultoId === adultoId && x.tipoVinculoId === 'familiar_responsable')
  return v ? (tipos.find((t) => t.id === v.tipoVinculoId)?.nombre ?? 'Familiar responsable') : undefined
}

function visitaResumen(v: Visita, adultoId: string, usuarios: Usuario[]): VisitaResumenVista {
  const realizada = v.estado === 'completada'
  const principal = v.adultoId === adultoId
  return {
    id: v.id,
    fecha: v.fecha,
    horaPautada: v.horaPautada,
    inicio: v.inicio,
    estado: v.estado,
    razon: v.razon,
    tipo: v.tipo,
    responsable: nombreDe(usuarios, v.cuidadorId, 'Sin asignar'),
    visitante: v.visitante?.nombre,
    compartida: !principal || v.detallesAdicionales.length > 0,
    estadoAdulto: realizada && principal ? v.estadoAdulto : undefined,
    observacion: realizada ? observacionPara(v, adultoId) : undefined,
    pendienteSync: v.pendienteSync,
  }
}

function necesidadVista(n: Necesidad, catalogo: NecesidadCatalogo[]): NecesidadVista {
  return {
    id: n.id,
    nombre: catalogo.find((c) => c.id === n.catalogoId)?.nombre,
    tipo: n.tipo,
    descripcion: n.descripcion,
    cantidad: n.cantidad,
    unidad: n.unidad,
    recurrente: n.recurrente,
    prioridad: n.prioridad,
    estado: n.estado,
    creadaEn: n.creadaEn,
    resueltaEn: n.satisfechaEn,
    motivoResolucion: n.motivoResolucion,
    pendienteSync: n.pendienteSync,
  }
}

/** Seguimiento del adulto (última y próxima visita, días sin contacto, necesidades abiertas). */
function seguimientoDe(adulto: Adulto, visitas: Visita[], necesidades: Necesidad[], usuarios: Usuario[], catalogo: NecesidadCatalogo[], umbral: number) {
  const { dias, conVisitas } = diasSinVisita({ visitas }, adulto)
  const ultima = ultimaVisitaCompletada(visitas, adulto.id)
  const proxima = proximaVisita(visitas, adulto.id)
  const abiertas = necesidades
    .filter((n) => n.adultoId === adulto.id && necesidadAbierta(n.estado))
    .sort((x, y) => y.creadaEn.localeCompare(x.creadaEn))
  const seguimiento: SeguimientoVista = {
    diasSinContacto: dias,
    conVisitas,
    atrasado: dias > umbral,
    ultimaVisita: ultima ? visitaResumen(ultima, adulto.id, usuarios) : undefined,
    proximaVisita: proxima ? visitaResumen(proxima, adulto.id, usuarios) : undefined,
    necesidadesAbiertasTotal: abiertas.length,
  }
  return { seguimiento, abiertas: abiertas.map((n) => necesidadVista(n, catalogo)) }
}

/** Días sin visita tras los que se considera atrasado el seguimiento (parámetro de Configuracion_Cuenta). */
function useUmbralSinVisita(): number {
  const { org } = useSession()
  const user = useUser()
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  return useMemo(() => configOrg({ catalogos, configuracion }, org?.id ?? user.orgId).diasSinVisitaAlerta, [catalogos, configuracion, org, user])
}

/** El adulto, solo si el usuario puede consultarlo en su cuenta activa (vínculo + permiso). */
function useAdultoAutorizado(adultoId: string | undefined): Adulto | undefined {
  const user = useUser()
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  return useMemo(() => {
    const a = adultos.find((x) => x.id === adultoId)
    return a && puede(user, 'adultos:ver', a, vinculos) ? a : undefined
  }, [adultos, adultoId, user, vinculos])
}

/* ───────────── Cuenta activa ───────────── */

/** Cuenta en la que actúa la persona. API: la cuenta activa de la sesión (`filter[cuenta_id]` del listado). */
export function useCuentaActivaFamiliar(): CuentaActivaVista | undefined {
  const { org } = useSession()
  const cuentas = useMisCuentas()
  return useMemo(() => (org ? { nombre: org.nombre, variasCuentas: cuentas.length > 1 } : undefined), [org, cuentas])
}

/* ───────────── Mis envejecientes ───────────── */

/**
 * Tarjetas de seguimiento de los envejecientes autorizados en la cuenta activa, primero los que llevan más
 * días sin visita. API: GET /familiar/envejecientes (paginado).
 */
export function useEnvejecientesFamiliar(): Consulta<EnvejecienteTarjeta[]> {
  const user = useUser()
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const usuarios = useDB((s) => s.usuarios)
  const tiposVinculo = useDB((s) => s.catalogos.tiposVinculo)
  const catalogoNecesidades = useDB((s) => s.catalogos.necesidades)
  const umbral = useUmbralSinVisita()

  return useMemo(() => {
    const tarjetas = adultosVisibles(user, adultos, vinculos)
      .filter((a) => a.estado === 'activo')
      .map<EnvejecienteTarjeta>((a) => {
        const { seguimiento, abiertas } = seguimientoDe(a, visitas, necesidades, usuarios, catalogoNecesidades, umbral)
        return {
          id: a.id,
          nombre: nombreCompleto(a),
          edad: edad(a.fechaNacimiento),
          vinculo: vinculoDe(vinculos, tiposVinculo, user.id, a.id),
          seguimiento,
          necesidadesAbiertas: abiertas,
        }
      })
      .sort((x, y) => y.seguimiento.diasSinContacto - x.seguimiento.diasSinContacto || x.nombre.localeCompare(y.nombre, 'es'))
    return listo(tarjetas)
  }, [user, adultos, vinculos, visitas, necesidades, usuarios, tiposVinculo, catalogoNecesidades, umbral])
}

/* ───────────── Perfil de solo lectura ───────────── */

/** Datos básicos, contactos, personal asignado y seguimiento. API: GET /familiar/envejecientes/:id. */
export function useEnvejecienteFamiliar(adultoId: string | undefined): Consulta<EnvejecientePerfil> {
  const user = useUser()
  const adulto = useAdultoAutorizado(adultoId)
  const vinculos = useDB((s) => s.vinculos)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const usuarios = useDB((s) => s.usuarios)
  const contactos = useDB((s) => s.contactos)
  const catalogos = useDB((s) => s.catalogos)
  const umbral = useUmbralSinVisita()

  return useMemo(() => {
    if (!adulto) return NO_ENCONTRADO
    const activos = (ids: string[]) =>
      ids
        .map((id) => usuarios.find((u) => u.id === id))
        .filter((u): u is Usuario => !!u && u.estado === 'activo')
        .map((u) => nombreCompleto(u))
    const { seguimiento } = seguimientoDe(adulto, visitas, necesidades, usuarios, catalogos.necesidades, umbral)
    return listo<EnvejecientePerfil>({
      id: adulto.id,
      nombre: nombreCompleto(adulto),
      edad: edad(adulto.fechaNacimiento),
      vinculo: vinculoDe(vinculos, catalogos.tiposVinculo, user.id, adulto.id),
      fechaNacimiento: adulto.fechaNacimiento,
      cedula: adulto.cedula,
      sexo: adulto.sexo,
      telefono: adulto.telefono,
      direccion: direccionCompleta(catalogos, adulto),
      registradoEn: adulto.creadoEn,
      contactos: contactosDe(contactos, adulto.id).map((c) => ({
        id: c.id,
        nombre: nombreContacto(c),
        parentesco: c.parentesco,
        telefono: c.telefono,
        principal: c.esPrincipal,
      })),
      cuidadores: activos(cuidadoresDe(vinculos, adulto.id)),
      voluntarios: activos(voluntariosDe(vinculos, adulto.id)),
      seguimiento,
      permisos: { indicaciones: puede(user, 'indicaciones:ver', adulto, vinculos) },
    })
  }, [user, adulto, vinculos, visitas, necesidades, usuarios, contactos, catalogos, umbral])
}

/* ───────────── Visitas ───────────── */

/**
 * Visitas del envejeciente (incluidas las que compartió con otros adultos del hogar), de la más reciente a la
 * más antigua. API: GET /familiar/envejecientes/:id/visitas (paginado).
 */
export function useVisitasFamiliar(adultoId: string | undefined): Consulta<VisitaResumenVista[]> {
  const user = useUser()
  const adulto = useAdultoAutorizado(adultoId)
  const vinculos = useDB((s) => s.vinculos)
  const visitas = useDB((s) => s.visitas)
  const usuarios = useDB((s) => s.usuarios)

  return useMemo(() => {
    if (!adulto || !puede(user, 'visitas:ver', adulto, vinculos)) return NO_ENCONTRADO
    return listo(
      visitas
        .filter((v) => visitaIncluye(v, adulto.id))
        .sort((a, b) => isoPautado(b).localeCompare(isoPautado(a)))
        .map((v) => visitaResumen(v, adulto.id, usuarios)),
    )
  }, [user, adulto, vinculos, visitas, usuarios])
}

/**
 * Detalle de una visita desde el punto de vista de un adulto autorizado. Sin `adultoId` se toma el primer
 * adulto autorizado de la visita; con `adultoId` debe pertenecer a la visita (igual que la ruta anidada de la
 * API). API: GET /familiar/envejecientes/:id/visitas/:visitaId.
 */
export function useVisitaFamiliar(visitaId: string | undefined, adultoId?: string): Consulta<VisitaDetalleVista> {
  const user = useUser()
  const visitas = useDB((s) => s.visitas)
  const usuarios = useDB((s) => s.usuarios)
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)

  return useMemo(() => {
    const visita = visitas.find((v) => v.id === visitaId)
    if (!visita) return NO_ENCONTRADO
    // Adultos de la visita que la familia puede consultar en la cuenta activa.
    const propios = adultosDeVisita(visita)
      .map((id) => adultos.find((a) => a.id === id))
      .filter((a): a is Adulto => !!a && puede(user, 'visitas:ver', a, vinculos))
    const adulto = adultoId ? propios.find((a) => a.id === adultoId) : propios[0]
    if (!adulto) return NO_ENCONTRADO

    const esPrincipal = visita.adultoId === adulto.id
    const evidencias: EvidenciaVista[] = esPrincipal
      ? visita.evidencias.map((e, i) => ({ clave: `${i}-${e.slice(0, 24)}`, nombre: esImagen(e) ? `Evidencia ${i + 1}` : e, imagen: esImagen(e) ? e : undefined }))
      : []
    return listo<VisitaDetalleVista>({
      ...visitaResumen(visita, adulto.id, usuarios),
      adulto: { id: adulto.id, nombre: nombreCompleto(adulto), nombres: adulto.nombre },
      esPrincipal,
      fin: visita.fin,
      checklist: visita.checklist,
      // En una visita de visitante externo las notas guardan su cédula y teléfono: no se muestran a la familia.
      notas: visita.visitante ? undefined : visita.notas,
      evidencias,
      otrosAutorizados: propios.filter((a) => a.id !== adulto.id).map((a) => ({ id: a.id, nombre: nombreCompleto(a) })),
      otrosSinAcceso: adultosDeVisita(visita).length - propios.length,
    })
  }, [user, visitas, usuarios, adultos, vinculos, visitaId, adultoId])
}

/* ───────────── Necesidades ───────────── */

/**
 * Necesidades del envejeciente: primero las abiertas y, dentro de cada grupo, las más recientes.
 * API: GET /familiar/envejecientes/:id/necesidades (paginado).
 */
export function useNecesidadesFamiliar(adultoId: string | undefined): Consulta<NecesidadVista[]> {
  const user = useUser()
  const adulto = useAdultoAutorizado(adultoId)
  const vinculos = useDB((s) => s.vinculos)
  const necesidades = useDB((s) => s.necesidades)
  const catalogo = useDB((s) => s.catalogos.necesidades)

  return useMemo(() => {
    if (!adulto || !puede(user, 'necesidades:ver', adulto, vinculos)) return NO_ENCONTRADO
    return listo(
      necesidades
        .filter((n) => n.adultoId === adulto.id)
        .sort((a, b) => Number(necesidadAbierta(b.estado)) - Number(necesidadAbierta(a.estado)) || b.creadaEn.localeCompare(a.creadaEn))
        .map((n) => necesidadVista(n, catalogo)),
    )
  }, [user, adulto, vinculos, necesidades, catalogo])
}

/**
 * Detalle de una necesidad. Con `adultoId` debe pertenecer a ese envejeciente (igual que la ruta anidada de la
 * API). API: GET /familiar/envejecientes/:id/necesidades/:necesidadId.
 */
export function useNecesidadFamiliar(necesidadId: string | undefined, adultoId?: string): Consulta<NecesidadDetalleVista> {
  const user = useUser()
  const necesidades = useDB((s) => s.necesidades)
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  const usuarios = useDB((s) => s.usuarios)
  const indicaciones = useDB((s) => s.indicaciones)
  const catalogo = useDB((s) => s.catalogos.necesidades)

  return useMemo(() => {
    const n = necesidades.find((x) => x.id === necesidadId)
    const adulto = n && adultos.find((a) => a.id === n.adultoId)
    if (!n || !adulto || (adultoId && adultoId !== adulto.id) || !puede(user, 'necesidades:ver', adulto, vinculos)) return NO_ENCONTRADO
    const relacionada = n.indicacionId && puede(user, 'indicaciones:ver', adulto, vinculos) ? indicaciones.find((i) => i.id === n.indicacionId && i.adultoId === adulto.id) : undefined
    return listo<NecesidadDetalleVista>({
      ...necesidadVista(n, catalogo),
      adulto: { id: adulto.id, nombre: nombreCompleto(adulto) },
      registradaPor: nombreDe(usuarios, n.registradaPor, 'Equipo de la cuenta'),
      resueltaPor: n.satisfechaPor ? nombreDe(usuarios, n.satisfechaPor, 'Equipo de la cuenta') : undefined,
      responsable: n.responsableId ? nombreDe(usuarios, n.responsableId, 'Equipo de la cuenta') : undefined,
      historial: [...n.historial]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map((h) => ({ estado: h.estado, fecha: h.fecha, por: nombreDe(usuarios, h.usuarioId, 'Equipo de la cuenta'), nota: h.nota })),
      indicacion: relacionada ? { id: relacionada.id, titulo: relacionada.titulo } : undefined,
    })
  }, [user, necesidades, adultos, vinculos, usuarios, indicaciones, catalogo, necesidadId, adultoId])
}

/* ───────────── Indicaciones médicas ───────────── */

/**
 * Indicaciones médicas vigentes (solo lectura; requiere `indicaciones:ver`). Se transcriben de lo indicado
 * por personal de salud. API: GET /familiar/envejecientes/:id/indicaciones?filter[estado]=vigente (paginado).
 */
export function useIndicacionesFamiliar(adultoId: string | undefined): Consulta<IndicacionVista[]> {
  const user = useUser()
  const adulto = useAdultoAutorizado(adultoId)
  const vinculos = useDB((s) => s.vinculos)
  const indicaciones = useDB((s) => s.indicaciones)
  const tipos = useDB((s) => s.catalogos.tiposIndicacion)

  return useMemo(() => {
    if (!adulto || !puede(user, 'indicaciones:ver', adulto, vinculos)) return NO_ENCONTRADO
    return listo(
      indicaciones
        .filter((i) => i.adultoId === adulto.id && i.estado === 'vigente')
        .sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))
        .map<IndicacionVista>((i) => ({
          id: i.id,
          tipo: tipos.find((t) => t.id === i.tipoIndicacionId)?.nombre ?? 'Indicación',
          titulo: i.titulo,
          descripcion: i.descripcion,
          frecuenciaHorario: i.frecuenciaHorario,
          fechaInicio: i.fechaInicio,
          fechaFin: i.fechaFin,
          estado: i.estado,
          respaldo: i.evidencia && !i.evidencia.startsWith('data:') ? i.evidencia : i.evidencia ? 'Imagen adjunta' : undefined,
        })),
    )
  }, [user, adulto, vinculos, indicaciones, tipos])
}
