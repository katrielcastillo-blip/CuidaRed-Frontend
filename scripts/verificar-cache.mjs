// verificar-cache.mjs — Verifica la PWA compilada: caché ≤ 50 MB (RNF-5.2), shell sin conexión y manifest instalable.
// © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
//
// Uso (después de `vite build`):  node scripts/verificar-cache.mjs [carpeta=dist] [--limite-mb 50]
// Suma el tamaño de todos los archivos del precache del Service Worker (dist/sw.js) y falla (código 1) si:
//   · el precache supera el límite (50 MB por omisión);
//   · index.html no está en el precache o falta el navigateFallback (la app no abriría sin conexión);
//   · un .js/.css de dist/assets quedó fuera del precache (p. ej. por superar maximumFileSizeToCacheInBytes);
//   · alguna caché de runtime no tiene expiración (maxEntries y maxAgeSeconds), o falta la regla NetworkOnly de /api/;
//   · el manifest no cumple lo mínimo para instalarse (nombre, start_url, display, iconos 192/512/maskable y archivos).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const iLimite = args.indexOf('--limite-mb')
const limiteMB = iLimite >= 0 ? Number(args[iLimite + 1]) : 50
const dir = resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--limite-mb') ?? 'dist')
const MB = 1024 * 1024
const errores = []
const avisos = []
const fmt = (bytes) => `${(bytes / MB).toFixed(2)} MB`

if (!Number.isFinite(limiteMB) || limiteMB <= 0) {
  console.error('verificar-cache: --limite-mb debe ser un número positivo.')
  process.exit(2)
}
const rutaSW = join(dir, 'sw.js')
if (!existsSync(rutaSW)) {
  console.error(`verificar-cache: no existe ${rutaSW}. Ejecuta antes "npx vite build".`)
  process.exit(2)
}
const sw = readFileSync(rutaSW, 'utf8')

/* ───────────── Precache ───────────── */
// precacheAndRoute([{url:"index.html",revision:"…"},…]) → se extrae el arreglo completo con su corchete de cierre.
const inicio = sw.indexOf('precacheAndRoute(')
if (inicio < 0) {
  console.error('verificar-cache: sw.js no contiene precacheAndRoute(): el shell no se precachea.')
  process.exit(1)
}
let nivel = 0
let fin = -1
for (let i = sw.indexOf('[', inicio); i < sw.length; i++) {
  if (sw[i] === '[') nivel++
  else if (sw[i] === ']' && --nivel === 0) {
    fin = i
    break
  }
}
const manifiestoPrecache = sw.slice(sw.indexOf('[', inicio), fin + 1)
const urls = [...new Set([...manifiestoPrecache.matchAll(/\burl:\s*"([^"]+)"/g)].map((m) => decodeURIComponent(m[1].split('?')[0])))]

let total = 0
const archivos = []
for (const url of urls) {
  const ruta = join(dir, url)
  if (!existsSync(ruta)) {
    errores.push(`El precache lista "${url}" pero el archivo no existe en ${dir}.`)
    continue
  }
  const bytes = statSync(ruta).size
  total += bytes
  archivos.push({ url, bytes })
}

console.log(`Precache del Service Worker: ${archivos.length} archivos · ${fmt(total)} de ${limiteMB} MB (${((total / (limiteMB * MB)) * 100).toFixed(1)} %)`)
for (const a of [...archivos].sort((x, y) => y.bytes - x.bytes).slice(0, 5)) console.log(`  ${fmt(a.bytes).padStart(9)}  ${a.url}`)
if (total > limiteMB * MB) errores.push(`El precache (${fmt(total)}) supera el límite de ${limiteMB} MB (RNF-5.2).`)

/* ───────────── Shell sin conexión ───────────── */
if (!urls.includes('index.html')) errores.push('index.html no está en el precache: la app no abriría sin conexión.')
if (!/createHandlerBoundToURL\(\s*"\/index\.html"\s*\)/.test(sw)) errores.push('Falta el navigateFallback a /index.html: las rutas de la app no abrirían sin conexión.')
if (!/denylist:\s*\[\s*\/\^\\\/api\\\//.test(sw)) errores.push('El navigateFallback no excluye /api/: una navegación a la API devolvería la app.')

const assets = join(dir, 'assets')
if (existsSync(assets)) {
  for (const nombre of readdirSync(assets)) {
    if (/\.(js|css)$/.test(nombre) && !urls.includes(`assets/${nombre}`)) {
      errores.push(`assets/${nombre} (${fmt(statSync(join(assets, nombre)).size)}) no está en el precache: sin conexión la app no cargaría. ¿Supera maximumFileSizeToCacheInBytes?`)
    }
  }
}

/* ───────────── Cachés de runtime (límites y RS-018) ───────────── */
const expiraciones = [...sw.matchAll(/ExpirationPlugin\(\{([^}]*)\}\)/g)].map((m) => m[1])
const estrategiasConCache = (sw.match(/new [\w$]+\.(?:CacheFirst|StaleWhileRevalidate|NetworkFirst|CacheOnly)\(/g) ?? []).length
const cachesRuntime = [...sw.matchAll(/cacheName:"([^"]+)"/g)].map((m) => m[1])
console.log(`Cachés de runtime: ${cachesRuntime.length ? cachesRuntime.join(', ') : '(ninguna)'}`)
for (const e of expiraciones) {
  const entradas = e.match(/maxEntries:(\d+)/)?.[1]
  const edad = e.match(/maxAgeSeconds:([\d.e]+)/)?.[1]
  console.log(`  expiración: máx. ${entradas ?? '?'} entradas · ${edad ? `${Math.round(Number(edad) / 86400)} días` : 'sin antigüedad máxima'}`)
  if (!entradas || !edad) errores.push(`Una caché de runtime no define maxEntries y maxAgeSeconds (${e}).`)
}
if (expiraciones.length < estrategiasConCache) errores.push('Hay una estrategia de caché de runtime sin expiración (ExpirationPlugin): su tamaño no tendría tope.')
if (!/NetworkOnly/.test(sw) || !/\/api\//.test(sw)) errores.push('Falta la regla NetworkOnly para /api/ (RS-018: no se guardan respuestas de la API).')

/* ───────────── Manifest instalable ───────────── */
const rutaManifest = join(dir, 'manifest.webmanifest')
if (!existsSync(rutaManifest)) {
  errores.push('Falta manifest.webmanifest.')
} else {
  const m = JSON.parse(readFileSync(rutaManifest, 'utf8'))
  if (!m.name || !m.short_name) errores.push('El manifest necesita name y short_name.')
  if (!m.start_url) errores.push('El manifest necesita start_url.')
  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(m.display)) errores.push(`El manifest necesita display standalone/fullscreen/minimal-ui (tiene "${m.display}").`)
  const iconos = m.icons ?? []
  const tiene = (tam, purpose) => iconos.some((i) => (i.sizes ?? '').split(' ').includes(tam) && (i.purpose ?? 'any').split(' ').includes(purpose))
  if (!tiene('192x192', 'any')) errores.push('Falta un icono 192x192 (purpose any).')
  if (!tiene('512x512', 'any')) errores.push('Falta un icono 512x512 (purpose any).')
  if (!tiene('512x512', 'maskable')) avisos.push('No hay icono maskable 512x512: Android recortará el icono en un círculo con bordes blancos.')
  for (const i of [...iconos, ...(m.screenshots ?? [])]) {
    if (!existsSync(join(dir, i.src))) errores.push(`El manifest referencia "${i.src}" pero no existe en ${dir}.`)
  }
  if (!existsSync(join(dir, 'icons', 'apple-touch-icon.png'))) errores.push('Falta icons/apple-touch-icon.png (icono para iOS).')
  const html = existsSync(join(dir, 'index.html')) ? readFileSync(join(dir, 'index.html'), 'utf8') : ''
  if (!/rel="manifest"/.test(html)) errores.push('index.html no enlaza el manifest.')
  if (!/rel="apple-touch-icon"/.test(html)) errores.push('index.html no declara apple-touch-icon (iOS).')
  if (!/name="apple-mobile-web-app-capable"/.test(html)) errores.push('index.html no declara apple-mobile-web-app-capable (iOS).')
  if (!/name="theme-color"/.test(html)) errores.push('index.html no declara theme-color.')
  console.log(`Manifest: "${m.short_name}" · ${iconos.length} iconos · ${(m.screenshots ?? []).length} capturas · display ${m.display}`)
}

for (const a of avisos) console.warn(`AVISO: ${a}`)
if (errores.length) {
  console.error(`\nverificar-cache: ${errores.length} problema(s):`)
  for (const e of errores) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log(`\nverificar-cache: OK (precache ${fmt(total)} ≤ ${limiteMB} MB).`)
