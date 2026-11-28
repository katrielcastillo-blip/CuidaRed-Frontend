// smoke.mjs — Prueba de humo de todas las rutas × roles × anchos.
// © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
// Prueba de humo de integración: recorre todas las rutas de los cinco roles (Reglas de Negocio V2: administrador,
// coordinador, cuidador, voluntario y familiar) en 3 anchos y reporta errores de consola, scroll horizontal, elementos
// fuera del viewport, pantallas sin implementar y redirecciones inesperadas. Cada rol incluye también rutas que NO le
// corresponden (otro rol, otro adulto, otra cuenta): deben mostrar «No encontrado» o «Acceso denegado» sin errores.
// Uso: node scripts/smoke.mjs [--port 5173] [--escenario normal|familia|huerfanos|familiar-sin-familia]
//   normal ................ cuenta Organización «Fundación Esperanza» (membresía por defecto de cada usuario demo)
//   familia ............... cuenta Familia «Familia Méndez»: coordinadora titular, Carlos Ruiz (cuidador) y Clara (familiar)
//   huerfanos ............. registros que apuntan a usuarios inexistentes (integridad referencial en la interfaz)
//   familiar-sin-familia .. familiar sin ningún adulto a cargo
// El diálogo de onboarding de un solo uso se marca como visto (clave cuidared:onboarding:<userId>:<rol>): intercepta clics y
// no forma parte de lo que se comprueba aquí. Si el servidor de desarrollo recarga la página mientras se mide (HMR por un
// cambio en el código, o archivos nuevos dentro de la carpeta del proyecto), la ruta se vuelve a medir hasta 3 veces.
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : '5173'
const escenario = args.includes('--escenario') ? args[args.indexOf('--escenario') + 1] : 'normal'
const BASE = `http://localhost:${port}`

/** Usuarios demo por rol (Fundación Esperanza). */
const IDS = { cuidador: 'u-cuid', voluntario: 'u-vol', familiar: 'u-fam', admin: 'u-admin', coordinador: 'u-coord' }

const RUTAS = {
  anon: ['/', '/inicio', '/crear-cuenta', '/registro', '/registro-familia', '/registro-organizacion', '/recuperar', '/restablecer', '/solicitud-visita', '/terminos', '/privacidad'],
  // Cuidador (Carlos Ruiz): trabajo de campo completo sobre Elena, José y Camila.
  cuidador: [
    '/cuidador', '/cuidador/adultos', '/cuidador/adultos/a-elena', '/cuidador/adultos/a-jose', '/cuidador/adultos/a-camila',
    '/cuidador/visitas', '/cuidador/visitas/v-1', '/cuidador/visitas/v-3', '/cuidador/visitas/v-8',
    '/cuidador/visitas/nueva', '/cuidador/visitas/nueva?adulto=a-camila', '/cuidador/visitas/nueva?visita=v-3',
    '/cuidador/necesidades/nueva', '/cuidador/necesidades/nueva?adulto=a-elena', '/cuidador/necesidades/n-1', '/cuidador/necesidades/n-2',
    '/cuidador/agenda', '/cuidador/agenda/ta-1', '/cuidador/agenda/ta-2',
    '/cuidador/alertas', '/cuidador/alertas/al-1', '/cuidador/alertas/al-3',
    '/cuidador/perfil', '/cuidador/perfil/editar', '/cuidador/sincronizacion', '/cuidador/ayuda', '/cuidador/acerca',
    // Fuera de su alcance o de su rol
    '/cuidador/adultos/a-maria', '/cuidador/necesidades/n-3', '/cuidador/visitas/v-7', '/cuidador/alertas/al-5', '/cuidador/reportes', '/admin', '/voluntario',
  ],
  // Voluntario (Miguel Acosta): vista mínima sobre Alicia y José Martínez; sin necesidades, agenda ni datos médicos.
  voluntario: [
    '/voluntario', '/voluntario/visitas', '/voluntario/visitas/nueva', '/voluntario/visitas/nueva?adulto=a-alicia', '/voluntario/visitas/nueva?adulto=a-josem', '/voluntario/visitas/nueva?visita=v-9',
    '/voluntario/visitas/nueva?visita=v-10', '/voluntario/perfil', '/voluntario/perfil/editar', '/voluntario/sincronizacion', '/voluntario/ayuda', '/voluntario/acerca',
    // No existen para su rol, o están fuera de su alcance
    '/voluntario/necesidades/nueva', '/voluntario/necesidades/n-1', '/voluntario/adultos', '/voluntario/agenda', '/voluntario/visitas/v-10', '/voluntario/visitas/nueva?adulto=a-camila', '/voluntario/reportes', '/cuidador', '/admin',
  ],
  // Familiar responsable (Clara Rodríguez): solo lectura de Elena, María y Estefan.
  familiar: [
    '/familiar', '/familiar/adultos/a-elena', '/familiar/adultos/a-elena?tab=visitas', '/familiar/adultos/a-elena?tab=indicaciones', '/familiar/adultos/a-maria', '/familiar/adultos/a-estefan',
    '/familiar/visitas/v-1', '/familiar/necesidades/n-1', '/familiar/perfil', '/familiar/perfil/editar', '/familiar/ayuda', '/familiar/acerca', '/familiar/sincronizacion',
    // Sin permiso (José no es su familiar) o de otra cuenta (Rosa Méndez es de Familia Méndez)
    '/familiar/adultos/a-jose', '/familiar/adultos/a-rosa', '/familiar/necesidades/n-9',
  ],
  admin: [
    '/admin', '/admin/miembros', '/admin/miembros/nuevo', '/admin/miembros/u-giselle', '/admin/miembros/u-vol', '/admin/roles', '/admin/mas', '/admin/configuracion', '/admin/auditoria',
    '/admin/adultos', '/admin/adultos/nuevo', '/admin/adultos/a-elena', '/admin/adultos/a-elena/editar', '/admin/adultos/a-elena/riesgo', '/admin/adultos/a-jose',
    '/admin/alertas', '/admin/alertas/al-1', '/admin/alertas/al-3', '/admin/resumen', '/admin/reportes', '/admin/visitas/v-1', '/admin/necesidades/n-1',
    '/admin/solicitudes', '/admin/solicitudes/sv-1', '/admin/necesidades-institucionales',
    '/admin/agenda', '/admin/agenda/nueva', '/admin/agenda/ta-1', '/admin/suscripcion', '/admin/catalogos',
    '/admin/perfil', '/admin/perfil/editar', '/admin/sincronizacion', '/admin/acerca', '/admin/ayuda',
    // Sin permiso (el administrador no registra visitas) o de otra cuenta
    '/admin/visitas/nueva', '/admin/adultos/a-rosa',
  ],
  coordinador: [
    '/coordinador', '/coordinador/visitas', '/coordinador/visitas/programar', '/coordinador/visitas/programar?adulto=a-elena', '/coordinador/mas', '/coordinador/visitas/v-3', '/coordinador/visitas/v-1',
    '/coordinador/visitas/nueva', '/coordinador/necesidades/nueva', '/coordinador/necesidades/n-1',
    '/coordinador/adultos', '/coordinador/adultos/nuevo', '/coordinador/adultos/a-elena', '/coordinador/adultos/a-jose/riesgo',
    '/coordinador/alertas', '/coordinador/alertas/al-1', '/coordinador/solicitudes', '/coordinador/solicitudes/sv-1', '/coordinador/necesidades-institucionales',
    '/coordinador/resumen', '/coordinador/reportes', '/coordinador/perfil', '/coordinador/sincronizacion', '/coordinador/auditoria',
    '/coordinador/agenda', '/coordinador/agenda/nueva', '/coordinador/agenda/ta-4',
    // En una Organización la gestión de miembros y la suscripción son del administrador; Rosa Méndez es de otra cuenta
    '/coordinador/miembros', '/coordinador/suscripcion', '/coordinador/adultos/a-rosa',
  ],
}

/** Cuenta Familia «Familia Méndez»: membresías m-10 (coordinadora titular), m-11 (cuidador independiente) y m-12 (familiar). */
const FAMILIA = {
  coordinador: {
    uid: 'u-fcoord', mid: 'm-10',
    rutas: [
      '/coordinador', '/coordinador/adultos', '/coordinador/adultos/a-rosa', '/coordinador/adultos/a-ramon', '/coordinador/adultos/nuevo', '/coordinador/visitas', '/coordinador/visitas/programar',
      '/coordinador/visitas/v-11', '/coordinador/visitas/v-12', '/coordinador/necesidades/n-9', '/coordinador/necesidades/nueva', '/coordinador/alertas', '/coordinador/agenda', '/coordinador/agenda/ta-5',
      '/coordinador/miembros', '/coordinador/miembros/nuevo', '/coordinador/roles', '/coordinador/configuracion', '/coordinador/suscripcion', '/coordinador/auditoria', '/coordinador/resumen', '/coordinador/reportes',
      '/coordinador/mas', '/coordinador/perfil', '/coordinador/sincronizacion',
      // Adultos y registros de la Fundación Esperanza: otra cuenta
      '/coordinador/adultos/a-elena', '/coordinador/visitas/v-1', '/coordinador/necesidades/n-1',
    ],
  },
  cuidador: {
    uid: 'u-cuid', mid: 'm-11',
    rutas: [
      '/cuidador', '/cuidador/adultos', '/cuidador/adultos/a-rosa', '/cuidador/adultos/a-ramon', '/cuidador/visitas', '/cuidador/visitas/v-11', '/cuidador/visitas/nueva?adulto=a-ramon', '/cuidador/visitas/nueva?visita=v-12',
      '/cuidador/necesidades/n-9', '/cuidador/necesidades/nueva?adulto=a-rosa', '/cuidador/agenda', '/cuidador/agenda/ta-5', '/cuidador/alertas', '/cuidador/perfil', '/cuidador/sincronizacion',
      // Sus adultos de la Fundación Esperanza no se mezclan en esta cuenta
      '/cuidador/adultos/a-elena', '/cuidador/visitas/v-1', '/cuidador/necesidades/n-1', '/cuidador/agenda/ta-1',
    ],
  },
  familiar: {
    uid: 'u-fam', mid: 'm-12',
    rutas: ['/familiar', '/familiar/adultos/a-rosa', '/familiar/adultos/a-rosa?tab=visitas', '/familiar/adultos/a-rosa?tab=indicaciones', '/familiar/necesidades/n-9', '/familiar/perfil', '/familiar/ayuda', '/familiar/adultos/a-elena', '/familiar/visitas/v-1'],
  },
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

/** Casos a recorrer: { rol, uid, mid?, rutas } (uid indefinido = sin sesión). */
function casos() {
  if (escenario === 'familia') return Object.entries(FAMILIA).map(([rol, c]) => ({ rol, uid: c.uid, mid: c.mid, rutas: c.rutas }))
  const roles = escenario === 'familiar-sin-familia' ? ['familiar'] : escenario === 'huerfanos' ? ['admin', 'coordinador', 'cuidador', 'voluntario', 'familiar'] : Object.keys(RUTAS)
  return roles.map((rol) => ({ rol, uid: IDS[rol], rutas: RUTAS[rol] }))
}

const browser = await chromium.launch()
let fallos = 0
let total = 0

for (const caso of casos()) {
  const { rol, uid, mid, rutas } = caso
  for (const width of ANCHOS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 })
    const page = await ctx.newPage()
    let errores = []
    page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`))
    page.on('console', (m) => m.type() === 'error' && errores.push(`console: ${m.text()}`))
    await page.goto(`${BASE}/inicio`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith('cuidared:')) localStorage.removeItem(k)
      sessionStorage.clear()
    })
    // Recarga para que la app genere la semilla limpia y luego aplica el escenario.
    await page.goto(`${BASE}/inicio`, { waitUntil: 'domcontentloaded' })
    // La app guarda la semilla al arrancar: se espera a que exista antes de modificarla.
    await page.waitForFunction(() => localStorage.getItem('cuidared:db') !== null)
    await page.evaluate(
      ({ uid, mid, rol, esc, prep }) => {
        const fn = new Function('db', 'uid', 'esc', `return (${prep})(db, uid, esc)`)
        const db = JSON.parse(localStorage.getItem('cuidared:db'))
        localStorage.setItem('cuidared:db', JSON.stringify(fn(db, uid, esc)))
        const ahora = new Date().toISOString()
        if (uid) {
          localStorage.setItem('cuidared:sesion', JSON.stringify({ usuarioId: uid, ...(mid ? { membresiaId: mid } : {}), inicio: ahora, ultimaActividad: ahora }))
          // Onboarding de un solo uso: ya visto (intercepta clics y no es lo que se mide aquí).
          localStorage.setItem(`cuidared:onboarding:${uid}:${rol}`, ahora)
        }
      },
      { uid: uid ?? null, mid: mid ?? null, rol, esc: escenario, prep: prepararDB.toString() },
    )

    for (const ruta of rutas) {
      total++
      let r
      for (let intento = 1; ; intento++) {
        errores = []
        try {
          await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
          await page.waitForTimeout(250)
          r = await page.evaluate(() => {
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
                if (!recortado) fuera.push(`${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).slice(0, 40)} [${Math.round(b.left)}→${Math.round(b.right)}]`)
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
          break
        } catch (e) {
          // El servidor de desarrollo recargó la página a mitad de la medición: se repite la ruta.
          if (intento >= 3 || !/Execution context was destroyed|net::ERR_ABORTED|frame was detached|Navigation|Target page/i.test(String(e?.message))) throw e
          await page.waitForTimeout(500)
        }
      }
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
