/*
 * AlertaDetallePage.tsx — Detalle y gestión de una alerta (CU-09 paso 4 · CU-10), tabla AlertaEnvejeciente:
 * tipo (Alert_Id → catálogo Alertas), prioridad (Prioridad_Id → catálogo Prioridad), Descripcion, Alert_Fecha,
 * Estado, Fecha_Atencion, Accion_tomada y Atentida_por_user_Id; además, adulto, condiciones que la originaron,
 * quién la generó, necesidad relacionada (alertas "NECESIDAD ATRASADA"), historial de acciones y registro de la
 * acción tomada con cambio de estado (gestionarAlerta; nota obligatoria al marcarla atendida). Al abrirla se
 * marca como leída para el usuario (marcarLeidas).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarCheck2, CalendarPlus, Clock, Cpu, HandHelping, ListChecks, MapPin, MessageSquareText, Tag, UserCheck, UserRound, UsersRound } from 'lucide-react'
import { Badge, Button, ButtonLink, ChoicePills, IconTile, RiesgoBadge, TextareaField, useToast } from '@/components/ui'
import { alertasVisibles, gestionarAlerta, marcarLeidas } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { ESTADOS_ALERTA } from '@/domain/catalogos'
import { useEnLinea } from '@/domain/conectividad'
import { fechaHora } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import type { Adulto, Alerta, EstadoAlerta } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { EstadoAlertaBadge, NoEncontrado, NotaInfo, UrgenciaBadge, URGENCIA_VISUAL } from '../components/Piezas'
import { autorAlerta, necesidadDeAlerta, nombreCatalogo, nombreUsuario } from '../lib/datos'
import { cantidadTexto, ESTADO_ALERTA_TEXTO, ESTADO_NECESIDAD_TEXTO, nombreAdulto, TIPO_NECESIDAD_TEXTO, TONO_NECESIDAD } from '../lib/formato'
import { ubicacionCorta } from '../lib/ubicacion'
import { useVolver } from '../lib/navegacion'

export default function AlertaDetallePage() {
  const { alertaId } = useParams()
  const { base } = useShell()
  const user = useUser()
  const alertas = useDB((s) => s.alertas)
  const adultos = useDB((s) => s.adultos)
  // Alcance (RF-09): solo alertas de adultos que el usuario puede consultar.
  const alerta = useMemo(() => alertasVisibles({ alertas, adultos }, user).find((a) => a.id === alertaId), [alertas, adultos, user, alertaId])
  const adulto = useMemo(() => adultos.find((a) => a.id === alerta?.adultoId), [adultos, alerta?.adultoId])

  if (!alerta || !adulto) {
    return (
      <Page title="Detalle de alerta" back={`${base}/alertas`} hideAvatar>
        <NoEncontrado volverA={`${base}/alertas`} que="esta alerta" textoVolver="Volver a Alertas" />
      </Page>
    )
  }
  return <Detalle key={alerta.id} alerta={alerta} adulto={adulto} />
}

const PUNTO: Record<EstadoAlerta, string> = { pendiente: 'bg-danger', en_atencion: 'bg-warning', atendida: 'bg-success-700' }

function Fila({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-line-soft last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="inline-flex items-center gap-2 text-sm text-muted flex-none">
        {icono} {etiqueta}
      </dt>
      <dd className="text-sm font-semibold text-ink sm:text-right min-w-0 wrap-anywhere">{children}</dd>
    </div>
  )
}

function Detalle({ alerta, adulto }: { alerta: Alerta; adulto: Adulto }) {
  const { base } = useShell()
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const { back } = useVolver(`${base}/alertas`)
  const usuarios = useDB((s) => s.usuarios)
  const necesidades = useDB((s) => s.necesidades)
  const catalogos = useDB((s) => s.catalogos)
  const necesidad = useMemo(() => necesidadDeAlerta(alerta, necesidades), [alerta, necesidades])
  const tipoCat = catalogos.alertas.find((t) => t.id === alerta.tipo)
  const [estado, setEstado] = useState<EstadoAlerta>(alerta.estado)
  const [nota, setNota] = useState('')
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})

  const gestiona = puede(user, 'alertas:gestionar', adulto)
  const programa = puede(user, 'visitas:programar', adulto)
  const v = URGENCIA_VISUAL[alerta.severidad]

  // Al abrir el detalle la notificación queda leída para este usuario.
  useEffect(() => {
    marcarLeidas(user, [alerta.id])
  }, [user, alerta.id])

  const historial = useMemo(
    () => [
      { id: 'creada', fecha: alerta.creadaEn, usuarioId: alerta.generadaPor, estado: 'pendiente' as EstadoAlerta, nota: alerta.generadaPor === 'sistema' ? 'Alerta generada automáticamente al cumplirse las condiciones.' : 'Alerta registrada.' },
      ...[...alerta.acciones].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    ],
    [alerta],
  )

  const cierra = estado === 'atendida'
  const guardar = (ev: FormEvent) => {
    ev.preventDefault()
    const r = gestionarAlerta(user, alerta.id, estado, nota)
    if (!r.ok) {
      setErrores(r.errores ?? {})
      toast(r.error, 'error')
      return
    }
    setErrores({})
    setNota('')
    toast(estado === alerta.estado ? 'Acción registrada' : `Alerta marcada como "${ESTADO_ALERTA_TEXTO[estado]}"`)
  }

  return (
    <Page title="Detalle de alerta" back={back} hideAvatar wide>
      <header className="flex items-start gap-4">
        <IconTile size={60}>
          <UserRound size={30} aria-hidden />
        </IconTile>
        <div className="flex flex-col gap-1.5 min-w-0">
          <h2 className="text-2xl font-bold text-ink wrap-anywhere">{nombreAdulto(adulto)}</h2>
          <p className="inline-flex items-center gap-1 text-sm text-muted">
            <MapPin size={14} aria-hidden /> {ubicacionCorta(catalogos, adulto)}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <UrgenciaBadge severidad={alerta.severidad} />
            <EstadoAlertaBadge estado={alerta.estado} />
            <RiesgoBadge riesgo={adulto.riesgo} />
          </div>
          <Link to={`${base}/adultos/${adulto.id}`} className="inline-flex items-center min-h-12 -my-2 text-sm font-semibold text-blue underline-offset-2 hover:underline">
            Ver perfil completo →
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-8">
        <div className="flex flex-col gap-6 min-w-0">
          <section className={cn('flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1 border-l-4', v.borde)} aria-labelledby="info-alerta">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{alerta.categoria}</p>
            <h3 id="info-alerta" className="text-lg font-bold">
              {alerta.titulo}
            </h3>
            <p className="text-sm leading-normal text-ink-2">{alerta.descripcion}</p>
            <dl className="flex flex-col">
              <Fila icono={<Tag size={16} aria-hidden />} etiqueta="Tipo">
                {tipoCat?.nombre ?? alerta.tipo}
                {tipoCat?.descripcion && <span className="block text-xs font-normal text-muted">{tipoCat.descripcion}</span>}
              </Fila>
              <Fila icono={<v.Icono size={16} aria-hidden />} etiqueta="Prioridad">
                {nombreCatalogo(catalogos.prioridades, alerta.severidad)}
              </Fila>
              <Fila icono={<Clock size={16} aria-hidden />} etiqueta="Generada">
                {fechaHora(alerta.creadaEn)}
              </Fila>
              <Fila icono={alerta.generadaPor === 'sistema' ? <Cpu size={16} aria-hidden /> : <UsersRound size={16} aria-hidden />} etiqueta="Generada por">
                {autorAlerta(usuarios, alerta)}
              </Fila>
              <Fila icono={<CalendarCheck2 size={16} aria-hidden />} etiqueta="Fecha de atención">
                {alerta.atendidaEn ? fechaHora(alerta.atendidaEn) : <span className="font-normal text-muted">Sin atender aún</span>}
              </Fila>
              <Fila icono={<UserCheck size={16} aria-hidden />} etiqueta="Atendida por">
                {alerta.atendidaPor ? (nombreUsuario(usuarios, alerta.atendidaPor) ?? 'Usuario no disponible') : <span className="font-normal text-muted">—</span>}
              </Fila>
              <Fila icono={<MessageSquareText size={16} aria-hidden />} etiqueta="Acción tomada">
                {alerta.notaAtencion || <span className="font-normal text-muted">—</span>}
              </Fila>
            </dl>
            {necesidad && (
              <div className="flex flex-col gap-2 p-3 rounded-sm border border-blue bg-blue-100">
                <h4 className="inline-flex items-center gap-2 text-sm font-bold text-navy">
                  <HandHelping size={16} aria-hidden /> Necesidad relacionada
                </h4>
                <p className="text-sm font-semibold text-ink">
                  {necesidad.catalogoId ? nombreCatalogo(catalogos.necesidades, necesidad.catalogoId) : TIPO_NECESIDAD_TEXTO[necesidad.tipo]}
                  {cantidadTexto(necesidad) ? ` · ${cantidadTexto(necesidad)}` : ''}
                </p>
                <p className="text-sm text-ink-2">{necesidad.descripcion}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge tone={TONO_NECESIDAD[necesidad.estado]}>{ESTADO_NECESIDAD_TEXTO[necesidad.estado]}</Badge>
                  <Badge tone="neutral">Registrada {fechaHora(necesidad.creadaEn)}</Badge>
                </div>
                <ButtonLink size="sm" variant="outline" to={`${base}/necesidades/${necesidad.id}`} icon={<HandHelping size={18} aria-hidden />}>
                  Ver la necesidad
                </ButtonLink>
              </div>
            )}
            <div className="flex flex-col gap-2 p-3 rounded-sm bg-bg">
              <h4 className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                <ListChecks size={16} aria-hidden /> Condiciones que la originaron
              </h4>
              {alerta.condiciones.length === 0 ? (
                <p className="text-sm text-muted">No se registraron condiciones específicas.</p>
              ) : (
                <ul className="flex flex-col gap-1 list-disc pl-5 text-sm text-ink-2">
                  {alerta.condiciones.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="historial">
            <h3 id="historial" className="text-lg font-bold">
              Historial de acciones
            </h3>
            <ol className="relative flex flex-col gap-4 pl-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-line-soft">
              {historial.map((h) => (
                <li key={h.id} className="relative flex flex-col gap-1">
                  <span className={cn('absolute -left-6 top-1 size-4 rounded-full border-2 border-bg', PUNTO[h.estado])} aria-hidden />
                  <div className="flex flex-wrap items-center gap-2">
                    <EstadoAlertaBadge estado={h.estado} />
                    <span className="text-xs text-muted">{fechaHora(h.fecha)}</span>
                  </div>
                  <span className="text-sm font-semibold text-ink">{nombreUsuario(usuarios, h.usuarioId) ?? 'Usuario no disponible'}</span>
                  <p className="text-sm text-ink-2 leading-normal">{h.nota}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          {gestiona ? (
            <form className="flex flex-col gap-4 p-4 rounded-md bg-blue-100 border border-blue" onSubmit={guardar} noValidate>
              <h3 className="text-lg font-bold text-navy">Registrar acción tomada</h3>
              <ChoicePills<EstadoAlerta> label="Estado de la alerta" value={estado} onChange={setEstado} options={ESTADOS_ALERTA} error={errores.estado} />
              <TextareaField
                label={cierra ? 'Acción tomada (obligatoria)' : 'Acción tomada'}
                required={cierra}
                placeholder="Ej.: Se llamó a la familia y se programó una visita para el jueves."
                value={nota}
                onChange={(e) => {
                  setNota(e.target.value)
                  if (errores.nota) setErrores((x) => ({ ...x, nota: undefined }))
                }}
                maxLength={500}
                error={errores.nota}
                hint={cierra ? 'Describe cómo se resolvió (mínimo 5 caracteres).' : `${nota.length}/500`}
                help="Queda en el historial con tu nombre, la fecha y el estado. Para marcar la alerta como atendida es obligatorio describir la acción tomada."
              />
              {!enLinea && <NotaInfo tono="aviso">Sin conexión: gestionar alertas necesita internet. Lo escrito se conserva en esta pantalla.</NotaInfo>}
              <Button type="submit" fullWidth disabled={!enLinea}>
                {estado === alerta.estado ? 'Registrar acción' : cierra ? 'Guardar y marcar atendida' : `Guardar como "${ESTADO_ALERTA_TEXTO[estado]}"`}
              </Button>
            </form>
          ) : (
            <NotaInfo>Tu rol puede consultar esta alerta, pero no gestionarla.</NotaInfo>
          )}
          {programa && adulto.estado === 'activo' && (
            <ButtonLink fullWidth variant="soft" to={`${base}/visitas/programar?adulto=${adulto.id}`} icon={<CalendarPlus size={22} aria-hidden />}>
              Programar visita
            </ButtonLink>
          )}
        </div>
      </div>
    </Page>
  )
}
