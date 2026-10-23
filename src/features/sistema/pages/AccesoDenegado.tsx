/*
 * AccesoDenegado.tsx — Pantalla que impide el acceso a una función no autorizada para el rol (RF-09).
 * Módulo: sistema.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { ShieldX } from 'lucide-react'
import { ButtonLink } from '@/components/ui'
import { Page } from '@/layouts/AppShell'

function Contenido({ inicio }: { inicio: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center" data-testid="acceso-denegado">
      <span className="grid place-items-center size-20 rounded-full bg-danger-100 text-danger">
        <ShieldX size={40} aria-hidden />
      </span>
      <h2 className="text-2xl font-bold">Acceso no autorizado</h2>
      <p className="text-ink-2 max-w-md">
        Tu rol no tiene permiso para usar esta función. Si crees que deberías tener acceso, contacta al administrador de tu organización.
      </p>
      <ButtonLink to={inicio} replace>
        Ir a mi inicio
      </ButtonLink>
    </div>
  )
}

/** enShell: se muestra dentro del área del rol (con cabecera); si no, como pantalla completa. */
export function AccesoDenegado({ inicio, enShell }: { inicio: string; enShell?: boolean }) {
  if (enShell) {
    return (
      <Page title="Acceso no autorizado" back>
        <Contenido inicio={inicio} />
      </Page>
    )
  }
  return (
    <main className="min-h-dvh grid place-items-center px-6 bg-bg">
      <Contenido inicio={inicio} />
    </main>
  )
}
