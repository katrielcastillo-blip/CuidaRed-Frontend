import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Page, useShell } from '@/layouts/AppShell'
import { nombreCompleto } from '@/domain/auth'
import { useDB } from '@/domain/store'
import { fechaCorta, hora12 } from '@/domain/dates'
import { NoEncontrado } from '../components/NoEncontrado'
import { ESTADO_NECESIDAD, RIESGO_MASC, TIPO_NECESIDAD, useAdultoPropio } from '../lib'
import styles from './DetalleNecesidad.module.css'

/** Pantalla Detalle Necesidad (358:1513). Solo lectura. */
export default function DetalleNecesidad() {
  const { necesidadId } = useParams()
  const { base } = useShell()
  const necesidades = useDB((s) => s.necesidades)
  const usuarios = useDB((s) => s.usuarios)
  const necesidad = useMemo(() => necesidades.find((n) => n.id === necesidadId), [necesidades, necesidadId])
  const adulto = useAdultoPropio(necesidad?.adultoId)

  if (!necesidad || !adulto) {
    return <NoEncontrado titulo="Detalle Necesidad" mensaje="Esta necesidad no existe o no pertenece a tu familia." />
  }

  const tipo = TIPO_NECESIDAD[necesidad.tipo]
  const estado = ESTADO_NECESIDAD[necesidad.estado]
  const nombreDe = (id?: string) => {
    const u = usuarios.find((x) => x.id === id)
    return u ? nombreCompleto(u) : 'Sin asignar'
  }

  return (
    <Page title="Detalle Necesidad" back={`${base}/adultos/${adulto.id}`}>
      <div className={styles.contenedor}>
        <article className={styles.tarjeta}>
          <span className={styles.icono}>
            <tipo.icon size={47} strokeWidth={1.6} aria-hidden />
          </span>
          <h2 className={styles.tipo}>{tipo.label}</h2>

          <Link to={`${base}/adultos/${adulto.id}`} className={styles.adulto}>
            <strong>{nombreCompleto(adulto)}</strong>
            <span className={styles.riesgo}>{RIESGO_MASC[adulto.riesgo]}</span>
          </Link>

          <div className={styles.detalle}>
            <p className={styles.estado}>
              <span className={styles.punto} style={{ background: estado.punto }} aria-hidden />
              {estado.texto}
            </p>
            <p className={styles.fecha}>
              Fecha: {fechaCorta(necesidad.creadaEn)}
              <br />
              Hora: {hora12(necesidad.creadaEn)}
            </p>
            <p className={styles.fecha}>Registrada por: {nombreDe(necesidad.registradaPor)}</p>
            {necesidad.estado === 'satisfecha' && necesidad.satisfechaEn && (
              <p className={styles.fecha}>
                Satisfecha el {fechaCorta(necesidad.satisfechaEn)} · {nombreDe(necesidad.satisfechaPor)}
              </p>
            )}

            <h3 className={styles.etiqueta}>Descripción</h3>
            <p className={styles.descripcion}>{necesidad.descripcion.trim() || '...'}</p>
          </div>
        </article>
      </div>
    </Page>
  )
}
