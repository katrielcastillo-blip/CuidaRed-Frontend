import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { nombreCompleto } from '@/domain/auth'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import type { Adulto, Visita } from '@/domain/types'
import { Badge, IconTile } from '@/components/ui'
import { ESTADO_VISITA, fechaHoraVisita } from '../lib/dominio'
import styles from './VisitaCard.module.css'

/**
 * Tarjeta de visita (tarjetaVisita del Figma): icono de calendario, adulto, hora + fecha, tipo y botón "Ver más".
 * `mostrarAdulto={false}` (perfil del adulto) usa la fecha como título, porque el adulto ya es obvio.
 */
export function VisitaCard({ visita, adulto, to, mostrarAdulto = true }: { visita: Visita; adulto?: Adulto; to: string; mostrarAdulto?: boolean }) {
  const estado = ESTADO_VISITA[visita.estado]
  return (
    <Link to={to} className={styles.card}>
      <div className={styles.top}>
        <IconTile>
          <CalendarDays size={24} aria-hidden />
        </IconTile>
        <div className={styles.txt}>
          <div className={styles.fila}>
            <h3 className={styles.titulo}>{mostrarAdulto && adulto ? nombreCompleto(adulto) : fechaCorta(visita.fecha)}</h3>
            <Badge tone={estado.tone}>{estado.badge}</Badge>
          </div>
          <p className={styles.hora}>{mostrarAdulto ? fechaHoraVisita(visita) : hhmmA12(visita.horaPautada)}</p>
          <p className={styles.tipo}>{visita.tipo}</p>
        </div>
      </div>
      <span className={styles.mas}>Ver más</span>
    </Link>
  )
}
