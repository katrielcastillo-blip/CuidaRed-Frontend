/*
 * SolicitudesPage.tsx — Solicitudes de visita de personas externas (visitantes) de la cuenta: las pendientes de
 * autorizar primero, filtro por estado y tarjetas con visitante, fecha propuesta, a quién quiere visitar (texto que
 * escribió) y estado. Solo para quien tiene visitas:autorizar (Administrador, o Coordinador en una cuenta Familia).
 * Módulo: coordinador · solicitudes de visita.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Info } from 'lucide-react'
import { Chip, EmptyState } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { SolicitudCard } from './components/SolicitudCard'
import { ESTADOS_SOLICITUD, FILTRO_SOLICITUD, useSolicitudes, type EstadoSolicitud } from './lib/solicitudes'

type Filtro = EstadoSolicitud | 'todas'
const esFiltro = (v: string | null): v is Filtro => v === 'todas' || (ESTADOS_SOLICITUD as string[]).includes(v ?? '')

const VACIO: Record<Filtro, { title: string; text: string }> = {
  todas: { title: 'Aún no hay solicitudes', text: 'Cuando una persona pida visitar a alguien desde la página de bienvenida, la solicitud aparecerá aquí.' },
  pendiente: { title: 'No hay solicitudes pendientes', text: 'Todas las solicitudes ya fueron revisadas.' },
  autorizada: { title: 'No hay solicitudes autorizadas', text: 'Las visitas que autorices aparecerán aquí hasta que se realicen.' },
  realizada: { title: 'Aún no hay visitas realizadas', text: 'Aquí verás las visitas autorizadas que el visitante ya reportó como realizadas.' },
  rechazada: { title: 'No hay solicitudes sin autorizar', text: 'Las solicitudes que no autorices aparecerán aquí con su motivo.' },
  cancelada: { title: 'No hay solicitudes canceladas', text: 'Las solicitudes canceladas aparecerán aquí.' },
}

export function SolicitudesPage() {
  const { base } = useShell()
  const { solicitudes, pendientes } = useSolicitudes()
  const [params, setParams] = useSearchParams()
  const filtro: Filtro = esFiltro(params.get('estado')) ? (params.get('estado') as Filtro) : 'todas'

  const conteo = useMemo(() => {
    const c = { todas: solicitudes.length, pendiente: 0, autorizada: 0, realizada: 0, rechazada: 0, cancelada: 0 } satisfies Record<Filtro, number>
    for (const s of solicitudes) c[s.estado]++
    return c
  }, [solicitudes])

  // Pendientes y "Todas" siempre se ofrecen; el resto solo si hay solicitudes en ese estado (o es el filtro activo).
  const filtros = useMemo<Filtro[]>(
    () => ['todas', ...ESTADOS_SOLICITUD.filter((e) => e === 'pendiente' || conteo[e] > 0 || e === filtro)],
    [conteo, filtro],
  )

  // El servicio ya las entrega con las pendientes primero; el filtro conserva ese orden.
  const lista = useMemo(() => (filtro === 'todas' ? solicitudes : solicitudes.filter((s) => s.estado === filtro)), [solicitudes, filtro])

  const elegir = (f: Filtro) => setParams(f === 'todas' ? {} : { estado: f }, { replace: true })

  return (
    <Page title="Solicitudes de visita" back={`${base}/mas`} wide>
      <div className="flex items-start gap-3 p-4 rounded-sm bg-blue-100 border border-blue text-sm text-ink-2">
        <Info size={20} className="flex-none mt-0.5 text-navy" aria-hidden />
        <p>
          Personas externas que piden visitar a un adulto mayor de tu cuenta. Revisa cada solicitud, confirma a quién visitan y autorízala o recházala con un
          motivo: el visitante ve el resultado con su código de seguimiento.
        </p>
      </div>

      <section aria-label="Resumen de solicitudes" className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Indicador label="Por autorizar" valor={pendientes.length} destacado={pendientes.length > 0} />
        <Indicador label="Autorizadas" valor={conteo.autorizada} />
        <Indicador label="Realizadas" valor={conteo.realizada} />
        <Indicador label="No autorizadas" valor={conteo.rechazada} />
      </section>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar solicitudes por estado">
        {filtros.map((f) => (
          <Chip key={f} active={filtro === f} onClick={() => elegir(f)}>
            {f === 'todas' ? 'Todas' : FILTRO_SOLICITUD[f]} ({conteo[f]})
          </Chip>
        ))}
      </div>

      {lista.length === 0 ? (
        <EmptyState title={VACIO[filtro].title} text={VACIO[filtro].text} />
      ) : (
        <div className="grid-auto items-stretch" aria-label={filtro === 'todas' ? 'Todas las solicitudes' : FILTRO_SOLICITUD[filtro]}>
          {lista.map((s) => (
            <SolicitudCard key={s.id} solicitud={s} to={`${base}/solicitudes/${s.id}`} />
          ))}
        </div>
      )}
    </Page>
  )
}

function Indicador({ label, valor, destacado }: { label: string; valor: number; destacado?: boolean }) {
  return (
    <div
      className={
        destacado
          ? 'flex flex-col gap-0.5 min-w-0 px-4 py-3 rounded-sm bg-warning-100 border border-warning'
          : 'flex flex-col gap-0.5 min-w-0 px-4 py-3 rounded-sm bg-teal-100 border border-[#ccdbdd]'
      }
    >
      <span className="text-sm font-semibold leading-snug text-ink">{label}</span>
      <span className="text-[2rem] font-bold leading-tight text-ink">{valor}</span>
    </div>
  )
}
