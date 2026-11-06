/*
 * Suscripcion.tsx — «Plan y suscripción» de la cuenta (permiso cuenta:suscripcion; Admin en Organización y
 * Coordinador en Familia). Reglas de Negocio V2 §Plan y §Ciclo de vida de una suscripción:
 *  - Estado actual: prueba gratuita (días restantes, límites y funciones de la prueba), activa (plan, precio, vigencia
 *    y uso de límites con usoDelPlan) o vencida (sin acceso operativo hasta contratar).
 *  - Planes compatibles con el tipo de cuenta, con su resumen y funcionalidades. Solo la persona titular ve el botón
 *    de contratar o pagar; el pago es simulado (sin cobros ni datos de tarjeta reales).
 *  - Historial de pagos de la cuenta con su estado; la persona titular confirma o anula los pagos «por confirmar».
 * Módulo: admin (CU-13 · modelo de datos V3.0 · CR-187).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { BadgeCheck, Check, CircleCheck, CircleX, CreditCard, Gift, Layers, Receipt, ShieldAlert, X } from 'lucide-react'
import { Badge, Button, Sheet, useToast } from '@/components/ui'
import { cambiarEstadoPago } from '@/domain/api'
import { useSession, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, todayISO } from '@/domain/dates'
import { DIAS_PRUEBA_GRATUITA, ETIQUETA_FUNCIONALIDAD, planesCompatibles, TIPO_CUENTA_LABEL } from '@/domain/planes'
import { nombreUsuario, usoDelPlan } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { EstadoSuscripcion, Funcionalidad, Organizacion, Pago } from '@/domain/types'
import { usePlanCuenta } from '@/domain/usePlan'
import { Caja } from '@/components/plan/Caja'
import { ContratarPlan } from '@/components/plan/ContratarPlan'
import { useTitular } from '@/components/plan/useTitular'
import { Page } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { BarraUso } from '../components/BarraUso'
import { ESTADO_PAGO, ESTADO_SUSCRIPCION, formatoMonto, PERIODICIDAD, precioPlan, vigenciaDelPago } from '../lib/plan'

const TARJETA = 'flex flex-col gap-4 p-5 rounded-md bg-surface shadow-1 min-w-0'
const TITULO = 'flex items-center gap-2 text-lg font-bold text-ink'

export default function Suscripcion() {
  const { org } = useSession()
  const enLinea = useEnLinea()
  const { esTitular, puedeContratar } = useTitular()
  return (
    <Page title="Suscripción y plan" back wide>
      <Caja>
        <strong>Pago simulado:</strong> en esta versión no se cobra dinero ni se piden datos de tarjeta. Un pago aprobado deja la suscripción activa con el plan elegido.
      </Caja>
      {!enLinea && <Caja tono="offline">Sin conexión. Contratar un plan y confirmar pagos necesitan internet; podrás hacerlo cuando vuelva la conexión.</Caja>}
      {org && <Contenido org={org} esTitular={esTitular} puedeContratar={puedeContratar} />}
    </Page>
  )
}

function Contenido({ org, esTitular, puedeContratar }: { org: Organizacion; esTitular: boolean; puedeContratar: boolean }) {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <EstadoCuenta org={org} />
        <PlanesCuenta org={org} esTitular={esTitular} puedeContratar={puedeContratar} />
      </div>
      <HistorialPagos org={org} puedeContratar={puedeContratar} />
    </>
  )
}

/* ───────────── Estado de la suscripción: prueba, activa o vencida ───────────── */

function EstadoCuenta({ org }: { org: Organizacion }) {
  const { enPrueba, accesoOperativo } = usePlanCuenta()
  // Una prueba cuya fecha pasó (o una cuenta sin pago) no tiene acceso operativo: se presenta como vencida.
  const estado: EstadoSuscripcion = accesoOperativo ? org.suscripcionEstado : org.suscripcionEstado === 'cancelada' ? 'cancelada' : 'vencida'
  const vista = ESTADO_SUSCRIPCION[estado]
  return (
    <section className={TARJETA} aria-labelledby="h-estado" data-testid="estado-suscripcion">
      <div className="flex items-center justify-between gap-3">
        <h2 id="h-estado" className={TITULO}>
          <BadgeCheck size={22} className="text-navy" aria-hidden /> Estado de la suscripción
        </h2>
        <Badge tone={vista.tono}>{vista.texto}</Badge>
      </div>
      {enPrueba ? <EstadoPrueba org={org} /> : estado === 'activa' ? <EstadoActiva org={org} /> : <EstadoSinAcceso org={org} estado={estado} />}
    </section>
  )
}

/** Prueba gratuita (14 días, una sola vez, sin método de pago): días restantes, límites y funciones de la prueba. */
function EstadoPrueba({ org }: { org: Organizacion }) {
  const { tipo, diasRestantesPrueba: dias, pruebaPorTerminar, funcionalidades, limites } = usePlanCuenta()
  const catalogos = useDB((s) => s.catalogos)
  const adultos = useDB((s) => s.adultos)
  const usuarios = useDB((s) => s.usuarios)
  const membresias = useDB((s) => s.membresias)
  const uso = useMemo(() => usoDelPlan({ adultos, usuarios, catalogos, membresias }, org), [adultos, usuarios, catalogos, membresias, org])
  // Funciones que ofrecen los planes de este tipo de cuenta y la prueba no incluye.
  const noIncluidas = useMemo(() => {
    const deLosPlanes = new Set(planesCompatibles(catalogos, org).flatMap((p) => p.funcionalidades))
    return [...deLosPlanes].filter((f) => !funcionalidades.includes(f))
  }, [catalogos, org, funcionalidades])
  const pct = Math.min(100, Math.round(((DIAS_PRUEBA_GRATUITA - dias) / DIAS_PRUEBA_GRATUITA) * 100))

  return (
    <>
      <div className={cn('flex items-start gap-3 p-4 rounded-md', pruebaPorTerminar ? 'bg-warning-100' : 'bg-blue-100')}>
        <Gift size={22} className="flex-none mt-0.5 text-navy" aria-hidden />
        <div className="flex-1 min-w-0 flex flex-col gap-2 text-sm">
          <strong className="text-base text-ink">Prueba gratuita de {DIAS_PRUEBA_GRATUITA} días</strong>
          <span className="text-ink-2">
            Del {org.fechaInicioPrueba ? fechaCorta(org.fechaInicioPrueba) : '—'} al {org.fechaFinPrueba ? fechaCorta(org.fechaFinPrueba) : '—'} · se usa una sola vez y no pide método de pago.
          </span>
          <span className={cn('font-bold', pruebaPorTerminar ? 'text-warning-700' : 'text-navy')}>
            {dias === 0 ? 'La prueba termina hoy.' : `Quedan ${dias} día${dias === 1 ? '' : 's'} de prueba.`}
          </span>
          <div
            className="h-2 rounded-pill bg-white overflow-hidden"
            role="progressbar"
            aria-label="Días de prueba usados"
            aria-valuemin={0}
            aria-valuemax={DIAS_PRUEBA_GRATUITA}
            aria-valuenow={DIAS_PRUEBA_GRATUITA - dias}
          >
            <div className={cn('h-full rounded-pill', pruebaPorTerminar ? 'bg-warning' : 'bg-navy')} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Límites de la prueba</h3>
        <BarraUso etiqueta="Adultos mayores activos" usado={uso.envejecientes} limite={limites.envejecientes} excede={uso.excedeEnvejecientes} />
        <BarraUso etiqueta="Usuarios (activos e invitados)" usado={uso.usuarios} limite={limites.usuarios} excede={uso.excedeUsuarios} />
        {tipo === 'familia' && <BarraUso etiqueta="Familiares" usado={uso.familiares} limite={limites.familiares} excede={uso.excedeFamiliares} />}
      </div>

      <ListaFuncionalidades titulo="Funciones de la prueba" items={funcionalidades} />
      {noIncluidas.length > 0 && <ListaFuncionalidades titulo="No incluidas en la prueba" items={noIncluidas} incluidas={false} />}
    </>
  )
}

/** Suscripción activa: plan, precio, vigencia y uso de los límites (usoDelPlan). */
function EstadoActiva({ org }: { org: Organizacion }) {
  const { plan, tipo, funcionalidades } = usePlanCuenta()
  const catalogos = useDB((s) => s.catalogos)
  const adultos = useDB((s) => s.adultos)
  const usuarios = useDB((s) => s.usuarios)
  const membresias = useDB((s) => s.membresias)
  const pagos = useDB((s) => s.pagos)
  const uso = useMemo(() => usoDelPlan({ adultos, usuarios, catalogos, membresias }, org), [adultos, usuarios, catalogos, membresias, org])
  // La vigencia depende de la periodicidad del plan y del último pago confirmado de ese plan.
  const vigencia = useMemo(() => {
    const ultimo = pagos
      .filter((p) => p.orgId === org.id && p.estado === 'confirmado' && p.planId === org.planId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    return ultimo && plan ? vigenciaDelPago(ultimo, plan) : undefined
  }, [pagos, org.id, org.planId, plan])
  const cubierta = !!vigencia && vigencia >= todayISO()
  const categoria = catalogos.categoriasPlan.find((c) => c.id === plan?.categoriaId)?.nombre ?? '—'

  if (!plan) return <p className="text-sm text-danger">La cuenta no tiene un plan válido. Elige uno de la lista de planes.</p>
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-3xl font-bold text-navy">
          <Layers size={26} aria-hidden /> {plan.nombre}
        </span>
        <span className="text-base font-semibold text-ink">{precioPlan(plan)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Dato etiqueta="Categoría" valor={categoria} />
        <Dato etiqueta="Periodicidad" valor={PERIODICIDAD[plan.periodicidad]} />
        <Dato etiqueta="Precio contratado" valor={org.planPrecio === 0 ? 'Gratis' : formatoMonto(org.planPrecio)} />
        <Dato etiqueta="Vigencia" valor={vigencia ? `Hasta el ${fechaCorta(vigencia)}` : `${plan.duracionDias} días por pago`} />
      </dl>
      {vigencia && !cubierta && (
        <Caja tono="warning">
          El último pago cubrió hasta el {fechaCorta(vigencia)}. Renueva el plan para extender la vigencia.
        </Caja>
      )}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Uso del plan</h3>
        <BarraUso etiqueta="Adultos mayores activos" usado={uso.envejecientes} limite={plan.limiteEnvejecientes} excede={uso.excedeEnvejecientes} />
        <BarraUso etiqueta="Usuarios (activos e invitados)" usado={uso.usuarios} limite={plan.limiteUsuarios} excede={uso.excedeUsuarios} />
        {tipo === 'familia' && <BarraUso etiqueta="Familiares" usado={uso.familiares} limite={plan.limiteFamiliares ?? null} excede={uso.excedeFamiliares} />}
      </div>
      {(uso.excedeEnvejecientes || uso.excedeUsuarios || uso.excedeFamiliares) && (
        <Caja tono="warning">La cuenta supera los límites del plan {plan.nombre}. Puedes seguir trabajando, pero te recomendamos cambiar a un plan con más capacidad.</Caja>
      )}
      <ListaFuncionalidades titulo="Funciones incluidas" items={funcionalidades} />
    </>
  )
}

/** Cuenta sin acceso operativo (prueba terminada o suscripción vencida) o cancelada. */
function EstadoSinAcceso({ org, estado }: { org: Organizacion; estado: EstadoSuscripcion }) {
  const pruebaTerminada = org.pruebaGratuita && org.suscripcionEstado === 'prueba'
  return (
    <div className="flex items-start gap-3 p-4 rounded-md bg-warning-100">
      <ShieldAlert size={22} className="flex-none mt-0.5 text-warning-700" aria-hidden />
      <div className="flex flex-col gap-1 text-sm">
        <strong className="text-base text-ink">{estado === 'cancelada' ? 'La suscripción está cancelada' : pruebaTerminada ? 'La prueba gratuita terminó' : 'La suscripción venció'}</strong>
        <span className="text-ink-2">
          La cuenta no tiene acceso operativo hasta que se contrate un plan. Los datos se conservan y vuelven a estar disponibles al contratar.
        </span>
      </div>
    </div>
  )
}

function ListaFuncionalidades({ titulo, items, incluidas = true }: { titulo: string; items: Funcionalidad[]; incluidas?: boolean }) {
  if (items.length === 0) return null
  const Icono = incluidas ? Check : X
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{titulo}</h3>
      <ul className={cn('grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-2', incluidas ? 'text-ink-2' : 'text-muted')}>
        {items.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <Icono size={16} className={cn('flex-none mt-0.5', incluidas ? 'text-success-700' : 'text-muted')} aria-hidden />
            <span>{ETIQUETA_FUNCIONALIDAD[f]}</span>
          </li>
        ))}
      </ul>
    </div>
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

/* ───────────── Planes de la cuenta y pago simulado ───────────── */

function PlanesCuenta({ org, esTitular, puedeContratar }: { org: Organizacion; esTitular: boolean; puedeContratar: boolean }) {
  const { tipo, enPrueba, accesoOperativo } = usePlanCuenta()
  const usuarios = useDB((s) => s.usuarios)
  const activa = org.suscripcionEstado === 'activa'
  return (
    <section className={TARJETA} aria-labelledby="h-planes" data-testid="planes-cuenta">
      <div className="flex flex-col gap-1">
        <h2 id="h-planes" className={TITULO}>
          <CreditCard size={22} className="text-navy" aria-hidden /> Planes de la cuenta {TIPO_CUENTA_LABEL[tipo]}
        </h2>
        <p className="text-sm text-muted">
          {activa
            ? 'Renueva tu plan o cámbiate a otro. El pago aprobado reemplaza al plan actual.'
            : enPrueba
              ? 'Elige un plan antes de que termine la prueba para no perder el acceso.'
              : 'Contrata un plan para recuperar el acceso a la cuenta.'}
        </p>
      </div>
      {!esTitular && (
        <Caja>
          Solo la persona titular puede contratar o pagar un plan
          {org.usuarioTitularId && <>: <strong>{nombreUsuario(usuarios, org.usuarioTitularId)}</strong></>}.
        </Caja>
      )}
      {!accesoOperativo && puedeContratar && <Caja tono="warning">Sin plan activo no se puede operar la cuenta. Elige uno para continuar.</Caja>}
      <ContratarPlan puedeContratar={puedeContratar} />
    </section>
  )
}

/* ───────────── Historial de pagos ───────────── */

function HistorialPagos({ org, puedeContratar }: { org: Organizacion; puedeContratar: boolean }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const pagos = useDB((s) => s.pagos)
  const catalogos = useDB((s) => s.catalogos)
  const usuarios = useDB((s) => s.usuarios)
  const [accion, setAccion] = useState<{ pago: Pago; estado: 'confirmado' | 'anulado' } | null>(null)

  const lista = useMemo(() => pagos.filter((p) => p.orgId === org.id).sort((a, b) => b.fecha.localeCompare(a.fecha)), [pagos, org.id])
  const metodo = (id: string) => catalogos.metodosPago.find((m) => m.id === id)?.nombre ?? id
  const nombrePlan = (id: string) => catalogos.planes.find((p) => p.id === id)?.nombre ?? id
  const totalConfirmado = lista.filter((p) => p.estado === 'confirmado').reduce((a, p) => a + p.monto, 0)
  const cerrar = () => setAccion(null)

  const aplicar = () => {
    if (!accion) return
    const r = cambiarEstadoPago(user, accion.pago.id, accion.estado)
    setAccion(null)
    if (!r.ok) return toast(r.error, 'error')
    toast(accion.estado === 'confirmado' ? 'Pago confirmado. La suscripción queda activa.' : 'Pago anulado')
  }

  return (
    <section className={TARJETA} aria-labelledby="h-pagos" data-testid="historial-pagos">
      <div className="flex flex-col gap-0.5">
        <h2 id="h-pagos" className={TITULO}>
          <Receipt size={22} className="text-navy" aria-hidden /> Historial de pagos
        </h2>
        <span className="text-sm text-muted">
          {lista.length} pago{lista.length === 1 ? '' : 's'} · confirmados: {formatoMonto(totalConfirmado)}
        </span>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay pagos registrados.</p>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="relative hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <caption className="sr-only">Pagos de la cuenta</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line-soft">
                  <th scope="col" className="py-2 pr-3 font-bold">Fecha</th>
                  <th scope="col" className="py-2 pr-3 font-bold text-right">Monto</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Método</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Plan</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Pagado por</th>
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
                    <td className="py-2">
                      {p.estado === 'registrado' && puedeContratar && <AccionesPago vertical pago={p} deshabilitado={!enLinea} onAccion={(estado) => setAccion({ pago: p, estado })} />}
                    </td>
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
                    <Dato etiqueta="Pagado por" valor={nombreUsuario(usuarios, p.usuarioId)} />
                  </div>
                </dl>
                {p.estado === 'registrado' && puedeContratar && <AccionesPago pago={p} deshabilitado={!enLinea} onAccion={(estado) => setAccion({ pago: p, estado })} />}
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet
        open={!!accion}
        onClose={cerrar}
        title={accion?.estado === 'confirmado' ? 'Confirmar pago' : 'Anular pago'}
        footer={
          <>
            <Button variant="light" onClick={cerrar}>
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
              ? `Confirmas el pago de ${formatoMonto(accion.pago.monto)} del ${fechaCorta(accion.pago.fecha)}. La suscripción quedará activa con el plan ${nombrePlan(accion.pago.planId)}.`
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
