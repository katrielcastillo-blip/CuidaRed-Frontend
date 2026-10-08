import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Cake, CircleUserRound, MapPin, Phone, UserCheck, VenusAndMars } from 'lucide-react'
import { Page, useShell } from '@/layouts/AppShell'
import { nombreCompleto } from '@/domain/auth'
import { useDB } from '@/domain/store'
import { fechaCorta, hhmmA12, hora12 } from '@/domain/dates'
import { EmptyState, InfoRow, Segmented } from '@/components/ui'
import { ActividadCard } from '../components/ActividadCard'
import { NoEncontrado } from '../components/NoEncontrado'
import {
  ESTADO_NECESIDAD,
  ESTADO_VISITA,
  masRecientesPrimero,
  TIPO_NECESIDAD,
  ultimaVisitaCompletada,
  useAdultoPropio,
} from '../lib'
import styles from './PerfilAdulto.module.css'

type Pestana = 'necesidades' | 'visitas'
const PESTANAS: Array<{ value: Pestana; label: string }> = [
  { value: 'necesidades', label: 'Necesidades' },
  { value: 'visitas', label: 'Visitas' },
]
const PILL = { alto: styles.pillAlto, medio: styles.pillMedio, bajo: styles.pillBajo } as const
const RIESGO_TEXTO = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' } as const

/**
 * Pantalla Perfil Envejeciente (358:3206 y 358:3354): son la MISMA pantalla con la pestaña "Necesidades" o "Visitas"
 * activa. La pestaña vive en ?tab= para que el botón atrás desde un detalle vuelva a la misma lista.
 * Móvil: una columna como el Figma. ≥768: dos columnas (datos | actividad).
 */
export default function PerfilAdulto() {
  const { adultoId } = useParams()
  const { base } = useShell()
  const [params, setParams] = useSearchParams()
  const pestana: Pestana = params.get('tab') === 'visitas' ? 'visitas' : 'necesidades'
  const adulto = useAdultoPropio(adultoId)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const usuarios = useDB((s) => s.usuarios)

  const susVisitas = useMemo(
    () => visitas.filter((v) => v.adultoId === adultoId).sort(masRecientesPrimero),
    [visitas, adultoId],
  )
  const susNecesidades = useMemo(
    () => necesidades.filter((n) => n.adultoId === adultoId).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)),
    [necesidades, adultoId],
  )
  const cuidadores = useMemo(
    () => (adulto ? usuarios.filter((u) => adulto.cuidadorIds.includes(u.id)).map(nombreCompleto) : []),
    [usuarios, adulto],
  )
  const nombreCuidador = (id: string) => {
    const u = usuarios.find((x) => x.id === id)
    return u ? nombreCompleto(u) : 'Sin asignar'
  }

  if (!adulto) {
    return <NoEncontrado titulo="Perfil Envejeciente" mensaje="Este envejeciente no existe o no pertenece a tu familia." />
  }

  const ultima = ultimaVisitaCompletada(visitas, adulto.id)
  const activas = susNecesidades.filter((n) => n.estado === 'activa').length
  const nombre = nombreCompleto(adulto)
  const fechaNac = adulto.fechaNacimiento.split('-').reverse().join('/')

  return (
    <Page title="Perfil Envejeciente" back={base} hideAvatar wide>
      <div className={styles.layout}>
        <section className={styles.datos} aria-label="Datos del envejeciente">
          <header className={styles.hero}>
            <CircleUserRound className={styles.foto} size={111} strokeWidth={1.6} aria-hidden />
            <h1 className={styles.nombre}>{nombre}</h1>
            <p className={styles.cedula}>{adulto.cedula}</p>
            <span className={`${styles.pill} ${PILL[adulto.riesgo]}`}>{RIESGO_TEXTO[adulto.riesgo]}</span>
          </header>

          <div className="stack-lg">
            <h2 className="section-title">Información Personal</h2>
            <div className="stack-lg">
              <InfoRow icon={<Cake size={24} aria-hidden />} label="Fecha de Nacimiento" value={fechaNac} />
              <InfoRow icon={<Phone size={24} aria-hidden />} label="Teléfono" value={adulto.telefono} />
              <InfoRow icon={<VenusAndMars size={24} aria-hidden />} label="Sexo" value={adulto.sexo} />
              <InfoRow
                icon={<Phone size={24} aria-hidden />}
                label="Contacto de Emergencia"
                value={`${adulto.contactoEmergencia.nombre} · ${adulto.contactoEmergencia.telefono}`}
              />
              <InfoRow icon={<MapPin size={24} aria-hidden />} label="Zona" value={`${adulto.zona}, ${adulto.municipio}`} />
              <InfoRow
                icon={<UserCheck size={24} aria-hidden />}
                label="Cuidador asignado"
                value={cuidadores.length ? cuidadores.join(', ') : 'Sin cuidador asignado'}
              />
            </div>
          </div>
        </section>

        <section className={styles.actividad} aria-label="Actividad">
          <div className={styles.stats}>
            <div className={styles.mini}>
              <span className={styles.miniEtiqueta}>Última Visita</span>
              <span className={styles.miniFecha}>{ultima ? fechaCorta(ultima.fecha) : 'Sin visitas'}</span>
            </div>
            <div className={styles.mini}>
              <span className={styles.miniEtiqueta}>Necesidades Activas</span>
              <span className={styles.miniNumero}>{activas}</span>
            </div>
          </div>

          <div className={styles.tabs}>
            <Segmented
              label="Actividad del envejeciente"
              value={pestana}
              options={PESTANAS}
              onChange={(v) => setParams(v === 'necesidades' ? {} : { tab: v }, { replace: true })}
            />
          </div>

          {pestana === 'necesidades' ? (
            susNecesidades.length ? (
              <div className="grid-auto">
                {susNecesidades.map((n) => (
                  <ActividadCard
                    key={n.id}
                    to={`${base}/necesidades/${n.id}`}
                    fecha={`${fechaCorta(n.creadaEn)} - ${hora12(n.creadaEn)}`}
                    titulo={TIPO_NECESIDAD[n.tipo].label}
                    detalle={n.descripcion}
                    estado={{ label: ESTADO_NECESIDAD[n.estado].label, tono: ESTADO_NECESIDAD[n.estado].tono }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="Sin necesidades" text={`${adulto.nombre} no tiene necesidades registradas.`} />
            )
          ) : susVisitas.length ? (
            <div className="grid-auto">
              {susVisitas.map((v) => (
                <ActividadCard
                  key={v.id}
                  to={`${base}/visitas/${v.id}`}
                  fecha={`${fechaCorta(v.fecha)} - ${v.inicio ? hora12(v.inicio) : hhmmA12(v.horaPautada)}`}
                  titulo={v.tipo}
                  detalle={`Cuidador: ${nombreCuidador(v.cuidadorId)}`}
                  estado={ESTADO_VISITA[v.estado]}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="Sin visitas" text={`${adulto.nombre} aún no tiene visitas registradas.`} />
          )}
        </section>
      </div>
    </Page>
  )
}
