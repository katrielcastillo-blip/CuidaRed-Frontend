import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleUserRound } from 'lucide-react'
import { nombreCompleto } from '@/domain/auth'
import type { Adulto } from '@/domain/types'
import { IconTile, RiesgoBadge } from '@/components/ui'
import styles from './AdultoHeader.module.css'

/**
 * Cabecera con el adulto (icono + nombre + riesgo) de Registrar Visita / Registrar Necesidad / Detalle Visita.
 *  - badge="debajo": el chip de riesgo va bajo el nombre (formularios).
 *  - badge="final": el chip va al extremo derecho (detalle de visita).
 *  - enlace: texto y ruta del enlace al perfil ("Ver Perfil" / "Ver perfil completo").
 */
export function AdultoHeader({
  adulto,
  badge = 'debajo',
  enlace,
  children,
}: {
  adulto: Adulto
  badge?: 'debajo' | 'final'
  enlace?: { to: string; texto: string }
  children?: ReactNode
}) {
  return (
    <div className={styles.head}>
      <IconTile size={63}>
        <CircleUserRound size={43} strokeWidth={1.6} aria-hidden />
      </IconTile>
      <div className={styles.info}>
        <h2 className={styles.nombre}>{nombreCompleto(adulto)}</h2>
        {enlace && (
          <Link to={enlace.to} className={styles.enlace}>
            {enlace.texto}
          </Link>
        )}
        {badge === 'debajo' && (
          <span className={styles.chip}>
            <RiesgoBadge riesgo={adulto.riesgo} />
          </span>
        )}
        {children}
      </div>
      {badge === 'final' && <RiesgoBadge riesgo={adulto.riesgo} />}
    </div>
  )
}
