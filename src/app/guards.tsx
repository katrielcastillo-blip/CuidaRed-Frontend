import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { HOME_BY_ROL, useSession } from '@/domain/auth'
import type { Rol } from '@/domain/types'

/** Protege un área por rol: sin sesión → /inicio; con otro rol → su propio inicio. */
export function RequireRole({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { user } = useSession()
  const location = useLocation()
  if (!user) return <Navigate to="/inicio" replace state={{ from: location.pathname }} />
  if (user.rol !== rol) return <Navigate to={HOME_BY_ROL[user.rol]} replace />
  return <>{children}</>
}

/** Para pantallas públicas de auth: si ya hay sesión, salta al inicio del rol. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user } = useSession()
  if (user) return <Navigate to={HOME_BY_ROL[user.rol]} replace />
  return <>{children}</>
}
