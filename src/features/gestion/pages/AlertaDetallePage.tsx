/*
 * AlertaDetallePage.tsx — Detalle y gestión de una alerta (CU-09 paso 4 · CU-10 · DFP6-04), tabla AlertaEnvejeciente:
 * tipo (Alert_Id → catálogo Alertas), prioridad (Prioridad_Id → catálogo Prioridad), Descripcion, Alert_Fecha,
 * Estado, Fecha_Atencion, Accion_tomada y Atentida_por_user_Id; además, adulto, condiciones que la originaron,
 * quién la generó, necesidad relacionada y el historial de acciones (quién, cuándo, estado y nota).
 * Ciclo de vida: Pendiente → En atención → Atendida (resuelta). Una alerta NO se resuelve sin la acción tomada
 * (mínimo 5 caracteres): el error se muestra junto al campo, tanto en la pantalla como en la capa de servicios
 * (gestionarAlerta). Permisos:
 *   alertas:gestionar  pone en atención, registra avances, resuelve y reabre.
 *   alertas:cerrar     (Cuidador, sin gestionar) solo ve «Cerrar alerta» con la acción tomada obligatoria.
 * Al abrirla se marca como leída para el usuario (marcarLeidas).
 * Módulo: gestión (la monta también el área del cuidador con alertasRoutes()).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarCheck2, CalendarPlus, Check, CircleCheck, Clock, Cpu, HandHelping, ListChecks, MapPin, MessageSquareText, RotateCcw, Tag, UserCheck, UserRound, UsersRound } from 'lucide-react'
import { Badge, Button, ButtonLink, ChoicePills, IconTile, RiesgoBadge, TextareaField, useToast } from '@/components/ui'
import { alertasVisibles, gestionarAlerta, marcarLeidas } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaHora } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import type { Adulto, Alerta, EstadoAlerta } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { useBorradorCompleto } from '@/lib/useBorrador'
import { EstadoAlertaBadge, NoEncontrado, NotaInfo, UrgenciaBadge, URGENCIA_VISUAL } from '../components/Piezas'
import { autorAlerta, necesidadDeAlerta, nombreCatalogo, nombreConRol, nombreUsuario } from '../lib/datos'
import { cantidadTexto, ESTADO_ALERTA_TEXTO, ESTADO_NECESIDAD_TEXTO, nombreAdulto, TIPO_NECESIDAD_TEXTO, TONO_NECESIDAD } from '../lib/formato'
import { ubicacionCorta } from '../lib/ubicacion'
import { useVolver } from '../lib/navegacion'

/** Mínimo de caracteres de la acción tomada para resolver (el mismo que valida gestionarAlerta). */
const MIN_ACCION = 5
const ID_NOTA = 'alerta-accion-tomada'

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
const PASOS: EstadoAlerta[] = ['pendiente', 'en_atencion', 'atendida']

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

/** Pendiente → En atención → Atendida: el paso actual se distingue por texto, icono y color. */
function PasosEstado({ estado }: { estado: EstadoAlerta }) {
  const actual = PASOS.indexOf(estado)
  return (
    <ol className="flex items-center gap-1.5" aria-label="Estado de la alerta">
      {PASOS.map((p, i) => {
        const hecho = i < actual || (p === 'atendida' && estado === 'atendida')
        const esActual = i === actual
        return (
          <li key={p} className="flex items-center gap-1.5 min-w-0" aria-current={esActual ? 'step' : undefined}>
            {i > 0 && <span className={cn('h-0.5 w-3 flex-none sm:w-6', i <= actual ? 'bg-navy' : 'bg-line')} aria-hidden />}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-pill border text-xs font-semibold whitespace-nowrap',
                esActual ? 'border-navy bg-navy text-white' : hecho ? 'border-navy bg-blue-100 text-navy' : 'border-line bg-surface text-muted',
              )}
            >
              {hecho && <Check size={13} aria-hidden />}
              {ESTADO_ALERTA_TEXTO[p]}
              {esActual && <span className="sr-only"> (estado actual)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

type Destino = Extract<EstadoAlerta, 'en_atencion' | 'atendida'>

/**
 * Registro de la acción tomada. `soloCierre` (Cuidador con alertas:cerrar): únicamente «Cerrar alerta» con la
 * acción tomada obligatoria. Con alertas:gestionar: poner en atención / registrar avance / resolver / reabrir.
 */
function PanelGestion({ alerta, soloCierre }: { alerta: Alerta; soloCierre: boolean }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const resuelta = alerta.estado === 'atendida'
  // Lo escrito se conserva si se recarga o falla el guardado (SRS §8.2.2.1.22).
  const { valor: borrador, setValor: setBorrador, reiniciar } = useBorradorCompleto<{ nota: string; destino: Destino }>(`alerta:${alerta.id}`, { nota: '', destino: 'en_atencion' })
  const [error, setError] = useState<string | undefined>()

  // Cuidador: siempre cierra. Gestor: reabrir siempre vuelve a «En atención».
  const destino: EstadoAlerta = soloCierre ? 'atendida' : resuelta ? 'en_atencion' : borrador.destino
  const resuelve = destino === 'atendida'
  const exigeNota = resuelve || resuelta
  const nota = borrador.nota

  const enfocar = () => requestAnimationFrame(() => document.getElementById(ID_NOTA)?.focus())

  const guardar = (ev: FormEvent) => {
    ev.preventDefault()
    // DFP6-04: sin la acción tomada no se resuelve (ni se reabre). El mismo control existe en gestionarAlerta.
    if (exigeNota && nota.trim().length < MIN_ACCION) {
      setError(resuelta ? 'Indica el motivo de la reapertura (mínimo 5 caracteres).' : 'Describe la acción tomada (mínimo 5 caracteres).')
      enfocar()
      return
    }
    const r = gestionarAlerta(user, alerta.id, destino, nota)
    if (!r.ok) {
      setError(r.errores?.nota)
      toast(r.error, 'error')
      if (r.errores?.nota) enfocar()
      return
    }
    setError(undefined)
    reiniciar()
    toast(resuelve ? 'Alerta cerrada: quedó registrada la acción tomada' : destino === alerta.estado ? 'Avance registrado' : `Alerta marcada como "${ESTADO_ALERTA_TEXTO[destino]}"`)
  }

  if (resuelta && soloCierre) {
    return (
      <NotaInfo>
        <b>Esta alerta ya está cerrada.</b> La acción tomada quedó en el historial. Si el problema vuelve a presentarse, avisa al coordinador.
      </NotaInfo>
    )
  }

  const titulo = soloCierre ? 'Cerrar alerta' : resuelta ? 'Reabrir alerta' : 'Gestionar alerta'
  const etiquetaNota = resuelta ? 'Motivo de la reapertura (obligatorio)' : resuelve ? 'Acción tomada (obligatoria)' : 'Nota del avance (opcional)'
  const textoBoton = soloCierre ? 'Cerrar alerta' : resuelta ? 'Reabrir alerta' : resuelve ? 'Resolver alerta' : alerta.estado === 'en_atencion' ? 'Registrar avance' : 'Poner en atención'

  return (
    <form className="flex flex-col gap-4 p-4 rounded-md bg-blue-100 border border-blue" onSubmit={guardar} noValidate aria-label={titulo}>
      <h3 className="text-lg font-bold text-navy">{titulo}</h3>
      {soloCierre ? (
        <p className="text-sm text-ink-2">Puedes cerrar esta alerta de tu adulto asignado. Cuenta qué hiciste: queda en el historial con tu nombre y la fecha.</p>
      ) : (
        !resuelta && (
          <ChoicePills<Destino>
            label="¿Qué quieres hacer?"
            value={borrador.destino}
            onChange={(d) => {
              setBorrador((b) => ({ ...b, destino: d }))
              setError(undefined)
            }}
            options={[
              { value: 'en_atencion', label: alerta.estado === 'en_atencion' ? 'Registrar avance' : 'Poner en atención' },
              { value: 'atendida', label: 'Resolver' },
            ]}
            help="En atención: ya alguien la está trabajando. Resolver: se terminó de atender; exige describir la acción tomada."
          />
        )
      )}
      <TextareaField
        id={ID_NOTA}
        label={etiquetaNota}
        required={exigeNota}
        rows={4}
        placeholder={resuelta ? 'Ej.: La familia reportó que el problema continúa.' : 'Ej.: Se llamó a la familia y se programó una visita para el jueves.'}
        value={nota}
        onChange={(e) => {
          setBorrador((b) => ({ ...b, nota: e.target.value }))
          if (error) setError(undefined)
        }}
        maxLength={500}
        error={error}
        hint={exigeNota ? `Mínimo ${MIN_ACCION} caracteres · ${nota.length}/500` : `${nota.length}/500`}
        help="Queda en el historial con tu nombre, la fecha y el estado. Una alerta no se resuelve sin describir la acción tomada."
      />
      {!enLinea && <NotaInfo tono="aviso">Sin conexión: gestionar alertas necesita internet. Lo escrito se conserva en esta pantalla.</NotaInfo>}
      <Button type="submit" fullWidth disabled={!enLinea} icon={resuelta ? <RotateCcw size={20} aria-hidden /> : resuelve ? <CircleCheck size={20} aria-hidden /> : undefined}>
        {textoBoton}
      </Button>
    </form>
  )
}

function Detalle({ alerta, adulto }: { alerta: Alerta; adulto: Adulto }) {
  const { base } = useShell()
  const user = useUser()
  const { back } = useVolver(`${base}/alertas`)
  const usuarios = useDB((s) => s.usuarios)
  const necesidades = useDB((s) => s.necesidades)
  const catalogos = useDB((s) => s.catalogos)
  const necesidad = useMemo(() => necesidadDeAlerta(alerta, necesidades), [alerta, necesidades])
  const tipoCat = catalogos.alertas.find((t) => t.id === alerta.tipo)

  const gestiona = puede(user, 'alertas:gestionar', adulto)
  // V2: el Cuidador (alertas:cerrar sin alertas:gestionar) solo puede cerrar con la acción tomada.
  const soloCierre = !gestiona && puede(user, 'alertas:cerrar', adulto)
  const programa = puede(user, 'visitas:programar', adulto)
  const verNecesidad = puede(user, 'necesidades:ver', adulto)
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

      <PasosEstado estado={alerta.estado} />

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
                {alerta.atendidaPor ? (nombreConRol(usuarios, alerta.atendidaPor) ?? 'Usuario no disponible') : <span className="font-normal text-muted">—</span>}
              </Fila>
              <Fila icono={<MessageSquareText size={16} aria-hidden />} etiqueta="Acción tomada">
                {alerta.notaAtencion || <span className="font-normal text-muted">—</span>}
              </Fila>
            </dl>
            {necesidad && verNecesidad && (
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
                  <span className="text-sm font-semibold text-ink">{nombreConRol(usuarios, h.usuarioId) ?? nombreUsuario(usuarios, h.usuarioId) ?? 'Usuario no disponible'}</span>
                  <p className="text-sm text-ink-2 leading-normal">{h.nota}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* En móvil el formulario va primero: gestionar la alerta es la tarea principal de esta pantalla. */}
        <div className="flex flex-col gap-4 min-w-0 max-md:order-first">
          {gestiona || soloCierre ? <PanelGestion alerta={alerta} soloCierre={soloCierre} /> : <NotaInfo>Tu rol puede consultar esta alerta, pero no gestionarla.</NotaInfo>}
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
