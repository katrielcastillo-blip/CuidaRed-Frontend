/*
 * portal.tsx — Navegación operativa por cuenta, con autorización consultada al servidor.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ButtonLink } from '@/components/ui'
import { AuthScreen } from '../../auth/components/AuthScreen'
import { PantallaMiembros } from '../miembros'
import { ResumenCuenta } from '../resumen-cuenta'
import { type CuentaMe } from '../client'
import { Agenda } from './agenda'
import type { ColaVisitas } from './cola-visitas'
import { Estado, idRuta, useDatos } from './controles'
import { Envejecientes } from './envejecientes'
import { GestionCuenta } from './gestion-cuenta'
import { Visitas } from './visitas'

const secciones = [
  { id: 'cuenta', nombre: 'Datos de cuenta' },
  { id: 'envejecientes', nombre: 'Envejecientes', permiso: 'adultos:ver' },
  { id: 'visitas', nombre: 'Visitas', permiso: 'visitas:ver' },
  { id: 'agenda', nombre: 'Agenda', permiso: 'agenda:ver' },
] as const

export function Portal({ token, usuarioId, cola }: { token: string; usuarioId: string; cola: ColaVisitas }) {
  const { cuentaId, seccion = 'cuenta' } = useParams()
  const [revision, setRevision] = useState(0)
  const base = cuentaId && /^[1-9][0-9]{0,18}$/.test(cuentaId) ? `/cuentas/${idRuta(cuentaId)}` : null
  const raiz = `/operacion/${idRuta(cuentaId ?? '')}`
  const contexto = useDatos<CuentaMe>(base ? `${base}/contexto` : null, token, revision)
  useEffect(() => {
    const actualizar = () => { if (document.visibilityState === 'visible') setRevision((n) => n + 1) }
    const timer = window.setInterval(actualizar, 30_000)
    window.addEventListener('focus', actualizar)
    window.addEventListener('online', actualizar)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', actualizar)
      window.removeEventListener('online', actualizar)
    }
  }, [])
  const cuenta = contexto.datos
  const permite = (permiso: string) => cuenta?.acceso_operativo === true && cuenta.permisos.includes(permiso)
  const visible = secciones.filter((s) => !('permiso' in s) || permite(s.permiso))
  const autorizado = visible.some((s) => s.id === seccion) || (seccion === 'miembros' && permite('usuarios:gestionar'))
  const props = cuenta && base ? { base, token, cuenta, usuarioId } : undefined
  if (props && seccion === 'miembros' && autorizado) return <PantallaMiembros token={token} cuenta={props.cuenta} usuarioId={usuarioId} />
  return <AuthScreen title={cuenta?.nombre ?? 'Cuenta de CuidaRed'} back="/cuenta" wide>
    {!base ? <p role="alert">No se encontró la cuenta.</p> : <Estado consulta={contexto} />}
    {props && <div key={props.cuenta.cuenta_id} className="grid gap-4">
      <nav aria-label="Módulos de la cuenta" className="flex flex-wrap gap-2">
        {visible.map((s) => <ButtonLink key={s.id} to={`${raiz}/${s.id}`} variant={s.id === seccion ? 'primary' : 'outline'}>{s.nombre}</ButtonLink>)}
      </nav>
      {!autorizado && <p role="alert">No tienes acceso a este módulo de la cuenta.</p>}
      {autorizado && seccion === 'cuenta' && <>
        <ResumenCuenta cuenta={props.cuenta} token={token} mostrarAcciones={false} />
        <GestionCuenta {...props} actualizar={() => setRevision((n) => n + 1)} />
      </>}
      {autorizado && seccion === 'envejecientes' && <Envejecientes {...props} />}
      {autorizado && seccion === 'visitas' && <Visitas {...props} cola={cola} />}
      {autorizado && seccion === 'agenda' && <Agenda {...props} />}
    </div>}
  </AuthScreen>
}
