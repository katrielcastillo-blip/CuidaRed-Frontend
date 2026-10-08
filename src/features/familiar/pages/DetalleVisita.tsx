import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Frown, Meh, Paperclip, Smile, UserRound, type LucideIcon } from 'lucide-react'
import { Page, useShell } from '@/layouts/AppShell'
import { nombreCompleto } from '@/domain/auth'
import { useDB } from '@/domain/store'
import { fechaCorta, hhmmA12, hora12 } from '@/domain/dates'
import type { EstadoAdultoVisita } from '@/domain/types'
import { Badge, IconTile } from '@/components/ui'
import { NoEncontrado } from '../components/NoEncontrado'
import { ESTADO_VISITA, RIESGO_MASC, RIESGO_TONO, useAdultoPropio } from '../lib'
import styles from './DetalleVisita.module.css'

const ESTADOS: Array<{ value: EstadoAdultoVisita; label: string; icon: LucideIcon }> = [
  { value: 'estable', label: 'Estable', icon: Smile },
  { value: 'requiere_atencion', label: 'Requiere Atención', icon: Meh },
  { value: 'situacion_critica', label: 'Situación Crítica', icon: Frown },
]

const esImagen = (e: string) => e.startsWith('data:image')

/** Pantalla Detalle Visita (322:2073). Solo lectura: el familiar consulta lo que registró el cuidador. */
export default function DetalleVisita() {
  const { visitaId } = useParams()
  const { base } = useShell()
  const visitas = useDB((s) => s.visitas)
  const usuarios = useDB((s) => s.usuarios)
  const visita = useMemo(() => visitas.find((v) => v.id === visitaId), [visitas, visitaId])
  const adulto = useAdultoPropio(visita?.adultoId)

  if (!visita || !adulto) {
    return <NoEncontrado titulo="Detalle Visita" mensaje="Esta visita no existe o no pertenece a tu familia." />
  }

  const cuidador = usuarios.find((u) => u.id === visita.cuidadorId)
  const estado = ESTADO_VISITA[visita.estado]

  return (
    <Page title="Detalle Visita" back={`${base}/adultos/${adulto.id}?tab=visitas`}>
      <Link to={`${base}/adultos/${adulto.id}`} className={styles.adulto} aria-label={`Ver perfil de ${nombreCompleto(adulto)}`}>
        <IconTile size={63}>
          <UserRound size={34} aria-hidden />
        </IconTile>
        <span className={styles.adultoTexto}>
          <strong>{nombreCompleto(adulto)}</strong>
          <Badge tone={RIESGO_TONO[adulto.riesgo]}>{RIESGO_MASC[adulto.riesgo]}</Badge>
        </span>
      </Link>

      <section className={styles.bloque}>
        <div className="row-between">
          <h2 className={styles.titulo}>{visita.tipo}</h2>
          <Badge tone={estado.tono}>{estado.label}</Badge>
        </div>
        <dl className={styles.meta}>
          <div>
            <dt>Fecha:</dt> <dd>{fechaCorta(visita.fecha)}</dd>
          </div>
          <div>
            <dt>Hora Inicio:</dt> <dd>{visita.inicio ? hora12(visita.inicio) : '—'}</dd>
          </div>
          <div>
            <dt>Hora Pautada:</dt> <dd>{hhmmA12(visita.horaPautada)}</dd>
          </div>
          <div>
            <dt>Hora Fin:</dt> <dd>{visita.fin ? hora12(visita.fin) : '—'}</dd>
          </div>
          <div className={styles.metaAncho}>
            <dt>Cuidador:</dt> <dd>{cuidador ? nombreCompleto(cuidador) : 'Sin asignar'}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.bloque}>
        <h3 className={styles.subtitulo}>Estado en la Visita</h3>
        <div className={styles.estados} role="group" aria-label="Estado del envejeciente en la visita">
          {ESTADOS.map((e) => {
            const activo = visita.estadoAdulto === e.value
            return (
              <div key={e.value} className={`${styles.estado} ${activo ? styles.estadoOn : ''}`} aria-current={activo ? 'true' : undefined}>
                <e.icon size={24} aria-hidden />
                <span>{e.label}</span>
                {activo && <span className="sr-only">(seleccionado)</span>}
              </div>
            )
          })}
        </div>
        {!visita.estadoAdulto && <p className="muted text-sm">El cuidador aún no registra el estado de esta visita.</p>}
      </section>

      {visita.notas && (
        <section className={styles.panel}>
          <h3 className={styles.subtitulo}>Notas de la visita</h3>
          <p className={styles.texto}>{visita.notas}</p>
        </section>
      )}

      <section className={styles.panel}>
        <h3 className={styles.subtitulo}>Observaciones</h3>
        <p className={styles.texto}>{visita.observaciones?.trim() || 'Ninguna.'}</p>
      </section>

      <section className={styles.evidencias} aria-label="Evidencias">
        {visita.evidencias.length === 0 ? (
          <div className={styles.sinEvidencias}>
            <span>Sin Evidencias</span>
            <Paperclip size={22} aria-hidden />
          </div>
        ) : (
          <ul className={styles.listaEvidencias}>
            {visita.evidencias.map((e, i) => (
              <li key={`${i}-${e.slice(0, 24)}`} className={styles.evidencia}>
                {esImagen(e) ? <img src={e} alt={`Evidencia ${i + 1}`} /> : <Paperclip size={20} aria-hidden />}
                <span>{esImagen(e) ? `Evidencia ${i + 1}` : e}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  )
}
