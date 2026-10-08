import styles from './Auth.module.css'

/** Logosímbolo blanco sobre círculo navy que corona las pantallas de registro y recuperación. */
export function LogoBadge() {
  return <img className={styles.badge} src="/brand/logo-badge.png" width={70} height={83} alt="" />
}
