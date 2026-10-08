import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BellRing, HeartHandshake, Users } from 'lucide-react'
import { Circulos } from './Circulos'
import styles from './AuthScreen.module.css'

type Volver = string | true | (() => void)

interface Props {
  /** Con título: cabecera con degradado + tarjeta (registro, recuperar…). Sin título: pantalla "plana" (login). */
  title?: string
  /** string → ruta · true → historial (o /inicio si se entró directo) · función → acción propia. */
  back?: Volver
  /** registro: azul → navy (Figma Registrarse/Términos) · auth: azul → verde (Figma Recuperar/Restablecer). */
  gradient?: 'registro' | 'auth'
  /** Textos legales: tarjeta más ancha y sin panel de marca. */
  wide?: boolean
  children: ReactNode
}

/**
 * Esqueleto de las pantallas públicas.
 *  - Móvil: pantalla completa fiel al Figma (cabecera con degradado + tarjeta redondeada).
 *  - ≥768 px: tarjeta centrada (~460 px) sobre el fondo de círculos.
 *  - ≥1100 px: panel de marca a la izquierda.
 */
export function AuthScreen({ title, back, gradient = 'registro', wide, children }: Props) {
  const navigate = useNavigate()

  const volver = () => {
    if (typeof back === 'function') return back()
    if (typeof back === 'string') return navigate(back)
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/inicio')
  }

  const conCabecera = title !== undefined
  const clases = [styles.screen, conCabecera ? styles.sheet : styles.plain, wide ? styles.wide : ''].join(' ')

  return (
    <div className={clases}>
      <Circulos />
      <div className={styles.layout}>
        {!wide && (
          <aside className={styles.brand} aria-label="CuidaRed">
            <img src="/brand/logo.png" alt="CuidaRed · Seguimiento Comunitario" width={517} height={192} className={styles.brandLogo} />
            <p className={styles.brandLead}>Una red que conecta a organizaciones, cuidadores y familias para acompañar a los adultos mayores de tu comunidad.</p>
            <ul className={styles.brandList}>
              <li>
                <HeartHandshake size={22} aria-hidden /> Visitas de seguimiento y necesidades al día
              </li>
              <li>
                <BellRing size={22} aria-hidden /> Alertas de riesgo para actuar a tiempo
              </li>
              <li>
                <Users size={22} aria-hidden /> Familias y voluntarios siempre conectados
              </li>
            </ul>
          </aside>
        )}

        <section className={styles.panel}>
          {conCabecera && (
            <header className={`${styles.head} ${gradient === 'auth' ? styles.gradAuth : styles.gradRegistro}`}>
              {back !== undefined && (
                <button type="button" className={styles.back} onClick={volver} aria-label="Volver">
                  <ArrowLeft size={28} />
                </button>
              )}
              <h1 className={styles.title}>{title}</h1>
            </header>
          )}
          <div className={styles.body}>{children}</div>
        </section>
      </div>
    </div>
  )
}
