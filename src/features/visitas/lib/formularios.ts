/*
 * formularios.ts — Ayudas de formulario compartidas por las pantallas de visitas y necesidades.
 * Módulo: visitas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */

const FOCALIZABLE = 'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])'

/**
 * Tras mostrar los errores de validación, lleva el foco al primer campo inválido del formulario (el primero en el
 * orden de la pantalla) y lo centra en la vista. Un grupo (píldoras, tiles) enfoca su primer control. Si no hay
 * ningún campo marcado con aria-invalid, usa el primer mensaje de error visible. Se llama desde un
 * requestAnimationFrame para que React ya haya pintado los errores.
 */
export function enfocarPrimerInvalido(raiz: ParentNode = document) {
  const el = raiz.querySelector<HTMLElement>('form [aria-invalid="true"]') ?? raiz.querySelector<HTMLElement>('form [role="alert"]')
  if (!el) return
  const objetivo = el.matches(FOCALIZABLE) ? el : (el.querySelector<HTMLElement>(FOCALIZABLE) ?? el)
  objetivo.focus({ preventScroll: true })
  const reducir = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  objetivo.scrollIntoView({ block: 'center', behavior: reducir ? 'auto' : 'smooth' })
}
