/* Perfil personal: consulta, edición y accesos de seguridad existentes. © 2026 Equipo CuidaRed – INTEC. */
import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/icons'
import type { Profile } from './client'
import { ProfileForm } from './forms'

export function InformacionPerfil({ token, profile, onSaved }: { token: string; profile: Profile; onSaved: () => void }) {
  const [parametros] = useSearchParams()
  const editar = parametros.get('editar') === 'perfil'
  const panel = useRef<HTMLElement>(null)
  useEffect(() => { if (editar) panel.current?.querySelector('input')?.focus() }, [editar])
  const datos = [
    { titulo: 'Correo electrónico', valor: profile.correo, icono: 'mail' },
    { titulo: 'Cédula', valor: profile.cedula.replace(/^(\d{3})(\d{7})(\d)$/, '$1-$2-$3'), icono: 'badge' },
    { titulo: 'Teléfono', valor: profile.telefono || 'No registrado', icono: 'call' },
  ]
  return <section ref={panel} id="informacion-personal" className="grid min-w-0 gap-3" aria-label="Información personal">
    {editar ? <><ProfileForm token={token} profile={profile} onSaved={onSaved} /><Link to="/cuenta" className="inline-flex min-h-12 items-center justify-self-start font-semibold text-navy underline underline-offset-4">Terminar edición</Link></> : <>
      <h2 className="text-lg font-semibold">Información personal</h2>
      <dl className="divide-y divide-line-soft overflow-hidden rounded-card border border-line-soft bg-white">
        {datos.map(dato => <div key={dato.titulo} className="flex min-w-0 items-center gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-blue-100 text-primary"><Icon name={dato.icono} /></span>
          <div className="min-w-0"><dt className="text-sm text-muted">{dato.titulo}</dt><dd className="mt-0.5 font-semibold text-ink wrap-anywhere">{dato.valor}</dd></div>
        </div>)}
      </dl>
    </>}
  </section>
}

export function SeguridadPerfil() {
  return <section aria-labelledby="seguridad-perfil" className="grid gap-3">
    <h2 id="seguridad-perfil" className="text-lg font-semibold">Seguridad y privacidad</h2>
    <ul className="divide-y divide-line-soft overflow-hidden rounded-card border border-line-soft bg-white">
      {[
        { ruta: '/recuperar', titulo: 'Restablecer contraseña', detalle: 'Recibe un código en tu correo', icono: 'lock' },
        { ruta: '/terminos', titulo: 'Términos de uso', detalle: 'Condiciones de uso del servicio', icono: 'description' },
        { ruta: '/privacidad', titulo: 'Política de privacidad', detalle: 'Cómo cuidamos tus datos personales', icono: 'verified_user' },
      ].map(item => <li key={item.ruta}><Link to={item.ruta} className="flex min-h-20 items-center gap-3 p-4 hover:bg-blue-100/40"><span className="grid size-10 shrink-0 place-items-center rounded-sm bg-blue-100 text-primary"><Icon name={item.icono} /></span><span className="min-w-0 flex-1"><strong className="block font-semibold">{item.titulo}</strong><span className="mt-0.5 block text-sm text-muted">{item.detalle}</span></span><Icon name="chevron_right" size={20} className="text-muted" /></Link></li>)}
    </ul>
  </section>
}
