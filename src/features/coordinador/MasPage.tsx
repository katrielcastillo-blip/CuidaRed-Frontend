/*
 * MasPage.tsx — "Más" del coordinador: Agenda de cuidado (Tarea_agenda · Evidencias), Resumen de seguimiento
 * (RF-07), Reportes (RF-08), Alertas (CU-09/CU-10), Conexión y sincronización (RF-10 · CU-14), Ayuda en línea, Acerca de CuidaRed,
 * avisos legales (SRS §18.3), Mi perfil y Cerrar sesión. Las opciones se muestran según puede() (RF-09).
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BellRing, CalendarCheck, ChartColumn, ChevronRight, CircleHelp, FileText, Info, ListOrdered, LogOut, RefreshCw, ShieldCheck, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useToast } from '@/components/ui'
import { logout } from '@/domain/auth'
import { puede } from '@/domain/permisos'
import { pendientesDelUsuario, usePendientes } from '@/domain/sync'
import { Page, useShell } from '@/layouts/AppShell'
import { useAgenda } from '@/features/agenda/lib/agenda'
import { esAlertaAbierta, useOrgData } from './lib/datos'

interface Opcion {
  to: string
  icon: LucideIcon
  titulo: string
  texto: string
  extra?: ReactNode
}

export function MasPage() {
  const { base, perfilPath } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, alertas } = useOrgData()
  const pendientesSync = usePendientes().length
  const abiertas = useMemo(() => alertas.filter(esAlertaAbierta).length, [alertas])
  const { evidencias } = useAgenda()
  const porValidar = useMemo(() => evidencias.filter((e) => e.estadoValidacion === 'pendiente').length, [evidencias])

  const salir = () => {
    const sinSincronizar = pendientesDelUsuario().length
    logout()
    if (sinSincronizar)
      toast(`Tienes ${sinSincronizar} registro(s) sin sincronizar guardados en este dispositivo. Se enviarán cuando vuelvas a iniciar sesión con conexión.`, 'info')
    navigate('/inicio', { replace: true })
  }

  const seguimiento: Opcion[] = [
    ...(puede(user, 'agenda:ver')
      ? [
          {
            to: `${base}/agenda`,
            icon: CalendarCheck,
            titulo: 'Agenda de cuidado',
            texto: 'Tareas asignadas a los cuidadores y evidencias por validar.',
            extra: porValidar > 0 ? <Contador n={porValidar} etiqueta={`${porValidar} evidencias por validar`} tono="warning" /> : null,
          },
        ]
      : []),
    ...(puede(user, 'resumen:ver')
      ? [{ to: `${base}/resumen`, icon: ListOrdered, titulo: 'Resumen de seguimiento', texto: 'Casos activos ordenados por prioridad, estado o última visita.' }]
      : []),
    ...(puede(user, 'alertas:ver')
      ? [
          {
            to: `${base}/alertas`,
            icon: BellRing,
            titulo: 'Alertas',
            texto: 'Revisa y atiende los casos que requieren seguimiento.',
            extra: abiertas > 0 ? <Contador n={abiertas} etiqueta={`${abiertas} alertas sin atender`} /> : null,
          },
        ]
      : []),
    ...(puede(user, 'reportes:ver')
      ? [{ to: `${base}/reportes`, icon: ChartColumn, titulo: 'Reportes', texto: 'Adultos registrados, visitas, necesidades frecuentes y casos prioritarios.' }]
      : []),
  ]

  const sistema: Opcion[] = [
    {
      to: `${base}/sincronizacion`,
      icon: RefreshCw,
      titulo: 'Conexión y sincronización',
      texto: 'Estado de la conexión y registros guardados en este dispositivo.',
      extra: pendientesSync > 0 ? <Contador n={pendientesSync} etiqueta={`${pendientesSync} registros pendientes de sincronización`} tono="warning" /> : null,
    },
    { to: perfilPath, icon: UserRound, titulo: 'Mi perfil', texto: 'Consulta y edita los datos de tu cuenta.' },
    { to: `${base}/ayuda`, icon: CircleHelp, titulo: 'Ayuda', texto: 'Guía rápida de uso para tu rol.' },
    { to: `${base}/acerca`, icon: Info, titulo: 'Acerca de CuidaRed', texto: 'Versión, equipo y créditos del proyecto (INTEC).' },
  ]

  const legal: Opcion[] = [
    { to: '/terminos', icon: FileText, titulo: 'Términos de uso', texto: 'Condiciones de uso de la plataforma.' },
    { to: '/privacidad', icon: ShieldCheck, titulo: 'Privacidad', texto: 'Cómo se protegen los datos personales.' },
  ]

  return (
    <Page title="Más" wide>
      <Grupo id="mas-seguimiento" titulo="Seguimiento" opciones={seguimiento} />
      <Grupo id="mas-cuenta" titulo="Cuenta y sistema" opciones={sistema} />
      <Grupo id="mas-legal" titulo="Información legal" opciones={legal} />

      <button
        type="button"
        onClick={salir}
        className="flex items-center gap-3 min-h-16 px-4 py-3 rounded-sm md:rounded-md bg-danger-100 border border-danger text-left text-danger transition hover:bg-[#f6dcd5]"
      >
        <LogOut size={22} className="flex-none" aria-hidden />
        <span className="flex flex-col flex-1 min-w-0">
          <span className="text-base font-bold">Cerrar sesión</span>
          <span className="hidden md:block text-sm text-ink-2">Sal de CuidaRed en este dispositivo.</span>
        </span>
      </button>
    </Page>
  )
}

function Grupo({ id, titulo, opciones }: { id: string; titulo: string; opciones: Opcion[] }) {
  if (opciones.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="px-1 text-sm font-bold uppercase tracking-wide text-muted">
        {titulo}
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {opciones.map((o) => (
          <li key={o.to} className="flex min-w-0">
            <Link
              to={o.to}
              className="flex flex-1 items-center gap-3 min-w-0 min-h-16 px-4 py-3 rounded-sm md:rounded-md md:gap-4 md:p-5 bg-bg md:bg-surface border border-line md:border-line-soft text-ink transition hover:bg-blue-100 hover:shadow-1"
            >
              <span className="grid place-items-center flex-none size-7 text-navy md:size-12 md:rounded-md md:bg-blue-100 md:border md:border-blue">
                <o.icon size={22} aria-hidden />
              </span>
              <span className="flex flex-col flex-1 min-w-0 gap-0.5">
                <span className="text-base font-semibold md:text-lg md:font-bold">{o.titulo}</span>
                <span className="hidden md:block text-sm leading-snug text-muted">{o.texto}</span>
              </span>
              {o.extra}
              <ChevronRight size={24} className="flex-none text-[#1f6fd0]" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Contador({ n, etiqueta, tono = 'danger' }: { n: number; etiqueta: string; tono?: 'danger' | 'warning' }) {
  return (
    <span
      className={`flex-none inline-grid place-items-center min-w-6 h-6 px-2 rounded-pill text-xs font-bold text-white ${tono === 'danger' ? 'bg-danger' : 'bg-warning-700'}`}
      aria-label={etiqueta}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}
