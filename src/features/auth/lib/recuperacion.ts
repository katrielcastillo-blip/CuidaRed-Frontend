/*
 * recuperacion.ts — Recuperación segura de contraseña con código de un solo uso.
 * Módulo: auth (SRS §8.2.2.3.5 b "permitir la recuperación segura de contraseñas" y l "mensajes genéricos").
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *  1. solicitarRecuperacion(): genera un código de 6 dígitos, guarda SOLO su hash con caducidad de 15 min
 *     y responde siempre igual, exista o no el correo (no permite averiguar qué correos tienen cuenta).
 *  2. restablecerPassword(): valida correo + código (hash, caducidad y un solo uso) y la política de
 *     contraseñas; actualiza hash y sal. Tras 5 códigos incorrectos se anulan los códigos vigentes.
 * Como esta versión no tiene servidor de correo, la pantalla muestra el código en "modo demostración".
 */
import { auditar } from '@/domain/auditoria'
import { estaEnLinea } from '@/domain/conectividad'
import { generarCodigo, hashSecreto, MINUTOS_CODIGO_RECUPERACION, protegerPassword, SAL_CODIGOS, validarPassword, verificarSecreto } from '@/domain/seguridad'
import { getDB, MENSAJE_SIN_CONEXION, mutate, uid } from '@/domain/store'
import type { DB } from '@/domain/types'
import { normalizarEmail } from './validar'

/** Intentos fallidos de código permitidos antes de anular los códigos vigentes. */
export const MAX_INTENTOS_CODIGO = 5
const claveIntentos = (email: string) => `recuperar:${email}`

export const MENSAJE_GENERICO_RECUPERACION =
  'Si el correo está asociado a una cuenta activa, recibirás un código de 6 dígitos para restablecer tu contraseña. Caduca en 15 minutos y solo se puede usar una vez.'
export const ERROR_CODIGO = 'El código no es válido o ya caducó. Revisa el correo y el código, o solicita uno nuevo.'

/** Quita del almacenamiento los códigos usados o caducados hace más de un día (minimización). */
function purgar(db: DB) {
  const limite = Date.now() - 24 * 3_600_000
  db.recuperaciones = db.recuperaciones.filter((r) => Date.parse(r.expira) > limite)
}

export type ResultadoSolicitud = { ok: true; codigoDemo: string } | { ok: false; error: string }

export async function solicitarRecuperacion(email: string): Promise<ResultadoSolicitud> {
  if (!estaEnLinea()) return { ok: false, error: MENSAJE_SIN_CONEXION }
  const e = normalizarEmail(email)
  const codigo = generarCodigo()
  // Se calcula el hash siempre para que el tiempo de respuesta no delate si la cuenta existe.
  const codigoHash = await hashSecreto(codigo, SAL_CODIGOS)
  const user = getDB().usuarios.find((u) => u.email.toLowerCase() === e && u.estado === 'activo')

  const escrito = mutate((db) => {
    purgar(db)
    if (user) {
      // Un código nuevo anula los anteriores del mismo correo.
      for (const r of db.recuperaciones) if (r.email === e) r.usado = true
      db.recuperaciones.push({
        id: uid('rec'),
        email: e,
        codigoHash,
        expira: new Date(Date.now() + MINUTOS_CODIGO_RECUPERACION * 60_000).toISOString(),
        usado: false,
      })
    }
    auditar(db, user ?? { anonimo: e }, {
      accion: 'sesion.recuperar',
      entidad: 'sesion',
      registroId: user?.id,
      resultado: user ? 'exito' : 'fallo',
      detalle: user ? 'Código de recuperación generado' : 'Correo sin cuenta activa',
    })
  })
  if (!escrito) return { ok: false, error: MENSAJE_SIN_CONEXION }
  // Modo demostración: el código "llegaría por correo". Se devuelve también si el correo no existe, para que la
  // pantalla se comporte igual (ese código no está guardado y no sirve).
  return { ok: true, codigoDemo: codigo }
}

export type ResultadoRestablecer = { ok: true } | { ok: false; error: string; errores?: Record<string, string | undefined> }

export async function restablecerPassword(email: string, codigo: string, nueva: string): Promise<ResultadoRestablecer> {
  if (!estaEnLinea()) return { ok: false, error: MENSAJE_SIN_CONEXION }
  const errPass = validarPassword(nueva)
  if (errPass) return { ok: false, error: 'Revisa los campos marcados.', errores: { password: errPass } }

  const e = normalizarEmail(email)
  const ahora = Date.now()
  const vigentes = getDB().recuperaciones.filter((r) => r.email === e && !r.usado && Date.parse(r.expira) > ahora)
  let valido: string | undefined
  for (const r of vigentes) if (await verificarSecreto(codigo.trim(), SAL_CODIGOS, r.codigoHash)) valido = r.id
  const user = getDB().usuarios.find((u) => u.email.toLowerCase() === e && u.estado === 'activo')

  if (!valido || !user) {
    const escrito = mutate((db) => {
      const clave = claveIntentos(e)
      const b = db.bloqueos[clave] ?? { fallos: 0 }
      b.fallos += 1
      let anulados = false
      if (b.fallos >= MAX_INTENTOS_CODIGO) {
        for (const r of db.recuperaciones) if (r.email === e) r.usado = true
        b.fallos = 0
        anulados = true
      }
      db.bloqueos[clave] = b
      auditar(db, user ?? { anonimo: e }, {
        accion: 'sesion.restablecer',
        entidad: 'sesion',
        registroId: user?.id,
        resultado: 'fallo',
        detalle: anulados ? 'Demasiados códigos incorrectos: códigos anulados' : 'Código inválido o caducado',
      })
    })
    if (!escrito) return { ok: false, error: MENSAJE_SIN_CONEXION }
    return { ok: false, error: ERROR_CODIGO, errores: { codigo: ERROR_CODIGO } }
  }

  const protegida = await protegerPassword(nueva)
  const escrito = mutate((db) => {
    const u = db.usuarios.find((x) => x.id === user.id)
    if (!u) return
    Object.assign(u, protegida, { actualizadoEn: new Date().toISOString() })
    for (const r of db.recuperaciones) if (r.email === e) r.usado = true
    delete db.bloqueos[claveIntentos(e)]
    // La persona demostró el control del correo: se levanta el bloqueo temporal de inicio de sesión.
    delete db.bloqueos[e]
    purgar(db)
    auditar(db, u, { accion: 'sesion.restablecer', entidad: 'sesion', registroId: u.id, detalle: 'Contraseña restablecida con código de un solo uso' })
  })
  if (!escrito) return { ok: false, error: MENSAJE_SIN_CONEXION }
  return { ok: true }
}
