/*
 * AuditoriaUi.tsx — Piezas compartidas del registro de auditoría: textos de operación, entidad y rol,
 * insignia de resultado (color + icono) y resolución legible del registro afectado.
 * Módulo: admin · auditabilidad (SRS §8.2.2.1.3 · §8.2.2.3.4 e · §8.2.2.3.5 j).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Ban, CircleCheck, CircleX, GitMerge } from 'lucide-react'
import { ACCIONES_AUDITORIA } from '@/domain/auditoria'
import { nombreCompleto, ROL_LABEL } from '@/domain/auth'
import type { DB, EntidadAuditada, RegistroAuditoria, ResultadoAuditoria } from '@/domain/types'
import { cn } from '@/lib/cn'

export const ENTIDAD_TEXTO: Record<EntidadAuditada, string> = {
  sesion: 'Sesión',
  usuario: 'Usuario',
  adulto: 'Perfil de adulto mayor',
  visita: 'Visita',
  necesidad: 'Necesidad',
  alerta: 'Alerta',
  organizacion: 'Organización',
  sincronizacion: 'Sincronización',
  indicacion: 'Indicación médica',
  tarea: 'Tarea de agenda',
  pago: 'Plan y pagos',
}

export const RESULTADO: Record<ResultadoAuditoria, { texto: string; clase: string; Icono: typeof CircleCheck }> = {
  exito: { texto: 'Éxito', clase: 'bg-success-700 text-white', Icono: CircleCheck },
  fallo: { texto: 'Fallo', clase: 'bg-danger text-white', Icono: CircleX },
  denegado: { texto: 'Denegado', clase: 'bg-warning-700 text-white', Icono: Ban },
  conflicto: { texto: 'Conflicto', clase: 'bg-info-100 text-navy border border-blue', Icono: GitMerge },
}

export const operacionTexto = (accion: string) => ACCIONES_AUDITORIA[accion] ?? accion

export function rolAuditoriaTexto(rol: RegistroAuditoria['rol']) {
  if (rol === 'sistema') return 'Proceso automático'
  if (rol === 'anonimo') return 'Sin sesión'
  return ROL_LABEL[rol]
}

/** Insignia de resultado: color y forma (se reconoce sin leer el texto). */
export function ResultadoBadge({ resultado, className }: { resultado: ResultadoAuditoria; className?: string }) {
  const r = RESULTADO[resultado]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.02em] leading-[15px] whitespace-nowrap', r.clase, className)}>
      <r.Icono size={11} strokeWidth={3} aria-hidden />
      <span>
        <span className="sr-only">Resultado: </span>
        {r.texto}
      </span>
    </span>
  )
}

/** Nombre legible del registro afectado (sin datos sensibles); si ya no existe, se muestra su identificador. */
export function registroTexto(e: RegistroAuditoria, db: Pick<DB, 'usuarios' | 'adultos' | 'alertas' | 'visitas' | 'necesidades' | 'orgs'>): string {
  const id = e.registroId
  if (!id) return '—'
  const adultoNombre = (adultoId?: string) => {
    const a = db.adultos.find((x) => x.id === adultoId)
    return a ? (a.anonimizado ? 'Perfil anonimizado' : nombreCompleto(a)) : undefined
  }
  switch (e.entidad) {
    case 'usuario':
    case 'sesion': {
      const u = db.usuarios.find((x) => x.id === id)
      return u ? nombreCompleto(u) : id
    }
    case 'adulto':
      return adultoNombre(id) ?? id
    case 'alerta': {
      const al = db.alertas.find((x) => x.id === id)
      const n = adultoNombre(al?.adultoId)
      return al ? `${al.categoria.toLowerCase().replace(/^./, (c) => c.toUpperCase())}${n ? ` · ${n}` : ''}` : id
    }
    case 'visita': {
      const v = db.visitas.find((x) => x.id === id)
      return v ? `Visita · ${adultoNombre(v.adultoId) ?? v.adultoId}` : id
    }
    case 'necesidad': {
      const n = db.necesidades.find((x) => x.id === id)
      return n ? `Necesidad · ${adultoNombre(n.adultoId) ?? n.adultoId}` : id
    }
    case 'organizacion':
      return db.orgs.find((o) => o.id === id)?.nombre ?? id
    case 'pago':
      return db.orgs.find((o) => o.id === id)?.nombre ?? `Pago ${id}`
    default:
      return id
  }
}
