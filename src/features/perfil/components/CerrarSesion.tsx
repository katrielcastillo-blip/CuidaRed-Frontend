/*
 * CerrarSesion.tsx — Confirmación de "Cerrar sesión": avisa si quedan registros sin sincronizar en el dispositivo.
 * Módulo: perfil (CU-01 · SRS §8.2.2.3.5 i: gestión segura de sesiones · CU-14: datos pendientes).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useNavigate } from 'react-router-dom'
import { LogOut, RefreshCcw } from 'lucide-react'
import { Button, ButtonLink, Sheet } from '@/components/ui'
import { logout } from '@/domain/auth'
import { usePendientes } from '@/domain/sync'

export function CerrarSesion({ open, onClose, base }: { open: boolean; onClose: () => void; base: string }) {
  const navigate = useNavigate()
  const pendientes = usePendientes()
  const n = pendientes.length

  const salir = () => {
    logout()
    navigate('/inicio', { replace: true })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="¿Cerrar sesión?"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" size="sm" icon={<LogOut size={18} aria-hidden />} onClick={salir}>
            {n > 0 ? 'Cerrar igualmente' : 'Cerrar sesión'}
          </Button>
        </>
      }
    >
      <p className="leading-normal text-ink-2">Saldrás de CuidaRed en este dispositivo. Para volver a entrar necesitarás tu correo y tu contraseña.</p>
      {n > 0 && (
        <div className="flex flex-col gap-3 rounded-sm border border-warning bg-warning-100 p-3.5">
          <p className="leading-normal text-warning-700">
            <strong>
              Tienes {n} registro{n === 1 ? '' : 's'} sin sincronizar.
            </strong>{' '}
            Seguirán guardados en este dispositivo y se enviarán la próxima vez que inicies sesión con conexión. No borres los datos del navegador ni uses otro dispositivo hasta
            entonces, o podrían perderse.
          </p>
          <ButtonLink to={`${base}/sincronizacion`} variant="outline" size="sm" icon={<RefreshCcw size={18} aria-hidden />}>
            Sincronizar ahora
          </ButtonLink>
        </div>
      )}
    </Sheet>
  )
}
