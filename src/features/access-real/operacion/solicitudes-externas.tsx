/*
 * solicitudes-externas.tsx — Revisión de solicitudes públicas por la organización.
 * Módulo: access-real. © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { ArrowLeft, Inbox } from 'lucide-react'
import { Badge, Button, Card, SelectField } from '@/components/ui'
import { fechaCorta, hhmmA12 } from '@/domain/dates'
import { api } from '../client'
import { campo, Estado, Formulario, idRuta, Paginador, useConexionReal, usePagina } from './controles'
import { VentanaVisita } from './calendario-visitas'
import { leerVentana } from './visitas-fechas'
import { avisoPerfilCuidador, responsablesVisita } from './visitas-responsables'
import type { AdultoNombre, Candidato } from './visitas'

interface Solicitud {
  solicitud_visita_id: string
  estado: 'pendiente' | 'autorizada' | 'rechazada' | 'realizada' | 'cancelada'
  visitante: { nombres: string; apellidos: string; telefono?: string; correo?: string | null }
  persona_a_visitar: string | null
  tipo_visita?: 'personal' | 'institucional'
  entidad_visitante?: string | null
  tipo_entidad?: string | null
  cantidad_visitantes?: number
  aporte_previsto?: string | null
  fecha_propuesta: string
  hora_propuesta: string
  motivo: string
  motivo_rechazo?: string | null
  observacion_visitante?: string | null
  visita_id?: string | null
}

const estados = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'autorizada', label: 'Autorizadas' },
  { value: 'realizada', label: 'Realizadas' },
  { value: 'rechazada', label: 'Rechazadas' },
  { value: 'cancelada', label: 'Canceladas' },
]

function Autorizar({ base, token, item, volver, listo }: {
  base: string; token: string; item: Solicitud; volver: () => void; listo: (id: string) => void
}) {
  const institucional = item.tipo_visita === 'institucional'
  const adultos = usePagina<AdultoNombre>(institucional ? null : base + '/envejecientes', token, 0, { filters: { estado: 'activo' } })
  const candidatos = usePagina<Candidato>(base + '/candidatos/visita', token)
  const { disponibles, faltanPerfiles } = responsablesVisita(candidatos.datos?.data)
  const [adulto, setAdulto] = useState<AdultoNombre>()
  const [responsable, setResponsable] = useState<Candidato>()
  const enLinea = useConexionReal()
  return <Formulario titulo="Autorizar solicitud de visita" campos={[]}
    disabled={!enLinea} submitDisabled={(!institucional && !adulto) || !responsable} accion="Autorizar y agendar" cancelar={volver}
    enviar={async (datos) => {
      if ((!institucional && !adulto) || !responsable) return
      const visita = await api<{ visita_id: string }>(base + '/solicitudes-visita/' + idRuta(item.solicitud_visita_id) + '/autorizar', token, 'POST', {
        ...(!institucional && adulto ? { envejeciente_id: adulto.envejeciente_id } : {}), participante_id: responsable.usuario_id, ...leerVentana(datos),
      })
      listo(visita.visita_id)
    }}>
    <p className="text-sm text-ink-2">{item.visitante.nombres} {item.visitante.apellidos}{institucional ? <> representa a <strong>{item.entidad_visitante}</strong>.</> : <> solicita visitar a <strong>{item.persona_a_visitar}</strong>.</>}</p>
    <p className="text-sm text-ink-2">{item.cantidad_visitantes ?? 1} visitante(s). {item.aporte_previsto && <>Aporte previsto · {item.aporte_previsto}</>}</p>
    {institucional && <p className="text-sm text-ink-2">Esta visita se agenda para la organización. El responsable asignado registrará la actividad.</p>}
    {!institucional && <><SelectField label="Persona mayor de la organización" placeholder="Selecciona una persona" value={adulto?.envejeciente_id ?? ''}
      options={[...new Map([...(adultos.datos?.data ?? []), ...(adulto ? [adulto] : [])].map((row) => [row.envejeciente_id, row])).values()]
        .map((row) => ({ value: row.envejeciente_id, label: row.nombres + ' ' + row.apellidos }))}
      onChange={(e) => setAdulto(adultos.datos?.data.find((row) => row.envejeciente_id === e.target.value))} required />
    <Estado consulta={adultos} vacio={adultos.datos?.data.length === 0 ? 'No hay personas mayores activas en esta página.' : undefined} />
    {adultos.datos && <Paginador pagina={adultos.pagina} total={adultos.datos.meta.totalPages} cambiar={adultos.cambiar} />}</>}
    <SelectField label="Cuidador o voluntario responsable" placeholder="Selecciona una persona" value={responsable?.usuario_id ?? ''}
      options={[...new Map([...disponibles, ...(responsable ? [responsable] : [])].map((row) => [row.usuario_id, row])).values()]
        .map((row) => ({ value: row.usuario_id, label: row.nombre }))}
      onChange={(e) => setResponsable(disponibles.find((row) => row.usuario_id === e.target.value))} required />
    <Estado consulta={candidatos} vacio={candidatos.datos && !disponibles.length ? 'No hay responsables disponibles en esta página.' : undefined} />
    {faltanPerfiles && <p className="text-sm text-ink-2">{avisoPerfilCuidador}</p>}
    {candidatos.datos && <Paginador pagina={candidatos.pagina} total={candidatos.datos.meta.totalPages} cambiar={candidatos.cambiar} />}
    <VentanaVisita base={base} token={token} inicial={{ fecha: item.fecha_propuesta, inicio: item.hora_propuesta }} />
  </Formulario>
}

export function SolicitudesExternas({ base, token, volver, abrirVisita }: {
  base: string; token: string; volver: () => void; abrirVisita: (id: string) => void
}) {
  const [filtro, setFiltro] = useState('pendiente')
  const [revision, setRevision] = useState(0)
  const [seleccion, setSeleccion] = useState<{ item: Solicitud; accion: 'autorizar' | 'rechazar' }>()
  const [aviso, setAviso] = useState('')
  const enLinea = useConexionReal()
  const ruta = base + '/solicitudes-visita'
  const listado = usePagina<Solicitud>(ruta, token, revision, { filters: { estado: filtro } })
  return <section aria-labelledby="solicitudes-externas" className="grid gap-4">
    <Button variant="ghost" className="justify-self-start" icon={<ArrowLeft size={18} aria-hidden />} onClick={volver}>Volver a visitas</Button>
    <h2 id="solicitudes-externas" className="flex items-center gap-2 text-xl font-bold text-navy"><Inbox size={22} aria-hidden /> Solicitudes externas</h2>
    {aviso && <p role="status" className="rounded-sm bg-success-100 p-3 text-success-700">{aviso}</p>}
    {seleccion ? (
      seleccion.accion === 'autorizar'
        ? <Autorizar base={base} token={token} item={seleccion.item} volver={() => setSeleccion(undefined)} listo={abrirVisita} />
        : <Formulario titulo="Rechazar solicitud" campos={[{ name: 'motivo', label: 'Motivo que verá el visitante', type: 'textarea', min: 3, max: 300 }]}
          disabled={!enLinea} accion="Rechazar solicitud" cancelar={() => setSeleccion(undefined)} enviar={async (datos) => {
            await api(ruta + '/' + idRuta(seleccion.item.solicitud_visita_id) + '/rechazar', token, 'POST', { motivo: campo(datos, 'motivo') })
            setSeleccion(undefined)
            setRevision((actual) => actual + 1)
            setAviso('Solicitud rechazada. El visitante puede consultar el motivo con su código.')
          }} />
    ) : <>
      <div className="max-w-xs">
        <SelectField label="Estado de la solicitud" options={estados} value={filtro} onChange={(event) => { setFiltro(event.target.value); setAviso('') }} />
      </div>
      <Estado consulta={listado} vacio={listado.datos?.data.length === 0 ? 'No hay solicitudes en este estado.' : undefined} />
      {listado.datos?.data.map((item) => <Card key={item.solicitud_visita_id} className="grid gap-3">
        <h3 className="text-lg font-semibold">{item.visitante.nombres} {item.visitante.apellidos}</h3>
        <p className="text-sm text-ink-2">{item.tipo_visita === 'institucional' ? `Visita de ${item.entidad_visitante}` : `Quiere visitar a ${item.persona_a_visitar}`} · {fechaCorta(item.fecha_propuesta)} · {hhmmA12(item.hora_propuesta)}</p>
        <p className="text-sm text-ink-2">{item.cantidad_visitantes ?? 1} visitante(s)</p>
        {item.aporte_previsto && <p className="text-sm text-ink-2"><strong>Aporte previsto</strong> · {item.aporte_previsto}</p>}
        {(item.visitante.telefono || item.visitante.correo) && <p className="text-sm text-ink-2">Contacto · {item.visitante.telefono}{item.visitante.correo && ` · ${item.visitante.correo}`}</p>}
        <p className="text-sm text-ink-2">{item.motivo}</p>
        {item.motivo_rechazo && <p className="text-sm text-ink-2">{item.motivo_rechazo}</p>}
        {item.observacion_visitante && <div><Badge tone="success">Observación del visitante</Badge><p className="mt-1 whitespace-pre-line">{item.observacion_visitante}</p></div>}
        <div className="flex flex-wrap gap-2">
          {item.estado === 'pendiente' && <>
            <Button disabled={!enLinea} onClick={() => setSeleccion({ item, accion: 'autorizar' })}>Revisar y autorizar</Button>
            <Button variant="outline" onClick={() => setSeleccion({ item, accion: 'rechazar' })}>Rechazar</Button>
          </>}
          {item.visita_id && <Button variant="outline" onClick={() => abrirVisita(item.visita_id!)}>Abrir visita</Button>}
        </div>
      </Card>)}
      {listado.datos && <Paginador pagina={listado.pagina} total={listado.datos.meta.totalPages} cambiar={listado.cambiar} />}
    </>}
  </section>
}
