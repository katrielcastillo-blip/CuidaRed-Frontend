import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { logout, nombreCompleto, ROL_LABEL, useSession } from '@/domain/auth'
import { Avatar } from '@/components/ui'
import styles from './AppShell.module.css'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** true → activo solo con coincidencia exacta (p. ej. el Inicio del rol). */
  end?: boolean
}

interface ShellCtx {
  base: string
  perfilPath: string
}
const Ctx = createContext<ShellCtx>({ base: '/', perfilPath: '/' })
/** Base del rol actual ("/cuidador", "/admin"…) y ruta de su perfil. */
export const useShell = () => useContext(Ctx)

/**
 * Esqueleto responsive de las áreas autenticadas.
 *  - Móvil (<768px): contenido a ancho completo + bottom-nav navy fijo (como el Figma).
 *  - Tablet/escritorio (≥768px): sidebar navy fijo a la izquierda + contenido centrado (máx. --content-max).
 * Cada pantalla pinta su propia cabecera con <PageHeader/>.
 */
export function AppShell({ nav, base, perfilPath }: { nav: NavItem[]; base: string; perfilPath: string }) {
  const { user, org } = useSession()
  const navigate = useNavigate()
  return (
    <Ctx.Provider value={{ base, perfilPath }}>
      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label="Navegación principal">
          <Link to={base} className={styles.brand}>
            <img src="/favicon.svg" alt="" width={36} height={36} />
            <span>
              <strong>CuidaRed</strong>
              <small>Seguimiento Comunitario</small>
            </span>
          </Link>
          <nav className={styles.sideNav}>
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `${styles.sideLink} ${isActive ? styles.active : ''}`}>
                <n.icon size={22} aria-hidden />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          {user && (
            <div className={styles.sideUser}>
              <Link to={perfilPath} className={styles.sideUserLink}>
                <Avatar nombre={nombreCompleto(user)} src={user.avatar} size={40} />
                <span className={styles.sideUserText}>
                  <strong>{nombreCompleto(user)}</strong>
                  <small>
                    {ROL_LABEL[user.rol]}
                    {org ? ` · ${org.nombre}` : ''}
                  </small>
                </span>
              </Link>
              <button
                type="button"
                className={styles.sideLogout}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                onClick={() => {
                  logout()
                  navigate('/inicio', { replace: true })
                }}
              >
                <LogOut size={20} />
              </button>
            </div>
          )}
        </aside>

        <div className={styles.main}>
          <Outlet />
        </div>

        <nav className={styles.bottomNav} aria-label="Navegación principal">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `${styles.bottomLink} ${isActive ? styles.active : ''}`}>
              <n.icon size={24} aria-hidden />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </Ctx.Provider>
  )
}

/**
 * Cabecera navy de cada pantalla (header del Figma) + contenedor del contenido.
 *  - back: muestra flecha ← (true = navigate(-1); string = ruta concreta).
 *  - leading: reemplaza el título (p. ej. selector "▾ Flia. Rodríguez").
 *  - actions: botones a la derecha; por defecto, avatar que lleva al perfil.
 *  - wide: permite contenido más ancho en escritorio (dashboards, listas en rejilla).
 */
export function Page({
  title,
  back,
  leading,
  actions,
  hideAvatar,
  wide,
  children,
}: {
  title?: string
  back?: boolean | string
  leading?: ReactNode
  actions?: ReactNode
  hideAvatar?: boolean
  wide?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const { perfilPath } = useShell()
  const { user } = useSession()
  return (
    <>
      <header className={styles.header}>
        <div className={`${styles.headerInner} ${wide ? styles.wide : ''}`}>
          {back && (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Volver"
              onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div className={styles.headerTitle}>{leading ?? <h1>{title}</h1>}</div>
          {actions}
          {!hideAvatar && user && (
            <Link to={perfilPath} className={styles.headerAvatar} aria-label="Mi perfil">
              <Avatar nombre={nombreCompleto(user)} src={user.avatar} size={40} ring />
            </Link>
          )}
        </div>
      </header>
      <main className={`${styles.content} ${wide ? styles.wide : ''}`}>{children}</main>
    </>
  )
}
