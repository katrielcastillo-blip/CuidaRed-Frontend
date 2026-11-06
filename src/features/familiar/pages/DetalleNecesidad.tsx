/*
 * DetalleNecesidad.tsx — Detalle de una necesidad en SOLO LECTURA para el familiar responsable (CU-08):
 * necesidad del catálogo y tipo, prioridad, cantidad y unidad, recurrencia, estado con explicación, fecha de
 * registro, responsable, resolución, descripción e historial de cambios de estado. Si tiene una indicación
 * médica relacionada (y la familia puede consultar indicaciones) la nombra con un enlace a la pestaña
 * Indicaciones del perfil. Sin acciones de edición.
 * Si es de un adulto no autorizado en la cuenta activa → "No encontrado o sin permiso".
 * Los datos llegan de `useNecesidadFamiliar` (hoy el store; mañana GET /familiar/envejecientes/:id/necesidades/:necesidadId).
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Pill } from 'lucide-react'
import { Page, useShell } from '@/layouts/AppShell'
import { fechaCorta, fechaHora, hora12 } from '@/domain/dates'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { SinDatos } from '../components/SinDatos'
import { useNecesidadFamiliar } from '../lib/datos'
import { cantidadTexto, ESTADO_NECESIDAD, PRIORIDAD, TIPO_NECESIDAD } from '../lib/etiquetas'

const TITULO = 'Detalle de necesidad'

export default function DetalleNecesidad() {
  const { necesidadId } = useParams()
  const { base } = useShell()
  const [params] = useSearchParams()
  const consulta = useNecesidadFamiliar(necesidadId, params.get('adulto') ?? undefined)

  if (consulta.estado !== 'listo') return <SinDatos consulta={consulta} titulo={TITULO} />
  const n = consulta.datos
  const tipo = TIPO_NECESIDAD[n.tipo]
  const estado = ESTADO_NECESIDAD[n.estado]
  const cantidad = cantidadTexto(n)
  const prioridad = PRIORIDAD[n.prioridad]

  return (
    <Page title={TITULO} back={`${base}/adultos/${n.adulto.id}`}>
      <div className="pt-11">
        <article className="flex flex-col px-5 pb-6 rounded-sm bg-blue-100 md:px-6">
          <span className="self-center grid place-items-center flex-none size-[88px] -mt-11 rounded-full bg-blue-100 text-blue">
            <tipo.icon size={46} strokeWidth={1.6} aria-hidden />
          </span>
          <h2 className="-mt-1 text-center text-xl font-bold text-[#1f6fd0] wrap-anywhere">{n.nombre ?? tipo.label}</h2>
          {n.nombre && <p className="text-center text-sm text-muted">{tipo.label}</p>}

          <Link
            to={`${base}/adultos/${n.adulto.id}`}
            className="flex flex-col items-center justify-center gap-1 min-h-12 mt-4 py-3 border-y border-[#8ebdec] text-center"
          >
            <strong className="text-xl font-medium text-ink wrap-anywhere">{n.adulto.nombre}</strong>
            <span className="text-sm font-semibold text-navy">Ver perfil</span>
          </Link>

          <div className="flex flex-col gap-2 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('size-2.5 rounded-full flex-none', estado.punto)} aria-hidden />
              <span className="font-bold text-ink">Estado:</span>
              <Badge tone={estado.tono}>{estado.label}</Badge>
              {n.pendienteSync && <Badge tone="warning">Pendiente de sincronización</Badge>}
            </div>
            <p className="text-sm text-ink-2">{estado.explicacion}</p>
            <p className="text-sm text-ink-2">
              Registrada el {fechaCorta(n.creadaEn)} a las {hora12(n.creadaEn)} por {n.registradaPor}
            </p>
            {n.estado === 'satisfecha' && n.resueltaEn && (
              <p className="text-sm text-ink-2">
                Satisfecha el {fechaCorta(n.resueltaEn)}
                {n.resueltaPor ? ` · ${n.resueltaPor}` : ''}
              </p>
            )}
            {n.motivoResolucion && (n.estado === 'satisfecha' || n.estado === 'inactiva') && (
              <p className="text-sm text-success-700 font-semibold wrap-anywhere">Resolución: {n.motivoResolucion}</p>
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
                <dd className="font-bold text-ink">{n.recurrente ? 'Sí, se repite' : 'No'}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted">Responsable</dt>
                <dd className="font-bold text-ink wrap-anywhere">{n.responsable ?? 'El equipo de la cuenta'}</dd>
              </div>
            </dl>

            {n.indicacion && (
              <Link
                to={`${base}/adultos/${n.adulto.id}?tab=indicaciones`}
                className="flex items-center gap-3 min-h-12 mt-1 px-3 py-2 rounded-sm bg-bg border border-line-soft text-sm text-ink-2"
              >
                <Pill size={20} className="flex-none text-blue" aria-hidden />
                <span className="flex flex-col min-w-0">
                  <span className="text-xs text-muted">Indicación médica relacionada</span>
                  <strong className="text-ink wrap-anywhere">{n.indicacion.titulo}</strong>
                </span>
              </Link>
            )}

            <h3 className="mt-3 text-base font-bold text-ink">Descripción</h3>
            <p className="min-h-[96px] p-4 rounded-sm bg-bg text-sm text-ink-2 whitespace-pre-wrap wrap-anywhere">{n.descripcion.trim() || 'Sin descripción.'}</p>
          </div>
        </article>
      </div>

      {n.historial.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="historial-necesidad">
          <h3 id="historial-necesidad" className="text-base font-bold text-ink">
            Historial de estados
          </h3>
          <ol className="flex flex-col border-l-2 border-line-soft ml-2">
            {n.historial.map((h, i) => (
              <li key={`${h.fecha}-${i}`} className="relative flex flex-col gap-0.5 pl-5 pb-4 last:pb-0">
                <span className={cn('absolute -left-[7px] top-1 size-3 rounded-full ring-2 ring-bg', ESTADO_NECESIDAD[h.estado].punto)} aria-hidden />
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={ESTADO_NECESIDAD[h.estado].tono}>{ESTADO_NECESIDAD[h.estado].label}</Badge>
                  <span className="text-xs text-muted">{fechaHora(h.fecha)}</span>
                </span>
                <span className="text-sm text-ink-2">{h.por}</span>
                {h.nota && <span className="text-sm text-ink-2 wrap-anywhere">{h.nota}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </Page>
  )
}
