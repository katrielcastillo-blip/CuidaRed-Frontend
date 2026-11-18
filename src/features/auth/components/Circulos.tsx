/*
 * Circulos.tsx — Círculos decorativos del fondo de las pantallas públicas ("íconosLogo" del Figma).
 * Módulo: auth.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Todas las medidas se expresan en "u" = 1/428 del menor lado de la ventana: en móvil reproduce el
 * Figma (lienzo 428 × 926) y en escritorio los círculos crecen sin salirse de sus esquinas.
 */
const CIRCULO = 'absolute rounded-full'
const FONDOS = {
  acceso: [
    'size-[calc(var(--u)*438)] right-[calc(var(--u)*-88)] bottom-[calc(var(--u)*-94)] bg-teal-100',
    'size-[calc(var(--u)*319)] left-[calc(var(--u)*-115)] top-[calc(var(--u)*-61)] bg-blue',
    'size-[calc(var(--u)*56)] left-[calc(var(--u)*167)] top-[calc(var(--u)*124)] bg-[#003f9e]',
    'size-[calc(var(--u)*43)] left-[calc(var(--u)*23)] bottom-[calc(var(--u)*145)] bg-teal',
    'size-[calc(var(--u)*25)] right-[calc(var(--u)*-12)] bottom-[calc(var(--u)*344)] bg-teal',
  ],
  portada: [
    '-right-28 -bottom-28 size-64 bg-teal-100 md:-right-36 md:-bottom-40 md:size-[30rem]',
    '-left-36 -top-26 size-64 bg-blue-100 md:-left-52 md:-top-32 md:size-[27rem]',
    'right-6 top-8 size-5 bg-[#003f9e] md:right-[8%] md:top-8 md:size-8',
    'left-5 bottom-4 size-3.5 bg-teal md:left-[3%] md:bottom-13 md:size-6',
    '-right-2 top-[53%] size-5 bg-blue md:top-[30%] md:size-9',
  ],
} as const

export function Circulos({ variante = 'acceso' }: { variante?: keyof typeof FONDOS }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden [--u:calc(min(100vw,100vh)/428)]" aria-hidden="true">
      {FONDOS[variante].map((clases) => <span key={clases} className={`${CIRCULO} ${clases}`} />)}
    </div>
  )
}
