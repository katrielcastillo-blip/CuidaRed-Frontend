/*
 * NoEncontrado.tsx — Respuesta única cuando la tarea de la URL no existe o el usuario no la alcanza
 * (otro adulto u otra organización): no revela cuál de los dos casos ocurre (RF-09).
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { SearchX } from 'lucide-react'
import { ButtonLink, EmptyState } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'

export function NoEncontrado({ titulo }: { titulo: string }) {
  const { base } = useShell()
  return (
    <Page title={titulo} back={`${base}/agenda`}>
      <div className="flex flex-col items-center gap-2 pt-6">
        <span className="grid place-items-center size-16 rounded-full bg-surface-2 text-muted">
          <SearchX size={32} aria-hidden />
        </span>
        <EmptyState
          title="No encontrado o sin permiso"
          text="Esta tarea no existe o no está dentro de tu alcance. Solo puedes consultar las tareas de los adultos mayores a tu cargo o las asignadas a ti."
          action={
            <div className="mt-3">
              <ButtonLink to={`${base}/agenda`}>Volver a la agenda</ButtonLink>
            </div>
          }
        />
      </div>
    </Page>
  )
}
