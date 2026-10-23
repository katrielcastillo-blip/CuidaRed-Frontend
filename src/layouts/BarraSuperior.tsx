/*
 * BarraSuperior.tsx — Barra superior fija de todas las pantallas autenticadas: logotipo (izquierda),
 * indicador de conexión/sincronización, notificaciones y usuario con su rol (derecha).
 * Módulo: layouts (SRS §18.3 "Encabezado de la aplicación" y §18.4 "Indicadores de estado offline").
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { nombreCompleto, ROL_LABEL, useSession } from '@/domain/auth'
import { marcarNotificacionesLeidas, notificacionesDe } from '@/domain/api'
import { useEnLinea } from '@/domain/conectividad'
import { relativo } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import { usePendientes, useEstadoSync } from '@/domain/sync'
import type { Notificacion } from '@/domain/types'
import { Badge, Button, EmptyState, Sheet } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useShell } from './AppShell'

/** Indicador permanente de conexión y registros pendientes de sincronización. */
export function IndicadorConexion() {
  const enLinea = useEnLinea()
  const { base } = useShell()
  const { sincronizando } = useEstadoSync()
  const pendientes = usePendientes().length

  const estilo = !enLinea
    ? 'bg-warning-100 text-warning-700 border-warning'
    : pendientes > 0
      ? 'bg-blue-100 text-navy border-blue'
      : 'bg-success-100 text-success-700 border-success'
  const Icono = !enLinea ? CloudOff : pendientes > 0 ? RefreshCw : Cloud
  const texto = !enLinea ? 'Sin conexión' : sincronizando ? 'Sincronizando…' : pendientes > 0 ? 'Por sincronizar' : 'En línea'
  return (
    <Link
      to={`${base}/sincronizacion`}
      className={cn('inline-flex items-center gap-1.5 min-h-12 px-2 -my-2 rounded-pill text-xs font-bold whitespace-nowrap')}
      aria-label={`${texto}${pendientes ? `: ${pendientes} registro(s) pendiente(s) de sincronización` : ''}. Ver sincronización`}
      data-testid="indicador-conexion"
    >
      <span className={cn('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border', estilo)}>
        <Icono size={14} strokeWidth={2.5} aria-hidden className={sincronizando ? 'animate-spin' : undefined} />
        <span className={cn(enLinea && pendientes === 0 && 'sr-only sm:not-sr-only')}>{texto}</span>
        {pendientes > 0 && (
          <span className="grid place-items-center min-w-5 h-5 px-1 rounded-full bg-current/15" data-testid="pendientes-sync">
            {pendientes}
          </span>
        )}
      </span>
    </Link>
  )
}

/** Campana de notificaciones (tabla Notificacion): alertas, cambios de plan y avisos de la cuenta. */
function Notificaciones() {
  const { user } = useSession()
  const { base } = useShell()
  const navigate = useNavigate()
  const notificaciones = useDB((s) => s.notificaciones)
  const [abierto, setAbierto] = useState(false)
  const todas = useMemo(() => notificacionesDe({ notificaciones }, user).slice(0, 30), [notificaciones, user])
  const sinLeer = todas.filter((n) => n.estado === 'no_leida')
  if (!user) return null
  const abrir = (n: Notificacion) => {
    marcarNotificacionesLeidas(user, [n.id])
    if (n.alertaId && puede(user, 'alertas:ver')) {
      setAbierto(false)
      navigate(`${base}/alertas/${n.alertaId}`)
    }
  }
  return (
    <>
      <button
        type="button"
        className="relative size-12 -my-2 grid place-items-center rounded-full text-navy hover:bg-blue-100"
        aria-label={sinLeer.length ? `Notificaciones: ${sinLeer.length} sin leer` : 'Notificaciones'}
        onClick={() => setAbierto(true)}
        data-testid="notificaciones"
      >
        <Bell size={20} aria-hidden />
        {sinLeer.length > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-danger text-white text-[11px] font-bold">
            {sinLeer.length > 99 ? '99+' : sinLeer.length}
          </span>
        )}
      </button>
      <Sheet
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Notificaciones"
        footer={
          sinLeer.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => marcarNotificacionesLeidas(user, sinLeer.map((n) => n.id))}>
              Marcar todas como leídas
            </Button>
          ) : undefined
        }
      >
        {todas.length === 0 ? (
          <EmptyState title="Sin notificaciones" text="Te avisaremos aquí cuando haya alertas o novedades de tu organización." />
        ) : (
          <ul className="flex flex-col gap-2">
            {todas.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full text-left flex flex-col gap-1 p-3 min-h-12 rounded-sm border hover:bg-blue-100',
                    n.estado === 'no_leida' ? 'border-blue bg-blue-100/40' : 'border-line-soft bg-surface',
                  )}
                  onClick={() => abrir(n)}
                >
                  <span className="flex items-center gap-2">
                    {n.estado === 'no_leida' ? <Badge tone="info">Nueva</Badge> : <Badge tone="neutral">Leída</Badge>}
                    <span className="text-xs text-muted ml-auto">{relativo(n.fecha)}</span>
                  </span>
                  <span className="text-sm text-ink">{n.mensaje}</span>
                  {n.fechaLectura && <span className="text-xs text-muted">Leída {relativo(n.fechaLectura)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  )
}

export function BarraSuperior() {
  const { user } = useSession()
  const { base, perfilPath } = useShell()
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-line-soft pt-safe no-print" role="banner">
      <div className="flex items-center gap-2 h-11 px-3 md:px-6">
        <Link to={base} className="flex items-center gap-2 flex-none md:hidden" aria-label="CuidaRed, inicio">
          <img src="/favicon.svg" alt="" width={24} height={24} />
          <span className="font-bold text-navy">CuidaRed</span>
        </Link>
        <div className="flex-1" />
        <IndicadorConexion />
        <Notificaciones />
        {user && (
          <Link to={perfilPath} className="flex flex-col items-end leading-tight min-w-0 max-w-[45vw] min-h-12 justify-center -my-2" data-testid="usuario-actual">
            <span className="text-sm font-semibold text-ink truncate max-w-full">{nombreCompleto(user)}</span>
            <span className="text-[11px] text-muted truncate max-w-full">{ROL_LABEL[user.rol]}</span>
          </Link>
        )}
      </div>
    </div>
  )
}
