/*
 * vitest.config.ts — Pruebas de componentes del front con Vitest + Testing Library (CR-188).
 * Módulo: pruebas. Las pruebas E2E siguen en Playwright (playwright.config.ts); aquí solo *.test.ts(x).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['tests/componentes/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/componentes/setup.ts'],
    css: false,
    restoreMocks: true,
  },
})
