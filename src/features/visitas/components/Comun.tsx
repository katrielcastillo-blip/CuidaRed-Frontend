/*
 * Comun.tsx — Piezas compartidas por las pantallas de visitas y necesidades: punto de estado ("● Pendiente"),
 * badge "Pendiente de sincronización", panel azul con título y pantalla "No encontrado o sin permiso".
 * Módulo: visitas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { CloudUpload } from 'lucide-react'
import { Badge, ButtonLink, EmptyState } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'

/** "● Pendiente": punto de color + texto (el color nunca es la única pista: siempre va con la etiqueta). */
export function EstadoPunto({ dot, children, className }: { dot: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold text-ink', className)}>
      <span className={cn('size-2.5 flex-none rounded-full', dot)} aria-hidden />
      {children}
    </span>
  )
}

/** Marca de los registros guardados solo en el dispositivo (RF-10 · CU-14). */
export function SyncBadge({ visible = true }: { visible?: boolean }) {
  if (!visible) return null
  return (
    <Badge tone="warning">
      <CloudUpload size={11} strokeWidth={3} aria-hidden />
      Pendiente de sincronización
    </Badge>
  )
}

/** Caja azul clara con título (Notas, Observaciones, Descripción). */
export function Panel({ titulo, children, id, className }: { titulo: string; children: ReactNode; id: string; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3 p-4 rounded-sm bg-blue-100', className)} aria-labelledby={id}>
      <h3 className="text-lg font-bold text-ink" id={id}>
        {titulo}
      </h3>
      {children}
    </section>
  )
}

/** Texto largo dentro de un Panel (respeta saltos de línea). */
export function Caja({ children }: { children: ReactNode }) {
  return <p className="p-3 rounded-sm bg-bg text-ink-2 text-base leading-relaxed whitespace-pre-wrap wrap-anywhere">{children}</p>
}

/**
 * Registro inexistente o fuera del alcance del usuario (RBAC): mismo mensaje en ambos casos para no
 * revelar si el registro existe (SRS §8.2.2.3.5 l).
 */
export function NoEncontrado({ titulo }: { titulo: string }) {
  const { base } = useShell()
  return (
    <Page title={titulo} back>
      <div className="min-h-[40vh] grid place-items-center">
        <EmptyState
          title="No encontrado o sin permiso"
          text="El registro no existe o no tienes acceso a él."
          action={
            <ButtonLink variant="outline" size="sm" to={base}>
              Ir al inicio
            </ButtonLink>
          }
        />
      </div>
    </Page>
  )
}
