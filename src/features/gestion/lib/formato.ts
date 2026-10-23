/*
 * formato.ts — Textos, máscaras y utilidades de presentación del módulo de gestión (estados, prioridades,
 * cantidades de necesidades y vigencia de indicaciones).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { ESTADOS_ALERTA, ESTADOS_NECESIDAD, TIPOS_NECESIDAD_TEXTO } from '@/domain/catalogos'
import { fechaCorta, toISODate } from '@/domain/dates'
import type { Adulto, EnvRiesgo, EstadoAlerta, EstadoNecesidad, EstadoTarea, EstadoVisita, IndicacionMedica, Necesidad, Prioridad, Riesgo, SeveridadAlerta, TipoNecesidad } from '@/domain/types'
import type { Tone } from '@/components/ui'

/** Minúsculas sin acentos: para búsquedas y comparaciones de texto. */
export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()

/** Máscara de cédula dominicana: 000-0000000-0. */
export function maskCedula(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return [d.slice(0, 3), d.slice(3, 10), d.slice(10)].filter(Boolean).join('-')
}

/** Máscara de teléfono: 000 000 0000. */
export function maskTelefono(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 10)
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ')
}

export const nombreAdulto = (a: Pick<Adulto, 'nombre' | 'apellido'>) => `${a.nombre} ${a.apellido}`.trim()

/** Fecha local YYYY-MM-DD de un ISO completo (o de una fecha ya corta). */
export const diaLocal = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : toISODate(new Date(iso)))

export const RIESGO_TEXTO: Record<Riesgo, string> = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }
export const SEVERIDAD_TEXTO: Record<SeveridadAlerta, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

export const ESTADO_ALERTA_TEXTO = Object.fromEntries(ESTADOS_ALERTA.map((e) => [e.value, e.label])) as Record<EstadoAlerta, string>
export const ESTADO_NECESIDAD_TEXTO = Object.fromEntries(ESTADOS_NECESIDAD.map((e) => [e.value, e.label])) as Record<EstadoNecesidad, string>
export const TIPO_NECESIDAD_TEXTO: Record<TipoNecesidad, string> = TIPOS_NECESIDAD_TEXTO

export const ESTADO_VISITA_TEXTO: Record<EstadoVisita, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

/** Tono del Badge según el estado (necesidades, visitas y alertas). */
export const TONO_NECESIDAD: Record<EstadoNecesidad, Tone> = { pendiente: 'danger', en_proceso: 'warning', satisfecha: 'success', inactiva: 'neutral' }
export const TONO_VISITA: Record<EstadoVisita, Tone> = { completada: 'success', pendiente: 'warning', en_curso: 'info', cancelada: 'neutral' }
export const TONO_ALERTA: Record<EstadoAlerta, Tone> = { pendiente: 'danger', en_atencion: 'warning', atendida: 'success' }

/** Necesidad aún por resolver (RF-03): pendiente o en proceso. */
export const necesidadAbierta = (estado: EstadoNecesidad) => estado === 'pendiente' || estado === 'en_proceso'

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Orden de urgencia para listas (alta primero). */
export const PESO_SEVERIDAD: Record<SeveridadAlerta, number> = { alta: 0, media: 1, baja: 2 }
export const PESO_RIESGO: Record<Riesgo, number> = { alto: 0, medio: 1, bajo: 2 }

/** Tono del Badge de prioridad (catálogo Prioridad: necesidades, alertas y tareas). */
export const TONO_PRIORIDAD: Record<Prioridad, Tone> = { alta: 'danger', media: 'warning', baja: 'info' }

/** Estados de un registro de riesgo (Env_Riesgo.Riesgo_Estado). */
export const ESTADO_RIESGO_TEXTO: Record<EnvRiesgo['estado'], string> = { vigente: 'Vigente', superado: 'Superado' }
export const TONO_RIESGO_ESTADO: Record<EnvRiesgo['estado'], Tone> = { vigente: 'warning', superado: 'neutral' }

/** Estados de una indicación médica (Indicacion_Medica.Estado). */
export const ESTADOS_INDICACION: Array<{ value: IndicacionMedica['estado']; label: string }> = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'suspendida', label: 'Suspendida' },
  { value: 'finalizada', label: 'Finalizada' },
]
export const ESTADO_INDICACION_TEXTO = Object.fromEntries(ESTADOS_INDICACION.map((e) => [e.value, e.label])) as Record<IndicacionMedica['estado'], string>
export const TONO_INDICACION: Record<IndicacionMedica['estado'], Tone> = { vigente: 'success', suspendida: 'warning', finalizada: 'neutral' }

/** Estados de una tarea de agenda (Tarea_agenda.Estado). */
export const ESTADO_TAREA_TEXTO: Record<EstadoTarea, string> = { pendiente: 'Pendiente', en_curso: 'En curso', completada: 'Completada', cancelada: 'Cancelada' }

/** "30 tabletas" (Cantidad + Unidad_Medida) o cadena vacía. */
export const cantidadTexto = (n: Pick<Necesidad, 'cantidad' | 'unidad'>) => (n.cantidad ? `${n.cantidad.toLocaleString('es-DO')} ${n.unidad ?? ''}`.trim() : '')

/** "Desde 12/08/2026 · hasta 30/09/2026" (Fecha_Inicio / Fecha_Fin). */
export const vigenciaTexto = (i: Pick<IndicacionMedica, 'fechaInicio' | 'fechaFin'>) =>
  `Desde ${fechaCorta(i.fechaInicio)}${i.fechaFin ? ` · hasta ${fechaCorta(i.fechaFin)}` : ' · sin fecha de fin'}`

/** Opciones de parentesco (PARENTESCOS) que incluyen el valor actual aunque no esté en la lista (datos antiguos). */
export const opcionesParentesco = (lista: string[], actual: string) => (!actual || lista.includes(actual) ? lista : [actual, ...lista])
