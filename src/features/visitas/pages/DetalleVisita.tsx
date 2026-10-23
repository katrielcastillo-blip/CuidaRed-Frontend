/*
 * DetalleVisita.tsx — Detalle de una visita comunitaria (CU-06 · RF-02): motivo (Visit_razon), fecha, hora
 * pautada, hora de inicio y fin (Visit_HoraInicio/Fin), responsable (RegistroVisita.User_Id), autorizada por
 * (Autorizada_por_user_Id), todos los adultos visitados con su observación (DetalleVisita), estado del adulto,
 * aspectos verificados y evidencias. Iniciar visita funciona sin conexión (RF-10).
 * El coordinador puede reasignar o cancelar visitas programadas. Familiar y administrador: solo lectura.
 * Módulo: visitas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, Check, CircleUserRound, Minus, Play, UserRoundPen } from 'lucide-react'
import { nombreCompleto, useSession } from '@/domain/auth'
import { cancelarVisita, iniciarVisita } from '@/domain/api'
import { ASPECTOS_VISITA } from '@/domain/catalogos'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, hhmmA12, hora12 } from '@/domain/dates'
import { alcanzaAdulto, puede } from '@/domain/permisos'
import { voluntariosDe } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto, Usuario, Visita } from '@/domain/types'
import { Button, Card, Datum, SelectField, Sheet, useToast } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { AdultoHeader } from '../components/AdultoHeader'
import { Caja, EstadoPunto, NoEncontrado, Panel, SyncBadge } from '../components/Comun'
import { EvidenciasLista } from '../components/EvidenciasLista'
import { ESTADO_VISITA, estadoAdulto } from '../lib/dominio'
import { reasignarVisita } from '../lib/servicios'

const TITULO = 'Detalle de visita'
const MSJ_OFFLINE = 'Guardado en el dispositivo · Pendiente de sincronización'

const RESULTADO_TONO = {
  success: 'bg-success-100 text-success-700 border-success',
  warning: 'bg-warning-100 text-warning-700 border-warning',
  danger: 'bg-danger-100 text-danger border-danger',
}

export function DetalleVisita() {
  const { visitaId } = useParams()
  const { user } = useSession()
  const visitas = useDB((s) => s.visitas)
  const adultos = useDB((s) => s.adultos)
  const visita = useMemo(() => visitas.find((v) => v.id === visitaId), [visitas, visitaId])
  const adulto = useMemo(() => adultos.find((a) => a.id === visita?.adultoId), [adultos, visita])

  if (!user) return null
  if (!visita || !adulto || !puede(user, 'visitas:ver') || !alcanzaAdulto(user, adulto)) return <NoEncontrado titulo={TITULO} />
  return <Contenido visita={visita} adulto={adulto} user={user} />
}

function Contenido({ visita, adulto, user }: { visita: Visita; adulto: Adulto; user: Usuario }) {
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const usuarios = useDB((s) => s.usuarios)
  const vinculos = useDB((s) => s.vinculos)
  const adultos = useDB((s) => s.adultos)

  const responsable = usuarios.find((u) => u.id === visita.cuidadorId)
  const autorizo = visita.autorizadaPor ? usuarios.find((u) => u.id === visita.autorizadaPor) : undefined
  const asignados = useMemo(() => new Set(voluntariosDe(vinculos, adulto.id)), [vinculos, adulto.id])
  const estado = ESTADO_VISITA[visita.estado]
  const abierta = visita.estado === 'pendiente' || visita.estado === 'en_curso'
  const puedeProgramar = puede(user, 'visitas:programar', adulto)
  // Registra quien es responsable de la visita o quien coordina (RBAC + alcance).
  const puedeRegistrar = abierta && puede(user, 'visitas:registrar', adulto) && (visita.cuidadorId === user.id || puedeProgramar)

  const [panel, setPanel] = useState<'reasignar' | 'cancelar' | null>(null)
  const [nuevoResponsable, setNuevoResponsable] = useState(visita.cuidadorId)
  const [iniciando, setIniciando] = useState(false)
  const candidatos = useMemo(
    () =>
      usuarios
        .filter((u) => (u.rol === 'voluntario' || u.rol === 'coordinador') && u.estado === 'activo' && u.orgId === user.orgId)
        .sort((a, b) => Number(asignados.has(b.id)) - Number(asignados.has(a.id)))
        .map((u) => ({
          value: u.id,
          label: `${nombreCompleto(u)}${u.rol === 'coordinador' ? ' (coordinador)' : asignados.has(u.id) ? ' · asignado' : ''}`,
        })),
    [usuarios, user.orgId, asignados],
  )

  async function iniciar() {
    if (visita.estado === 'pendiente') {
      setIniciando(true)
      const res = await iniciarVisita(user, visita.id)
      setIniciando(false)
      if (!res.ok) return toast(res.error, 'error')
      toast(res.offline ? `Visita iniciada. ${MSJ_OFFLINE}` : 'Visita iniciada', res.offline ? 'info' : 'ok')
    }
    navigate(`${base}/visitas/nueva?visita=${visita.id}`)
  }

  function reasignar() {
    const res = reasignarVisita(user, visita.id, nuevoResponsable)
    if (!res.ok) return toast(res.errores?.responsable ?? res.error, 'error')
    setPanel(null)
    toast('Visita reasignada correctamente')
  }

  function cancelar() {
    const res = cancelarVisita(user, visita.id)
    if (!res.ok) return toast(res.error, 'error')
    setPanel(null)
    toast('Visita cancelada')
  }

  const resultado = visita.estadoAdulto ? estadoAdulto(visita.estadoAdulto) : null
  const verificados = new Set(visita.checklist ?? [])

  return (
    <Page title={TITULO} back wide>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <AdultoHeader adulto={adulto} badge="final" enlace={{ to: `${base}/adultos/${adulto.id}`, texto: 'Ver perfil' }} />

          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-ink">{visita.tipo}</h2>
              <SyncBadge visible={!!visita.pendienteSync} />
            </div>
            <EstadoPunto dot={estado.dot}>{estado.label}</EstadoPunto>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Datum label="Motivo de la visita" value={visita.razon?.trim() || 'No indicado'} />
              </div>
              <Datum label="Fecha" value={fechaCorta(visita.fecha)} />
              <Datum label="Hora pautada" value={hhmmA12(visita.horaPautada)} />
              <Datum label="Hora de inicio" value={visita.inicio ? hora12(visita.inicio) : '—'} />
              <Datum label="Hora de fin" value={visita.fin ? hora12(visita.fin) : '—'} />
              {visita.fin && fechaCorta(visita.fin) !== fechaCorta(visita.fecha) && (
                <div className="col-span-2">
                  <Datum label="Registrada el" value={fechaCorta(visita.fin)} />
                </div>
              )}
              <div className="col-span-2">
                <Datum label="Responsable" value={responsable ? nombreCompleto(responsable) : 'Sin asignar'} />
              </div>
              <div className="col-span-2">
                <Datum label="Autorizada por" value={autorizo ? nombreCompleto(autorizo) : visita.autorizadaPor ? 'Usuario eliminado' : 'Sin autorización previa (visita registrada en campo)'} />
              </div>
            </div>
          </Card>

          {visita.notas && (
            <Panel titulo="Instrucciones" id="notas-titulo">
              <Caja>{visita.notas}</Caja>
            </Panel>
          )}

          {visita.estado === 'cancelada' && <p className="text-muted">Esta visita fue cancelada.</p>}
        </div>

        {visita.estado === 'completada' && (
          <div className="flex flex-col gap-6 min-w-0">
            {resultado && (
              <section className="flex flex-col gap-2" aria-labelledby="estado-adulto">
                <h3 className="text-lg font-bold text-ink" id="estado-adulto">
                  Estado del adulto
                </h3>
                <p className={cn('inline-flex items-center gap-2 w-fit min-h-10 px-4 rounded-pill border font-bold', RESULTADO_TONO[resultado.tone])}>
                  <resultado.icon size={22} aria-hidden />
                  {resultado.label}
                </p>
              </section>
            )}

            <section className="flex flex-col gap-2" aria-labelledby="checklist-titulo">
              <h3 className="text-lg font-bold text-ink" id="checklist-titulo">
                Aspectos verificados <span className="text-sm font-semibold text-muted">({verificados.size} de {ASPECTOS_VISITA.length})</span>
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 m-0 p-0 list-none">
                {ASPECTOS_VISITA.map((a) => {
                  const ok = verificados.has(a.value)
                  return (
                    <li
                      key={a.value}
                      className={cn(
                        'flex items-center gap-2 min-h-10 px-3 rounded-sm border text-sm',
                        ok ? 'bg-success-100 border-success text-success-700 font-semibold' : 'bg-bg border-line-soft text-muted',
                      )}
                    >
                      {ok ? <Check size={18} strokeWidth={3} aria-hidden /> : <Minus size={18} aria-hidden />}
                      <span>{a.label}</span>
                      <span className="sr-only">{ok ? ': verificado' : ': no verificado'}</span>
                    </li>
                  )
                })}
              </ul>
            </section>

            <Panel titulo={visita.detallesAdicionales.length > 0 ? `Adultos visitados (${visita.detallesAdicionales.length + 1})` : 'Observaciones'} id="obs-titulo">
              {visita.detallesAdicionales.length === 0 ? (
                <Caja>{visita.observaciones?.trim() || 'Sin observaciones registradas.'}</Caja>
              ) : (
                <ul className="flex flex-col gap-3 m-0 p-0 list-none">
                  <AdultoVisitado nombre={nombreCompleto(adulto)} principal observacion={visita.observaciones} />
                  {visita.detallesAdicionales.map((det) => {
                    const otro = adultos.find((a) => a.id === det.adultoId)
                    // Un adulto fuera del alcance del usuario no se identifica ni se muestra su observación (RBAC).
                    const visible = !!otro && alcanzaAdulto(user, otro)
                    return (
                      <AdultoVisitado
                        key={det.adultoId}
                        nombre={visible ? nombreCompleto(otro) : 'Otro adulto del hogar'}
                        to={visible ? `${base}/adultos/${otro.id}` : undefined}
                        observacion={visible ? det.observacion : undefined}
                        oculto={!visible}
                      />
                    )
                  })}
                </ul>
              )}
            </Panel>

            <section className="flex flex-col gap-2" aria-labelledby="evid-titulo">
              <h3 className="text-lg font-bold text-ink" id="evid-titulo">
                Evidencias
              </h3>
              {visita.evidencias.length > 0 ? <EvidenciasLista items={visita.evidencias} /> : <p className="text-muted text-sm">No se adjuntaron evidencias.</p>}
            </section>
          </div>
        )}

        {(puedeRegistrar || (abierta && puedeProgramar)) && (
          <div className="flex flex-col gap-3 min-w-0">
            {puedeRegistrar && (
              <Button variant="soft" fullWidth icon={<Play size={20} aria-hidden />} loading={iniciando} onClick={iniciar}>
                {visita.estado === 'en_curso' ? 'Continuar registro' : 'Iniciar visita'}
              </Button>
            )}
            {abierta && puedeProgramar && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button variant="outline" fullWidth disabled={!enLinea} icon={<UserRoundPen size={20} aria-hidden />} onClick={() => setPanel('reasignar')}>
                    Reasignar
                  </Button>
                  <Button variant="danger-soft" fullWidth disabled={!enLinea} icon={<Ban size={20} aria-hidden />} onClick={() => setPanel('cancelar')}>
                    Cancelar visita
                  </Button>
                </div>
                {!enLinea && <p className="text-sm text-muted">Sin conexión: reasignar o cancelar necesita internet. Iniciar la visita sí funciona sin conexión.</p>}
              </>
            )}
          </div>
        )}
      </div>

      <Sheet
        open={panel === 'reasignar'}
        onClose={() => setPanel(null)}
        title="Reasignar visita"
        footer={
          <>
            <Button variant="outline" onClick={() => setPanel(null)}>
              Cancelar
            </Button>
            <Button onClick={reasignar} disabled={nuevoResponsable === visita.cuidadorId}>
              Reasignar
            </Button>
          </>
        }
      >
        <SelectField
          label="Nuevo responsable"
          value={nuevoResponsable}
          onChange={(e) => setNuevoResponsable(e.target.value)}
          help="Si eliges un voluntario que no tiene asignado a este adulto, se le asignará para que pueda registrar la visita."
          options={candidatos}
        />
      </Sheet>

      <Sheet
        open={panel === 'cancelar'}
        onClose={() => setPanel(null)}
        title="Cancelar visita"
        footer={
          <>
            <Button variant="outline" onClick={() => setPanel(null)}>
              Volver
            </Button>
            <Button variant="danger" onClick={cancelar}>
              Cancelar visita
            </Button>
          </>
        }
      >
        <p>
          ¿Seguro que quieres cancelar la visita de <strong>{nombreCompleto(adulto)}</strong> del {fechaCorta(visita.fecha)}? Esta acción no se puede deshacer.
        </p>
      </Sheet>
    </Page>
  )
}

/** Un adulto atendido en la visita (fila de DetalleVisita) con su observación. */
function AdultoVisitado({ nombre, observacion, principal, to, oculto }: { nombre: string; observacion?: string; principal?: boolean; to?: string; oculto?: boolean }) {
  return (
    <li className="flex flex-col gap-2 p-3 rounded-sm bg-bg">
      <div className="flex flex-wrap items-center gap-2">
        <CircleUserRound size={20} className="text-blue flex-none" aria-hidden />
        {to ? (
          <Link to={to} className="inline-flex items-center min-h-12 -my-3 font-semibold text-navy underline underline-offset-4">
            {nombre}
          </Link>
        ) : (
          <span className="font-semibold text-ink">{nombre}</span>
        )}
        {principal && <span className="text-xs font-semibold text-muted">(principal)</span>}
      </div>
      <p className="text-base text-ink-2 leading-relaxed whitespace-pre-wrap wrap-anywhere">
        {oculto ? 'No tienes acceso a los datos de este adulto.' : observacion?.trim() || 'Sin observaciones registradas.'}
      </p>
    </li>
  )
}
