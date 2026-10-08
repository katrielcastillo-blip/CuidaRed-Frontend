import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Riesgo, SeveridadAlerta } from '@/domain/types'
import { RIESGO_TEXTO, SEVERIDAD_TEXTO } from '../lib/formato'
import styles from './Piezas.module.css'

/** Chip del perfil del adulto: «Medio» sobre fondo suave (Figma Perfil Envejeciente). */
export function RiesgoPill({ riesgo }: { riesgo: Riesgo }) {
  return <span className={`${styles.riesgoPill} ${styles[`r_${riesgo}`]}`}>{RIESGO_TEXTO[riesgo]}</span>
}

/** Pill de prioridad de la alerta: ALTA / MEDIA / BAJA. */
export function SeveridadPill({ severidad }: { severidad: SeveridadAlerta }) {
  return <span className={`${styles.pill} ${styles[`s_${severidad}`]}`}>{SEVERIDAD_TEXTO[severidad].toUpperCase()}</span>
}

/** Pill neutra (categoría de la alerta). */
export function CategoriaPill({ children }: { children: ReactNode }) {
  return <span className={`${styles.pill} ${styles.categoria}`}>{children}</span>
}

/** Cuadro informativo azul con icono (nota del formulario, aviso de la evaluación). */
export function NotaInfo({ children }: { children: ReactNode }) {
  return (
    <div className={styles.nota} role="note">
      <Info size={20} aria-hidden />
      <p>{children}</p>
    </div>
  )
}

/** Adulto no encontrado (id inexistente o de otra organización). */
export function AdultoNoEncontrado({ volverA }: { volverA: string }) {
  const navigate = useNavigate()
  return (
    <div className={styles.vacio}>
      <p className={styles.vacioTitulo}>No encontramos este registro</p>
      <p className="muted">Puede haber sido eliminado o no pertenecer a tu organización.</p>
      <button type="button" className={styles.vacioBtn} onClick={() => navigate(volverA, { replace: true })}>
        Volver al listado
      </button>
    </div>
  )
}
