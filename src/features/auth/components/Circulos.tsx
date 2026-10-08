import styles from './Circulos.module.css'

/** Círculos decorativos del fondo ("íconosLogo" del Figma). Escalan con el menor lado de la ventana. */
export function Circulos() {
  return (
    <div className={styles.circulos} aria-hidden="true">
      <span className={styles.menta} />
      <span className={styles.azul} />
      <span className={styles.marino} />
      <span className={styles.tealA} />
      <span className={styles.tealB} />
    </div>
  )
}
