/*
 * seguimiento.tsx — Asignaciones, riesgo, indicaciones e historial del expediente conectado.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { CalendarClock, ClipboardList, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { Badge, Button, Card, Chip, EmptyState, RiesgoBadge, SelectField } from '@/components/ui'
import { fechaCorta, fechaHora } from '@/domain/dates'
import { SECCIONES } from '@/features/gestion/lib/riesgo'
import { cn } from '@/lib/cn'
import { api } from '../client'
import { campo, Estado, Formulario, idRuta, Paginador, useDatos, usePagina, type Campo } from './controles'
import type { Candidato, OperacionProps } from './visitas'

type Nivel = 'bajo' | 'medio' | 'alto'
interface Vinculo {
  usuario_id?: string
  nombres: string
  apellidos: string
  usuario?: { nombres: string; apellidos: string }
}
interface Factor {
  envejeciente_riesgo_id: string | number
  riesgo: string
  nivel: Nivel
  estado: 'activo' | 'resuelto' | 'reemplazado'
  motivo?: string
  observacion?: string | null
}
export interface ResumenRiesgo {
  nivel_vigente: Nivel | null
  texto?: string
  factores_vigentes?: Factor[]
  historial?: Factor[]
  ultima_evaluacion?: { puntaje: number; vigente: boolean } | null
}
interface Indicacion {
  indicacion_medica_id: string
  tipo_indicacion_id: number
  tipo?: string
  titulo: string
  descripcion?: string | null
  frecuencia_horario?: string | null
  fecha_inicio: string
  fecha_fin?: string | null
  estado: 'activa' | 'suspendida' | 'finalizada'
}
type SeccionProps = OperacionProps & { ruta: string; revision: number; actualizar: () => void; adultoActivo: boolean }
type ConsultaRiesgo = ReturnType<typeof useDatos<ResumenRiesgo>>
const ROL: Record<string, string> = { cuidador: 'Cuidador', voluntario: 'Voluntario', familiar: 'Familiar' }
const NIVELES = [{ value: 'bajo', label: 'Bajo' }, { value: 'medio', label: 'Medio' }, { value: 'alto', label: 'Alto' }]
const ESTADOS_INDICACION: Record<Indicacion['estado'], string> = { activa: 'Activa', suspendida: 'Suspendida', finalizada: 'Finalizada' }

function Asignar({ ruta, base, token, revision, actualizar, familiar, cerrar }: SeccionProps & { familiar: boolean; cerrar: () => void }) {
  const candidatos = usePagina<Candidato>(`${base}/candidatos/${familiar ? 'familiar' : 'asignacion'}`, token, revision)
  const personas = candidatos.datos?.data ?? []
  const titulo = familiar ? 'Autorizar familiar' : 'Asignar cuidador o voluntario'
  return <div className="grid gap-3">
    <Estado consulta={candidatos} vacio={candidatos.datos && personas.length === 0 ? 'Sin personas disponibles en esta cuenta.' : undefined} />
    {personas.length > 0 && <Formulario key={candidatos.pagina} titulo={titulo} accion={familiar ? 'Autorizar acceso' : 'Asignar persona'} cancelar={cerrar}
      campos={[]}
      enviar={async (datos) => {
        const persona = personas.find((p) => p.usuario_id === campo(datos, 'persona'))
        if (!persona) throw new Error('Selecciona una persona disponible.')
        await api(`${ruta}/${familiar ? 'familiares' : 'asignaciones'}`, token, 'POST', {
          usuario_id: persona.usuario_id,
          ...(familiar ? {} : { tipo: persona.rol === 'cuidador' ? 'cuidador_asignado' : 'voluntario_asignado' }),
        })
        actualizar()
        cerrar()
      }}>
      <SelectField name="persona" label={familiar ? 'Familiar' : 'Cuidador o voluntario'} placeholder="Selecciona a la persona"
        required defaultValue="" className="text-ellipsis"
        options={personas.map((p) => ({ value: p.usuario_id, label: familiar ? p.nombre : `${p.nombre} · ${ROL[p.rol] ?? p.rol}` }))} />
    </Formulario>}
    {candidatos.datos && <Paginador pagina={candidatos.pagina} total={candidatos.datos.meta.totalPages} cambiar={candidatos.cambiar} />}
  </div>
}

type GestionVinculo = { tipo: 'personal' | 'familiar' } | { tipo: 'revocar'; persona: Vinculo; familiar: boolean }
function Vinculos(props: SeccionProps) {
  const { ruta, token, cuenta, revision, actualizar, adultoActivo } = props
  const [gestion, setGestion] = useState<GestionVinculo>()
  const puedeAsignar = cuenta.permisos.includes('adultos:asignar')
  const puedeAutorizar = cuenta.permisos.includes('familiares:autorizar')
  const vinculos = useDatos<{ cuidadores: Vinculo[]; voluntarios: Vinculo[]; familiares?: Vinculo[] }>(`${ruta}/asignaciones`, token, revision)
  const cerrar = () => setGestion(undefined)
  const mostrar = (persona: Vinculo) => {
    const datos = persona.usuario ?? persona
    return `${datos.nombres} ${datos.apellidos}`
  }
  const grupos = [
    { rol: 'Cuidador', personas: vinculos.datos?.cuidadores ?? [], revocable: puedeAsignar, familiar: false },
    { rol: 'Voluntario', personas: vinculos.datos?.voluntarios ?? [], revocable: puedeAsignar, familiar: false },
    { rol: 'Familiar', personas: vinculos.datos?.familiares ?? [], revocable: puedeAutorizar, familiar: true },
  ]
  return <section className="grid gap-3">
    <h3 className="font-semibold">Asignaciones y permisos familiares</h3>
    <Estado consulta={vinculos} />
    {vinculos.datos && grupos.every((grupo) => grupo.personas.length === 0) && <EmptyState title="Sin asignaciones" text="Aquí aparecerá el personal asignado y los accesos vigentes que tu rol permita consultar." />}
    {grupos.flatMap(({ rol, personas, revocable, familiar }) => personas.map((persona, indice) => <Card className="flex flex-wrap items-center gap-3" key={persona.usuario_id ?? `${rol}-${indice}`}>
      <UserRound size={20} className="text-navy" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="break-words font-semibold text-ink">{mostrar(persona)}</p>
        <p className="text-sm text-muted">{rol}</p>
      </div>
      {revocable && persona.usuario_id && !gestion && <Button variant="ghost" size="sm" onClick={() => setGestion({ tipo: 'revocar', persona, familiar })}>
        {familiar ? 'Revocar acceso' : 'Quitar asignación'}
      </Button>}
    </Card>))}
    {!gestion && adultoActivo && <div className="flex flex-wrap gap-2">
      {puedeAsignar && <Button variant="light" size="sm" icon={<Plus size={18} aria-hidden />} onClick={() => setGestion({ tipo: 'personal' })}>Asignar personal</Button>}
      {puedeAutorizar && <Button variant="outline" size="sm" onClick={() => setGestion({ tipo: 'familiar' })}>Autorizar familiar</Button>}
    </div>}
    {(gestion?.tipo === 'personal' || gestion?.tipo === 'familiar') && <Asignar {...props} familiar={gestion.tipo === 'familiar'} cerrar={cerrar} />}
    {gestion?.tipo === 'revocar' && gestion.persona.usuario_id && <Formulario titulo={gestion.familiar ? 'Revocar acceso familiar' : 'Quitar asignación'}
      accion={gestion.familiar ? 'Revocar acceso' : 'Quitar asignación'} cancelar={cerrar}
      campos={[{ name: 'motivo', label: 'Motivo', type: 'textarea', optional: true, max: 300 }]} enviar={async (datos) => {
        const subruta = gestion.familiar ? 'familiares' : 'asignaciones'
        await api(`${ruta}/${subruta}/${idRuta(gestion.persona.usuario_id!)}/revocar`, token, 'POST', { motivo: campo(datos, 'motivo') || undefined })
        actualizar()
        cerrar()
      }}>
      <p className="text-sm text-ink-2 md:col-span-2">{mostrar(gestion.persona)} perderá el acceso a este expediente.</p>
    </Formulario>}
  </section>
}

const preguntas = SECCIONES.flatMap((s) => s.preguntas)

function Evaluacion({ ruta, token, actualizar, cerrar }: SeccionProps & { cerrar: () => void }) {
  return <Formulario titulo="Evaluación de riesgo (100 puntos)" campos={[]} accion="Guardar evaluación" cancelar={cerrar} enviar={async (datos) => {
    const respuestas = Object.fromEntries(preguntas.map((pregunta) => [
      pregunta.clave.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`),
      pregunta.tipo === 'switch' ? campo(datos, pregunta.clave) === 'si' : campo(datos, pregunta.clave),
    ]))
    await api(`${ruta}/evaluaciones`, token, 'POST', { respuestas })
    actualizar()
    cerrar()
  }}>
    <p className="text-sm text-ink-2 md:col-span-2">Responde todas las preguntas. El sistema calculará el nivel al guardar.</p>
    {SECCIONES.map((seccion) => <fieldset key={seccion.id} className="grid min-w-0 gap-4 rounded-sm border border-line-soft bg-bg p-4 md:col-span-2">
      <legend className="px-1 text-sm font-bold text-navy">{seccion.titulo}</legend>
      {seccion.preguntas.map((pregunta) => pregunta.tipo === 'select'
        ? <SelectField key={pregunta.clave} name={pregunta.clave} label={pregunta.texto} required placeholder="Selecciona una opción"
          options={pregunta.opciones.map((o) => ({ value: o.valor, label: o.etiqueta }))} />
        : <fieldset key={pregunta.clave} className="grid min-w-0 gap-2">
          <legend className="mb-1 text-sm font-semibold text-ink">{pregunta.texto}</legend>
          <div className="grid grid-cols-2 gap-2">
            {[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }].map((opcion) => <label key={opcion.value}
              className="grid min-h-12 cursor-pointer place-items-center rounded-sm border border-line bg-bg px-3 text-sm font-semibold text-ink-2 has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue">
              <input type="radio" name={pregunta.clave} value={opcion.value} required className="sr-only" />{opcion.label}
            </label>)}
          </div>
        </fieldset>)}
    </fieldset>)}
  </Formulario>
}

type GestionRiesgo = 'evaluacion' | 'factor' | Factor
function Riesgo(props: SeccionProps & { consulta: ConsultaRiesgo; abrirEvaluacion: boolean }) {
  const { ruta, base, token, cuenta, adultoActivo, actualizar, consulta, abrirEvaluacion } = props
  const evaluar = adultoActivo && cuenta.permisos.includes('adultos:evaluar')
  const [gestion, setGestion] = useState<GestionRiesgo | undefined>(abrirEvaluacion && evaluar ? 'evaluacion' : undefined)
  const catalogo = useDatos<{ riesgo_id: number; nombre: string; codigo?: string }[]>(gestion === 'factor' ? '/catalogos/riesgos' : null, token)
  const opciones = catalogo.datos?.filter((r) => r.codigo !== 'evaluacion' && r.nombre !== 'Evaluación de riesgo')
    .map((r) => ({ value: String(r.riesgo_id), label: r.nombre })) ?? []
  const cerrar = () => setGestion(undefined)
  return <section className="grid gap-3">
    <h3 className="font-semibold">Riesgo social</h3>
    <Estado consulta={consulta} />
    {consulta.datos && <Card tone="info" className="grid gap-2">
      <p className="font-semibold text-ink">{consulta.datos.texto ?? (consulta.datos.nivel_vigente ? 'Nivel de riesgo vigente' : 'Sin evaluación vigente')}</p>
      <div className="flex flex-wrap items-center gap-2">
        {consulta.datos.nivel_vigente && <RiesgoBadge riesgo={consulta.datos.nivel_vigente} />}
        {consulta.datos.ultima_evaluacion?.vigente && <p className="text-sm text-ink-2">{consulta.datos.ultima_evaluacion.puntaje}/100 puntos en la última evaluación</p>}
      </div>
    </Card>}
    {consulta.datos?.factores_vigentes?.map((factor) => <Card key={factor.envejeciente_riesgo_id} className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">{factor.riesgo}</p>
        <RiesgoBadge riesgo={factor.nivel} />
      </div>
      {factor.motivo && <p className="text-sm text-ink-2">{factor.motivo}</p>}
      {factor.observacion && <p className="text-sm text-muted">{factor.observacion}</p>}
      {cuenta.permisos.includes('adultos:evaluar') && factor.estado === 'activo' && !gestion &&
        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setGestion(factor)}>Resolver factor</Button>}
    </Card>)}
    {evaluar && !gestion && <div className="flex flex-wrap gap-2">
      <Button variant="light" size="sm" icon={<ShieldCheck size={18} aria-hidden />} onClick={() => setGestion('evaluacion')}>Realizar evaluación</Button>
      <Button variant="outline" size="sm" onClick={() => setGestion('factor')}>Registrar factor de riesgo</Button>
    </div>}
    {gestion === 'evaluacion' && <Evaluacion {...props} cerrar={cerrar} />}
    {gestion === 'factor' && <div className="grid gap-3">
      <Estado consulta={catalogo} vacio={catalogo.datos && opciones.length === 0 ? 'El catálogo de factores todavía no está disponible.' : undefined} />
      <Formulario titulo="Registrar factor de riesgo" cancelar={cerrar} submitDisabled={opciones.length === 0} campos={[
        { name: 'riesgo_id', label: 'Factor de riesgo', options: opciones },
        { name: 'nivel', label: 'Nivel del factor', options: NIVELES },
        { name: 'motivo', label: 'Motivo', type: 'textarea', min: 5, max: 200 },
        { name: 'observacion', label: 'Observación', type: 'textarea', optional: true, max: 300 },
      ]} enviar={async (datos) => {
        await api(`${ruta}/riesgos`, token, 'POST', { riesgo_id: Number(campo(datos, 'riesgo_id')), nivel: campo(datos, 'nivel'),
          motivo: campo(datos, 'motivo'), observacion: campo(datos, 'observacion') || undefined })
        actualizar()
        cerrar()
      }} />
    </div>}
    {gestion && typeof gestion !== 'string' && <Formulario titulo={`Resolver factor: ${gestion.riesgo}`} accion="Confirmar resolución" cancelar={cerrar}
      campos={[{ name: 'observacion', label: 'Observación de resolución', type: 'textarea', optional: true, max: 300 }]} enviar={async (datos) => {
        await api(`${base}/riesgos/${idRuta(String(gestion.envejeciente_riesgo_id))}/resolver`, token, 'POST', { observacion: campo(datos, 'observacion') || undefined })
        actualizar()
        cerrar()
      }} />}
  </section>
}

type GestionIndicacion = { tipo: 'nueva' } | { tipo: 'editar'; indicacion: Indicacion } | {
  tipo: 'estado'; indicacion: Indicacion; estado: Indicacion['estado']
}
const ACCIONES_INDICACION = { activa: 'Reactivar', suspendida: 'Suspender', finalizada: 'Finalizar' }
function Indicaciones({ ruta, base, token, cuenta, revision, actualizar, adultoActivo }: SeccionProps) {
  const [gestion, setGestion] = useState<GestionIndicacion>()
  const [filtro, setFiltro] = useState('')
  const puedeGestionar = cuenta.permisos.includes('indicaciones:gestionar')
  const indicaciones = usePagina<Indicacion>(`${ruta}/indicaciones`, token, revision, { filters: filtro ? { estado: filtro } : undefined })
  const tipos = useDatos<{ tipo_indicacion_id: number; nombre: string }[]>(gestion && gestion.tipo !== 'estado' ? '/catalogos/tipos-indicacion' : null, token)
  const editada = gestion?.tipo === 'editar' ? gestion.indicacion : undefined
  const cerrar = () => setGestion(undefined)
  const camposIndicacion: Campo[] = [
    { name: 'tipo_indicacion_id', label: 'Tipo de indicación', value: editada && String(editada.tipo_indicacion_id),
      options: tipos.datos?.map((t) => ({ value: String(t.tipo_indicacion_id), label: t.nombre })) ?? [] },
    { name: 'titulo', label: 'Título', value: editada?.titulo, min: 3, max: 80 },
    { name: 'descripcion', label: 'Descripción', value: editada?.descripcion ?? '', type: 'textarea', optional: true, max: 300 },
    { name: 'frecuencia_horario', label: 'Frecuencia u horario', value: editada?.frecuencia_horario ?? '', optional: true, max: 60 },
    { name: 'fecha_inicio', label: 'Fecha de inicio', value: editada?.fecha_inicio, type: 'date' },
    { name: 'fecha_fin', label: 'Fecha final', value: editada?.fecha_fin ?? '', type: 'date', optional: true },
  ]

  return <section className="grid gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Indicaciones médicas</h3>
      {puedeGestionar && adultoActivo && !gestion && <Button size="sm" variant="light" icon={<Plus size={18} aria-hidden />} onClick={() => setGestion({ tipo: 'nueva' })}>Registrar indicación</Button>}
    </div>
    {(gestion?.tipo === 'nueva' || gestion?.tipo === 'editar') && <div className="grid gap-3">
      <Estado consulta={tipos} vacio={tipos.datos?.length === 0 ? 'El catálogo de indicaciones aún no está disponible.' : undefined} />
      <Formulario key={editada?.indicacion_medica_id ?? 'nueva'} titulo={editada ? 'Editar indicación' : 'Registrar indicación'}
        submitDisabled={!tipos.datos?.length} campos={camposIndicacion} cancelar={cerrar} enviar={async (datos) => {
          const inicio = campo(datos, 'fecha_inicio')
          const fin = campo(datos, 'fecha_fin')
          if (fin && fin < inicio) throw new Error('La fecha final debe ser igual o posterior a la fecha de inicio.')
          const path = editada ? `${base}/indicaciones/${idRuta(editada.indicacion_medica_id)}` : `${ruta}/indicaciones`
          await api(path, token, editada ? 'PATCH' : 'POST', {
            tipo_indicacion_id: Number(campo(datos, 'tipo_indicacion_id')), titulo: campo(datos, 'titulo'),
            descripcion: campo(datos, 'descripcion') || null, frecuencia_horario: campo(datos, 'frecuencia_horario') || null,
            fecha_inicio: inicio, fecha_fin: fin || null,
          })
          actualizar()
          cerrar()
        }} />
    </div>}
    {gestion?.tipo === 'estado' && <Formulario titulo={`${ACCIONES_INDICACION[gestion.estado]} indicación`} accion="Confirmar cambio" cancelar={cerrar} campos={[]}
      enviar={async () => {
        await api(`${base}/indicaciones/${idRuta(gestion.indicacion.indicacion_medica_id)}/estado`, token, 'POST', { estado: gestion.estado })
        actualizar()
        cerrar()
      }}>
      <p className="text-sm text-ink-2 md:col-span-2">{gestion.indicacion.titulo}{gestion.estado === 'finalizada' && '. Una vez finalizada, la indicación quedará en el historial.'}</p>
    </Formulario>}
    <div className="max-w-sm">
      <SelectField label="Estado de la indicación" value={filtro}
        options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(ESTADOS_INDICACION).map(([value, label]) => ({ value, label }))]}
        onChange={(event) => { setFiltro(event.currentTarget.value); indicaciones.cambiar(1) }} />
    </div>
    <Estado consulta={indicaciones} />
    {indicaciones.datos?.data.length === 0 && <EmptyState title="Sin indicaciones" text={filtro ? 'Prueba otro estado.' : 'Aquí aparecerán las indicaciones de este adulto.'} />}
    {indicaciones.datos?.data.map((indicacion) => <Card key={indicacion.indicacion_medica_id} className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="break-words font-semibold text-ink">{indicacion.titulo}</h4>
        <Badge tone={indicacion.estado === 'activa' ? 'success' : 'neutral'}>{ESTADOS_INDICACION[indicacion.estado]}</Badge>
      </div>
      {indicacion.tipo && <p className="text-sm text-muted">{indicacion.tipo}</p>}
      {indicacion.descripcion && <p className="text-sm text-ink-2">{indicacion.descripcion}</p>}
      {indicacion.frecuencia_horario && <p className="text-sm text-muted">{indicacion.frecuencia_horario}</p>}
      <p className="text-sm text-muted">Desde {fechaCorta(indicacion.fecha_inicio)}{indicacion.fecha_fin && ` · Hasta ${fechaCorta(indicacion.fecha_fin)}`}</p>
      {puedeGestionar && indicacion.estado !== 'finalizada' && !gestion && <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setGestion({ tipo: 'editar', indicacion })}>Editar indicación</Button>
        <Button variant="light" size="sm" onClick={() => setGestion({
          tipo: 'estado', indicacion, estado: indicacion.estado === 'activa' ? 'suspendida' : 'activa',
        })}>{indicacion.estado === 'activa' ? 'Suspender' : 'Reactivar'}</Button>
        <Button variant="ghost" size="sm" onClick={() => setGestion({ tipo: 'estado', indicacion, estado: 'finalizada' })}>Finalizar</Button>
      </div>}
    </Card>)}
    {indicaciones.datos && <Paginador pagina={indicaciones.pagina} total={indicaciones.datos.meta.totalPages} cambiar={indicaciones.cambiar} />}
  </section>
}

const TIPOS_HISTORIAL = [
  { value: 'visita', label: 'Visitas', permiso: 'visitas:ver' },
  { value: 'riesgo', label: 'Factores de riesgo', permiso: 'adultos:ver-sensible' },
  { value: 'evaluacion', label: 'Evaluaciones', permiso: 'adultos:ver-sensible' },
  { value: 'indicacion', label: 'Indicaciones', permiso: 'indicaciones:ver' },
  { value: 'necesidad', label: 'Necesidades', permiso: 'necesidades:ver' },
  { value: 'alerta', label: 'Alertas', permiso: 'alertas:ver' },
]

function Historial({ ruta, token, cuenta, revision }: SeccionProps) {
  const [tipo, setTipo] = useState('')
  const historial = usePagina<{ tipo: string; referencia_id: string; fecha: string; titulo: string; detalle?: string }>(
    `${ruta}/historial`, token, revision, { filters: tipo ? { tipo } : undefined },
  )
  const tipos = TIPOS_HISTORIAL.filter((opcion) => cuenta.permisos.includes(opcion.permiso))
  return <section className="grid gap-3">
    <h3 className="font-semibold">Historial del expediente</h3>
    {tipos.length > 0 && <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar historial">
      <Chip active={!tipo} onClick={() => { setTipo(''); historial.cambiar(1) }}>Todos</Chip>
      {tipos.map((opcion) => <Chip key={opcion.value} active={tipo === opcion.value} onClick={() => {
        setTipo(opcion.value)
        historial.cambiar(1)
      }}>{opcion.label}</Chip>)}
    </div>}
    <Estado consulta={historial} />
    {historial.datos?.data.length === 0 && <EmptyState title="Sin eventos de seguimiento" text={tipo ? 'No hay actividad de este tipo.' : 'Aquí aparecerá la actividad de este expediente.'} />}
    {historial.datos?.data.length ? <ul className="grid gap-2" aria-label="Eventos del expediente">
      {historial.datos.data.map((evento, indice) => <li key={`${evento.tipo}-${evento.referencia_id}-${evento.fecha}-${indice}`}>
        <Card className="flex gap-3">
          {evento.tipo === 'visita' ? <CalendarClock size={20} className="mt-1 shrink-0 text-navy" aria-hidden /> : <ClipboardList size={20} className="mt-1 shrink-0 text-navy" aria-hidden />}
          <div className="min-w-0 space-y-1">
            {evento.fecha && <time dateTime={evento.fecha} className="text-xs text-muted">{fechaHora(evento.fecha)}</time>}
            <p className="break-words font-semibold text-ink">{evento.titulo}</p>
            {evento.detalle && <p className="break-words text-sm text-ink-2">{evento.detalle}</p>}
          </div>
        </Card>
      </li>)}
    </ul> : null}
    {historial.datos && <Paginador pagina={historial.pagina} total={historial.datos.meta.totalPages} cambiar={historial.cambiar} />}
  </section>
}

type Seccion = 'historial' | 'vinculos' | 'riesgo' | 'indicaciones'
export function Seguimiento({ riesgo, abrirEvaluacion, ...props }: SeccionProps & { riesgo: ConsultaRiesgo; abrirEvaluacion: boolean }) {
  const [seleccion, seleccionar] = useState<Seccion>(abrirEvaluacion ? 'riesgo' : 'historial')
  const permisos = props.cuenta.permisos
  const opciones: Array<{ value: Seccion; label: string }> = [{ value: 'historial', label: 'Historial' }]
  if (permisos.includes('adultos:ver')) opciones.push({ value: 'vinculos', label: 'Asignaciones' })
  if (permisos.includes('adultos:ver-sensible')) opciones.push({ value: 'riesgo', label: 'Riesgo social' })
  if (permisos.includes('indicaciones:ver')) opciones.push({ value: 'indicaciones', label: 'Indicaciones' })
  const vigente = opciones.some((opcion) => opcion.value === seleccion) ? seleccion : 'historial'

  return <section className="grid gap-3" aria-label="Seguimiento del expediente">
    {opciones.length > 1 && <div className="flex flex-wrap gap-2" role="group" aria-label="Secciones de seguimiento">
      {opciones.map((opcion) => <button key={opcion.value} type="button" aria-pressed={vigente === opcion.value} onClick={() => seleccionar(opcion.value)}
        className={cn('min-h-12 rounded-sm border px-3 text-sm font-semibold', vigente === opcion.value
          ? 'border-navy bg-navy text-white' : 'border-line-soft bg-surface-2 text-ink-2')}>{opcion.label}</button>)}
    </div>}
    {vigente === 'historial' && <Historial {...props} />}
    {vigente === 'vinculos' && <Vinculos {...props} />}
    {vigente === 'riesgo' && <Riesgo {...props} consulta={riesgo} abrirEvaluacion={abrirEvaluacion} />}
    {vigente === 'indicaciones' && <Indicaciones {...props} />}
  </section>
}
