/*
 * Inicio.tsx — Inicio del voluntario (vista mínima): saludo, mensaje de bienvenida la primera vez, visitas de hoy y
 * próximas con el botón "Registrar visita", acceso a la visita no programada y aviso de conexión / pendientes.
 * Módulo: voluntario (V2 §Visita: solo registra que la visita ocurrió y deja una observación; RF-10).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { CircleCheck, ClipboardPlus, HandHeart } from 'lucide-react'
import { useSession, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaLarga } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { usePendientes } from '@/domain/sync'
import type { Visita } from '@/domain/types'
import { Button, ButtonLink, Card, EmptyState } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { AvisoConexion, TarjetaVisita } from '../components/Piezas'
import { useBienvenida, useMisAdultos, useMisVisitas } from '../lib/datos'

const ENLACE = 'inline-flex items-center min-h-12 px-2 text-sm font-semibold text-navy underline underline-offset-4'

export function Inicio() {
  const user = useUser()
  const { org } = useSession()
  const { base } = useShell()
  const enLinea = useEnLinea()
  const pendientes = usePendientes().length
  const adultos = useMisAdultos()
  const { hoy, proximas, atrasadas, registradasHoy, fichaDe } = useMisVisitas()
  const [bienvenida, cerrarBienvenida] = useBienvenida(user.id)
  const puedeRegistrar = puede(user, 'visitas:registrar')

  const lista = (visitas: Visita[], destacada: boolean) =>
    visitas.map((v) => {
      const ficha = fichaDe(v)
      return ficha ? <TarjetaVisita key={v.id} visita={v} ficha={ficha} destacada={destacada} /> : null
    })

  return (
    <Page title="Inicio" wide>
      <div className="flex flex-col gap-0.5">
        <p className="text-2xl font-bold leading-tight text-ink">Hola, {user.nombre}</p>
        <p className="text-sm font-semibold text-muted">{fechaLarga()}</p>
      </div>

      {bienvenida && <Bienvenida nombre={user.nombre} organizacion={org?.nombre} ayuda={`${base}/ayuda`} onCerrar={cerrarBienvenida} />}

      <AvisoConexion enLinea={enLinea} pendientes={pendientes} />

      {!puedeRegistrar ? (
        <EmptyState title="Tu cuenta no puede registrar visitas" text="Comunícate con el administrador de tu organización para revisar tu acceso." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col gap-6 min-w-0">
            {atrasadas.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="atrasadas-titulo">
                <h2 className="section-title" id="atrasadas-titulo">
                  Visitas sin registrar
                </h2>
                <p className="-mt-1 text-sm text-ink-2">Pasó su día y aún no las registras. Si ya las hiciste, regístralas ahora.</p>
                {lista(atrasadas, true)}
              </section>
            )}

            <section className="flex flex-col gap-3" aria-labelledby="hoy-titulo">
              <h2 className="section-title" id="hoy-titulo">
                Visitas de hoy
              </h2>
              {registradasHoy > 0 && (
                <p className="flex items-center gap-2 text-sm font-semibold text-success-700">
                  <CircleCheck size={18} aria-hidden />
                  Hoy ya registraste {registradasHoy} visita{registradasHoy === 1 ? '' : 's'}.
                </p>
              )}
              {hoy.length > 0 ? lista(hoy, true) : <p className="text-sm text-ink-2">No tienes visitas programadas para hoy.</p>}
            </section>
          </div>

          <div className="flex flex-col gap-6 min-w-0">
            <section className="flex flex-col gap-3" aria-labelledby="proximas-titulo">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title" id="proximas-titulo">
                  Próximas visitas
                </h2>
                <Link to={`${base}/visitas`} className={ENLACE}>
                  Ver todas
                </Link>
              </div>
              {proximas.length > 0 ? lista(proximas.slice(0, 3), false) : <p className="text-sm text-ink-2">No hay visitas programadas para los próximos días.</p>}
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="libre-titulo">
              <h2 className="section-title" id="libre-titulo">
                Visita no programada
              </h2>
              {adultos.length > 0 ? (
                <>
                  <p className="-mt-1 text-sm text-ink-2">¿Visitaste a un adulto mayor que tienes asignado y no estaba en tu lista? Regístrala aquí.</p>
                  <ButtonLink variant="soft" fullWidth to={`${base}/visitas/nueva`} icon={<ClipboardPlus size={22} aria-hidden />}>
                    Registrar una visita no programada
                  </ButtonLink>
                </>
              ) : (
                <EmptyState title="Aún no tienes adultos asignados" text="El coordinador te asignará los adultos mayores que debes visitar." />
              )}
            </section>
          </div>
        </div>
      )}
    </Page>
  )
}

/** Explica, la primera vez, qué puede y qué no puede hacer el voluntario (aceptación de la invitación, CR-184). */
function Bienvenida({ nombre, organizacion, ayuda, onCerrar }: { nombre: string; organizacion?: string; ayuda: string; onCerrar: () => void }) {
  return (
    <Card tone="info" className="flex flex-col gap-3" role="region" aria-labelledby="bienvenida-titulo">
      <div className="flex items-center gap-3">
        <HandHeart size={28} className="flex-none text-navy" aria-hidden />
        <h2 className="text-xl font-bold leading-tight text-navy" id="bienvenida-titulo">
          Te damos la bienvenida, {nombre}
        </h2>
      </div>
      <p className="text-base text-ink">{organizacion ? `Ya formas parte de ${organizacion} como voluntario.` : 'Ya formas parte del equipo como voluntario.'} Aquí puedes:</p>
      <ul className="flex flex-col gap-2 pl-6 list-disc marker:text-navy text-base text-ink">
        <li>Ver los adultos mayores que el coordinador te asignó y cómo llegar a su casa.</li>
        <li>Registrar que la visita se realizó y dejar una observación.</li>
      </ul>
      <p className="text-sm text-ink-2">No verás información médica ni necesidades. Si notas algo urgente, avisa al coordinador.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onCerrar}>
          Entendido
        </Button>
        <ButtonLink variant="ghost" to={ayuda}>
          Ver la ayuda
        </ButtonLink>
      </div>
    </Card>
  )
}
