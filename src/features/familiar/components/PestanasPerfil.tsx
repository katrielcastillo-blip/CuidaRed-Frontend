/*
 * PestanasPerfil.tsx — Contenido de las pestañas del perfil del envejeciente (solo lectura): Necesidades,
 * Visitas e Indicaciones médicas. Cada una tiene su propio hook de datos (`useNecesidadesFamiliar`,
 * `useVisitasFamiliar`, `useIndicacionesFamiliar`), de modo que con la API se pide solo la pestaña abierta.
 * Los enlaces llevan `?adulto=` porque los detalles de la API cuelgan del envejeciente.
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { HeartHandshake, Repeat, Users } from 'lucide-react'
import { Badge, EmptyState } from '@/components/ui'
import { fechaCorta, hhmmA12, hora12 } from '@/domain/dates'
import { useIndicacionesFamiliar, useNecesidadesFamiliar, useVisitasFamiliar } from '../lib/datos'
import { cantidadTexto, ESTADO_NECESIDAD, ESTADO_VISITA, PRIORIDAD, TIPO_NECESIDAD } from '../lib/etiquetas'
import { ActividadCard } from './ActividadCard'
import { IndicacionesLista } from './IndicacionesLista'
import { SinDatos } from './SinDatos'

interface Props {
  adultoId: string
  /** Base de rutas del rol (`/familiar`). */
  base: string
  /** Nombre de pila, para los mensajes de estado vacío. */
  nombres: string
}

export function PestanaNecesidades({ adultoId, base, nombres }: Props) {
  const consulta = useNecesidadesFamiliar(adultoId)
  if (consulta.estado !== 'listo') return <SinDatos consulta={consulta} />
  if (consulta.datos.length === 0) return <EmptyState title="Sin necesidades" text={`${nombres} no tiene necesidades registradas.`} />
  return (
    <div className="grid-auto">
      {consulta.datos.map((n) => {
        const cantidad = cantidadTexto(n)
        return (
          <ActividadCard
            key={n.id}
            to={`${base}/necesidades/${n.id}?adulto=${adultoId}`}
            fecha={`${fechaCorta(n.creadaEn)} · ${hora12(n.creadaEn)}`}
            titulo={n.nombre ?? TIPO_NECESIDAD[n.tipo].label}
            detalle={n.descripcion}
            estado={ESTADO_NECESIDAD[n.estado]}
            pendienteSync={n.pendienteSync}
            extra={
              <>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={PRIORIDAD[n.prioridad].tono}>{PRIORIDAD[n.prioridad].label}</Badge>
                  <span className="text-muted">{TIPO_NECESIDAD[n.tipo].label}</span>
                </span>
                {(cantidad || n.recurrente) && (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {cantidad && <span>Cantidad: {cantidad}</span>}
                    {n.recurrente && (
                      <span className="inline-flex items-center gap-1">
                        <Repeat size={14} aria-hidden /> Recurrente
                      </span>
                    )}
                  </span>
                )}
                {(n.estado === 'satisfecha' || n.estado === 'inactiva') && (n.resueltaEn || n.motivoResolucion) && (
                  <span className="text-success-700">
                    {n.resueltaEn ? `Resuelta el ${fechaCorta(n.resueltaEn)}` : 'Cerrada'}
                    {n.motivoResolucion ? `: ${n.motivoResolucion}` : ''}
                  </span>
                )}
              </>
            }
          />
        )
      })}
    </div>
  )
}

export function PestanaVisitas({ adultoId, base, nombres }: Props) {
  const consulta = useVisitasFamiliar(adultoId)
  if (consulta.estado !== 'listo') return <SinDatos consulta={consulta} />
  if (consulta.datos.length === 0) return <EmptyState title="Sin visitas" text={`${nombres} aún no tiene visitas registradas.`} />
  return (
    <div className="grid-auto">
      {consulta.datos.map((v) => (
        <ActividadCard
          key={v.id}
          to={`${base}/visitas/${v.id}?adulto=${adultoId}`}
          fecha={`${fechaCorta(v.fecha)} · ${v.inicio ? hora12(v.inicio) : hhmmA12(v.horaPautada)}`}
          titulo={v.razon || v.tipo}
          detalle={v.visitante ? `Visitante: ${v.visitante}` : `Responsable: ${v.responsable}`}
          estado={ESTADO_VISITA[v.estado]}
          pendienteSync={v.pendienteSync}
          extra={
            v.compartida || v.observacion ? (
              <>
                {v.compartida && (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <Users size={14} aria-hidden /> Visita compartida con otros adultos del hogar
                  </span>
                )}
                {v.observacion && (
                  <span className="line-clamp-2">
                    <HeartHandshake size={14} className="inline -mt-0.5 mr-1 text-navy" aria-hidden />
                    <span className="font-semibold">Observación: </span>
                    {v.observacion}
                  </span>
                )}
              </>
            ) : undefined
          }
        />
      ))}
    </div>
  )
}

export function PestanaIndicaciones({ adultoId }: Pick<Props, 'adultoId'>) {
  const consulta = useIndicacionesFamiliar(adultoId)
  if (consulta.estado !== 'listo') return <SinDatos consulta={consulta} />
  return <IndicacionesLista indicaciones={consulta.datos} />
}
