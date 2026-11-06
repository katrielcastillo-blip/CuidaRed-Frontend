/*
 * ayudas-fase2.ts — Simulador de Supabase Auth y de la API Express (fase 2: cuentas, catálogos y miembros) para las
 * pruebas del acceso conectado. Intercepta la red del navegador: jamás usa correo, base ni servicios reales.
 * Módulo: pruebas · access-real.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reproduce las reglas del contrato (cuerpos estrictos, permisos por cuenta, filtros y paginación de la lista de
 * miembros, errores públicos con su código) para que las pantallas se prueben contra el mismo formato que el backend.
 * Este archivo no es una prueba: Playwright solo ejecuta los `*.spec.ts`.
 */
import { expect, type Page } from '@playwright/test'

export const AUTH = 'https://auth.cuidared.test'
export const API = 'http://localhost:3301'
export const CLAVE = 'Fuerte123!'

export const PERMISOS_GESTOR = ['adultos:ver', 'usuarios:gestionar', 'organizacion:configurar', 'cuenta:suscripcion']
export const PERMISOS_CAMPO = ['adultos:ver', 'visitas:registrar', 'necesidades:registrar']

/* ───────────── Datos de ejemplo ───────────── */

export type Json = Record<string, unknown>

export interface CuentaSim extends Json {
  cuenta_id: string
  nombre: string
  tipo: 'familia' | 'organizacion'
  rol: string
  estado_membresia: 'activa' | 'pendiente' | 'inactiva'
  permisos: string[]
  estado_suscripcion: string | null
}

export const cuentaActiva = (datos: Partial<CuentaSim> & { cuenta_id: string; nombre: string }): CuentaSim => ({
  tipo: 'organizacion',
  rol: 'administrador',
  estado_membresia: 'activa',
  permisos: PERMISOS_GESTOR,
  estado_suscripcion: 'activa',
  funcionalidades: [],
  es_titular: false,
  acceso_operativo: true,
  limites: { envejecientes: null, usuarios: null, familiares: null },
  ...datos,
})

export const invitacionPendiente = (datos: Partial<CuentaSim> & { cuenta_id: string; nombre: string; membresia_id: string }): CuentaSim => ({
  tipo: 'organizacion',
  rol: 'cuidador',
  estado_membresia: 'pendiente',
  permisos: [],
  estado_suscripcion: null,
  funcionalidades: [],
  es_titular: false,
  acceso_operativo: false,
  limites: null,
  ...datos,
})

export interface MiembroSim extends Json {
  membresia_id: string
  rol: string
  estado: 'pendiente' | 'activa' | 'inactiva'
  es_titular: boolean
  usuario: { id: string; nombres: string; apellidos: string; correo: string; telefono: string | null }
}

export const miembro = (membresia_id: string, nombres: string, apellidos: string, rol: string, estado: MiembroSim['estado'] = 'activa', extra: Partial<MiembroSim> = {}): MiembroSim => ({
  membresia_id,
  rol,
  estado,
  fecha_inicio: '2026-11-06',
  fecha_fin: null,
  es_titular: false,
  usuario: {
    id: `00000000-0000-4000-8000-${membresia_id.padStart(12, '0')}`,
    nombres,
    apellidos,
    correo: `${nombres}.${apellidos}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@example.test',
    telefono: null,
  },
  cuidador: null,
  ...extra,
})

export const suscripcionDePrueba = (diasRestantes: number, extra: Json = {}): Json => ({
  estado: 'prueba',
  acceso_operativo: true,
  prueba: { gratuita: true, vigente: true, fecha_inicio: '2026-11-06', fecha_fin: '2026-11-13', dias_restantes: diasRestantes },
  plan: null,
  fecha_fin_vigencia: null,
  limites: { envejecientes: 2, usuarios: 4, familiares: 2 },
  uso: { envejecientes: 0, usuarios: 1, familiares: 0, voluntarios: 0 },
  funcionalidades: ['registro_visitas'],
  ...extra,
})

const CATEGORIAS = [
  { categoria_cuenta_id: 1, nombre: 'Monitoreo a distancia', tipo_cuenta_id: 1, tipo: 'familia' },
  { categoria_cuenta_id: 2, nombre: 'Cuidado en el hogar', tipo_cuenta_id: 1, tipo: 'familia' },
  { categoria_cuenta_id: 3, nombre: 'Iglesia o parroquia', tipo_cuenta_id: 2, tipo: 'organizacion' },
  { categoria_cuenta_id: 4, nombre: 'Fundación u ONG', tipo_cuenta_id: 2, tipo: 'organizacion' },
]
const PROVINCIAS = [
  { provincia_cod: '01', nombre: 'Distrito Nacional' },
  { provincia_cod: '25', nombre: 'Santiago' },
]
const MUNICIPIOS = [
  { municipio_cod: '0101', nombre: 'Santo Domingo de Guzmán', provincia_cod: '01' },
  { municipio_cod: '2501', nombre: 'Santiago de los Caballeros', provincia_cod: '25' },
  { municipio_cod: '2502', nombre: 'Bisonó', provincia_cod: '25' },
]

/* ───────────── Simulador ───────────── */

export interface Peticion {
  metodo: string
  ruta: string
  consulta: URLSearchParams
  cuerpo: Json
  autorizacion?: string
}

export interface OpcionesSimulacion {
  correo?: string
  cuentas?: CuentaSim[]
  miembros?: Record<string, MiembroSim[]>
  suscripciones?: Record<string, Json>
  // Auth
  registroDeshabilitado?: boolean
  correoRegistrado?: boolean
  codigoInvalido?: boolean
  // Cuentas
  categoriaInvalida?: boolean
  pruebaEnCurso?: boolean
  // Miembros
  limiteDePlan?: boolean
  invitacionesNoDisponibles?: boolean
  /** Membresía cuya baja o cambio de rol dejaría la cuenta sin gestor activo. */
  ultimoGestor?: string
  /** Error al aceptar una invitación (p. ej. el cupo del plan cambió desde que invitaron). */
  errorAlAceptar?: { estado: number; codigo: string }
}

const base64 = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString('base64url')

export function crearSesion(id: string, correo: string) {
  const usuario = {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email: correo,
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  }
  const token = [base64({ alg: 'HS256', typ: 'JWT' }), base64({ sub: id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }), 'test-signature'].join('.')
  return { usuario, token, sesion: { access_token: token, refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, user: usuario } }
}

const errorApi = (estado: number, codigo: string) => ({ status: estado, json: { error: { code: codigo, message: 'mensaje_privado' }, requestId: 'prueba' } })

export async function simular(page: Page, opciones: OpcionesSimulacion = {}) {
  const id = 'c0a80101-0000-4000-8000-0000000000aa'
  const correo = opciones.correo ?? 'laura@example.test'
  const { usuario, token, sesion } = crearSesion(id, correo)
  const perfil = { id, cedula: '00112345678', nombres: 'Laura', apellidos: 'Díaz', correo, telefono: null, estado: 'activo' }
  const estado = {
    cuentas: opciones.cuentas ?? [],
    miembros: opciones.miembros ?? {},
    suscripciones: opciones.suscripciones ?? {},
    siguienteCuenta: 100,
    siguienteMiembro: 500,
  }
  const peticiones: Peticion[] = []
  const registrar = (metodo: string, url: URL, cuerpo: Json, autorizacion?: string) =>
    peticiones.push({ metodo, ruta: url.pathname, consulta: url.searchParams, cuerpo, autorizacion })

  await page.route(`${AUTH}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const cuerpo = (request.postDataJSON() ?? {}) as Json
    registrar(request.method(), url, cuerpo)
    const ruta = url.pathname
    if (ruta.endsWith('/signup')) {
      if (opciones.registroDeshabilitado) {
        await route.fulfill({ status: 422, json: { error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' } })
        return
      }
      if (opciones.correoRegistrado) {
        await route.fulfill({ status: 422, json: { error_code: 'user_already_exists', msg: 'User already registered' } })
        return
      }
      // Con la confirmación de correo activada, el alta no devuelve sesión: llega un código por correo.
      await route.fulfill({ json: { ...usuario, email: cuerpo.email, email_confirmed_at: null, identities: [{ identity_id: 'i1', id, user_id: id, provider: 'email' }] } })
      return
    }
    if (ruta.endsWith('/verify') && opciones.codigoInvalido) {
      await route.fulfill({ status: 403, json: { error_code: 'otp_expired', msg: 'Token has expired or is invalid' } })
      return
    }
    await route.fulfill({ json: ruta.endsWith('/token') || ruta.endsWith('/verify') ? sesion : ruta.endsWith('/user') ? usuario : {} })
  })

  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const ruta = url.pathname.replace(/^\/api\/v1/, '')
    const metodo = request.method()
    const cuerpo = (metodo === 'GET' ? {} : (request.postDataJSON() ?? {})) as Json
    registrar(metodo, url, cuerpo, request.headers().authorization)
    const ok = (json: unknown, status = 200) => route.fulfill({ status, json: { data: json } })
    const fallo = (estadoHttp: number, codigo: string) => route.fulfill(errorApi(estadoHttp, codigo))
    const cuentaDe = (cuentaId: string) => estado.cuentas.find((c) => c.cuenta_id === cuentaId && c.estado_membresia === 'activa')

    if (metodo === 'GET' && ruta === '/me') {
      await ok({ identity: { id, email: correo }, profile: perfil, cuentas: estado.cuentas, cuenta_activa_id: null })
      return
    }

    if (metodo === 'GET' && ruta.startsWith('/catalogos/')) {
      const catalogo = ruta.replace('/catalogos/', '')
      if (catalogo === 'categorias-cuenta') await ok(CATEGORIAS.filter((c) => c.tipo === url.searchParams.get('tipo')))
      else if (catalogo === 'provincias') await ok(PROVINCIAS)
      else if (catalogo === 'municipios') {
        const datos = MUNICIPIOS.filter((m) => m.provincia_cod === url.searchParams.get('provincia_cod'))
        await route.fulfill({ json: { data: datos, meta: { page: 1, limit: 100, total: datos.length, totalPages: datos.length ? 1 : 0 } } })
      } else await fallo(404, 'NOT_FOUND')
      return
    }

    if (metodo === 'POST' && ruta === '/cuentas') {
      const permitidos = ['tipo', 'nombre', 'categoria_cuenta_id', 'municipio_cod', 'direccion', 'telefono', 'correo']
      if (Object.keys(cuerpo).some((clave) => !permitidos.includes(clave)) || typeof cuerpo.categoria_cuenta_id !== 'number') {
        await fallo(422, 'INVALID_INPUT')
      } else if (opciones.categoriaInvalida) await fallo(422, 'INVALID_CATEGORY')
      else if (opciones.pruebaEnCurso) await fallo(409, 'TRIAL_IN_PROGRESS')
      else {
        const familia = cuerpo.tipo === 'familia'
        const nueva = cuentaActiva({
          cuenta_id: String(estado.siguienteCuenta++),
          nombre: String(cuerpo.nombre),
          tipo: familia ? 'familia' : 'organizacion',
          rol: familia ? 'coordinador' : 'administrador',
          estado_suscripcion: 'prueba',
          es_titular: true,
        })
        estado.cuentas = [nueva, ...estado.cuentas.filter((c) => c.estado_membresia === 'activa'), ...estado.cuentas.filter((c) => c.estado_membresia !== 'activa')]
        await ok(nueva, 201)
      }
      return
    }

    let coincidencia = ruta.match(/^\/me\/membresias\/([^/]+)\/(aceptar|rechazar)$/)
    if (metodo === 'POST' && coincidencia) {
      const pendiente = estado.cuentas.find((c) => c.estado_membresia === 'pendiente' && c.membresia_id === coincidencia![1])
      if (!pendiente) await fallo(404, 'NOT_FOUND')
      else if (coincidencia[2] === 'aceptar' && opciones.errorAlAceptar) await fallo(opciones.errorAlAceptar.estado, opciones.errorAlAceptar.codigo)
      else if (coincidencia[2] === 'aceptar') {
        Object.assign(pendiente, cuentaActiva({ cuenta_id: pendiente.cuenta_id, nombre: pendiente.nombre, tipo: pendiente.tipo, rol: pendiente.rol, permisos: PERMISOS_CAMPO }))
        delete pendiente.membresia_id
        await ok({ membresia_id: coincidencia[1], cuenta_id: pendiente.cuenta_id, rol: pendiente.rol, estado: 'activa' })
      } else {
        estado.cuentas = estado.cuentas.filter((c) => c !== pendiente)
        await route.fulfill({ status: 204 })
      }
      return
    }

    coincidencia = ruta.match(/^\/cuentas\/([^/]+)\/suscripcion$/)
    if (metodo === 'GET' && coincidencia) {
      const cuenta = cuentaDe(coincidencia[1]!)
      if (!cuenta) await fallo(404, 'NOT_FOUND')
      else await ok(estado.suscripciones[cuenta.cuenta_id] ?? suscripcionDePrueba(7))
      return
    }

    coincidencia = ruta.match(/^\/cuentas\/([^/]+)\/miembros(?:\/([^/]+)(?:\/(desactivar|reactivar))?)?$/)
    if (coincidencia) {
      const [, cuentaId, membresiaId, accion] = coincidencia
      const cuenta = cuentaDe(cuentaId!)
      if (!cuenta) {
        await fallo(404, 'NOT_FOUND')
        return
      }
      if (!cuenta.permisos.includes('usuarios:gestionar')) {
        await fallo(403, 'FORBIDDEN')
        return
      }
      const lista = (estado.miembros[cuentaId!] ??= [])
      const objetivo = lista.find((m) => m.membresia_id === membresiaId)
      const propia = (m: MiembroSim) => m.usuario.id === id

      if (metodo === 'GET' && !membresiaId) {
        const rol = url.searchParams.get('filter[rol]')
        const estadoFiltro = url.searchParams.get('filter[estado]')
        const pagina = Number(url.searchParams.get('page') ?? 1)
        const limite = Number(url.searchParams.get('limit') ?? 20)
        const filtrados = lista.filter((m) => (!rol || m.rol === rol) && (!estadoFiltro || m.estado === estadoFiltro))
        const total = filtrados.length
        await route.fulfill({
          json: { data: filtrados.slice((pagina - 1) * limite, pagina * limite), meta: { page: pagina, limit: limite, total, totalPages: Math.ceil(total / limite) } },
        })
        return
      }
      if (metodo === 'POST' && !membresiaId) {
        const permitidos = ['correo', 'cedula', 'nombres', 'apellidos', 'rol']
        if (Object.keys(cuerpo).some((clave) => !permitidos.includes(clave)) || permitidos.some((clave) => typeof cuerpo[clave] !== 'string')) await fallo(422, 'INVALID_INPUT')
        else if (opciones.invitacionesNoDisponibles) await fallo(503, 'INVITATIONS_UNAVAILABLE')
        else if (opciones.limiteDePlan) await fallo(409, 'PLAN_LIMIT_REACHED')
        else {
          const nuevo = miembro(String(estado.siguienteMiembro++), String(cuerpo.nombres), String(cuerpo.apellidos), String(cuerpo.rol), 'pendiente')
          nuevo.usuario.correo = String(cuerpo.correo)
          lista.push(nuevo)
          await ok({ ...nuevo, usuario_existente: false }, 201)
        }
        return
      }
      if (!objetivo) {
        await fallo(404, 'NOT_FOUND')
        return
      }
      if (metodo === 'PATCH') {
        const gestores = cuenta.tipo === 'familia' ? ['coordinador'] : ['administrador']
        if (propia(objetivo)) await fallo(409, 'OWN_MEMBERSHIP')
        else if (objetivo.es_titular && !gestores.includes(String(cuerpo.rol))) await fallo(409, 'OWNER_PROTECTED')
        else if (opciones.ultimoGestor === objetivo.membresia_id) await fallo(409, 'LAST_MANAGER')
        else {
          objetivo.rol = String(cuerpo.rol)
          await ok(objetivo)
        }
        return
      }
      if (metodo === 'POST' && accion === 'desactivar') {
        if (propia(objetivo)) await fallo(409, 'OWN_MEMBERSHIP')
        else if (objetivo.es_titular) await fallo(409, 'OWNER_PROTECTED')
        else if (opciones.ultimoGestor === objetivo.membresia_id) await fallo(409, 'LAST_MANAGER')
        else {
          objetivo.estado = 'inactiva'
          await ok(objetivo)
        }
        return
      }
      if (metodo === 'POST' && accion === 'reactivar') {
        if (opciones.limiteDePlan) await fallo(409, 'PLAN_LIMIT_REACHED')
        else {
          objetivo.estado = 'activa'
          await ok(objetivo)
        }
        return
      }
    }

    // /session/activity, /session/logout y lo demás: sin contenido.
    await route.fulfill({ status: 204 })
  })

  return {
    peticiones,
    token,
    correo,
    usuarioId: id,
    opciones,
    /** Cuentas que el servidor simulado devuelve ahora en GET /me. */
    cuentas: () => estado.cuentas,
    /** Peticiones a la API que cumplen un método y una ruta (sin el prefijo /api/v1). */
    llamadas: (metodo: string, ruta: string | RegExp) =>
      peticiones.filter((p) => p.metodo === metodo && p.ruta.startsWith('/api/v1') && (typeof ruta === 'string' ? p.ruta === `/api/v1${ruta}` : ruta.test(p.ruta.replace('/api/v1', '')))),
  }
}

/* ───────────── Acciones de pantalla ───────────── */

export async function iniciarSesion(page: Page, correo: string) {
  await page.goto('/inicio')
  await page.getByLabel(/^Correo electrónico/).fill(correo)
  await page.getByLabel(/^Contraseña/).fill(CLAVE)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mis cuentas' })).toBeVisible()
}
