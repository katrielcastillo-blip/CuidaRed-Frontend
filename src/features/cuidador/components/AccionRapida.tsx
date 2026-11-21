/*
 * AccionRapida.tsx — Botón grande de acción rápida del inicio del cuidador (icono + texto, ≥ 48 px de alto).
 * «positivo» (verde suave) para registrar; «navegar» (azul claro) para ir a una sección.
 * Módulo: cuidador (SRS §13.1 Interfaz móvil de campo).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

const TONOS = {
  positivo: 'bg-teal-100 text-success-700 border-teal',
  navegar: 'bg-blue-100 text-navy border-blue',
}

export function AccionRapida({ to, icon, tono = 'navegar', children }: { to: string; icon: ReactNode; tono?: keyof typeof TONOS; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex flex-col items-center justify-center gap-2 min-h-24 px-3 py-3 rounded-md border-2 text-center text-lg font-semibold leading-tight transition hover:brightness-[.97] active:translate-y-px',
        TONOS[tono],
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}
