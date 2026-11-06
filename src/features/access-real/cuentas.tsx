/*
 * cuentas.tsx — Contexto de cuenta y rol activo del acceso conectado (CR-175 · consume GET /api/v1/me).
 * Módulo: access-real.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reglas de Negocio V2: un usuario puede pertenecer a varias cuentas (Familia u Organización) con un rol distinto
 * en cada una. El contrato ampliado de /me (CR-164, fase 2) agrega `cuentas` con la membresía, el rol, los permisos
 * efectivos y el estado de suscripción de cada cuenta: primero las activas y luego las invitaciones pendientes.
 * Con el backend de la fase 1, /me solo trae identidad y perfil: el panel lo explica y no inventa datos.
 *
 * La cuenta elegida se recuerda en sessionStorage (dura lo que la sesión del navegador) y nunca se envía como
 * parámetro de autorización: el servidor vuelve a validar membresía y permisos en cada petición (CR-162).
 */
import { Building2, Check, House } from 'lucide-react'
import { Badge, ButtonLink } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { CuentaMe, CurrentUser } from './client'
import { ROL_TEXTO, suscripcionTexto, TIPO_TEXTO } from './cuentas-datos'

export const CLAVE_CUENTA_ACTIVA = 'cuidared.cuenta.activa'

/** Cuentas activas que devuelve /me (vacío si el backend aún no las informa). */
export const cuentasDe = (user: CurrentUser | null): CuentaMe[] => (user?.cuentas ?? []).filter((c) => c.estado_membresia === 'activa')

export function leerCuentaActiva(): string | null {
  try {
    return window.sessionStorage.getItem(CLAVE_CUENTA_ACTIVA)
  } catch {
    return null
  }
}

export function guardarCuentaActiva(id: string | null) {
  try {
    if (id) window.sessionStorage.setItem(CLAVE_CUENTA_ACTIVA, id)
    else window.sessionStorage.removeItem(CLAVE_CUENTA_ACTIVA)
  } catch {
    /* modo privado: la elección dura lo que la pantalla */
  }
}

/**
 * Cuenta en la que actúa el usuario: la que eligió en esta sesión, la que el servidor marca como activa o la
 * primera. Si la elegida ya no aparece (membresía desactivada), se descarta.
 */
export function cuentaVigente(user: CurrentUser | null, elegida: string | null): CuentaMe | undefined {
  const cuentas = cuentasDe(user)
  return cuentas.find((c) => c.cuenta_id === elegida) ?? cuentas.find((c) => c.cuenta_id === user?.cuenta_activa_id) ?? cuentas[0]
}

/** Lista de cuentas con su rol; permite cambiar de cuenta (los permisos de la nueva se aplican al instante). */
export function PanelCuentas({ user, activa, onCambiar }: { user: CurrentUser; activa: CuentaMe | undefined; onCambiar: (id: string) => void }) {
  const cuentas = cuentasDe(user)
  if (cuentas.length === 0) {
    return (
      <section aria-labelledby="titulo-cuentas" className="mt-6 flex flex-col gap-2">
        <h2 id="titulo-cuentas" className="text-base font-semibold text-ink">
          Mis cuentas
        </h2>
        <p className="text-sm text-muted">Todavía no perteneces a ninguna familia u organización. Cuando una persona responsable te agregue, verás aquí la cuenta y tu rol.</p>
        <ButtonLink to="/crear-cuenta" variant="outline" size="sm" className="self-start">
          Crear una cuenta
        </ButtonLink>
      </section>
    )
  }
  return (
    <section aria-labelledby="titulo-cuentas" className="mt-6 flex flex-col gap-3">
      <h2 id="titulo-cuentas" className="text-base font-semibold text-ink">
        Mis cuentas
      </h2>
      {cuentas.length > 1 && <p className="text-sm text-muted">Elige en qué cuenta quieres trabajar. Tus permisos dependen del rol que tienes en cada una.</p>}
      <ul className="flex flex-col gap-2" data-testid="cuentas-conectadas">
        {cuentas.map((c) => {
          const actual = c.cuenta_id === activa?.cuenta_id
          const Icono = c.tipo === 'familia' ? House : Building2
          return (
            <li key={c.cuenta_id}>
              <button
                type="button"
                onClick={() => onCambiar(c.cuenta_id)}
                aria-current={actual ? 'true' : undefined}
                className={cn('w-full flex items-center gap-3 p-3 min-h-14 rounded-md border text-left', actual ? 'border-navy bg-blue-100' : 'border-line-soft bg-surface hover:bg-blue-100/50')}
              >
                <Icono size={22} aria-hidden className="text-navy flex-none" />
                <span className="flex-1 min-w-0 flex flex-col">
                  <strong className="text-ink truncate">{c.nombre}</strong>
                  <span className="text-sm text-muted">
                    {ROL_TEXTO[c.rol]} · {suscripcionTexto(c.estado_suscripcion)}
                  </span>
                </span>
                <Badge tone={c.tipo === 'familia' ? 'info' : 'neutral'}>{TIPO_TEXTO[c.tipo]}</Badge>
                {actual && <Check size={20} className="text-navy flex-none" aria-label="Cuenta actual" />}
              </button>
            </li>
          )
        })}
      </ul>
      {activa && (
        <p className="text-sm text-muted" data-testid="permisos-cuenta">
          Permisos en {activa.nombre}: {activa.permisos.length ? `${activa.permisos.length} funciones habilitadas para tu rol` : 'ninguno'}.
        </p>
      )}
    </section>
  )
}
