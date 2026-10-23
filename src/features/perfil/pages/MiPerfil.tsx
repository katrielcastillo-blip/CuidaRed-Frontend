/*
 * MiPerfil.tsx — Mi perfil: datos de la persona usuaria y menú de configuración común a los 4 roles
 * (editar perfil, contraseña, conexión, ayuda, Acerca de, avisos legales, datos de demostración, cerrar sesión).
 * Módulo: perfil (SRS §18.3 "Acerca de accesible desde el menú de configuración" · §8.2.2.1.8.2 · RF-10).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  CircleHelp,
  FileText,
  Info,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  UserPen,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Badge, Button, ButtonLink, InfoRow, Sheet, useToast } from '@/components/ui'
import { logout, nombreCompleto, ROL_LABEL, useSession } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { resetDemo } from '@/domain/store'
import { usePendientes } from '@/domain/sync'
import type { Organizacion, Usuario } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { CambiarPassword } from '../components/CambiarPassword'
import { PerfilCabecera } from '../components/PerfilCabecera'
import { muestraCedula } from '../lib/rol'

const FILA =
  'flex w-full min-h-14 items-center gap-3.5 px-4 py-2.5 text-left transition hover:bg-blue-100 focus-visible:-outline-offset-2'

function ContenidoFila({ icono, titulo, detalle, extra, tono }: { icono: ReactNode; titulo: string; detalle?: string; extra?: ReactNode; tono?: 'danger' }) {
  return (
    <>
      <span className={cn('grid size-10 flex-none place-items-center rounded-md', tono === 'danger' ? 'bg-danger-100 text-danger' : 'bg-blue-100 text-navy')} aria-hidden>
        {icono}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('font-semibold', tono === 'danger' ? 'text-danger' : 'text-ink')}>{titulo}</span>
        {detalle && <span className="text-sm leading-snug text-muted">{detalle}</span>}
      </span>
      {extra}
      <ChevronRight size={20} className="flex-none text-muted" aria-hidden />
    </>
  )
}

/** Fila del menú de configuración (≥ 48 px de alto): enlace o botón. */
function Fila(props: { icono: ReactNode; titulo: string; detalle?: string; extra?: ReactNode; tono?: 'danger'; to?: string; onClick?: () => void }) {
  const { to, onClick, ...contenido } = props
  return (
    <li className="border-t border-line-soft first:border-t-0">
      {to ? (
        <Link to={to} className={FILA}>
          <ContenidoFila {...contenido} />
        </Link>
      ) : (
        <button type="button" className={FILA} onClick={onClick}>
          <ContenidoFila {...contenido} />
        </button>
      )}
    </li>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = `grupo-${titulo.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="px-1 text-sm font-bold uppercase tracking-[0.06em] text-muted">
        {titulo}
      </h2>
      <ul className="overflow-hidden rounded-md border border-line-soft bg-surface shadow-1">{children}</ul>
    </section>
  )
}

function Vista({ user, org }: { user: Usuario; org: Organizacion | null }) {
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const pendientes = usePendientes()
  const [cambiando, setCambiando] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const [confirmarReinicio, setConfirmarReinicio] = useState(false)
  const conCedula = muestraCedula(user.rol)
  const cerrarPassword = useCallback(() => setCambiando(false), [])
  const cerrarSalida = useCallback(() => setConfirmarSalida(false), [])
  const cerrarReinicio = useCallback(() => setConfirmarReinicio(false), [])

  const salir = () => {
    logout()
    navigate('/inicio', { replace: true })
  }
  const pedirSalida = () => (pendientes.length > 0 ? setConfirmarSalida(true) : salir())
  const reiniciar = () => {
    logout()
    resetDemo()
    toast('Datos de demostración restablecidos')
    navigate('/inicio', { replace: true })
  }

  return (
    <Page title="Mi perfil" back={base} hideAvatar>
      <div className="flex flex-col gap-6 md:rounded-lg md:border md:border-line-soft md:bg-surface md:px-10 md:py-8 md:shadow-1">
        <PerfilCabecera
          nombre={nombreCompleto(user)}
          avatar={user.avatar}
          size={conCedula ? 132 : 150}
          cedula={conCedula ? user.cedula : undefined}
          rol={ROL_LABEL[user.rol]}
          organizacion={org?.nombre}
        />

        <section aria-labelledby="perfil-info" className="flex flex-col gap-4">
          <h2 className="section-title" id="perfil-info">
            Información personal
          </h2>
          <div className="grid gap-4 md:grid-cols-2 md:gap-x-8">
            <InfoRow icon={<Mail size={22} aria-hidden />} label="Correo electrónico" value={user.email} />
            <InfoRow icon={<Phone size={22} aria-hidden />} label="Teléfono" value={user.telefono || 'Sin registrar'} />
          </div>
        </section>

        <Grupo titulo="Cuenta">
          <Fila to={`${base}/perfil/editar`} icono={<UserPen size={20} />} titulo="Editar perfil" detalle="Nombre, correo, teléfono y foto" />
          <Fila onClick={() => setCambiando(true)} icono={<KeyRound size={20} />} titulo="Cambiar contraseña" detalle="Actualiza tu contraseña de acceso" />
        </Grupo>

        <Grupo titulo="Aplicación">
          <Fila
            to={`${base}/sincronizacion`}
            icono={enLinea ? <Wifi size={20} /> : <WifiOff size={20} />}
            titulo="Conexión y sincronización"
            detalle={enLinea ? 'En línea' : 'Sin conexión'}
            extra={pendientes.length > 0 ? <Badge tone="warning">{pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}</Badge> : undefined}
          />
          <Fila to={`${base}/ayuda`} icono={<CircleHelp size={20} />} titulo="Ayuda" detalle="Guía rápida para usar CuidaRed" />
          <Fila to={`${base}/acerca`} icono={<Info size={20} />} titulo="Acerca de CuidaRed" detalle="Versión, equipo y créditos" />
        </Grupo>

        <Grupo titulo="Avisos legales">
          <Fila to="/terminos" icono={<FileText size={20} />} titulo="Términos y Condiciones" />
          <Fila to="/privacidad" icono={<ShieldCheck size={20} />} titulo="Política de Privacidad" detalle="Tus datos y cómo ejercer tus derechos" />
        </Grupo>

        <Grupo titulo="Demostración">
          <Fila
            onClick={() => setConfirmarReinicio(true)}
            icono={<RotateCcw size={20} />}
            titulo="Restablecer datos de demostración"
            detalle="Vuelve a los datos iniciales del prototipo"
          />
        </Grupo>

        <Button variant="danger-soft" fullWidth icon={<LogOut size={22} aria-hidden />} onClick={pedirSalida}>
          Cerrar sesión
        </Button>
      </div>

      <CambiarPassword open={cambiando} onClose={cerrarPassword} user={user} />

      <Sheet
        open={confirmarSalida}
        onClose={cerrarSalida}
        title="Tienes registros sin sincronizar"
        footer={
          <>
            <ButtonLink to={`${base}/sincronizacion`} variant="outline" size="sm" icon={<RefreshCcw size={18} aria-hidden />}>
              Sincronizar
            </ButtonLink>
            <Button variant="danger" size="sm" onClick={salir}>
              Cerrar sesión igualmente
            </Button>
          </>
        }
      >
        <p className="leading-normal text-ink-2">
          Hay <strong className="text-ink">{pendientes.length}</strong> registro{pendientes.length === 1 ? '' : 's'} guardado{pendientes.length === 1 ? '' : 's'} solo en este
          dispositivo. Si cierras sesión ahora, seguirán aquí y se enviarán la próxima vez que inicies sesión con conexión.
        </p>
        <p className="text-sm leading-normal text-warning-700">No borres los datos del navegador ni uses otro dispositivo hasta sincronizarlos, o podrían perderse.</p>
      </Sheet>

      <Sheet
        open={confirmarReinicio}
        onClose={cerrarReinicio}
        title="Restablecer datos de demostración"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={cerrarReinicio}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={reiniciar}>
              Sí, restablecer
            </Button>
          </>
        }
      >
        <p className="leading-normal text-ink-2">
          Se borrarán todos los cambios hechos en este dispositivo (incluidos los registros pendientes de sincronizar) y se cerrará la sesión. Esta acción no se puede deshacer.
        </p>
      </Sheet>
    </Page>
  )
}

/** Mi perfil — compartido por los 4 roles. */
export default function MiPerfil() {
  const { user, org } = useSession()
  if (!user) return null
  return <Vista user={user} org={org} />
}
