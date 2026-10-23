/*
 * Mas.tsx — Menú «Más» del administrador: accesos a gestión (incluida la agenda de tareas), administración
 * (configuración, plan y suscripción, catálogos), sistema y cuenta (filas de 48 px o más con icono). Cada opción
 * se muestra solo si el rol tiene el permiso correspondiente.
 * Módulo: admin (SRS §13.1 "Panel de gestión" · §8.2.2.1.18 Operabilidad · §18.3 "Acerca de" y avisos legales).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link, useNavigate } from 'react-router-dom'
import {
  BellRing,
  CalendarCheck,
  ChartColumn,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Database,
  FileText,
  Info,
  KeyRound,
  LogOut,
  RefreshCw,
  ScrollText,
  Settings,
  Shield,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useToast } from '@/components/ui'
import { logout, useUser } from '@/domain/auth'
import { puede, type Accion } from '@/domain/permisos'
import { pendientesDelUsuario } from '@/domain/sync'
import { Page, useShell } from '@/layouts/AppShell'

interface Opcion {
  to: string
  icono: LucideIcon
  titulo: string
  detalle: string
  /** Permiso necesario para ver la opción. */
  permiso?: Accion
}

const FILA = 'flex items-center gap-3 w-full min-h-16 px-4 py-3 text-left transition-colors hover:bg-blue-100/60 focus-visible:relative'
const ICONO = 'grid place-items-center size-10 flex-none rounded-md bg-blue-100 border border-blue text-navy'

export default function Mas() {
  const { base, perfilPath } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const user = useUser()

  const grupos: Array<{ titulo: string; opciones: Opcion[] }> = [
    {
      titulo: 'Gestión',
      opciones: [
        { to: `${base}/alertas`, icono: BellRing, titulo: 'Alertas', detalle: 'Bandeja de alertas por nivel de urgencia.' },
        { to: `${base}/agenda`, icono: CalendarCheck, titulo: 'Agenda de tareas', detalle: 'Tareas de cuidado asignadas, evidencias y su validación.', permiso: 'agenda:ver' },
        { to: `${base}/resumen`, icono: ClipboardList, titulo: 'Resumen de seguimiento', detalle: 'Estado de cada adulto mayor y casos pendientes.' },
        { to: `${base}/reportes`, icono: ChartColumn, titulo: 'Reportes', detalle: 'Visitas, necesidades y riesgo de la organización.' },
      ],
    },
    {
      titulo: 'Administración',
      opciones: [
        { to: `${base}/auditoria`, icono: ScrollText, titulo: 'Registro de auditoría', detalle: 'Quién hizo qué, cuándo y con qué resultado.' },
        { to: `${base}/roles`, icono: KeyRound, titulo: 'Roles y permisos', detalle: 'Qué puede hacer cada rol.' },
        { to: `${base}/configuracion`, icono: Settings, titulo: 'Configuración', detalle: 'Datos de la cuenta y parámetros (umbral de alertas, notificaciones).', permiso: 'organizacion:configurar' },
        { to: `${base}/suscripcion`, icono: CreditCard, titulo: 'Plan y suscripción', detalle: 'Plan contratado, prueba gratuita, uso y pagos.', permiso: 'cuenta:suscripcion' },
        { to: `${base}/catalogos`, icono: Database, titulo: 'Catálogos', detalle: 'Listas de referencia de la base de datos (solo lectura).', permiso: 'catalogos:ver' },
        { to: `${base}/sincronizacion`, icono: RefreshCw, titulo: 'Conexión y sincronización', detalle: 'Estado de la conexión y registros pendientes.' },
      ],
    },
    {
      titulo: 'Información',
      opciones: [
        { to: `${base}/ayuda`, icono: CircleHelp, titulo: 'Ayuda', detalle: 'Guía rápida de uso.' },
        { to: `${base}/acerca`, icono: Info, titulo: 'Acerca de CuidaRed', detalle: 'Versión, equipo y créditos.' },
        { to: '/terminos', icono: FileText, titulo: 'Términos de uso', detalle: 'Condiciones de uso del servicio.' },
        { to: '/privacidad', icono: Shield, titulo: 'Privacidad', detalle: 'Cómo protegemos los datos personales.' },
      ],
    },
    {
      titulo: 'Cuenta',
      opciones: [{ to: perfilPath, icono: UserRound, titulo: 'Mi perfil', detalle: 'Tus datos personales y contraseña.' }],
    },
  ]

  const cerrarSesion = () => {
    const pendientes = pendientesDelUsuario().length
    logout()
    if (pendientes) toast(`Tienes ${pendientes} registro(s) sin sincronizar guardados en este dispositivo. Se enviarán cuando vuelvas a iniciar sesión con conexión.`, 'info')
    navigate('/inicio', { replace: true })
  }

  return (
    <Page title="Más" wide>
      <h2 className="text-xl font-bold">Más opciones</h2>
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        {grupos.map((g) => (
          <section key={g.titulo} aria-labelledby={`h-${g.titulo}`} className="flex flex-col gap-2 min-w-0">
            <h3 id={`h-${g.titulo}`} className="px-1 text-xs font-bold uppercase tracking-wide text-muted">
              {g.titulo}
            </h3>
            <ul className="flex flex-col rounded-md border border-line-soft bg-bg overflow-hidden divide-y divide-line-soft">
              {g.opciones.filter((o) => !o.permiso || puede(user, o.permiso)).map((o) => (
                <li key={o.to}>
                  <Link to={o.to} className={FILA}>
                    <span className={ICONO}>
                      <o.icono size={20} aria-hidden />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col">
                      <strong className="text-base font-bold text-ink">{o.titulo}</strong>
                      <span className="text-sm text-muted leading-snug">{o.detalle}</span>
                    </span>
                    <ChevronRight size={20} className="flex-none text-blue" aria-hidden />
                  </Link>
                </li>
              ))}
              {g.titulo === 'Cuenta' && (
                <li>
                  <button type="button" className={`${FILA} hover:bg-danger-100`} onClick={cerrarSesion}>
                    <span className="grid place-items-center size-10 flex-none rounded-md bg-danger-100 border border-danger text-danger">
                      <LogOut size={20} aria-hidden />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col">
                      <strong className="text-base font-bold text-danger">Cerrar sesión</strong>
                      <span className="text-sm text-muted leading-snug">Salir de CuidaRed en este dispositivo.</span>
                    </span>
                  </button>
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  )
}
