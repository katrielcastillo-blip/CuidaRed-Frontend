/*
 * agenda.tsx — Tareas asignadas y validación de evidencias en la agenda conectada.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { Button, SelectField, TextField } from '@/components/ui'
import { api } from '../client'
import { campo, Estado, Formulario, idRuta, opciones, Paginador, useDatos, usePagina } from './controles'
import { Evidencias, type AdultoNombre, type Candidato, type OperacionProps } from './visitas'

interface Tarea {
  tarea_id: string
  envejeciente_id: string
  envejeciente_nombre: string
  cuidador_id: string
  cuidador_nombre: string
  titulo: string
  fecha_programada: string
  hora_programada: string | null
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'cancelada'
  requiere_evidencia: boolean
  es_repetitiva: boolean
  evidencias: { validadas: number }
}

function CrearTarea({ base, token, actualizar }: Pick<OperacionProps, 'base' | 'token'> & { actualizar: () => void }) {
  const adultos = usePagina<AdultoNombre>(`${base}/envejecientes`, token)
  const cuidadores = usePagina<Candidato>(`${base}/candidatos/agenda`, token)
  const prioridades = useDatos<{ prioridad_id: number; nombre: string }[]>('/catalogos/prioridades', token)
  const [adultoId, setAdultoId] = useState('')
  const [cuidadorId, setCuidadorId] = useState('')
  const [repeticion, setRepeticion] = useState('ninguna')
  return <Formulario titulo="Asignar una tarea" accion="Crear tarea" campos={[
    { name: 'titulo', label: 'Título de la tarea', max: 100 },
    { name: 'fecha', label: 'Fecha', type: 'date' },
    { name: 'hora', label: 'Hora', type: 'time', optional: true },
    { name: 'prioridad', label: 'Prioridad', options: prioridades.datos?.map((p) => ({ value: String(p.prioridad_id), label: p.nombre })) ?? [] },
    { name: 'requiere', label: 'Requiere evidencia', options: opciones('sí', 'no') },
  ]} enviar={async (datos) => {
    if (!adultoId || !cuidadorId) throw new Error('Elige al adulto y al cuidador asignado.')
    const diasSemana = datos.getAll('dias_semana').map(Number)
    if (repeticion === 'semanal' && !diasSemana.length) throw new Error('Elige los días de la semana.')
    await api(`${base}/tareas`, token, 'POST', {
      titulo: campo(datos, 'titulo'), envejeciente_id: adultoId, cuidador_id: cuidadorId,
      fecha_programada: campo(datos, 'fecha'), hora_programada: campo(datos, 'hora') || undefined,
      prioridad_id: Number(campo(datos, 'prioridad')), requiere_evidencia: campo(datos, 'requiere') === 'sí',
      ...(repeticion === 'ninguna' ? {} : { repeticion: {
        frecuencia: repeticion, hasta: campo(datos, 'hasta'),
        ...(repeticion === 'semanal' ? { dias_semana: diasSemana } : {}),
      } }),
    })
    actualizar()
  }}>
    <SelectField label="Repetición" options={opciones('ninguna', 'diaria', 'semanal')} value={repeticion}
      onChange={(event) => setRepeticion(event.currentTarget.value)} />
    {repeticion !== 'ninguna' && <TextField type="date" name="hasta" label="Repetir hasta" hint="Hasta 60 ocurrencias." required />}
    {repeticion === 'semanal' && <div className="grid gap-2 md:col-span-2">
      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dia, i) =>
        <label className="flex min-h-12 items-center gap-2" key={dia}><input type="checkbox" name="dias_semana" value={i + 1} /> {dia}</label>)}
    </div>}
    <div className="grid gap-2">
      <p>Adulto seleccionado: {adultoId ? 'Sí' : 'Ninguno'}</p>
      <Estado consulta={adultos} />
      {adultos.datos?.data.map((a) => <Button type="button" variant={adultoId === a.envejeciente_id ? 'primary' : 'outline'} key={a.envejeciente_id} onClick={() => setAdultoId(a.envejeciente_id)}>
        {a.nombres} {a.apellidos}
      </Button>)}
      {adultos.datos && <Paginador pagina={adultos.pagina} total={adultos.datos.meta.totalPages} cambiar={adultos.cambiar} />}
    </div>
    <div className="grid gap-2">
      <p>Cuidador seleccionado: {cuidadorId ? 'Sí' : 'Ninguno'}</p>
      <Estado consulta={cuidadores} />
      {cuidadores.datos?.data.map((c) => c.cuidador_id && <Button type="button" variant={cuidadorId === c.cuidador_id ? 'primary' : 'outline'}
        key={c.usuario_id} onClick={() => setCuidadorId(c.cuidador_id ?? '')}>{c.nombre}</Button>)}
      {cuidadores.datos && <Paginador pagina={cuidadores.pagina} total={cuidadores.datos.meta.totalPages} cambiar={cuidadores.cambiar} />}
    </div>
  </Formulario>
}

export function Agenda({ base, token, cuenta }: OperacionProps) {
  const [id, setId] = useState<string>()
  const [revision, setRevision] = useState(0)
  const [nueva, setNueva] = useState(false)
  const refrescar = () => setRevision((n) => n + 1)
  const listado = usePagina<Tarea>(`${base}/tareas`, token, revision)
  const ruta = id ? `${base}/tareas/${idRuta(id)}` : null
  const consulta = useDatos<Tarea>(ruta, token, revision)
  const tarea = consulta.datos
  const gestionar = cuenta.permisos.includes('agenda:gestionar')
  const ejecutar = cuenta.permisos.includes('agenda:ejecutar')
  const validar = cuenta.permisos.includes('evidencias:validar')
  const abierta = tarea?.estado === 'pendiente' || tarea?.estado === 'en_progreso'
  const alcance = { name: 'alcance', label: 'Aplicar a', value: 'esta', options: [
    { value: 'esta', label: 'Solo esta tarea' }, { value: 'siguientes', label: 'Esta y las siguientes' },
  ] }
  const post = async (path: string, datos?: object) => {
    await api(path, token, 'POST', datos)
    refrescar()
  }
  return <section className="grid gap-4">
    <h2 className="text-lg font-semibold">Agenda de cuidado</h2>
    {gestionar && <Button variant="outline" onClick={() => setNueva(!nueva)}>{nueva ? 'Cerrar nueva tarea' : 'Nueva tarea'}</Button>}
    {nueva && <CrearTarea base={base} token={token} actualizar={() => { setNueva(false); refrescar() }} />}
    <Estado consulta={listado} vacio={listado.datos?.data.length === 0 ? 'Sin tareas.' : undefined} />
    {listado.datos?.data.map((t) => <Button variant="outline" key={t.tarea_id} onClick={() => setId(t.tarea_id)}>
      {t.fecha_programada} · {t.titulo} · {t.estado.replaceAll('_', ' ')}
    </Button>)}
    {listado.datos && <Paginador pagina={listado.pagina} total={listado.datos.meta.totalPages} cambiar={listado.cambiar} />}
    {id && <Estado consulta={consulta} />}
    {tarea && ruta && <section key={tarea.tarea_id} className="grid gap-3">
      <h3 className="font-semibold">{tarea.titulo}</h3>
      <p>{tarea.envejeciente_nombre} · {tarea.cuidador_nombre}</p>
      <p>{tarea.fecha_programada} {tarea.hora_programada} · {tarea.estado.replaceAll('_', ' ')}</p>
      {gestionar && tarea.estado === 'pendiente' && <Formulario titulo="Editar tarea" campos={[
        { name: 'titulo', label: 'Título', value: tarea.titulo, max: 100 },
        { name: 'fecha', label: 'Fecha', value: tarea.fecha_programada, type: 'date' },
        { name: 'hora', label: 'Hora', value: tarea.hora_programada ?? '', type: 'time', optional: true },
        ...(tarea.es_repetitiva ? [alcance] : []),
      ]} enviar={async (datos) => {
        const afectar = campo(datos, 'alcance') || 'esta'
        await api(ruta, token, 'PATCH', { titulo: campo(datos, 'titulo'), hora_programada: campo(datos, 'hora') || null,
          alcance: afectar, ...(afectar === 'esta' ? { fecha_programada: campo(datos, 'fecha') } : {}) })
        refrescar()
      }} />}
      {gestionar && abierta && <Formulario titulo="Cancelar tarea" accion="Cancelar tarea"
        campos={[{ name: 'motivo', label: 'Motivo', max: 300 }, ...(tarea.es_repetitiva ? [alcance] : [])]}
        enviar={(datos) => post(`${ruta}/cancelar`, { motivo: campo(datos, 'motivo'), alcance: campo(datos, 'alcance') || 'esta' })} />}
      {ejecutar && tarea.estado === 'pendiente' && <Formulario titulo="Iniciar tarea" accion="Iniciar" campos={[]} enviar={() => post(`${ruta}/iniciar`)} />}
      {ejecutar && abierta && (tarea.requiere_evidencia && tarea.evidencias.validadas === 0
        ? <p role="status">Para completar esta tarea hace falta una evidencia validada.</p>
        : <Formulario titulo="Completar tarea" accion="Completar" campos={[]} enviar={() => post(`${ruta}/completar`)} />)}
      <Evidencias ruta={ruta} token={token} puedeAdjuntar={ejecutar && abierta} tarea revision={revision} refrescar={refrescar}
        validar={validar ? (evidencia, aceptar, motivo) => post(`${base}/evidencias/${idRuta(evidencia)}/${aceptar ? 'validar' : 'rechazar'}`, motivo ? { motivo } : undefined) : undefined} />
    </section>}
  </section>
}
