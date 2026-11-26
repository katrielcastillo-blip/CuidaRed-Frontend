/* Inicio con datos del servidor y alcance del rol: indicadores, pendientes y casos prioritarios. © 2026 Equipo CuidaRed – INTEC. */
import { Link } from 'react-router-dom'
import { Icon } from '@/components/icons'
import type { IndicadoresResumen } from '../api/reportes'
import { Estado, idRuta, useDatos, usePagina } from './controles'
import { fechaDominicana } from './visitas-fechas'
import type { OperacionProps } from './visitas'

interface CasoPendiente {
  envejeciente_id: string; nombres: string; apellidos: string; total_alertas: number
  alertas: { descripcion?: string; tipo?: { nombre: string }; prioridad?: { nombre: string }; fecha_alerta?: string }[]
}
const formatoNumero = (n: number | undefined) => typeof n === 'number' ? n.toLocaleString('es-DO') : '—'

function Indicador({ valor, etiqueta, icono, tono = 'azul', destino, cargando }: {
  valor?: number; etiqueta: string; icono: string; tono?: 'azul' | 'alerta' | 'cuidado' | 'necesidad'; destino: string; cargando: boolean
}) {
  const colores = { azul: 'bg-blue-100 text-primary', alerta: 'bg-danger-100 text-danger', cuidado: 'bg-teal-100 text-success-700', necesidad: 'bg-warning-100 text-warning-700' }
  return <li className="min-w-0"><Link to={destino} className="grid h-full min-h-28 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-card border border-line-soft bg-white p-4 shadow-1 transition-colors hover:border-primary sm:p-5">
    <strong className="block min-w-0 font-display text-[1.875rem] leading-tight font-bold text-ink tabular-nums" aria-label={cargando ? 'Consultando' : undefined}>{cargando ? <span className="block h-8 w-12 rounded-sm bg-surface-2 motion-safe:animate-pulse" aria-hidden /> : formatoNumero(valor)}</strong>
    <span className={'grid size-10 shrink-0 place-items-center rounded-sm ' + colores[tono]}><Icon name={icono} /></span>
    <span className="col-span-2 block text-sm leading-snug text-muted wrap-anywhere">{etiqueta}</span>
  </Link></li>
}

function Pendiente({ destino, titulo, descripcion, cantidad, icono }: { destino: string; titulo: string; descripcion: string; cantidad?: number; icono: string }) {
  return <li><Link to={destino} className="flex min-h-24 items-center gap-[12px] px-[16px] py-3 transition-colors hover:bg-blue-100/40">
    <span className="grid size-[40px] shrink-0 place-items-center rounded-sm bg-blue-100 text-primary"><Icon name={icono} className="text-[24px]" /></span>
    <span className="min-w-0 flex-1"><strong className="block text-base font-semibold text-ink">{titulo}</strong><span className="mt-0.5 block text-sm text-muted">{descripcion}</span></span>
    <span className="grid min-h-[32px] min-w-[32px] shrink-0 place-items-center rounded-full bg-bg text-sm font-semibold text-ink tabular-nums">{formatoNumero(cantidad)}</span>
    <Icon name="chevron_right" size={20} className="text-[20px] text-muted" />
  </Link></li>
}

export function InicioOperativo({ base, token, cuenta, revision }: OperacionProps & { revision: number }) {
  const habilitado = cuenta.acceso_operativo === true
  const permite = (permiso: string) => habilitado && cuenta.permisos.includes(permiso)
  const resumen = permite('resumen:ver')
  const visitas = cuenta.tipo === 'organizacion' && permite('visitas:ver')
  const solicitudes = cuenta.tipo === 'organizacion' && permite('visitas:autorizar')
  const raiz = `/operacion/${idRuta(cuenta.cuenta_id)}`
  const indicadores = useDatos<IndicadoresResumen>(resumen ? base + '/resumen-casos/indicadores' : null, token, revision)
  const adultos = usePagina<unknown>(!resumen && permite('adultos:ver') ? base + '/envejecientes' : null, token, revision, { limit: 1, filters: { estado: 'activo' } })
  const necesidades = usePagina<unknown>(!resumen && permite('necesidades:ver') ? base + '/necesidades' : null, token, revision, { limit: 1, filters: { estado: 'pendiente' } })
  const citas = usePagina<unknown>(visitas ? base + '/visitas' : null, token, revision, { limit: 1, filters: { desde: fechaDominicana(), hasta: fechaDominicana(), estado: 'programada' } })
  const peticiones = usePagina<unknown>(solicitudes ? base + '/solicitudes-visita' : null, token, revision, { limit: 1, filters: { estado: 'pendiente' } })
  const casos = usePagina<CasoPendiente>(permite('alertas:ver') ? base + '/casos-prioritarios' : null, token, revision, { limit: 2 })
  const datos = indicadores.datos
  const alguna = resumen || permite('adultos:ver') || permite('necesidades:ver') || visitas
  const pendientesVisita = cuenta.tipo === 'organizacion' && typeof datos?.umbral_dias_sin_visita === 'number'
  if (!habilitado || !alguna) return null

  return <div className="grid min-w-0 gap-7" aria-label="Inicio operativo">
    <section aria-labelledby="resumen-de-hoy" className="grid gap-3">
      <h2 id="resumen-de-hoy" className="text-lg font-semibold text-ink">Resumen de hoy</h2>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3" aria-label="Indicadores de hoy">
        {resumen && permite('alertas:ver') && <Indicador etiqueta="Alertas abiertas" valor={datos?.alertas_abiertas} cargando={!datos && !indicadores.error} icono="notifications_active" tono="alerta" destino={raiz + '/alertas?bandeja=alertas'} />}
        {permite('adultos:ver') && <Indicador etiqueta="Envejecientes activos" valor={resumen ? datos?.casos_activos : adultos.datos?.meta.total} cargando={resumen ? !datos && !indicadores.error : !adultos.datos && !adultos.error} icono="elderly" destino={raiz + '/envejecientes'} />}
        {permite('necesidades:ver') && <Indicador etiqueta={resumen ? 'Necesidades activas' : 'Necesidades pendientes'} valor={resumen ? datos?.necesidades_activas : necesidades.datos?.meta.total} cargando={resumen ? !datos && !indicadores.error : !necesidades.datos && !necesidades.error} icono="volunteer_activism" tono="necesidad" destino={raiz + '/necesidades'} />}
        {visitas && <Indicador etiqueta="Visitas programadas hoy" valor={citas.datos?.meta.total} cargando={!citas.datos && !citas.error} icono="event_available" tono="cuidado" destino={raiz + '/visitas'} />}
      </ul>
      {resumen && (indicadores.error || indicadores.sinConexion) && <Estado consulta={indicadores} />}
      {!resumen && permite('adultos:ver') && (adultos.error || adultos.sinConexion) && <Estado consulta={adultos} />}
      {!resumen && permite('necesidades:ver') && necesidades.error && <Estado consulta={necesidades} />}
      {visitas && citas.error && <Estado consulta={citas} />}
      {datos?.fecha_calculo && <p className="text-sm text-muted">Datos al {new Intl.DateTimeFormat('es-DO', { dateStyle: 'short', timeZone: 'America/Santo_Domingo' }).format(new Date(datos.fecha_calculo + 'T12:00:00-04:00'))}.</p>}
    </section>

    <div className="grid min-w-0 items-start gap-7 lg:grid-cols-2">
      {(pendientesVisita || solicitudes) && <section aria-labelledby="otros-pendientes" className="grid gap-3">
        <h2 id="otros-pendientes" className="text-lg font-semibold text-ink">Otros pendientes</h2>
        <ul className="divide-y divide-line-soft overflow-hidden rounded-card border border-line-soft bg-white shadow-1">
          {pendientesVisita && <Pendiente destino={raiz + '/resumen'} titulo="Sin visita reciente" descripcion={`Más de ${datos.umbral_dias_sin_visita} días sin contacto`} cantidad={datos.seguimiento_vencido} icono="schedule" />}
          {solicitudes && <Pendiente destino={raiz + '/visitas?accion=solicitudes'} titulo="Solicitudes de visita" descripcion="Esperan tu revisión" cantidad={peticiones.datos?.meta.total} icono="inbox" />}
        </ul>
        {solicitudes && peticiones.error && <Estado consulta={peticiones} />}
      </section>}
      {permite('alertas:ver') && <section aria-labelledby="alertas-inicio" className="grid gap-3">
        <header className="flex flex-wrap items-center justify-between gap-x-2"><h2 id="alertas-inicio" className="text-lg font-semibold text-ink">Casos prioritarios</h2><Link to={raiz + '/alertas'} className="inline-flex min-h-12 items-center text-sm font-semibold text-navy underline underline-offset-4">Ver todos</Link></header>
        <Estado consulta={casos} />
        {casos.datos && <ul className="divide-y divide-line-soft overflow-hidden rounded-card border border-line-soft bg-white shadow-1">
          {casos.datos.data.map(caso => <li key={caso.envejeciente_id}><Link to={raiz + '/alertas?bandeja=alertas&adulto=' + idRuta(caso.envejeciente_id)} className="flex min-h-28 items-start gap-3 p-4 hover:bg-blue-100/30">
            <Icon name="error" size={20} className="mt-1 text-danger" />
            <div className="min-w-0 flex-1"><strong className="block font-semibold text-ink">{caso.nombres} {caso.apellidos}</strong><p className="mt-1 text-sm text-muted">{caso.alertas[0]?.descripcion || caso.alertas[0]?.tipo?.nombre || 'Requiere seguimiento del equipo.'}</p><p className="mt-1 text-sm text-muted">{caso.total_alertas} {caso.total_alertas === 1 ? 'alerta abierta' : 'alertas abiertas'}</p></div><Icon name="chevron_right" size={20} className="self-center text-muted" />
          </Link></li>)}
          {casos.datos.data.length === 0 && <li className="p-5 text-sm text-muted">No hay casos prioritarios abiertos en tu alcance.</li>}
        </ul>}
      </section>}
    </div>
  </div>
}
