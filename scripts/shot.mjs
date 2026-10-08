// Captura una ruta del prototipo en móvil (390px) y escritorio (1280px) para revisión visual.
// Uso: node scripts/shot.mjs <ruta> <rol|anon> <nombre> [--port 5173] [--full]
//   node scripts/shot.mjs /cuidador cuidador dashboard
//   node scripts/shot.mjs /inicio anon login
// Salida: shots/<nombre>-mobile.png y shots/<nombre>-desktop.png (+ -tablet con --tablet)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const [ruta = '/', rol = 'anon', nombre = 'shot', ...flags] = process.argv.slice(2)
const port = flags.includes('--port') ? flags[flags.indexOf('--port') + 1] : '5173'
const full = flags.includes('--full')
const base = `http://localhost:${port}`
const IDS = { cuidador: 'u-cuid', familiar: 'u-fam', admin: 'u-admin', coordinador: 'u-coord' }

mkdirSync('shots', { recursive: true })
const browser = await chromium.launch()
const sizes = [
  ['mobile', { width: 390, height: 844 }, true],
  ...(flags.includes('--tablet') ? [['tablet', { width: 820, height: 1180 }, true]] : []),
  ['desktop', { width: 1280, height: 800 }, false],
]
for (const [label, viewport, isMobile] of sizes) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile, hasTouch: isMobile })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  // Inicia sesión escribiendo la sesión directamente en el store persistido.
  await page.evaluate((uid) => {
    const raw = localStorage.getItem('cuidared:db')
    if (!raw) return
    const db = JSON.parse(raw)
    db.sessionUserId = uid
    localStorage.setItem('cuidared:db', JSON.stringify(db))
  }, IDS[rol] ?? null)
  await page.goto(`${base}${ruta}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const file = `shots/${nombre}-${label}.png`
  await page.screenshot({ path: file, fullPage: full })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  console.log(`${file}${overflow ? '  ⚠ SCROLL HORIZONTAL' : ''}${errors.length ? `  ⚠ errores: ${errors.join(' | ')}` : ''}`)
  await ctx.close()
}
await browser.close()
