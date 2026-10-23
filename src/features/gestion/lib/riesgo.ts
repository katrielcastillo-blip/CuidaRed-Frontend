/*
 * riesgo.ts — Evaluación de riesgo social: preguntas, ponderación y cálculo del nivel (bajo/medio/alto).
 * El resultado se guarda como registro de Env_Riesgo (factor "Evaluación de riesgo") desde RiesgoPage.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { Adulto, Riesgo } from '@/domain/types'

/**
 * Evaluación de riesgo: puntaje ponderado y transparente (0–100, a mayor puntaje, mayor vulnerabilidad).
 *
 *   Situación socioeconómica (máx. 30) · Condición de salud (máx. 40) · Red de apoyo (máx. 30)
 *
 *   Cada pregunta suma puntos según la respuesta (ver `SECCIONES`). Nivel resultante:
 *     0–29  → BAJO   ·   30–54 → MEDIO   ·   55–100 → ALTO
 */
export const UMBRAL_MEDIO = 30
export const UMBRAL_ALTO = 55
export const PUNTAJE_MAX = 100

export type Respuestas = Record<string, string | boolean>

export interface OpcionRiesgo {
  valor: string
  etiqueta: string
  puntos: number
}

export type Pregunta =
  | { tipo: 'switch'; clave: string; texto: string; puntosSi: number; puntosNo: number }
  | { tipo: 'select'; clave: string; texto: string; opciones: OpcionRiesgo[] }

export interface SeccionRiesgo {
  id: 'socio' | 'salud' | 'apoyo'
  titulo: string
  preguntas: Pregunta[]
}

/** Preguntas exactas del Figma («Evaluación de Riesgo»), con su ponderación. */
export const SECCIONES: SeccionRiesgo[] = [
  {
    id: 'socio',
    titulo: 'Situación Socioeconómica',
    preguntas: [
      { tipo: 'switch', clave: 'ingresosFijos', texto: '¿Cuenta con ingresos fijos?', puntosSi: 0, puntosNo: 10 },
      {
        tipo: 'select',
        clave: 'vivienda',
        texto: 'Tipo de vivienda',
        opciones: [
          { valor: 'propia', etiqueta: 'Propia', puntos: 0 },
          { valor: 'alquilada', etiqueta: 'Alquilada', puntos: 4 },
          { valor: 'cedida', etiqueta: 'Cedida o prestada', puntos: 6 },
          { valor: 'precaria', etiqueta: 'Precaria o inadecuada', puntos: 10 },
        ],
      },
      { tipo: 'switch', clave: 'viveSolo', texto: '¿Vive solo/a?', puntosSi: 10, puntosNo: 0 },
    ],
  },
  {
    id: 'salud',
    titulo: 'Condición de Salud',
    preguntas: [
      { tipo: 'switch', clave: 'cronica', texto: '¿Tiene alguna condición médica crónica?', puntosSi: 12, puntosNo: 0 },
      {
        tipo: 'select',
        clave: 'movilidad',
        texto: 'Nivel de movilidad',
        opciones: [
          { valor: 'independiente', etiqueta: 'Independiente', puntos: 0 },
          { valor: 'apoyo', etiqueta: 'Necesita apoyo (bastón o andador)', puntos: 5 },
          { valor: 'reducida', etiqueta: 'Movilidad reducida (silla de ruedas)', puntos: 10 },
          { valor: 'encamado', etiqueta: 'Postrado o encamado', puntos: 16 },
        ],
      },
      { tipo: 'switch', clave: 'medicamentos', texto: '¿Requiere medicamentos permanentes?', puntosSi: 12, puntosNo: 0 },
    ],
  },
  {
    id: 'apoyo',
    titulo: 'Red de Apoyo',
    preguntas: [
      { tipo: 'switch', clave: 'familiares', texto: '¿Tiene familiares cercanos que lo visiten regularmente?', puntosSi: 0, puntosNo: 10 },
      {
        tipo: 'select',
        clave: 'frecuencia',
        texto: 'Frecuencia de contacto familiar',
        opciones: [
          { valor: 'diaria', etiqueta: 'Diaria', puntos: 0 },
          { valor: 'semanal', etiqueta: 'Semanal', puntos: 3 },
          { valor: 'mensual', etiqueta: 'Mensual', puntos: 6 },
          { valor: 'ocasional', etiqueta: 'Ocasional', puntos: 8 },
          { valor: 'nunca', etiqueta: 'Nunca', puntos: 10 },
        ],
      },
      { tipo: 'switch', clave: 'cuidador', texto: '¿Cuenta con cuidador asignado?', puntosSi: 0, puntosNo: 10 },
    ],
  },
]

const maxPregunta = (p: Pregunta) => (p.tipo === 'switch' ? Math.max(p.puntosSi, p.puntosNo) : Math.max(...p.opciones.map((o) => o.puntos)))
export const maxSeccion = (s: SeccionRiesgo) => s.preguntas.reduce((t, p) => t + maxPregunta(p), 0)

export interface DetallePregunta {
  clave: string
  texto: string
  respuesta: string
  puntos: number
}
export interface DesgloseSeccion {
  id: SeccionRiesgo['id']
  titulo: string
  puntos: number
  max: number
  detalle: DetallePregunta[]
}
export interface ResultadoRiesgo {
  puntaje: number
  nivel: Riesgo
  desglose: DesgloseSeccion[]
}

export function nivelDesdePuntaje(puntaje: number): Riesgo {
  if (puntaje >= UMBRAL_ALTO) return 'alto'
  if (puntaje >= UMBRAL_MEDIO) return 'medio'
  return 'bajo'
}

/** Calcula puntaje, nivel y desglose por sección a partir de las respuestas. */
export function calcularRiesgo(respuestas: Respuestas): ResultadoRiesgo {
  const desglose: DesgloseSeccion[] = SECCIONES.map((s) => {
    const detalle = s.preguntas.map<DetallePregunta>((p) => {
      if (p.tipo === 'switch') {
        const si = respuestas[p.clave] === true
        return { clave: p.clave, texto: p.texto, respuesta: si ? 'Sí' : 'No', puntos: si ? p.puntosSi : p.puntosNo }
      }
      const op = p.opciones.find((o) => o.valor === respuestas[p.clave])
      return { clave: p.clave, texto: p.texto, respuesta: op?.etiqueta ?? '—', puntos: op?.puntos ?? 0 }
    })
    return { id: s.id, titulo: s.titulo, puntos: detalle.reduce((t, d) => t + d.puntos, 0), max: maxSeccion(s), detalle }
  })
  const puntaje = desglose.reduce((t, d) => t + d.puntos, 0)
  return { puntaje, nivel: nivelDesdePuntaje(puntaje), desglose }
}

/**
 * Respuestas iniciales del formulario: la evaluación previa, o valores por defecto del Figma.
 * `tieneVoluntario` (vínculo «voluntario_asignado») precarga la pregunta «¿Cuenta con cuidador asignado?».
 */
export function respuestasIniciales(adulto: Adulto, tieneVoluntario: boolean): Respuestas {
  const previas = adulto.evaluacion?.respuestas
  if (previas) return { ...previas }
  return {
    ingresosFijos: true,
    vivienda: '',
    viveSolo: false,
    cronica: true,
    movilidad: '',
    medicamentos: true,
    familiares: true,
    frecuencia: '',
    cuidador: tieneVoluntario,
  }
}

export const MENSAJE_NIVEL: Record<Riesgo, string> = {
  bajo: 'Situación estable. Mantener el seguimiento habitual.',
  medio: 'Vulnerabilidad moderada. Conviene reforzar las visitas y la red de apoyo.',
  alto: 'Vulnerabilidad alta. El sistema genera automáticamente una alerta de caso prioritario (urgencia Alta) para que el equipo de coordinación la atienda.',
}
