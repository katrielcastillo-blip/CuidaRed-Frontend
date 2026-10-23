/*
 * playwright.config.ts — Suite de pruebas automatizadas alineada a la Matriz de Trazabilidad (RTM, SRS §6.6
 * y RSUP-04): una suite E2E por caso de uso (tests/e2e/e2e-cuXX-*.spec.ts) y pruebas unitarias del dominio.
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Proyectos:
 *  - movil:      360×640 (resolución de referencia de RF-06), táctil.
 *  - escritorio: 1280×800.
 *  - unit:       funciones puras del dominio (sin navegador).
 * Usa el servidor de desarrollo en http://localhost:5173 (lo arranca si no está corriendo).
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    locale: 'es-DO',
    timezoneId: 'America/Santo_Domingo',
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'unit', testMatch: /unit\/.*\.spec\.ts/ },
    {
      name: 'movil',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 640 } },
    },
    {
      name: 'escritorio',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
})
