/*
 * LogoBadge.tsx — Logosímbolo blanco sobre círculo navy que corona las pantallas de registro y recuperación.
 * Módulo: auth.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * La imagen trae margen vacío bajo el círculo: se recorta para que mida 64 × 64 como en el Figma.
 */
export function LogoBadge() {
  return <img className="block size-16 flex-none self-center object-cover object-[50%_58%]" src="/brand/logo-badge.png" width={64} height={64} alt="" />
}
