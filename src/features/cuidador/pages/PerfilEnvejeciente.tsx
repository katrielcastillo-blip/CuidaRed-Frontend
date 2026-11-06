/*
 * PerfilEnvejeciente.tsx — Perfil del adulto mayor para el cuidador (CU-04 · RF-01): datos básicos y dirección
 * completa, contactos de emergencia (con el principal destacado), riesgo e historial de riesgos (solo lectura:
 * el cuidador no tiene adultos:evaluar), condición general, indicaciones médicas (las registra y edita con
 * indicaciones:gestionar), agenda de cuidado, historial de visitas, necesidades y alertas, y las acciones
 * Registrar visita / Agregar necesidad / Ver alertas. Solo para adultos con vínculo «cuidador asignado» en la
 * cuenta activa (alcance RBAC): si no, "No encontrado o sin permiso".
 * Módulo: cuidador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Bell, Cake, CircleUserRound, ClipboardPlus, HandHeart, MapPin, Phone, VenusAndMars } from 'lucide-react'
import { nombreCompleto, useUser } from '@/domain/auth'
import { AUTONOMIAS, CONDICIONES } from '@/domain/catalogos'
import { edad, fechaCorta } from '@/domain/dates'
import { alcanzaAdulto, puede } from '@/domain/permisos'
import { configOrg, direccionCompleta, visitaIncluye } from '@/domain/relaciones'
import { diasSinVisita } from '@/domain/reglas'
import { useDB } from '@/domain/store'
import type { Adulto, Usuario } from '@/domain/types'
import { Badge, ButtonLink, InfoRow, RiesgoBadge } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { EstadoAlertaBadge, NotaInfo, Seccion, UrgenciaBadge, URGENCIA_VISUAL } from '@/features/gestion/components/Piezas'
import { AgendaSeccion } from '@/features/gestion/components/perfil/AgendaSeccion'
import { ContactosSeccion } from '@/features/gestion/components/perfil/ContactosSeccion'
import { HistorialSeccion } from '@/features/gestion/components/perfil/HistorialSeccion'
import { IndicacionesSeccion } from '@/features/gestion/components/perfil/IndicacionesSeccion'
import { RiesgosSeccion } from '@/features/gestion/components/perfil/RiesgosSeccion'
import { necesidadDeAlerta, nombreCatalogo } from '@/features/gestion/lib/datos'
import { necesidadAbierta, PESO_SEVERIDAD } from '@/features/gestion/lib/formato'
import { useVolver } from '@/features/gestion/lib/navegacion'
import { BotonInformeMedico } from '@/features/gestion/components/InformeMedico'
import { NoEncontrado } from '@/features/visitas/components/Comun'
import { textoDias } from '../lib/resumen'

const TITULO = 'Perfil del adulto mayor'

export function PerfilEnvejeciente() {
  const user = useUser()
  const { adultoId } = useParams()
  const adultos = useDB((s) => s.adultos)
  const adulto = useMemo(() => adultos.find((a) => a.id === adultoId), [adultos, adultoId])
  if (!adulto || !puede(user, 'adultos:ver') || !alcanzaAdulto(user, adulto)) return <NoEncontrado titulo={TITULO} />
  return <Contenido key={adulto.id} adulto={adulto} user={user} />
}

function Contenido({ adulto, user }: { adulto: Adulto; user: Usuario }) {
  const { base } = useShell()
  const { back } = useVolver(`${base}/adultos`)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const alertas = useDB((s) => s.alertas)
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)

  const activo = adulto.estado === 'activo'
  const sensible = puede(user, 'adultos:ver-sensible', adulto)
  const verAlertas = puede(user, 'alertas:ver', adulto)
  const umbral = configOrg({ catalogos, configuracion }, adulto.orgId).diasSinVisitaAlerta

  const abiertas = useMemo(
    () => alertas.filter((a) => a.adultoId === adulto.id && a.estado !== 'atendida').sort((a, b) => PESO_SEVERIDAD[a.severidad] - PESO_SEVERIDAD[b.severidad] || b.creadaEn.localeCompare(a.creadaEn)),
    [alertas, adulto.id],
  )
  const pendientes = useMemo(() => necesidades.filter((n) => n.adultoId === adulto.id && necesidadAbierta(n.estado)).length, [necesidades, adulto.id])
  const sinVisita = useMemo(() => diasSinVisita({ visitas }, adulto), [visitas, adulto])
  const completadas = useMemo(() => visitas.filter((v) => visitaIncluye(v, adulto.id) && v.estado === 'completada').length, [visitas, adulto.id])
  const vencida = activo && sinVisita.dias > umbral

  const autonomia = AUTONOMIAS.find((x) => x.value === adulto.condicionGeneral.autonomia)?.label
  const condiciones = adulto.condicionGeneral.condiciones.map((c) => CONDICIONES.find((x) => x.value === c)?.label ?? c)

  const acciones = [
    puede(user, 'visitas:registrar', adulto) && activo && (
      <ButtonLink key="visita" variant="soft" fullWidth to={`${base}/visitas/nueva?adulto=${adulto.id}`} icon={<ClipboardPlus size={22} aria-hidden />}>
        Registrar visita
      </ButtonLink>
    ),
    puede(user, 'necesidades:registrar', adulto) && activo && (
      <ButtonLink key="necesidad" variant="soft" fullWidth to={`${base}/necesidades/nueva?adulto=${adulto.id}`} icon={<HandHeart size={22} aria-hidden />}>
        Agregar necesidad
      </ButtonLink>
    ),
    verAlertas && (
      <ButtonLink key="alertas" variant="light" fullWidth to={`${base}/alertas`} icon={<Bell size={22} aria-hidden />}>
        Ver alertas
      </ButtonLink>
    ),
  ].filter(Boolean)

  return (
    <Page title={TITULO} back={back} wide>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8 lg:items-start">
        {/* ───── Columna 1: quién es ───── */}
        <div className="contents lg:flex lg:flex-col lg:gap-6 min-w-0">
          <header className="order-1 lg:order-none flex flex-col items-center gap-1 text-center">
            <CircleUserRound size={96} strokeWidth={1.4} className="text-blue mb-1" aria-hidden />
            <h2 className="text-2xl font-bold leading-tight text-navy wrap-anywhere">{nombreCompleto(adulto)}</h2>
            <p className="text-sm font-semibold text-muted">
              {adulto.cedula} · {edad(adulto.fechaNacimiento)} años
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm font-semibold text-ink-2">Riesgo social</span>
              <RiesgoBadge riesgo={adulto.riesgo} />
              {!activo && <Badge tone="neutral">Inactivo</Badge>}
            </div>
          </header>

          <section className="order-2 lg:order-none grid grid-cols-2 gap-3" aria-label="Resumen de seguimiento">
            <Tile etiqueta="Última visita" valor={textoDias(sinVisita)} detalle={sinVisita.conVisitas ? fechaCorta(sinVisita.referencia) : 'Nunca visitado'} alerta={vencida} />
            <Tile etiqueta="Necesidades pendientes" valor={String(pendientes)} />
            {verAlertas && <Tile etiqueta="Alertas abiertas" valor={String(abiertas.length)} alerta={abiertas.some((a) => a.severidad === 'alta')} />}
            <Tile etiqueta="Visitas realizadas" valor={String(completadas)} />
          </section>

          {vencida && (
            <div className="order-3 lg:order-none">
              <NotaInfo tono="aviso">
                Pasaron más de <b>{umbral} días</b> desde la última visita realizada. Registra una visita para dar seguimiento.
              </NotaInfo>
            </div>
          )}

          <Seccion titulo="Datos básicos" id="info-titulo" className="order-6 lg:order-none">
            <InfoRow icon={<Cake size={24} aria-hidden />} label="Fecha de nacimiento" value={`${fechaCorta(adulto.fechaNacimiento)} (${edad(adulto.fechaNacimiento)} años)`} />
            <InfoRow icon={<VenusAndMars size={24} aria-hidden />} label="Sexo" value={adulto.sexo} />
            <InfoRow icon={<MapPin size={24} aria-hidden />} label="Dirección" value={direccionCompleta(catalogos, adulto) || 'No registrada'} />
            <InfoRow
              icon={<Phone size={24} aria-hidden />}
              label="Teléfono"
              value={
                adulto.telefono ? (
                  <a href={`tel:${adulto.telefono.replace(/\D/g, '')}`} className="inline-flex items-center min-h-12 -my-3 text-navy font-semibold underline underline-offset-4">
                    {adulto.telefono}
                  </a>
                ) : (
                  'No registrado'
                )
              }
            />
          </Seccion>

          <ContactosSeccion adulto={adulto} editable={false} className="order-7 lg:order-none" />

          {sensible && (
            <Seccion titulo="Condición general" id="condicion-titulo" className="order-9 lg:order-none">
              {autonomia && <InfoRow label="Grado de autonomía" value={autonomia} />}
              {condiciones.length > 0 ? (
                <ul className="flex flex-wrap gap-2 m-0 p-0 list-none" aria-label="Situaciones de salud y sociales">
                  {condiciones.map((c) => (
                    <li key={c} className="px-3 py-1.5 rounded-pill border border-blue bg-blue-100 text-sm font-semibold text-navy">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Sin condiciones registradas.</p>
              )}
              {adulto.condicionGeneral.nota && <p className="text-sm text-ink-2 italic">{adulto.condicionGeneral.nota}</p>}
            </Seccion>
          )}
        </div>

        {/* ───── Columna 2: qué hacer y seguimiento ───── */}
        <div className="contents lg:flex lg:flex-col lg:gap-6 min-w-0">
          <Seccion titulo="Acciones" id="acciones-titulo" className="order-4 lg:order-none">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {acciones}
              <BotonInformeMedico adulto={adulto} />
            </div>
          </Seccion>

          {verAlertas && abiertas.length > 0 && (
            <Seccion titulo="Alertas abiertas" id="alertas-abiertas" className="order-5 lg:order-none">
              <ul className="flex flex-col gap-2 m-0 p-0 list-none">
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

          {sensible && <RiesgosSeccion adulto={adulto} base={base} puedeEvaluar={false} className="order-8 lg:order-none" />}

          {puede(user, 'indicaciones:ver', adulto) && (
            <IndicacionesSeccion adulto={adulto} gestiona={puede(user, 'indicaciones:gestionar', adulto) && activo} className="order-10 lg:order-none" />
          )}

          {puede(user, 'agenda:ver', adulto) && <AgendaSeccion adulto={adulto} base={base} gestiona={puede(user, 'agenda:gestionar', adulto)} className="order-11 lg:order-none" />}

          <HistorialSeccion
            adulto={adulto}
            base={base}
            verVisitas={puede(user, 'visitas:ver', adulto)}
            verNecesidades={puede(user, 'necesidades:ver', adulto)}
            verAlertas={verAlertas}
            sensible={sensible}
            className="order-12 lg:order-none"
          />
        </div>
      </div>
    </Page>
  )
}

function Tile({ etiqueta, valor, detalle, alerta }: { etiqueta: string; valor: ReactNode; detalle?: string; alerta?: boolean }) {
  return (
    <div className={cn('flex flex-col justify-between gap-1 min-h-20 px-3 py-2 rounded-sm border', alerta ? 'border-danger bg-danger-100 text-danger' : 'border-blue bg-blue-100 text-ink')}>
      <span className="text-xs font-semibold">{etiqueta}</span>
      <span className="self-end text-lg font-bold leading-tight text-right">{valor}</span>
      {detalle && <span className="self-end text-xs text-ink-2">{detalle}</span>}
    </div>
  )
}
