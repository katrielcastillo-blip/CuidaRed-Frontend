/*
 * fixtures.ts — Utilidades compartidas por las suites E2E de la Matriz de Trazabilidad (RSUP-04):
 * datos limpios por prueba, inicio de sesión por la interfaz o directo, lectura/edición del "servidor"
 * simulado ('cuidared:db') y comprobaciones de RF-06 (objetivos táctiles y desplazamiento).
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Cada prueba se ejecuta en su propio contexto de navegador (independiente y paralelizable) y empieza con
 * limpiarDatos(): borra la base local, la sesión, el sessionStorage y la cola offline (IndexedDB) y
 * recarga, de modo que la app vuelve a sembrar los datos de demostración (fechas relativas a hoy).
 *
 * Modelo de datos V3.0 (DB_VERSION 4, docs/MAPEO-BD.md): el acceso de voluntarios y familiares a un adulto
 * mayor se define con la tabla `vinculos` (voluntario_asignado / familiar_responsable), los contactos de
 * emergencia viven en `contactos`, el nivel de riesgo vigente se deriva de `riesgos` (Env_Riesgo) y el umbral
 * de días sin visita es el parámetro DIAS_SIN_VISITA_ALERTA (prm-1) de `configuracion`. Los constructores
 * visitaCompletada() y necesidadPendiente() crean registros completos de ese modelo para sembrarlos con editarDB().
 */
import { expect, type Locator, type Page } from '@playwright/test'
import type { DB, Necesidad, Rol, TipoVinculo, Visita } from '../../src/domain/types'

export const CLAVE_DB = 'cuidared:db'
export const CLAVE_SESION = 'cuidared:sesion'
export const IDB_OFFLINE = 'cuidared-offline'
export const PASSWORD_DEMO = 'Demo1234'

/** Cuentas de demostración (contraseña Demo1234). */
export const CUENTAS: Record<Rol, { email: string; id: string; nombre: string; etiqueta: string; home: string }> = {
  admin: { email: 'admin@cuidared.do', id: 'u-admin', nombre: 'Andrea Peña', etiqueta: 'Administrador', home: '/admin' },
  coordinador: { email: 'coordinador@cuidared.do', id: 'u-coord', nombre: 'Laura Núñez', etiqueta: 'Coordinador', home: '/coordinador' },
  voluntario: { email: 'voluntario@cuidared.do', id: 'u-cuid', nombre: 'Carlos Ruiz', etiqueta: 'Voluntario', home: '/voluntario' },
  familiar: { email: 'familiar@cuidared.do', id: 'u-fam', nombre: 'Clara Rodríguez', etiqueta: 'Familiar responsable', home: '/familiar' },
}

const HOME_POR_ID: Record<string, string> = Object.fromEntries(Object.values(CUENTAS).map((c) => [c.id, c.home]))

/**
 * Deja la app con datos limpios: borra 'cuidared:db', 'cuidared:sesion' (y el resto de claves de la app),
 * sessionStorage e IndexedDB 'cuidared-offline', y recarga para que se vuelva a sembrar la base.
 */
export async function limpiarDatos(page: Page) {
  await page.goto('/inicio')
  await page.evaluate(async (nombreIdb) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('cuidared:')) localStorage.removeItem(k)
    sessionStorage.clear()
    await new Promise<void>((resolve) => {
      try {
        const req = indexedDB.deleteDatabase(nombreIdb)
        req.onsuccess = req.onerror = req.onblocked = () => resolve()
      } catch {
        resolve()
      }
    })
  }, IDB_OFFLINE)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()
}

/** Rellena y envía el formulario de inicio de sesión (sin esperar el resultado). */
export async function enviarCredenciales(page: Page, email: string, password = PASSWORD_DEMO) {
  if (!page.url().includes('/inicio')) await page.goto('/inicio')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}

/** Inicia sesión por la interfaz (CU-01) con la cuenta demo del rol y espera a llegar a su inicio. */
export async function iniciarSesion(page: Page, rol: Rol) {
  const c = CUENTAS[rol]
  await enviarCredenciales(page, c.email)
  await page.waitForURL((u) => u.pathname === c.home || u.pathname.startsWith(`${c.home}/`))
  await expect(page.getByTestId('usuario-actual')).toContainText(c.etiqueta)
}

/** Cierra la sesión del dispositivo sin pasar por la interfaz (borra 'cuidared:sesion') y vuelve a /inicio. */
export async function cerrarSesion(page: Page) {
  await page.evaluate((clave) => localStorage.removeItem(clave), CLAVE_SESION)
  await page.goto('/inicio')
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()
}

/**
 * Abre una sesión sin pasar por el formulario (escribe 'cuidared:sesion') y navega a `ruta`
 * (por defecto, el inicio del rol del usuario).
 */
export async function sesionDirecta(page: Page, usuarioId: string, ruta?: string) {
  await page.evaluate(
    ({ clave, usuarioId }) => {
      const ahora = new Date().toISOString()
      localStorage.setItem(clave, JSON.stringify({ usuarioId, inicio: ahora, ultimaActividad: ahora }))
    },
    { clave: CLAVE_SESION, usuarioId },
  )
  await page.goto(ruta ?? HOME_POR_ID[usuarioId] ?? '/inicio')
}

/** Lee el "servidor" simulado (localStorage 'cuidared:db'). */
export async function leerDB(page: Page): Promise<DB> {
  return page.evaluate((clave) => JSON.parse(localStorage.getItem(clave) ?? 'null'), CLAVE_DB)
}

/**
 * Modifica el "servidor" simulado y recarga la página para que la app lo lea (el motor de alertas se vuelve
 * a evaluar al arrancar). `fn` se ejecuta en el navegador: no puede usar variables externas, solo `arg`.
 */
export async function editarDB<A = undefined>(page: Page, fn: (db: DB, arg: A) => void, arg?: A, { recargar = true } = {}) {
  await page.evaluate(
    ({ clave, src, arg }) => {
      const db = JSON.parse(localStorage.getItem(clave) ?? 'null')
      // eslint-disable-next-line no-new-func
      new Function('db', 'arg', `(${src})(db, arg)`)(db, arg)
      localStorage.setItem(clave, JSON.stringify(db))
    },
    { clave: CLAVE_DB, src: fn.toString(), arg: arg as unknown },
  )
  if (recargar) await page.reload()
}

/* ───────────── Modelo V3.0: relaciones y constructores de registros ───────────── */

/** Adultos mayores con un vínculo del tipo dado hacia el usuario (tabla Vinculo). */
export function adultosVinculados(db: DB, usuarioId: string, tipo: TipoVinculo) {
  return db.adultos.filter((a) => db.vinculos.some((v) => v.adultoId === a.id && v.usuarioId === usuarioId && v.tipoVinculoId === tipo))
}

/** Contacto de emergencia principal del adulto (tabla Contacto_emergencia). */
export const contactoPrincipal = (db: DB, adultoId: string) => db.contactos.find((c) => c.adultoId === adultoId && c.esPrincipal)

/** Umbral de días sin visita (parámetro DIAS_SIN_VISITA_ALERTA de la cuenta o su valor por defecto). */
export function umbralDiasSinVisita(db: DB, orgId = 'org-1') {
  const p = db.catalogos.parametros.find((x) => x.clave === 'DIAS_SIN_VISITA_ALERTA')!
  const c = db.configuracion.find((x) => x.orgId === orgId && x.parametroId === p.id)
  return Number(c?.valor ?? p.valorDefecto)
}

/** Visita completada con todas las columnas del modelo (Visita + RegistroVisita + DetalleVisita). */
export function visitaCompletada(v: Pick<Visita, 'id' | 'adultoId' | 'cuidadorId' | 'fecha'> & { instante: string } & Partial<Visita>): Visita {
  const { instante, ...resto } = v
  return {
    razon: 'Seguimiento periódico',
    tipo: 'Visita de Seguimiento',
    horaPautada: '10:00',
    inicio: instante,
    fin: instante,
    estado: 'completada',
    estadoAdulto: 'estable',
    observaciones: 'Visita registrada por la prueba E2E.',
    detallesAdicionales: [],
    checklist: [],
    evidencias: [],
    creadaPor: v.cuidadorId,
    actualizadoEn: instante,
    ...resto,
  }
}

/** Necesidad pendiente con todas las columnas de Env_Necesidad (prioridad alta por defecto en medicamentos). */
export function necesidadPendiente(n: Pick<Necesidad, 'id' | 'adultoId' | 'registradaPor' | 'tipo' | 'descripcion'> & Partial<Necesidad>): Necesidad {
  const ahora = n.creadaEn ?? new Date().toISOString()
  return {
    recurrente: false,
    prioridad: n.tipo === 'medicamentos' ? 'alta' : 'media',
    estado: 'pendiente',
    creadaEn: ahora,
    historial: [{ estado: 'pendiente', fecha: ahora, usuarioId: n.registradaPor }],
    actualizadoEn: ahora,
    actualizadoPor: n.registradaPor,
    ...n,
  }
}

/** Fecha local YYYY-MM-DD de hace `n` días. */
export function haceDiasISO(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Instante ISO (UTC) de hace `n` días. */
export const haceDiasInstante = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

/** Visible dentro del viewport actual (para elegir entre la versión móvil y la de escritorio de una vista). */
export const visibles = (l: Locator) => l.filter({ visible: true })

/**
 * RF-06 · WCAG 2.5.5: devuelve los elementos interactivos visibles de `raiz` que miden menos de 48×48 px.
 * Las casillas nativas ocultas visualmente (sr-only) no cuentan: su objetivo táctil es la etiqueta que las envuelve.
 */
export async function objetivosPequenos(raiz: Locator, minimo = 48) {
  return raiz.evaluate((root, min) => {
    const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="radio"], [role="tab"], [role="switch"], label:has(input[type="checkbox"]), label:has(input[type="file"])'
    const fallos: string[] = []
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || cs.display === 'none') continue // sr-only u oculto
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) continue // se mide la etiqueta
      if (r.width < min || r.height < min) {
        const nombre = (el.getAttribute('aria-label') ?? el.textContent ?? el.getAttribute('name') ?? el.tagName).trim().slice(0, 40)
        fallos.push(`${el.tagName.toLowerCase()} «${nombre}» ${Math.round(r.width)}×${Math.round(r.height)}`)
      }
    }
    return fallos
  }, minimo)
}

/** Altura total del documento (para comprobar "un solo desplazamiento" a 360×640: scrollHeight ≤ 2 × alto de la ventana). */
export const alturaDocumento = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight)

