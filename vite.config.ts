/*
 * vite.config.ts — Configuración de Vite: React, Tailwind CSS y PWA (Service Worker + Web App Manifest).
 * Módulo: configuración.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // allowedHosts: permite abrirlo por el port forwarding de VS Code (dev tunnels) sin el error "Blocked request".
  server: { host: true, allowedHosts: ['.devtunnels.ms'] },
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
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f9fc',
        theme_color: '#0c3b6e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-256.png', sizes: '256x256', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Service Worker (RSUP-03): precachea la app para que abra sin conexión. La caché se mantiene muy por
      // debajo del límite de 50 MB (SRS §9.1.1): solo los archivos de la app, sin datos de usuarios.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
})
