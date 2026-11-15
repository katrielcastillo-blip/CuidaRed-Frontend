/* Bandeja interna de solicitudes existentes · ID04. © 2026 Equipo CuidaRed – INTEC. */
import { useState } from 'react'
import { Badge, Button, Card, SelectField } from '@/components/ui'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import { api } from '../client'
import { campo, Estado, Formulario, idRuta, Paginador, useConexionReal, usePagina } from './controles'
import { fechaDominicana } from './visitas-fechas'
import type { AdultoNombre, Candidato, OperacionProps } from './visitas'

const ESTADOS = { pendiente: 'Pendiente', autorizada: 'Autorizada', rechazada: 'Rechazada', realizada: 'Realizada', cancelada: 'Cancelada' }
interface Solicitud {
  solicitud_visita_id: string
  estado: keyof typeof ESTADOS
  visitante: { nombres: string; apellidos: string }
  persona_a_visitar: string
  fecha_propuesta: string
  hora_propuesta: string
  motivo: string
  motivo_rechazo?: string | null
}

function Autorizar({ base, token, solicitud, cerrar, guardar }: Pick<OperacionProps, 'base' | 'token'> & {
  solicitud: Solicitud; cerrar: () => void; guardar: (datos: FormData) => Promise<void>
}) {
  const [adulto, setAdulto] = useState<AdultoNombre>()
  const [participante, setParticipante] = useState<Candidato>()
  const adultos = usePagina<AdultoNombre>(`${base}/envejecientes`, token, 0, { filters: { estado: 'activo' } })
  const candidatos = usePagina<Candidato>(`${base}/candidatos/visita`, token)
  const enLinea = useConexionReal()
  const hoy = fechaDominicana()
  const opciones = adultos.datos?.data ?? []
  const visibles = adulto && !opciones.some((item) => item.envejeciente_id === adulto.envejeciente_id) ? [adulto, ...opciones] : opciones
  const personas = candidatos.datos?.data ?? []
  const disponibles = participante && !personas.some((item) => item.usuario_id === participante.usuario_id) ? [participante, ...personas] : personas
  return <Formulario titulo="Autorizar solicitud" accion="Autorizar y programar" cancelar={cerrar} disabled={!enLinea} submitDisabled={!adulto || !participante}
    campos={[
      { name: 'fecha', label: 'Fecha autorizada', type: 'date', min: hoy, value: solicitud.fecha_propuesta >= hoy ? solicitud.fecha_propuesta : hoy },
      { name: 'hora', label: 'Hora autorizada', type: 'time', value: solicitud.hora_propuesta },
    ]} enviar={guardar}>
    <div className="grid gap-3 sm:col-span-2">
      <Estado consulta={adultos} vacio={adultos.datos?.data.length === 0 ? 'Sin adultos activos disponibles.' : undefined} />
      {adultos.datos && <>
        <SelectField name="envejeciente" label="Expediente del adulto" placeholder="Selecciona el expediente" required
          value={adulto?.envejeciente_id ?? ''}
          onChange={(event) => setAdulto(visibles.find((item) => item.envejeciente_id === event.currentTarget.value))}
          options={visibles.map((item) => ({ value: item.envejeciente_id, label: `${item.nombres} ${item.apellidos}` }))} />
        <Paginador pagina={adultos.pagina} total={adultos.datos.meta.totalPages} cambiar={adultos.cambiar} />
      </>}
      <Estado consulta={candidatos} vacio={candidatos.datos?.data.length === 0 ? 'Sin personal disponible para registrar la visita.' : undefined} />
      {candidatos.datos && <>
        <SelectField name="participante" label="Responsable de la visita" placeholder="Selecciona a la persona responsable" required
          value={participante?.usuario_id ?? ''}
          onChange={(event) => setParticipante(disponibles.find((item) => item.usuario_id === event.currentTarget.value))}
          options={disponibles.map((item) => ({ value: item.usuario_id, label: item.nombre }))} />
        <Paginador pagina={candidatos.pagina} total={candidatos.datos.meta.totalPages} cambiar={candidatos.cambiar} />
      </>}
    </div>
  </Formulario>
}

export function SolicitudesVisita({ base, token }: OperacionProps) {
  const [filtro, setFiltro] = useState('')
  const [revision, actualizar] = useState(0)
  const [gestion, setGestion] = useState<{ id: string; accion: 'autorizar' | 'rechazar' }>()
  const [aviso, avisar] = useState('')
  const enLinea = useConexionReal()
  const listado = usePagina<Solicitud>(`${base}/solicitudes-visita`, token, revision, { filters: filtro ? { estado: filtro } : undefined })
  const cerrar = () => setGestion(undefined)
  const resolver = async (id: string, accion: 'autorizar' | 'rechazar', datos: object) => {
    await api(`${base}/solicitudes-visita/${idRuta(id)}/${accion}`, token, 'POST', datos)
    cerrar()
    avisar(accion === 'autorizar' ? 'Solicitud autorizada y visita programada.' : 'Solicitud rechazada.')
    actualizar((n) => n + 1)
  }
  return <section className="grid gap-3" aria-label="Bandeja interna de solicitudes">
    <div className="max-w-sm">
      <SelectField label="Estado de la solicitud" value={filtro} onChange={(event) => { setFiltro(event.currentTarget.value); cerrar() }}
        options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(ESTADOS).map(([value, label]) => ({ value, label }))]} />
    </div>
    {aviso && <p role="status" className="rounded-sm bg-teal-100 p-3">{aviso}</p>}
    <Estado consulta={listado} vacio={listado.datos?.data.length === 0 ? 'Sin solicitudes en este estado.' : undefined} />
    {listado.datos?.data.map((solicitud) => {
      const id = solicitud.solicitud_visita_id
      return <Card key={id} className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold wrap-anywhere">{solicitud.persona_a_visitar}</h2>
          <Badge tone={solicitud.estado === 'pendiente' ? 'warning' : 'neutral'}>{ESTADOS[solicitud.estado]}</Badge>
        </div>
        <p className="text-sm wrap-anywhere">Solicitante · {solicitud.visitante.nombres} {solicitud.visitante.apellidos}</p>
        <p className="text-sm">Horario propuesto · {fechaCorta(solicitud.fecha_propuesta)}, {hhmmA12(solicitud.hora_propuesta)}</p>
        <p className="text-sm wrap-anywhere">{solicitud.motivo}</p>
        {solicitud.motivo_rechazo && <p className="text-sm wrap-anywhere">Rechazo · {solicitud.motivo_rechazo}</p>}
        {solicitud.estado === 'pendiente' && gestion?.id !== id && <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!enLinea} onClick={() => setGestion({ id, accion: 'autorizar' })}>Autorizar</Button>
          <Button size="sm" disabled={!enLinea} variant="outline" onClick={() => setGestion({ id, accion: 'rechazar' })}>Rechazar</Button>
        </div>}
        {gestion?.id === id && gestion.accion === 'autorizar' && <Autorizar base={base} token={token} solicitud={solicitud} cerrar={cerrar}
          guardar={(datos) => resolver(id, 'autorizar', { envejeciente_id: campo(datos, 'envejeciente'),
            participante_id: campo(datos, 'participante'), fecha: campo(datos, 'fecha'), hora: campo(datos, 'hora') })} />}
        {gestion?.id === id && gestion.accion === 'rechazar' && <Formulario titulo="Rechazar solicitud" accion="Confirmar rechazo"
          cancelar={cerrar} disabled={!enLinea} campos={[{ name: 'motivo', label: 'Motivo del rechazo', type: 'textarea', min: 3, max: 300 }]}
          enviar={(datos) => resolver(id, 'rechazar', { motivo: campo(datos, 'motivo') })} />}
      </Card>
    })}
    {listado.datos && <Paginador pagina={listado.pagina} total={listado.datos.meta.totalPages}
      cambiar={(pagina) => { cerrar(); listado.cambiar(pagina) }} />}
  </section>
}
