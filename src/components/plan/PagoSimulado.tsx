/*
 * PagoSimulado.tsx — Hoja de pago simulado de un plan: resumen, método de pago del catálogo y confirmación.
 * No se cobra nada ni se piden datos de tarjeta (Stripe sandbox llegará con el backend). Al confirmar, el servicio
 * `contratarPlan` registra el pago, deja la suscripción activa con el plan pagado y lo audita.
 * Módulo: plan y suscripción (Reglas de Negocio V2 §Plan · §Ciclo de vida de una suscripción).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useState, type FormEvent } from 'react'
import { Button, SelectField, Sheet, useToast } from '@/components/ui'
import { contratarPlan } from '@/domain/api/cuenta'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { addDays, fechaCorta, todayISO } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Pago, Plan } from '@/domain/types'
import { Caja } from './Caja'
import { diasDeVigencia, PERIODICIDAD, precioPlan } from './formato'

/** Pausa breve para que se note que el pago es una simulación en proceso. */
const PROCESANDO_MS = 700

export function PagoSimulado({ plan, onClose, onPagado }: { plan: Plan | null; onClose: () => void; onPagado?: (pago: Pago, plan: Plan) => void }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const metodos = useDB((s) => s.catalogos.metodosPago)
  const [metodoId, setMetodoId] = useState('')
  const [error, setError] = useState<string>()
  const [procesando, setProcesando] = useState(false)
  const [hoy] = useState(() => todayISO())

  // Estable entre renders: el Sheet vuelve a enfocar el diálogo cada vez que cambia su `onClose`.
  const cerrar = useCallback(() => {
    if (procesando) return
    setMetodoId('')
    setError(undefined)
    onClose()
  }, [procesando, onClose])

  async function pagar(ev?: FormEvent) {
    ev?.preventDefault()
    if (!plan || procesando) return
    if (!metodoId) return setError('Selecciona el método de pago.')
    setProcesando(true)
    await new Promise((r) => setTimeout(r, PROCESANDO_MS))
    const r = contratarPlan(user, plan.id, metodoId)
    setProcesando(false)
    if (!r.ok) {
      setError(r.errores?.metodoPagoId)
      return toast(r.error, 'error')
    }
    toast(`Pago aprobado. Tu cuenta quedó activa con el plan «${plan.nombre}».`)
    setMetodoId('')
    setError(undefined)
    onPagado?.(r.valor, plan)
    onClose()
  }

  const vigencia = plan ? diasDeVigencia(plan) : 0
  return (
    <Sheet
      open={!!plan}
      onClose={cerrar}
      title={plan ? `Contratar ${plan.nombre}` : 'Contratar plan'}
      footer={
        <>
          <Button variant="light" onClick={cerrar} disabled={procesando}>
            Cancelar
          </Button>
          <Button onClick={() => pagar()} loading={procesando} disabled={!enLinea}>
            Confirmar pago
          </Button>
        </>
      }
    >
      {plan && (
        <form className="flex flex-col gap-4" onSubmit={pagar} noValidate aria-label="Pago simulado">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 rounded-md bg-blue-100 text-sm">
            <div className="col-span-2 flex flex-col gap-0.5">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Plan</dt>
              <dd className="text-lg font-bold text-navy">{plan.nombre}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Total</dt>
              <dd className="font-bold text-ink">{precioPlan(plan)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">Vigencia</dt>
              <dd className="font-bold text-ink">
                {vigencia} días · {PERIODICIDAD[plan.periodicidad].toLowerCase()}
              </dd>
            </div>
          </dl>

          <SelectField
            label="Método de pago"
            required
            placeholder="Selecciona un método"
            options={metodos.filter((m) => m.activo).map((m) => ({ value: m.id, label: m.nombre }))}
            value={metodoId}
            error={error}
            help="Es una simulación: elige cualquiera. No se pide número de tarjeta ni se cobra dinero."
            onChange={(e) => {
              setMetodoId(e.target.value)
              setError(undefined)
            }}
          />

          <Caja>
            <strong>Pago simulado.</strong> No se hace ningún cobro ni se guardan datos de tarjeta. Al confirmar, tu cuenta queda activa con este plan hasta el{' '}
            {fechaCorta(addDays(new Date(`${hoy}T12:00:00`), vigencia))}.
          </Caja>
          {!enLinea && <Caja tono="offline">Sin conexión: el pago necesita internet. Podrás confirmarlo cuando vuelva la conexión.</Caja>}
        </form>
      )}
    </Sheet>
  )
}
