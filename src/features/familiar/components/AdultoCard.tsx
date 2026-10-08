import { useShell } from '@/layouts/AppShell'
import { nombreCompleto } from '@/domain/auth'
import { relativo } from '@/domain/dates'
import type { Adulto, Visita } from '@/domain/types'
import { Badge, Datum, IconTile, LinkCard } from '@/components/ui'
import { isoPautado, RIESGO_FEM, RIESGO_TONO } from '../lib'
import styles from './AdultoCard.module.css'

/** tarjetaEnvejeciente del Figma: icono · nombre · riesgo / cédula · última visita / "Ver más". */
export function AdultoCard({ adulto, ultimaVisita, familia }: { adulto: Adulto; ultimaVisita?: Visita; familia?: string }) {
  const { base } = useShell()
  return (
    <LinkCard to={`${base}/adultos/${adulto.id}`}>
      <div className={styles.cabecera}>
        <IconTile />
        <div className={styles.titulo}>
          <h3 className={styles.nombre}>{nombreCompleto(adulto)}</h3>
          {familia && <span className={styles.familia}>{familia}</span>}
        </div>
        <Badge tone={RIESGO_TONO[adulto.riesgo]}>{RIESGO_FEM[adulto.riesgo]}</Badge>
      </div>
      <div className={styles.datos}>
        <Datum label="Cédula" value={adulto.cedula} />
        <Datum label="Última Visita" value={ultimaVisita ? relativo(isoPautado(ultimaVisita)) : 'Sin visitas'} />
      </div>
    </LinkCard>
  )
}
