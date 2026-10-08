import { Link } from 'react-router-dom'
import { ArrowRight, CircleUserRound } from 'lucide-react'
import { nombreCompleto } from '@/domain/auth'
import type { Adulto } from '@/domain/types'
import { Datum, IconTile, RiesgoBadge } from '@/components/ui'
import { useShell } from '@/layouts/AppShell'
import styles from './AdultoCard.module.css'

/**
 * tarjetaEnvejeciente del Figma: icono, nombre, riesgo, cédula + un segundo dato (zona o última visita) y pie "Ver más".
 * Es una variante de LinkCard cuyo pie queda siempre al fondo, para que las tarjetas de una misma fila de la rejilla alineen.
 */
export function AdultoCard({ adulto, dato }: { adulto: Adulto; dato: { label: string; value: string } }) {
  const { base } = useShell()
  return (
    <Link to={`${base}/adultos/${adulto.id}`} className={styles.card}>
      <div className={styles.cuerpo}>
        <div className={styles.top}>
          <IconTile>
            <CircleUserRound size={26} strokeWidth={1.7} aria-hidden />
          </IconTile>
          <h3 className={styles.nombre}>{nombreCompleto(adulto)}</h3>
          <RiesgoBadge riesgo={adulto.riesgo} />
        </div>
        <div className={styles.datos}>
          <Datum label="Cédula" value={adulto.cedula} />
          <Datum label={dato.label} value={dato.value} />
        </div>
      </div>
      <div className={styles.pie}>
        <span>Ver más</span>
        <ArrowRight size={18} aria-hidden />
      </div>
    </Link>
  )
}
