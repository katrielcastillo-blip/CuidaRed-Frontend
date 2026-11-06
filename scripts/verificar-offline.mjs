// verificar-offline.mjs — Comprueba con un navegador real que la app compilada abre sin conexión (EAC-01).
// © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
//
// Uso (con la app compilada en marcha):
//   npx vite build && npx vite preview --port 4173 --strictPort      (en otra terminal)
//   node scripts/verificar-offline.mjs [urlBase=http://localhost:4173] [--rutas /,/inicio] [--salida carpeta]
// Pasos: carga la app en línea, espera a que el Service Worker termine el precache, corta la red
// (context.setOffline) y comprueba que cada ruta abre desde la caché con el contenido de la app. Además verifica
// que una navegación a /api/ NO recibe el shell (navigateFallbackDenylist) y que Cache Storage no guarda nada de /api/.
// Termina con código 1 si algo falla.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const valor = (nombre, porDefecto) => (args.includes(nombre) ? args[args.indexOf(nombre) + 1] : porDefecto)
const base = (args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'http://localhost:4173').replace(/\/$/, '')
// Git Bash convierte «/» en «C:/Program Files/Git/»: se normaliza (igual que scripts/shot.mjs).
const rutas = valor('--rutas', '/,/inicio')
  .split(',')
  .map((r) => '/' + r.replace(/^[A-Za-z]:\/.*?\/Git\/?/, '').replace(/^\/+/, ''))
const salida = valor('--salida', '')
const fallos = []
const ok = (texto) => console.log(`  ✓ ${texto}`)
const falla = (texto) => {
  fallos.push(texto)
  console.log(`  ✗ ${texto}`)
}
const comprobar = (condicion, bien, mal) => (condicion ? ok(bien) : falla(mal))

const browser = await chromium.launch()
const context = await browser.newContext({ locale: 'es-DO', viewport: { width: 390, height: 844 } })
const page = await context.newPage()
const erroresPagina = []
page.on('pageerror', (e) => erroresPagina.push(e.message))

console.log(`Primera carga en línea: ${base}/`)
await page.goto(`${base}/`, { waitUntil: 'networkidle' })
if (!(await page.evaluate(() => 'serviceWorker' in navigator))) {
  console.error('Este navegador no soporta Service Workers.')
  process.exit(1)
}
// Espera a que el SW esté activo y haya terminado el precache (cache «workbox-precache-…» con entradas).
const listo = await page
  .waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg?.active) return false
      const nombre = (await caches.keys()).find((k) => k.includes('precache'))
      return nombre ? (await (await caches.open(nombre)).keys()).length >= 10 : false
    },
    undefined,
    { timeout: 30_000, polling: 500 },
  )
  .then(() => true)
  .catch(() => false)
comprobar(listo, 'Service Worker activo y precache completo', 'El Service Worker no terminó el precache en 30 s')
// Recarga para que el SW controle la página (clientsClaim) antes de cortar la red.
await page.reload({ waitUntil: 'networkidle' })
const controlada = await page.evaluate(() => !!navigator.serviceWorker.controller)
comprobar(controlada, 'La página está controlada por el Service Worker', 'La página no está controlada por el Service Worker')

const cachés = await page.evaluate(async () => {
  const salida = {}
  for (const nombre of await caches.keys()) salida[nombre] = (await (await caches.open(nombre)).keys()).map((r) => new URL(r.url).pathname)
  return salida
})
const enApi = Object.entries(cachés).flatMap(([n, urls]) => urls.filter((u) => u.startsWith('/api/')).map((u) => `${n}: ${u}`))
comprobar(
  enApi.length === 0,
  `Cache Storage sin rutas /api/ (${Object.entries(cachés).map(([n, u]) => `${n}: ${u.length}`).join(' · ')})`,
  `Cache Storage guarda rutas de la API: ${enApi.join(', ')}`,
)
const estimado = await page.evaluate(async () => (await navigator.storage?.estimate?.())?.usage ?? null)
if (estimado !== null) console.log(`  · Uso de almacenamiento del origen: ${(estimado / 1024 / 1024).toFixed(2)} MB (límite de diseño 50 MB)`)

console.log('\nSin conexión (context.setOffline(true))')
await context.setOffline(true)
if (salida) mkdirSync(salida, { recursive: true })
for (const ruta of rutas) {
  try {
    const respuesta = await page.goto(`${base}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    // El contenido real de la app (no solo el «Cargando CuidaRed…» de Suspense): demuestra que también cargaron los chunks desde la caché.
    await page.waitForFunction(() => { const t = (document.getElementById('root')?.innerText ?? '').trim(); return t.length > 0 && !t.startsWith('Cargando CuidaRed') }, undefined, { timeout: 15_000 })
    const titulo = await page.title()
    const texto = (await page.evaluate(() => document.getElementById('root')?.innerText ?? '')).replace(/\s+/g, ' ').trim().slice(0, 70)
    const desdeSW = respuesta?.fromServiceWorker() ?? false
    if (respuesta?.status() === 200 && desdeSW && titulo === 'CuidaRed') ok(`${ruta} abre sin conexión (200 · servido por el Service Worker) → «${texto}…»`)
    else falla(`${ruta}: estado ${respuesta?.status()} · desde SW: ${desdeSW} · título «${titulo}»`)
    if (salida) await page.screenshot({ path: `${salida}/offline-${ruta.replace(/\W+/g, '_') || 'raiz'}.png` })
  } catch (e) {
    falla(`${ruta} no abre sin conexión: ${String(e.message).split('\n')[0]}`)
  }
}

// /api/ nunca debe recibir el shell: sin conexión la navegación tiene que fallar, no mostrar la app.
try {
  const r = await page.goto(`${base}/api/v1/prueba`, { waitUntil: 'domcontentloaded', timeout: 10_000 })
  falla(`/api/v1/prueba respondió ${r?.status()} sin conexión (el shell no debería servirse para /api/)`)
} catch {
  ok('/api/v1/prueba falla sin conexión (no se sirve el shell para la API)')
}
const fetchApi = await page.evaluate(() => fetch('/api/v1/prueba').then(() => 'respondió', () => 'falló')).catch(() => 'falló')
comprobar(fetchApi === 'falló', 'fetch a /api/ sin conexión falla (no sale de la caché)', 'fetch a /api/ sin conexión respondió desde la caché')

await context.setOffline(false)
if (erroresPagina.length) console.log(`  · Errores de la página (informativo): ${[...new Set(erroresPagina)].slice(0, 3).join(' | ')}`)
await browser.close()

if (fallos.length) {
  console.error(`\nverificar-offline: ${fallos.length} problema(s).`)
  process.exit(1)
}
console.log('\nverificar-offline: OK')
