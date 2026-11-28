/*
 * pwa-instalacion.js — Guarda el evento `beforeinstallprompt` de Chrome/Edge/Android apenas ocurre.
 * Módulo: PWA (instalación).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * El navegador lanza el evento una sola vez, normalmente poco después de cargar la página y antes de que el
 * usuario llegue a la pantalla con el botón «Instalar CuidaRed». Este script (cargado desde index.html, sin
 * dependencias) lo retiene en `window.__cuidaredInstalar` para que `useInstalarApp()` lo use después.
 * No guarda ni envía ningún dato.
 */
(function () {
  window.addEventListener('beforeinstallprompt', function (evento) {
    // Evita la mini barra automática: la instalación se ofrece con el botón de la app.
    evento.preventDefault()
    window.__cuidaredInstalar = evento
    window.dispatchEvent(new Event('cuidared:instalable'))
  })
  window.addEventListener('appinstalled', function () {
    window.__cuidaredInstalar = null
    window.__cuidaredInstalada = true
    window.dispatchEvent(new Event('cuidared:instalada'))
  })
})()
