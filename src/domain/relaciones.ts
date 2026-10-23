/*
 * relaciones.ts — Consultas sobre las relaciones del modelo V3.0: vínculos usuario ↔ adulto, contactos de
 * emergencia, parámetros de la cuenta (Configuracion_Cuenta), ubicación (Municipio/Provincia), historial de
 * riesgos y visitas con varios adultos (DetalleVisita).
 * Módulo: dominio. Funciones puras: reciben las tablas que necesitan.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { PARAM } from './datosMaestros'
import type {
  Adulto,
  Catalogos,
  ContactoEmergencia,
  Cuidador,
  DB,
  EnvRiesgo,
  Membresia,
  Organizacion,
  Plan,
  TipoVinculo,
  Usuario,
  Vinculo,
  Visita,
} from './types'

/* ───────────── Vínculos (Vinculo + Tipo_vinculo) ───────────── */

/** Usuarios con un vínculo de cierto tipo con el adulto (p. ej. voluntarios asignados). */
export const usuariosVinculados = (vinculos: Vinculo[], adultoId: string, tipo: TipoVinculo) =>
  vinculos.filter((v) => v.adultoId === adultoId && v.tipoVinculoId === tipo).map((v) => v.usuarioId)

/** Adultos con los que el usuario tiene un vínculo de cierto tipo. */
export const adultosVinculados = (vinculos: Vinculo[], usuarioId: string, tipo: TipoVinculo) =>
  vinculos.filter((v) => v.usuarioId === usuarioId && v.tipoVinculoId === tipo).map((v) => v.adultoId)

export const voluntariosDe = (vinculos: Vinculo[], adultoId: string) => usuariosVinculados(vinculos, adultoId, 'voluntario_asignado')
export const familiaresDe = (vinculos: Vinculo[], adultoId: string) => usuariosVinculados(vinculos, adultoId, 'familiar_responsable')

export const tieneVinculo = (vinculos: Vinculo[], usuarioId: string, adultoId: string, tipo: TipoVinculo) =>
  vinculos.some((v) => v.usuarioId === usuarioId && v.adultoId === adultoId && v.tipoVinculoId === tipo)

/* ───────────── Contactos de emergencia ───────────── */

export const contactosDe = (contactos: ContactoEmergencia[], adultoId: string) =>
  contactos.filter((c) => c.adultoId === adultoId).sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal))

/** Contacto principal (o el primero registrado). */
export const contactoPrincipal = (contactos: ContactoEmergencia[], adultoId: string): ContactoEmergencia | undefined => contactosDe(contactos, adultoId)[0]

export const nombreContacto = (c: Pick<ContactoEmergencia, 'nombres' | 'apellidos'>) => `${c.nombres} ${c.apellidos}`.trim()

/* ───────────── Parámetros (Parametros + Configuracion_Cuenta) ───────────── */

/** Valor (texto) de un parámetro para la cuenta: el configurado o el valor por defecto. */
export function valorParametro(db: Pick<DB, 'catalogos' | 'configuracion'>, orgId: string | undefined, clave: string): string {
  const p = db.catalogos.parametros.find((x) => x.clave === clave)
  if (!p) return ''
  const conf = orgId ? db.configuracion.find((c) => c.orgId === orgId && c.parametroId === p.id) : undefined
  return conf?.valor ?? p.valorDefecto
}

export interface ConfigOrg {
  diasSinVisitaAlerta: number
  notificarCasosPrioritarios: boolean
  notificarNuevosVoluntarios: boolean
  diasEscalarNecesidad: number
  contactoInstitucional: { nombre: string; telefono: string }
}

/** Configuración efectiva de la cuenta, leída de sus parámetros. */
export function configOrg(db: Pick<DB, 'catalogos' | 'configuracion'>, orgId: string | undefined): ConfigOrg {
  const v = (c: string) => valorParametro(db, orgId, c)
  return {
    diasSinVisitaAlerta: Number(v(PARAM.DIAS_SIN_VISITA_ALERTA)) || 15,
    notificarCasosPrioritarios: v(PARAM.NOTIFICAR_CASOS_PRIORITARIOS) === 'true',
    notificarNuevosVoluntarios: v(PARAM.NOTIFICAR_NUEVOS_VOLUNTARIOS) === 'true',
    diasEscalarNecesidad: Number(v(PARAM.DIAS_ESCALAR_NECESIDAD)) || 7,
    contactoInstitucional: { nombre: v(PARAM.CONTACTO_INSTITUCIONAL_NOMBRE), telefono: v(PARAM.CONTACTO_INSTITUCIONAL_TELEFONO) },
  }
}

/** Escribe un parámetro en Configuracion_Cuenta (dentro de un mutate). */
export function fijarParametro(db: Pick<DB, 'catalogos' | 'configuracion'>, orgId: string, clave: string, valor: string) {
  const p = db.catalogos.parametros.find((x) => x.clave === clave)
  if (!p) return
  const ahora = new Date().toISOString()
  const c = db.configuracion.find((x) => x.orgId === orgId && x.parametroId === p.id)
  if (c) {
    c.valor = valor
    c.actualizadoEn = ahora
  } else db.configuracion.push({ orgId, parametroId: p.id, valor, actualizadoEn: ahora })
}

/* ───────────── Ubicación (Municipio / Provincia) ───────────── */

export const municipio = (cat: Pick<Catalogos, 'municipios'>, cod: string | undefined) => cat.municipios.find((m) => m.cod === cod)
export const provinciaDe = (cat: Pick<Catalogos, 'municipios' | 'provincias'>, municipioCod: string | undefined) =>
  cat.provincias.find((p) => p.cod === municipio(cat, municipioCod)?.provinciaCod)

export const nombreMunicipio = (cat: Pick<Catalogos, 'municipios'>, cod: string | undefined) => municipio(cat, cod)?.nombre ?? ''

/** "Calle 5 #12, Renacimiento, Santo Domingo de Guzmán, Distrito Nacional" (Env_Direccion + Municipio + Provincia). */
export function direccionCompleta(cat: Pick<Catalogos, 'municipios' | 'provincias'>, a: Pick<Adulto, 'direccion' | 'zona' | 'municipioCod'>) {
  return [a.direccion, a.zona, nombreMunicipio(cat, a.municipioCod), provinciaDe(cat, a.municipioCod)?.nombre].filter(Boolean).join(', ')
}

/* ───────────── Visitas con varios adultos (DetalleVisita) ───────────── */

/** ¿La visita incluye al adulto (como principal o en un detalle adicional)? */
export const visitaIncluye = (v: Visita, adultoId: string) => v.adultoId === adultoId || v.detallesAdicionales.some((d) => d.adultoId === adultoId)

/** Adultos atendidos en la visita. */
export const adultosDeVisita = (v: Visita) => [v.adultoId, ...v.detallesAdicionales.map((d) => d.adultoId)]

/** Observación registrada para un adulto concreto de la visita. */
export const observacionPara = (v: Visita, adultoId: string) =>
  v.adultoId === adultoId ? v.observaciones : v.detallesAdicionales.find((d) => d.adultoId === adultoId)?.observacion

/* ───────────── Riesgos (Env_Riesgo) ───────────── */

export const riesgosDe = (riesgos: EnvRiesgo[], adultoId: string) =>
  riesgos.filter((r) => r.adultoId === adultoId).sort((a, b) => b.fecha.localeCompare(a.fecha))

/* ───────────── Cuenta, plan, membresías y cuidadores ───────────── */

export const planDe = (cat: Pick<Catalogos, 'planes'>, org: Pick<Organizacion, 'planId'> | null | undefined): Plan | undefined =>
  cat.planes.find((p) => p.id === org?.planId)

export const membresiasDe = (membresias: Membresia[], usuarioId: string) =>
  membresias.filter((m) => m.usuarioId === usuarioId).sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))

export const cuidadorDeUsuario = (cuidadores: Cuidador[], usuarioId: string) => cuidadores.find((c) => c.usuarioId === usuarioId)

/** Uso de los límites del plan (Limite_Envejecientes, Limite_Usuarios). */
export function usoDelPlan(db: Pick<DB, 'adultos' | 'usuarios' | 'catalogos'>, org: Organizacion | null | undefined) {
  const plan = planDe(db.catalogos, org)
  const envejecientes = db.adultos.filter((a) => a.orgId === org?.id && a.estado === 'activo').length
  const usuarios = db.usuarios.filter((u) => u.orgId === org?.id && u.estado !== 'inactivo').length
  return {
    plan,
    envejecientes,
    usuarios,
    excedeEnvejecientes: !!plan && envejecientes > plan.limiteEnvejecientes,
    excedeUsuarios: !!plan && usuarios > plan.limiteUsuarios,
  }
}

/** Nombre del usuario (o "Usuario eliminado"). */
export const nombreUsuario = (usuarios: Usuario[], id: string | undefined) => {
  const u = usuarios.find((x) => x.id === id)
  return u ? `${u.nombre} ${u.apellido}`.trim() : id === 'sistema' ? 'Sistema CuidaRed' : 'Usuario eliminado'
}
