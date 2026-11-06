/*
 * AgendaPage.tsx — Agenda de cuidado (tabla Tarea_agenda) por día: tareas de la cuenta activa visibles según rol y
 * alcance (tareasVisibles), navegación día a día (anterior · siguiente · hoy · fecha), filtros por cuidador, adulto
 * mayor y estado, y las tareas atrasadas aún abiertas cuando se mira el día de hoy. Cada tarjeta muestra su situación
 * de evidencia y las acciones según el permiso: el cuidador asignado inicia y completa; quien tiene
 * "agenda:gestionar" ve además "Nueva tarea"; quien tiene "evidencias:validar" ve la bandeja "Evidencias por validar"
 * (validar o rechazar con motivo). Sin conexión, las acciones que escriben se deshabilitan y se explica por qué.
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, CalendarPlus, ChevronLeft, ChevronRight, FilterX, WifiOff } from 'lucide-react'
import { Button, ButtonLink, EmptyState, Segmented, SelectField, TextField } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { fechaValida } from '@/domain/validacion'
import type { EstadoTarea, Tarea } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { BandejaEvidencias } from '../components/BandejaEvidencias'
import { TareaCard } from '../components/TareaCard'
import { useAccionesTarea } from '../lib/acciones'
import { claveTarea, ESTADO_TAREA, etiquetaDia, evidenciasPorTarea, fechaDiaCorta, fechaDiaLarga, situacionEvidencia, sumarDias, tareaAbierta, useAgenda } from '../lib/agenda'

type Vista = 'dia' | 'validar'
type FiltroEstado = EstadoTarea | 'por_validar' | ''

const NAV =
  'grid place-items-center size-12 flex-none rounded-[10px] border-2 border-navy bg-bg text-navy hover:bg-blue-100 ' +
  'focus-visible:outline-3 focus-visible:outline-blue disabled:opacity-55'

const OPCIONES_ESTADO: Array<{ value: FiltroEstado; label: string }> = [
  { value: '', label: 'Todos los estados' },
  ...(Object.keys(ESTADO_TAREA) as EstadoTarea[]).map((e) => ({ value: e, label: ESTADO_TAREA[e].label })),
  { value: 'por_validar', label: 'Con evidencia por validar' },
]

export default function AgendaPage() {
  const { base } = useShell()
  const enLinea = useEnLinea()
  const { user, tareas, evidencias, adultoPorId, cuidadorPorId, indicacionPorId, miCuidador, veIndicacion, nombreDe } = useAgenda()
  const { cambiar, validar, rechazar } = useAccionesTarea()
  const [params, setParams] = useSearchParams()
  const [adultoId, setAdultoId] = useState(params.get('adulto') ?? '')
  const [cuidadorId, setCuidadorId] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('')

  const hoy = todayISO()
  const gestiona = puede(user, 'agenda:gestionar')
  const valida = puede(user, 'evidencias:validar')
  const diaParam = params.get('dia')
  const dia = diaParam && fechaValida(diaParam) ? diaParam : hoy
  const vista: Vista = valida && params.get('vista') === 'validar' ? 'validar' : 'dia'

  const irA = (nuevo: { dia?: string; vista?: Vista }) => {
    const d = nuevo.dia ?? dia
    const v = nuevo.vista ?? vista
    const siguiente: Record<string, string> = {}
    if (d !== hoy) siguiente.dia = d
    if (v === 'validar') siguiente.vista = v
    setParams(siguiente, { replace: true })
  }

  const porTarea = useMemo(() => evidenciasPorTarea(evidencias), [evidencias])
  const pendientes = useMemo(() => evidencias.filter((e) => e.estadoValidacion === 'pendiente'), [evidencias])
  const porValidar = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of pendientes) m.set(e.tareaId, (m.get(e.tareaId) ?? 0) + 1)
    return m
  }, [pendientes])

  /* ───── Filtros ───── */
  const filtradas = useMemo(
    () =>
      tareas.filter(
        (t) =>
          (!adultoId || t.adultoId === adultoId) &&
          (!cuidadorId || t.cuidadorId === cuidadorId) &&
          (!estado || (estado === 'por_validar' ? porValidar.has(t.id) : t.estado === estado)),
      ),
    [tareas, adultoId, cuidadorId, estado, porValidar],
  )
  const asc = (a: Tarea, b: Tarea) => claveTarea(a).localeCompare(claveTarea(b))
  const delDia = useMemo(() => filtradas.filter((t) => t.fechaProgramada === dia).sort(asc), [filtradas, dia])
  const atrasadas = useMemo(() => (dia === hoy ? filtradas.filter((t) => t.fechaProgramada < hoy && tareaAbierta(t)).sort(asc) : []), [filtradas, dia, hoy])
  // Días cercanos con tareas (para no dejar al usuario frente a un día vacío sin salida).
  const diaAnterior = useMemo(() => filtradas.filter((t) => t.fechaProgramada < dia).map((t) => t.fechaProgramada).sort().at(-1), [filtradas, dia])
  const diaSiguiente = useMemo(() => filtradas.filter((t) => t.fechaProgramada > dia).map((t) => t.fechaProgramada).sort()[0], [filtradas, dia])

  // Opciones de filtro: solo adultos y cuidadores que aparecen en la agenda visible.
  const opcionesAdulto = useMemo(() => {
    const ids = [...new Set(tareas.map((t) => t.adultoId))]
    const lista = ids.map((id) => adultoPorId.get(id)).filter((a) => !!a)
    lista.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'))
    return [{ value: '', label: 'Todos los adultos' }, ...lista.map((a) => ({ value: a.id, label: nombreCompleto(a) }))]
  }, [tareas, adultoPorId])
  const opcionesCuidador = useMemo(() => {
    const ids = [...new Set(tareas.map((t) => t.cuidadorId))]
    const lista = ids.map((id) => cuidadorPorId.get(id)).filter((c) => !!c)
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    return [{ value: '', label: 'Todos los cuidadores' }, ...lista.map((c) => ({ value: c.cuidador.id, label: `${c.nombre} · ${c.tipo}` }))]
  }, [tareas, cuidadorPorId])

  const filtrando = adultoId !== '' || cuidadorId !== '' || estado !== ''
  const limpiar = () => {
    setAdultoId('')
    setCuidadorId('')
    setEstado('')
  }

  /* ───── Indicadores ───── */
  const abiertasHoy = useMemo(() => tareas.filter((t) => tareaAbierta(t) && t.fechaProgramada <= hoy), [tareas, hoy])
  const mias = miCuidador ? abiertasHoy.filter((t) => t.cuidadorId === miCuidador.id).length : 0
  const proximas = useMemo(() => tareas.filter((t) => tareaAbierta(t) && t.fechaProgramada > hoy).length, [tareas, hoy])
  const completadas = useMemo(() => tareas.filter((t) => t.estado === 'completada').length, [tareas])

  const nueva = `${base}/agenda/nueva?${new URLSearchParams({ ...(adultoId ? { adulto: adultoId } : {}), ...(dia >= hoy ? { fecha: dia } : {}) }).toString()}`

  /** Acciones rápidas de la tarjeta según el permiso: el cuidador asignado o quien gestiona la agenda. */
  const accionesDe = (t: Tarea) => {
    if (!tareaAbierta(t)) return undefined
    const esMia = cuidadorPorId.get(t.cuidadorId)?.usuarioId === user.id
    if (!gestiona && !(puede(user, 'agenda:ejecutar') && esMia)) return undefined
    const sit = situacionEvidencia(porTarea.get(t.id) ?? [])
    const faltaEvidencia = t.requiereEvidencia && sit !== 'validada'
    const detalle = `${base}/agenda/${t.id}`
    return (
      <>
        {t.estado === 'pendiente' && (
          <Button variant="outline" size="sm" disabled={!enLinea} onClick={() => cambiar(t, 'en_curso')}>
            Iniciar
          </Button>
        )}
        {!faltaEvidencia && (
          <Button size="sm" disabled={!enLinea} onClick={() => cambiar(t, 'completada')}>
            Completar
          </Button>
        )}
        {faltaEvidencia && sit !== 'pendiente' && (
          <ButtonLink to={`${detalle}#evidencias`} variant="light" size="sm">
            Adjuntar evidencia
          </ButtonLink>
        )}
        {faltaEvidencia && sit === 'pendiente' && (
          <ButtonLink to={`${detalle}#evidencias`} variant="light" size="sm">
            Ver evidencia
          </ButtonLink>
        )}
      </>
    )
  }

  const tarjeta = (t: Tarea, soloHora: boolean) => (
    <TareaCard
      key={t.id}
      tarea={t}
      adulto={adultoPorId.get(t.adultoId)}
      cuidador={cuidadorPorId.get(t.cuidadorId)}
      indicacion={t.indicacionId && veIndicacion(t) ? indicacionPorId.get(t.indicacionId) : undefined}
      evidencias={porTarea.get(t.id)}
      porValidar={valida ? porValidar.get(t.id) : 0}
      soloHora={soloHora}
      acciones={accionesDe(t)}
      to={`${base}/agenda/${t.id}`}
    />
  )

  return (
    <Page
      title="Agenda"
      wide
      actions={
        gestiona ? (
          <div className="hidden md:block">
            <ButtonLink to={nueva} variant="light" size="sm" icon={<CalendarPlus size={18} aria-hidden />}>
              Nueva tarea
            </ButtonLink>
          </div>
        ) : undefined
      }
    >
      <p className="text-sm text-muted">
        Tareas de cuidado programadas para cada adulto mayor.{' '}
        {gestiona ? 'Asígnalas a un cuidador y revisa sus evidencias.' : 'Inicia y completa las tareas asignadas a ti y adjunta la evidencia cuando se pida.'}
      </p>

      {/* ───── Indicadores ───── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4" aria-label="Resumen de la agenda">
        <div className="relative col-span-2 md:col-span-1 flex flex-col gap-0.5 min-h-[96px] px-5 py-4 rounded-sm bg-teal-100 border border-[#ccdbdd]">
          <span className="text-base font-semibold text-ink">{miCuidador ? 'Tus tareas abiertas de hoy' : 'Tareas abiertas de hoy'}</span>
          <span className="text-4xl font-bold leading-tight text-ink">{miCuidador ? mias : abiertasHoy.length}</span>
          <CalendarCheck size={32} className="absolute right-4 bottom-3 text-success-700" aria-hidden />
        </div>
        <Indicador label="Próximas" valor={proximas} />
        {valida ? (
          <Indicador label="Evidencias por validar" valor={pendientes.length} alerta={pendientes.length > 0} onClick={() => irA({ vista: 'validar' })} />
        ) : (
          <Indicador label="Completadas" valor={completadas} />
        )}
      </section>

      {valida && (
        <Segmented<Vista>
          label="Vista de la agenda"
          value={vista}
          options={[
            { value: 'dia', label: 'Agenda por día' },
            { value: 'validar', label: `Evidencias por validar${pendientes.length > 0 ? ` (${pendientes.length})` : ''}` },
          ]}
          onChange={(v) => irA({ vista: v })}
        />
      )}

      {vista === 'validar' ? (
        <section className="flex flex-col gap-4" aria-labelledby="agenda-validar">
          <h2 id="agenda-validar" className="text-xl font-bold text-ink">
            Evidencias por validar <span className="text-base font-normal text-muted">({pendientes.length})</span>
          </h2>
          {!enLinea && <SinConexion />}
          <BandejaEvidencias
            evidencias={pendientes}
            tareas={tareas}
            adultoPorId={adultoPorId}
            cuidadorPorId={cuidadorPorId}
            nombreDe={nombreDe}
            base={base}
            enLinea={enLinea}
            onValidar={(e) => validar(e)}
            onRechazar={(e, motivo) => rechazar(e, motivo)}
          />
        </section>
      ) : (
        <>
          {/* ───── Día y filtros ───── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 md:max-w-[560px]">
              <button type="button" className={NAV} aria-label="Día anterior" onClick={() => irA({ dia: sumarDias(dia, -1) })}>
                <ChevronLeft size={22} aria-hidden />
              </button>
              <div className="flex-1 min-w-0">
                <TextField type="date" aria-label="Día de la agenda" value={dia} onChange={(e) => e.target.value && irA({ dia: e.target.value })} />
              </div>
              <button type="button" className={NAV} aria-label="Día siguiente" onClick={() => irA({ dia: sumarDias(dia, 1) })}>
                <ChevronRight size={22} aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {/* El cuidador solo ve sus propias tareas: no necesita filtrar por cuidador. */}
              {(gestiona || opcionesCuidador.length > 2) && (
                <SelectField aria-label="Filtrar por cuidador" value={cuidadorId} onChange={(e) => setCuidadorId(e.target.value)} options={opcionesCuidador} />
              )}
              <SelectField aria-label="Filtrar por adulto mayor" value={adultoId} onChange={(e) => setAdultoId(e.target.value)} options={opcionesAdulto} />
              <SelectField aria-label="Filtrar por estado" value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)} options={OPCIONES_ESTADO} />
            </div>
            {filtrando && (
              <div>
                <Button variant="ghost" size="sm" onClick={limpiar} icon={<FilterX size={18} aria-hidden />}>
                  Quitar filtros
                </Button>
              </div>
            )}
          </div>

          {!enLinea && gestiona && <SinConexion />}

          {/* ───── Atrasadas (solo al mirar hoy) ───── */}
          {atrasadas.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="agenda-atrasadas">
              <h2 id="agenda-atrasadas" className="text-lg font-bold text-danger">
                Atrasadas <span className="text-base font-normal text-muted">({atrasadas.length})</span>
              </h2>
              <div className="grid-auto items-stretch">{atrasadas.map((t) => tarjeta(t, false))}</div>
            </section>
          )}

          {/* ───── Tareas del día ───── */}
          <section className="flex flex-col gap-3" aria-labelledby="agenda-dia">
            <h2 id="agenda-dia" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-bold text-ink">
              <span className="first-letter:uppercase">{fechaDiaLarga(dia)}</span>
              {['Hoy', 'Mañana', 'Ayer'].includes(etiquetaDia(dia)) && <span className="text-base font-semibold text-navy">· {etiquetaDia(dia)}</span>}
              <span className="text-base font-normal text-muted">
                ({delDia.length} {delDia.length === 1 ? 'tarea' : 'tareas'})
              </span>
              {dia !== hoy && (
                <Button variant="light" size="sm" onClick={() => irA({ dia: hoy })}>
                  Ir a hoy
                </Button>
              )}
            </h2>
            {delDia.length === 0 ? (
              <EmptyState
                title={filtrando ? 'Sin resultados para este día' : 'No hay tareas este día'}
                text={filtrando ? 'Ninguna tarea de este día coincide con los filtros. Prueba a quitarlos.' : 'Las tareas programadas para este día aparecerán aquí.'}
                action={
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    {diaAnterior && (
                      <Button variant="outline" size="sm" onClick={() => irA({ dia: diaAnterior })}>
                        Anterior con tareas: {fechaDiaCorta(diaAnterior)}
                      </Button>
                    )}
                    {diaSiguiente && (
                      <Button variant="outline" size="sm" onClick={() => irA({ dia: diaSiguiente })}>
                        Siguiente con tareas: {fechaDiaCorta(diaSiguiente)}
                      </Button>
                    )}
                    {gestiona && !filtrando && (
                      <ButtonLink to={nueva} variant="light" size="sm" icon={<CalendarPlus size={18} aria-hidden />}>
                        Nueva tarea
                      </ButtonLink>
                    )}
                  </div>
                }
              />
            ) : (
              <div className="grid-auto items-stretch">{delDia.map((t) => tarjeta(t, true))}</div>
            )}
          </section>
        </>
      )}

      {/* Móvil: botón fijo sobre la barra de navegación inferior */}
      {gestiona && (
        <div className="md:hidden sticky z-[5] bottom-[calc(var(--bottomnav-h)+var(--safe-bottom)+12px)]">
          <ButtonLink to={nueva} fullWidth className="shadow-[0_6px_16px_rgba(12,59,110,0.35)]" icon={<CalendarPlus size={22} aria-hidden />}>
            Nueva tarea
          </ButtonLink>
        </div>
      )}
    </Page>
  )
}

function Indicador({ label, valor, alerta, onClick }: { label: string; valor: number; alerta?: boolean; onClick?: () => void }) {
  const clases = cn(
    'flex flex-col gap-0.5 min-w-0 min-h-[78px] md:min-h-[96px] px-4 py-3 md:px-5 md:py-4 rounded-sm border text-left',
    alerta ? 'bg-warning-100 border-warning' : 'bg-teal-100 border-[#ccdbdd]',
  )
  const contenido = (
    <>
      <span className="text-sm md:text-base font-semibold leading-snug text-ink">{label}</span>
      <span className="text-[2rem] md:text-4xl font-bold leading-tight text-ink">{valor}</span>
    </>
  )
  return onClick ? (
    <button type="button" className={cn(clases, 'hover:brightness-[.98]')} onClick={onClick}>
      {contenido}
    </button>
  ) : (
    <div className={clases}>{contenido}</div>
  )
}

function SinConexion() {
  return (
    <p role="status" className="flex items-start gap-2 p-3 rounded-sm bg-warning-100 border border-warning text-sm text-ink">
      <WifiOff size={18} className="flex-none mt-0.5 text-warning-700" aria-hidden />
      Sin conexión: iniciar, completar, validar o crear tareas necesita internet. Los botones se habilitan al recuperar la conexión.
    </p>
  )
}
