/*
 * Circulos.tsx — Círculos decorativos del fondo de las pantallas públicas ("íconosLogo" del Figma).
 * Módulo: auth.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Todas las medidas se expresan en "u" = 1/428 del menor lado de la ventana: en móvil reproduce el
 * Figma (lienzo 428 × 926) y en escritorio los círculos crecen sin salirse de sus esquinas.
 */
const CIRCULO = 'absolute rounded-full'

export function Circulos() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden [--u:calc(min(100vw,100vh)/428)]" aria-hidden="true">
      <span className={`${CIRCULO} size-[calc(var(--u)*438)] right-[calc(var(--u)*-88)] bottom-[calc(var(--u)*-94)] bg-teal-100`} />
      <span className={`${CIRCULO} size-[calc(var(--u)*319)] left-[calc(var(--u)*-115)] top-[calc(var(--u)*-61)] bg-blue`} />
      <span className={`${CIRCULO} size-[calc(var(--u)*56)] left-[calc(var(--u)*167)] top-[calc(var(--u)*124)] bg-[#003f9e]`} />
      <span className={`${CIRCULO} size-[calc(var(--u)*43)] left-[calc(var(--u)*23)] bottom-[calc(var(--u)*145)] bg-teal`} />
      <span className={`${CIRCULO} size-[calc(var(--u)*25)] right-[calc(var(--u)*-12)] bottom-[calc(var(--u)*344)] bg-teal`} />
    </div>
  )
}
