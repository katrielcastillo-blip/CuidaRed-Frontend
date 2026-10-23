// capturas-completas.mjs — Captura TODAS las pantallas del front, por rol, en teléfono y en PC (página completa).
// Uso (con el servidor de desarrollo corriendo): node scripts/capturas-completas.mjs [carpeta] [--rol admin]
// Salida: <carpeta>/telefono/<rol>/NN-nombre.png y <carpeta>/pc/<rol>/NN-nombre.png (por defecto, carpeta "capturas").
// © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const DIR = args[0] && !args[0].startsWith('--') ? args[0] : 'capturas'
const soloRol = args.includes('--rol') ? args[args.indexOf('--rol') + 1] : null
const BASE = 'http://localhost:5173'
const IDS = { voluntario: 'u-cuid', familiar: 'u-fam', admin: 'u-admin', coordinador: 'u-coord' }

/** [nombre del archivo, ruta, opciones]. Opciones: { offline, accion } */
const PANTALLAS = {
  '0-publico': [
    ['01-portada', '/'],
    ['02-inicio-sesion', '/inicio'],
    ['03-activar-cuenta', '/registro'],
    ['04-recuperar-contrasena', '/recuperar'],
    ['05-restablecer-contrasena', '/restablecer'],
    ['06-registro-organizacion', '/registro-organizacion'],
    ['07-terminos-de-uso', '/terminos'],
    ['08-politica-de-privacidad', '/privacidad'],
  ],
  '1-administrador': [
    ['01-inicio', '/admin'],
    ['02-adultos-lista', '/admin/adultos'],
    ['03-adulto-nuevo', '/admin/adultos/nuevo'],
    ['04-adulto-perfil', '/admin/adultos/a-jose'],
    ['05-adulto-editar', '/admin/adultos/a-elena/editar'],
    ['06-evaluacion-riesgo', '/admin/adultos/a-elena/riesgo'],
    ['07-usuarios-lista', '/admin/miembros'],
    ['08-usuario-nuevo', '/admin/miembros/nuevo'],
    ['09-usuario-perfil', '/admin/miembros/u-giselle'],
    ['10-roles-y-permisos', '/admin/roles'],
    ['11-alertas-lista', '/admin/alertas'],
    ['12-alerta-detalle', '/admin/alertas/al-1'],
    ['13-alerta-atendida', '/admin/alertas/al-3'],
    ['14-resumen-seguimiento', '/admin/resumen'],
    ['15-reportes', '/admin/reportes'],
    ['16-agenda', '/admin/agenda'],
    ['17-agenda-nueva-tarea', '/admin/agenda/nueva'],
    ['18-agenda-tarea-detalle', '/admin/agenda/ta-4'],
    ['19-visita-detalle', '/admin/visitas/v-8'],
    ['20-necesidad-detalle', '/admin/necesidades/n-2'],
    ['21-configuracion', '/admin/configuracion'],
    ['22-plan-y-suscripcion', '/admin/suscripcion'],
    ['23-catalogos', '/admin/catalogos'],
    ['24-auditoria', '/admin/auditoria'],
    ['25-mas', '/admin/mas'],
    ['26-mi-perfil', '/admin/perfil'],
    ['27-editar-perfil', '/admin/perfil/editar'],
    ['28-sincronizacion', '/admin/sincronizacion'],
    ['29-ayuda', '/admin/ayuda'],
    ['30-acerca-de', '/admin/acerca'],
    ['31-notificaciones', '/admin', { accion: 'notificaciones' }],
  ],
  '2-coordinador': [
    ['01-inicio', '/coordinador'],
    ['02-adultos-lista', '/coordinador/adultos'],
    ['03-adulto-nuevo', '/coordinador/adultos/nuevo'],
    ['04-adulto-perfil', '/coordinador/adultos/a-elena'],
    ['05-evaluacion-riesgo', '/coordinador/adultos/a-jose/riesgo'],
    ['06-visitas-agenda', '/coordinador/visitas'],
    ['07-programar-visita', '/coordinador/visitas/programar'],
    ['08-registrar-visita', '/coordinador/visitas/nueva?adulto=a-maria'],
    ['09-visita-programada', '/coordinador/visitas/v-3'],
    ['10-visita-completada', '/coordinador/visitas/v-8'],
    ['11-registrar-necesidad', '/coordinador/necesidades/nueva?adulto=a-josem'],
    ['12-necesidad-detalle', '/coordinador/necesidades/n-3'],
    ['13-alertas-lista', '/coordinador/alertas'],
    ['14-alerta-detalle', '/coordinador/alertas/al-5'],
    ['15-resumen-seguimiento', '/coordinador/resumen'],
    ['16-reportes', '/coordinador/reportes'],
    ['17-agenda', '/coordinador/agenda'],
    ['18-agenda-nueva-tarea', '/coordinador/agenda/nueva'],
    ['19-agenda-tarea-detalle', '/coordinador/agenda/ta-1'],
    ['20-mas', '/coordinador/mas'],
    ['21-mi-perfil', '/coordinador/perfil'],
    ['22-ayuda', '/coordinador/ayuda'],
    ['23-acceso-no-autorizado', '/coordinador/auditoria'],
  ],
  '3-voluntario': [
    ['01-inicio', '/voluntario'],
    ['02-mis-adultos', '/voluntario/adultos'],
    ['03-adulto-perfil', '/voluntario/adultos/a-jose'],
    ['04-mis-visitas', '/voluntario/visitas'],
    ['05-visita-programada', '/voluntario/visitas/v-3'],
    ['06-visita-completada', '/voluntario/visitas/v-1'],
    ['07-registrar-visita', '/voluntario/visitas/nueva?adulto=a-jose'],
    ['08-registrar-necesidad', '/voluntario/necesidades/nueva?adulto=a-elena'],
    ['09-necesidad-detalle', '/voluntario/necesidades/n-1'],
    ['10-agenda', '/voluntario/agenda'],
    ['11-agenda-tarea-detalle', '/voluntario/agenda/ta-1'],
    ['12-sin-conexion', '/voluntario/visitas/nueva?adulto=a-camila', { offline: true }],
    ['13-sincronizacion', '/voluntario/sincronizacion'],
    ['14-mi-perfil', '/voluntario/perfil'],
    ['15-ayuda', '/voluntario/ayuda'],
    ['16-adulto-no-asignado', '/voluntario/adultos/a-maria'],
  ],
  '4-familiar': [
    ['01-inicio', '/familiar'],
    ['02-adulto-necesidades', '/familiar/adultos/a-elena'],
    ['03-adulto-visitas', '/familiar/adultos/a-elena?tab=visitas'],
    ['04-visita-detalle', '/familiar/visitas/v-1?adulto=a-elena'],
    ['05-necesidad-detalle', '/familiar/necesidades/n-1'],
    ['06-mi-perfil', '/familiar/perfil'],
    ['07-ayuda', '/familiar/ayuda'],
    ['08-adulto-sin-permiso', '/familiar/adultos/a-jose'],
  ],
}
const ROL_DE = { '1-administrador': 'admin', '2-coordinador': 'coordinador', '3-voluntario': 'voluntario', '4-familiar': 'familiar' }

const DISPOSITIVOS = [
  ['telefono', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['pc', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }],
]

const browser = await chromium.launch()
let total = 0
for (const [grupo, pantallas] of Object.entries(PANTALLAS)) {
  const rol = ROL_DE[grupo] ?? null
  if (soloRol && rol !== soloRol) continue
  for (const [disp, opciones] of DISPOSITIVOS) {
    const carpeta = `${DIR}/${disp}/${grupo}`
    mkdirSync(carpeta, { recursive: true })
    for (const [nombre, ruta, op = {}] of pantallas) {
      // Contexto limpio por pantalla: datos de demostración recién generados.
      const ctx = await browser.newContext(opciones)
      const page = await ctx.newPage()
      await page.goto(`${BASE}/inicio`, { waitUntil: 'domcontentloaded' })
      await page.evaluate((uid) => {
        localStorage.removeItem('cuidared:db')
        const ahora = new Date().toISOString()
        if (uid) localStorage.setItem('cuidared:sesion', JSON.stringify({ usuarioId: uid, inicio: ahora, ultimaActividad: ahora }))
        else localStorage.removeItem('cuidared:sesion')
      }, rol ? IDS[rol] : null)
      await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
      if (op.offline) await ctx.setOffline(true)
      if (op.accion === 'notificaciones') await page.getByTestId('notificaciones').click()
      await page.waitForTimeout(500)
      // Se amplía la ventana al alto del contenido para que la barra inferior fija quede al final (sin cortes).
      const alto = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))
      if (!op.accion) await page.setViewportSize({ width: opciones.viewport.width, height: Math.min(Math.max(alto, opciones.viewport.height), 12000) })
      await page.waitForTimeout(200)
      await page.screenshot({ path: `${carpeta}/${nombre}.png` })
      total++
      await ctx.close()
    }
    console.log(`✓ ${disp} · ${grupo} (${pantallas.length})`)
  }
}
await browser.close()
console.log(`\n${total} capturas guardadas en ${DIR}/`)
