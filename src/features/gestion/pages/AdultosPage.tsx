/*
 * AdultosPage.tsx — Listado de perfiles de adultos mayores (CU-04 · RF-01): búsqueda (nombre, cédula, sector,
 * municipio), filtros de riesgo, municipio (Municipio_Cod), sector (zona) y estado (Env_Estado), e indicadores
 * de días sin visita (RF-05), alertas abiertas (RF-04), necesidades pendientes y voluntarios asignados (Vinculo).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, CalendarCheck, CalendarX, HandHelping, Plus, UserX } from 'lucide-react'
import { Badge, ButtonLink, Datum, EmptyState, IconTile, LinkCard, RiesgoBadge, SearchInput } from '@/components/ui'
import { useUser } from '@/domain/auth'
import { adultosVisibles, puede } from '@/domain/permisos'
import { diasSinVisita } from '@/domain/reglas'
import { configOrg, nombreMunicipio, voluntariosDe } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Riesgo } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { FilaFiltros, FilterChip } from '../components/FilterChip'
import { necesidadAbierta, nombreAdulto, norm, plural } from '../lib/formato'
import { enUbicacion, municipiosEnUso, sectoresEnUso } from '../lib/ubicacion'

type EstadoFiltro = 'activo' | 'inactivo' | 'todos'

export default function AdultosPage() {
  const { base } = useShell()
  const user = useUser()
  const location = useLocation()
  const resaltar = (location.state as { resaltar?: string } | null)?.resaltar
  const todos = useDB((s) => s.adultos)
  const visitas = useDB((s) => s.visitas)
  const alertas = useDB((s) => s.alertas)
  const necesidades = useDB((s) => s.necesidades)
  const vinculos = useDB((s) => s.vinculos)
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  const [q, setQ] = useState('')
  const [riesgo, setRiesgo] = useState<'' | Riesgo>('')
  const [municipio, setMunicipio] = useState('')
  const [sector, setSector] = useState('')
  const [estado, setEstado] = useState<EstadoFiltro>('activo')
  const umbral = configOrg({ catalogos, configuracion }, user.orgId).diasSinVisitaAlerta
  const puedeCrear = puede(user, 'adultos:crear')

  const visibles = useMemo(() => adultosVisibles(user, todos), [user, todos])
  const municipios = useMemo(() => municipiosEnUso(catalogos, visibles), [catalogos, visibles])
  const sectores = useMemo(() => sectoresEnUso(visibles, municipio || undefined), [visibles, municipio])

  const indicadores = useMemo(() => {
    const m = new Map<string, { dias: number; conVisitas: boolean; alertas: number; necesidades: number; voluntarios: number }>()
    for (const a of visibles) {
      const v = diasSinVisita({ visitas }, a)
      m.set(a.id, {
        dias: v.dias,
        conVisitas: v.conVisitas,
        alertas: alertas.filter((al) => al.adultoId === a.id && al.estado !== 'atendida').length,
        necesidades: necesidades.filter((n) => n.adultoId === a.id && necesidadAbierta(n.estado)).length,
        voluntarios: voluntariosDe(vinculos, a.id).length,
      })
    }
    return m
  }, [visibles, visitas, alertas, necesidades, vinculos])

  const lista = useMemo(() => {
    const t = norm(q)
    return visibles
      .filter((a) => (estado === 'todos' ? true : a.estado === estado))
      .filter((a) => !riesgo || a.riesgo === riesgo)
      .filter((a) => enUbicacion(a, municipio, sector))
      .filter((a) => !t || norm(`${nombreAdulto(a)} ${a.cedula} ${a.zona} ${nombreMunicipio(catalogos, a.municipioCod)}`).includes(t))
      .sort((x, y) => nombreAdulto(x).localeCompare(nombreAdulto(y), 'es'))
  }, [visibles, q, riesgo, municipio, sector, estado, catalogos])

  // Perfil recién registrado (CU-02 paso 6): se lleva a la vista.
  useEffect(() => {
    if (!resaltar) return
    requestAnimationFrame(() => document.getElementById(`adulto-${resaltar}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }, [resaltar])

  const hayFiltros = q !== '' || riesgo !== '' || municipio !== '' || sector !== '' || estado !== 'activo'
  const limpiar = () => {
    setQ('')
    setRiesgo('')
    setMunicipio('')
    setSector('')
    setEstado('activo')
  }

  const botonLimpiar = (
    <button type="button" className="min-h-12 px-2 font-semibold text-navy underline underline-offset-2" onClick={limpiar}>
      Limpiar filtros
    </button>
  )

  return (
    <Page title="Adultos Mayores" wide>
      <div className="flex items-center gap-4">
        <SearchInput className="flex-1 max-w-[560px]" placeholder="Nombre, cédula, sector o municipio" aria-label="Buscar adultos" value={q} onChange={(e) => setQ(e.target.value)} />
        {puedeCrear && (
          <div className="hidden md:block">
            <ButtonLink to={`${base}/adultos/nuevo`} icon={<Plus size={20} aria-hidden />}>
              Nuevo perfil
            </ButtonLink>
          </div>
        )}
      </div>

      <FilaFiltros>
        <FilterChip
          etiqueta="Riesgo"
          value={riesgo}
          onChange={setRiesgo}
          opciones={[
            { value: '', label: 'Todos' },
            { value: 'alto', label: 'Alto' },
            { value: 'medio', label: 'Medio' },
            { value: 'bajo', label: 'Bajo' },
          ]}
        />
        <FilterChip
          etiqueta="Municipio"
          value={municipio}
          onChange={(m) => {
            setMunicipio(m)
            setSector('')
          }}
          opciones={[{ value: '', label: 'Todos' }, ...municipios]}
        />
        <FilterChip etiqueta="Sector" value={sector} onChange={setSector} opciones={[{ value: '', label: 'Todos' }, ...sectores.map((z) => ({ value: z, label: z }))]} />
        <FilterChip
          etiqueta="Estado"
          value={estado}
          neutro="activo"
          onChange={setEstado}
          opciones={[
            { value: 'activo', label: 'Activos' },
            { value: 'inactivo', label: 'Inactivos' },
            { value: 'todos', label: 'Todos' },
          ]}
        />
      </FilaFiltros>

      <p className="flex flex-wrap items-center gap-x-1 text-sm text-ink-2 -my-2" aria-live="polite">
        {plural(lista.length, 'adulto mayor', 'adultos mayores')}
        {hayFiltros && <> · {botonLimpiar}</>}
      </p>

      {lista.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          text={visibles.length === 0 ? 'Aún no hay adultos mayores registrados.' : 'Ningún adulto coincide con la búsqueda o los filtros.'}
          action={visibles.length === 0 && puedeCrear ? <ButtonLink to={`${base}/adultos/nuevo`}>Registrar adulto mayor</ButtonLink> : botonLimpiar}
        />
      ) : (
        <ul className="grid-auto" aria-label="Adultos mayores">
          {lista.map((a) => {
            const ind = indicadores.get(a.id)
            const vencida = !!ind && a.estado === 'activo' && ind.dias > umbral
            return (
              <li key={a.id} id={`adulto-${a.id}`} className={cn('rounded-sm', a.id === resaltar && 'ring-4 ring-blue ring-offset-2 ring-offset-bg animate-pop')}>
                <LinkCard to={`${base}/adultos/${a.id}`} footer="Ver perfil">
                  <div className="flex items-center gap-3">
                    <IconTile size={48} />
                    <div className="flex flex-col flex-1 min-w-0">
                      <h2 className="text-xl font-semibold text-ink wrap-anywhere">{nombreAdulto(a)}</h2>
                      <span className="text-sm text-muted">{a.cedula}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {a.id === resaltar && <Badge tone="info">Nuevo</Badge>}
                      {a.estado === 'inactivo' && <Badge tone="neutral">Inactivo</Badge>}
                      <RiesgoBadge riesgo={a.riesgo} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Datum label="Sector" value={a.zona || '—'} />
                    <Datum label="Municipio" value={nombreMunicipio(catalogos, a.municipioCod) || '—'} />
                  </div>
                  {ind && a.estado === 'activo' && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-line-soft text-sm">
                      <span className={cn('inline-flex items-center gap-1.5', vencida ? 'text-danger font-semibold' : 'text-ink-2')}>
                        {vencida ? <CalendarX size={16} aria-hidden /> : <CalendarCheck size={16} aria-hidden />}
                        {ind.conVisitas ? (ind.dias === 0 ? 'Visitado hoy' : `${plural(ind.dias, 'día', 'días')} sin visita`) : ind.dias === 0 ? 'Sin visitas aún' : `Sin visitas · registrado hace ${plural(ind.dias, 'día', 'días')}`}
                      </span>
                      {ind.alertas > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-danger font-semibold">
                          <Bell size={16} aria-hidden />
                          {plural(ind.alertas, 'alerta abierta', 'alertas abiertas')}
                        </span>
                      )}
                      {ind.voluntarios === 0 && (
                        <span className="inline-flex items-center gap-1.5 text-warning-700 font-semibold">
                          <UserX size={16} aria-hidden />
                          Sin voluntario asignado
                        </span>
                      )}
                      {ind.necesidades > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-warning-700 font-semibold">
                          <HandHelping size={16} aria-hidden />
                          {plural(ind.necesidades, 'necesidad', 'necesidades')}
                        </span>
                      )}
                    </div>
                  )}
                </LinkCard>
              </li>
            )
          })}
        </ul>
      )}

      {puedeCrear && (
        <div className="md:hidden">
          <ButtonLink to={`${base}/adultos/nuevo`} fullWidth icon={<Plus size={20} aria-hidden />}>
            Nuevo perfil
          </ButtonLink>
        </div>
      )}
    </Page>
  )
}
