/*
 * PerfilAdulto.tsx — Perfil del adulto mayor para su familiar responsable (CU-04 consulta · CU-06 historial de
 * visitas · CU-08 estado de necesidades). Solo lectura. Muestra lo que la BD guarda y le corresponde ver:
 *  - Envejeciente: nombres, fecha de nacimiento, cédula, teléfono, sexo, dirección completa (Env_Direccion +
 *    Municipio + Provincia) y fecha de registro; tipo de vínculo del usuario (Vinculo · Tipo_vinculo) y
 *    voluntarios asignados.
 *  - Contacto_emergencia: todos los contactos con parentesco, teléfono y cuál es el principal.
 *  - Visitas (Visita + DetalleVisita): también aquellas en las que el adulto es adulto adicional del hogar, con
 *    el motivo (Visit_razon) y la observación registrada PARA este adulto (observacionPara).
 *  - Env_Necesidad: necesidad del catálogo, prioridad, cantidad/unidad, recurrencia, estado y resolución.
 * NO muestra indicaciones médicas, historial de riesgos ni condición general: el familiar no tiene los permisos
 * "indicaciones:ver" ni "adultos:ver-sensible" (SRS §8.2.2.3.4 c/d · Ley 42-01). Un adulto sin vínculo →
 * "No encontrado o sin permiso". Pestañas Necesidades | Visitas en ?tab=.
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, Cake, CircleUserRound, HeartHandshake, IdCard, Lock, MapPin, Phone, Repeat, UserCheck, Users, VenusAndMars } from 'lucide-react'
import { Badge, EmptyState, InfoRow, RiesgoBadge, Segmented } from '@/components/ui'
import { nombreCompleto, useUser } from '@/domain/auth'
import { edad, fechaCorta, hhmmA12, hora12 } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { contactosDe, direccionCompleta, nombreContacto, observacionPara, visitaIncluye, voluntariosDe } from '@/domain/relaciones'
import { diasSinVisita, ultimaVisitaCompletada } from '@/domain/reglas'
import { useDB } from '@/domain/store'
import { Page, useShell } from '@/layouts/AppShell'
import { ActividadCard } from '../components/ActividadCard'
import { NoEncontrado } from '../components/NoEncontrado'
import {
  cantidadTexto,
  ESTADO_NECESIDAD,
  ESTADO_VISITA,
  etiquetaDia,
  haceDias,
  masRecientesPrimero,
  necesidadAbierta,
  PRIORIDAD,
  proximasVisitas,
  TIPO_NECESIDAD,
  useAdultoPropio,
  useVinculo,
} from '../lib'

type Pestana = 'necesidades' | 'visitas'
const PESTANAS: Array<{ value: Pestana; label: string }> = [
  { value: 'necesidades', label: 'Necesidades' },
  { value: 'visitas', label: 'Visitas' },
]

export default function PerfilAdulto() {
  const { adultoId } = useParams()
  const { base } = useShell()
  const user = useUser()
  const [params, setParams] = useSearchParams()
  const pestana: Pestana = params.get('tab') === 'visitas' ? 'visitas' : 'necesidades'
  const adulto = useAdultoPropio(adultoId)
  const vinculo = useVinculo(adulto?.id)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const usuarios = useDB((s) => s.usuarios)
  const contactos = useDB((s) => s.contactos)
  const vinculos = useDB((s) => s.vinculos)
  const catalogos = useDB((s) => s.catalogos)

  const susVisitas = useMemo(() => (adulto ? visitas.filter((v) => visitaIncluye(v, adulto.id)).sort(masRecientesPrimero) : []), [visitas, adulto])
  const susNecesidades = useMemo(
    () =>
      adulto
        ? necesidades
            .filter((n) => n.adultoId === adulto.id)
            .sort((a, b) => Number(necesidadAbierta(b.estado)) - Number(necesidadAbierta(a.estado)) || b.creadaEn.localeCompare(a.creadaEn))
        : [],
    [necesidades, adulto],
  )
  const susContactos = useMemo(() => (adulto ? contactosDe(contactos, adulto.id) : []), [contactos, adulto])
  const voluntarios = useMemo(
    () =>
      adulto
        ? voluntariosDe(vinculos, adulto.id)
            .map((id) => usuarios.find((u) => u.id === id))
            .filter((u) => !!u && u.estado === 'activo')
            .map((u) => nombreCompleto(u!))
        : [],
    [vinculos, usuarios, adulto],
  )
  const nombreDe = (id: string) => {
    const u = usuarios.find((x) => x.id === id)
    return u ? nombreCompleto(u) : 'Sin asignar'
  }
  const nombreNecesidad = (catalogoId?: string) => catalogos.necesidades.find((c) => c.id === catalogoId)?.nombre

  if (!adulto) return <NoEncontrado titulo="Perfil del adulto mayor" />

  const verSensible = puede(user, 'adultos:ver-sensible', adulto)
  const ultima = ultimaVisitaCompletada(visitas, adulto.id)
  const { dias } = diasSinVisita({ visitas }, adulto)
  const proxima = proximasVisitas(visitas, adulto.id)[0]
  const abiertas = susNecesidades.filter((n) => necesidadAbierta(n.estado)).length
  const fechaNac = adulto.fechaNacimiento.split('-').reverse().join('/')
  const direccion = direccionCompleta(catalogos, adulto)

  return (
    <Page title="Perfil del adulto mayor" back={base} hideAvatar wide>
      <div className="flex flex-col gap-8 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start">
        <section className="flex flex-col gap-6 min-w-0" aria-label="Datos del adulto mayor">
          <header className="flex flex-col items-center gap-0.5 text-center">
            <CircleUserRound className="mb-3 text-blue-bright" size={104} strokeWidth={1.6} aria-hidden />
            <h2 className="text-2xl font-bold text-[#003f9e] wrap-anywhere">{nombreCompleto(adulto)}</h2>
            <p className="text-base text-muted">{edad(adulto.fechaNacimiento)} años</p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {vinculo && <Badge tone="info">Tu vínculo: {vinculo}</Badge>}
              {verSensible && <RiesgoBadge riesgo={adulto.riesgo} />}
            </div>
          </header>

          <div className="flex flex-col gap-5">
            <h3 className="section-title">Información personal</h3>
            <InfoRow icon={<Cake size={24} aria-hidden />} label="Fecha de nacimiento" value={fechaNac} />
            <InfoRow icon={<IdCard size={24} aria-hidden />} label="Cédula" value={adulto.cedula || '—'} />
            <InfoRow
              icon={<Phone size={24} aria-hidden />}
              label="Teléfono"
              value={
                adulto.telefono ? (
                  <a
                    href={`tel:${adulto.telefono.replace(/\s/g, '')}`}
                    className="inline-flex items-center min-h-12 -my-3 font-semibold text-navy hover:underline"
                  >
                    {adulto.telefono}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <InfoRow icon={<VenusAndMars size={24} aria-hidden />} label="Sexo" value={adulto.sexo} />
            <InfoRow icon={<MapPin size={24} aria-hidden />} label="Dirección" value={direccion || '—'} />
            <InfoRow
              icon={<UserCheck size={24} aria-hidden />}
              label="Voluntarios asignados"
              value={voluntarios.length ? voluntarios.join(', ') : 'Sin voluntario asignado'}
            />
            <InfoRow icon={<CalendarDays size={24} aria-hidden />} label="En seguimiento desde" value={fechaCorta(adulto.creadoEn)} />
          </div>

          <section className="flex flex-col gap-3" aria-labelledby="contactos-emergencia">
            <h3 id="contactos-emergencia" className="section-title">
              Contactos de emergencia
            </h3>
            {susContactos.length === 0 ? (
              <p className="text-sm text-muted">No hay contactos de emergencia registrados. Pide a la organización que los añada.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {susContactos.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 p-3 rounded-sm border border-line bg-bg">
                    <span className="flex flex-col flex-1 min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-base text-ink wrap-anywhere">{nombreContacto(c)}</strong>
                        {c.esPrincipal && <Badge tone="info">Principal</Badge>}
                      </span>
                      <span className="text-sm text-muted">{c.parentesco || 'Parentesco no indicado'}</span>
                    </span>
                    <a
                      href={`tel:${c.telefono.replace(/\s/g, '')}`}
                      className="inline-flex items-center gap-2 min-h-12 px-3 rounded-sm bg-blue-100 border border-blue text-sm font-bold text-navy whitespace-nowrap hover:bg-[#d6e8f8]"
                      aria-label={`Llamar a ${nombreContacto(c)} al ${c.telefono}`}
                    >
                      <Phone size={18} aria-hidden /> {c.telefono}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!verSensible && (
            <p className="flex items-start gap-2 p-3 rounded-sm bg-surface-2 text-sm text-ink-2">
              <Lock size={18} className="flex-none mt-0.5" aria-hidden />
              <span>
                Por privacidad, la evaluación de riesgo, las indicaciones médicas y la información de salud y situación social solo las ve el equipo de la
                organización.
              </span>
            </p>
          )}
        </section>

        <section className="flex flex-col gap-6 min-w-0" aria-label="Seguimiento">
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <Mini etiqueta="Última visita" valor={ultima ? etiquetaDia(ultima.fecha) : 'Sin visitas'} nota={ultima ? haceDias(dias) : undefined} />
            <Mini
              etiqueta="Próxima visita"
              valor={proxima ? etiquetaDia(proxima.fecha) : 'Sin programar'}
              nota={proxima ? hhmmA12(proxima.horaPautada) : undefined}
            />
            <Mini etiqueta="Necesidades abiertas" valor={String(abiertas)} grande />
          </div>

          <div className="w-full max-w-[320px] mx-auto">
            <Segmented
              label="Seguimiento del adulto mayor"
              value={pestana}
              options={PESTANAS}
              onChange={(v) => setParams(v === 'necesidades' ? {} : { tab: v }, { replace: true })}
            />
          </div>

          <div role="tabpanel" aria-label={pestana === 'necesidades' ? 'Necesidades' : 'Historial de visitas'}>
            {pestana === 'necesidades' ? (
              susNecesidades.length ? (
                <div className="grid-auto">
                  {susNecesidades.map((n) => {
                    const cantidad = cantidadTexto(n)
                    return (
                      <ActividadCard
                        key={n.id}
                        to={`${base}/necesidades/${n.id}`}
                        fecha={`${fechaCorta(n.creadaEn)} · ${hora12(n.creadaEn)}`}
                        titulo={nombreNecesidad(n.catalogoId) ?? TIPO_NECESIDAD[n.tipo].label}
                        detalle={n.descripcion}
                        estado={ESTADO_NECESIDAD[n.estado]}
                        pendienteSync={n.pendienteSync}
                        extra={
                          <>
                            <span className="flex flex-wrap items-center gap-2">
                              <Badge tone={PRIORIDAD[n.prioridad].tono}>{PRIORIDAD[n.prioridad].label}</Badge>
                              <span className="text-muted">{TIPO_NECESIDAD[n.tipo].label}</span>
                            </span>
                            {(cantidad || n.recurrente) && (
                              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                {cantidad && <span>Cantidad: {cantidad}</span>}
                                {n.recurrente && (
                                  <span className="inline-flex items-center gap-1">
                                    <Repeat size={14} aria-hidden /> Recurrente
                                  </span>
                                )}
                              </span>
                            )}
                            {(n.estado === 'satisfecha' || n.estado === 'inactiva') && (n.satisfechaEn || n.motivoResolucion) && (
                              <span className="text-success-700">
                                {n.satisfechaEn ? `Resuelta el ${fechaCorta(n.satisfechaEn)}` : 'Cerrada'}
                                {n.motivoResolucion ? `: ${n.motivoResolucion}` : ''}
                              </span>
                            )}
                          </>
                        }
                      />
                    )
                  })}
                </div>
              ) : (
                <EmptyState title="Sin necesidades" text={`${adulto.nombre} no tiene necesidades registradas.`} />
              )
            ) : susVisitas.length ? (
              <div className="grid-auto">
                {susVisitas.map((v) => {
                  const compartida = v.adultoId !== adulto.id || v.detallesAdicionales.length > 0
                  const observacion = v.estado === 'completada' ? observacionPara(v, adulto.id) : undefined
                  return (
                    <ActividadCard
                      key={v.id}
                      to={`${base}/visitas/${v.id}?adulto=${adulto.id}`}
                      fecha={`${fechaCorta(v.fecha)} · ${v.inicio ? hora12(v.inicio) : hhmmA12(v.horaPautada)}`}
                      titulo={v.razon || v.tipo}
                      detalle={`Responsable: ${nombreDe(v.cuidadorId)}`}
                      estado={ESTADO_VISITA[v.estado]}
                      pendienteSync={v.pendienteSync}
                      extra={
                        compartida || observacion ? (
                          <>
                            {compartida && (
                              <span className="inline-flex items-center gap-1.5 text-muted">
                                <Users size={14} aria-hidden /> Visita compartida con otros adultos del hogar
                              </span>
                            )}
                            {observacion && (
                              <span className="line-clamp-2">
                                <HeartHandshake size={14} className="inline -mt-0.5 mr-1 text-navy" aria-hidden />
                                <span className="font-semibold">Observación: </span>
                                {observacion}
                              </span>
                            )}
                          </>
                        ) : undefined
                      }
                    />
                  )
                })}
              </div>
            ) : (
              <EmptyState title="Sin visitas" text={`${adulto.nombre} aún no tiene visitas registradas.`} />
            )}
          </div>
        </section>
      </div>
    </Page>
  )
}

function Mini({ etiqueta, valor, nota, grande }: { etiqueta: string; valor: string; nota?: string; grande?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 min-h-[86px] px-1.5 py-2 text-center rounded-sm bg-blue-100 border border-blue">
      <span className="text-xs font-semibold leading-tight text-ink">{etiqueta}</span>
      <span className={grande ? 'text-3xl font-bold leading-none text-ink' : 'text-base font-bold leading-tight text-ink'}>{valor}</span>
      {nota && <span className="text-xs text-ink-2">{nota}</span>}
    </div>
  )
}
