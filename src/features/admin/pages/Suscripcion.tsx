/*
 * Suscripcion.tsx — «Plan y suscripción» de la organización (permiso cuenta:suscripcion).
 *  - Cuenta: Suscripcion_Estado, Prueba_gratuita, Fecha_Inicio_Prueba, Fecha_Fin_Prueba, Plan_Id, Plan_Precio.
 *  - Plan (+ PlanCategoria): nombre, categoría, precio y periodicidad, duración en días, Limite_Envejecientes y
 *    Limite_Usuarios con barra de uso (usoDelPlan) y aviso si se exceden; planes disponibles y cambio de plan.
 *  - Pago (+ MetodoPago): historial (fecha, monto, método, estado, plan, quién lo registró, referencia),
 *    registrar un pago recibido y confirmarlo o anularlo.
 * La monetización no forma parte del MVP (SRS §8.1): el módulo es informativo y no procesa cobros.
 * Módulo: admin (CU-13 · modelo de datos V3.0).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { BadgeCheck, CalendarRange, CircleCheck, CircleX, CreditCard, Gift, Layers, Plus, Receipt } from 'lucide-react'
import { Badge, Button, SelectField, Sheet, TextField, useToast, type Tone } from '@/components/ui'
import { cambiarEstadoPago, cambiarPlan, registrarPago, type DatosPago } from '@/domain/api'
import { useSession, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { diasCalendario, fechaCorta, todayISO } from '@/domain/dates'
import { nombreUsuario, planDe, usoDelPlan } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Catalogos, Organizacion, Pago, Plan } from '@/domain/types'
import { cn } from '@/lib/cn'
import { useBorrador } from '@/lib/useBorrador'
import { Page, useShell } from '@/layouts/AppShell'
import { BarraUso } from '../components/BarraUso'
import { AvisoSinConexion, Nota } from '../components/Nota'
import { ESTADO_SUSCRIPCION, formatoMonto, PERIODICIDAD, precioPlan } from '../lib/plan'

const TARJETA = 'flex flex-col gap-4 p-5 rounded-md bg-surface shadow-1 min-w-0'
const TITULO = 'flex items-center gap-2 text-lg font-bold text-ink'

const ESTADO_PAGO: Record<Pago['estado'], { texto: string; tono: Tone }> = {
  registrado: { texto: 'Por confirmar', tono: 'warning' },
  confirmado: { texto: 'Confirmado', tono: 'success' },
  anulado: { texto: 'Anulado', tono: 'neutral' },
}

const categoriaPlan = (cat: Pick<Catalogos, 'categoriasPlan'>, p?: Plan) => cat.categoriasPlan.find((c) => c.id === p?.categoriaId)?.nombre ?? '—'

export default function Suscripcion() {
  const { base } = useShell()
  const { org } = useSession()
  const enLinea = useEnLinea()
  return (
    <Page title="Plan y suscripción" back={`${base}/mas`} wide>
      <Nota tono="warning">
        <strong>Módulo informativo:</strong> CuidaRed no procesa cobros en esta versión (SRS §8.1). Aquí solo se registra el plan contratado y los pagos recibidos por
        otros medios.
      </Nota>
      {!enLinea && <AvisoSinConexion>Los cambios de plan y el registro de pagos necesitan internet. Podrás guardarlos cuando vuelva la conexión.</AvisoSinConexion>}
      {org && <Contenido org={org} />}
    </Page>
  )
}

function Contenido({ org }: { org: Organizacion }) {
  const catalogos = useDB((s) => s.catalogos)
  const plan = planDe(catalogos, org)
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <EstadoCuenta org={org} />
          <PlanActual org={org} plan={plan} />
        </div>
        <PlanesDisponibles org={org} />
      </div>
      <HistorialPagos org={org} />
    </>
  )
}

/* ───────────── Estado de la suscripción y prueba gratuita ───────────── */

function EstadoCuenta({ org }: { org: Organizacion }) {
  const estado = ESTADO_SUSCRIPCION[org.suscripcionEstado]
  const hoy = todayISO()
  const enPrueba = org.pruebaGratuita && org.fechaFinPrueba && org.fechaFinPrueba >= hoy
  const restantes = org.fechaFinPrueba ? diasCalendario(`${hoy}T12:00:00`, `${org.fechaFinPrueba}T12:00:00`) : 0
  return (
    <section className={TARJETA} aria-labelledby="h-estado">
      <div className="flex items-center justify-between gap-3">
        <h2 id="h-estado" className={TITULO}>
          <BadgeCheck size={22} className="text-navy" aria-hidden /> Estado de la suscripción
        </h2>
        <Badge tone={estado.tono}>{estado.texto}</Badge>
      </div>
      <div className="flex items-start gap-3 p-4 rounded-md bg-blue-100">
        <Gift size={22} className="flex-none mt-0.5 text-navy" aria-hidden />
        <div className="flex-1 min-w-0 flex flex-col gap-1 text-sm">
          <strong className="text-base text-ink">Prueba gratuita {org.pruebaGratuita ? '(30 días)' : ''}</strong>
          {org.pruebaGratuita ? (
            <>
              <span className="text-ink-2">
                Del {org.fechaInicioPrueba ? fechaCorta(`${org.fechaInicioPrueba}T12:00:00`) : '—'} al {org.fechaFinPrueba ? fechaCorta(`${org.fechaFinPrueba}T12:00:00`) : '—'}
              </span>
              <span className={enPrueba ? 'font-semibold text-navy' : 'text-muted'}>
                {enPrueba ? `Quedan ${restantes} día${restantes === 1 ? '' : 's'} de prueba.` : 'La prueba gratuita ya terminó.'}
              </span>
            </>
          ) : (
            <span className="text-muted">Esta cuenta no utilizó la prueba gratuita.</span>
          )}
        </div>
      </div>
      <p className="text-sm text-muted">
        La suscripción pasa a <strong className="text-ink-2">Activa</strong> al confirmar un pago o al elegir un plan gratuito.
      </p>
    </section>
  )
}

/* ───────────── Plan actual y uso de los límites ───────────── */

function PlanActual({ org, plan }: { org: Organizacion; plan?: Plan }) {
  const catalogos = useDB((s) => s.catalogos)
  const adultos = useDB((s) => s.adultos)
  const usuarios = useDB((s) => s.usuarios)
  const uso = useMemo(() => usoDelPlan({ adultos, usuarios, catalogos }, org), [adultos, usuarios, catalogos, org])

  return (
    <section className={TARJETA} aria-labelledby="h-plan">
      <h2 id="h-plan" className={TITULO}>
        <Layers size={22} className="text-navy" aria-hidden /> Plan actual
      </h2>
      {!plan ? (
        <p className="text-sm text-danger">La cuenta no tiene un plan válido. Elige uno de la lista de planes disponibles.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-3xl font-bold text-navy">{plan.nombre}</span>
            <span className="text-base font-semibold text-ink">{precioPlan(plan)}</span>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Dato etiqueta="Categoría" valor={categoriaPlan(catalogos, plan)} />
            <Dato etiqueta="Duración" valor={`${plan.duracionDias} días`} />
            <Dato etiqueta="Precio contratado" valor={org.planPrecio === 0 ? 'Gratis' : formatoMonto(org.planPrecio)} />
            <Dato etiqueta="Periodicidad" valor={PERIODICIDAD[plan.periodicidad]} />
          </dl>
          <BarraUso etiqueta="Adultos mayores activos" usado={uso.envejecientes} limite={plan.limiteEnvejecientes} excede={uso.excedeEnvejecientes} />
          <BarraUso etiqueta="Usuarios (activos e invitados)" usado={uso.usuarios} limite={plan.limiteUsuarios} excede={uso.excedeUsuarios} />
          {(uso.excedeEnvejecientes || uso.excedeUsuarios) && (
            <Nota tono="warning">
              La organización supera los límites del plan {plan.nombre}. Puedes seguir trabajando, pero te recomendamos cambiar a un plan con más capacidad.
            </Nota>
          )}
        </>
      )}
    </section>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{etiqueta}</dt>
      <dd className="font-semibold text-ink wrap-anywhere">{valor}</dd>
    </div>
  )
}

/* ───────────── Planes disponibles ───────────── */

function PlanesDisponibles({ org }: { org: Organizacion }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const catalogos = useDB((s) => s.catalogos)
  const adultos = useDB((s) => s.adultos)
  const usuarios = useDB((s) => s.usuarios)
  const [elegido, setElegido] = useState<Plan | null>(null)
  const planes = catalogos.planes.filter((p) => p.estado === 'activo')
  const uso = useMemo(() => usoDelPlan({ adultos, usuarios, catalogos }, org), [adultos, usuarios, catalogos, org])

  const confirmar = () => {
    if (!elegido) return
    const r = cambiarPlan(user, elegido.id)
    setElegido(null)
    if (!r.ok) return toast(r.error, 'error')
    toast(`Plan cambiado a «${elegido.nombre}».`)
  }

  return (
    <section className={TARJETA} aria-labelledby="h-planes">
      <h2 id="h-planes" className={TITULO}>
        <CreditCard size={22} className="text-navy" aria-hidden /> Planes disponibles
      </h2>
      <ul className="flex flex-col gap-3">
        {planes.map((p) => {
          const actual = p.id === org.planId
          const insuficiente = uso.envejecientes > p.limiteEnvejecientes || uso.usuarios > p.limiteUsuarios
          return (
            <li key={p.id} className={cn('flex flex-col gap-3 p-4 rounded-md border', actual ? 'border-navy bg-blue-100' : 'border-line-soft bg-bg')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <strong className="text-lg text-ink">{p.nombre}</strong>
                  <span className="text-xs font-semibold text-muted">{categoriaPlan(catalogos, p)}</span>
                </span>
                <span className="font-bold text-navy">{precioPlan(p)}</span>
              </div>
              <ul className="grid grid-cols-1 gap-1 text-sm text-ink-2 sm:grid-cols-3">
                <li>Hasta {p.limiteEnvejecientes} adultos mayores</li>
                <li>Hasta {p.limiteUsuarios} usuarios</li>
                <li>Vigencia de {p.duracionDias} días</li>
              </ul>
              {actual ? (
                <span className="inline-flex items-center gap-1.5 min-h-12 text-sm font-bold text-navy">
                  <CircleCheck size={18} aria-hidden /> Plan actual
                </span>
              ) : (
                <>
                  {insuficiente && <p className="text-xs font-semibold text-warning-700">Tu uso actual supera los límites de este plan.</p>}
                  <Button variant="outline" size="sm" className="border-navy!" disabled={!enLinea} onClick={() => setElegido(p)}>
                    Cambiar a este plan
                  </Button>
                </>
              )}
            </li>
          )
        })}
      </ul>

      <Sheet
        open={!!elegido}
        onClose={() => setElegido(null)}
        title="Cambiar de plan"
        footer={
          <>
            <Button variant="light" onClick={() => setElegido(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={!enLinea}>
              Cambiar plan
            </Button>
          </>
        }
      >
        {elegido && (
          <>
            <p>
              La cuenta pasará al plan <strong>{elegido.nombre}</strong> ({precioPlan(elegido)}). El precio contratado se actualizará a{' '}
              {elegido.precio === 0 ? 'gratis' : formatoMonto(elegido.precio)}.
            </p>
            <p className="text-sm text-muted">No se realiza ningún cobro: registra el pago cuando lo recibas por otro medio.</p>
          </>
        )}
      </Sheet>
    </section>
  )
}

/* ───────────── Historial de pagos ───────────── */

const PAGO_VACIO: DatosPago = { monto: '', metodoPagoId: '', fecha: '', referencia: '' }

function HistorialPagos({ org }: { org: Organizacion }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const pagos = useDB((s) => s.pagos)
  const catalogos = useDB((s) => s.catalogos)
  const usuarios = useDB((s) => s.usuarios)
  const [registrando, setRegistrando] = useState(false)
  const [accion, setAccion] = useState<{ pago: Pago; estado: 'confirmado' | 'anulado' } | null>(null)

  const lista = useMemo(() => pagos.filter((p) => p.orgId === org.id).sort((a, b) => b.fecha.localeCompare(a.fecha)), [pagos, org.id])
  const metodo = (id: string) => catalogos.metodosPago.find((m) => m.id === id)?.nombre ?? id
  const nombrePlan = (id: string) => catalogos.planes.find((p) => p.id === id)?.nombre ?? id
  const totalConfirmado = lista.filter((p) => p.estado === 'confirmado').reduce((a, p) => a + p.monto, 0)

  const aplicar = () => {
    if (!accion) return
    const r = cambiarEstadoPago(user, accion.pago.id, accion.estado)
    setAccion(null)
    if (!r.ok) return toast(r.error, 'error')
    toast(accion.estado === 'confirmado' ? 'Pago confirmado. La suscripción queda activa.' : 'Pago anulado')
  }

  return (
    <section className={TARJETA} aria-labelledby="h-pagos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="h-pagos" className={TITULO}>
            <Receipt size={22} className="text-navy" aria-hidden /> Historial de pagos
          </h2>
          <span className="text-sm text-muted">
            {lista.length} pago{lista.length === 1 ? '' : 's'} · confirmados: {formatoMonto(totalConfirmado)}
          </span>
        </div>
        <Button size="sm" icon={<Plus size={18} aria-hidden />} disabled={!enLinea} onClick={() => setRegistrando(true)}>
          Registrar pago
        </Button>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay pagos registrados.</p>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="relative hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <caption className="sr-only">Pagos de la organización</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line-soft">
                  <th scope="col" className="py-2 pr-3 font-bold">Fecha</th>
                  <th scope="col" className="py-2 pr-3 font-bold text-right">Monto</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Método</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Plan</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Registrado por</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Referencia</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Estado</th>
                  <th scope="col" className="py-2 font-bold">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{fechaCorta(p.fecha)}</td>
                    <td className="py-2 pr-3 text-right font-bold whitespace-nowrap">{formatoMonto(p.monto)}</td>
                    <td className="py-2 pr-3">{metodo(p.metodoPagoId)}</td>
                    <td className="py-2 pr-3">{nombrePlan(p.planId)}</td>
                    <td className="py-2 pr-3">{nombreUsuario(usuarios, p.usuarioId)}</td>
                    <td className="py-2 pr-3 text-muted">{p.referencia || '—'}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={ESTADO_PAGO[p.estado].tono}>{ESTADO_PAGO[p.estado].texto}</Badge>
                    </td>
                    <td className="py-2">{p.estado === 'registrado' && <AccionesPago vertical pago={p} deshabilitado={!enLinea} onAccion={(estado) => setAccion({ pago: p, estado })} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Móvil: tarjetas */}
          <ul className="flex flex-col gap-3 md:hidden">
            {lista.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 p-4 rounded-md border border-line-soft bg-bg">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-lg">{formatoMonto(p.monto)}</strong>
                  <Badge tone={ESTADO_PAGO[p.estado].tono}>{ESTADO_PAGO[p.estado].texto}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <Dato etiqueta="Fecha" valor={fechaCorta(p.fecha)} />
                  <Dato etiqueta="Método" valor={metodo(p.metodoPagoId)} />
                  <Dato etiqueta="Plan" valor={nombrePlan(p.planId)} />
                  <Dato etiqueta="Referencia" valor={p.referencia || '—'} />
                  <div className="col-span-2">
                    <Dato etiqueta="Registrado por" valor={nombreUsuario(usuarios, p.usuarioId)} />
                  </div>
                </dl>
                {p.estado === 'registrado' && <AccionesPago pago={p} deshabilitado={!enLinea} onAccion={(estado) => setAccion({ pago: p, estado })} />}
              </li>
            ))}
          </ul>
        </>
      )}

      {registrando && <RegistrarPago onClose={() => setRegistrando(false)} />}

      <Sheet
        open={!!accion}
        onClose={() => setAccion(null)}
        title={accion?.estado === 'confirmado' ? 'Confirmar pago' : 'Anular pago'}
        footer={
          <>
            <Button variant="light" onClick={() => setAccion(null)}>
              Cancelar
            </Button>
            <Button variant={accion?.estado === 'anulado' ? 'danger' : 'primary'} onClick={aplicar} disabled={!enLinea}>
              {accion?.estado === 'confirmado' ? 'Confirmar' : 'Anular'}
            </Button>
          </>
        }
      >
        {accion && (
          <p>
            {accion.estado === 'confirmado'
              ? `Confirmas que se recibió el pago de ${formatoMonto(accion.pago.monto)} del ${fechaCorta(accion.pago.fecha)}. La suscripción quedará activa.`
              : `El pago de ${formatoMonto(accion.pago.monto)} del ${fechaCorta(accion.pago.fecha)} quedará anulado. Se conserva en el historial.`}
          </p>
        )}
      </Sheet>
    </section>
  )
}

function AccionesPago({
  pago,
  deshabilitado,
  onAccion,
  vertical,
}: {
  pago: Pago
  deshabilitado: boolean
  onAccion: (e: 'confirmado' | 'anulado') => void
  /** En la tabla de escritorio los botones se apilan para no desbordar la columna. */
  vertical?: boolean
}) {
  return (
    <div className={cn('flex gap-2', vertical ? 'flex-col items-stretch' : '[&>*]:flex-1')} role="group" aria-label={`Acciones del pago de ${formatoMonto(pago.monto)}`}>
      <Button size="sm" variant="light" icon={<CircleCheck size={18} aria-hidden />} disabled={deshabilitado} onClick={() => onAccion('confirmado')}>
        Confirmar
      </Button>
      <Button size="sm" variant="danger-soft" icon={<CircleX size={18} aria-hidden />} disabled={deshabilitado} onClick={() => onAccion('anulado')}>
        Anular
      </Button>
    </div>
  )
}

/** Hoja «Registrar pago»: monto, método (MetodoPago), fecha y referencia. Conserva lo escrito con useBorrador. */
function RegistrarPago({ onClose }: { onClose: () => void }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const { org } = useSession()
  const catalogos = useDB((s) => s.catalogos)
  const plan = planDe(catalogos, org)
  const [d, setD, descartar] = useBorrador<DatosPago>('admin:registrar-pago', { ...PAGO_VACIO, monto: plan?.precio ? String(plan.precio) : '', fecha: todayISO() })
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})

  const set = <K extends keyof DatosPago>(k: K, v: DatosPago[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    if (errores[k]) setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const guardar = (ev?: FormEvent) => {
    ev?.preventDefault()
    const r = registrarPago(user, d)
    if (!r.ok) {
      setErrores(r.errores ?? {})
      toast(r.error, 'error')
      return
    }
    descartar()
    toast('Pago registrado. Confírmalo cuando verifiques que se recibió.')
    onClose()
  }

  const cancelar = () => {
    descartar()
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Registrar pago"
      footer={
        <>
          <Button variant="light" onClick={cancelar}>
            Cancelar
          </Button>
          <Button onClick={() => guardar()} disabled={!enLinea}>
            Registrar
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={guardar} noValidate>
        <p className="flex items-center gap-2 text-sm text-muted">
          <CalendarRange size={16} aria-hidden /> Se asociará al plan actual: <strong className="text-ink-2">{plan?.nombre ?? '—'}</strong>
        </p>
        <TextField
          label="Monto (RD$)"
          required
          type="number"
          inputMode="decimal"
          min={1}
          step="0.01"
          value={d.monto}
          error={errores.monto}
          onChange={(e) => set('monto', e.target.value)}
        />
        <SelectField
          label="Método de pago"
          required
          placeholder="Seleccionar"
          options={catalogos.metodosPago.filter((m) => m.activo).map((m) => ({ value: m.id, label: m.nombre }))}
          value={d.metodoPagoId}
          error={errores.metodoPagoId}
          onChange={(e) => set('metodoPagoId', e.target.value)}
        />
        <TextField label="Fecha del pago" required type="date" max={todayISO()} value={d.fecha} error={errores.fecha} onChange={(e) => set('fecha', e.target.value)} />
        <TextField
          label="Referencia (opcional)"
          maxLength={40}
          autoComplete="off"
          placeholder="Nº de transferencia o recibo"
          value={d.referencia}
          error={errores.referencia}
          help="Número de transferencia, recibo o comprobante que permita verificar el pago."
          onChange={(e) => set('referencia', e.target.value)}
        />
        <button type="submit" className="sr-only">
          Registrar
        </button>
      </form>
    </Sheet>
  )
}
