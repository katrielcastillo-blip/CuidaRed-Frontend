import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HOME_BY_ROL, useSession } from '@/domain/auth'
import styles from './Splash.module.css'

/** "/" — Pantalla Logo (Figma 255:470). A los ~1.2 s entra al inicio del rol o al login. */
export default function Splash() {
  const { user } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate(user ? HOME_BY_ROL[user.rol] : '/inicio', { replace: true }), 1200)
    return () => clearTimeout(t)
  }, [navigate, user])

  return (
    <main className={styles.splash} aria-label="CuidaRed" aria-busy="true">
      <img className={styles.simbolo} src="/brand/logosimbolo.png" width={149} height={178} alt="CuidaRed" />
    </main>
  )
}
