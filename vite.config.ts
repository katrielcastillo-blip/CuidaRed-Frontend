/*
 * vite.config.ts — Configuración de Vite: React, Tailwind CSS y PWA (Service Worker + Web App Manifest).
 * Módulo: configuración.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * PWA (RSUP-03 · RNF-5.2):
 *  - Instalable en Android (manifest + iconos 192/512 + maskable + capturas) e iOS (metas apple-* en index.html).
 *  - Precache del shell (HTML, JS, CSS, iconos y fuentes latinas) con `navigateFallback`: la app abre sin conexión.
 *  - Caché total ≤ 50 MB: el precache pesa ~1 MB (lo comprueba `node scripts/verificar-cache.mjs` tras compilar) y las
 *    cachés de runtime tienen expiración por número de entradas y por antigüedad.
 *  - RS-018: nada de /api/ ni datos de personas en Cache Storage. Las llamadas a /api/ van siempre a la red y se
 *    excluyen del `navigateFallback`; los datos de campo se guardan en IndexedDB (src/domain/sync.ts).
 */
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const DIA = 24 * 60 * 60

// `self` solo existe dentro del Service Worker generado (las funciones urlPattern se copian tal cual a sw.js).
declare const self: { location: { origin: string } }

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // allowedHosts: permite abrirlo por el port forwarding de VS Code (dev tunnels) sin el error "Blocked request".
  // watch.ignored: los informes y trazas de Playwright (test-results*, playwright-report) no deben recargar la app
  // mientras corren las pruebas.
  server: { host: true, allowedHosts: ['.devtunnels.ms'], watch: { ignored: ['**/test-results*/**', '**/playwright-report/**', '**/shots/**'] } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'brand/logo.png'],
      manifest: {
        name: 'CuidaRed · Seguimiento Comunitario',
        short_name: 'CuidaRed',
        description:
          'Seguimiento comunitario de adultos mayores vulnerables en la República Dominicana: perfiles, visitas, necesidades, alertas y reportes. Funciona sin conexión.',
        id: '/',
        categories: ['health', 'social', 'productivity'],
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Sin bloqueo de orientación: en tablet y escritorio la app usa el ancho completo.
        orientation: 'any',
        background_color: '#f7f9fc',
        theme_color: '#0c3b6e',
        prefer_related_applications: false,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Capturas del cuadro de instalación ampliado (Chrome/Android y escritorio). Se generan con scripts/make-screenshots.mjs.
        screenshots: [
          { src: 'screenshots/inicio-movil.png', sizes: '540x960', type: 'image/png', form_factor: 'narrow', label: 'Panel con alertas y casos activos' },
          { src: 'screenshots/adultos-movil.png', sizes: '540x960', type: 'image/png', form_factor: 'narrow', label: 'Lista de adultos mayores en seguimiento' },
          { src: 'screenshots/inicio-escritorio.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Panel de gestión en escritorio' },
        ],
      },
      workbox: {
        // Shell de la app. Las capturas del manifest se descargan solo al instalar (no se precachean) y de las
        // fuentes solo se precachean las latinas (cubren el español): las demás subconjuntos se piden a la red
        // y, si se usan, quedan en la caché de runtime de fuentes.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['screenshots/**', '**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
        // Todas las rutas de la SPA abren sin conexión con el shell, salvo la API.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Un archivo mayor que esto no se precachea y la app no abriría sin conexión: verificar-cache.mjs lo detecta.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          // RS-018: la API (cualquier origen) nunca se guarda en caché. Solo red.
          { urlPattern: ({ url }) => url.pathname.startsWith('/api/'), handler: 'NetworkOnly' },
          // Fuentes propias: casi inmutables → cache first, 12 archivos como máximo, 1 año.
          {
            urlPattern: ({ request, url }) => request.destination === 'font' && url.origin === self.location.origin,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cuidared-fuentes',
              expiration: { maxEntries: 12, maxAgeSeconds: 365 * DIA, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          // Imágenes propias de la app (logotipos, iconos): 40 como máximo, 30 días. Las de otros orígenes (fotos de
          // personas, almacenamiento remoto) no se guardan.
          {
            urlPattern: ({ request, url }) => request.destination === 'image' && url.origin === self.location.origin,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cuidared-imagenes',
              expiration: { maxEntries: 40, maxAgeSeconds: 30 * DIA, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
