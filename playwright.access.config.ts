/* Pruebas del acceso conectado con servicios interceptados. © 2026 Equipo CuidaRed – INTEC. */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/access',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5174', serviceWorkers: 'block' },
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    env: {
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
