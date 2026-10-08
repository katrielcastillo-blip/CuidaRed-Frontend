import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Cake, CircleUserRound, MapPin, Phone, VenusAndMars } from 'lucide-react'
import { nombreCompleto } from '@/domain/auth'
import { fechaCorta } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { ButtonLink, EmptyState, InfoRow, Segmented } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { NecesidadCard } from '@/features/visitas/components/NecesidadCard'
import { VisitaCard } from '@/features/visitas/components/VisitaCard'
import { porFechaDesc, RIESGO_ETIQUETA, ultimaVisitaDe } from '@/features/visitas/lib/dominio'
import styles from './PerfilEnvejeciente.module.css'

type Pestana = 'necesidades' | 'visitas'

/** Perfil Envejeciente (Figma 358:2175): datos del adulto y su actividad (necesidades y visitas). */
export function PerfilEnvejeciente() {
  const { adultoId } = useParams()
  const adultos = useDB((s) => s.adultos)
  const adulto = useMemo(() => adultos.find((a) => a.id === adultoId), [adultos, adultoId])

  if (!adulto) {
    return (
      <Page title="Perfil Envejeciente" back>
        <EmptyState title="Adulto no encontrado" text="El perfil que buscas no existe o ya no está disponible." />
      </Page>
    )
  }
  return <Contenido adulto={adulto} />
}

function Contenido({ adulto }: { adulto: Adulto }) {
  const { base } = useShell()
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const [pestana, setPestana] = useState<Pestana>('necesidades')

  const susVisitas = useMemo(() => visitas.filter((v) => v.adultoId === adulto.id).sort(porFechaDesc), [visitas, adulto.id])
  const susNecesidades = useMemo(
    () => necesidades.filter((n) => n.adultoId === adulto.id).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)),
    [necesidades, adulto.id],
  )
  const activas = susNecesidades.filter((n) => n.estado === 'activa').length
  const ultima = ultimaVisitaDe(visitas, adulto.id)

  return (
    <Page title="Perfil Envejeciente" back wide>
      <div className={styles.layout}>
        <div className={styles.datos}>
          <header className={styles.hero}>
            <CircleUserRound size={111} strokeWidth={1.4} className={styles.avatar} aria-hidden />
            <h2 className={styles.nombre}>{nombreCompleto(adulto)}</h2>
            <p className={styles.cedula}>{adulto.cedula}</p>
            <span className={`${styles.riesgo} ${styles[adulto.riesgo]}`}>{RIESGO_ETIQUETA[adulto.riesgo]}</span>
          </header>

          <section className="stack" aria-labelledby="info-titulo">
            <h2 className="section-title" id="info-titulo">
              Información Personal
            </h2>
            <InfoRow icon={<Cake size={24} aria-hidden />} label="Fecha de Nacimiento" value={fechaCorta(adulto.fechaNacimiento)} />
            <InfoRow
              icon={<Phone size={24} aria-hidden />}
              label="Teléfono"
              value={<a href={`tel:${adulto.telefono.replace(/\s/g, '')}`}>{adulto.telefono}</a>}
            />
            <InfoRow icon={<VenusAndMars size={24} aria-hidden />} label="Sexo" value={adulto.sexo} />
            <InfoRow icon={<MapPin size={24} aria-hidden />} label="Zona" value={`${adulto.zona}, ${adulto.municipio}`} />
            <InfoRow
              icon={<Phone size={24} aria-hidden />}
              label="Contacto de Emergencia"
              value={
                <>
                  {adulto.contactoEmergencia.nombre} ·{' '}
                  <a href={`tel:${adulto.contactoEmergencia.telefono.replace(/\s/g, '')}`}>{adulto.contactoEmergencia.telefono}</a>
                </>
              }
            />
          </section>
        </div>

        <div className={styles.actividad}>
          <section className={styles.kpis} aria-label="Resumen">
            <div className={styles.kpi}>
              <span className={styles.etiqueta}>Última Visita</span>
              <span className={styles.valor}>{ultima ? fechaCorta(ultima.fin ?? ultima.inicio ?? ultima.fecha) : 'Sin visitas'}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.etiqueta}>Necesidades Activas</span>
              <span className={styles.valor}>{activas}</span>
            </div>
          </section>

          <section className="stack" aria-labelledby="acciones-titulo">
            <h2 className="section-title" id="acciones-titulo">
              Acciones Rápidas
            </h2>
            <div className={styles.acciones}>
              <ButtonLink variant="soft" fullWidth to={`${base}/visitas/nueva?adulto=${adulto.id}`}>
                Registrar Visita
              </ButtonLink>
              <ButtonLink variant="soft" fullWidth to={`${base}/necesidades/nueva?adulto=${adulto.id}`}>
                Registrar Necesidad
              </ButtonLink>
            </div>
          </section>

          <section className="stack" aria-label="Actividad">
            <div className={styles.pestanas}>
              <Segmented<Pestana>
                label="Actividad del adulto"
                value={pestana}
                onChange={setPestana}
                options={[
                  { value: 'necesidades', label: 'Necesidades' },
                  { value: 'visitas', label: 'Visitas' },
                ]}
              />
            </div>
            {pestana === 'necesidades' ? (
              susNecesidades.length > 0 ? (
                <div className={styles.lista}>
                  {susNecesidades.map((n) => (
                    <NecesidadCard key={n.id} necesidad={n} adulto={adulto} to={`${base}/necesidades/${n.id}`} />
                  ))}
                </div>
              ) : (
                <EmptyState title="Sin necesidades" text="Aún no se han registrado necesidades para esta persona." />
              )
            ) : susVisitas.length > 0 ? (
              <div className={styles.lista}>
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
