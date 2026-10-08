import { useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useSession } from '@/domain/auth'
import { fechaLarga, relativo, todayISO } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Usuario } from '@/domain/types'
import { ButtonLink, EmptyState, StatTile } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { RIESGO_PESO, instanteVisita, ultimaVisitaDe } from '@/features/visitas/lib/dominio'
import { AdultoCard } from '../components/AdultoCard'
import { InvitacionOverlay } from '../components/InvitacionOverlay'
import { SelectorFamilia } from '../components/SelectorFamilia'
import { TODAS, useFamiliaSeleccionada } from '../lib/familia'
import styles from './Dashboard.module.css'

/** Pantalla Dashboard del cuidador (Figma 358:2270) con la Invitación (358:2356) encima cuando hay una pendiente. */
export function Dashboard() {
  const { user } = useSession()
  if (!user) return null
  return <Contenido user={user} />
}

/** Ruta `invitacion`: el mismo dashboard con la invitación pendiente; si no hay ninguna, vuelve al inicio. */
export function InvitacionRuta() {
  const { user } = useSession()
  const { base } = useShell()
  const invitaciones = useDB((s) => s.invitaciones)
  const hayPendiente = !!user && invitaciones.some((i) => i.estado === 'pendiente' && i.email.toLowerCase() === user.email.toLowerCase())
  if (!hayPendiente) return <Navigate to={base} replace />
  return <Dashboard />
}

function Contenido({ user }: { user: Usuario }) {
  const { base } = useShell()
  const navigate = useNavigate()
  const adultos = useDB((s) => s.adultos)
  const visitas = useDB((s) => s.visitas)
  const familias = useDB((s) => s.familias)
  const invitaciones = useDB((s) => s.invitaciones)
  const [familia, setFamilia] = useFamiliaSeleccionada(user.id, user.familiaIds)

  const misFamilias = useMemo(() => familias.filter((f) => user.familiaIds.includes(f.id)), [familias, user.familiaIds])

  const invitacion = useMemo(
    () => invitaciones.find((i) => i.estado === 'pendiente' && i.email.toLowerCase() === user.email.toLowerCase()),
    [invitaciones, user.email],
  )

  // Visitas de hoy del usuario: completadas vs. pendientes (las que están en curso cuentan como pendientes).
  const { completadas, pendientes } = useMemo(() => {
    const hoy = todayISO()
    const deHoy = visitas.filter((v) => v.cuidadorId === user.id && v.fecha === hoy && v.estado !== 'cancelada')
    const c = deHoy.filter((v) => v.estado === 'completada').length
    return { completadas: c, pendientes: deHoy.length - c }
  }, [visitas, user.id])

  // Personas prioritarias: mis adultos (de la familia elegida), de mayor a menor riesgo.
  const prioritarias = useMemo(
    () =>
      adultos
        .filter((a) => a.estado === 'activo' && a.cuidadorIds.includes(user.id) && (familia === TODAS || a.familiaId === familia))
        .sort((a, b) => RIESGO_PESO[a.riesgo] - RIESGO_PESO[b.riesgo] || a.nombre.localeCompare(b.nombre)),
    [adultos, user.id, familia],
  )

  const ultima = (adultoId: string) => {
    const v = ultimaVisitaDe(visitas, adultoId)
    return v ? relativo(instanteVisita(v)) : 'Sin visitas'
  }

  return (
    <Page wide leading={<SelectorFamilia familias={misFamilias} valor={familia} onChange={setFamilia} />}>
      <div className={styles.saludo}>
        <h1>Hola, {user.nombre}</h1>
        <p className={styles.enLinea}>
          <span className={styles.punto} aria-hidden />
          En línea
        </p>
      </div>

      <div className={styles.paneles}>
        <section className={styles.hoy} aria-labelledby="hoy-titulo">
          <header className={styles.hoyCabecera}>
            <div>
              <h2 id="hoy-titulo">Hoy</h2>
              <p className={styles.fecha}>{fechaLarga()}</p>
            </div>
            <Clock size={24} aria-hidden className={styles.reloj} />
          </header>
          <div className={styles.hoyCuerpo}>
            <h3>Visitas Asignadas</h3>
            <div className="grid-2">
              <StatTile label="Completadas" value={completadas} />
              <StatTile label="Pendientes" value={pendientes} />
            </div>
          </div>
        </section>

        <section className={styles.acciones} aria-labelledby="acciones-titulo">
          <h2 className="section-title" id="acciones-titulo">
            Acciones Rápidas
          </h2>
          <div className={styles.botones}>
            <ButtonLink variant="soft" fullWidth to={`${base}/visitas/nueva`}>
              Registrar Visita
            </ButtonLink>
            <ButtonLink variant="soft" fullWidth to={`${base}/necesidades/nueva`}>
              Registrar Necesidad
            </ButtonLink>
          </div>
        </section>
      </div>

      <section className="stack" aria-labelledby="prioritarias-titulo">
        <h2 className="section-title" id="prioritarias-titulo">
          Personas Prioritarias
        </h2>
        {prioritarias.length > 0 ? (
          <div className={styles.rejilla}>
            {prioritarias.map((a) => (
              <AdultoCard key={a.id} adulto={a} dato={{ label: 'Última Visita', value: ultima(a.id) }} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sin personas asignadas"
            text={familia === TODAS ? 'Aún no tienes adultos mayores asignados.' : 'No tienes adultos asignados en esta familia. Prueba con «Todas».'}
          />
        )}
      </section>

      {invitacion && (
        <InvitacionOverlay
          invitacion={invitacion}
          userId={user.id}
          onResuelta={(familiaId) => {
            if (familiaId) setFamilia(familiaId)
            navigate(base, { replace: true })
          }}
        />
      )}
    </Page>
  )
}
