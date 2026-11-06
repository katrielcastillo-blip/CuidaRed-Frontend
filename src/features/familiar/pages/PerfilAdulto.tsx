/*
 * PerfilAdulto.tsx — Perfil de SOLO LECTURA del envejeciente para su familiar responsable (CU-04 consulta ·
 * CU-06 historial de visitas · CU-08 estado de necesidades · RF-15 indicaciones). Muestra lo que le corresponde
 * ver: datos básicos (nombre, edad, nacimiento, cédula, teléfono, sexo, dirección), contactos de emergencia,
 * solo los NOMBRES de los cuidadores y voluntarios asignados, y tres pestañas: Necesidades, Visitas e
 * Indicaciones médicas vigentes (con el aviso "información transcrita, no sustituye al médico").
 * NO muestra evaluación de riesgo, condición general ni situación social: la familia no tiene
 * `adultos:ver-sensible` (Ley 42-01). No hay acciones de edición. Un id que no está autorizado en la cuenta
 * activa → "No encontrado o sin permiso". Pestaña en ?tab=necesidades|visitas|indicaciones.
 * Los datos llegan de `useEnvejecienteFamiliar` y de un hook por pestaña (hoy el store; mañana la API).
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, Cake, CircleUserRound, HeartHandshake, IdCard, Lock, MapPin, Phone, UserCheck, VenusAndMars } from 'lucide-react'
import { Badge, InfoRow, Segmented } from '@/components/ui'
import { hhmmA12, fechaCorta } from '@/domain/dates'
import { Page, useShell } from '@/layouts/AppShell'
import { PestanaIndicaciones, PestanaNecesidades, PestanaVisitas } from '../components/PestanasPerfil'
import { SinDatos } from '../components/SinDatos'
import { useEnvejecienteFamiliar } from '../lib/datos'
import { etiquetaDia, haceDias } from '../lib/etiquetas'

const TITULO = 'Perfil del adulto mayor'

type Pestana = 'necesidades' | 'visitas' | 'indicaciones'
const PESTANAS: Array<{ value: Pestana; label: string }> = [
  { value: 'necesidades', label: 'Necesidades' },
  { value: 'visitas', label: 'Visitas' },
  { value: 'indicaciones', label: 'Indicaciones' },
]
const PANEL: Record<Pestana, string> = { necesidades: 'Necesidades', visitas: 'Historial de visitas', indicaciones: 'Indicaciones médicas' }

export default function PerfilAdulto() {
  const { adultoId } = useParams()
  const { base } = useShell()
  const [params, setParams] = useSearchParams()
  const consulta = useEnvejecienteFamiliar(adultoId)

  if (consulta.estado !== 'listo') return <SinDatos consulta={consulta} titulo={TITULO} />
  const p = consulta.datos
  const s = p.seguimiento

  // Sin el permiso `indicaciones:ver` la pestaña no existe.
  const opciones = p.permisos.indicaciones ? PESTANAS : PESTANAS.filter((o) => o.value !== 'indicaciones')
  const pestana = opciones.find((o) => o.value === params.get('tab'))?.value ?? 'necesidades'
  const nombres = p.nombre.split(' ')[0] ?? p.nombre
  const sinPersonal = p.cuidadores.length === 0 && p.voluntarios.length === 0

  return (
    <Page title={TITULO} back={base} hideAvatar wide>
      <div className="flex flex-col gap-8 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start">
        <section className="flex flex-col gap-6 min-w-0" aria-label="Datos del adulto mayor">
          <header className="flex flex-col items-center gap-0.5 text-center">
            <CircleUserRound className="mb-3 text-blue-bright" size={104} strokeWidth={1.6} aria-hidden />
            <h2 className="text-2xl font-bold text-[#003f9e] wrap-anywhere">{p.nombre}</h2>
            <p className="text-base text-muted">{p.edad} años</p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">{p.vinculo && <Badge tone="info">Tu vínculo: {p.vinculo}</Badge>}</div>
          </header>

          <div className="flex flex-col gap-5">
            <h3 className="section-title">Información personal</h3>
            <InfoRow icon={<Cake size={24} aria-hidden />} label="Fecha de nacimiento" value={p.fechaNacimiento.split('-').reverse().join('/')} />
            <InfoRow icon={<IdCard size={24} aria-hidden />} label="Cédula" value={p.cedula || '—'} />
            <InfoRow
              icon={<Phone size={24} aria-hidden />}
              label="Teléfono"
              value={
                p.telefono ? (
                  <a href={`tel:${p.telefono.replace(/\s/g, '')}`} className="inline-flex items-center min-h-12 -my-3 font-semibold text-navy hover:underline">
                    {p.telefono}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <InfoRow icon={<VenusAndMars size={24} aria-hidden />} label="Sexo" value={p.sexo} />
            <InfoRow icon={<MapPin size={24} aria-hidden />} label="Dirección" value={p.direccion || '—'} />
            {sinPersonal ? (
              <InfoRow icon={<UserCheck size={24} aria-hidden />} label="Personal asignado" value="Sin cuidador ni voluntario asignado" />
            ) : (
              <>
                {p.cuidadores.length > 0 && <InfoRow icon={<UserCheck size={24} aria-hidden />} label="Cuidadores asignados" value={p.cuidadores.join(', ')} />}
                {p.voluntarios.length > 0 && <InfoRow icon={<HeartHandshake size={24} aria-hidden />} label="Voluntarios asignados" value={p.voluntarios.join(', ')} />}
              </>
            )}
            <InfoRow icon={<CalendarDays size={24} aria-hidden />} label="En seguimiento desde" value={fechaCorta(p.registradoEn)} />
          </div>

          <section className="flex flex-col gap-3" aria-labelledby="contactos-emergencia">
            <h3 id="contactos-emergencia" className="section-title">
              Contactos de emergencia
            </h3>
            {p.contactos.length === 0 ? (
              <p className="text-sm text-muted">No hay contactos de emergencia registrados. Pide al equipo de la cuenta que los añada.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {p.contactos.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 p-3 rounded-sm border border-line bg-bg">
                    <span className="flex flex-col flex-1 min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-base text-ink wrap-anywhere">{c.nombre}</strong>
                        {c.principal && <Badge tone="info">Principal</Badge>}
                      </span>
                      <span className="text-sm text-muted">{c.parentesco || 'Parentesco no indicado'}</span>
                    </span>
                    <a
                      href={`tel:${c.telefono.replace(/\s/g, '')}`}
                      className="inline-flex items-center gap-2 min-h-12 px-3 rounded-sm bg-blue-100 border border-blue text-sm font-bold text-navy whitespace-nowrap hover:bg-[#d6e8f8]"
                      aria-label={`Llamar a ${c.nombre} al ${c.telefono}`}
                    >
                      <Phone size={18} aria-hidden /> {c.telefono}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="flex items-start gap-2 p-3 rounded-sm bg-surface-2 text-sm text-ink-2">
            <Lock size={18} className="flex-none mt-0.5" aria-hidden />
            <span>Por privacidad, la evaluación de riesgo, la condición general y la situación social solo las ve el equipo de la cuenta.</span>
          </p>
        </section>

        <section className="flex flex-col gap-6 min-w-0" aria-label="Seguimiento">
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <Mini etiqueta="Última visita" valor={s.ultimaVisita ? etiquetaDia(s.ultimaVisita.fecha) : 'Sin visitas'} nota={s.ultimaVisita ? haceDias(s.diasSinContacto) : undefined} />
            <Mini
              etiqueta="Próxima visita"
              valor={s.proximaVisita ? etiquetaDia(s.proximaVisita.fecha) : 'Sin programar'}
              nota={s.proximaVisita ? hhmmA12(s.proximaVisita.horaPautada) : undefined}
            />
            <Mini etiqueta="Necesidades abiertas" valor={String(s.necesidadesAbiertasTotal)} grande />
          </div>

          <div className="w-full max-w-[460px] mx-auto">
            <Segmented
              label="Seguimiento del adulto mayor"
              value={pestana}
              options={opciones}
              onChange={(v) => setParams(v === 'necesidades' ? {} : { tab: v }, { replace: true })}
            />
          </div>

          <div role="tabpanel" aria-label={PANEL[pestana]}>
            {pestana === 'necesidades' ? (
              <PestanaNecesidades adultoId={p.id} base={base} nombres={nombres} />
            ) : pestana === 'visitas' ? (
              <PestanaVisitas adultoId={p.id} base={base} nombres={nombres} />
            ) : (
              <PestanaIndicaciones adultoId={p.id} />
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
