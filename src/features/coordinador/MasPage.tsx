import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BellRing, ChartColumn, ChevronRight, LogOut, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { logout } from '@/domain/auth'
import { Page, useShell } from '@/layouts/AppShell'
import { esAlertaActiva, useOrgData } from './lib/datos'
import styles from './MasPage.module.css'

/**
 * Pantalla Más coord (Figma 487:1447, "Más Opciones"): Alertas y Reportes y Estadísticas, más Mi perfil y Cerrar sesión.
 * Móvil: lista de filas (como el panel del Figma). Escritorio: rejilla de tarjetas-opción con descripción.
 */
export function MasPage() {
  const { base, perfilPath } = useShell()
  const navigate = useNavigate()
  const { alertas } = useOrgData()
  const pendientes = useMemo(() => alertas.filter(esAlertaActiva).length, [alertas])

  const salir = () => {
    logout()
    navigate('/inicio', { replace: true })
  }

  return (
    <Page title="Más" wide>
      <section aria-labelledby="mas-titulo" className={styles.seccion}>
        <h2 id="mas-titulo" className={styles.titulo}>Más Opciones</h2>
        <ul className={styles.lista}>
          <li>
            <Opcion
              to={`${base}/alertas`}
              icon={BellRing}
              titulo="Alertas"
              texto="Revisa y atiende los casos que requieren seguimiento."
              extra={pendientes > 0 ? <span className={styles.contador} aria-label={`${pendientes} alertas activas`}>{pendientes}</span> : null}
            />
          </li>
          <li>
            <Opcion
              to={`${base}/reportes`}
              icon={ChartColumn}
              titulo="Reportes y Estadísticas"
              texto="Indicadores de visitas, necesidades y riesgo; exporta tus reportes."
            />
          </li>
          <li>
            <Opcion to={perfilPath} icon={UserRound} titulo="Mi perfil" texto="Consulta y edita los datos de tu cuenta." />
          </li>
          <li>
            <button type="button" className={`${styles.opcion} ${styles.salir}`} onClick={salir}>
              <span className={styles.icono}>
                <LogOut size={22} aria-hidden />
              </span>
              <span className={styles.textos}>
                <span className={styles.nombre}>Cerrar sesión</span>
                <span className={styles.desc}>Sal de CuidaRed en este dispositivo.</span>
              </span>
            </button>
          </li>
        </ul>
      </section>
    </Page>
  )
}

function Opcion({ to, icon: Icon, titulo, texto, extra }: { to: string; icon: LucideIcon; titulo: string; texto: string; extra?: ReactNode }) {
  return (
    <Link to={to} className={styles.opcion}>
      <span className={styles.icono}>
        <Icon size={22} aria-hidden />
      </span>
      <span className={styles.textos}>
        <span className={styles.nombre}>{titulo}</span>
        <span className={styles.desc}>{texto}</span>
      </span>
      {extra}
      <ChevronRight size={24} className={styles.chevron} aria-hidden />
    </Link>
  )
}
