/*
 * DetalleVisita.tsx — Detalle de una visita en solo lectura para el familiar responsable (CU-06): motivo
 * (Visit_razon), fechas y horas (Visit_HoraInicio/Fin), responsable (RegistroVisita), estado del adulto,
 * aspectos verificados, observación y evidencias. Una visita puede atender a varios adultos del hogar
 * (DetalleVisita): se muestra desde el punto de vista del adulto a cargo del familiar (?adulto=), con SU
 * observación (observacionPara); de los demás adultos solo se nombran los que también tiene a cargo.
 * Si ningún adulto de la visita tiene vínculo con el familiar → "No encontrado o sin permiso".
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Check, Frown, Meh, Paperclip, Smile, UserRound, Users, type LucideIcon } from 'lucide-react'
import { Page, useShell } from '@/layouts/AppShell'
import { nombreCompleto, useUser } from '@/domain/auth'
import { ASPECTOS_VISITA } from '@/domain/catalogos'
import { fechaCorta, hhmmA12, hora12 } from '@/domain/dates'
import { alcanzaAdulto, puede } from '@/domain/permisos'
import { adultosDeVisita, observacionPara } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { EstadoAdultoVisita } from '@/domain/types'
import { Badge, IconTile } from '@/components/ui'
import { cn } from '@/lib/cn'
import { NoEncontrado } from '../components/NoEncontrado'
import { ESTADO_VISITA, useAdultoPropio } from '../lib'

const ESTADOS: Array<{ value: EstadoAdultoVisita; label: string; icon: LucideIcon }> = [
  { value: 'estable', label: 'Estable', icon: Smile },
  { value: 'requiere_atencion', label: 'Requiere atención', icon: Meh },
  { value: 'situacion_critica', label: 'Situación crítica', icon: Frown },
]

const esImagen = (e: string) => e.startsWith('data:image')

export default function DetalleVisita() {
  const { visitaId } = useParams()
  const { base } = useShell()
  const user = useUser()
  const [params] = useSearchParams()
  const visitas = useDB((s) => s.visitas)
  const usuarios = useDB((s) => s.usuarios)
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  const visita = useMemo(() => visitas.find((v) => v.id === visitaId), [visitas, visitaId])
  // Adultos de la visita que el familiar tiene a cargo (Vinculo "familiar_responsable").
  const propios = useMemo(
    () =>
      visita
        ? adultosDeVisita(visita)
            .map((id) => adultos.find((a) => a.id === id))
            .filter((a) => !!a && alcanzaAdulto(user, a, vinculos))
            .map((a) => a!)
        : [],
    [visita, adultos, user, vinculos],
  )
  const pedido = params.get('adulto')
  const adulto = useAdultoPropio(propios.find((a) => a.id === pedido)?.id ?? propios[0]?.id)

  if (!visita || !adulto || !puede(user, 'visitas:ver', adulto)) return <NoEncontrado titulo="Detalle de visita" />

  const responsable = usuarios.find((u) => u.id === visita.cuidadorId)
  const estado = ESTADO_VISITA[visita.estado]
  const realizada = visita.estado === 'completada'
  const esPrincipal = visita.adultoId === adulto.id
  const observacion = observacionPara(visita, adulto.id)
  const otrosPropios = propios.filter((a) => a.id !== adulto.id)
  const otrosAjenos = visita.detallesAdicionales.length + 1 - propios.length

  return (
    <Page title="Detalle de visita" back={`${base}/adultos/${adulto.id}?tab=visitas`}>
      <Link to={`${base}/adultos/${adulto.id}`} className="flex items-center gap-4 min-h-16 rounded-md hover:bg-blue-100/50">
        <IconTile size={60}>
          <UserRound size={32} aria-hidden />
        </IconTile>
        <span className="flex flex-col min-w-0">
          <strong className="text-xl font-medium leading-tight text-ink wrap-anywhere">{nombreCompleto(adulto)}</strong>
          <span className="text-sm text-navy font-semibold">Ver perfil</span>
        </span>
      </Link>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink wrap-anywhere">{visita.razon || visita.tipo}</h2>
          <Badge tone={estado.tono}>{estado.label}</Badge>
        </div>
        {visita.razon && <p className="-mt-2 text-sm text-muted">{visita.tipo}</p>}
        {visita.pendienteSync && (
          <span>
            <Badge tone="warning">Pendiente de sincronización</Badge>
          </span>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-ink-2">
          <Meta etiqueta="Fecha" valor={fechaCorta(visita.fecha)} />
          <Meta etiqueta="Hora pautada" valor={hhmmA12(visita.horaPautada)} />
          <Meta etiqueta="Inicio" valor={visita.inicio ? hora12(visita.inicio) : '—'} />
          <Meta etiqueta="Fin" valor={visita.fin ? hora12(visita.fin) : '—'} />
          <Meta etiqueta="Responsable" valor={responsable ? nombreCompleto(responsable) : 'Sin asignar'} ancho />
        </dl>
        {(otrosPropios.length > 0 || otrosAjenos > 0) && (
          <p className="flex items-start gap-2 p-3 rounded-sm bg-surface-2 text-sm text-ink-2">
            <Users size={18} className="flex-none mt-0.5 text-navy" aria-hidden />
            <span>
              Visita compartida en el hogar.
              {otrosPropios.length > 0 && (
                <>
                  {' '}
                  También se atendió a{' '}
                  {otrosPropios.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ', '}
                      <Link to={`${base}/visitas/${visita.id}?adulto=${a.id}`} className="font-semibold text-navy underline">
                        {nombreCompleto(a)}
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
          {esPrincipal && (
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-bold text-ink">Estado durante la visita</h3>
              <ul className="grid grid-cols-3 gap-2 w-full max-w-[400px] mx-auto" aria-label="Estado del adulto mayor durante la visita">
                {ESTADOS.map((e) => {
                  const activo = visita.estadoAdulto === e.value
                  return (
                    <li
                      key={e.value}
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

          {visita.checklist.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-bold text-ink">Aspectos verificados</h3>
              <ul className="flex flex-wrap gap-2">
                {visita.checklist.map((c) => (
                  <li key={c} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-success-100 text-success-700 text-sm font-semibold">
                    <Check size={16} aria-hidden />
                    {ASPECTOS_VISITA.find((a) => a.value === c)?.label ?? c}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-3 p-4 rounded-sm bg-blue-100">
            <h3 className="text-base font-bold text-ink">Observación sobre {adulto.nombre}</h3>
            <p className="min-h-[96px] p-4 rounded-sm bg-bg text-sm text-ink-2 whitespace-pre-wrap wrap-anywhere">
              {observacion?.trim() || 'Sin observaciones.'}
            </p>
          </section>
        </>
      ) : (
        <p className="p-4 rounded-sm bg-surface-2 text-sm text-ink-2">
          {visita.estado === 'cancelada'
            ? 'Esta visita fue cancelada por la organización.'
            : 'Esta visita aún no se ha realizado. Cuando el voluntario la registre, aquí verás cómo encontró a tu familiar.'}
        </p>
      )}

      {visita.notas && (
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-bold text-ink">Indicaciones para la visita</h3>
          <p className="text-sm text-ink-2 whitespace-pre-wrap wrap-anywhere">{visita.notas}</p>
        </section>
      )}

      {esPrincipal && (
        <section aria-label="Evidencias">
          {visita.evidencias.length === 0 ? (
            <div className="flex items-center justify-between gap-3 min-h-12 px-4 rounded-sm bg-surface-2 border border-line-soft font-medium text-muted">
              <span>Sin evidencias</span>
              <Paperclip size={22} aria-hidden />
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visita.evidencias.map((e, i) => (
                <li
                  key={`${i}-${e.slice(0, 24)}`}
                  className="flex items-center gap-3 min-h-12 px-4 py-2 rounded-sm bg-surface-2 border border-line-soft text-sm text-ink-2 wrap-anywhere"
                >
                  {esImagen(e) ? (
                    <img src={e} alt={`Evidencia ${i + 1}`} className="size-14 flex-none rounded-sm object-cover" />
                  ) : (
                    <Paperclip size={20} aria-hidden />
                  )}
                  <span>{esImagen(e) ? `Evidencia ${i + 1}` : e}</span>
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
      <dt className="font-semibold">{etiqueta}:</dt>
      <dd className="whitespace-nowrap">{valor}</dd>
    </div>
  )
}
