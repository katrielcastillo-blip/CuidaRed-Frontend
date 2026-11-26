/*
 * cuentas.tsx — Contexto de cuenta y rol activo del acceso conectado (CR-175).
 * Módulo: access-real.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Reglas de Negocio V2: un usuario puede pertenecer a varias cuentas (Familia u Organización) con un rol distinto
 * en cada una. GET /cuentas lista las membresías activas y el rol de cada cuenta.
 *
 * La cuenta elegida se recuerda en sessionStorage (dura lo que la sesión del navegador) y nunca se envía como
 * parámetro de autorización: el servidor vuelve a validar membresía y permisos en cada petición (CR-162).
 */
import { ArrowDownUp, Building2, Check, House } from '@/components/icons'
import { Badge, Button, ButtonLink } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { CuentaMe } from './client'
import { ROL_TEXTO, suscripcionTexto, TIPO_TEXTO } from './cuentas-datos'

export const CLAVE_CUENTA_ACTIVA = 'cuidared.cuenta.activa'

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

/** Lista de cuentas con su rol; permite cambiar de cuenta (los permisos de la nueva se aplican al instante). */
export function PanelCuentas({ cuentas, activa, onCambiar, pagina, totalPaginas, onPagina }: {
  cuentas: CuentaMe[]; activa: CuentaMe | undefined; onCambiar: (id: string) => void
  pagina: number; totalPaginas: number; onPagina: (page: number) => void
}) {
  if (cuentas.length === 0 && pagina === 1) {
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
      {cuentas.length > 1 && <p className="text-sm text-muted">Perteneces a {cuentas.length} cuentas en esta página. En cada una puedes tener un rol distinto.</p>}
      <ul className="divide-y divide-line-soft overflow-hidden rounded-card border border-line-soft bg-white" data-testid="cuentas-conectadas">
        {cuentas.map((c) => {
          const actual = c.cuenta_id === activa?.cuenta_id
          const Icono = c.tipo === 'familia' ? House : Building2
          return (
            <li key={c.cuenta_id}>
              <button
                type="button"
                onClick={() => onCambiar(c.cuenta_id)}
                aria-current={actual ? 'true' : undefined}
                className={cn('flex min-h-24 w-full items-center gap-3 p-4 text-left', actual ? 'bg-teal-100 ring-1 ring-inset ring-teal' : 'bg-white hover:bg-blue-100/50')}
              >
                <Icono size={22} aria-hidden className="text-navy flex-none" />
                <span className="flex-1 min-w-0 flex flex-col">
                  <strong className="text-ink wrap-anywhere">{c.nombre}</strong>
                  <span className="text-sm text-muted">
                    {TIPO_TEXTO[c.tipo]} · {ROL_TEXTO[c.rol]}
                  </span>
                  <span className="text-sm text-muted">{suscripcionTexto(c.estado_suscripcion)}</span>
                </span>
                {actual ? <span className="flex shrink-0 flex-col items-center gap-1"><Badge tone="success">Actual</Badge><Check size={20} className="text-navy" aria-label="Cuenta actual" /></span> : <ArrowDownUp size={24} aria-hidden className="text-navy" />}
              </button>
            </li>
          )
        })}
      </ul>
      {(totalPaginas > 1 || pagina > 1) && (
        <nav aria-label="Páginas de cuentas" className="flex items-center gap-2">
          <Button variant="outline" disabled={pagina === 1} onClick={() => onPagina(pagina - 1)}>Anterior</Button>
          <span>Página {pagina}</span>
          <Button variant="outline" disabled={pagina >= totalPaginas} onClick={() => onPagina(pagina + 1)}>Siguiente</Button>
        </nav>
      )}
      {activa && (
        <p className="text-sm text-muted" data-testid="permisos-cuenta">
          Permisos en {activa.nombre}: {activa.permisos.length ? `${activa.permisos.length} funciones habilitadas para tu rol` : 'ninguno'}.
        </p>
      )}
    </section>
  )
}
