/*
 * DetalleVisita.tsx — Detalle de una visita en SOLO LECTURA para el familiar responsable (CU-06): motivo
 * (Visit_razon), fechas y horas (Visit_HoraInicio/Fin), responsable, estado del adulto, aspectos verificados,
 * observación y evidencias. Si la visita la hizo un visitante externo autorizado se muestra "Visitante: nombre"
 * (solo el nombre; sus datos de contacto no se exponen) y quién la autorizó. Una visita puede atender a varios
 * adultos del hogar: se muestra desde el punto de vista del adulto autorizado (?adulto=), con SU observación; de
 * los demás solo se nombran los que la familia también está autorizada a ver. Si ningún adulto de la visita
 * está autorizado en la cuenta activa → "No encontrado o sin permiso".
 * Los datos llegan de `useVisitaFamiliar` (hoy el store; mañana GET /familiar/envejecientes/:id/visitas/:visitaId).
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Check, Paperclip, UserRound, Users } from 'lucide-react'
import { Page, useShell } from '@/layouts/AppShell'
import { ASPECTOS_VISITA } from '@/domain/catalogos'
import { fechaCorta, hhmmA12, hora12 } from '@/domain/dates'
import { Badge, IconTile } from '@/components/ui'
import type { EstadoAdultoVisita } from '@/domain/types'
import { cn } from '@/lib/cn'
import { SinDatos } from '../components/SinDatos'
import { useVisitaFamiliar } from '../lib/datos'
import { ESTADO_ADULTO_VISITA, ESTADO_VISITA } from '../lib/etiquetas'

const TITULO = 'Detalle de visita'
const ESTADOS_ADULTO = (Object.keys(ESTADO_ADULTO_VISITA) as EstadoAdultoVisita[]).map((valor) => ({ valor, ...ESTADO_ADULTO_VISITA[valor] }))

export default function DetalleVisita() {
  const { visitaId } = useParams()
  const { base } = useShell()
  const [params] = useSearchParams()
  const consulta = useVisitaFamiliar(visitaId, params.get('adulto') ?? undefined)

  if (consulta.estado !== 'listo') return <SinDatos consulta={consulta} titulo={TITULO} />
  const v = consulta.datos
  const estado = ESTADO_VISITA[v.estado]
  const realizada = v.estado === 'completada'
  const otrosAjenos = v.otrosSinAcceso

  return (
    <Page title={TITULO} back={`${base}/adultos/${v.adulto.id}?tab=visitas`}>
      <Link to={`${base}/adultos/${v.adulto.id}`} className="flex items-center gap-4 min-h-16 rounded-md hover:bg-blue-100/50">
        <IconTile size={60}>
          <UserRound size={32} aria-hidden />
        </IconTile>
        <span className="flex flex-col min-w-0">
          <strong className="text-xl font-medium leading-tight text-ink wrap-anywhere">{v.adulto.nombre}</strong>
          <span className="text-sm text-navy font-semibold">Ver perfil</span>
        </span>
      </Link>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink wrap-anywhere">{v.razon || v.tipo}</h2>
          <Badge tone={estado.tono}>{estado.label}</Badge>
        </div>
        {v.razon && <p className="-mt-2 text-sm text-muted">{v.tipo}</p>}
        {v.pendienteSync && (
          <span>
            <Badge tone="warning">Pendiente de sincronización</Badge>
          </span>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-ink-2">
          <Meta etiqueta="Fecha" valor={fechaCorta(v.fecha)} />
          <Meta etiqueta="Hora pautada" valor={hhmmA12(v.horaPautada)} />
          <Meta etiqueta="Inicio" valor={v.inicio ? hora12(v.inicio) : '—'} />
          <Meta etiqueta="Fin" valor={v.fin ? hora12(v.fin) : '—'} />
          {v.visitante ? (
            <>
              <Meta etiqueta="Visitante" valor={v.visitante} ancho />
              <Meta etiqueta="Autorizada por" valor={v.responsable} ancho />
            </>
          ) : (
            <Meta etiqueta="Responsable" valor={v.responsable} ancho />
          )}
        </dl>
        {v.visitante && (
          <p className="flex items-start gap-2 p-3 rounded-sm bg-surface-2 text-sm text-ink-2">
            <UserRound size={18} className="flex-none mt-0.5 text-navy" aria-hidden />
            <span>Esta visita la realizó una persona externa autorizada por el equipo de la cuenta.</span>
          </p>
        )}
        {(v.otrosAutorizados.length > 0 || otrosAjenos > 0) && (
          <p className="flex items-start gap-2 p-3 rounded-sm bg-surface-2 text-sm text-ink-2">
            <Users size={18} className="flex-none mt-0.5 text-navy" aria-hidden />
            <span>
              Visita compartida en el hogar.
              {v.otrosAutorizados.length > 0 && (
                <>
                  {' '}
                  También se atendió a{' '}
                  {v.otrosAutorizados.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ', '}
                      <Link to={`${base}/visitas/${v.id}?adulto=${a.id}`} className="font-semibold text-navy underline">
                        {a.nombre}
                      </Link>
                    </span>
                  ))}
                  .
                </>
              )}
              {otrosAjenos > 0 && ` ${otrosAjenos === 1 ? 'Otro adulto' : `Otros ${otrosAjenos} adultos`} del hogar también recibieron la visita.`}
            </span>
          </p>
        )}
      </section>

      {realizada ? (
        <>
          {v.esPrincipal && (
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-bold text-ink">Estado durante la visita</h3>
              <ul className="grid grid-cols-3 gap-2 w-full max-w-[400px] mx-auto" aria-label="Estado del adulto mayor durante la visita">
                {ESTADOS_ADULTO.map((e) => {
                  const activo = v.estadoAdulto === e.valor
                  return (
                    <li
                      key={e.valor}
                      aria-current={activo ? 'true' : undefined}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1.5 min-h-[82px] p-2 rounded-sm border text-xs font-bold leading-tight text-center',
                        activo ? 'bg-[#003f9e] border-[#003f9e] text-white' : 'bg-bg border-line-soft text-muted',
                      )}
                    >
                      <e.icon size={24} aria-hidden />
                      <span>{e.label}</span>
                      {activo && <span className="sr-only">(registrado)</span>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {v.checklist.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-bold text-ink">Aspectos verificados</h3>
              <ul className="flex flex-wrap gap-2">
                {v.checklist.map((c) => (
                  <li key={c} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-success-100 text-success-700 text-sm font-semibold">
                    <Check size={16} aria-hidden />
                    {ASPECTOS_VISITA.find((a) => a.value === c)?.label ?? c}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-3 p-4 rounded-sm bg-blue-100">
            <h3 className="text-base font-bold text-ink">Observación sobre {v.adulto.nombres}</h3>
            <p className="min-h-[96px] p-4 rounded-sm bg-bg text-sm text-ink-2 whitespace-pre-wrap wrap-anywhere">{v.observacion?.trim() || 'Sin observaciones.'}</p>
          </section>
        </>
      ) : (
        <p className="p-4 rounded-sm bg-surface-2 text-sm text-ink-2">
          {v.estado === 'cancelada'
            ? 'Esta visita fue cancelada por el equipo de la cuenta.'
            : 'Esta visita aún no se ha realizado. Cuando se registre, aquí verás cómo encontraron a tu familiar.'}
        </p>
      )}

      {v.notas && (
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-bold text-ink">Indicaciones para la visita</h3>
          <p className="text-sm text-ink-2 whitespace-pre-wrap wrap-anywhere">{v.notas}</p>
        </section>
      )}

      {v.esPrincipal && (
        <section aria-label="Evidencias">
          {v.evidencias.length === 0 ? (
            <div className="flex items-center justify-between gap-3 min-h-12 px-4 rounded-sm bg-surface-2 border border-line-soft font-medium text-muted">
              <span>Sin evidencias</span>
              <Paperclip size={22} aria-hidden />
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {v.evidencias.map((e) => (
                <li key={e.clave} className="flex items-center gap-3 min-h-12 px-4 py-2 rounded-sm bg-surface-2 border border-line-soft text-sm text-ink-2 wrap-anywhere">
                  {e.imagen ? <img src={e.imagen} alt={e.nombre} className="size-14 flex-none rounded-sm object-cover" /> : <Paperclip size={20} aria-hidden />}
                  <span>{e.nombre}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Page>
  )
}

function Meta({ etiqueta, valor, ancho }: { etiqueta: string; valor: string; ancho?: boolean }) {
  return (
    <div className={cn('flex flex-wrap gap-x-1', ancho && 'col-span-2')}>
      <dt className="font-semibold">{etiqueta}:</dt> <dd className={cn(ancho ? 'wrap-anywhere' : 'whitespace-nowrap')}>{valor}</dd>
    </div>
  )
}
