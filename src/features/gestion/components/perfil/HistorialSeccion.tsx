/*
 * HistorialSeccion.tsx — Historial del adulto mayor en pestañas:
 *   Visitas      (Visita + RegistroVisita + DetalleVisita): incluye las visitas en las que aparece como adulto
 *                adicional del hogar (visitaIncluye), con su razón (Visit_razon), responsable y observación propia.
 *   Necesidades  (Env_Necesidad): catálogo, prioridad, cantidad / unidad, recurrente, estado y responsable.
 *   Alertas      (AlertaEnvejeciente): tipo (catálogo Alertas), prioridad y estado.
 * Cada pestaña se muestra solo si el rol tiene el permiso de consulta correspondiente.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, Repeat, UsersRound } from 'lucide-react'
import { Badge, Button, EmptyState, Segmented } from '@/components/ui'
import { fechaCorta, hhmmA12, relativo } from '@/domain/dates'
import { observacionPara, visitaIncluye } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { nombreCatalogo, nombreUsuario } from '../../lib/datos'
import {
  cantidadTexto,
  ESTADO_NECESIDAD_TEXTO,
  ESTADO_VISITA_TEXTO,
  necesidadAbierta,
  nombreAdulto,
  PESO_SEVERIDAD,
  plural,
  TIPO_NECESIDAD_TEXTO,
  TONO_NECESIDAD,
  TONO_PRIORIDAD,
  TONO_VISITA,
} from '../../lib/formato'
import { EstadoAlertaBadge, UrgenciaBadge } from '../Piezas'

type Pestana = 'visitas' | 'necesidades' | 'alertas'
/** Registros que se muestran antes de "Ver todo". */
const LIMITE = 5

/** Tarjeta de actividad que enlaza a su detalle (o informativa si el rol no tiene esa pantalla). */
function ItemCard({ fecha, badge, titulo, texto, extra, to }: { fecha: string; badge: ReactNode; titulo: string; texto?: string; extra?: ReactNode; to?: string }) {
  const cuerpo = (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs text-muted pt-0.5">{fecha}</span>
        <span className="flex flex-wrap justify-end gap-1">{badge}</span>
      </div>
      <strong className="text-base font-bold text-ink">{titulo}</strong>
      {texto && <span className="text-sm text-muted line-clamp-2">{texto}</span>}
      {extra}
    </div>
  )
  if (!to) return <li className="rounded-sm border border-line-soft bg-bg">{cuerpo}</li>
  return (
    <li>
      <Link to={to} className="block rounded-sm border border-line bg-bg overflow-hidden transition-shadow hover:shadow-1">
        {cuerpo}
        <span className="flex items-center justify-end gap-2 min-h-12 px-4 bg-blue-100 border-t border-navy text-navy text-xs font-semibold">
          Ver detalle <ArrowRight size={18} aria-hidden />
        </span>
      </Link>
    </li>
  )
}

export function HistorialSeccion({
  adulto,
  base,
  verVisitas,
  verNecesidades,
  verAlertas,
  sensible,
  className,
}: {
  adulto: Adulto
  base: string
  verVisitas: boolean
  verNecesidades: boolean
  verAlertas: boolean
  /** Muestra las observaciones de las visitas (dato sensible). */
  sensible: boolean
  className?: string
}) {
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const alertas = useDB((s) => s.alertas)
  const usuarios = useDB((s) => s.usuarios)
  const adultos = useDB((s) => s.adultos)
  const catalogos = useDB((s) => s.catalogos)
  const [pestana, setPestana] = useState<Pestana>('visitas')
  const [verTodo, setVerTodo] = useState(false)

  const misVisitas = useMemo(
    () => visitas.filter((v) => visitaIncluye(v, adulto.id)).sort((a, b) => `${b.fecha} ${b.horaPautada}`.localeCompare(`${a.fecha} ${a.horaPautada}`)),
    [visitas, adulto.id],
  )
  const misNecesidades = useMemo(
    () =>
      necesidades
        .filter((n) => n.adultoId === adulto.id)
        .sort((a, b) => Number(necesidadAbierta(b.estado)) - Number(necesidadAbierta(a.estado)) || PESO_SEVERIDAD[a.prioridad] - PESO_SEVERIDAD[b.prioridad] || b.creadaEn.localeCompare(a.creadaEn)),
    [necesidades, adulto.id],
  )
  const misAlertas = useMemo(
    () =>
      alertas
        .filter((a) => a.adultoId === adulto.id)
        .sort((a, b) => Number(a.estado === 'atendida') - Number(b.estado === 'atendida') || PESO_SEVERIDAD[a.severidad] - PESO_SEVERIDAD[b.severidad] || b.creadaEn.localeCompare(a.creadaEn)),
    [alertas, adulto.id],
  )

  const pestanas: Array<{ value: Pestana; label: string }> = [
    ...(verVisitas ? [{ value: 'visitas' as const, label: `Visitas (${misVisitas.length})` }] : []),
    ...(verNecesidades ? [{ value: 'necesidades' as const, label: `Necesidades (${misNecesidades.length})` }] : []),
    ...(verAlertas ? [{ value: 'alertas' as const, label: `Alertas (${misAlertas.length})` }] : []),
  ]
  if (pestanas.length === 0) return null
  const actual: Pestana = pestanas.some((p) => p.value === pestana) ? pestana : pestanas[0]!.value
  const cantidad = { visitas: misVisitas.length, necesidades: misNecesidades.length, alertas: misAlertas.length }[actual]
  const vacio: Record<Pestana, string> = { visitas: 'Sin visitas registradas.', necesidades: 'Sin necesidades registradas.', alertas: 'Sin alertas para este adulto.' }
  const nombreDe = (id: string) => {
    const a = adultos.find((x) => x.id === id)
    return a ? nombreAdulto(a) : 'otro adulto'
  }

  return (
    <section className={className ? `flex flex-col gap-3 ${className}` : 'flex flex-col gap-3'} aria-label="Historial del adulto mayor">
      <h2 className="text-xl font-semibold text-ink">Historial</h2>
      <Segmented<Pestana>
        label="Historial"
        value={actual}
        onChange={(p) => {
          setPestana(p)
          setVerTodo(false)
        }}
        options={pestanas}
      />
      {cantidad === 0 ? (
        <EmptyState title={vacio[actual]} />
      ) : (
        <ul className="flex flex-col gap-3" role="tabpanel">
          {actual === 'visitas' &&
            (verTodo ? misVisitas : misVisitas.slice(0, LIMITE)).map((v) => {
              const otros = [v.adultoId, ...v.detallesAdicionales.map((d) => d.adultoId)].filter((id) => id !== adulto.id)
              const obs = observacionPara(v, adulto.id)
              return (
                <ItemCard
                  key={v.id}
                  fecha={`${fechaCorta(v.fecha)} · ${hhmmA12(v.horaPautada)}`}
                  badge={
                    <>
                      {v.pendienteSync && <Badge tone="warning">Pendiente de sincronización</Badge>}
                      <Badge tone={TONO_VISITA[v.estado]}>{ESTADO_VISITA_TEXTO[v.estado]}</Badge>
                    </>
                  }
                  titulo={v.razon || v.tipo}
                  texto={`Responsable: ${nombreUsuario(usuarios, v.cuidadorId) ?? '—'}${sensible && obs ? ` · ${obs}` : ''}`}
                  extra={
                    otros.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                        <UsersRound size={14} aria-hidden /> Visita compartida con {otros.map(nombreDe).join(', ')}
                      </span>
                    )
                  }
                  to={`${base}/visitas/${v.id}`}
                />
              )
            })}
          {actual === 'necesidades' &&
            (verTodo ? misNecesidades : misNecesidades.slice(0, LIMITE)).map((n) => {
              const cant = cantidadTexto(n)
              return (
                <ItemCard
                  key={n.id}
                  fecha={relativo(n.creadaEn)}
                  badge={
                    <>
                      {n.pendienteSync && <Badge tone="warning">Pendiente de sincronización</Badge>}
                      <Badge tone={TONO_PRIORIDAD[n.prioridad]}>Prioridad {nombreCatalogo(catalogos.prioridades, n.prioridad)}</Badge>
                      <Badge tone={TONO_NECESIDAD[n.estado]}>{ESTADO_NECESIDAD_TEXTO[n.estado]}</Badge>
                    </>
                  }
                  titulo={n.catalogoId ? nombreCatalogo(catalogos.necesidades, n.catalogoId) : TIPO_NECESIDAD_TEXTO[n.tipo]}
                  texto={n.descripcion}
                  extra={
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
                      <span>{TIPO_NECESIDAD_TEXTO[n.tipo]}</span>
                      {cant && <span>Cantidad: {cant}</span>}
                      {n.recurrente && (
                        <span className="inline-flex items-center gap-1">
                          <Repeat size={13} aria-hidden /> Recurrente
                        </span>
                      )}
                      {n.responsableId && <span>Responsable: {nombreUsuario(usuarios, n.responsableId) ?? '—'}</span>}
                    </span>
                  }
                  to={`${base}/necesidades/${n.id}`}
                />
              )
            })}
          {actual === 'alertas' &&
            (verTodo ? misAlertas : misAlertas.slice(0, LIMITE)).map((a) => (
              <ItemCard
                key={a.id}
                fecha={relativo(a.creadaEn)}
                badge={
                  <>
                    <UrgenciaBadge severidad={a.severidad} />
                    <EstadoAlertaBadge estado={a.estado} />
                  </>
                }
                titulo={a.titulo}
                texto={a.descripcion}
                extra={<span className="text-xs text-ink-2">{nombreCatalogo(catalogos.alertas, a.tipo)}</span>}
                to={`${base}/alertas/${a.id}`}
              />
            ))}
        </ul>
      )}
      {cantidad > LIMITE && (
        <Button variant="outline" size="sm" onClick={() => setVerTodo((x) => !x)}>
          {verTodo ? 'Ver menos' : `Ver todo (${cantidad})`}
        </Button>
      )}
      {actual === 'visitas' && misVisitas.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <CalendarClock size={14} aria-hidden /> {plural(misVisitas.filter((v) => v.estado === 'completada').length, 'visita completada', 'visitas completadas')} en total.
        </p>
      )}
    </section>
  )
}
