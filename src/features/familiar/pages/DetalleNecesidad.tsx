/*
 * DetalleNecesidad.tsx — Detalle de una necesidad en solo lectura para el familiar responsable (CU-08):
 * necesidad del catálogo y tipo, prioridad (Prioridad_Id), cantidad y unidad, recurrencia (es_recurrente),
 * estado con explicación, fecha de registro, persona responsable (User_responsable), resolución
 * (Fecha_resolucion + motivo_resolucion), descripción e historial de cambios de estado. No muestra la
 * indicación médica relacionada (el familiar no tiene "indicaciones:ver").
 * Si es de un adulto de otro grupo familiar → "No encontrado o sin permiso" (alcanzaAdulto).
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Page, useShell } from '@/layouts/AppShell'
import { nombreCompleto, useUser } from '@/domain/auth'
import { fechaCorta, fechaHora, hora12 } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { NoEncontrado } from '../components/NoEncontrado'
import { cantidadTexto, ESTADO_NECESIDAD, PRIORIDAD, TIPO_NECESIDAD, useAdultoPropio } from '../lib'

export default function DetalleNecesidad() {
  const { necesidadId } = useParams()
  const { base } = useShell()
  const user = useUser()
  const necesidades = useDB((s) => s.necesidades)
  const usuarios = useDB((s) => s.usuarios)
  const catalogo = useDB((s) => s.catalogos.necesidades)
  const necesidad = useMemo(() => necesidades.find((n) => n.id === necesidadId), [necesidades, necesidadId])
  const adulto = useAdultoPropio(necesidad?.adultoId)

  if (!necesidad || !adulto || !puede(user, 'necesidades:ver', adulto)) return <NoEncontrado titulo="Detalle de necesidad" />

  const tipo = TIPO_NECESIDAD[necesidad.tipo]
  const estado = ESTADO_NECESIDAD[necesidad.estado]
  const nombreDe = (id?: string) => {
    if (id === 'sistema') return 'Sistema'
    const u = usuarios.find((x) => x.id === id)
    return u ? nombreCompleto(u) : 'Equipo de la organización'
  }
  const historial = [...necesidad.historial].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const nombreCatalogo = catalogo.find((c) => c.id === necesidad.catalogoId)?.nombre
  const cantidad = cantidadTexto(necesidad)
  const prioridad = PRIORIDAD[necesidad.prioridad]

  return (
    <Page title="Detalle de necesidad" back={`${base}/adultos/${adulto.id}`}>
      <div className="pt-11">
        <article className="flex flex-col px-5 pb-6 rounded-sm bg-blue-100 md:px-6">
          <span className="self-center grid place-items-center flex-none size-[88px] -mt-11 rounded-full bg-blue-100 text-blue">
            <tipo.icon size={46} strokeWidth={1.6} aria-hidden />
          </span>
          <h2 className="-mt-1 text-center text-xl font-bold text-[#1f6fd0] wrap-anywhere">{nombreCatalogo ?? tipo.label}</h2>
          {nombreCatalogo && <p className="text-center text-sm text-muted">{tipo.label}</p>}

          <Link
            to={`${base}/adultos/${adulto.id}`}
            className="flex flex-col items-center justify-center gap-1 min-h-12 mt-4 py-3 border-y border-[#8ebdec] text-center"
          >
            <strong className="text-xl font-medium text-ink wrap-anywhere">{nombreCompleto(adulto)}</strong>
            <span className="text-sm font-semibold text-navy">Ver perfil</span>
          </Link>

          <div className="flex flex-col gap-2 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('size-2.5 rounded-full flex-none', estado.punto)} aria-hidden />
              <span className="font-bold text-ink">Estado:</span>
              <Badge tone={estado.tono}>{estado.label}</Badge>
              {necesidad.pendienteSync && <Badge tone="warning">Pendiente de sincronización</Badge>}
            </div>
            <p className="text-sm text-ink-2">{estado.explicacion}</p>
            <p className="text-sm text-ink-2">
              Registrada el {fechaCorta(necesidad.creadaEn)} a las {hora12(necesidad.creadaEn)} por {nombreDe(necesidad.registradaPor)}
            </p>
            {necesidad.estado === 'satisfecha' && necesidad.satisfechaEn && (
              <p className="text-sm text-ink-2">
                Satisfecha el {fechaCorta(necesidad.satisfechaEn)} · {nombreDe(necesidad.satisfechaPor)}
              </p>
            )}
            {necesidad.motivoResolucion && (necesidad.estado === 'satisfecha' || necesidad.estado === 'inactiva') && (
              <p className="text-sm text-success-700 font-semibold wrap-anywhere">Resolución: {necesidad.motivoResolucion}</p>
            )}

            <dl className="grid grid-cols-2 gap-3 mt-2 p-3 rounded-sm bg-bg text-sm">
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted">Prioridad</dt>
                <dd>
                  <Badge tone={prioridad.tono}>{prioridad.label.replace('Prioridad ', '')}</Badge>
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted">Cantidad</dt>
                <dd className="font-bold text-ink">{cantidad ?? 'No aplica'}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted">Recurrente</dt>
                <dd className="font-bold text-ink">{necesidad.recurrente ? 'Sí, se repite' : 'No'}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted">Responsable</dt>
                <dd className="font-bold text-ink wrap-anywhere">{necesidad.responsableId ? nombreDe(necesidad.responsableId) : 'La organización'}</dd>
              </div>
            </dl>

            <h3 className="mt-3 text-base font-bold text-ink">Descripción</h3>
            <p className="min-h-[96px] p-4 rounded-sm bg-bg text-sm text-ink-2 whitespace-pre-wrap wrap-anywhere">
              {necesidad.descripcion.trim() || 'Sin descripción.'}
            </p>
          </div>
        </article>
      </div>

      {historial.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="historial-necesidad">
          <h3 id="historial-necesidad" className="text-base font-bold text-ink">
            Historial de estados
          </h3>
          <ol className="flex flex-col border-l-2 border-line-soft ml-2">
            {historial.map((h, i) => (
              <li key={`${h.fecha}-${i}`} className="relative flex flex-col gap-0.5 pl-5 pb-4 last:pb-0">
                <span className={cn('absolute -left-[7px] top-1 size-3 rounded-full ring-2 ring-bg', ESTADO_NECESIDAD[h.estado].punto)} aria-hidden />
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={ESTADO_NECESIDAD[h.estado].tono}>{ESTADO_NECESIDAD[h.estado].label}</Badge>
                  <span className="text-xs text-muted">{fechaHora(h.fecha)}</span>
                </span>
                <span className="text-sm text-ink-2">{nombreDe(h.usuarioId)}</span>
                {h.nota && <span className="text-sm text-ink-2 wrap-anywhere">{h.nota}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </Page>
  )
}
