// capturas-manual.mjs — Genera las capturas del manual de usuario (docs/manual/img) en tamaño móvil.
// Uso (con el servidor de desarrollo corriendo): node scripts/capturas-manual.mjs
// © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const DIR = 'docs/manual/img'
const IDS = { voluntario: 'u-cuid', coordinador: 'u-coord', admin: 'u-admin', familiar: 'u-fam' }

/** [archivo, rol, ruta, opciones] */
const PANTALLAS = [
  ['01-inicio-sesion', null, '/inicio'],
  ['02-voluntario-inicio', 'voluntario', '/voluntario'],
  ['03-voluntario-adultos', 'voluntario', '/voluntario/adultos'],
  ['04-voluntario-perfil-adulto', 'voluntario', '/voluntario/adultos/a-elena', { full: true }],
  ['05-registrar-visita', 'voluntario', '/voluntario/visitas/nueva?adulto=a-jose', { full: true }],
  ['06-registrar-necesidad', 'voluntario', '/voluntario/necesidades/nueva?adulto=a-elena', { full: true }],
  ['07-detalle-necesidad', 'voluntario', '/voluntario/necesidades/n-1', { full: true }],
  ['08-sin-conexion', 'voluntario', '/voluntario/visitas/nueva?adulto=a-elena', { offline: true }],
  ['09-sincronizacion', 'voluntario', '/voluntario/sincronizacion', { full: true }],
  ['10-coordinador-inicio', 'coordinador', '/coordinador', { full: true }],
  ['11-resumen', 'coordinador', '/coordinador/resumen', { full: true }],
  ['12-alertas', 'coordinador', '/coordinador/alertas', { full: true }],
  ['13-nuevo-perfil-paso1', 'coordinador', '/coordinador/adultos/nuevo', { full: true }],
  ['14-programar-visita', 'coordinador', '/coordinador/visitas/programar', { full: true }],
  ['15-reportes', 'coordinador', '/coordinador/reportes', { full: true }],
  ['16-ayuda', 'coordinador', '/coordinador/ayuda'],
  ['17-perfil-menu', 'coordinador', '/coordinador/perfil', { full: true }],
]

mkdirSync(DIR, { recursive: true })
const browser = await chromium.launch()
for (const [archivo, rol, ruta, op = {}] of PANTALLAS) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/inicio`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((uid) => {
    localStorage.removeItem('cuidared:db')
    const ahora = new Date().toISOString()
    if (uid) localStorage.setItem('cuidared:sesion', JSON.stringify({ usuarioId: uid, inicio: ahora, ultimaActividad: ahora }))
    else localStorage.removeItem('cuidared:sesion')
  }, rol ? IDS[rol] : null)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
  if (op.offline) {
    await ctx.setOffline(true)
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${DIR}/${archivo}.png`, fullPage: !!op.full })
  console.log(`✓ ${archivo}`)
  await ctx.close()
}
await browser.close()
