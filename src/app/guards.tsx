/*
 * guards.tsx — Protección de rutas: sesión, rol del área y permiso de la acción (RF-09 · CU-13).
 * Módulo: app. La capa de servicios (domain/api) vuelve a validar cada operación.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { auditar } from '@/domain/auditoria'
import { HOME_BY_ROL, useSession } from '@/domain/auth'
import { estaEnLinea } from '@/domain/conectividad'
import { puede, type Accion } from '@/domain/permisos'
import { getDB, mutate } from '@/domain/store'
import type { Rol, Usuario } from '@/domain/types'
import { AccesoDenegado } from '@/features/sistema/pages/AccesoDenegado'

/** Intentos ya auditados en esta pestaña (evita duplicados al re-renderizar). */
const auditados = new Set<string>()

/** Registra en auditoría (una vez por usuario y ruta) el intento de acceso a una función no autorizada. */
function useAuditarDenegado(user: Usuario | null, denegado: boolean, ruta: string, motivo: string) {
  const uid = user?.id
  useEffect(() => {
    const clave = `${uid}|${ruta}|${motivo}`
    if (!uid || !denegado || !estaEnLinea() || auditados.has(clave)) return
    const actor = getDB().usuarios.find((u) => u.id === uid)
    if (!actor) return
    auditados.add(clave)
    mutate((db) => auditar(db, actor, { accion: 'acceso.denegado', entidad: 'sesion', resultado: 'denegado', detalle: `${ruta} (${motivo})` }), { silencioso: true })
  }, [uid, denegado, ruta, motivo])
}

/** Protege un área por rol: sin sesión → /inicio; con otro rol → pantalla de acceso denegado. */
export function RequireRole({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { user } = useSession()
  const location = useLocation()
  const denegado = !!user && user.rol !== rol
  useAuditarDenegado(user, denegado, location.pathname, `área de ${rol}`)
  if (!user) return <Navigate to="/inicio" replace state={{ from: location.pathname }} />
  if (denegado) return <AccesoDenegado inicio={HOME_BY_ROL[user.rol]} />
  return <>{children}</>
}

/** Protege una pantalla dentro del área por permiso (p. ej. reportes:ver). */
export function RequirePermiso({ accion, children }: { accion: Accion; children: ReactNode }) {
  const { user } = useSession()
  const location = useLocation()
  const denegado = !puede(user, accion)
  useAuditarDenegado(user, denegado, location.pathname, accion)
  if (!user) return <Navigate to="/inicio" replace state={{ from: location.pathname }} />
  if (denegado) return <AccesoDenegado inicio={HOME_BY_ROL[user.rol]} enShell />
  return <>{children}</>
}

/** Para pantallas públicas de auth: si ya hay sesión, salta al inicio del rol. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user } = useSession()
  if (user) return <Navigate to={HOME_BY_ROL[user.rol]} replace />
  return <>{children}</>
}
