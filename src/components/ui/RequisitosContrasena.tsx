/*
 * RequisitosContrasena.tsx — Requisito de contraseña (Figma «Requisito de contraseña»): pendiente = círculo gris
 * (radio_button_unchecked, nunca una «X» que se lea como error), cumplido = check verde. Cambia en vivo mientras se escribe.
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { cn } from '@/lib/cn'
import { Icono } from './Icono'

export interface RequisitoContrasenaDatos {
  id: string
  texto: string
  cumplido: boolean
}

/** Una fila de requisito: ícono de 20 px + texto de 16 px. El estado también se dice con texto para lectores de pantalla. */
export function RequisitoContrasena({ cumplido, children, className }: { cumplido: boolean; children: string; className?: string }) {
  return (
    <li className={cn('flex items-start gap-2.5 text-cuerpo', cumplido ? 'text-ink' : 'text-muted', className)}>
      <span className={cn('mt-0.5 flex-none', cumplido ? 'text-teal' : 'text-muted')} aria-hidden>
        <Icono nombre={cumplido ? 'check_circle' : 'radio_button_unchecked'} tamano={20} />
      </span>
      <span>
        {children}
        <span className="sr-only">{cumplido ? ' (cumplido)' : ' (pendiente)'}</span>
      </span>
    </li>
  )
}

/** Lista de requisitos con el recuento anunciado en vivo («3 de 5 requisitos cumplidos»). */
export function RequisitosContrasena({
  requisitos,
  titulo = 'Tu contraseña debe tener:',
  id,
  className,
}: {
  requisitos: RequisitoContrasenaDatos[]
  titulo?: string
  id?: string
  className?: string
}) {
  const cumplidos = requisitos.filter((r) => r.cumplido).length
  return (
    <div id={id} className={cn('rounded-md border border-line-soft bg-surface px-4 py-3', className)}>
      <p className="mb-2 text-ayuda font-semibold text-ink">
        {titulo}
        <span className="sr-only" aria-live="polite">
          {` ${cumplidos} de ${requisitos.length} requisitos cumplidos.`}
        </span>
      </p>
      <ul className="grid gap-y-1.5">
        {requisitos.map((r) => (
          <RequisitoContrasena key={r.id} cumplido={r.cumplido}>
            {r.texto}
          </RequisitoContrasena>
        ))}
      </ul>
    </div>
  )
}
