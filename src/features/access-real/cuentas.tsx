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
import { Button, ButtonLink, Icono } from '@/components/ui'
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

/** Lista de cuentas con su rol (Figma 04 «Mis cuentas» y 07 «Tus cuentas»); permite cambiar de cuenta (los permisos de la nueva se aplican al instante). */
export function PanelCuentas({ cuentas, activa, onCambiar, pagina, totalPaginas, onPagina }: {
  cuentas: CuentaMe[]; activa: CuentaMe | undefined; onCambiar: (id: string) => void
  pagina: number; totalPaginas: number; onPagina: (page: number) => void
}) {
  if (cuentas.length === 0 && pagina === 1) {
    return (
      <section aria-labelledby="titulo-cuentas" className="grid gap-2">
        <h2 id="titulo-cuentas" className="text-seccion text-ink">
          Mis cuentas
        </h2>
        <p className="text-ayuda text-muted">Todavía no perteneces a ninguna familia u organización. Cuando una persona responsable te agregue, verás aquí la cuenta y tu rol.</p>
        <ButtonLink to="/crear-cuenta" variant="outline" size="sm" className="self-start">
          Crear una cuenta
        </ButtonLink>
      </section>
    )
  }
  const unicaPagina = totalPaginas <= 1 && pagina === 1
  return (
    <section aria-labelledby="titulo-cuentas" className="grid gap-3">
      <h2 id="titulo-cuentas" className="text-seccion text-ink">
        Mis cuentas
      </h2>
      {cuentas.length > 1 && (
        <p className="text-ayuda text-muted">
          {unicaPagina ? `Perteneces a ${cuentas.length} cuentas. ` : 'Elige en qué cuenta quieres trabajar. '}En cada una puedes tener un rol distinto.
        </p>
      )}
      <ul className="divide-y divide-surface-2 overflow-hidden rounded-md border border-surface-2 bg-surface shadow-1" data-testid="cuentas-conectadas">
        {cuentas.map((c) => {
          const actual = c.cuenta_id === activa?.cuenta_id
          const familia = c.tipo === 'familia'
          return (
            <li key={c.cuenta_id}>
              <button
                type="button"
                onClick={() => onCambiar(c.cuenta_id)}
                aria-current={actual ? 'true' : undefined}
                className={cn('flex min-h-[72px] w-full min-w-0 items-center gap-3 px-3 py-3 text-left focus-visible:-outline-offset-2', actual ? 'bg-teal-100' : 'hover:bg-blue-100/50')}
              >
                <span aria-hidden className={cn('grid size-10 flex-none place-items-center rounded-md', familia ? 'bg-warning-100 text-warning-700' : 'bg-surface text-navy')}>
                  <Icono nombre={familia ? 'family_home' : 'add_business'} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="line-clamp-2 break-words text-cuerpo text-ink">{c.nombre}</strong>
                  <span className="text-ayuda text-ink-2">
                    {TIPO_TEXTO[c.tipo]} · {ROL_TEXTO[c.rol]}
                  </span>
                  <span className="text-ayuda text-muted">{suscripcionTexto(c.estado_suscripcion)}</span>
                </span>
                {actual
                  ? <span className="flex-none rounded-pill border border-teal px-2.5 py-0.5 text-etiqueta text-success-700 uppercase">Actual</span>
                  : <Icono nombre="swap_horiz" className="flex-none text-navy" />}
              </button>
            </li>
          )
        })}
      </ul>
      {(totalPaginas > 1 || pagina > 1) && (
        <nav aria-label="Páginas de cuentas" className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => onPagina(pagina - 1)}>Anterior</Button>
          <span>Página {pagina}</span>
          <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => onPagina(pagina + 1)}>Siguiente</Button>
        </nav>
      )}
      {activa && (
        <p className="break-words text-ayuda text-muted" data-testid="permisos-cuenta">
          Permisos en {activa.nombre}: {activa.permisos.length ? `${activa.permisos.length} funciones habilitadas para tu rol` : 'ninguno'}.
        </p>
      )}
    </section>
  )
}
