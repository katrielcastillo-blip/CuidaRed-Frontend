// smoke.mjs — Prueba de humo de todas las rutas × roles × anchos.
// © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
// Prueba de humo de integración: recorre todas las rutas de todos los roles en 3 anchos y reporta
// errores de consola, scroll horizontal, elementos fuera del viewport, pantallas sin implementar y redirecciones.
// Uso: node scripts/smoke.mjs [--port 5173] [--escenario normal|huerfanos|familiar-sin-familia]
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : '5173'
const escenario = args.includes('--escenario') ? args[args.indexOf('--escenario') + 1] : 'normal'
const BASE = `http://localhost:${port}`
const IDS = { voluntario: 'u-cuid', familiar: 'u-fam', admin: 'u-admin', coordinador: 'u-coord' }

const RUTAS = {
  anon: ['/inicio', '/registro', '/recuperar', '/restablecer', '/terminos', '/privacidad', '/registro-organizacion'],
  voluntario: ['/voluntario', '/voluntario/adultos', '/voluntario/adultos/a-elena', '/voluntario/adultos/a-maria', '/voluntario/visitas', '/voluntario/visitas/v-3', '/voluntario/visitas/v-1', '/voluntario/visitas/nueva', '/voluntario/visitas/nueva?adulto=a-jose', '/voluntario/necesidades/nueva', '/voluntario/necesidades/n-1', '/voluntario/perfil', '/voluntario/perfil/editar', '/voluntario/sincronizacion', '/voluntario/ayuda', '/voluntario/acerca', '/voluntario/reportes', '/admin', '/voluntario/agenda', '/voluntario/agenda/ta-1', '/voluntario/visitas/v-8'],
  familiar: ['/familiar', '/familiar/adultos/a-elena', '/familiar/adultos/a-elena?tab=visitas', '/familiar/adultos/a-jose', '/familiar/visitas/v-1', '/familiar/necesidades/n-1', '/familiar/perfil', '/familiar/perfil/editar', '/familiar/ayuda', '/familiar/acerca', '/familiar/sincronizacion'],
  admin: ['/admin', '/admin/miembros', '/admin/miembros/nuevo', '/admin/miembros/u-giselle', '/admin/roles', '/admin/mas', '/admin/configuracion', '/admin/auditoria', '/admin/adultos', '/admin/adultos/nuevo', '/admin/adultos/a-elena', '/admin/adultos/a-elena/editar', '/admin/adultos/a-elena/riesgo', '/admin/alertas', '/admin/alertas/al-1', '/admin/alertas/al-3', '/admin/resumen', '/admin/reportes', '/admin/visitas/v-1', '/admin/necesidades/n-1', '/admin/visitas/nueva', '/admin/perfil', '/admin/perfil/editar', '/admin/sincronizacion', '/admin/acerca', '/admin/ayuda', '/admin/suscripcion', '/admin/catalogos', '/admin/agenda', '/admin/agenda/nueva', '/admin/adultos/a-jose'],
  coordinador: ['/coordinador', '/coordinador/visitas', '/coordinador/visitas/programar', '/coordinador/mas', '/coordinador/visitas/v-3', '/coordinador/visitas/v-1', '/coordinador/visitas/nueva', '/coordinador/necesidades/nueva', '/coordinador/necesidades/n-1', '/coordinador/adultos', '/coordinador/adultos/nuevo', '/coordinador/adultos/a-elena', '/coordinador/adultos/a-jose/riesgo', '/coordinador/alertas', '/coordinador/alertas/al-1', '/coordinador/resumen', '/coordinador/reportes', '/coordinador/perfil', '/coordinador/sincronizacion', '/coordinador/auditoria', '/coordinador/miembros', '/coordinador/agenda', '/coordinador/agenda/nueva', '/coordinador/agenda/ta-4', '/coordinador/suscripcion'],
}
const ANCHOS = [360, 768, 1280]

/** Modifica la base local antes de navegar, según el escenario. */
function prepararDB(db, uid, esc) {
  if (esc === 'huerfanos') {
    // Elimina a usuarios con actividad: visitas, necesidades, alertas, vínculos, membresías, perfiles de cuidador,
    // tareas y evidencias quedan apuntando a ids inexistentes (integridad referencial en la interfaz).
    db.usuarios = db.usuarios.filter((u) => u.id !== 'u-giselle' && (uid === 'u-cuid' || u.id !== 'u-cuid'))
  }
  if (esc === 'familiar-sin-familia') {
    // Familiar sin ningún adulto a cargo (sin vínculos familiar_responsable).
    db.vinculos = db.vinculos.filter((v) => v.usuarioId !== 'u-fam')
  }
  return db
}

const browser = await chromium.launch()
let fallos = 0
let total = 0
const roles = escenario === 'familiar-sin-familia' ? ['familiar'] : escenario === 'huerfanos' ? ['admin', 'coordinador', 'familiar'] : Object.keys(RUTAS)

for (const rol of roles) {
  for (const width of ANCHOS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 })
    const page = await ctx.newPage()
    let errores = []
    page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`))
    page.on('console', (m) => m.type() === 'error' && errores.push(`console: ${m.text()}`))
    await page.goto(`${BASE}/inicio`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.removeItem('cuidared:db')
      localStorage.removeItem('cuidared:sesion')
      sessionStorage.clear()
    })
    // Recarga para que la app genere la semilla limpia y luego aplica el escenario.
    await page.goto(`${BASE}/inicio`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      ({ uid, esc, prep }) => {
        const fn = new Function('db', 'uid', 'esc', `return (${prep})(db, uid, esc)`)
        const db = JSON.parse(localStorage.getItem('cuidared:db'))
        localStorage.setItem('cuidared:db', JSON.stringify(fn(db, uid, esc)))
        const ahora = new Date().toISOString()
        if (uid) localStorage.setItem('cuidared:sesion', JSON.stringify({ usuarioId: uid, inicio: ahora, ultimaActividad: ahora }))
      },
      { uid: IDS[rol] ?? null, esc: escenario, prep: prepararDB.toString() },
    )

    for (const ruta of RUTAS[rol]) {
      total++
      errores = []
      await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(250)
      const r = await page.evaluate(() => {
        const vw = window.innerWidth
        const fuera = []
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue
          const b = el.getBoundingClientRect()
          if (b.width === 0 || b.height === 0) continue
          if (b.right > vw + 1 || b.left < -1) {
            // ignora hijos de contenedores con overflow (carruseles/scroll horizontal intencional)
            let p = el.parentElement
            let recortado = false
            while (p && p !== document.body) {
              const o = getComputedStyle(p).overflowX
              if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { recortado = true; break }
              p = p.parentElement
            }
            if (!recortado) fuera.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} [${Math.round(b.left)}→${Math.round(b.right)}]`)
          }
        }
        return {
          path: location.pathname + location.search,
          overflow: document.documentElement.scrollWidth > vw,
          construccion: document.body.innerText.includes('Pantalla en construcción'),
          vacia: document.body.innerText.trim().length < 20,
          fuera: fuera.slice(0, 3),
        }
      })
      const problemas = []
      const esperado = ruta.split('?')[0]
      if (r.path.split('?')[0] !== esperado) problemas.push(`redirige a ${r.path}`)
      if (r.overflow) problemas.push('SCROLL HORIZONTAL')
      if (r.fuera.length) problemas.push(`fuera de viewport: ${r.fuera.join(', ')}`)
      if (r.construccion) problemas.push('PLACEHOLDER')
      if (r.vacia) problemas.push('PANTALLA VACÍA')
      if (errores.length) problemas.push(errores.slice(0, 2).join(' | '))
      if (problemas.length) {
        fallos++
        console.log(`✗ [${rol} ${width}px] ${ruta} → ${problemas.join(' · ')}`)
      }
    }
    await ctx.close()
  }
}
await browser.close()
console.log(`\n${escenario}: ${total - fallos}/${total} comprobaciones OK`)
process.exit(fallos ? 1 : 0)
