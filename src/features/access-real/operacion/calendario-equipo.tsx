/* Calendario de equipo: vista diaria/semanal de visitas con sus acciones existentes. © 2026 Equipo CuidaRed – INTEC. */
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Icon } from '@/components/icons'
import { Button, Segmented, TextField } from '@/components/ui'
import { hhmmA12 } from '@/domain/dates'
import { sumarDias } from '@/features/agenda/lib/fechas'
import { Estado, Paginador, usePagina } from './controles'
import { fechaDominicana } from './visitas-fechas'

interface Cita {
  visita_id: string; fecha: string; hora_programada: string | null; hora_fin_programada?: string | null
  estado: string; razon: string; pendiente_autorizacion?: boolean; entidad_visitante?: string | null
  participantes: { nombres?: string; apellidos?: string }[]
}
const ESTADOS: Record<string, { texto: string; clase: string }> = {
  programada: { texto: 'Programada', clase: 'border-l-primary bg-blue-100 text-navy' },
  en_curso: { texto: 'En curso', clase: 'border-l-warning-700 bg-warning-100 text-warning-700' },
  completada: { texto: 'Completada', clase: 'border-l-success-700 bg-teal-100 text-success-700' },
  cancelada: { texto: 'Cancelada', clase: 'border-l-danger bg-danger-100 text-danger' },
}
const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))
const diaTexto = (fecha: string) => new Intl.DateTimeFormat('es-DO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(fecha + 'T12:00:00Z'))

/** Divide las citas simultáneas en carriles; una visita nunca tapa a otra. */
function distribuir(citas: Cita[]) {
  const bloques = citas.filter(c => c.hora_programada).map(cita => {
    const inicio = minutos(cita.hora_programada!)
    return { cita, inicio, fin: Math.min(1440, Math.max(inicio + 40, cita.hora_fin_programada ? minutos(cita.hora_fin_programada) : inicio + 60)), carril: 0, columnas: 1 }
  }).sort((a, b) => a.inicio - b.inicio || a.fin - b.fin)
  let grupo: typeof bloques = [], finales: number[] = [], hasta = -1
  const cerrar = () => { for (const bloque of grupo) bloque.columnas = finales.length; grupo = []; finales = [] }
  for (const bloque of bloques) {
    if (bloque.inicio >= hasta) cerrar()
    let carril = finales.findIndex(fin => fin <= bloque.inicio)
    if (carril < 0) carril = finales.length
    bloque.carril = carril; finales[carril] = bloque.fin; grupo.push(bloque); hasta = Math.max(...finales)
  }
  cerrar()
  return bloques
}

export function CalendarioEquipo({ base, token, fecha, cambiarFecha, abrir }: { base: string; token: string; fecha: string; cambiarFecha: (fecha: string) => void; abrir: (id: string) => void }) {
  const [vista, setVista] = useState<'dia' | 'semana'>(() => window.matchMedia('(min-width: 768px)').matches ? 'semana' : 'dia')
  const diaSemana = new Date(fecha + 'T12:00:00Z').getUTCDay()
  const inicio = vista === 'dia' ? fecha : sumarDias(fecha, -((diaSemana + 6) % 7))
  const dias = Array.from({ length: vista === 'dia' ? 1 : 7 }, (_, i) => sumarDias(inicio, i))
  const consulta = usePagina<Cita>(`${base}/visitas`, token, 0, { limit: 100, filters: { desde: inicio, hasta: dias.at(-1)! }, sort: ['fecha', 'hora_programada'] })
  const citas = consulta.datos?.data ?? []
  const distribuciones = dias.map(dia => distribuir(citas.filter(c => c.fecha === dia)))
  const bloques = distribuciones.flat()
  const desde = Math.min(7, ...bloques.map(b => Math.floor(b.inicio / 60)))
  const hasta = Math.max(20, ...bloques.map(b => Math.ceil(b.fin / 60)))
  const altura = (hasta - desde) * 72
  const hoy = fechaDominicana()
  const etiquetaEstado = (cita: Cita) => cita.pendiente_autorizacion ? 'Por autorizar' : ESTADOS[cita.estado]?.texto || cita.estado
  const descripcion = (cita: Cita) => `${cita.entidad_visitante || cita.razon || 'Visita'} · ${diaTexto(cita.fecha)} · ${cita.hora_programada ? hhmmA12(cita.hora_programada) : 'Sin hora'}${cita.hora_fin_programada ? ' – ' + hhmmA12(cita.hora_fin_programada) : ''} · ${etiquetaEstado(cita)}`
  const contenido = (cita: Cita) => <><strong className="flex min-w-0 items-center gap-1 text-sm leading-tight"><Icon name={cita.estado === 'completada' ? 'check_circle' : cita.estado === 'cancelada' ? 'event_busy' : cita.estado === 'en_curso' ? 'play_arrow' : 'schedule'} size={20} /><span className="truncate">{cita.entidad_visitante || cita.razon || 'Visita'}</span></strong><span className="block truncate text-sm leading-tight">{cita.hora_programada ? hhmmA12(cita.hora_programada) : 'Sin hora'}{cita.hora_fin_programada ? ' – ' + hhmmA12(cita.hora_fin_programada) : ''} · {etiquetaEstado(cita)}</span></>
  return <section aria-label="Calendario de visitas del equipo" className="grid min-w-0 gap-4">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-bold">Calendario de visitas</h2><p className="mt-1 text-sm text-muted">Horario de República Dominicana. Abre una visita para ver su detalle.</p></div><div className="max-w-full shrink-0 [&_[role=tablist]]:flex-wrap [&_[role=tab]]:flex-none [&_[role=tab]]:whitespace-nowrap"><Segmented label="Vista del calendario" options={[{ value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }]} value={vista} onChange={setVista} /></div></header>
    <div className="flex flex-wrap items-end gap-3 rounded-card border border-line-soft bg-white p-4">
      <div className="flex items-center gap-1"><Button variant="outline" size="sm" aria-label="Período anterior" onClick={() => cambiarFecha(sumarDias(fecha, vista === 'dia' ? -1 : -7))}><ChevronLeft size={24} /></Button><Button variant="outline" size="sm" onClick={() => cambiarFecha(hoy)}>Hoy</Button><Button variant="outline" size="sm" aria-label="Período siguiente" onClick={() => cambiarFecha(sumarDias(fecha, vista === 'dia' ? 1 : 7))}><ChevronRight size={24} /></Button></div>
      <div className="min-w-0 flex-1 basis-48"><TextField label="Fecha del calendario" type="date" value={fecha} onChange={e => { if (e.target.value) cambiarFecha(e.target.value) }} /></div>
    </div>
    <Estado consulta={consulta} />
    {consulta.datos && <>
      <p className="text-sm text-muted" role="status">{consulta.datos.meta.total} visitas en este período · {citas.length} en esta página</p>
      <div role="region" aria-label="Horario de visitas" tabIndex={0} className="max-h-[72dvh] min-w-0 overflow-auto rounded-card border border-line-soft bg-white focus-visible:outline-primary">
        <div style={{ minWidth: vista === 'semana' ? 840 : undefined }}>
          <div className="sticky top-0 z-20 grid border-b border-line-soft bg-white" style={{ gridTemplateColumns: `64px repeat(${dias.length}, minmax(0, 1fr))` }}>
            <span className="p-3 text-sm text-muted">Hora</span>{dias.map(dia => <h3 key={dia} className={'border-l border-line-soft p-3 text-center text-sm font-semibold ' + (dia === hoy ? 'bg-blue-100 text-primary' : 'text-ink')}>{diaTexto(dia)}</h3>)}
          </div>
          <div className="grid" style={{ gridTemplateColumns: `64px repeat(${dias.length}, minmax(0, 1fr))` }}>
            <div className="relative text-sm text-muted" style={{ height: altura }}>{Array.from({ length: hasta - desde }, (_, i) => <time key={i} className="absolute inset-x-0 px-2 pt-1" style={{ top: i * 72 }}>{String(desde + i).padStart(2, '0')}:00</time>)}</div>
            {dias.map((dia, indice) => <div key={dia} className="relative border-l border-line-soft" style={{ height: altura }}>
              {Array.from({ length: hasta - desde }, (_, i) => <div key={i} aria-hidden className="absolute inset-x-0 border-t border-line-soft" style={{ top: i * 72 }} />)}
              {distribuciones[indice].map(bloque => <button key={bloque.cita.visita_id} type="button" onClick={() => abrir(bloque.cita.visita_id)} title={descripcion(bloque.cita)} aria-label={`Abrir visita: ${descripcion(bloque.cita)}`} className={'absolute z-10 overflow-hidden rounded-sm border border-line-soft border-l-4 p-1 text-left shadow-1 hover:brightness-95 ' + (ESTADOS[bloque.cita.estado]?.clase || 'border-l-primary bg-blue-100 text-navy')}
                style={{ top: (bloque.inicio - desde * 60) * 1.2, height: Math.max(48, (bloque.fin - bloque.inicio) * 1.2 - 2), left: `calc(${bloque.carril / bloque.columnas * 100}% + 2px)`, width: `calc(${100 / bloque.columnas}% - 4px)` }}>{contenido(bloque.cita)}</button>)}
            </div>)}
          </div>
        </div>
      </div>
      {citas.some(c => !c.hora_programada) && <section className="grid gap-2"><h3 className="text-base font-semibold">Visitas sin horario</h3><ul className="grid gap-2 sm:grid-cols-2">{citas.filter(c => !c.hora_programada).map(cita => <li key={cita.visita_id}><button type="button" onClick={() => abrir(cita.visita_id)} className="min-h-12 w-full rounded-card border border-line bg-white p-4 text-left">{contenido(cita)}<span className="text-sm">{diaTexto(cita.fecha)}</span></button></li>)}</ul></section>}
      {citas.length === 0 && <p className="text-sm text-muted">No hay visitas en este período.</p>}
      <ul aria-label="Estados del calendario" className="flex flex-wrap gap-3 text-sm">{Object.values(ESTADOS).map(estado => <li key={estado.texto} className={'rounded-sm border-l-4 px-3 py-1 ' + estado.clase}>{estado.texto}</li>)}</ul>
      <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />
    </>}
  </section>
}
