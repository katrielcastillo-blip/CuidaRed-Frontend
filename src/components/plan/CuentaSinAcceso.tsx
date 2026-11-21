/*
 * CuentaSinAcceso.tsx — Pantalla completa de una cuenta sin acceso operativo (prueba terminada o suscripción vencida).
 * La persona titular ve «Contratar un plan» con los planes de su tipo de cuenta y el pago simulado; los demás
 * miembros ven que deben contactar a la persona titular y pueden cerrar sesión o cambiar de cuenta.
 * Módulo: plan y suscripción (Reglas de Negocio V2 §Ciclo de vida de una suscripción).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useNavigate } from 'react-router-dom'
import { Building2, House, LogOut, ShieldAlert } from 'lucide-react'
import { Badge, Button, useToast } from '@/components/ui'
import { cambiarCuenta, logout, nombreCompleto, ROL_LABEL, useMisCuentas, useSession } from '@/domain/auth'
import { TIPO_CUENTA_LABEL, tipoDeCuenta } from '@/domain/planes'
import { useDB } from '@/domain/store'
import { Caja } from './Caja'
import { ContratarPlan } from './ContratarPlan'
import { useTitular } from './useTitular'

export function CuentaSinAcceso() {
  const { org } = useSession()
  const { esTitular, puedeContratar } = useTitular()
  const cuentas = useMisCuentas()
  const usuarios = useDB((s) => s.usuarios)
  const navigate = useNavigate()
  const toast = useToast()
  if (!org) return null

  const titular = usuarios.find((u) => u.id === org.usuarioTitularId)
  const pruebaTerminada = org.pruebaGratuita && org.suscripcionEstado === 'prueba'
  const otras = cuentas.filter((c) => !c.activa)

  const salir = () => {
    logout()
    navigate('/inicio', { replace: true })
  }
  const cambiar = (membresiaId: string) => {
    const destino = cambiarCuenta(membresiaId)
    if (!destino) return toast('No se pudo cambiar de cuenta. Vuelve a intentarlo.', 'error')
    navigate(destino, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-bg" data-testid="cuenta-sin-acceso">
      <header className="bg-surface border-b border-line-soft shadow-1">
        <div className="flex items-center justify-between gap-3 min-h-[var(--appbar-h)] mx-auto px-[var(--gutter)] max-w-3xl">
          <img src="/brand/logo.png" width={279} height={104} alt="CuidaRed" className="h-10 w-auto flex-none" />
          <span className="min-w-0 text-right text-xs text-muted truncate">
            {org.nombre} · {TIPO_CUENTA_LABEL[tipoDeCuenta(org)]}
          </span>
        </div>
      </header>

      <main id="contenido" className="flex flex-col gap-6 w-full mx-auto px-[var(--gutter)] py-8 max-w-3xl">
        <section className="flex flex-col gap-3" aria-labelledby="titulo-sin-acceso">
          <span className="grid place-items-center size-14 rounded-full bg-warning-100 text-warning-700" aria-hidden>
            <ShieldAlert size={30} />
          </span>
          <h1 id="titulo-sin-acceso" className="text-2xl font-bold text-ink">
            {esTitular ? 'Contratar un plan' : 'Tu cuenta no tiene un plan activo'}
          </h1>
          <p className="text-base text-ink-2">
            {pruebaTerminada ? 'La prueba gratuita de esta cuenta terminó.' : 'La suscripción de esta cuenta no está vigente.'} Mientras no haya un plan activo no se puede registrar ni consultar información; tus datos se conservan y
            vuelven a estar disponibles al contratar.
          </p>
        </section>

        {esTitular ? (
          <section className="flex flex-col gap-4" aria-labelledby="titulo-planes">
            <h2 id="titulo-planes" className="section-title">
              Elige el plan de tu {tipoDeCuenta(org) === 'familia' ? 'familia' : 'organización'}
            </h2>
            <Caja>
              <strong>Pago simulado:</strong> en esta versión no se cobra dinero ni se piden datos de tarjeta. Al confirmar, tu cuenta queda activa con el plan elegido.
            </Caja>
            <ContratarPlan puedeContratar={puedeContratar} />
          </section>
        ) : (
          <Caja tono="warning">
            <strong className="text-base">Contacta a la persona titular de la cuenta.</strong>
            <span className="block mt-1">
              Solo la persona titular puede contratar un plan{titular ? <>: <strong>{nombreCompleto(titular)}</strong>.</> : '.'}
            </span>
          </Caja>
        )}

        <section className="flex flex-col gap-3 pt-2 border-t border-line-soft" aria-label="Opciones de sesión">
          {otras.length > 0 && (
            <>
              <h2 className="section-title">Cambiar de cuenta</h2>
              <ul className="flex flex-col gap-2">
                {otras.map(({ membresia, org: o }) => {
                  const tipo = tipoDeCuenta(o)
                  const Icono = tipo === 'familia' ? House : Building2
                  return (
                    <li key={membresia.id}>
                      <button
                        type="button"
                        onClick={() => cambiar(membresia.id)}
                        className="w-full flex items-center gap-3 p-3 min-h-14 rounded-md border border-line-soft bg-surface text-left hover:bg-blue-100/50"
                      >
                        <span className="grid place-items-center size-10 flex-none rounded-full bg-white text-navy border border-line-soft">
                          <Icono size={20} aria-hidden />
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col">
                          <strong className="text-ink truncate">{o?.nombre ?? 'Cuenta'}</strong>
                          <span className="text-sm text-muted">{ROL_LABEL[membresia.rol]}</span>
                        </span>
                        <Badge tone={tipo === 'familia' ? 'info' : 'neutral'}>{TIPO_CUENTA_LABEL[tipo]}</Badge>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          <Button variant="outline" size="sm" icon={<LogOut size={18} aria-hidden />} onClick={salir} className="self-start">
            Cerrar sesión
          </Button>
        </section>
      </main>
    </div>
  )
}
