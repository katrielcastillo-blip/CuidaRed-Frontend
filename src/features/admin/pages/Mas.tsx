import { Link, useNavigate } from 'react-router-dom'
import { BellRing, ChartColumn, ChevronRight, LogOut, Settings, UserRound, type LucideIcon } from 'lucide-react'
import { logout } from '@/domain/auth'
import { Page, useShell } from '@/layouts/AppShell'
import styles from './Mas.module.css'

interface Opcion {
  to: string
  icono: LucideIcon
  titulo: string
  detalle: string
}

/** Pantalla «Más» (Figma 441:3388): lista en móvil, rejilla de tarjetas en escritorio. */
export default function Mas() {
  const { base, perfilPath } = useShell()
  const navigate = useNavigate()

  const opciones: Opcion[] = [
    { to: `${base}/alertas`, icono: BellRing, titulo: 'Alertas', detalle: 'Revisa y atiende las alertas de los adultos mayores.' },
    {
      to: `${base}/reportes`,
      icono: ChartColumn,
      titulo: 'Reportes y Estadísticas',
      detalle: 'Visitas, necesidades y casos de riesgo de la organización.',
    },
    {
      to: `${base}/configuracion`,
      icono: Settings,
      titulo: 'Configurar Organización',
      detalle: 'Datos de contacto, umbrales de alerta y notificaciones.',
    },
    { to: perfilPath, icono: UserRound, titulo: 'Mi perfil', detalle: 'Consulta y edita tus datos personales.' },
  ]

  const cerrarSesion = () => {
    logout()
    navigate('/inicio', { replace: true })
  }

  return (
    <Page title="Más" wide>
      <h2 className={styles.titulo}>Más Opciones</h2>
      <ul className={styles.lista}>
        {opciones.map((o) => (
          <li key={o.to}>
            <Link to={o.to} className={styles.opcion}>
              <span className={styles.icono}>
                <o.icono size={24} aria-hidden />
              </span>
              <span className={styles.texto}>
                <strong>{o.titulo}</strong>
                <span className={`${styles.detalle} only-desktop`}>{o.detalle}</span>
              </span>
              <ChevronRight size={22} className={styles.chevron} aria-hidden />
            </Link>
          </li>
        ))}
        <li>
          <button type="button" className={`${styles.opcion} ${styles.salir}`} onClick={cerrarSesion}>
            <span className={styles.icono}>
              <LogOut size={24} aria-hidden />
            </span>
            <span className={styles.texto}>
              <strong>Cerrar sesión</strong>
              <span className={`${styles.detalle} only-desktop`}>Salir de CuidaRed en este dispositivo.</span>
            </span>
          </button>
        </li>
      </ul>
    </Page>
  )
}
