/*
 * PerfilEnvejeciente.tsx — Perfil del adulto mayor para el voluntario (CU-04 · RF-01): datos básicos y
 * dirección completa (Env_Direccion + Municipio + Provincia), contactos de emergencia (Contacto_emergencia, con
 * parentesco), condición general, riesgo e historial de riesgos (Env_Riesgo, solo lectura), indicaciones
 * médicas vigentes (Indicacion_Medica, solo lectura y solo con `indicaciones:ver`), historial de visitas (como
 * adulto principal o adicional del hogar) y necesidades, y acciones Registrar visita / Agregar necesidad.
 * Solo para adultos con vínculo «voluntario asignado» (alcance RBAC): si no, "No encontrado o sin permiso".
 * Módulo: voluntario.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Cake, CircleUserRound, ClipboardPlus, FileText, HandHeart, MapPin, Phone, Pill, ShieldAlert, Star, VenusAndMars } from 'lucide-react'
import { nombreCompleto, useUser } from '@/domain/auth'
import { AUTONOMIAS, CONDICIONES } from '@/domain/catalogos'
import { edad, fechaCorta } from '@/domain/dates'
import { alcanzaAdulto, puede } from '@/domain/permisos'
import { contactosDe, direccionCompleta, nombreContacto, riesgosDe, visitaIncluye } from '@/domain/relaciones'
import { diasSinVisita } from '@/domain/reglas'
import { useDB } from '@/domain/store'
import type { Adulto, Usuario } from '@/domain/types'
import { Badge, ButtonLink, EmptyState, InfoRow, RiesgoBadge, Segmented } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { NecesidadCard } from '@/features/visitas/components/NecesidadCard'
import { NoEncontrado } from '@/features/visitas/components/Comun'
import { VisitaCard } from '@/features/visitas/components/VisitaCard'
import { porFechaDesc, ultimaVisitaDe } from '@/features/visitas/lib/dominio'
import { textoDias } from '../lib/resumen'

type Pestana = 'necesidades' | 'visitas'
const TITULO = 'Perfil del adulto mayor'
const tel = (t: string) => `tel:${t.replace(/\s/g, '')}`

export function PerfilEnvejeciente() {
  const user = useUser()
  const { adultoId } = useParams()
  const adultos = useDB((s) => s.adultos)
  const adulto = useMemo(() => adultos.find((a) => a.id === adultoId), [adultos, adultoId])
  if (!adulto || !puede(user, 'adultos:ver') || !alcanzaAdulto(user, adulto)) return <NoEncontrado titulo={TITULO} />
  return <Contenido adulto={adulto} user={user} />
}

function Contenido({ adulto, user }: { adulto: Adulto; user: Usuario }) {
  const { base } = useShell()
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const catalogos = useDB((s) => s.catalogos)
  const contactos = useDB((s) => s.contactos)
  const riesgos = useDB((s) => s.riesgos)
  const indicaciones = useDB((s) => s.indicaciones)
  const [pestana, setPestana] = useState<Pestana>('necesidades')

  // Visitas en las que el adulto fue el principal o un adulto adicional del mismo hogar (DetalleVisita).
  const susVisitas = useMemo(() => visitas.filter((v) => visitaIncluye(v, adulto.id) && v.estado !== 'cancelada').sort(porFechaDesc), [visitas, adulto.id])
  const susContactos = useMemo(() => contactosDe(contactos, adulto.id), [contactos, adulto.id])
  const susRiesgos = useMemo(() => riesgosDe(riesgos, adulto.id), [riesgos, adulto.id])
  const verIndicaciones = puede(user, 'indicaciones:ver', adulto)
  const vigentes = useMemo(
    () => (verIndicaciones ? indicaciones.filter((i) => i.adultoId === adulto.id && i.estado === 'vigente').sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)) : []),
    [indicaciones, adulto.id, verIndicaciones],
  )
  const nombreCat = (lista: Array<{ id: string; nombre: string }>, id: string) => lista.find((x) => x.id === id)?.nombre ?? id
  const susNecesidades = useMemo(
    () => necesidades.filter((n) => n.adultoId === adulto.id).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)),
    [necesidades, adulto.id],
  )
  const pendientes = susNecesidades.filter((n) => n.estado === 'pendiente' || n.estado === 'en_proceso').length
  const ultima = ultimaVisitaDe(visitas, adulto.id)
  const completadas = susVisitas.filter((v) => v.estado === 'completada').length
  const sinVisita = useMemo(() => diasSinVisita({ visitas }, adulto), [visitas, adulto])
  const verSensible = puede(user, 'adultos:ver-sensible', adulto)
  const autonomia = AUTONOMIAS.find((x) => x.value === adulto.condicionGeneral.autonomia)?.label
  const condiciones = adulto.condicionGeneral.condiciones.map((c) => CONDICIONES.find((x) => x.value === c)?.label ?? c)

  return (
    <Page title={TITULO} back wide>
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[clamp(240px,34%,400px)_minmax(0,1fr)] md:gap-8 md:items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <header className="flex flex-col items-center gap-1 text-center">
            <CircleUserRound size={96} strokeWidth={1.4} className="text-blue mb-1" aria-hidden />
            <h2 className="text-2xl font-bold leading-tight text-navy wrap-anywhere">{nombreCompleto(adulto)}</h2>
            <p className="text-sm font-semibold text-muted">
              {adulto.cedula} · {edad(adulto.fechaNacimiento)} años
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-ink-2">Riesgo social</span>
              <RiesgoBadge riesgo={adulto.riesgo} />
            </div>
          </header>

          <section className="flex flex-col gap-4" aria-labelledby="info-titulo">
            <h2 className="section-title" id="info-titulo">
              Datos básicos
            </h2>
            <InfoRow icon={<Cake size={24} aria-hidden />} label="Fecha de nacimiento" value={fechaCorta(adulto.fechaNacimiento)} />
            <InfoRow icon={<VenusAndMars size={24} aria-hidden />} label="Sexo" value={adulto.sexo} />
            <InfoRow icon={<MapPin size={24} aria-hidden />} label="Dirección" value={direccionCompleta(catalogos, adulto) || 'No registrada'} />
            <InfoRow
              icon={<Phone size={24} aria-hidden />}
              label="Teléfono"
              value={
                <a href={tel(adulto.telefono)} className="inline-flex items-center min-h-12 -my-3 text-navy font-semibold underline underline-offset-4">
                  {adulto.telefono}
                </a>
              }
            />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="contactos-titulo">
            <h2 className="section-title" id="contactos-titulo">
              Contactos de emergencia
            </h2>
            {susContactos.length > 0 ? (
              <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                {susContactos.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 p-3 rounded-sm border border-line-soft bg-bg">
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 font-semibold text-ink wrap-anywhere">
                        {nombreContacto(c)}
                        {c.esPrincipal && (
                          <Badge tone="info">
                            <Star size={11} strokeWidth={3} aria-hidden />
                            Principal
                          </Badge>
                        )}
                      </span>
                      <span className="text-sm text-ink-2">{c.parentesco || 'Parentesco no indicado'}</span>
                    </span>
                    <a
                      href={tel(c.telefono)}
                      className="inline-flex items-center gap-2 min-h-12 px-3 rounded-sm border border-blue bg-blue-100 text-navy text-sm font-semibold"
                      aria-label={`Llamar a ${nombreContacto(c)} (${c.parentesco}): ${c.telefono}`}
                    >
                      <Phone size={18} aria-hidden />
                      {c.telefono}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No hay contactos de emergencia registrados.</p>
            )}
          </section>

          {verSensible && (
            <section className="flex flex-col gap-3" aria-labelledby="condicion-titulo">
              <h2 className="section-title" id="condicion-titulo">
                Condición general
              </h2>
              {autonomia && (
                <p className="flex items-center gap-2 text-base text-ink">
                  <ShieldAlert size={20} className="text-blue" aria-hidden />
                  <span>
                    <span className="font-semibold">Autonomía:</span> {autonomia}
                  </span>
                </p>
              )}
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
            </section>
          )}

        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <section className="grid grid-cols-3 gap-3" aria-label="Resumen de seguimiento">
            <Kpi etiqueta="Última visita" valor={textoDias(sinVisita)} detalle={ultima ? fechaCorta(ultima.fin ?? ultima.fecha) : undefined} />
            <Kpi etiqueta="Necesidades pendientes" valor={String(pendientes)} />
            <Kpi etiqueta="Visitas realizadas" valor={String(completadas)} />
          </section>

          {(puede(user, 'visitas:registrar', adulto) || puede(user, 'necesidades:registrar', adulto)) && (
            <section className="flex flex-col gap-3" aria-labelledby="acciones-titulo">
              <h2 className="section-title" id="acciones-titulo">
                Acciones
              </h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {puede(user, 'visitas:registrar', adulto) && (
                  <ButtonLink variant="soft" fullWidth to={`${base}/visitas/nueva?adulto=${adulto.id}`} icon={<ClipboardPlus size={22} aria-hidden />}>
                    Registrar visita
                  </ButtonLink>
                )}
                {puede(user, 'necesidades:registrar', adulto) && (
                  <ButtonLink variant="soft" fullWidth to={`${base}/necesidades/nueva?adulto=${adulto.id}`} icon={<HandHeart size={22} aria-hidden />}>
                    Agregar necesidad
                  </ButtonLink>
                )}
              </div>
            </section>
          )}

          {verIndicaciones && (
            <section className="flex flex-col gap-3" aria-labelledby="indicaciones-titulo">
              <h2 className="section-title" id="indicaciones-titulo">
                Indicaciones médicas vigentes
              </h2>
              <p className="-mt-2 text-xs text-muted">Transcritas de lo indicado por personal de salud. Solo lectura.</p>
              {vigentes.length > 0 ? (
                <ul className="grid gap-3 m-0 p-0 list-none lg:grid-cols-2">
                  {vigentes.map((i) => (
                    <li key={i.id} className="flex gap-3 p-3 rounded-sm border border-line bg-bg">
                      <Pill size={22} className="text-blue flex-none mt-0.5" aria-hidden />
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <span className="font-semibold text-ink wrap-anywhere">{i.titulo}</span>
                        <span className="text-xs font-semibold text-ink-2">
                          {nombreCat(catalogos.tiposIndicacion, i.tipoIndicacionId)} · {i.frecuenciaHorario}
                        </span>
                        <p className="text-sm text-ink-2 wrap-anywhere">{i.descripcion}</p>
                        <span className="text-xs text-muted">
                          Desde {fechaCorta(i.fechaInicio)}
                          {i.fechaFin && ` hasta ${fechaCorta(i.fechaFin)}`}
                        </span>
                        {i.evidencia && (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                            <FileText size={12} aria-hidden /> Respaldo: {i.evidencia.startsWith('data:') ? 'imagen adjunta' : i.evidencia}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No hay indicaciones médicas vigentes.</p>
              )}
            </section>
          )}

          {verSensible && (
            <section className="flex flex-col gap-3" aria-labelledby="riesgos-titulo">
              <h2 className="section-title" id="riesgos-titulo">
                Historial de riesgos
              </h2>
              {susRiesgos.length > 0 ? (
                <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                  {susRiesgos.map((r) => (
                    <li key={r.id} className={`flex flex-col gap-1 p-3 rounded-sm border ${r.estado === 'vigente' ? 'border-line bg-bg' : 'border-line-soft bg-surface-2/50'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{nombreCat(catalogos.riesgos, r.riesgoId)}</span>
                        <RiesgoBadge riesgo={r.nivel} />
                      </div>
                      <p className="text-sm text-ink-2 wrap-anywhere">{r.motivo}</p>
                      {r.observacion && <p className="text-sm text-ink-2 italic wrap-anywhere">{r.observacion}</p>}
                      <p className="text-xs text-muted">
                        {fechaCorta(r.fecha)} · {r.estado === 'vigente' ? 'Vigente' : 'Superado'}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Sin factores de riesgo registrados.</p>
              )}
            </section>
          )}

          <section className="flex flex-col gap-3" aria-label="Historial del adulto">
            <div className="w-full md:max-w-[360px]">
              <Segmented<Pestana>
                label="Historial del adulto"
                value={pestana}
                onChange={setPestana}
                options={[
                  { value: 'necesidades', label: `Necesidades (${susNecesidades.length})` },
                  { value: 'visitas', label: `Visitas (${susVisitas.length})` },
                ]}
              />
            </div>
            {pestana === 'necesidades' ? (
              susNecesidades.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {susNecesidades.map((n) => (
                    <NecesidadCard key={n.id} necesidad={n} to={`${base}/necesidades/${n.id}`} />
                  ))}
                </div>
              ) : (
                <EmptyState title="Sin necesidades" text="Aún no se han registrado necesidades para esta persona." />
              )
            ) : susVisitas.length > 0 ? (
              <div className="flex flex-col gap-3">
                {susVisitas.map((v) => (
                  <VisitaCard key={v.id} visita={v} adulto={adulto} mostrarAdulto={false} to={`${base}/visitas/${v.id}`} />
                ))}
              </div>
            ) : (
              <EmptyState title="Sin visitas" text="Aún no hay visitas registradas para esta persona." />
            )}
          </section>
        </div>
      </div>
    </Page>
  )
}

function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="flex flex-col justify-between gap-1 min-h-20 px-3 py-2 rounded-sm border border-blue bg-blue-100">
      <span className="text-xs font-semibold text-ink">{etiqueta}</span>
      <span className="self-end text-lg font-bold leading-tight text-ink text-right">{valor}</span>
      {detalle && <span className="self-end text-xs text-ink-2">{detalle}</span>}
    </div>
  )
}
