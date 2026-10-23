/*
 * NoEncontrada.tsx — Página inexistente dentro del área del rol (en lugar de expulsar al usuario a la portada).
 * Módulo: sistema.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { SearchX } from 'lucide-react'
import { ButtonLink } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'

export default function NoEncontrada() {
  const { base } = useShell()
  return (
    <Page title="Página no encontrada" back>
      <div className="flex flex-col items-center gap-4 py-10 text-center" data-testid="no-encontrada">
        <span className="grid place-items-center size-20 rounded-full bg-surface-2 text-ink-2">
          <SearchX size={40} aria-hidden />
        </span>
        <h2 className="text-2xl font-bold">No encontramos esta página</h2>
        <p className="text-ink-2 max-w-md">La dirección no existe o no está disponible para tu rol.</p>
        <ButtonLink to={base} replace>
          Ir a mi inicio
        </ButtonLink>
      </div>
    </Page>
  )
}
