import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { Badge, IconTile } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import type { Adulto, Usuario, Visita } from '@/domain/types'
import { cuandoVisita, ESTADO_VISITA_LABEL } from '../lib/datos'
import styles from './VisitaCard.module.css'

const TONO = { pendiente: 'warning', en_curso: 'info', completada: 'success', cancelada: 'neutral' } as const

/** Tarjeta de visita (Figma "tarjetaVisita"): adulto, hora - fecha, tipo, cuidador asignado y botón "Ver más". */
export function VisitaCard({ visita, adulto, cuidador, to }: { visita: Visita; adulto: Adulto; cuidador?: Usuario; to: string }) {
  const vencida = visita.estado === 'pendiente' && visita.fecha < todayISO()
  return (
    <Link to={to} className={styles.card}>
      <div className={styles.top}>
        <IconTile size={48}>
          <CalendarDays size={24} aria-hidden />
        </IconTile>
        <div className={styles.info}>
          <div className={styles.titulo}>
            <h3 className={styles.nombre}>{nombreCompleto(adulto)}</h3>
            {vencida ? <Badge tone="danger">Vencida</Badge> : <Badge tone={TONO[visita.estado]}>{ESTADO_VISITA_LABEL[visita.estado]}</Badge>}
          </div>
          <p className={styles.cuando}>{cuandoVisita(visita)}</p>
          <p className={styles.tipo}>{visita.tipo}</p>
          <p className={styles.cuidador}>Cuidador: {cuidador ? nombreCompleto(cuidador) : 'Sin asignar'}</p>
        </div>
      </div>
      <span className={styles.verMas}>Ver más</span>
    </Link>
  )
}
