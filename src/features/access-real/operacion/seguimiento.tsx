/*
 * seguimiento.tsx — Pantallas y paneles de seguimiento del expediente conectado: asignaciones y familiares, evaluación y
 * factores de riesgo, indicaciones médicas e historial. Cada pantalla de formulario es de pantalla completa (barra
 * secundaria con volver + título) y las pestañas del perfil (historial, riesgo) son paneles.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useRef, useState } from 'react'
import { Evidencias } from './visitas-evidencias'
import { Button, ButtonLink, Chip, EmptyState, Icono, RIESGO_VISUAL, SelectField, StepBar, Switch, type NombreIcono } from '@/components/ui'
import { diasCalendario, fechaCorta, fechaHora, todayISO } from '@/domain/dates'
import { SECCIONES } from '@/features/gestion/lib/riesgo'
import { cn } from '@/lib/cn'
import { api } from '../client'
import { campo, Estado, Formulario, idRuta, Paginador, useDatos, usePagina, type Campo } from './controles'
import { CabezaPersona, IndicadorNivel, Panel, TituloBloque } from './expediente-ui'
import { usePantallaSecundaria } from './marco/pantalla-secundaria'
import type { Candidato, OperacionProps } from './visitas'

type Nivel = 'bajo' | 'medio' | 'alto'
interface Vinculo {
  usuario_id?: string
  nombres: string
  apellidos: string
  usuario?: { nombres: string; apellidos: string }
}
export interface Factor {
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
export interface Indicacion {
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
export type SeccionProps = OperacionProps & { ruta: string; revision: number; actualizar: () => void; adultoActivo: boolean }
type PantallaProps = SeccionProps & { nombreAdulto: string; volver: () => void }
export type ConsultaRiesgo = ReturnType<typeof useDatos<ResumenRiesgo>>
export type DatosVinculos = { cuidadores: Vinculo[]; voluntarios: Vinculo[]; familiares?: Vinculo[] }

const ROL: Record<string, string> = { cuidador: 'Cuidador', voluntario: 'Voluntario', familiar: 'Familiar' }
const ESTADOS_INDICACION: Record<Indicacion['estado'], string> = { activa: 'Activa', suspendida: 'Suspendida', finalizada: 'Finalizada' }
const ICONO_ESTADO_INDICACION: Record<Indicacion['estado'], { icono: NombreIcono; color: string }> = {
  activa: { icono: 'check_circle', color: 'text-success-700' },
  suspendida: { icono: 'pause_circle', color: 'text-warning-700' },
  finalizada: { icono: 'cancel', color: 'text-muted' },
}
const nombreVinculo = (persona: Vinculo) => {
  const datos = persona.usuario ?? persona
  return `${datos.nombres} ${datos.apellidos}`
}

/* ───────────── Asignaciones y familiares (Figma 12 y 21) ───────────── */
/** Persona elegible como fila con avatar y círculo de selección (radio nativo `persona`). */
function FilaCandidata({ candidata, familiar }: { candidata: Candidato; familiar: boolean }) {
  return <label className={cn('relative flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-surface-2 bg-surface px-3 py-2.5',
    'has-[:checked]:border-blue-principal has-[:checked]:bg-blue-100 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue')}>
    <input type="radio" name="persona" value={candidata.usuario_id} required className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0" />
    <CabezaPersona nombre={candidata.nombre} detalle={familiar ? undefined : ROL[candidata.rol] ?? candidata.rol} />
    <Icono nombre="radio_button_unchecked" tamano={24} className="flex-none text-muted peer-checked:hidden" />
    <Icono nombre="check_circle" tamano={24} className="hidden flex-none text-blue-principal peer-checked:block" />
  </label>
}

function ElegirPersona({ ruta, base, token, cuenta, revision, actualizar, familiar, volver }: SeccionProps & { familiar: boolean; volver: () => void }) {
  const candidatos = usePagina<Candidato>(`${base}/candidatos/${familiar ? 'familiar' : 'asignacion'}`, token, revision)
  const personas = candidatos.datos?.data ?? []
  const personal = cuenta.tipo === 'familia' ? 'Cuidador' : 'Cuidador o voluntario'
  const raiz = `/operacion/${idRuta(cuenta.cuenta_id)}`
  const sinCandidatos = candidatos.datos !== undefined && personas.length === 0
  return <section className="grid grid-cols-1 gap-3" aria-label={familiar ? 'Autorizar a otro familiar' : 'Elegir a quién asignar'}>
    <TituloBloque>{familiar ? 'Autorizar a otro familiar' : 'Elige a quién asignar'}</TituloBloque>
    {!sinCandidatos && <p className="-mt-1 text-ayuda text-muted">{familiar ? 'La persona debe haber aceptado su invitación como Familiar en esta cuenta.'
      : 'Solo aparecen quienes aceptaron su invitación y tienen un perfil vigente.'}</p>}
    <Estado consulta={candidatos} />
    {sinCandidatos && <EmptyState title={familiar ? 'Sin familiares elegibles' : 'Sin personal elegible'}
      text={familiar ? 'La persona debe aceptar su invitación como Familiar en esta cuenta.'
        : 'El cuidador debe aceptar su invitación y tener un perfil vigente en Organización (Configuración en una cuenta familiar), en Perfiles globales de cuidadores.'}
      action={cuenta.permisos.includes('usuarios:gestionar') ? <ButtonLink to={`${raiz}/miembros`} variant="outline" size="sm">Ir a Miembros</ButtonLink> : undefined} />}
    {personas.length === 0 && <Button variant="outline" className="md:self-start" onClick={volver}>Cancelar</Button>}
    {personas.length > 0 && <Formulario key={candidatos.pagina} variante="pagina" titulo={familiar ? 'Autorizar familiar' : `Asignar ${personal.toLowerCase()}`}
      accion={familiar ? 'Autorizar acceso' : 'Asignar persona'} cancelar={volver} campos={[]} exito=""
      enviar={async (datos) => {
        const persona = personas.find((p) => p.usuario_id === campo(datos, 'persona'))
        if (!persona) throw new Error('Selecciona una persona disponible.')
        await api(`${ruta}/${familiar ? 'familiares' : 'asignaciones'}`, token, 'POST', {
          usuario_id: persona.usuario_id,
          ...(familiar ? {} : { tipo: persona.rol === 'cuidador' ? 'cuidador_asignado' : 'voluntario_asignado' }),
        })
        actualizar()
        volver()
      }}>
      <div role="radiogroup" aria-label={familiar ? 'Familiar' : personal} className="grid grid-cols-1 gap-2">
        {personas.map((p) => <FilaCandidata key={p.usuario_id} candidata={p} familiar={familiar} />)}
      </div>
    </Formulario>}
    {candidatos.datos && <Paginador pagina={candidatos.pagina} total={candidatos.datos.meta.totalPages} cambiar={candidatos.cambiar} />}
  </section>
}

/** Pantalla «Asignar cuidador o voluntario» (`familiar` false) o «Familiares con acceso» (`familiar` true). */
export function PantallaVinculos({ familiar, nombreAdulto, volver, ...props }: PantallaProps & { familiar: boolean }) {
  const { ruta, token, cuenta, revision, actualizar, adultoActivo } = props
  const puedeAsignar = cuenta.permisos.includes('adultos:asignar')
  const puedeAutorizar = cuenta.permisos.includes('familiares:autorizar')
  const gestiona = familiar ? puedeAutorizar : puedeAsignar
  const [revocando, setRevocando] = useState<Vinculo>()
  const vinculos = useDatos<DatosVinculos>(`${ruta}/asignaciones`, token, revision)
  const titulo = revocando ? (familiar ? 'Revocar acceso familiar' : 'Quitar asignación')
    : familiar ? 'Familiares con acceso'
      : puedeAsignar ? (cuenta.tipo === 'familia' ? 'Asignar cuidador' : 'Asignar cuidador o voluntario') : 'Cuidadores y voluntarios'
  usePantallaSecundaria({ titulo, volver: revocando ? () => setRevocando(undefined) : volver })

  const grupos = familiar
    ? [{ rol: 'Familiar', personas: vinculos.datos?.familiares ?? [] }]
    : [{ rol: 'Cuidador', personas: vinculos.datos?.cuidadores ?? [] }, { rol: 'Voluntario', personas: vinculos.datos?.voluntarios ?? [] }]
  const actuales = grupos.flatMap(({ rol, personas }) => personas.map((persona) => ({ rol, persona })))

  if (revocando?.usuario_id) {
    return <Formulario variante="pagina" titulo={familiar ? 'Revocar acceso familiar' : 'Quitar asignación'} contexto={nombreVinculo(revocando)}
      accion={familiar ? 'Revocar acceso' : 'Quitar asignación'} peligro cancelar={() => setRevocando(undefined)}
      campos={[{ name: 'motivo', label: 'Motivo', type: 'textarea', optional: true, max: 300 }]} enviar={async (datos) => {
        await api(`${ruta}/${familiar ? 'familiares' : 'asignaciones'}/${idRuta(revocando.usuario_id!)}/revocar`, token, 'POST', { motivo: campo(datos, 'motivo') || undefined })
        actualizar()
        setRevocando(undefined)
      }} exito="">
      <p className="text-cuerpo text-ink-2 wrap-anywhere">{nombreVinculo(revocando)} perderá el acceso a este expediente.</p>
    </Formulario>
  }
  return <section className="grid max-w-form grid-cols-1 gap-5" aria-label={familiar ? 'Familiares con acceso' : 'Asignaciones'}>
    {familiar && <>
      <p className="text-seccion text-ink wrap-anywhere">{nombreAdulto}</p>
      <p className="-mt-3 text-ayuda text-muted">Los familiares solo pueden consultar visitas, necesidades e indicaciones de este adulto. No modifican registros.</p>
    </>}
    <section className="grid grid-cols-1 gap-3" aria-label={familiar ? 'Con acceso ahora' : 'Asignados ahora'}>
      <TituloBloque>{familiar ? 'Con acceso ahora' : 'Asignados ahora'}</TituloBloque>
      <Estado consulta={vinculos} />
      {vinculos.datos && actuales.length === 0 && <EmptyState title={familiar ? 'Sin familiares con acceso' : 'Sin asignaciones'}
        text={familiar ? 'Aquí aparecerán los familiares con acceso vigente que tu rol permita consultar.' : 'Aquí aparecerá el personal asignado que tu rol permita consultar.'} />}
      {actuales.length > 0 && <Panel className="py-1">
        {actuales.map(({ rol, persona }, indice) => <div className="flex min-h-16 items-center gap-3 py-2" key={persona.usuario_id ?? `${rol}-${indice}`}>
          <CabezaPersona nombre={nombreVinculo(persona)} detalle={rol} />
          {gestiona && persona.usuario_id && <Button variant="ghost" className="flex-none text-danger"
            aria-label={`${familiar ? 'Revocar acceso de' : 'Quitar asignación de'} ${nombreVinculo(persona)}`} onClick={() => setRevocando(persona)}>
            {familiar ? 'Revocar acceso' : 'Quitar'}
          </Button>}
        </div>)}
      </Panel>}
    </section>
    {gestiona && adultoActivo && <ElegirPersona {...props} familiar={familiar} volver={volver} />}
  </section>
}

/* ───────────── Evaluación de riesgo (Figma 13) ───────────── */
const preguntas = SECCIONES.flatMap((s) => s.preguntas)
type Respuestas = Record<string, string | boolean>

export function PantallaEvaluacion({ ruta, token, actualizar, nombreAdulto, volver }: PantallaProps) {
  const [paso, setPaso] = useState(0)
  const [respuestas, setRespuestas] = useState<Respuestas>(() => Object.fromEntries(
    preguntas.filter((p) => p.tipo === 'switch').map((p) => [p.clave, false])))
  const seccion = SECCIONES[paso]!
  const ultimo = paso === SECCIONES.length - 1
  const progreso = useRef<HTMLParagraphElement>(null)
  const primera = useRef(true)
  usePantallaSecundaria({ titulo: 'Evaluación de riesgo', volver: () => (paso > 0 ? setPaso(paso - 1) : volver()) })
  useEffect(() => {
    if (primera.current) { primera.current = false; return }
    progreso.current?.focus()
    window.scrollTo({ top: 0 })
  }, [paso])
  const responder = (clave: string, valor: string | boolean) => setRespuestas((anteriores) => ({ ...anteriores, [clave]: valor }))

  return <Formulario variante="pagina" titulo="Evaluación de riesgo (100 puntos)" contexto={nombreAdulto} campos={[]} exito=""
    accion={ultimo ? 'Guardar evaluación' : 'Continuar'} enviar={async () => {
      if (!ultimo) { setPaso(paso + 1); return }
      const cuerpo = Object.fromEntries(preguntas.map((pregunta) => [
        pregunta.clave.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`),
        pregunta.tipo === 'switch' ? respuestas[pregunta.clave] === true : String(respuestas[pregunta.clave] ?? ''),
      ]))
      await api(`${ruta}/evaluaciones`, token, 'POST', { respuestas: cuerpo })
      actualizar()
      volver()
    }}>
    <div className="grid grid-cols-1 gap-2">
      <p ref={progreso} tabIndex={-1} className="text-ayuda text-muted outline-none" aria-live="polite">Sección {paso + 1} de {SECCIONES.length} · {seccion.titulo}</p>
      <StepBar step={paso + 1} total={SECCIONES.length} />
    </div>
    <p className="text-ayuda text-muted">Responde todas las preguntas. El sistema calcula el nivel al guardar.</p>
    <div className="grid grid-cols-1 gap-5">
      {seccion.preguntas.some((p) => p.tipo === 'switch') && <Panel className="py-0" aria-label={`Preguntas de sí o no: ${seccion.titulo}`}>
        {seccion.preguntas.filter((p) => p.tipo === 'switch').map((pregunta) => {
          const activa = respuestas[pregunta.clave] === true
          return <div key={pregunta.clave} className="flex min-h-16 items-center gap-3 py-2">
            <label htmlFor={`pregunta-${pregunta.clave}`} className="min-w-0 flex-1 text-cuerpo font-semibold text-ink wrap-anywhere">{pregunta.texto}</label>
            <span aria-hidden className={cn('flex-none text-ayuda', activa ? 'font-semibold text-blue-principal' : 'text-muted')}>{activa ? 'Sí' : 'No'}</span>
            <Switch id={`pregunta-${pregunta.clave}`} checked={activa} onChange={(valor) => responder(pregunta.clave, valor)} />
          </div>
        })}
      </Panel>}
      {seccion.preguntas.map((pregunta) => pregunta.tipo === 'select'
        && <SelectField key={pregunta.clave} name={pregunta.clave} label={pregunta.texto} required placeholder="Selecciona una opción"
          value={String(respuestas[pregunta.clave] ?? '')} onChange={(evento) => responder(pregunta.clave, evento.currentTarget.value)}
          options={pregunta.opciones.map((o) => ({ value: o.valor, label: o.etiqueta }))} />)}
    </div>
  </Formulario>
}

/* ───────────── Riesgo: pestaña, registrar factor y resolver factor (Figma 07, 17 y 18) ───────────── */
const NIVELES = [
  { value: 'alto', label: 'Alto', icono: RIESGO_VISUAL.alto.icono, claseIcono: RIESGO_VISUAL.alto.color },
  { value: 'medio', label: 'Medio', icono: RIESGO_VISUAL.medio.icono, claseIcono: RIESGO_VISUAL.medio.color },
  { value: 'bajo', label: 'Bajo', icono: RIESGO_VISUAL.bajo.icono, claseIcono: RIESGO_VISUAL.bajo.color },
]
const BARRA_NIVEL: Record<Nivel, string> = { alto: 'bg-riesgo-alto', medio: 'bg-riesgo-medio', bajo: 'bg-riesgo-bajo' }

export function PanelRiesgo({ cuenta, adultoActivo, consulta, evaluar, registrarFactor, resolver }: {
  cuenta: OperacionProps['cuenta']; adultoActivo: boolean; consulta: ConsultaRiesgo
  evaluar: () => void; registrarFactor: () => void; resolver: (factor: Factor) => void
}) {
  const puedeEvaluar = cuenta.permisos.includes('adultos:evaluar')
  const accionable = adultoActivo && puedeEvaluar
  const datos = consulta.datos
  const evaluacion = datos?.ultima_evaluacion?.vigente ? datos.ultima_evaluacion : undefined
  return <section className="grid grid-cols-1 gap-4" aria-label="Riesgo social">
    <Estado consulta={consulta} />
    {datos && <div className="grid grid-cols-1 gap-3 rounded-2xl border border-surface-2 bg-surface p-4">
      <p className="text-ayuda text-muted">Nivel de riesgo vigente</p>
      <p className="flex items-center gap-2 text-pantalla text-ink">
        {datos.nivel_vigente ? <><Icono nombre={RIESGO_VISUAL[datos.nivel_vigente].icono} tamano={28} className={RIESGO_VISUAL[datos.nivel_vigente].color} />
          <span className="capitalize">{datos.nivel_vigente}</span></> : <span className="text-tarjeta">Sin evaluación vigente</span>}
      </p>
      {datos.nivel_vigente && evaluacion && <div role="progressbar" aria-label="Puntaje de la última evaluación" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={evaluacion.puntaje} aria-valuetext={`${evaluacion.puntaje} de 100 puntos`} className="h-2 overflow-hidden rounded-pill bg-surface-2">
        <div className={cn('h-full rounded-pill', BARRA_NIVEL[datos.nivel_vigente])} style={{ width: `${Math.min(100, Math.max(0, evaluacion.puntaje))}%` }} />
      </div>}
      {evaluacion && <p className="text-ayuda text-ink-2 wrap-anywhere">{evaluacion.puntaje} de 100 puntos en la última evaluación</p>}
      {datos.texto && <p className="text-ayuda text-muted wrap-anywhere">{datos.texto}</p>}
      {accionable && <Button variant="light" fullWidth onClick={evaluar}>Hacer nueva evaluación</Button>}
    </div>}
    {datos && <section className="grid grid-cols-1 gap-3" aria-label="Factores de riesgo activos">
      <TituloBloque>Factores de riesgo activos</TituloBloque>
      {(datos.factores_vigentes ?? []).length === 0 && <p className="text-ayuda text-muted">Sin factores de riesgo vigentes.</p>}
      {!!datos.factores_vigentes?.length && <Panel className="py-0">
        {datos.factores_vigentes.map((factor) => {
          const puedeResolver = puedeEvaluar && factor.estado === 'activo'
          const contenido = <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-cuerpo font-bold text-ink wrap-anywhere">{factor.riesgo}</span>
            <span className="text-ayuda text-ink"><IndicadorNivel nivel={factor.nivel} texto={`Nivel ${factor.nivel}`} /></span>
            {factor.motivo && <span className="text-ayuda text-muted wrap-anywhere">{factor.motivo}</span>}
            {factor.observacion && <span className="text-ayuda text-muted wrap-anywhere">{factor.observacion}</span>}
          </span>
          return puedeResolver
            ? <button key={factor.envejeciente_riesgo_id} type="button" aria-label={`Resolver factor: ${factor.riesgo}`} onClick={() => resolver(factor)}
              className="flex min-h-14 w-full items-center gap-3 py-3 text-left hover:bg-blue-100/40">{contenido}<Icono nombre="chevron_right" tamano={24} className="flex-none text-muted" /></button>
            : <div key={factor.envejeciente_riesgo_id} className="flex min-h-14 items-center gap-3 py-3">{contenido}</div>
        })}
      </Panel>}
      {accionable && <Button variant="light" fullWidth onClick={registrarFactor}>Registrar factor de riesgo</Button>}
    </section>}
  </section>
}

export function PantallaFactor({ ruta, token, actualizar, nombreAdulto, volver }: PantallaProps) {
  const catalogo = useDatos<{ riesgo_id: number; nombre: string; codigo?: string }[]>('/catalogos/riesgos', token)
  const opciones = catalogo.datos?.filter((r) => r.codigo !== 'evaluacion' && r.nombre !== 'Evaluación de riesgo')
    .map((r) => ({ value: String(r.riesgo_id), label: r.nombre })) ?? []
  usePantallaSecundaria({ titulo: 'Registrar factor de riesgo', volver })
  const campos: Campo[] = [
    { name: 'riesgo_id', label: 'Factor de riesgo', options: opciones, tarjetas: 'lista' },
    { name: 'nivel', label: 'Nivel del factor', options: NIVELES, tarjetas: 'fila' },
    { name: 'motivo', label: 'Motivo', type: 'textarea', min: 5, max: 200, placeholder: 'Ej.: Se cayó dos veces este mes en el baño.', hint: 'Mínimo 5 caracteres.' },
    { name: 'observacion', label: 'Observación', type: 'textarea', optional: true, max: 300, placeholder: 'Algo más que el equipo deba saber' },
  ]
  return <div className="grid grid-cols-1 gap-3">
    <Estado consulta={catalogo} vacio={catalogo.datos && opciones.length === 0 ? 'El catálogo de factores todavía no está disponible.' : undefined} />
    <Formulario variante="pagina" titulo="Registrar factor de riesgo" contexto={nombreAdulto} accion="Registrar factor" cancelar={volver}
      submitDisabled={opciones.length === 0} campos={campos} exito="" enviar={async (datos) => {
        await api(`${ruta}/riesgos`, token, 'POST', { riesgo_id: Number(campo(datos, 'riesgo_id')), nivel: campo(datos, 'nivel'),
          motivo: campo(datos, 'motivo'), observacion: campo(datos, 'observacion') || undefined })
        actualizar()
        volver()
      }} />
  </div>
}

export function PantallaResolver({ factor, base, token, actualizar, nombreAdulto, volver }: PantallaProps & { factor: Factor }) {
  usePantallaSecundaria({ titulo: 'Resolver factor', volver })
  return <Formulario variante="pagina" titulo={`Resolver factor: ${factor.riesgo}`} accion="Confirmar resolución" cancelar={volver} exito=""
    contexto={<>{factor.riesgo}<span className="mt-2 block text-ayuda font-normal text-ink wrap-anywhere"><IndicadorNivel nivel={factor.nivel} texto={`Nivel ${factor.nivel}`} /> · {nombreAdulto}</span></>}
    campos={[{ name: 'observacion', label: 'Observación de resolución', type: 'textarea', optional: true, max: 300,
      placeholder: 'Ej.: La farmacia comunitaria le entrega la penicilina cada mes.' }]}
    enviar={async (datos) => {
      await api(`${base}/riesgos/${idRuta(String(factor.envejeciente_riesgo_id))}/resolver`, token, 'POST', { observacion: campo(datos, 'observacion') || undefined })
      actualizar()
      volver()
    }} />
}

/* ───────────── Indicaciones médicas (Figma 19 y 20) ───────────── */
type GestionIndicacion = { tipo: 'nueva' } | { tipo: 'editar'; indicacion: Indicacion } | {
  tipo: 'estado'; indicacion: Indicacion; estado: Indicacion['estado']
}
const ACCIONES_INDICACION = { activa: 'Reactivar', suspendida: 'Suspender', finalizada: 'Finalizar' }
const FILTROS_INDICACION = [
  { value: 'activa', label: 'Activas' }, { value: 'suspendida', label: 'Suspendidas' }, { value: 'finalizada', label: 'Finalizadas' }, { value: '', label: 'Todas' },
]
const tileIndicacion = (tipo?: string): { icono: NombreIcono; clase: string } => {
  const t = (tipo ?? '').toLowerCase()
  if (t.includes('medic')) return { icono: 'medication', clase: 'bg-warning-100 text-warning-700' }
  if (t.includes('cuidad')) return { icono: 'volunteer_activism', clase: 'bg-teal-100 text-success-700' }
  return { icono: 'assignment', clase: 'bg-blue-100 text-blue-principal' }
}

export function PantallaIndicaciones({ ruta, base, token, cuenta, revision, actualizar, adultoActivo, nombreAdulto, volver }: PantallaProps) {
  const [gestion, setGestion] = useState<GestionIndicacion>()
  const [adjuntos, setAdjuntos] = useState<string>()
  const [filtro, setFiltro] = useState('activa')
  const puedeGestionar = cuenta.permisos.includes('indicaciones:gestionar')
  const indicaciones = usePagina<Indicacion>(`${ruta}/indicaciones`, token, revision, { filters: filtro ? { estado: filtro } : undefined })
  const tipos = useDatos<{ tipo_indicacion_id: number; nombre: string }[]>(gestion && gestion.tipo !== 'estado' ? '/catalogos/tipos-indicacion' : null, token)
  const editada = gestion?.tipo === 'editar' ? gestion.indicacion : undefined
  const cerrar = () => setGestion(undefined)
  usePantallaSecundaria({
    titulo: !gestion ? 'Indicaciones médicas' : gestion.tipo === 'nueva' ? 'Registrar indicación' : gestion.tipo === 'editar' ? 'Editar indicación' : `${ACCIONES_INDICACION[gestion.estado]} indicación`,
    volver: gestion ? cerrar : volver,
  })
  const camposIndicacion: Campo[] = [
    { name: 'tipo_indicacion_id', label: 'Tipo de indicación', value: editada && String(editada.tipo_indicacion_id), tarjetas: 'pildoras',
      options: tipos.datos?.map((t) => ({ value: String(t.tipo_indicacion_id), label: t.nombre })) ?? [] },
    { name: 'titulo', label: 'Título', value: editada?.titulo, min: 3, max: 80, placeholder: 'Ej.: Aspirina 100 mg' },
    { name: 'descripcion', label: 'Descripción', value: editada?.descripcion ?? '', type: 'textarea', optional: true, max: 300, placeholder: 'Ej.: Tomar con el desayuno.', hint: 'Máximo 300 caracteres.' },
    { name: 'frecuencia_horario', label: 'Frecuencia u horario', value: editada?.frecuencia_horario ?? '', optional: true, max: 60, placeholder: 'Ej.: 1 al día, en la mañana' },
    { name: 'fecha_inicio', label: 'Fecha de inicio', value: editada?.fecha_inicio ?? todayISO(), type: 'date', ancho: 'mitad' },
    { name: 'fecha_fin', label: 'Fecha final', value: editada?.fecha_fin ?? '', type: 'date', optional: true, ancho: 'mitad' },
  ]

  if (gestion?.tipo === 'nueva' || gestion?.tipo === 'editar') {
    return <div className="grid grid-cols-1 gap-3">
      <Estado consulta={tipos} vacio={tipos.datos?.length === 0 ? 'El catálogo de indicaciones aún no está disponible.' : undefined} />
      {!tipos.datos?.length && <Button variant="outline" className="md:self-start" onClick={cerrar}>Cancelar</Button>}
      {!!tipos.datos?.length && <Formulario key={editada?.indicacion_medica_id ?? 'nueva'} variante="pagina" contexto={nombreAdulto}
        titulo={editada ? 'Editar indicación' : 'Registrar indicación'} accion={editada ? 'Guardar cambios' : 'Registrar indicación'}
        campos={camposIndicacion} cancelar={cerrar} exito="" enviar={async (datos) => {
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
        }} />}
    </div>
  }
  if (gestion?.tipo === 'estado') {
    return <Formulario variante="pagina" titulo={`${ACCIONES_INDICACION[gestion.estado]} indicación`} contexto={gestion.indicacion.titulo}
      accion="Confirmar cambio" cancelar={cerrar} campos={[]} exito=""
      enviar={async () => {
        await api(`${base}/indicaciones/${idRuta(gestion.indicacion.indicacion_medica_id)}/estado`, token, 'POST', { estado: gestion.estado })
        actualizar()
        cerrar()
      }}>
      <p className="text-cuerpo text-ink-2 wrap-anywhere">{gestion.estado === 'finalizada' ? 'Una vez finalizada, la indicación quedará en el historial.'
        : gestion.estado === 'suspendida' ? 'La indicación quedará suspendida hasta que se reactive.' : 'La indicación volverá a estar activa.'}</p>
    </Formulario>
  }

  return <section className="grid max-w-form grid-cols-1 gap-4" aria-label="Indicaciones médicas">
    <p className="text-seccion text-ink wrap-anywhere">{nombreAdulto}</p>
    {puedeGestionar && adultoActivo && <Button fullWidth onClick={() => setGestion({ tipo: 'nueva' })}>Registrar indicación</Button>}
    <p className="text-ayuda text-muted wrap-anywhere">Las indicaciones registradas son informativas y no constituyen un diagnóstico ni una prescripción médica.</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Estado de la indicación">
      {FILTROS_INDICACION.map((opcion) => <Chip key={opcion.value || 'todas'} active={filtro === opcion.value}
        onClick={() => { setFiltro(opcion.value); indicaciones.cambiar(1) }}>{opcion.label}</Chip>)}
    </div>
    <Estado consulta={indicaciones} />
    {indicaciones.datos?.data.length === 0 && <EmptyState title="Sin indicaciones" text={filtro ? 'Prueba otro estado.' : 'Aquí aparecerán las indicaciones de este adulto.'} />}
    {indicaciones.datos?.data.map((indicacion) => {
      const tile = tileIndicacion(indicacion.tipo)
      const estado = ICONO_ESTADO_INDICACION[indicacion.estado]
      const editable = puedeGestionar && adultoActivo && indicacion.estado !== 'finalizada'
      return <article key={indicacion.indicacion_medica_id} className="grid grid-cols-1 gap-3 rounded-2xl border border-surface-2 bg-surface p-4" aria-label={indicacion.titulo}>
        <div className="flex items-center gap-3">
          <span className={cn('grid size-10 flex-none place-items-center rounded-md', tile.clase)} aria-hidden><Icono nombre={tile.icono} tamano={22} /></span>
          <div className="min-w-0">
            {indicacion.tipo && <p className="text-ayuda text-muted wrap-anywhere">{indicacion.tipo}</p>}
            <h4 className="text-tarjeta text-ink wrap-anywhere">{indicacion.titulo}</h4>
          </div>
        </div>
        {indicacion.descripcion && <p className="text-ayuda text-ink-2 wrap-anywhere">{indicacion.descripcion}</p>}
        {indicacion.frecuencia_horario && <p className="flex items-start gap-3 text-ayuda text-ink wrap-anywhere"><Icono nombre="schedule" tamano={20} className="flex-none text-muted" />{indicacion.frecuencia_horario}</p>}
        <p className="flex items-start gap-3 text-ayuda text-ink wrap-anywhere"><Icono nombre="calendar_month" tamano={20} className="flex-none text-muted" />
          Desde {fechaCorta(indicacion.fecha_inicio)}{indicacion.fecha_fin && ` · Hasta ${fechaCorta(indicacion.fecha_fin)}`}</p>
        <p className="flex items-center gap-2 text-ayuda text-ink"><Icono nombre={estado.icono} tamano={18} className={estado.color} />{ESTADOS_INDICACION[indicacion.estado]}</p>
        {editable && <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" size="sm" onClick={() => setGestion({ tipo: 'estado', indicacion, estado: indicacion.estado === 'activa' ? 'suspendida' : 'activa' })}>
            {indicacion.estado === 'activa' ? 'Suspender' : 'Reactivar'}</Button>
          <Button variant="outline" size="sm" onClick={() => setGestion({ tipo: 'estado', indicacion, estado: 'finalizada' })}>Finalizar</Button>
        </div>}
        <div className="flex flex-wrap gap-2">
          {editable && <Button variant="ghost" onClick={() => setGestion({ tipo: 'editar', indicacion })}>Editar indicación</Button>}
          <Button variant="ghost" aria-expanded={adjuntos === indicacion.indicacion_medica_id}
            onClick={() => setAdjuntos(adjuntos === indicacion.indicacion_medica_id ? undefined : indicacion.indicacion_medica_id)}>
            {adjuntos === indicacion.indicacion_medica_id ? 'Ocultar adjuntos' : 'Ver adjuntos'}
          </Button>
        </div>
        {adjuntos === indicacion.indicacion_medica_id && <Evidencias key={adjuntos}
          ruta={`${base}/indicaciones/${idRuta(adjuntos)}`} token={token} revision={revision} refrescar={actualizar}
          puedeAdjuntar={puedeGestionar && adultoActivo && indicacion.estado !== 'finalizada'} />}
      </article>
    })}
    {indicaciones.datos && <Paginador pagina={indicaciones.pagina} total={indicaciones.datos.meta.totalPages} cambiar={indicaciones.cambiar} />}
  </section>
}

/* ───────────── Historial (Figma 03) ───────────── */
const TIPOS_HISTORIAL = [
  { value: 'visita', label: 'Visitas', permiso: 'visitas:ver' },
  { value: 'riesgo', label: 'Factores de riesgo', permiso: 'adultos:ver-sensible' },
  { value: 'evaluacion', label: 'Evaluaciones', permiso: 'adultos:ver-sensible' },
  { value: 'indicacion', label: 'Indicaciones', permiso: 'indicaciones:ver' },
  { value: 'necesidad', label: 'Necesidades', permiso: 'necesidades:ver' },
  { value: 'alerta', label: 'Alertas', permiso: 'alertas:ver' },
]
const ICONO_EVENTO: Record<string, { icono: NombreIcono; clase: string }> = {
  visita: { icono: 'calendar_month', clase: 'bg-teal-100 text-success-700' },
  necesidad: { icono: 'volunteer_activism', clase: 'bg-warning-100 text-warning-700' },
  alerta: { icono: 'notifications_active', clase: 'bg-danger-100 text-danger' },
  indicacion: { icono: 'medication', clase: 'bg-warning-100 text-warning-700' },
  evaluacion: { icono: 'monitoring', clase: 'bg-blue-100 text-blue-principal' },
  riesgo: { icono: 'warning', clase: 'bg-danger-100 text-danger' },
}

/** «Esta semana», «Semana pasada», «Hace 2 semanas»… según los días calendario transcurridos. */
function grupoSemana(fecha: string | undefined) {
  if (!fecha) return 'Sin fecha'
  const semanas = Math.max(0, Math.floor(diasCalendario(fecha) / 7))
  return semanas === 0 ? 'Esta semana' : semanas === 1 ? 'Semana pasada' : `Hace ${semanas} semanas`
}

export function PanelHistorial({ ruta, token, cuenta, revision }: SeccionProps) {
  const [tipo, setTipo] = useState('')
  const historial = usePagina<{ tipo: string; referencia_id: string; fecha: string; titulo: string; detalle?: string }>(
    `${ruta}/historial`, token, revision, { filters: tipo ? { tipo } : undefined },
  )
  const tipos = TIPOS_HISTORIAL.filter((opcion) => cuenta.permisos.includes(opcion.permiso))
  const eventos = historial.datos?.data ?? []
  const grupos = eventos.reduce<Array<{ titulo: string; eventos: typeof eventos }>>((acumulado, evento) => {
    const titulo = grupoSemana(evento.fecha)
    const ultimo = acumulado[acumulado.length - 1]
    if (ultimo?.titulo === titulo) ultimo.eventos.push(evento)
    else acumulado.push({ titulo, eventos: [evento] })
    return acumulado
  }, [])
  return <section className="grid grid-cols-1 gap-4" aria-label="Historial del expediente">
    {tipos.length > 0 && <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar historial">
      <Chip active={!tipo} onClick={() => { setTipo(''); historial.cambiar(1) }}>Todo</Chip>
      {tipos.map((opcion) => <Chip key={opcion.value} active={tipo === opcion.value} onClick={() => {
        setTipo(opcion.value)
        historial.cambiar(1)
      }}>{opcion.label}</Chip>)}
    </div>}
    <Estado consulta={historial} />
    {historial.datos?.data.length === 0 && <EmptyState title="Sin eventos de seguimiento" text={tipo ? 'No hay actividad de este tipo.' : 'Aquí aparecerá la actividad de este expediente.'} />}
    {grupos.map((grupo, posicion) => <section key={`${grupo.titulo}-${posicion}`} className="grid grid-cols-1 gap-2" aria-label={grupo.titulo}>
      <TituloBloque>{grupo.titulo}</TituloBloque>
      <Panel className="py-0">
        <ul aria-label={`Eventos: ${grupo.titulo}`} className="divide-y divide-surface-2">
          {grupo.eventos.map((evento, indice) => {
            const v = ICONO_EVENTO[evento.tipo] ?? { icono: 'history' as NombreIcono, clase: 'bg-blue-100 text-blue-principal' }
            return <li key={`${evento.tipo}-${evento.referencia_id}-${evento.fecha}-${indice}`} className="flex gap-3 py-3">
              <span className={cn('grid size-10 flex-none place-items-center rounded-md', v.clase)} aria-hidden><Icono nombre={v.icono} tamano={22} /></span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-cuerpo font-bold text-ink wrap-anywhere">{evento.titulo}</p>
                {evento.detalle && <p className="text-ayuda text-muted wrap-anywhere">{evento.detalle}</p>}
                {evento.fecha && <time dateTime={evento.fecha} className="block text-ayuda text-muted">{fechaHora(evento.fecha)}</time>}
              </div>
            </li>
          })}
        </ul>
      </Panel>
    </section>)}
    {historial.datos && <Paginador pagina={historial.pagina} total={historial.datos.meta.totalPages} cambiar={historial.cambiar} />}
  </section>
}

