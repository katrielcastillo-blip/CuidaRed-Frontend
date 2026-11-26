/* Marco del perfil personal: conserva edición, cuentas, invitaciones y salida de sesión. © 2026 Equipo CuidaRed – INTEC. */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/icons'
import type { CuentaMe, Profile } from './client'
import { ROL_TEXTO } from './cuentas-datos'

export function MarcoPerfil({ perfil, cuenta, children }: { perfil: Profile | null; cuenta?: CuentaMe; children: ReactNode }) {
  const nombre = perfil ? perfil.nombres + ' ' + perfil.apellidos : ''
  const iniciales = perfil ? perfil.nombres.charAt(0) + perfil.apellidos.charAt(0) : ''
  return <div className="min-h-dvh bg-bg pb-28">
    <header className="bg-navy pt-safe text-white"><div className="mx-auto flex min-h-18 max-w-4xl items-center gap-3 px-gutter">
      <Link to="/inicio" aria-label="Volver al inicio" className="grid size-12 shrink-0 place-items-center rounded-full hover:bg-white/10"><Icon name="arrow_back" /></Link>
      <h1 className="text-lg font-semibold">Mi perfil</h1>
    </div></header>
    <main className="mx-auto grid min-w-0 max-w-4xl gap-6 px-gutter py-6 sm:py-8 [&>*]:min-w-0">
      {perfil && <section aria-label="Perfil personal" className="grid justify-items-center gap-3 py-2 text-center">
        <span className="grid size-24 place-items-center rounded-full border-2 border-blue bg-blue-100 font-display text-3xl font-bold uppercase text-navy" aria-hidden>{iniciales}</span>
        <h2 className="max-w-full break-words text-2xl font-bold text-navy">{nombre}</h2>
        {cuenta && <><p className="rounded-pill border border-navy bg-blue-100 px-3 py-1 text-sm font-semibold text-ink">{ROL_TEXTO[cuenta.rol]}{cuenta.es_titular ? ' · Titular' : ''}</p><p className="text-sm text-muted">{cuenta.nombre}</p></>}
        <Link to="?editar=perfil#informacion-personal" className="inline-flex min-h-12 items-center font-semibold text-ink underline underline-offset-4">Editar perfil</Link>
      </section>}
      {children}
    </main>
  </div>
}
