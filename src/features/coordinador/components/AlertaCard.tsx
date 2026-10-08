import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import type { Adulto, Alerta } from '@/domain/types'
import { haceTiempo, nombreCorto, SEVERIDAD_LABEL } from '../lib/datos'
import styles from './AlertaCard.module.css'

/** Tarjeta "Alertas Recientes" del Dashboard: borde de color por severidad, persona, texto y chips. Enlaza al detalle. */
export function AlertaCard({ alerta, adulto, to }: { alerta: Alerta; adulto: Adulto; to: string }) {
  return (
    <Link to={to} className={`${styles.card} ${styles[alerta.severidad]}`}>
      <div className={styles.head}>
        <Avatar nombre={nombreCompleto(adulto)} src={adulto.foto} size={48} />
        <div className={styles.persona}>
          <strong className={styles.nombre}>{nombreCorto(adulto)}</strong>
          <span className={styles.rol}>Adulto Mayor</span>
        </div>
        <time className={styles.tiempo} dateTime={alerta.creadaEn}>
          {haceTiempo(alerta.creadaEn)}
        </time>
      </div>
      <p className={styles.texto}>{alerta.descripcion}</p>
      <div className={styles.chips}>
        <span className={`${styles.chip} ${styles.sev}`}>{SEVERIDAD_LABEL[alerta.severidad]}</span>
        <span className={`${styles.chip} ${styles.cat}`}>{alerta.categoria}</span>
      </div>
    </Link>
  )
}
