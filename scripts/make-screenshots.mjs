// make-screenshots.mjs — Genera las capturas del manifest de la PWA (public/screenshots).
// © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
// Chrome muestra estas capturas en el cuadro de instalación ampliado de Android y de escritorio.
// Tamaños: móvil 540×960 y escritorio 1280×720 (todas las de cada factor con la misma proporción).
// Uso (con el prototipo en marcha: VITE_AUTH_MODE=demo npm run dev): node scripts/make-screenshots.mjs [--port 5173]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const port = process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : '5173'
const base = `http://localhost:${port}`
const IDS = { voluntario: 'u-cuid', coordinador: 'u-coord' }

const CAPTURAS = [
  { archivo: 'inicio-movil.png', ruta: '/coordinador', rol: 'coordinador', viewport: { width: 540, height: 960 }, movil: true },
  { archivo: 'adultos-movil.png', ruta: '/coordinador/adultos', rol: 'coordinador', viewport: { width: 540, height: 960 }, movil: true },
  { archivo: 'inicio-escritorio.png', ruta: '/coordinador', rol: 'coordinador', viewport: { width: 1280, height: 720 }, movil: false },
]

mkdirSync('public/screenshots', { recursive: true })
const browser = await chromium.launch()
for (const c of CAPTURAS) {
  const ctx = await browser.newContext({ viewport: c.viewport, deviceScaleFactor: 1, isMobile: c.movil, hasTouch: c.movil, locale: 'es-DO' })
  const page = await ctx.newPage()
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((uid) => {
    const ahora = new Date().toISOString()
    localStorage.setItem('cuidared:sesion', JSON.stringify({ usuarioId: uid, inicio: ahora, ultimaActividad: ahora }))
  }, IDS[c.rol])
  await page.goto(`${base}${c.ruta}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `public/screenshots/${c.archivo}` })
  console.log(`public/screenshots/${c.archivo} (${c.viewport.width}×${c.viewport.height})`)
  await ctx.close()
}
await browser.close()
