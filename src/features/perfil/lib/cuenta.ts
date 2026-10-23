/*
 * cuenta.ts — Operaciones del titular sobre su propia cuenta: editar sus datos y eliminar su cuenta.
 * Módulo: perfil (Ley 172-13: derechos de rectificación y cancelación · SRS §8.2.2.3.4 e: auditoría).
 * Tablas: Usuario, Vinculo, Membresia y Cuidador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * domain/api/usuarios solo ofrece la gestión de usuarios para el administrador (usuarios:gestionar); la
 * edición del propio perfil la puede hacer cualquier rol, así que vive aquí: valida de nuevo, exige
 * conexión, escribe con mutate() y audita.
 */
import { auditar } from '@/domain/auditoria'
import { estaEnLinea } from '@/domain/conectividad'
import { ROL_LABEL } from '@/domain/nombres'
import { getDB, MENSAJE_SIN_CONEXION, mutate } from '@/domain/store'
import type { Usuario } from '@/domain/types'
import { errorEmail, errorNombre, errorTelefono, hayErrores, limpiarTexto } from '@/domain/validacion'
import { puedeEliminarCuenta } from './rol'

export interface DatosMiPerfil {
  nombre: string
  apellido: string
  email: string
  telefono: string
  avatar?: string
}

export type ResultadoCuenta = { ok: true } | { ok: false; error: string; errores?: Record<string, string | undefined> }

/** Correo ya usado: mensaje neutro (no revela datos de la otra cuenta). */
const CORREO_NO_DISPONIBLE = 'Este correo no está disponible. Usa otro.'

export function validarMiPerfil(user: Usuario, d: DatosMiPerfil) {
  const e = d.email.trim().toLowerCase()
  return {
    nombre: errorNombre(d.nombre, 'nombre'),
    apellido: errorNombre(d.apellido, 'apellido'),
    email: errorEmail(d.email) ?? (getDB().usuarios.some((u) => u.id !== user.id && u.email.toLowerCase() === e) ? CORREO_NO_DISPONIBLE : undefined),
    telefono: errorTelefono(d.telefono),
  }
}

export function actualizarMiPerfil(user: Usuario, d: DatosMiPerfil): ResultadoCuenta {
  if (!estaEnLinea()) return { ok: false, error: MENSAJE_SIN_CONEXION }
  const errores = validarMiPerfil(user, d)
  if (hayErrores(errores)) return { ok: false, error: 'Revisa los campos marcados.', errores }
  const cambioCorreo = d.email.trim().toLowerCase() !== user.email.toLowerCase()
  const escrito = mutate((db) => {
    const u = db.usuarios.find((x) => x.id === user.id)
    if (!u) return
    u.nombre = limpiarTexto(d.nombre)
    u.apellido = limpiarTexto(d.apellido)
    u.email = d.email.trim().toLowerCase()
    u.telefono = d.telefono.trim()
    if (d.avatar) u.avatar = d.avatar
    else delete u.avatar
    u.actualizadoEn = new Date().toISOString()
    auditar(db, u, { accion: 'usuario.editar', entidad: 'usuario', registroId: u.id, detalle: cambioCorreo ? 'Edición del propio perfil · correo actualizado' : 'Edición del propio perfil' })
  })
  return escrito ? { ok: true } : { ok: false, error: MENSAJE_SIN_CONEXION }
}

/**
 * Elimina la cuenta del propio titular (solo voluntario y familiar responsable): borra sus vínculos con adultos
 * mayores (Vinculo), cierra su membresía vigente (Membresia) y su perfil de cuidador (Cuidador). Las visitas,
 * necesidades y entradas de auditoría que registró se conservan según la política de retención. Quien llama debe cerrar la
 * sesión después (logout()).
 */
export function eliminarMiCuenta(user: Usuario): ResultadoCuenta {
  if (!estaEnLinea()) return { ok: false, error: MENSAJE_SIN_CONEXION }
  if (!puedeEliminarCuenta(user.rol)) return { ok: false, error: 'Tu rol no puede eliminar su cuenta desde aquí. Solicítalo al administrador de tu organización.' }
  const escrito = mutate((db) => {
    if (!db.usuarios.some((x) => x.id === user.id)) return
    db.usuarios = db.usuarios.filter((x) => x.id !== user.id)
    const ahora = new Date().toISOString()
    // Vinculo: deja de estar asignado o a cargo de cualquier adulto mayor.
    db.vinculos = db.vinculos.filter((v) => v.usuarioId !== user.id)
    // Membresia: se cierra la vigente (el historial se conserva).
    for (const m of db.membresias) {
      if (m.usuarioId === user.id && m.estado === 'activa') {
        m.estado = 'inactiva'
        m.fechaFin = ahora
      }
    }
    // Cuidador: si tenía perfil de cuidador abierto, se cierra con la fecha de hoy.
    for (const c of db.cuidadores) if (c.usuarioId === user.id && !c.fechaFin) c.fechaFin = ahora.slice(0, 10)
    for (const inv of db.invitaciones) if (inv.estado === 'pendiente' && inv.email.toLowerCase() === user.email.toLowerCase()) inv.estado = 'rechazada'
    auditar(db, user, {
      accion: 'usuario.eliminar',
      entidad: 'usuario',
      registroId: user.id,
      detalle: `Eliminación de la propia cuenta por su titular (${ROL_LABEL[user.rol]})`,
    })
  })
  return escrito ? { ok: true } : { ok: false, error: MENSAJE_SIN_CONEXION }
}
