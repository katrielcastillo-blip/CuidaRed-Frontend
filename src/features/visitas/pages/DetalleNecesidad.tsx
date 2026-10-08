import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { nombreCompleto, useSession } from '@/domain/auth'
import { fechaCorta, hora12 } from '@/domain/dates'
import { mutate, useDB } from '@/domain/store'
import type { Adulto, Necesidad } from '@/domain/types'
import { Button, EmptyState, RiesgoBadge, useToast } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { ESTADO_NECESIDAD, estiloPunto, tipoNecesidad } from '../lib/dominio'
import comun from './Comun.module.css'
import styles from './DetalleNecesidad.module.css'

/** Detalle Necesidad (Figma 358:3008, que en el archivo se llama "Detalle Visita"). El coordinador puede marcarla como satisfecha. */
export function DetalleNecesidad() {
  const { necesidadId } = useParams()
  const necesidades = useDB((s) => s.necesidades)
  const adultos = useDB((s) => s.adultos)
  const necesidad = useMemo(() => necesidades.find((n) => n.id === necesidadId), [necesidades, necesidadId])
  const adulto = useMemo(() => adultos.find((a) => a.id === necesidad?.adultoId), [adultos, necesidad])

  if (!necesidad || !adulto) {
    return (
      <Page title="Detalle Necesidad" back>
        <div className={comun.vacio}>
          <EmptyState title="Necesidad no encontrada" text="La necesidad que buscas no existe o fue eliminada." />
        </div>
      </Page>
    )
  }
  return <Contenido necesidad={necesidad} adulto={adulto} />
}

function Contenido({ necesidad, adulto }: { necesidad: Necesidad; adulto: Adulto }) {
  const { user } = useSession()
  const { base } = useShell()
  const toast = useToast()
  const usuarios = useDB((s) => s.usuarios)

  const tipo = tipoNecesidad(necesidad.tipo)
  const estado = ESTADO_NECESIDAD[necesidad.estado]
  const registradaPor = usuarios.find((u) => u.id === necesidad.registradaPor)
  const satisfechaPor = usuarios.find((u) => u.id === necesidad.satisfechaPor)
  const puedeSatisfacer = user?.rol === 'coordinador' && necesidad.estado !== 'satisfecha'

  function satisfacer() {
    if (!user) return
    mutate((db) => {
      const n = db.necesidades.find((x) => x.id === necesidad.id)
      if (n) {
        n.estado = 'satisfecha'
        n.satisfechaEn = new Date().toISOString()
        n.satisfechaPor = user.id
      }
    })
    toast('Necesidad marcada como satisfecha')
  }

  return (
    <Page title="Detalle Necesidad" back>
      <div className={comun.cuerpo}>
        <article className={styles.tarjeta}>
          <span className={styles.medallon}>
            <tipo.icon size={47} strokeWidth={1.5} aria-hidden />
          </span>
          <h2 className={styles.tipo}>{tipo.label}</h2>

          <div className={styles.adulto}>
            <h3 className={styles.nombre}>{nombreCompleto(adulto)}</h3>
            <RiesgoBadge riesgo={adulto.riesgo} />
            <Link to={`${base}/adultos/${adulto.id}`} className={styles.perfil}>
              Ver perfil
            </Link>
          </div>

          <div className={styles.datos}>
            <p className={comun.estado} style={estiloPunto(estado.dot)}>
              <span className={comun.punto} aria-hidden />
              {estado.label}
            </p>
            <ul className={comun.meta}>
              <li>Fecha: {fechaCorta(necesidad.creadaEn)}</li>
              <li>Hora: {hora12(necesidad.creadaEn)}</li>
              {registradaPor && <li>Registrada por: {nombreCompleto(registradaPor)}</li>}
              {necesidad.satisfechaEn && (
                <li>
                  Satisfecha el {fechaCorta(necesidad.satisfechaEn)}
                  {satisfechaPor ? ` por ${nombreCompleto(satisfechaPor)}` : ''}
                </li>
              )}
            </ul>
            <h3 className={comun.subtitulo}>Descripción</h3>
            <p className={`${comun.caja} ${styles.descripcion}`}>{necesidad.descripcion}</p>
          </div>
        </article>

        {puedeSatisfacer && (
          <Button variant="soft" fullWidth icon={<CircleCheck size={22} aria-hidden />} onClick={satisfacer}>
            Marcar como satisfecha
          </Button>
        )}
      </div>
    </Page>
  )
}
