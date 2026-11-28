/* Pruebas del acceso conectado con servicios interceptados. © 2026 Equipo CuidaRed – INTEC. */
import { defineConfig, devices } from '@playwright/test'

// Puerto configurable para correr varias suites en paralelo en la misma máquina.
const puerto = Number(process.env.CUIDARED_ACCESS_PORT ?? 5174)

export default defineConfig({
  testDir: './tests/access',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://localhost:${puerto}`, serviceWorkers: 'block' },
  webServer: {
    command: `npm run dev -- --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}`,
    reuseExistingServer: false,
    env: {
      CUIDARED_VITE_CACHE_DIR: puerto === 5174 ? 'node_modules/.vite-access' : `node_modules/.vite-access-${puerto}`,
      VITE_AUTH_MODE: 'supabase',
      VITE_API_URL: 'http://localhost:3301',
      VITE_SUPABASE_URL: 'https://auth.cuidared.test',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
    },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 640 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
})
