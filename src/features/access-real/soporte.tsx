/*
 * soporte.tsx — Formulario de contacto y seguimiento de solicitudes del administrador.
 * Módulo: access-real. © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Headset, Plus, Send } from '@/components/icons'
import { Badge, Button, SelectField, TextField, TextareaField, type Tone } from '@/components/ui'
import { fechaHora } from '@/domain/dates'
import type { PaginatedResponse } from '@/lib/api-contract'
import type { CuentaMe } from './client'
import { listarMiembros, type Miembro } from './api/miembros'
import { crearSoporte, eventosSoporte, listarSoporte, responderSoporte, type EstadoSoporte, type SolicitudSoporte, type TipoSoporte } from './api/soporte'
import { mensajeDeError } from './errores'
import { Estado, Formulario, Paginador, campo, idRuta, useConexionReal, useDatos } from './operacion/controles'

const estados: Record<EstadoSoporte, string> = { abierta: 'Abierta', en_revision: 'En revisión', esperando_informacion: 'Espera información', resuelta: 'Resuelta', rechazada: 'Rechazada' }
const tono = (estado: EstadoSoporte): Tone => estado === 'resuelta' ? 'success' : estado === 'rechazada' ? 'danger' : estado === 'abierta' || estado === 'esperando_informacion' ? 'warning' : 'info'

function useSeguimiento(token: string, cuenta: string) {
  const [revision, setRevision] = useState(0)
  const [conectado, setConectado] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function connect() {
      try {
        const response = await eventosSoporte(token, cuenta, controller.signal)
        if (!response.ok || !response.body) throw new Error('Sin conexión de soporte')
        setConectado(true)
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let pendiente = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          pendiente += decoder.decode(value, { stream: true })
          const eventos = pendiente.split(/\r?\n\r?\n/); pendiente = eventos.pop() ?? ''
          if (eventos.some((event) => event.split(/\r?\n/).some((line) => line.startsWith('data:')))) setRevision((r) => r + 1)
        }
      } catch { /* reconectar sin perder el formulario */ }
      if (!controller.signal.aborted) { setConectado(false); timer = setTimeout(() => void connect(), 5000) }
    }
    const focus = () => setRevision((r) => r + 1)
    window.addEventListener('focus', focus)
    void connect()
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener('focus', focus) }
  }, [token, cuenta])
  return { revision, conectado, actualizar: () => setRevision((r) => r + 1) }
}

function NuevaSolicitud({ token, cuenta, miembroId, alCrear }: { token: string; cuenta: CuentaMe; miembroId: string | null; alCrear: (id: string) => void }) {
  const enLinea = useConexionReal()
  const [tipo, setTipo] = useState<TipoSoporte>(miembroId ? 'eliminar_usuario' : 'consulta')
  const [elegido, setSeleccion] = useState<Miembro | null>()
  const [pagina, setPagina] = useState(1)
  const [miembros, setMiembros] = useState<PaginatedResponse<Miembro>>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inicial = useDatos<Miembro>(miembroId ? `/cuentas/${idRuta(cuenta.cuenta_id)}/miembros/${idRuta(miembroId)}` : null, token)
  const seleccion = elegido === undefined ? inicial.datos : elegido ?? undefined
  useEffect(() => {
    if (tipo !== 'eliminar_usuario' || !enLinea) return
    let vigente = true
    void listarMiembros(token, cuenta.cuenta_id, { page: pagina, limit: 25 }).then(
      (data) => { if (vigente) setMiembros(data) }, (issue) => { if (vigente) setError(mensajeDeError(issue)) },
    )
    return () => { vigente = false }
  }, [token, cuenta.cuenta_id, tipo, pagina, enLinea])
  const opciones = miembros?.data ?? []
  const personas = seleccion && !opciones.some((m) => m.membresia_id === seleccion.membresia_id) ? [seleccion, ...opciones] : opciones
  return <form className="grid gap-4 rounded-md border border-line-soft bg-surface p-4 sm:p-5" aria-label="Contactar a soporte" aria-busy={busy} onSubmit={async (event) => {
    event.preventDefault(); if (busy || !enLinea || (tipo === 'eliminar_usuario' && !seleccion)) return
    const data = new FormData(event.currentTarget); setBusy(true); setError('')
    try {
      const ticket = await crearSoporte(token, cuenta.cuenta_id, { tipo, asunto: campo(data, 'asunto'), descripcion: campo(data, 'descripcion'), usuario_objetivo_id: tipo === 'eliminar_usuario' ? seleccion!.usuario.id : null })
      alCrear(ticket.id)
    } catch (issue) { setError(mensajeDeError(issue)) }
    finally { setBusy(false) }
  }}>
    <h2 className="text-lg font-semibold text-navy">¿Qué necesitas resolver?</h2>
    <fieldset disabled={busy || !enLinea} className="grid min-w-0 gap-4">
      <SelectField label="Tipo de solicitud" value={tipo} onChange={(event) => setTipo(event.target.value as TipoSoporte)} options={[
        { value: 'consulta', label: 'Consulta general' }, { value: 'acceso', label: 'Problema de acceso' }, { value: 'error', label: 'Error de la aplicación' }, { value: 'eliminar_usuario', label: 'Solicitar eliminación de un usuario' },
      ]} />
      {tipo === 'eliminar_usuario' && <>
        <SelectField label="Usuario que solicitas eliminar" required placeholder="Selecciona un miembro" value={seleccion?.membresia_id ?? ''} onChange={(event) => setSeleccion(personas.find((m) => m.membresia_id === event.target.value) ?? null)}
          options={personas.map((m) => ({ value: m.membresia_id, label: `${m.usuario.nombres} ${m.usuario.apellidos} · ${m.usuario.correo} (${m.estado})` }))} />
        {miembros && <Paginador pagina={pagina} total={miembros.meta.totalPages} cambiar={setPagina} />}
        <p className="rounded-sm bg-blue-100 p-3 text-sm text-ink">Enviar la solicitud no elimina al usuario. El equipo revisará sus accesos y registros antes de responder. El historial de atención se conserva.</p>
      </>}
      <TextField name="asunto" label="Asunto" required minLength={5} maxLength={120} />
      <TextareaField name="descripcion" label="Describe lo que necesitas" required rows={4} minLength={10} maxLength={2000} hint="Incluye los pasos y el resultado esperado. No incluyas contraseñas ni información médica." />
    </fieldset>
    {!enLinea && <p role="status" className="text-sm text-muted">Conéctate a internet para enviar la solicitud.</p>}
    {error && <p role="alert" className="rounded-sm bg-danger-100 p-3 text-danger-700">{error}</p>}
    <Button type="submit" loading={busy} disabled={!enLinea || (tipo === 'eliminar_usuario' && !seleccion)} icon={<Send size={18} aria-hidden />}>Enviar solicitud de soporte</Button>
  </form>
}

function DetalleSolicitud({ token, cuenta, id, revision, actualizar }: { token: string; cuenta: CuentaMe; id: string; revision: number; actualizar: () => void }) {
  const detalle = useDatos<SolicitudSoporte>(`/cuentas/${idRuta(cuenta.cuenta_id)}/soporte/${idRuta(id)}`, token, revision)
  const data = detalle.datos
  const enLinea = useConexionReal()
  return <section className="grid min-w-0 gap-4" aria-label="Detalle de solicitud de soporte">
    <Estado consulta={detalle} />
    {data && <>
      <article className="grid gap-3 rounded-md border border-line-soft bg-surface p-4 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-navy">{data.codigo}</strong><Badge tone={tono(data.estado)}>{estados[data.estado]}</Badge></header>
        <h2 className="text-lg font-semibold text-ink">{data.asunto}</h2><p className="text-xs text-muted">Enviada el {fechaHora(data.creado_en)}</p>
        <p className="whitespace-pre-wrap break-words text-sm text-ink">{data.descripcion}</p>
        {data.usuario_objetivo && <p className="rounded-sm bg-surface-2 p-3 text-sm text-ink">Usuario: {data.usuario_objetivo.nombre}{data.usuario_objetivo.correo ? ` · ${data.usuario_objetivo.correo}` : ' · Perfil eliminado'}</p>}
      </article>
      <section className="grid gap-3" aria-labelledby="respuestas-soporte"><h3 id="respuestas-soporte" className="font-semibold text-navy">Respuestas y seguimiento</h3>
        {data.mensajes?.length ? <ol className="grid gap-3">{data.mensajes.map((m) => <li key={m.id} className="grid gap-2 rounded-md border border-line-soft bg-surface p-4">
          <header className="flex flex-wrap justify-between gap-1 text-sm"><strong>{m.origen === 'backoffice' ? 'Equipo CuidaRed' : m.autor}</strong><time dateTime={m.creado_en} className="text-xs text-muted">{fechaHora(m.creado_en)}</time></header>
          <p className="whitespace-pre-wrap break-words text-sm text-ink">{m.texto}</p><div><Badge tone={tono(m.estado)}>{estados[m.estado]}</Badge></div>
        </li>)}</ol> : <p className="rounded-md bg-blue-100 p-4 text-sm text-ink">Tu solicitud fue recibida. Aquí aparecerá la respuesta del equipo.</p>}
      </section>
      {!['resuelta', 'rechazada'].includes(data.estado) && <Formulario titulo="Agregar información" accion="Enviar respuesta" exito="Respuesta enviada." disabled={!enLinea}
        campos={[{ name: 'mensaje', label: 'Mensaje para soporte', type: 'textarea', min: 5, max: 2000 }]}
        enviar={async (values) => { await responderSoporte(token, cuenta.cuenta_id, id, campo(values, 'mensaje'), data.actualizado_en); actualizar() }} />}
    </>}
  </section>
}

export function PantallaSoporte({ token, cuenta }: { token: string; cuenta: CuentaMe }) {
  const [params, setParams] = useSearchParams()
  const seguimiento = useSeguimiento(token, cuenta.cuenta_id)
  const [crear, setCrear] = useState(!params.get('solicitud'))
  const id = params.get('solicitud')
  const [pagina, setPagina] = useState(1)
  const [list, setList] = useState<PaginatedResponse<SolicitudSoporte>>()
  const [error, setError] = useState('')
  useEffect(() => {
    let vigente = true
    void listarSoporte(token, cuenta.cuenta_id, pagina).then((data) => { if (vigente) { setList(data); setError('') } }, (issue) => { if (vigente) setError(mensajeDeError(issue)) })
    return () => { vigente = false }
  }, [token, cuenta.cuenta_id, pagina, seguimiento.revision])
  return <div className="grid min-w-0 gap-5">
    <header className="grid gap-3"><div className="flex items-center gap-3"><Headset size={24} className="text-navy" aria-hidden /><p className="text-sm text-ink-2">{cuenta.nombre} · Contacto con el equipo CuidaRed</p></div>
      <div className="flex flex-wrap gap-2"><Button variant={crear && !id ? 'primary' : 'outline'} size="sm" icon={<Plus size={18} aria-hidden />} onClick={() => { setParams({ vista: 'soporte' }); setCrear(true) }}>Nueva solicitud</Button><Button variant={!crear && !id ? 'primary' : 'outline'} size="sm" onClick={() => { setParams({ vista: 'soporte' }); setCrear(false) }}>Ver solicitudes</Button></div>
      <p className="text-xs text-muted" role="status">{seguimiento.conectado ? 'Seguimiento conectado' : 'Reconectando el seguimiento…'}</p>
    </header>
    {id ? <DetalleSolicitud key={id} token={token} cuenta={cuenta} id={id} revision={seguimiento.revision} actualizar={seguimiento.actualizar} /> : crear ? <NuevaSolicitud token={token} cuenta={cuenta} miembroId={params.get('miembro')} alCrear={(solicitud) => { setParams({ vista: 'soporte', solicitud }); seguimiento.actualizar() }} /> : <section className="grid gap-3" aria-labelledby="mis-solicitudes-soporte">
      <h2 id="mis-solicitudes-soporte" className="text-lg font-semibold text-navy">Solicitudes de la organización</h2>
      {error && <p role="alert" className="rounded-sm bg-danger-100 p-3 text-danger-700">{error}</p>}
      {!list && !error && <p role="status">Consultando solicitudes…</p>}
      {list?.data.length === 0 && <p className="rounded-md border border-line-soft bg-surface p-4 text-sm text-ink-2">Esta organización todavía no ha enviado solicitudes de soporte.</p>}
      {list?.data.map((s) => <button key={s.id} type="button" className="grid min-h-12 gap-2 rounded-md border border-line-soft bg-surface p-4 text-left hover:border-blue focus-visible:outline-2 focus-visible:outline-blue" onClick={() => setParams({ vista: 'soporte', solicitud: s.id })}>
        <span className="flex flex-wrap justify-between gap-2"><strong className="text-sm text-navy">{s.codigo}</strong><Badge tone={tono(s.estado)}>{estados[s.estado]}</Badge></span><strong className="text-ink">{s.asunto}</strong><span className="text-xs text-muted">Actualizada {fechaHora(s.actualizado_en)}</span>
      </button>)}
      {list && <Paginador pagina={pagina} total={list.meta.totalPages} cambiar={setPagina} />}
    </section>}
  </div>
}
