/*
 * suscripcion.tsx — Estado de la cuenta, planes compatibles y pagos de prueba.
 * Módulo: access-real · ID08, RF-20.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Check, RefreshCw } from '@/components/icons'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, ChoicePills, Sheet, type Tone } from '@/components/ui'
import { ETIQUETA_FUNCIONALIDAD } from '@/domain/planes'
import { cancelarRenovacion, cambiarPlan, iniciarCheckoutSuscripcion, rutaSuscripcion, solicitarCotizacion, type CotizacionSuscripcion, type GestionSuscripcion, type OfertaSuscripcion, type PagoSuscripcion, type PlanCatalogoSuscripcion } from '../api/suscripcion'
import { ApiError, type CuentaMe } from '../client'
import { suscripcionTexto } from '../cuentas-datos'
import { mensajeDeError } from '../errores'
import { Estado, Paginador, useConexionReal, useDatos, usePagina } from './controles'

const formatearFecha = new Intl.DateTimeFormat('es-DO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Santo_Domingo' })
const fecha = (valor: string) => formatearFecha.format(new Date(valor))
function monto(unidadesMenores: number, moneda: string) {
  const codigo = moneda.toUpperCase()
  const formato = new Intl.NumberFormat('es-DO', { style: 'currency', currency: codigo, currencyDisplay: 'code' })
  // Stripe recibe dos decimales para ISK y UGX por compatibilidad, aunque los precios se muestran sin decimales.
  const digitos = codigo === 'ISK' || codigo === 'UGX' ? 2 : (formato.resolvedOptions().maximumFractionDigits ?? 2)
  return formato.format(unidadesMenores / (10 ** digitos))
}
const periodo = (plan: Pick<OfertaSuscripcion, 'periodicidad'>) => plan.periodicidad === 'mensual' ? 'mes' : 'año'
const capacidad = (limite: number | null, grupo: string) => limite === null ? `${grupo} sin límite` : `Hasta ${limite} ${grupo.toLowerCase()}`
const CODIGO_AVANZADA = 'gestion_comunitaria_avanzada'

function CuposCotizados({ limites, titulo = 'Cupos de la cotización' }: { limites: OfertaSuscripcion['limites']; titulo?: string }) {
  return <div className="grid gap-1 rounded-sm border border-line-soft bg-surface p-3">
    <p className="text-sm font-semibold text-ink">{titulo}</p>
    <ul aria-label={titulo} className="grid gap-1 text-sm text-ink-2">
      <li>{capacidad(limites.envejecientes, 'Adultos mayores')}</li>
      <li>{capacidad(limites.usuarios, 'Integrantes del equipo')}</li>
      {limites.cuidadores !== undefined && <li>{capacidad(limites.cuidadores, 'Cuidadores')}</li>}
      <li>{capacidad(limites.familiares, 'Familiares')}</li>
    </ul>
  </div>
}

function DatoSuscripcion({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return <div className="grid min-w-0 gap-0.5">
    <dt className="text-xs text-ink-2">{etiqueta}</dt>
    <dd className="wrap-anywhere font-semibold text-ink">{valor}</dd>
  </div>
}

type Accion =
  | { tipo: 'checkout'; oferta: OfertaSuscripcion }
  | { tipo: 'cambio'; oferta: OfertaSuscripcion }
  | { tipo: 'cancelacion' }
  | { tipo: 'cotizacion'; codigo: string }
type Confirmacion = { tipo: 'cambio'; oferta: OfertaSuscripcion; retomar: boolean } | { tipo: 'cancelacion' }
type AvisoPlan = { codigo: string; texto: string; error?: boolean }

const estadoPago: Record<PagoSuscripcion['estado'], { texto: string; tono: Tone }> = {
  pendiente: { texto: 'Pendiente', tono: 'warning' },
  completado: { texto: 'Completado', tono: 'success' },
  fallido: { texto: 'Fallido', tono: 'danger' },
  reembolsado: { texto: 'Reembolsado', tono: 'neutral' },
}

const estadoCotizacion: Record<Exclude<CotizacionSuscripcion['estado'], 'sin_cotizar'>, { texto: string; tono: Tone }> = {
  solicitada: { texto: 'En revisión', tono: 'warning' },
  cotizada: { texto: 'Cotización disponible', tono: 'success' },
}

const TARJETA = 'grid min-w-0 gap-3 rounded-md border border-line-soft bg-surface p-4 sm:p-5'
const TITULO = 'text-lg font-semibold text-ink'

const CICLOS: { value: OfertaSuscripcion['periodicidad']; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
]

const descripciones: Record<string, string> = {
  basico_familiar: 'Organiza el cuidado diario y coordina a quienes ayudan en casa.',
  cuidado_integral: 'Coordina a toda la familia y sigue la evolución del cuidado con alertas y métricas.',
  operacion_base: 'Centraliza las visitas, las necesidades y los avisos de tu equipo.',
  gestion_comunitaria_avanzada: 'Amplía la cobertura de tu organización y usa reportes para dar seguimiento a más casos.',
}

type OpcionesPlan = {
  gestion: GestionSuscripcion
  cotizaciones: CotizacionSuscripcion[]
  titular: boolean
  enLinea: boolean
  ocupada?: string
  avisoPlan?: AvisoPlan
  consultandoCotizaciones: boolean
  solicitar: (codigo: string) => void
  accionesOferta: (oferta: OfertaSuscripcion) => ReactNode
}

const beneficiosLegibles = {
  ...ETIQUETA_FUNCIONALIDAD,
  dashboard_metricas: 'Panel de métricas',
  historial_inmutable: 'Historial protegido contra cambios',
  reportes_avanzados: 'Análisis avanzado y exportación a Excel',
}

function TarjetaPlan({ plan, tipo, gestion, cotizaciones, titular, enLinea, ocupada, avisoPlan, consultandoCotizaciones, solicitar, accionesOferta }: OpcionesPlan & {
  plan: PlanCatalogoSuscripcion
  tipo: CuentaMe['tipo']
}) {
  const [cicloElegido, elegirCiclo] = useState<OfertaSuscripcion['periodicidad']>()
  const cotizado = plan.cotizado ?? plan.codigo === CODIGO_AVANZADA
  const variantes = CICLOS.map(({ value }) => {
    const codigo = `${plan.codigo}_${value}`
    const opciones = gestion.ofertas.filter((oferta) => oferta.codigo === codigo)
    return {
      codigo,
      periodicidad: value,
      oferta: opciones.find((oferta) => oferta.en_curso) ?? opciones.find((oferta) => oferta.publicada !== false) ?? opciones.find((oferta) => oferta.actual),
      cotizacion: cotizado ? cotizaciones.find((opcion) => opcion.codigo === codigo) : undefined,
    }
  })
  const actual = gestion.ofertas.find((oferta) => oferta.actual && variantes.some(({ codigo }) => codigo === oferta.codigo))
  const preferida = variantes.find(({ codigo }) => codigo === gestion.checkout_en_curso || codigo === gestion.cambio_en_curso?.codigo)
    ?? variantes.find((variante) => variante.periodicidad === actual?.periodicidad)
    ?? variantes.find(({ oferta, cotizacion }) => oferta || cotizacion?.estado === 'cotizada')
    ?? variantes.find(({ cotizacion }) => cotizacion?.estado === 'solicitada')
    ?? variantes[0]!
  const { oferta, cotizacion, periodicidad } = variantes.find((opcion) => opcion.periodicidad === cicloElegido) ?? preferida
  // El precio de un trámite abierto pertenece a su versión, aunque ya se haya publicado otra.
  const pagoEnCurso = oferta && gestion.checkout_en_curso === oferta.codigo
  const cambioEnCurso = oferta && gestion.cambio_en_curso?.codigo === oferta.codigo
  const estado = !pagoEnCurso && !cambioEnCurso && cotizacion && cotizacion.estado !== 'sin_cotizar'
    && (!oferta || (oferta.version ?? null) === (cotizacion.version ?? null))
    ? estadoCotizacion[cotizacion.estado] : undefined
  const precio = oferta?.importe_centavos ?? cotizacion?.importe_centavos ?? plan.precios_referencia?.[periodicidad]
  const limites = plan.limites
  const cupos = cotizado ? oferta?.limites ?? cotizacion?.limites : undefined
  const beneficios = [
    ...(!cotizado ? [capacidad(limites.envejecientes, 'Adultos mayores')] : []),
    ...(cotizado ? [] : tipo === 'familia'
      ? [
          capacidad(limites.familiares, 'Familiares'),
          capacidad(limites.cuidadores, 'Cuidadores'),
          ...(limites.usuarios === null ? [] : [capacidad(limites.usuarios, 'Miembros del equipo')]),
        ]
      : [capacidad(limites.usuarios, 'Miembros del equipo')]),
    ...plan.funcionalidades.flatMap((codigo) =>
      Object.hasOwn(beneficiosLegibles, codigo) ? [beneficiosLegibles[codigo as keyof typeof beneficiosLegibles]] : []),
  ]
  const titulo = `plan-${plan.codigo}`
  const varianteAviso = variantes.find(({ codigo }) => codigo === avisoPlan?.codigo)

  return <article aria-labelledby={titulo} className="flex h-full min-w-0 flex-col gap-4 rounded-md border border-line-soft bg-surface p-4 sm:p-5">
    <div className="grid min-w-0 gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={titulo} className="wrap-anywhere text-lg font-semibold text-navy">{plan.nombre}</h3>
        {actual && <Badge tone="info">Plan actual</Badge>}
      </div>
      {descripciones[plan.codigo] && <p className="text-sm text-ink-2">{descripciones[plan.codigo]}</p>}
    </div>
    <ul className="grid gap-2 text-sm text-ink">
      {beneficios.map((beneficio) => <li key={beneficio} className="flex items-start gap-2">
        <Check aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-navy" />
        <span>{beneficio}</span>
      </li>)}
    </ul>
    <div className="mt-auto grid gap-3 rounded-sm border border-line-soft bg-surface-2 p-3">
      <ChoicePills label="Periodicidad" options={CICLOS} value={periodicidad} onChange={elegirCiclo} />
      <div className="grid gap-1" aria-live="polite">
        {pagoEnCurso && <div><Badge tone="warning">Pago iniciado</Badge></div>}
        {cambioEnCurso && <div><Badge tone="warning">Cambio en curso</Badge></div>}
        {estado && <div><Badge tone={estado.tono}>{estado.texto}</Badge></div>}
        {precio === undefined
          ? <p className="text-sm font-semibold text-navy">{cotizacion?.estado === 'solicitada'
            ? 'Verás el precio y los cupos cuando publiquen la cotización.'
            : cotizado ? 'Precio y cupos por cotización' : 'Tarifa pendiente de publicación'}</p>
          : <p className="wrap-anywhere text-lg font-bold text-navy">{monto(precio, oferta?.moneda ?? cotizacion?.moneda ?? 'USD')} por {periodo({ periodicidad })}</p>}
        {!oferta && plan.precios_referencia && <p className="text-sm text-ink-2">Precio de referencia, pendiente de publicación.</p>}
        {actual && actual.periodicidad !== periodicidad && <p className="text-sm text-ink-2">
          Facturación actual: {actual.periodicidad}.
        </p>}
        {actual && oferta && !oferta.actual && !oferta.en_curso && actual.periodicidad === periodicidad && <p className="text-sm text-ink-2">
          Esta es una nueva oferta. Consulta las condiciones vigentes en el estado de la suscripción.
        </p>}
      </div>
      {cupos && <CuposCotizados limites={cupos} titulo={oferta?.actual ? 'Cupos contratados' : pagoEnCurso ? 'Cupos del pago iniciado' : undefined} />}
      {oferta && accionesOferta(oferta)}
      {titular && !oferta && cotizacion?.estado === 'sin_cotizar' && <Button size="sm" variant="outline"
        className="w-full sm:w-fit" loading={ocupada === `cotizacion:${cotizacion.codigo}`} disabled={!enLinea || !!ocupada || consultandoCotizaciones}
        aria-label={`Solicitar cotización para ${plan.nombre} (${periodicidad})`}
        onClick={() => solicitar(cotizacion.codigo)}>Solicitar cotización</Button>}
      {avisoPlan && varianteAviso && <p role={avisoPlan.error ? 'alert' : 'status'}
        className={avisoPlan.error ? 'rounded-sm bg-danger-100 p-2 text-sm text-danger-700' : 'rounded-sm bg-info-100 p-2 text-sm text-ink'}>
        {varianteAviso.periodicidad !== periodicidad && <strong>{varianteAviso.periodicidad === 'mensual' ? 'Mensual. ' : 'Anual. '}</strong>}
        {avisoPlan.texto}
      </p>}
    </div>
  </article>
}

function PlanesCuenta({ catalogo, consultaCotizaciones, tipo, consultarPlanes, consultandoPlanes, ...opciones }: Omit<OpcionesPlan, 'cotizaciones'> & {
  catalogo: ReturnType<typeof useDatos<PlanCatalogoSuscripcion[]>>
  consultaCotizaciones: ReturnType<typeof useDatos<{ cotizaciones: CotizacionSuscripcion[] }>>
  tipo: CuentaMe['tipo']
  consultarPlanes: () => void
  consultandoPlanes: boolean
}) {
  const organizacion = tipo === 'organizacion'
  return <section aria-labelledby="planes-suscripcion" className="grid min-w-0 gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="planes-suscripcion" className={TITULO}>{organizacion ? 'Planes para tu organización' : 'Planes para tu familia'}</h2>
      <Button size="sm" variant="outline" icon={<RefreshCw size={16} aria-hidden />} loading={consultandoPlanes}
        disabled={!opciones.enLinea || !!opciones.ocupada} onClick={consultarPlanes}>Actualizar planes</Button>
    </div>
    {organizacion && <p className="text-sm text-ink-2">Contrata Operación Base con tarifa publicada o solicita una cotización de Gestión Comunitaria Avanzada con cupos para tu organización.</p>}
    {!opciones.enLinea && <p role="status" className="rounded-sm bg-warning-100 p-3 text-sm text-ink">Conéctate a Internet para actualizar planes, solicitar una cotización o gestionar pagos.</p>}
    {!opciones.titular && <p className="text-sm text-ink-2">Solo la persona titular puede gestionar la contratación.</p>}
    {opciones.titular && !opciones.gestion.pagos_disponibles && <p role="status" className="rounded-md bg-warning-100 p-3 text-sm text-ink">
      Los pagos de prueba no están disponibles ahora.
    </p>}
    <Estado consulta={catalogo} vacio={catalogo.datos?.length === 0 ? 'No hay planes activos para esta cuenta.' : undefined} />
    {organizacion && <Estado consulta={consultaCotizaciones} />}
    <ul className="grid gap-3 sm:grid-cols-2">
      {catalogo.datos?.map((plan) => <li key={plan.codigo} className="min-w-0">
        <TarjetaPlan {...opciones} plan={plan} tipo={tipo} cotizaciones={consultaCotizaciones.datos?.cotizaciones ?? []} />
      </li>)}
    </ul>
  </section>
}

function HistorialPagos({ ruta, token, revision }: { ruta: string; token: string; revision: number }) {
  const pagos = usePagina<PagoSuscripcion>(ruta, token, revision)
  return <section aria-labelledby="historial-pagos" className={TARJETA}>
    <h2 id="historial-pagos" className={TITULO}>Historial de pagos</h2>
    <Estado consulta={pagos} vacio={pagos.datos?.data.length === 0 ? 'Aún no hay pagos de prueba registrados.' : undefined} />
    {pagos.datos && pagos.datos.data.length > 0 && <ul className="divide-y divide-line-soft">
      {pagos.datos.data.map((pago) => <li key={pago.pago_id} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="break-words font-semibold text-ink">{pago.plan}</p>
          <p className="text-sm text-ink-2">
            <time dateTime={pago.fecha}>{fecha(pago.fecha)}</time> · {pago.periodicidad}
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-ink">{monto(pago.importe_centavos, pago.moneda)}</p>
          {pago.importe_reembolsado_centavos > 0 && <p className="text-sm text-ink-2">Reembolso {monto(pago.importe_reembolsado_centavos, pago.moneda)}</p>}
        </div>
        <div><Badge tone={estadoPago[pago.estado].tono}>{estadoPago[pago.estado].texto}</Badge></div>
      </li>)}
    </ul>}
    <Paginador pagina={pagos.pagina} total={pagos.datos?.meta.totalPages ?? 0} cambiar={pagos.cambiar} />
  </section>
}

function condicionesCambio(oferta: OfertaSuscripcion, actual?: OfertaSuscripcion) {
  if (!actual) return 'Stripe confirmará cuándo se aplica el cambio. Si el cambio es inmediato, Stripe calcula el cargo proporcional al tiempo que queda del período.'
  if (actual.periodicidad === oferta.periodicidad && oferta.importe_centavos > actual.importe_centavos) {
    return 'Stripe calcula el cargo proporcional al tiempo que queda del período. El nuevo plan se aplica cuando CuidaRed verifica el pago.'
  }
  return 'El nuevo plan se aplicará en el próximo corte. Hasta entonces conservarás el plan del período actual.'
}

export function SuscripcionCuenta({ base, token, cuenta, actualizarContexto }: {
  base: string; token: string; cuenta: CuentaMe; actualizarContexto: () => void
}) {
  const [parametros] = useSearchParams()
  const retorno = parametros.get('checkout')
  const enLinea = useConexionReal()
  const [revision, revisar] = useState(0)
  const [ocupada, setOcupada] = useState<string>()
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [avisoPlan, setAvisoPlan] = useState<AvisoPlan>()
  const [revisionSolicitada, setRevisionSolicitada] = useState<number>()
  const [confirmacion, setConfirmacion] = useState<Confirmacion>()
  const enCurso = useRef(false)
  const vigente = useRef(false)
  const ruta = rutaSuscripcion(base)
  const consulta = useDatos<GestionSuscripcion>(`${ruta}/gestion`, token, revision)
  const catalogo = useDatos<PlanCatalogoSuscripcion[]>(`${ruta}/catalogo`, token, revision)
  const cotizaciones = useDatos<{ cotizaciones: CotizacionSuscripcion[] }>(
    cuenta.tipo === 'organizacion' ? `${ruta}/cotizaciones` : null, token, revision,
  )
  const gestion = consulta.datos
  const actualizar = useCallback(() => {
    revisar((n) => n + 1)
    actualizarContexto()
  }, [actualizarContexto])
  const cerrar = useCallback(() => {
    if (!enCurso.current) {
      setConfirmacion(undefined)
      setError('')
    }
  }, [])

  useEffect(() => {
    vigente.current = true
    return () => { vigente.current = false }
  }, [])

  useEffect(() => {
    if (!enLinea) return
    const refrescar = () => {
      if (document.visibilityState === 'visible') revisar((n) => n + 1)
    }
    document.addEventListener('visibilitychange', refrescar)
    const reloj = window.setInterval(refrescar, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', refrescar)
      window.clearInterval(reloj)
    }
  }, [enLinea])

  const cambio = gestion?.cambio_en_curso
  const esperandoPago = retorno === 'retorno' && (
    !gestion?.suscripcion_stripe || gestion.estado !== 'activa' || !!gestion.checkout_en_curso || cambio?.modo === 'inmediato'
  )
  const conciliacionPendiente = esperandoPago || cambio?.modo === 'inmediato'
  useEffect(() => {
    if (!conciliacionPendiente || !enLinea) return
    let consultas = 0
    const reloj = window.setInterval(() => {
      actualizar()
      if (++consultas === 6) window.clearInterval(reloj)
    }, 5_000)
    return () => window.clearInterval(reloj)
  }, [actualizar, conciliacionPendiente, enLinea])

  const titular = cuenta.es_titular === true && gestion?.es_titular === true
  const pagosDisponibles = titular && gestion?.sandbox === true && gestion.pagos_disponibles
  const modificar = pagosDisponibles && gestion.puede_modificar
  const modificarPlan = modificar && gestion.estado === 'activa' && gestion.acceso_operativo && !gestion.cancelacion_programada
  const consultandoGestion = consulta.revisionConsultada !== revision
  const consultandoCotizaciones = cuenta.tipo === 'organizacion' && cotizaciones.revisionConsultada !== revision
  const consultandoPlanes = consultandoGestion || catalogo.revisionConsultada !== revision || consultandoCotizaciones
  const confirmarAccion = confirmacion?.tipo === 'cambio' ? modificarPlan : modificar && !gestion.cancelacion_programada
  const actual = gestion?.ofertas.find((oferta) => oferta.actual)
  const revisando = revisionSolicitada !== undefined && (consulta.revisionConsultada ?? -1) < revisionSolicitada
  const ejecutar = async (accion: Accion) => {
    if (!enLinea || enCurso.current || consultandoGestion || (accion.tipo === 'cotizacion' && consultandoCotizaciones)) return
    enCurso.current = true
    const codigo = accion.tipo === 'cotizacion' ? accion.codigo : accion.tipo !== 'cancelacion' ? accion.oferta.codigo : undefined
    const identificador = accion.tipo === 'cotizacion' ? `cotizacion:${accion.codigo}`
      : accion.tipo === 'checkout' ? accion.oferta.codigo : accion.tipo
    setOcupada(identificador)
    setError('')
    setAviso('')
    setAvisoPlan(undefined)
    let destino: string | null = null
    let mensaje = ''
    try {
      if (accion.tipo === 'checkout') {
        destino = await iniciarCheckoutSuscripcion(base, token, accion.oferta.codigo, accion.oferta.version)
      } else if (accion.tipo === 'cambio') {
        const respuesta = await cambiarPlan(base, token, accion.oferta.codigo, accion.oferta.version)
        destino = respuesta.url
        mensaje = respuesta.modo === 'proximo_corte'
          ? 'Solicitaste el cambio para el próximo corte.'
          : 'Solicitaste el cambio de plan. Consulta el estado cuando Stripe confirme el pago.'
      } else if (accion.tipo === 'cancelacion') {
        await cancelarRenovacion(base, token)
        mensaje = 'Solicitaste la cancelación de la renovación. La cuenta conserva el acceso durante el período pagado.'
      } else {
        await solicitarCotizacion(base, token, accion.codigo)
        mensaje = 'Solicitud de cotización enviada. Puedes revisar su estado aquí.'
      }
      if (!vigente.current) return
      if (destino) {
        window.location.assign(destino)
      } else {
        if (accion.tipo === 'cotizacion') setAvisoPlan({ codigo: accion.codigo, texto: mensaje })
        else setAviso(mensaje)
        setConfirmacion(undefined)
        actualizar()
      }
    } catch (issue) {
      if (vigente.current) {
        const ofertaActualizada = issue instanceof ApiError && issue.code === 'QUOTE_UPDATED'
        if (issue instanceof ApiError && issue.status === 409) {
          actualizar()
        }
        const texto = issue instanceof ApiError ? mensajeDeError(issue)
          : accion.tipo === 'checkout' || accion.tipo === 'cambio' ? 'No se pudo abrir Stripe. Intenta de nuevo.'
            : 'No se pudo completar la solicitud. Intenta de nuevo.'
        if (ofertaActualizada) setConfirmacion(undefined)
        if (codigo && (accion.tipo !== 'cambio' || ofertaActualizada)) setAvisoPlan({ codigo, texto, error: true })
        else setError(texto)
      }
    } finally {
      enCurso.current = false
      if (vigente.current) setOcupada(undefined)
    }
  }

  const accionesOferta = (oferta: OfertaSuscripcion) => {
    const retomar = gestion?.checkout_en_curso === oferta.codigo
    const retomarCambio = cambio?.modo === 'inmediato' && cambio.codigo === oferta.codigo
    const contratar = pagosDisponibles && (retomar || (oferta.publicada !== false && !gestion.suscripcion_stripe && !gestion.checkout_en_curso))
    return <>
      {contratar && <Button size="sm" className="w-full sm:w-fit" disabled={!enLinea || !!ocupada || consultandoGestion}
        loading={ocupada === oferta.codigo}
        aria-label={retomar ? `Retomar pago de prueba de ${oferta.nombre} (${oferta.periodicidad})` : `Elegir ${oferta.nombre} (${oferta.periodicidad})`}
        onClick={() => void ejecutar({ tipo: 'checkout', oferta })}>
        {retomar ? 'Retomar pago de prueba' : 'Elegir plan'}
      </Button>}
      {retomar && <p className="text-sm text-ink-2">Stripe muestra el importe del pago que iniciaste.</p>}
      {modificarPlan && !retomar && !oferta.actual && (retomarCambio || (!cambio && oferta.publicada !== false)) && <Button size="sm" variant="outline"
        className="w-full sm:w-fit" disabled={!enLinea || !!ocupada || consultandoGestion}
        aria-label={`${retomarCambio ? 'Retomar cambio a' : 'Cambiar a'} ${oferta.nombre} (${oferta.periodicidad})`}
        onClick={() => { setError(''); setConfirmacion({ tipo: 'cambio', oferta, retomar: retomarCambio }) }}>
        {retomarCambio ? 'Retomar cambio de plan' : 'Cambiar a este plan'}
      </Button>}
    </>
  }

  return <>
    <section aria-labelledby="estado-suscripcion" className={TARJETA}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="estado-suscripcion" className={TITULO}>Estado de la suscripción</h2>
        <Badge tone="info">Stripe Sandbox</Badge>
      </div>
      {gestion?.pagos_disponibles && <p className="text-sm text-ink-2">Stripe procesa únicamente pagos de prueba.</p>}
      {retorno === 'retorno' && <p role="status" className="rounded-md bg-info-100 p-3 text-ink">
        {esperandoPago ? 'Volviste de Stripe. El estado y el historial se actualizan cuando CuidaRed recibe la confirmación del pago.' : 'Volviste de Stripe. Consulta los pagos confirmados en el historial.'}
      </p>}
      {retorno === 'cancelado' && <p role="status" className="rounded-md bg-surface-2 p-3 text-ink">
        Saliste de la pantalla de pago. Si el pago sigue abierto, puedes retomarlo desde la tarjeta del plan.
      </p>}
      {aviso && <p role="status" className="rounded-md bg-info-100 p-3 text-ink">{aviso}</p>}
      {error && !confirmacion && <p role="alert" className="rounded-md bg-danger-100 p-3 text-danger-700">{error}</p>}
      <Estado consulta={consulta} />
      {gestion && <dl className="grid gap-3 min-[360px]:grid-cols-2">
        <DatoSuscripcion etiqueta="Estado" valor={suscripcionTexto(gestion.estado)} />
        <DatoSuscripcion etiqueta="Acceso a la plataforma" valor={gestion.acceso_operativo ? 'Operativo' : 'Limitado a la cuenta'} />
        {actual && <DatoSuscripcion etiqueta="Plan contratado" valor={`${actual.nombre} · ${monto(actual.importe_centavos, actual.moneda)} por ${periodo(actual)}`} />}
        {gestion.vigencia_hasta && <DatoSuscripcion etiqueta="Vigente hasta" valor={fecha(gestion.vigencia_hasta)} />}
        {gestion.cancelacion_programada && <DatoSuscripcion etiqueta="Renovación" valor="Cancelación programada" />}
      </dl>}
      {actual?.codigo.startsWith(`${CODIGO_AVANZADA}_`) && <CuposCotizados limites={actual.limites} titulo="Cupos contratados" />}
      {cambio && <p role="status" className="rounded-md bg-info-100 p-3 text-ink">
        {cambio.modo === 'proximo_corte' && cambio.efectivo_en
          ? `Cambio programado para el ${fecha(cambio.efectivo_en)}.`
          : 'El cambio de plan está en revisión.'}
      </p>}
      {revisionSolicitada !== undefined && !consulta.error && !revisando && <p className="text-sm text-ink-2" role="status">
        {conciliacionPendiente ? 'Estado consultado. Todavía esperamos la confirmación de Stripe.' : 'Estado consultado.'}
      </p>}
      {gestion && (conciliacionPendiente || (modificar && !gestion.cancelacion_programada)) && <div className="flex flex-wrap gap-2">
        {conciliacionPendiente && <Button size="sm" variant="outline" disabled={!enLinea || revisando} loading={revisando}
          onClick={() => { setRevisionSolicitada(revision + 1); actualizar() }}>
          {revisando ? 'Consultando…' : 'Consultar estado del pago'}
        </Button>}
        {modificar && !gestion.cancelacion_programada && <Button size="sm" variant="outline" disabled={!enLinea || !!ocupada || consultandoGestion}
          onClick={() => { setError(''); setConfirmacion({ tipo: 'cancelacion' }) }}>Cancelar renovación</Button>}
      </div>}
    </section>

    {gestion && <PlanesCuenta tipo={cuenta.tipo} gestion={gestion} catalogo={catalogo} consultaCotizaciones={cotizaciones}
      titular={titular} enLinea={enLinea} ocupada={ocupada} avisoPlan={avisoPlan} accionesOferta={accionesOferta}
      consultarPlanes={actualizar} consultandoPlanes={consultandoPlanes} consultandoCotizaciones={consultandoGestion || consultandoCotizaciones}
      solicitar={(codigo) => void ejecutar({ tipo: 'cotizacion', codigo })} />}
    <HistorialPagos ruta={`${ruta}/pagos`} token={token} revision={revision} />

    <Sheet open={!!confirmacion} onClose={cerrar} title={confirmacion?.tipo === 'cambio' ? 'Cambiar plan de prueba' : 'Cancelar renovación'}
      footer={<>
        <Button size="sm" variant="outline" disabled={!!ocupada} onClick={cerrar}>Volver</Button>
        <Button size="sm" variant={confirmacion?.tipo === 'cancelacion' ? 'danger' : 'primary'}
          loading={!!ocupada} disabled={!enLinea || !confirmarAccion || consultandoGestion}
          onClick={() => { if (confirmacion && confirmarAccion) void ejecutar(confirmacion) }}>Confirmar</Button>
      </>}>
      {confirmacion?.tipo === 'cambio' && <>
        <p className="font-semibold text-ink">{confirmacion.oferta.nombre} · {monto(confirmacion.oferta.importe_centavos, confirmacion.oferta.moneda)} por {periodo(confirmacion.oferta)}</p>
        {confirmacion.oferta.codigo.startsWith(`${CODIGO_AVANZADA}_`) && <CuposCotizados limites={confirmacion.oferta.limites} />}
        <p className="text-sm text-ink-2">{confirmacion.retomar
          ? 'Se abrirá la factura de prueba en Stripe si el pago todavía necesita confirmación.'
          : condicionesCambio(confirmacion.oferta, actual)}</p>
      </>}
      {confirmacion?.tipo === 'cancelacion' && <p className="text-sm text-ink-2">La cuenta conserva el acceso hasta el final del período pagado. Después se limitará el acceso a la cuenta y a su suscripción.</p>}
      {error && confirmacion && <p role="alert" className="rounded-md bg-danger-100 p-3 text-danger-700">{error}</p>}
    </Sheet>
  </>
}
