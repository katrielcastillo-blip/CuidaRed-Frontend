import type { Adulto, Alerta, EstadoNecesidad, EstadoVisita, Riesgo, SeveridadAlerta, TipoNecesidad } from '@/domain/types'
import { toISODate } from '@/domain/dates'

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

export const cedulaValida = (v: string) => /^\d{3}-\d{7}-\d$/.test(v)
export const telefonoValido = (v: string) => v.replace(/\D/g, '').length === 10

export const nombreAdulto = (a: Pick<Adulto, 'nombre' | 'apellido'>) => `${a.nombre} ${a.apellido}`.trim()

/** Fecha local YYYY-MM-DD de un ISO completo (o de una fecha ya corta). */
export const diaLocal = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : toISODate(new Date(iso)))

export const RIESGO_TEXTO: Record<Riesgo, string> = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }
export const SEVERIDAD_TEXTO: Record<SeveridadAlerta, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }
export const ESTADO_ALERTA_TEXTO: Record<Alerta['estado'], string> = {
  pendiente: 'Pendiente',
  en_atencion: 'En atención',
  atendida: 'Atendida',
}
export const TIPO_NECESIDAD_TEXTO: Record<TipoNecesidad, string> = {
  medicamentos: 'Medicamentos',
  alimentacion: 'Alimentación',
  transporte: 'Transporte',
  compania: 'Compañía',
  otros: 'Otros',
}
export const ESTADO_NECESIDAD_TEXTO: Record<EstadoNecesidad, string> = {
  activa: 'Activa',
  inactiva: 'Inactiva',
  satisfecha: 'Satisfecha',
}
export const ESTADO_VISITA_TEXTO: Record<EstadoVisita, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Orden de severidad para listas (alta primero). */
export const PESO_SEVERIDAD: Record<SeveridadAlerta, number> = { alta: 0, media: 1, baja: 2 }
