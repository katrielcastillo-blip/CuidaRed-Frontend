// capturas.mjs — Capturas de todas las rutas por rol (móvil y escritorio) para revisión visual.
// © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
// Captura todas las rutas de todos los roles (móvil 390px y escritorio 1280px) en una carpeta, para
// comparar visualmente antes/después de un cambio de estilos.
// Uso: node scripts/capturas.mjs <carpeta> [--port 5173] [--rol admin]
//   node scripts/capturas.mjs shots/antes
// Salida: <carpeta>/<rol>__<ruta>-mobile.png y -desktop.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const dir = args[0] && !args[0].startsWith('--') ? args[0] : 'shots/capturas'
const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : '5173'
const soloRol = args.includes('--rol') ? args[args.indexOf('--rol') + 1] : null
const BASE = `http://localhost:${port}`

const RUTAS = {
  anon: ['/inicio', '/registro', '/recuperar', '/terminos', '/privacidad', '/registro-organizacion'],
  voluntario: ['/voluntario', '/voluntario/adultos', '/voluntario/adultos/a-elena', '/voluntario/visitas', '/voluntario/visitas/v-3', '/voluntario/visitas/v-1', '/voluntario/visitas/nueva?adulto=a-jose', '/voluntario/necesidades/nueva', '/voluntario/necesidades/n-1', '/voluntario/perfil'],
  familiar: ['/familiar', '/familiar/invitar', '/familiar/adultos/a-elena', '/familiar/visitas/v-1', '/familiar/necesidades/n-1', '/familiar/perfil'],
  admin: ['/admin', '/admin/miembros', '/admin/miembros/nuevo', '/admin/miembros/u-giselle', '/admin/mas', '/admin/configuracion', '/admin/adultos', '/admin/adultos/nuevo', '/admin/adultos/a-elena', '/admin/adultos/a-elena/editar', '/admin/adultos/a-elena/riesgo', '/admin/alertas', '/admin/alertas/al-1', '/admin/reportes', '/admin/perfil', '/admin/perfil/editar'],
  coordinador: ['/coordinador', '/coordinador/visitas', '/coordinador/visitas/programar', '/coordinador/mas', '/coordinador/adultos', '/coordinador/alertas', '/coordinador/reportes'],
}
const IDS = { voluntario: 'u-cuid', familiar: 'u-fam', admin: 'u-admin', coordinador: 'u-coord' }
const TAMANOS = [
  ['mobile', { width: 390, height: 844 }, true],
  ['desktop', { width: 1280, height: 800 }, false],
]

mkdirSync(dir, { recursive: true })
const browser = await chromium.launch()
for (const [rol, rutas] of Object.entries(RUTAS)) {
  if (soloRol && rol !== soloRol) continue
  for (const [etiqueta, viewport, isMobile] of TAMANOS) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile, hasTouch: isMobile })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/inicio`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((uid) => {
      const ahora = new Date().toISOString()
    if (uid) localStorage.setItem('cuidared:sesion', JSON.stringify({ usuarioId: uid, inicio: ahora, ultimaActividad: ahora }))
    else localStorage.removeItem('cuidared:sesion')
    }, IDS[rol] ?? null)
    for (const ruta of rutas) {
      await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(300)
      const nombre = `${rol}__${ruta.replace(/^\//, '').replace(/[/?=&]/g, '_') || 'raiz'}-${etiqueta}.png`
      await page.screenshot({ path: `${dir}/${nombre}`, fullPage: true })
    }
    await ctx.close()
  }
  console.log(`✓ ${rol}`)
}
await browser.close()
