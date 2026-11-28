/*
 * pagina-secundaria.tsx — Marco de una pantalla secundaria que vive FUERA del Portal (p. ej. «Mi perfil», /cuenta):
 * barra con degradado, volver + título, sin barra inferior, y la ayuda flotante si se conoce la cuenta.
 * Es el mismo aspecto que usa el Portal para sus pantallas secundarias (BarraSecundaria / CabeceraEscritorio).
 * © 2026 Equipo CuidaRed – INTEC.
 */
import type { ReactNode } from 'react'
import { AyudaFlotante } from './ayuda'
import { BarraSecundaria, EnlaceVolver } from './barras'

export type DestinoVolver = { destino: string; historial?: boolean; accion?: () => void }

export function PaginaSecundaria({ titulo, volver, raizAyuda, children }: {
  titulo: string
  volver: DestinoVolver
  /** `/operacion/:cuenta`: con ella se muestra la ayuda flotante. */
  raizAyuda?: string
  children: ReactNode
}) {
  return <div className="min-h-dvh bg-bg">
    <a href="#contenido-secundario" className="sr-only z-50 rounded-md bg-surface p-3 text-navy focus:not-sr-only focus:fixed focus:left-2 focus:top-2">Saltar al contenido</a>
    <BarraSecundaria titulo={titulo} {...volver} />
    <header className="hidden bg-navy shadow-1 md:block">
      <div className="mx-auto flex min-h-[var(--appbar-h)] max-w-[calc(var(--content-max)+var(--gutter)*2)] items-center gap-3 px-[var(--gutter)]">
        <EnlaceVolver {...volver} />
        <h1 className="min-w-0 flex-1 truncate text-tarjeta text-white">{titulo}</h1>
      </div>
    </header>
    <main id="contenido-secundario" className="mx-auto grid w-full max-w-[calc(var(--content-max)+var(--gutter)*2)] gap-5 px-[var(--gutter)] py-5 pb-[calc(var(--safe-bottom)+96px)] sm:py-6">
      {children}
    </main>
    {raizAyuda && <AyudaFlotante raiz={raizAyuda} sinBarraInferior />}
  </div>
}
