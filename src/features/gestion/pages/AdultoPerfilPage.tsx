/*
 * AdultoPerfilPage.tsx — Consultar perfil de adulto mayor (CU-04 · RF-01) con TODAS sus relaciones del modelo V3.0:
 *   Envejeciente          identificación, ubicación (Municipio_Cod + Env_Direccion), quién lo registró y cuándo.
 *   Contacto_emergencia   contactos con el principal destacado (agregar, editar, marcar principal, eliminar).
 *   Vinculo               voluntarios asignados y familiares responsables (tipo del catálogo Tipo_vinculo).
 *   Env_Riesgo            nivel vigente + historial de factores (registrar, marcar superado) y evaluación.
 *   Indicacion_Medica     indicaciones transcritas (permiso indicaciones:*).
 *   Tarea_agenda          próximas tareas (permiso agenda:*).
 *   Visita / DetalleVisita, Env_Necesidad, AlertaEnvejeciente   historial en pestañas.
 * Además: días sin visita (RF-05), alertas abiertas (RF-04), condición general (dato sensible, SRS §8.2.2.3.4 d)
 * y consentimiento. Las acciones se muestran según los permisos del rol (RF-09). En escritorio, dos columnas.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Cake, CalendarPlus, CircleUserRound, ClipboardList, FileCheck2, HandHelping, History, Home, MapPin, Pencil, Phone, ShieldCheck, UserRoundPen, VenusAndMars } from 'lucide-react'
import { Badge, ButtonLink, InfoRow, RiesgoBadge } from '@/components/ui'
import { useUser } from '@/domain/auth'
import { AUTONOMIAS, CONDICIONES } from '@/domain/catalogos'
import { edad, fechaCorta, fechaHora } from '@/domain/dates'
import { alcanzaAdulto, puede } from '@/domain/permisos'
import { diasSinVisita } from '@/domain/reglas'
import { configOrg, direccionCompleta, voluntariosDe } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { NoEncontrado, NotaInfo, Seccion, EstadoAlertaBadge, UrgenciaBadge, URGENCIA_VISUAL } from '../components/Piezas'
import { AgendaSeccion } from '../components/perfil/AgendaSeccion'
import { ContactosSeccion } from '../components/perfil/ContactosSeccion'
import { HistorialSeccion } from '../components/perfil/HistorialSeccion'
import { IndicacionesSeccion } from '../components/perfil/IndicacionesSeccion'
import { RiesgosSeccion } from '../components/perfil/RiesgosSeccion'
import { VinculosSeccion } from '../components/perfil/VinculosSeccion'
import { necesidadDeAlerta, nombreCatalogo, nombreUsuario } from '../lib/datos'
import { necesidadAbierta, nombreAdulto, PESO_SEVERIDAD } from '../lib/formato'
import { municipioYProvincia } from '../lib/ubicacion'
import { useVolver } from '../lib/navegacion'

function Tile({ label, valor, alerta, children }: { label: string; valor: ReactNode; alerta?: boolean; children?: ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1 min-h-[84px] p-3 text-center rounded-sm border',
        alerta ? 'border-danger bg-danger-100 text-danger' : 'border-blue bg-blue-100 text-ink',
      )}
    >
      <span className="text-xs font-medium">{label}</span>
      <strong className="text-2xl leading-tight font-bold">{valor}</strong>
      {children}
    </div>
  )
}

export default function AdultoPerfilPage() {
  const { adultoId } = useParams()
  const { base } = useShell()
  const user = useUser()
  const adultos = useDB((s) => s.adultos)
  // Alcance (RF-09): solo adultos de la organización o con vínculo del usuario.
  const adulto = useMemo(() => adultos.find((a) => a.id === adultoId && alcanzaAdulto(user, a)), [adultos, adultoId, user])

  if (!adulto) {
    return (
      <Page title="Perfil del adulto mayor" back={`${base}/adultos`} hideAvatar>
        <NoEncontrado volverA={`${base}/adultos`} que="este perfil" />
      </Page>
    )
  }
  return <Perfil key={adulto.id} adulto={adulto} />
}

function Perfil({ adulto }: { adulto: Adulto }) {
  const { base } = useShell()
  const user = useUser()
  const { back } = useVolver(`${base}/adultos`)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const alertas = useDB((s) => s.alertas)
  const usuarios = useDB((s) => s.usuarios)
  const vinculos = useDB((s) => s.vinculos)
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)

  const activo = adulto.estado === 'activo'
  const editable = puede(user, 'adultos:editar', adulto) && !adulto.anonimizado
  const sensible = puede(user, 'adultos:ver-sensible', adulto)
  const verAlertas = puede(user, 'alertas:ver', adulto)
  const umbral = configOrg({ catalogos, configuracion }, adulto.orgId).diasSinVisitaAlerta

  const abiertas = useMemo(
    () => alertas.filter((a) => a.adultoId === adulto.id && a.estado !== 'atendida').sort((a, b) => PESO_SEVERIDAD[a.severidad] - PESO_SEVERIDAD[b.severidad] || b.creadaEn.localeCompare(a.creadaEn)),
    [alertas, adulto.id],
  )
  const pendientes = useMemo(() => necesidades.filter((n) => n.adultoId === adulto.id && necesidadAbierta(n.estado)).length, [necesidades, adulto.id])
  const sinVisita = useMemo(() => diasSinVisita({ visitas }, adulto), [visitas, adulto])
  const voluntarios = useMemo(() => voluntariosDe(vinculos, adulto.id).length, [vinculos, adulto.id])
  const vencida = activo && sinVisita.dias > umbral

  const autonomia = AUTONOMIAS.find((x) => x.value === adulto.condicionGeneral.autonomia)?.label ?? '—'
  const condiciones = adulto.condicionGeneral.condiciones.map((c) => CONDICIONES.find((x) => x.value === c)?.label ?? c)

  const acciones = [
    puede(user, 'visitas:registrar', adulto) && activo && (
      <ButtonLink key="visita" variant="soft" to={`${base}/visitas/nueva?adulto=${adulto.id}`} icon={<ClipboardList size={20} aria-hidden />}>
        Registrar visita
      </ButtonLink>
    ),
    puede(user, 'necesidades:registrar', adulto) && activo && (
      <ButtonLink key="necesidad" variant="soft" to={`${base}/necesidades/nueva?adulto=${adulto.id}`} icon={<HandHelping size={20} aria-hidden />}>
        Agregar necesidad
      </ButtonLink>
    ),
    puede(user, 'visitas:programar', adulto) && activo && (
      <ButtonLink key="programar" variant="light" to={`${base}/visitas/programar?adulto=${adulto.id}`} icon={<CalendarPlus size={20} aria-hidden />}>
        Programar visita
      </ButtonLink>
    ),
    editable && (
      <ButtonLink key="editar" variant="light" to={`${base}/adultos/${adulto.id}/editar`} icon={<Pencil size={20} aria-hidden />}>
        Editar perfil
      </ButtonLink>
    ),
    puede(user, 'adultos:evaluar', adulto) && activo && (
      <ButtonLink key="riesgo" variant="light" to={`${base}/adultos/${adulto.id}/riesgo`} state={{ desde: 'perfil' }} icon={<ShieldCheck size={20} aria-hidden />}>
        Evaluación de riesgo
      </ButtonLink>
    ),
  ].filter(Boolean)

  return (
    <Page title="Perfil del adulto mayor" back={back} hideAvatar wide>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8 lg:items-start">
        {/* ───── Columna 1: datos del perfil ───── */}
        <div className="contents lg:flex lg:flex-col lg:gap-6 min-w-0">
          <section className="order-1 lg:order-none flex flex-col items-center gap-1 text-center" aria-label="Resumen del adulto mayor">
            <CircleUserRound size={96} strokeWidth={1.4} className="text-blue-bright mb-1" aria-hidden />
            <h2 className="text-[28px] leading-tight font-bold text-navy wrap-anywhere">{nombreAdulto(adulto)}</h2>
            <p className="text-sm text-muted">
              {adulto.cedula} · {edad(adulto.fechaNacimiento)} años
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <RiesgoBadge riesgo={adulto.riesgo} />
              {!activo && <Badge tone="neutral">Inactivo</Badge>}
              {adulto.anonimizado && <Badge tone="neutral">Anonimizado</Badge>}
            </div>
          </section>

          <div className="order-2 lg:order-none grid grid-cols-2 gap-3">
            <Tile label="Días sin visita" valor={activo ? sinVisita.dias : '—'} alerta={vencida}>
              <span className="text-[11px]">{sinVisita.conVisitas ? `Última: ${fechaCorta(sinVisita.referencia)}` : 'Nunca visitado'}</span>
            </Tile>
            <Tile label="Necesidades pendientes" valor={pendientes} />
            <Tile label="Alertas abiertas" valor={abiertas.length} alerta={abiertas.some((a) => a.severidad === 'alta')} />
            <Tile label="Voluntarios asignados" valor={voluntarios} alerta={activo && voluntarios === 0} />
          </div>
          {vencida && (
            <div className="order-3 lg:order-none">
              <NotaInfo tono="aviso">
                Superó el límite de <b>{umbral} días</b> sin visita comunitaria (RF-05). El sistema generó una alerta de seguimiento familiar: conviene contactar a la familia y programar una
                visita.
              </NotaInfo>
            </div>
          )}

          <Seccion titulo="Identificación y ubicación" id="info-personal" className="order-6 lg:order-none">
            <div className="flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1">
              <InfoRow icon={<Cake size={22} aria-hidden />} label="Fecha de nacimiento" value={`${fechaCorta(adulto.fechaNacimiento)} (${edad(adulto.fechaNacimiento)} años)`} />
              <div className="grid grid-cols-2 gap-3">
                <InfoRow icon={<VenusAndMars size={22} aria-hidden />} label="Sexo" value={adulto.sexo} />
                <InfoRow
                  icon={<Phone size={22} aria-hidden />}
                  label="Teléfono"
                  value={
                    adulto.telefono ? (
                      <a href={`tel:${adulto.telefono.replace(/\D/g, '')}`} className="inline-flex items-center min-h-12 -my-3 text-navy font-semibold underline-offset-2 hover:underline">
                        {adulto.telefono}
                      </a>
                    ) : (
                      'No registrado'
                    )
                  }
                />
              </div>
              <InfoRow icon={<MapPin size={22} aria-hidden />} label="Municipio y provincia" value={municipioYProvincia(catalogos, adulto.municipioCod) || '—'} />
              <InfoRow icon={<Home size={22} aria-hidden />} label="Dirección" value={direccionCompleta(catalogos, adulto) || '—'} />
              <InfoRow icon={<UserRoundPen size={22} aria-hidden />} label="Registrado" value={`${fechaHora(adulto.creadoEn)} · por ${nombreUsuario(usuarios, adulto.registradoPor) ?? 'usuario no disponible'}`} />
              {adulto.actualizadoEn !== adulto.creadoEn && (
                <InfoRow icon={<History size={22} aria-hidden />} label="Última actualización" value={`${fechaHora(adulto.actualizadoEn)}${adulto.actualizadoPor ? ` · por ${nombreUsuario(usuarios, adulto.actualizadoPor) ?? '—'}` : ''}`} />
              )}
            </div>
          </Seccion>

          <ContactosSeccion adulto={adulto} editable={editable && activo} className="order-7 lg:order-none" />

          {sensible && <RiesgosSeccion adulto={adulto} base={base} puedeEvaluar={puede(user, 'adultos:evaluar', adulto) && activo} className="order-9 lg:order-none" />}

          {sensible && (
            <Seccion titulo="Condición general" id="condicion" className="order-10 lg:order-none">
              <p className="text-xs text-muted -mt-2">Información sensible: visible solo para roles autorizados (SRS §8.2.2.3.4 d).</p>
              <InfoRow label="Grado de autonomía" value={autonomia} />
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink">Situaciones registradas</span>
                {condiciones.length === 0 ? (
                  <p className="text-sm text-muted">Ninguna registrada.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {condiciones.map((c) => (
                      <li key={c} className="px-3 py-1 rounded-pill bg-surface-2 text-ink-2 text-sm font-semibold">
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {adulto.condicionGeneral.nota && <InfoRow label="Nota" value={adulto.condicionGeneral.nota} />}
            </Seccion>
          )}

          <Seccion titulo="Consentimiento informado" id="consentimiento" className="order-11 lg:order-none">
            {adulto.consentimiento?.otorgado ? (
              <InfoRow
                icon={<FileCheck2 size={22} aria-hidden className="text-success-700" />}
                label="Otorgado (Ley 172-13)"
                value={`Por ${adulto.consentimiento.otorgadoPor === 'adulto' ? 'el adulto mayor' : 'su representante'} · ${fechaCorta(adulto.consentimiento.fecha)} · registrado por ${nombreUsuario(usuarios, adulto.consentimiento.registradoPor) ?? '—'}`}
              />
            ) : (
              <NotaInfo tono="aviso">No hay consentimiento informado registrado. Edita el perfil para registrarlo.</NotaInfo>
            )}
          </Seccion>
        </div>

        {/* ───── Columna 2: acciones, vínculos, salud y actividad ───── */}
        <div className="contents lg:flex lg:flex-col lg:gap-6 min-w-0">
          {acciones.length > 0 && (
            <Seccion titulo="Acciones" id="acciones" className="order-4 lg:order-none">
              <div className="grid gap-3 sm:grid-cols-2 [&>a]:text-base">{acciones}</div>
            </Seccion>
          )}

          {verAlertas && abiertas.length > 0 && (
            <Seccion titulo="Alertas abiertas" id="alertas-abiertas" className="order-5 lg:order-none">
              <ul className="flex flex-col gap-2">
                {abiertas.map((al) => {
                  const v = URGENCIA_VISUAL[al.severidad]
                  const nec = necesidadDeAlerta(al, necesidades)
                  return (
                    <li key={al.id}>
                      <Link to={`${base}/alertas/${al.id}`} className={cn('flex items-center gap-3 min-h-12 p-3 rounded-sm border border-line-soft border-l-4 bg-surface hover:shadow-1', v.borde)}>
                        <span className={cn('grid place-items-center size-10 flex-none rounded-full', v.icono)} aria-hidden>
                          <v.Icono size={20} />
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col gap-1">
                          <span className="text-xs text-muted">{nombreCatalogo(catalogos.alertas, al.tipo)}</span>
                          <strong className="text-sm text-ink">{al.titulo}</strong>
                          {nec && <span className="text-xs text-ink-2 line-clamp-1">Necesidad: {nec.descripcion}</span>}
                          <span className="flex flex-wrap gap-1">
                            <UrgenciaBadge severidad={al.severidad} />
                            <EstadoAlertaBadge estado={al.estado} />
                          </span>
                        </span>
                        <ArrowRight size={18} className="text-navy flex-none" aria-hidden />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Seccion>
          )}

          <VinculosSeccion adulto={adulto} puedeAsignar={puede(user, 'adultos:asignar', adulto) && activo} className="order-8 lg:order-none" />

          {puede(user, 'indicaciones:ver', adulto) && <IndicacionesSeccion adulto={adulto} gestiona={puede(user, 'indicaciones:gestionar', adulto) && activo} className="order-12 lg:order-none" />}

          {puede(user, 'agenda:ver', adulto) && <AgendaSeccion adulto={adulto} base={base} gestiona={puede(user, 'agenda:gestionar', adulto)} className="order-13 lg:order-none" />}

          <HistorialSeccion
            adulto={adulto}
            base={base}
            verVisitas={puede(user, 'visitas:ver', adulto)}
            verNecesidades={puede(user, 'necesidades:ver', adulto)}
            verAlertas={verAlertas}
            sensible={sensible}
            className="order-14 lg:order-none"
          />
        </div>
      </div>
    </Page>
  )
}
