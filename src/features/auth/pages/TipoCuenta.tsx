/*
 * TipoCuenta.tsx — "/crear-cuenta": primer paso de la creación de una cuenta nueva. Pregunta qué tipo de cuenta
 * se quiere crear (Familia u Organización) y lleva al formulario que corresponde.
 * "Activar mi cuenta" (/registro) sigue siendo solo para quien recibió una invitación.
 * Módulo: auth (Reglas de Negocio V2 §Cuenta · feedback de PM sobre LOGIN SCREEN).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Gift, House, KeyRound } from 'lucide-react'
import { DIAS_PRUEBA_GRATUITA, ROLES_POR_TIPO_CUENTA, TIPO_CUENTA_LABEL, type TipoCuenta } from '@/domain/planes'
import { ROL_LABEL } from '@/domain/nombres'
import { AuthScreen } from '../components/AuthScreen'
import { LogoBadge } from '../components/LogoBadge'
import { Aviso, ENLACE, Lead, YaTienesCuenta } from '../components/Piezas'

interface Opcion {
  tipo: TipoCuenta
  to: string
  icono: ReactNode
  quien: string
  detalle: string
}

const OPCIONES: Opcion[] = [
  {
    tipo: 'familia',
    to: '/registro-familia',
    icono: <House size={28} aria-hidden />,
    quien: 'Cuido a un familiar mayor',
    detalle: 'Coordina a los cuidadores, registra visitas y necesidades y mantén informada a tu familia.',
  },
  {
    tipo: 'organizacion',
    to: '/registro-organizacion',
    icono: <Building2 size={28} aria-hidden />,
    quien: 'Represento a una organización',
    detalle: 'Iglesia, fundación, asilo o universidad: gestiona voluntarios, visitas y alertas de varios adultos mayores.',
  },
]

export default function TipoCuenta() {
  return (
    <AuthScreen title="Crear cuenta" back="/">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <LogoBadge />
        <h2 className="text-balance text-center text-xl font-bold text-navy">¿Qué tipo de cuenta quieres crear?</h2>
        <Lead>Elige la que describa mejor cómo vas a usar CuidaRed. Cada tipo tiene sus propios roles.</Lead>

        <ul className="flex flex-col gap-3.5">
          {OPCIONES.map((o) => (
            <li key={o.tipo}>
              <Link
                to={o.to}
                className="group flex min-h-12 items-start gap-4 rounded-md border-2 border-line-soft bg-surface p-4 shadow-1 transition hover:border-navy hover:bg-blue-100/50 focus-visible:border-navy"
              >
                <span className="grid size-14 flex-none place-items-center rounded-md bg-blue-100 text-navy" aria-hidden>
                  {o.icono}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-semibold uppercase tracking-wide text-muted">{TIPO_CUENTA_LABEL[o.tipo]}</span>
                  <strong className="text-lg leading-snug text-navy">{o.quien}</strong>
                  <span className="text-sm leading-snug text-ink-2">{o.detalle}</span>
                  <span className="text-xs leading-snug text-muted">Roles: {ROLES_POR_TIPO_CUENTA[o.tipo].map((r) => ROL_LABEL[r]).join(', ')}.</span>
                </span>
                <ArrowRight size={22} aria-hidden className="mt-1 flex-none text-navy transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>

        <Aviso tono="info" icono={<Gift size={18} />}>
          <strong>{DIAS_PRUEBA_GRATUITA} días gratis, sin tarjeta</strong> en cualquiera de los dos tipos.
        </Aviso>

        <div className="mt-auto flex flex-col gap-1 pt-4 text-center">
          <p className="flex flex-wrap items-center justify-center gap-x-2 text-ink-2">
            <KeyRound size={18} aria-hidden className="text-blue" />
            ¿Te invitaron a una cuenta?
            <Link to="/registro" className={ENLACE}>
              Activar mi cuenta
            </Link>
          </p>
          <YaTienesCuenta />
        </div>
      </div>
    </AuthScreen>
  )
}
