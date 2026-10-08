import { nombreCompleto } from '@/domain/auth'
import { fechaCorta, hora12 } from '@/domain/dates'
import type { Adulto, Necesidad } from '@/domain/types'
import { Badge, LinkCard } from '@/components/ui'
import { ESTADO_NECESIDAD, tipoNecesidad } from '../lib/dominio'
import styles from './NecesidadCard.module.css'

/** Tarjeta de necesidad (tarjetaAlertaGestionada del Figma): fecha y hora, tipo, adulto, estado y pie "Ver más". */
export function NecesidadCard({ necesidad, adulto, to }: { necesidad: Necesidad; adulto?: Adulto; to: string }) {
  const estado = ESTADO_NECESIDAD[necesidad.estado]
  const tipo = tipoNecesidad(necesidad.tipo)
  return (
    <LinkCard to={to}>
      <div className={styles.fila}>
        <span className={styles.fecha}>
          {fechaCorta(necesidad.creadaEn)} - {hora12(necesidad.creadaEn)}
        </span>
        <Badge tone={estado.tone}>{estado.badge}</Badge>
      </div>
      <h3 className={styles.tipo}>{tipo.label}</h3>
      {adulto && <p className={styles.adulto}>{nombreCompleto(adulto)}</p>}
    </LinkCard>
  )
}
