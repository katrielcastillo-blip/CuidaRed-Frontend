/*
 * NoEncontrado.tsx — Respuesta única cuando el registro de la URL no existe o pertenece a otro grupo
 * familiar: no revela cuál de los dos casos ocurre (SRS §8.2.2.3.4 c · RF-09).
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { SearchX } from 'lucide-react'
import { Page, useShell } from '@/layouts/AppShell'
import { ButtonLink, EmptyState } from '@/components/ui'

export function NoEncontrado({ titulo }: { titulo: string }) {
  const { base } = useShell()
  return (
    <Page title={titulo} back={base}>
      <div className="flex flex-col items-center gap-2 pt-6">
        <span className="grid place-items-center size-16 rounded-full bg-surface-2 text-muted">
          <SearchX size={32} aria-hidden />
        </span>
        <EmptyState
          title="No encontrado o sin permiso"
          text="Este registro no existe o no pertenece a tu grupo familiar. Solo puedes consultar a los adultos mayores que tienes a cargo."
          action={
            <div className="mt-3">
              <ButtonLink to={base}>Volver al inicio</ButtonLink>
            </div>
          }
        />
      </div>
    </Page>
  )
}
