import type { ComponentProps } from 'react'
import { Badge, LinkCard } from '@/components/ui'
import styles from './ActividadCard.module.css'

/** tarjetaAlertaGestionad del Figma: fecha · estado / título / detalle / "Ver más". Sirve para necesidades y visitas. */
export function ActividadCard({
  to,
  fecha,
  titulo,
  detalle,
  estado,
}: {
  to: string
  fecha: string
  titulo: string
  detalle?: string
  estado: { label: string; tono: NonNullable<ComponentProps<typeof Badge>['tone']> }
}) {
  return (
    <LinkCard to={to}>
      <div className={styles.fila}>
        <span className={styles.fecha}>{fecha}</span>
        <Badge tone={estado.tono}>{estado.label}</Badge>
      </div>
      <p className={styles.titulo}>{titulo}</p>
      {detalle && <p className={styles.detalle}>{detalle}</p>}
    </LinkCard>
  )
}
