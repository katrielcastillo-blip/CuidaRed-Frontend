/*
 * visitas.tsx — Programación, historial, realización y evidencias de visita conectadas.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { Button } from '@/components/ui'
import { api, getClient, type CuentaMe, type RolCuenta } from '../client'
import { campo, Estado, Formulario, idRuta, opciones, Paginador, useDatos, usePagina, type Campo } from './controles'
import type { ColaVisitas } from './cola-visitas'

export interface AdultoNombre { envejeciente_id: string; nombres: string; apellidos: string }
export interface Candidato { usuario_id: string; membresia_id: string; cuidador_id: string | null; nombre: string; rol: RolCuenta }
export interface OperacionProps { base: string; token: string; cuenta: CuentaMe; usuarioId: string }

interface Visita {
  visita_id: string
  fecha: string
  hora_programada: string | null
  razon: string
  estado: 'programada' | 'en_curso' | 'completada' | 'cancelada'
  fecha_actualizacion: string
  autorizada_por: { usuario_id: string } | null
  participantes: { usuario_id: string }[]
  adultos: (AdultoNombre & { observacion?: string | null; estado_general?: string | null })[]
}

const permite = (cuenta: CuentaMe, permiso: string) => cuenta.permisos.includes(permiso)
const nombre = (a: AdultoNombre) => `${a.nombres} ${a.apellidos}`

function Programar({ base, token, listo }: Pick<OperacionProps, 'base' | 'token'> & { listo: () => void }) {
  const adultos = usePagina<AdultoNombre>(`${base}/envejecientes`, token)
  const personas = usePagina<Candidato>(`${base}/candidatos/visita`, token)
  const [seleccionAdultos, setAdultos] = useState<string[]>([])
  const [seleccionPersonas, setPersonas] = useState<string[]>([])
  const campos: Campo[] = [
    { name: 'fecha', label: 'Fecha de visita', type: 'date' },
    { name: 'hora', label: 'Hora de visita (República Dominicana)', type: 'time' },
    { name: 'razon', label: 'Motivo de la visita', max: 120 },
    { name: 'notas', label: 'Notas', type: 'textarea', optional: true, max: 300 },
  ]
  const seleccionar = (actual: string[], id: string, max: number) => actual.includes(id)
    ? actual.filter((valor) => valor !== id) : actual.length < max ? [...actual, id] : actual
  return <Formulario titulo="Programar y autorizar visita" campos={campos} accion="Programar visita" enviar={async (datos) => {
    if (!seleccionAdultos.length || !seleccionPersonas.length) throw new Error('Elige al menos un adulto y una persona visitante.')
    await api(`${base}/visitas`, token, 'POST', {
      fecha: campo(datos, 'fecha'), hora_programada: campo(datos, 'hora'), razon: campo(datos, 'razon'),
      notas: campo(datos, 'notas') || undefined, envejeciente_ids: seleccionAdultos, participante_ids: seleccionPersonas,
    })
    listo()
  }}>
    <div className="grid gap-2">
      <strong>Adultos de la visita ({seleccionAdultos.length}/4)</strong>
      <Estado consulta={adultos} vacio={!adultos.datos?.data.length ? 'Sin adultos en esta página.' : undefined} />
      {adultos.datos?.data.map((a) => <label key={a.envejeciente_id} className="flex min-h-12 items-center gap-2">
        <input type="checkbox" checked={seleccionAdultos.includes(a.envejeciente_id)} onChange={() => setAdultos((ids) => seleccionar(ids, a.envejeciente_id, 4))} />
        {nombre(a)}
      </label>)}
      {adultos.datos && <Paginador pagina={adultos.pagina} total={adultos.datos.meta.totalPages} cambiar={adultos.cambiar} />}
    </div>
    <div className="grid gap-2">
      <strong>Visitantes autorizados ({seleccionPersonas.length}/3)</strong>
      <Estado consulta={personas} vacio={!personas.datos?.data.length ? 'Sin participantes disponibles.' : undefined} />
      {personas.datos?.data.map((p) => <label key={p.usuario_id} className="flex min-h-12 items-center gap-2">
        <input type="checkbox" checked={seleccionPersonas.includes(p.usuario_id)} onChange={() => setPersonas((ids) => seleccionar(ids, p.usuario_id, 3))} />
        {p.nombre}
      </label>)}
      {personas.datos && <Paginador pagina={personas.pagina} total={personas.datos.meta.totalPages} cambiar={personas.cambiar} />}
    </div>
  </Formulario>
}

export function Evidencias({ ruta, token, puedeAdjuntar, tarea = false, validar, revision, refrescar }: {
  ruta: string; token: string; puedeAdjuntar: boolean; tarea?: boolean
  validar?: (id: string, aceptar: boolean, motivo?: string) => Promise<void>
  revision: number; refrescar: () => void
}) {
  const consulta = useDatos<{ evidencia_id: string; nombre_archivo: string; estado_validacion?: string; url_descarga: string | null }[]>(`${ruta}/evidencias`, token, revision)
  return <section className="grid gap-3">
    <h3 className="font-semibold">Evidencias</h3>
    <Estado consulta={consulta} vacio={consulta.datos?.length === 0 ? 'Sin evidencias adjuntas.' : undefined} />
    {consulta.datos?.map((archivo) => <div key={archivo.evidencia_id} className="grid gap-2 border-b border-line-soft pb-3">
      <p>{archivo.nombre_archivo} {archivo.estado_validacion && `· ${archivo.estado_validacion}`}</p>
      {archivo.url_descarga && <a href={archivo.url_descarga} rel="noreferrer" target="_blank" className="flex min-h-12 items-center text-navy underline">Abrir archivo privado</a>}
      {validar && archivo.estado_validacion === 'pendiente' && <>
        <Formulario titulo="Validar archivo" campos={[]} accion="Validar" enviar={() => validar(archivo.evidencia_id, true)} />
        <Formulario titulo="Rechazar archivo" campos={[{ name: 'motivo', label: 'Motivo de rechazo', max: 200 }]} accion="Rechazar" enviar={(datos) => validar(archivo.evidencia_id, false, campo(datos, 'motivo'))} />
      </>}
    </div>)}
    {puedeAdjuntar && <Formulario titulo="Adjuntar evidencia privada" campos={[]} accion="Adjuntar" enviar={async (datos) => {
      const archivo = datos.get('archivo')
      if (!(archivo instanceof File) || archivo.size < 1 || archivo.size > 5 * 1024 * 1024 ||
          !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(archivo.type)) {
        throw new Error('Selecciona una imagen JPG, PNG o WEBP, o un PDF de hasta 5 MB.')
      }
      const meta = { nombre_archivo: archivo.name, tipo_mime: archivo.type, tamano_bytes: archivo.size }
      const destino = await api<{ ruta: string; bucket: string; token?: string }>(`${ruta}/evidencias/subida`, token, 'POST', meta)
      const storage = getClient().storage.from(destino.bucket)
      const subida = tarea && destino.token
        ? await storage.uploadToSignedUrl(destino.ruta, destino.token, archivo, { contentType: archivo.type, upsert: false })
        : await storage.upload(destino.ruta, archivo, { contentType: archivo.type, upsert: false })
      if (subida.error) throw new Error('No se pudo subir el archivo.')
      await api(`${ruta}/evidencias`, token, 'POST', { ...meta, ruta: destino.ruta })
      refrescar()
    }}>
      <label className="grid gap-2">Archivo (máximo 5 MB)
        <input name="archivo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className="min-h-12 w-full" />
      </label>
    </Formulario>}
  </section>
}

export function Visitas({ base, token, cuenta, usuarioId, cola }: OperacionProps & { cola: ColaVisitas }) {
  const [id, setId] = useState<string>()
  const [revision, setRevision] = useState(0)
  const [programando, setProgramando] = useState(false)
  const actualizar = () => setRevision((r) => r + 1)
  const recarga = revision + cola.revision
  const listado = usePagina<Visita>(`${base}/visitas`, token, recarga)
  const ruta = id ? `${base}/visitas/${idRuta(id)}` : null
  const detalle = useDatos<Visita>(ruta, token, recarga)
  const visita = detalle.datos
  const pendiente = cola.capturas.filter((c) => c.cuentaId === cuenta.cuenta_id)
  const participante = visita?.participantes.some((p) => p.usuario_id === usuarioId) === true
  const autorizada = !!visita?.autorizada_por && !!visita.hora_programada && participante
  const abierta = visita?.estado === 'programada' || visita?.estado === 'en_curso'
  const puedeRegistrar = permite(cuenta, 'visitas:registrar') && autorizada
  const enviar = async (tipo: 'iniciar' | 'registrar', datos: object = {}) => {
    if (!visita || !ruta || !puedeRegistrar) return
    if (!navigator.onLine && permite(cuenta, 'sync:usar')) {
      cola.agregar(cuenta.cuenta_id, visita.visita_id, visita.fecha_actualizacion, tipo, datos)
      return
    }
    await api(`${ruta}/${tipo}`, token, 'POST', datos)
    actualizar()
  }

  return <section className="grid gap-4">
    <h2 className="text-lg font-semibold">Visitas y seguimiento</h2>
    {(pendiente.length > 0 || cola.mensaje) && <div className="grid gap-2" role="status">
      <p>{pendiente.length} pendiente(s) en esta cuenta. {cola.mensaje}</p>
      {pendiente.length > 0 && <p>Las capturas se conservan mientras esta pestaña siga abierta.</p>}
      {pendiente.length > 0 && <Button variant="outline" onClick={cola.reintentar}>Reintentar sincronización</Button>}
      {pendiente.some((c) => c.rechazada) && <Button variant="outline" onClick={() => cola.quitarRechazadas(cuenta.cuenta_id)}>Descartar capturas rechazadas</Button>}
    </div>}
    {permite(cuenta, 'visitas:programar') && permite(cuenta, 'visitas:autorizar') &&
      <Button variant="outline" onClick={() => setProgramando(!programando)}>{programando ? 'Cerrar programación' : 'Programar visita'}</Button>}
    {programando && <Programar base={base} token={token} listo={() => { setProgramando(false); actualizar() }} />}
    <Estado consulta={listado} vacio={listado.datos?.data.length === 0 ? 'Sin visitas.' : undefined} />
    {listado.datos?.data.map((v) => <Button key={v.visita_id} variant="outline" onClick={() => setId(v.visita_id)}>
      {v.fecha} · {v.razon} · {v.estado.replaceAll('_', ' ')}
    </Button>)}
    {listado.datos && <Paginador pagina={listado.pagina} total={listado.datos.meta.totalPages} cambiar={listado.cambiar} />}
    {id && <Estado consulta={detalle} />}
    {visita && ruta && <section key={visita.visita_id} className="grid gap-3">
      <h3 className="font-semibold">{visita.razon}</h3>
      <p>{visita.fecha} {visita.hora_programada ?? ''} · {visita.estado.replaceAll('_', ' ')}</p>
      <ul>{visita.adultos.map((a) => <li key={a.envejeciente_id}>{nombre(a)} {a.observacion && `· ${a.observacion}`}</li>)}</ul>
      {puedeRegistrar && visita.estado === 'programada' &&
        <Formulario titulo="Iniciar visita autorizada" campos={[]} accion="Iniciar visita" enviar={() => enviar('iniciar')} />}
      {puedeRegistrar && abierta && visita.adultos.length > 0 &&
        <Formulario titulo="Registrar realización" accion="Registrar visita" campos={visita.adultos.flatMap((a) => [
          ...(cuenta.rol === 'voluntario' ? [] : [{ name: `estado-${a.envejeciente_id}`, label: `Estado de ${nombre(a)}`, options: opciones('estable', 'requiere_atencion', 'situacion_critica') }]),
          { name: `observacion-${a.envejeciente_id}`, label: `Observación de ${nombre(a)}`, type: 'textarea', max: 1000 },
        ])} enviar={(datos) => enviar('registrar', { detalles: visita.adultos.map((a) => ({
          envejeciente_id: a.envejeciente_id,
          estado_general: campo(datos, `estado-${a.envejeciente_id}`) || undefined,
          observacion: campo(datos, `observacion-${a.envejeciente_id}`),
        })) })} />}
      {abierta && permite(cuenta, 'visitas:programar') &&
        <Formulario titulo="Cancelar visita" campos={[{ name: 'motivo', label: 'Motivo de cancelación', max: 300 }]} accion="Cancelar visita" enviar={async (datos) => {
          await api(`${ruta}/cancelar`, token, 'POST', { motivo: campo(datos, 'motivo') })
          actualizar()
        }} />}
      {(visita.estado === 'en_curso' || visita.estado === 'completada') && (puedeRegistrar || permite(cuenta, 'visitas:autorizar')) &&
        <Evidencias ruta={ruta} token={token} puedeAdjuntar={puedeRegistrar} revision={recarga} refrescar={actualizar} />}
    </section>}
  </section>
}
