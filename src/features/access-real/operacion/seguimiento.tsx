/*
 * seguimiento.tsx — Asignaciones, riesgo, indicaciones e historial del expediente conectado.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { SECCIONES } from '@/features/gestion/lib/riesgo'
import { api } from '../client'
import { campo, Estado, Formulario, idRuta, opciones, Paginador, useDatos, usePagina, type Campo } from './controles'
import type { Candidato, OperacionProps } from './visitas'

interface Vinculo { usuario_id?: string; nombres: string; apellidos: string; usuario?: { nombres: string; apellidos: string } }
interface Factor { envejeciente_riesgo_id: string; riesgo: string; nivel: string; estado: string }
interface Indicacion {
  indicacion_medica_id: string; tipo_indicacion_id: number; titulo: string; descripcion?: string | null
  frecuencia_horario?: string | null; fecha_inicio: string; fecha_fin?: string | null; estado: string
}
type SeccionProps = OperacionProps & { ruta: string; revision: number; actualizar: () => void }
const siNo = [{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]

function Vínculos({ ruta, base, token, cuenta, revision, actualizar }: SeccionProps) {
  const puedeAsignar = cuenta.permisos.includes('adultos:asignar')
  const puedeAutorizar = cuenta.permisos.includes('familiares:autorizar')
  const vinculos = useDatos<{ cuidadores: Vinculo[]; voluntarios: Vinculo[]; familiares?: Vinculo[] }>(`${ruta}/asignaciones`, token, revision)
  const personal = usePagina<Candidato>(puedeAsignar ? `${base}/candidatos/asignacion` : null, token, revision)
  const familiares = usePagina<Candidato>(puedeAutorizar ? `${base}/candidatos/familiar` : null, token, revision)
  const formulario = (esFamiliar: boolean) => {
    const opcionesPersona = esFamiliar ? familiares : personal
    return <div className="grid gap-2">
      <Formulario titulo={esFamiliar ? 'Autorizar familiar' : 'Asignar cuidador o voluntario'} campos={[
        { name: 'persona', label: 'Persona', options: opcionesPersona.datos?.data.map((p) => ({ value: p.usuario_id, label: p.nombre })) ?? [] },
      ]} enviar={async (datos) => {
        const persona = opcionesPersona.datos?.data.find((p) => p.usuario_id === campo(datos, 'persona'))
        if (!persona) throw new Error('Elige una persona disponible.')
        await api(`${ruta}/${esFamiliar ? 'familiares' : 'asignaciones'}`, token, 'POST', {
          usuario_id: persona.usuario_id,
          ...(esFamiliar ? {} : { tipo: persona.rol === 'cuidador' ? 'cuidador_asignado' : 'voluntario_asignado' }),
        })
        actualizar()
      }} />
      <Estado consulta={opcionesPersona} vacio={opcionesPersona.datos?.data.length === 0 ? 'Sin personas disponibles.' : undefined} />
      {opcionesPersona.datos && <Paginador pagina={opcionesPersona.pagina} total={opcionesPersona.datos.meta.totalPages} cambiar={opcionesPersona.cambiar} />}
    </div>
  }
  return <section className="grid gap-3">
    <h3 className="font-semibold">Asignaciones y permisos familiares</h3>
    <Estado consulta={vinculos} />
    {vinculos.datos && [
      { filas: [...vinculos.datos.cuidadores, ...vinculos.datos.voluntarios], accion: puedeAsignar, subruta: 'asignaciones' },
      { filas: vinculos.datos.familiares ?? [], accion: puedeAutorizar, subruta: 'familiares' },
    ].flatMap(({ filas, accion, subruta }) => filas.map((v, i) => {
      const persona = v.usuario ?? v
      const nombre = `${persona.nombres} ${persona.apellidos}`
      return <div key={v.usuario_id ?? `${subruta}-${i}`} className="grid gap-2">
        <p>{nombre}</p>
        {accion && v.usuario_id && <Formulario titulo={`Revocar acceso de ${nombre}`} accion="Revocar"
          campos={[{ name: 'motivo', label: 'Motivo', optional: true, max: 300 }]} enviar={async (datos) => {
            await api(`${ruta}/${subruta}/${idRuta(v.usuario_id!)}/revocar`, token, 'POST', { motivo: campo(datos, 'motivo') || undefined })
            actualizar()
          }} />}
      </div>
    }))}
    {puedeAsignar && formulario(false)}
    {puedeAutorizar && formulario(true)}
  </section>
}

const preguntas = SECCIONES.flatMap((s) => s.preguntas)
const camposEvaluacion: Campo[] = preguntas.map((p) => ({
  name: p.clave,
  label: p.texto,
  options: p.tipo === 'switch' ? siNo : p.opciones.map((o) => ({ value: o.valor, label: o.etiqueta })),
}))

function Riesgo({ ruta, base, token, cuenta, revision, actualizar }: SeccionProps) {
  const evaluar = cuenta.permisos.includes('adultos:evaluar')
  const consulta = useDatos<{ nivel_vigente: string | null; factores_vigentes?: Factor[]; ultima_evaluacion?: { puntaje: number; vigente: boolean } }>(`${ruta}/riesgo`, token, revision)
  const catalogo = useDatos<{ riesgo_id: number; nombre: string }[]>(evaluar ? '/catalogos/riesgos' : null, token)
  return <section className="grid gap-3">
    <h3 className="font-semibold">Riesgo social</h3>
    <Estado consulta={consulta} />
    {consulta.datos && <p>{consulta.datos.nivel_vigente ? `Nivel vigente: ${consulta.datos.nivel_vigente}` : 'Sin evaluación vigente'}</p>}
    {consulta.datos?.ultima_evaluacion?.vigente && <p>{consulta.datos.ultima_evaluacion.puntaje}/100 puntos</p>}
    {consulta.datos?.factores_vigentes?.map((f) => <div key={f.envejeciente_riesgo_id} className="grid gap-2">
      <p>{f.riesgo} · {f.nivel} · {f.estado}</p>
      {evaluar && f.estado === 'activo' && <Formulario titulo={`Resolver factor: ${f.riesgo}`} accion="Resolver" campos={[
        { name: 'observacion', label: 'Observación', optional: true, max: 300 },
      ]} enviar={async (datos) => {
        await api(`${base}/riesgos/${idRuta(f.envejeciente_riesgo_id)}/resolver`, token, 'POST', { observacion: campo(datos, 'observacion') || undefined })
        actualizar()
      }} />}
    </div>)}
    {evaluar && <>
      <Formulario titulo="Evaluación de riesgo (100 puntos)" campos={camposEvaluacion} accion="Guardar evaluación" enviar={async (datos) => {
        const respuestas = Object.fromEntries(preguntas.map((p) => [
          p.clave.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`),
          p.tipo === 'switch' ? campo(datos, p.clave) === 'si' : campo(datos, p.clave),
        ]))
        await api(`${ruta}/evaluaciones`, token, 'POST', { respuestas })
        actualizar()
      }} />
      <Formulario titulo="Registrar factor de riesgo" campos={[
        { name: 'riesgo_id', label: 'Factor', options: catalogo.datos?.filter((r) => r.nombre !== 'Evaluación de riesgo').map((r) => ({ value: String(r.riesgo_id), label: r.nombre })) ?? [] },
        { name: 'nivel', label: 'Nivel del factor', options: opciones('bajo', 'medio', 'alto') },
        { name: 'motivo', label: 'Motivo', max: 200 },
      ]} disabled={!catalogo.datos?.some((r) => r.nombre !== 'Evaluación de riesgo')} enviar={async (datos) => {
        await api(`${ruta}/riesgos`, token, 'POST', { riesgo_id: Number(campo(datos, 'riesgo_id')), nivel: campo(datos, 'nivel'), motivo: campo(datos, 'motivo') })
        actualizar()
      }} />
    </>}
  </section>
}

function Indicaciones({ ruta, base, token, cuenta, revision, actualizar }: SeccionProps) {
  const [editada, editar] = useState<Indicacion>()
  const gestionar = cuenta.permisos.includes('indicaciones:gestionar')
  const indicaciones = usePagina<Indicacion>(`${ruta}/indicaciones`, token, revision)
  const tipos = useDatos<{ tipo_indicacion_id: number; nombre: string }[]>(gestionar ? '/catalogos/tipos-indicacion' : null, token)
  return <section className="grid gap-3">
    <h3 className="font-semibold">Indicaciones médicas</h3>
    <Estado consulta={indicaciones} vacio={indicaciones.datos?.data.length === 0 ? 'Sin indicaciones.' : undefined} />
    {indicaciones.datos?.data.map((i) => <div key={i.indicacion_medica_id} className="grid gap-2">
      <p><strong>{i.titulo}</strong> · {i.estado}</p>
      <p>{i.descripcion} {i.frecuencia_horario}</p>
      {gestionar && <>
        <button type="button" className="min-h-12 justify-self-start text-navy underline" onClick={() => editar(i)}>Editar {i.titulo}</button>
        {i.estado !== 'finalizada' && <Formulario titulo={`Estado de ${i.titulo}`} campos={[
          { name: 'estado', label: 'Nuevo estado', options: opciones(...(i.estado === 'activa' ? ['suspendida', 'finalizada'] : ['activa', 'finalizada'])) },
        ]} enviar={async (datos) => {
          await api(`${base}/indicaciones/${idRuta(i.indicacion_medica_id)}/estado`, token, 'POST', { estado: campo(datos, 'estado') })
          actualizar()
        }} />}
      </>}
    </div>)}
    {indicaciones.datos && <Paginador pagina={indicaciones.pagina} total={indicaciones.datos.meta.totalPages} cambiar={indicaciones.cambiar} />}
    {gestionar && <>
      <Estado consulta={tipos} vacio={tipos.datos?.length === 0 ? 'El catálogo de indicaciones aún no está disponible.' : undefined} />
      <Formulario key={editada?.indicacion_medica_id ?? 'nueva'} titulo={editada ? 'Editar indicación' : 'Registrar indicación'}
        disabled={!tipos.datos?.length} campos={[
          { name: 'tipo_indicacion_id', label: 'Tipo', value: editada && String(editada.tipo_indicacion_id), options: tipos.datos?.map((t) => ({ value: String(t.tipo_indicacion_id), label: t.nombre })) ?? [] },
          { name: 'titulo', label: 'Título', value: editada?.titulo, max: 80 },
          { name: 'descripcion', label: 'Descripción', value: editada?.descripcion ?? '', type: 'textarea', optional: true, max: 300 },
          { name: 'frecuencia_horario', label: 'Frecuencia u horario', value: editada?.frecuencia_horario ?? '', optional: true, max: 60 },
          { name: 'fecha_inicio', label: 'Fecha de inicio', value: editada?.fecha_inicio, type: 'date' },
          { name: 'fecha_fin', label: 'Fecha final', value: editada?.fecha_fin ?? '', type: 'date', optional: true },
        ]} enviar={async (datos) => {
          const path = editada ? `${base}/indicaciones/${idRuta(editada.indicacion_medica_id)}` : `${ruta}/indicaciones`
          await api(path, token, editada ? 'PATCH' : 'POST', {
            tipo_indicacion_id: Number(campo(datos, 'tipo_indicacion_id')), titulo: campo(datos, 'titulo'),
            descripcion: campo(datos, 'descripcion') || null, frecuencia_horario: campo(datos, 'frecuencia_horario') || null,
            fecha_inicio: campo(datos, 'fecha_inicio'), fecha_fin: campo(datos, 'fecha_fin') || null,
          })
          editar(undefined)
          actualizar()
        }} />
    </>}
  </section>
}

export function Seguimiento(props: OperacionProps & { ruta: string }) {
  const [revision, setRevision] = useState(0)
  const actualizar = () => setRevision((n) => n + 1)
  const permisos = props.cuenta.permisos
  const historial = usePagina<{ tipo: string; referencia_id: string; fecha: string; titulo: string; detalle?: string }>(`${props.ruta}/historial`, props.token, revision)
  const seccion = { ...props, revision, actualizar }
  return <>
    {(permisos.includes('adultos:asignar') || permisos.includes('familiares:autorizar')) && <Vínculos {...seccion} />}
    {permisos.includes('adultos:ver-sensible') && <Riesgo {...seccion} />}
    {permisos.includes('indicaciones:ver') && <Indicaciones {...seccion} />}
    <section className="grid gap-3">
      <h3 className="font-semibold">Historial del expediente</h3>
      <Estado consulta={historial} vacio={historial.datos?.data.length === 0 ? 'Sin eventos de seguimiento.' : undefined} />
      <ul>{historial.datos?.data.map((e, i) => <li key={`${e.tipo}-${e.referencia_id}-${e.fecha}-${i}`} className="py-2">
        {e.fecha && new Date(e.fecha).toLocaleDateString('es-DO')} · {e.titulo} {e.detalle}
      </li>)}</ul>
      {historial.datos && <Paginador pagina={historial.pagina} total={historial.datos.meta.totalPages} cambiar={historial.cambiar} />}
    </section>
  </>
}
