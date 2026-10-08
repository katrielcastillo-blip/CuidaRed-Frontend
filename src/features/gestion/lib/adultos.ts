import { mutate, uid } from '@/domain/store'
import { todayISO } from '@/domain/dates'
import type { Adulto, Alerta, Evaluacion, Familia } from '@/domain/types'
import { norm } from './formato'
import { calcularRiesgo, type Respuestas, type ResultadoRiesgo } from './riesgo'
import { ZONAS_CATALOGO } from './zonas'

/** Valores del formulario Agregar / Editar adulto mayor (todo texto, con las máscaras ya aplicadas). */
export interface AdultoFormValues {
  nombre: string
  apellido: string
  cedula: string
  fechaNacimiento: string
  telefono: string
  sexo: Adulto['sexo'] | ''
  zona: string
  contactoNombre: string
  contactoTelefono: string
}

export const FORM_VACIO: AdultoFormValues = {
  nombre: '',
  apellido: '',
  cedula: '',
  fechaNacimiento: '',
  telefono: '',
  sexo: '',
  zona: '',
  contactoNombre: '',
  contactoTelefono: '',
}

export function valoresDesdeAdulto(a: Adulto): AdultoFormValues {
  return {
    nombre: a.nombre,
    apellido: a.apellido,
    cedula: a.cedula,
    fechaNacimiento: a.fechaNacimiento,
    telefono: a.telefono,
    sexo: a.sexo,
    zona: a.zona,
    contactoNombre: a.contactoEmergencia.nombre,
    contactoTelefono: a.contactoEmergencia.telefono,
  }
}

const limpiar = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Municipio de una zona: catálogo o, si no está, el de otro adulto de esa misma zona. */
function municipioDe(zona: string, adultos: Adulto[]) {
  return ZONAS_CATALOGO.find((z) => z.zona === zona)?.municipio ?? adultos.find((a) => a.zona === zona)?.municipio ?? ''
}

/** Crea el adulto (riesgo inicial «bajo») y su familia «Flia. {Apellido}» si no existe. Devuelve su id. */
export function crearAdulto(v: AdultoFormValues, orgId: string): string {
  const id = uid('a')
  mutate((db) => {
    const apellido = limpiar(v.apellido)
    const nombreFamilia = `Flia. ${apellido}`
    let familia: Familia | undefined = db.familias.find((f) => f.orgId === orgId && norm(f.nombre) === norm(nombreFamilia))
    if (!familia) {
      familia = { id: uid('fam'), nombre: nombreFamilia, orgId }
      db.familias.push(familia)
    }
    db.adultos.push({
      id,
      orgId,
      familiaId: familia.id,
      nombre: limpiar(v.nombre),
      apellido,
      cedula: v.cedula,
      fechaNacimiento: v.fechaNacimiento,
      sexo: v.sexo === 'Masculino' ? 'Masculino' : 'Femenino',
      telefono: v.telefono,
      zona: v.zona,
      municipio: municipioDe(v.zona, db.adultos),
      contactoEmergencia: { nombre: limpiar(v.contactoNombre), telefono: v.contactoTelefono },
      riesgo: 'bajo',
      estado: 'activo',
      cuidadorIds: [],
      creadoEn: todayISO(),
    })
  })
  return id
}

export function actualizarAdulto(id: string, v: AdultoFormValues) {
  mutate((db) => {
    const a = db.adultos.find((x) => x.id === id)
    if (!a) return
    a.nombre = limpiar(v.nombre)
    a.apellido = limpiar(v.apellido)
    a.cedula = v.cedula
    a.fechaNacimiento = v.fechaNacimiento
    a.telefono = v.telefono
    a.sexo = v.sexo === 'Masculino' ? 'Masculino' : 'Femenino'
    if (a.zona !== v.zona) {
      a.zona = v.zona
      a.municipio = municipioDe(v.zona, db.adultos) || a.municipio
    }
    a.contactoEmergencia = { nombre: limpiar(v.contactoNombre), telefono: v.contactoTelefono }
  })
}

export function cambiarEstadoAdulto(id: string, estado: Adulto['estado']) {
  mutate((db) => {
    const a = db.adultos.find((x) => x.id === id)
    if (a) a.estado = estado
  })
}

/** Asigna cuidadores al adulto; a cada uno le añade la familia del adulto para que lo vea en su selector «Flia. …». */
export function asignarCuidadores(id: string, cuidadorIds: string[]) {
  mutate((db) => {
    const a = db.adultos.find((x) => x.id === id)
    if (!a) return
    a.cuidadorIds = [...cuidadorIds]
    for (const u of db.usuarios) {
      if (cuidadorIds.includes(u.id) && !u.familiaIds.includes(a.familiaId)) u.familiaIds.push(a.familiaId)
    }
  })
}

/**
 * Guarda la evaluación y el nivel de riesgo del adulto. Si el nivel es alto genera una alerta «RIESGO ALTO»
 * (si ya había una abierta para ese adulto, la renueva en lugar de duplicarla).
 */
export function guardarEvaluacion(adultoId: string, respuestas: Respuestas, evaluadoPor: string): ResultadoRiesgo {
  const resultado = calcularRiesgo(respuestas)
  const ahora = new Date().toISOString()
  mutate((db) => {
    const a = db.adultos.find((x) => x.id === adultoId)
    if (!a) return
    const evaluacion: Evaluacion = { respuestas, puntaje: resultado.puntaje, nivel: resultado.nivel, fecha: ahora, evaluadoPor }
    a.evaluacion = evaluacion
    a.riesgo = resultado.nivel
    if (resultado.nivel !== 'alto') return
    const descripcion = `La última evaluación arrojó nivel de riesgo alto (${resultado.puntaje} de 100 puntos).`
    const abierta = db.alertas.find((x) => x.adultoId === adultoId && x.categoria === 'RIESGO ALTO' && x.estado !== 'atendida')
    if (abierta) {
      abierta.descripcion = descripcion
      abierta.creadaEn = ahora
      return
    }
    const alerta: Alerta = {
      id: uid('al'),
      adultoId,
      severidad: 'alta',
      categoria: 'RIESGO ALTO',
      titulo: 'Evaluación de riesgo elevado',
      descripcion,
      creadaEn: ahora,
      estado: 'pendiente',
    }
    db.alertas.push(alerta)
  })
  return resultado
}

export interface CambiosAlerta {
  estado: Alerta['estado']
  atendidaPor?: string
  notaAtencion?: string
}

export function actualizarAlerta(id: string, cambios: CambiosAlerta) {
  mutate((db) => {
    const al = db.alertas.find((x) => x.id === id)
    if (!al) return
    al.estado = cambios.estado
    if (cambios.atendidaPor) al.atendidaPor = cambios.atendidaPor
    else delete al.atendidaPor
    const nota = cambios.notaAtencion?.trim()
    if (nota) al.notaAtencion = nota
    else delete al.notaAtencion
  })
}
