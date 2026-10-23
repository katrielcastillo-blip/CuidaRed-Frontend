/*
 * cn.ts — Une clases de Tailwind condicionales: cn('a', cond && 'b') → "a b".
 * Módulo: utilidades compartidas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(' ')
}
