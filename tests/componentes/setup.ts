/*
 * setup.ts — Preparación de las pruebas de componentes (Vitest + jsdom): matchers de jest-dom, limpieza del DOM y
 * del almacenamiento entre pruebas, y APIs del navegador que jsdom no trae (matchMedia, crypto.subtle ya existe).
 * Módulo: pruebas (CR-188).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}

if (!window.scrollTo) window.scrollTo = () => undefined
