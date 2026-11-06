/*
 * SolicitudDetallePage.tsx — Detalle de una solicitud de visita: datos del visitante y su motivo, y la decisión de
 * un usuario principal (visitas:autorizar): autorizar confirmando adulto, fecha y hora, o rechazar con un motivo
 * que verá el visitante. Tras decidir, muestra el resultado y recuerda que el visitante lo consulta con su código.
 * Módulo: coordinador · solicitudes de visita.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Ban, CalendarDays, CircleCheck, Mail, Phone, Send } from 'lucide-react'
import { Avatar, Badge, Button, ButtonLink, Card, Datum, EmptyState, SuccessOverlay } from '@/components/ui'
import { ESTADO_SOLICITUD } from '@/domain/api/solicitudes'
import { nombreCompleto } from '@/domain/auth'
import { fechaCorta, fechaHora } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { horaPautada12 } from '../lib/datos'
import { AutorizarForm } from './components/AutorizarForm'
import { RechazarForm } from './components/RechazarForm'
import { cuandoRecibida, nombreVisitante, TONO_SOLICITUD, useSolicitudes } from './lib/solicitudes'

type Modo = 'autorizar' | 'rechazar' | null
interface Exito {
  mensaje: string
  detalle: ReactNode
  icono?: ReactNode
}

// Objetivo táctil de 48 px (min-h-12) sin ensanchar la fila: el margen negativo compensa el alto extra.
const ENLACE = 'inline-flex items-center gap-2 min-h-12 -my-3 font-bold text-navy hover:underline wrap-anywhere'

export function SolicitudDetallePage() {
  const { solicitudId = '' } = useParams()
  const { base } = useShell()
  const { user, solicitudes, adultosActivos, adultoPorId, nombreDe } = useSolicitudes()
  const visitas = useDB((s) => s.visitas)
  const [modo, setModo] = useState<Modo>(null)
  const [exito, setExito] = useState<Exito | null>(null)
  const decision = useRef<HTMLDivElement>(null)

  // Al elegir autorizar o rechazar, el formulario queda a la vista (en móvil está bajo los datos).
  useEffect(() => {
    if (!modo) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    decision.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }, [modo])

  const volver = `${base}/solicitudes`
  const s = solicitudes.find((x) => x.id === solicitudId)

  if (!s) {
    return (
      <Page title="Solicitud de visita" back={volver}>
        <EmptyState
          title="No encontramos esta solicitud"
          text="Puede que ya no exista o que pertenezca a otra cuenta."
          action={
            <ButtonLink to={volver} variant="outline">
              Volver a las solicitudes
            </ButtonLink>
          }
        />
      </Page>
    )
  }

  const nombre = nombreVisitante(s)
  const adulto = s.adultoId ? adultoPorId.get(s.adultoId) : undefined
  const visita = s.visitaId ? visitas.find((v) => v.id === s.visitaId) : undefined
  const pendiente = s.estado === 'pendiente'

  const autorizada = (a: Adulto) => {
    setModo(null)
    setExito({
      mensaje: '¡Visita autorizada!',
      detalle: (
        <>
          <p>
            {nombre} · {nombreCompleto(a)}
          </p>
          <p className="mt-2 font-semibold">El visitante verá el resultado con su código de seguimiento.</p>
        </>
      ),
    })
  }
  const rechazada = () => {
    setModo(null)
    setExito({
      mensaje: 'Respuesta enviada',
      detalle: <p>El visitante verá el motivo con su código de seguimiento.</p>,
      icono: <Send size={56} strokeWidth={1.6} aria-hidden />,
    })
  }

  return (
    <Page title="Solicitud de visita" back={volver} wide>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-8 lg:items-start">
        {/* ───── Datos del visitante y de la visita pedida ───── */}
        <div className="flex flex-col gap-5 min-w-0">
          <Card padded={false} className="flex items-center gap-4 p-5">
            <Avatar nombre={nombre} size={56} />
            <div className="flex flex-col flex-1 min-w-0 gap-1">
              <h2 className="text-xl font-bold leading-snug text-ink wrap-anywhere">{nombre}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={TONO_SOLICITUD[s.estado]}>{ESTADO_SOLICITUD[s.estado]}</Badge>
                <span className="text-sm text-muted">Recibida {cuandoRecibida(s.creadaEn)}</span>
              </div>
            </div>
          </Card>

          <Bloque id="sol-visitante" titulo="Datos del visitante">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Datum label="Cédula" value={s.visitante.cedula} />
              <Datum
                label="Teléfono"
                value={
                  <a href={`tel:${s.visitante.telefono.replace(/\s+/g, '')}`} className={ENLACE}>
                    <Phone size={18} className="flex-none" aria-hidden />
                    {s.visitante.telefono}
                  </a>
                }
              />
              {s.visitante.correo && (
                <Datum
                  label="Correo electrónico"
                  value={
                    <a href={`mailto:${s.visitante.correo}`} className={ENLACE}>
                      <Mail size={18} className="flex-none" aria-hidden />
                      {s.visitante.correo}
                    </a>
                  }
                />
              )}
            </div>
          </Bloque>

          <Bloque id="sol-visita" titulo="Visita solicitada">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Datum label="Quiere visitar a" value={s.personaAVisitar} />
              <Datum
                label="Fecha y hora propuestas"
                value={
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays size={18} className="flex-none text-navy" aria-hidden />
                    {fechaCorta(s.fechaPropuesta)} · {horaPautada12(s.horaPropuesta)}
                  </span>
                }
              />
            </div>
            <div className="flex flex-col gap-1 pt-1">
              <span className="text-xs text-ink">Motivo de la visita</span>
              <p className="text-base leading-normal text-ink wrap-anywhere">{s.motivo}</p>
            </div>
          </Bloque>
        </div>

        {/* ───── Decisión o resultado ───── */}
        <div ref={decision} className="flex flex-col gap-4 min-w-0 scroll-mt-4 lg:sticky lg:top-6">
          {pendiente ? (
            <Card padded={false} role="region" aria-labelledby="sol-decision" className="flex flex-col gap-4 p-5">
              <h2 id="sol-decision" className="text-xl font-bold text-ink">
                {modo === 'autorizar' ? 'Autorizar la visita' : modo === 'rechazar' ? 'No autorizar la visita' : 'Tu decisión'}
              </h2>
              {modo === null && (
                <>
                  <p className="text-sm text-ink-2">
                    Revisa los datos. Si autorizas, confirmarás a qué adulto mayor corresponde y se programará la visita; si no, el visitante verá el motivo que escribas.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Button fullWidth icon={<CircleCheck size={22} aria-hidden />} onClick={() => setModo('autorizar')}>
                      Autorizar visita
                    </Button>
                    <Button variant="danger-soft" fullWidth icon={<Ban size={22} aria-hidden />} onClick={() => setModo('rechazar')}>
                      No autorizar
                    </Button>
                  </div>
                </>
              )}
              {modo === 'autorizar' && (
                <AutorizarForm solicitud={s} user={user} adultos={adultosActivos} onCancelar={() => setModo(null)} onAutorizada={autorizada} />
              )}
              {modo === 'rechazar' && <RechazarForm solicitud={s} user={user} onCancelar={() => setModo(null)} onRechazada={rechazada} />}
            </Card>
          ) : (
            <Card padded={false} role="region" aria-labelledby="sol-resultado" className="flex flex-col gap-4 p-5">
              <h2 id="sol-resultado" className="text-xl font-bold text-ink">
                Resultado de la revisión
              </h2>
              <dl className="flex flex-col gap-3 m-0">
                {s.revisadaPor && (
                  <Fila etiqueta={s.estado === 'rechazada' ? 'No autorizada por' : 'Autorizada por'}>
                    {nombreDe(s.revisadaPor)}
                    {s.revisadaEn && <span className="font-normal text-muted"> · {fechaHora(s.revisadaEn)}</span>}
                  </Fila>
                )}
                {s.estado === 'rechazada' && s.motivoRechazo && <Fila etiqueta="Motivo que ve el visitante">{s.motivoRechazo}</Fila>}
                {s.adultoId && (
                  <Fila etiqueta="Adulto mayor confirmado">
                    {adulto ? (
                      <Link to={`${base}/adultos/${adulto.id}`} className={ENLACE}>
                        {nombreCompleto(adulto)} <ArrowRight size={16} aria-hidden />
                      </Link>
                    ) : (
                      'Adulto mayor'
                    )}
                  </Fila>
                )}
                {visita && (
                  <Fila etiqueta="Visita programada">
                    <Link to={`${base}/visitas/${visita.id}`} className={ENLACE}>
                      {fechaCorta(visita.fecha)} · {horaPautada12(visita.horaPautada)} <ArrowRight size={16} aria-hidden />
                    </Link>
                  </Fila>
                )}
                {s.estado === 'realizada' && s.observacion && (
                  <Fila etiqueta="Observación del visitante">
                    {s.observacion}
                    {s.observacionEn && <span className="font-normal text-muted"> · {fechaHora(s.observacionEn)}</span>}
                  </Fila>
                )}
              </dl>
              <p className="flex items-start gap-2 p-3 rounded-sm bg-blue-100 border border-blue text-sm text-ink-2">
                <Send size={18} className="flex-none mt-0.5 text-navy" aria-hidden />
                <span>El visitante ve este resultado en la página de bienvenida con su código de seguimiento.</span>
              </p>
              <ButtonLink to={volver} variant="outline" fullWidth>
                Volver a las solicitudes
              </ButtonLink>
            </Card>
          )}
        </div>
      </div>

      <SuccessOverlay open={exito !== null} message={exito?.mensaje ?? ''} detail={exito?.detalle} icon={exito?.icono} onDone={() => setExito(null)} />
    </Page>
  )
}

function Bloque({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <Card padded={false} role="region" aria-labelledby={id} className="flex flex-col gap-4 p-5">
      <h2 id={id} className="text-lg font-bold text-ink">
        {titulo}
      </h2>
      {children}
    </Card>
  )
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-xs text-ink">{etiqueta}</dt>
      <dd className="m-0 text-base font-bold text-ink wrap-anywhere">{children}</dd>
    </div>
  )
}
