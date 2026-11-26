/*
 * LogoBadge.tsx — Logosímbolo blanco sobre círculo navy que corona las pantallas de registro y recuperación.
 * Módulo: auth.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { cn } from '@/lib/cn'

export function LogoBadge({ className }: { className?: string }) {
  return <img className={cn('block self-center flex-none w-[70px] h-[83px] mb-2', className)} src="/brand/logo-badge.png" width={70} height={83} alt="" />
}
