/*
 * envejecientes.tsx — Alta, expediente y contactos conectados (ID03).
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Cake, MapPin, Phone, Plus, ShieldCheck, VenusAndMars } from 'lucide-react'
import {
  Badge, Button, Card, Checkbox, CheckboxGroup, EmptyState, IconTile, InfoRow, RiesgoBadge,
  SearchInput, SelectField, StepBar, TextField, TextareaField,
} from '@/components/ui'
import { AUTONOMIAS, CONDICIONES, PARENTESCOS } from '@/domain/catalogos'
import { fechaCorta } from '@/domain/dates'
import { api } from '../client'
import type { Municipio, Provincia } from '../api/catalogos'
import { campo, Estado, Formulario, idRuta, Paginador, useDatos, usePagina, type Campo } from './controles'
import { Seguimiento, type ResumenRiesgo } from './seguimiento'
import type { AdultoNombre, OperacionProps } from './visitas'

type EstadoAdulto = 'activo' | 'inactivo' | 'fallecido'
interface Contacto {
  contacto_id: string | number
  nombres: string
  apellidos: string
  parentesco: string
  telefono: string
  es_principal: boolean
}
interface Perfil extends AdultoNombre {
  estado: EstadoAdulto
  cedula?: string
  fecha_nacimiento?: string
  sexo?: string
  telefono?: string | null
  municipio_cod: string
  municipio_nombre?: string
  provincia_cod?: string
  zona: string
  direccion?: string | null
  contacto_principal?: Contacto | null
  contactos?: Contacto[]
  condicion_general?: { autonomia: string; condiciones: string[]; nota: string | null }
  consentimiento?: { otorgado_por: 'adulto' | 'representante'; representante?: string | null }
}
interface Identidad { nombres: string; apellidos: string; cedula: string; fecha_nacimiento: string; sexo: string }
interface UbicacionDatos {
  municipio_cod: string
  zona: string
  direccion: string
  telefono: string | null
  autonomia: string
  condiciones: string[]
  nota_condicion: string | null
}
type Vista = { tipo: 'lista' | 'alta' } | { tipo: 'perfil'; id: string }

const ESTADO: Record<EstadoAdulto, string> = { activo: 'Activo', inactivo: 'Inactivo', fallecido: 'Fallecido' }
const SEXOS = [{ value: 'F', label: 'Femenino' }, { value: 'M', label: 'Masculino' }]
const PASOS = ['Identificación', 'Ubicación y cuidado', 'Contacto principal y consentimiento']
const POR_QUIEN = [{ value: 'adulto', label: 'El adulto mayor' }, { value: 'representante', label: 'Su representante' }]
const nombre = (persona: { nombres: string; apellidos: string }) => `${persona.nombres} ${persona.apellidos}`
const telefono = (valor: string) => valor.replace(/[\s()-]/g, '')
const cedulaVisible = (valor: string) => valor.replace(/^(\d{3})(\d{7})(\d)$/, '$1-$2-$3')
const normaliza = (valor: string) => valor.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es')

function fechasPermitidas() {
  const [año, mes, dia] = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santo_Domingo', dateStyle: 'short' })
    .format(new Date()).split('-').map(Number)
  const diaAjustado = (anios: number) => Math.min(dia, new Date(Date.UTC(año - anios, mes, 0)).getUTCDate())
  const iso = (anios: number, adicional = 0) => new Date(Date.UTC(año - anios, mes - 1, diaAjustado(anios) + adicional)).toISOString().slice(0, 10)
  return { min: iso(121, 1), max: iso(60) }
}

function Identificacion({ valor, enviar, cancelar, editando }: {
  valor?: Partial<Identidad>; enviar: (datos: Identidad) => Promise<void>; cancelar: () => void; editando?: boolean
}) {
  const fechas = fechasPermitidas()
  return <Formulario titulo={editando ? 'Editar identificación' : 'Identificación'} campos={[
    { name: 'nombres', label: 'Nombres', value: valor?.nombres, max: 60 },
    { name: 'apellidos', label: 'Apellidos', value: valor?.apellidos, max: 60 },
    { name: 'cedula', label: 'Cédula del adulto', value: valor?.cedula, inputMode: 'numeric', max: 14, hint: '11 dígitos. Puedes escribirla con o sin guiones.' },
    { name: 'fecha_nacimiento', label: 'Fecha de nacimiento', value: valor?.fecha_nacimiento, type: 'date', min: fechas.min, maxNumber: fechas.max, hint: 'Entre 60 y 120 años.' },
    { name: 'sexo', label: 'Sexo', value: valor?.sexo, options: SEXOS },
  ]} accion={editando ? 'Guardar identificación' : 'Continuar'} cancelar={cancelar} enviar={async (datos) => {
    const cedula = campo(datos, 'cedula')
    if (!/^[0-9]{11}$|^[0-9]{3}-[0-9]{7}-[0-9]$/.test(cedula)) throw new Error('Revisa la cédula. Debe tener 11 dígitos.')
    await enviar({
      nombres: campo(datos, 'nombres'), apellidos: campo(datos, 'apellidos'), cedula: cedula.replaceAll('-', ''),
      fecha_nacimiento: campo(datos, 'fecha_nacimiento'), sexo: campo(datos, 'sexo'),
    })
  }} />
}

function Ubicacion({ token, perfil, borrador, enviar, cancelar }: {
  token: string; perfil?: Perfil; borrador?: UbicacionDatos & { provincia: string }
  enviar: (datos: UbicacionDatos & { provincia: string }) => Promise<void>; cancelar: () => void
}) {
  const inicial = borrador?.provincia ?? perfil?.provincia_cod ?? ''
  const [provincia, setProvincia] = useState(inicial)
  const [municipio, setMunicipio] = useState(borrador?.municipio_cod ?? perfil?.municipio_cod ?? '')
  const [condiciones, setCondiciones] = useState<string[]>(borrador?.condiciones ?? perfil?.condicion_general?.condiciones ?? [])
  const provincias = useDatos<Provincia[]>('/catalogos/provincias', token)
  const municipios = useDatos<Municipio[]>(provincia ? `/catalogos/municipios?provincia_cod=${idRuta(provincia)}&limit=100` : null, token)
  return <Formulario titulo="Ubicación y cuidado" campos={[]} accion={perfil ? 'Guardar ubicación' : 'Continuar'}
    disabled={!provincias.datos?.length || (!!provincia && !municipios.datos?.length)} cancelar={cancelar} enviar={(datos) => enviar({
      provincia, municipio_cod: campo(datos, 'municipio'), zona: campo(datos, 'zona'), direccion: campo(datos, 'direccion'),
      telefono: telefono(campo(datos, 'telefono')) || null, autonomia: campo(datos, 'autonomia'),
      condiciones, nota_condicion: campo(datos, 'nota_condicion') || null,
    })}>
    <SelectField label="Provincia" name="provincia" placeholder={provincias.datos ? 'Selecciona una provincia' : 'Cargando provincias…'}
      value={provincia} required onChange={(event) => { setProvincia(event.currentTarget.value); setMunicipio('') }}
      options={provincias.datos?.map((p) => ({ value: p.provincia_cod, label: p.nombre })) ?? []} />
    <SelectField label="Municipio" name="municipio" placeholder={provincia ? 'Selecciona un municipio' : 'Selecciona primero la provincia'} required
      disabled={!municipios.datos?.length} value={municipio} onChange={(event) => setMunicipio(event.currentTarget.value)}
      options={municipios.datos?.map((m) => ({ value: m.municipio_cod, label: m.nombre })) ?? []} />
    {provincias.error && <Estado consulta={provincias} />}
    {provincia && municipios.error && <Estado consulta={municipios} />}
    <TextField name="zona" label="Sector o zona" defaultValue={borrador?.zona ?? perfil?.zona} maxLength={60} required />
    <TextField name="direccion" label="Dirección" defaultValue={borrador?.direccion ?? perfil?.direccion ?? ''} maxLength={150} />
    <TextField name="telefono" label="Teléfono del adulto" type="tel" defaultValue={borrador?.telefono ?? perfil?.telefono ?? ''} maxLength={20} />
    <SelectField label="Autonomía" name="autonomia" placeholder="Selecciona un nivel de autonomía" required
      defaultValue={borrador?.autonomia ?? perfil?.condicion_general?.autonomia} options={AUTONOMIAS} />
    <div className="md:col-span-2">
      <CheckboxGroup label="Condiciones generales" hint="Marca las opciones que apliquen." options={CONDICIONES} value={condiciones} onChange={setCondiciones} />
    </div>
    <div className="md:col-span-2">
      <TextareaField name="nota_condicion" label="Notas sobre la condición" maxLength={500}
        defaultValue={borrador?.nota_condicion ?? perfil?.condicion_general?.nota ?? ''} />
    </div>
  </Formulario>
}

const camposContacto = (contacto?: Contacto): Campo[] => [
  { name: 'nombres', label: 'Nombres del contacto', value: contacto?.nombres, max: 60 },
  { name: 'apellidos', label: 'Apellidos del contacto', value: contacto?.apellidos, max: 60 },
  { name: 'parentesco', label: 'Parentesco', value: contacto?.parentesco,
    options: [...new Set([...PARENTESCOS, ...(contacto?.parentesco ? [contacto.parentesco] : [])])].map((value) => ({ value, label: value })) },
  { name: 'telefono', label: 'Teléfono del contacto', type: 'tel', value: contacto?.telefono, max: 20 },
]
const datosContacto = (datos: FormData) => ({
  nombres: campo(datos, 'nombres'), apellidos: campo(datos, 'apellidos'),
  parentesco: campo(datos, 'parentesco'), telefono: telefono(campo(datos, 'telefono')),
})

function Crear({ base, token, creado, cerrar }: Pick<OperacionProps, 'base' | 'token'> & { creado: (id: string) => void; cerrar: () => void }) {
  const [paso, setPaso] = useState(1)
  const [identidad, setIdentidad] = useState<Identidad>()
  const [ubicacion, setUbicacion] = useState<UbicacionDatos & { provincia: string }>()
  const [otorgante, setOtorgante] = useState('')
  return <div className="grid gap-4">
    <Button variant="ghost" size="sm" className="justify-self-start" icon={<ArrowLeft size={18} aria-hidden />} onClick={cerrar}>Volver a Envejecientes</Button>
    <div className="grid gap-2">
      <h2 className="text-2xl font-bold text-ink">Registrar adulto mayor</h2>
      <p className="text-sm font-semibold text-navy" aria-live="polite">Paso {paso} de 3 · {PASOS[paso - 1]}</p>
      <StepBar step={paso} total={3} />
    </div>
    {paso === 1 && <Identificacion valor={identidad} enviar={async (datos) => { setIdentidad(datos); setPaso(2) }} cancelar={cerrar} />}
    {paso === 2 && <Ubicacion token={token} borrador={ubicacion} enviar={async (datos) => { setUbicacion(datos); setPaso(3) }} cancelar={() => setPaso(1)} />}
    {paso === 3 && identidad && ubicacion && <Formulario titulo="Consentimiento y contacto principal" campos={camposContacto()}
      accion="Registrar adulto mayor" cancelar={() => setPaso(2)} enviar={async (datos) => {
        const { provincia: _provincia, ...cuidado } = ubicacion
        const perfil = await api<Perfil>(`${base}/envejecientes`, token, 'POST', {
          ...identidad, ...cuidado,
          consentimiento: { otorgado: datos.get('otorgado') === 'on', otorgado_por: otorgante, representante: otorgante === 'representante' ? campo(datos, 'representante') : null },
          contactos: [{ ...datosContacto(datos), es_principal: true }],
        })
        creado(perfil.envejeciente_id)
      }}>
      <div className="grid gap-3 border-t border-line-soft pt-4 md:col-span-2">
        <h4 className="font-semibold text-ink">Consentimiento informado</h4>
        <SelectField label="Quién otorgó el consentimiento" placeholder="Selecciona quién lo otorgó" value={otorgante} required
          onChange={(event) => setOtorgante(event.currentTarget.value)} options={POR_QUIEN} />
        {otorgante === 'representante' && <TextField name="representante" label="Nombre del representante" required maxLength={120} />}
        <Checkbox name="otorgado" required label="Confirmo que se otorgó el consentimiento informado." />
      </div>
    </Formulario>}
  </div>
}

type AccionContacto = { tipo: 'nuevo' } | { tipo: 'editar' | 'principal' | 'eliminar'; contacto: Contacto }
function Contactos({ base, ruta, token, perfil, refrescar }: Pick<OperacionProps, 'base' | 'token'> & {
  ruta: string; perfil: Perfil; refrescar: () => void
}) {
  const [accion, setAccion] = useState<AccionContacto>()
  const contactos = perfil.contactos ?? (perfil.contacto_principal ? [perfil.contacto_principal] : [])
  const cerrar = () => setAccion(undefined)
  const guardado = () => { cerrar(); refrescar() }
  const editado = accion?.tipo === 'editar' ? accion.contacto : undefined
  return <section className="grid gap-3" aria-label="Contactos de emergencia">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Contactos de emergencia</h3>
      {!accion && contactos.length < 5 && <Button variant="light" size="sm" icon={<Plus size={18} aria-hidden />} onClick={() => setAccion({ tipo: 'nuevo' })}>Añadir contacto</Button>}
    </div>
    {contactos.length === 0 && <p className="text-sm text-muted">Aún no hay contactos de emergencia.</p>}
    {contactos.map((contacto) => <Card key={contacto.contacto_id} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-ink">{nombre(contacto)}</p>
        {contacto.es_principal && <Badge tone="info">Principal</Badge>}
      </div>
      <p className="text-sm text-muted">{contacto.parentesco} · {contacto.telefono}</p>
      {!accion && <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setAccion({ tipo: 'editar', contacto })}>Editar contacto</Button>
        {!contacto.es_principal && <Button variant="light" size="sm" onClick={() => setAccion({ tipo: 'principal', contacto })}>Hacer principal</Button>}
        {!contacto.es_principal && contactos.length > 1 && <Button variant="ghost" size="sm" onClick={() => setAccion({ tipo: 'eliminar', contacto })}>Eliminar contacto</Button>}
      </div>}
    </Card>)}
    {(accion?.tipo === 'nuevo' || accion?.tipo === 'editar') && <Formulario key={editado?.contacto_id ?? 'nuevo'} titulo={editado ? 'Editar contacto' : 'Añadir contacto'}
      campos={camposContacto(editado)} cancelar={cerrar} enviar={async (datos) => {
        const contactoRuta = editado ? `${base}/contactos/${idRuta(String(editado.contacto_id))}` : `${ruta}/contactos`
        await api(contactoRuta, token, editado ? 'PATCH' : 'POST', datosContacto(datos))
        guardado()
      }} />}
    {(accion?.tipo === 'principal' || accion?.tipo === 'eliminar') && <Formulario
      titulo={accion.tipo === 'principal' ? 'Cambiar contacto principal' : 'Eliminar contacto'}
      campos={[]} cancelar={cerrar} accion={accion.tipo === 'principal' ? 'Confirmar contacto principal' : 'Confirmar eliminación'}
      enviar={async () => {
        await api(`${base}/contactos/${idRuta(String(accion.contacto.contacto_id))}/${accion.tipo}`, token, 'POST')
        guardado()
      }}>
      <p className="text-sm text-ink-2 md:col-span-2">{accion.tipo === 'principal'
        ? `${nombre(accion.contacto)} será la primera persona de contacto en una emergencia.`
        : `Se retirará a ${nombre(accion.contacto)} de los contactos de emergencia.`}</p>
    </Formulario>}
  </section>
}

type Edicion = 'identificacion' | 'ubicacion' | 'contactos' | 'estado'
function EstadoPerfil({ perfil, ruta, token, refrescar, cancelar }: {
  perfil: Perfil; ruta: string; token: string; refrescar: () => void; cancelar: () => void
}) {
  const [estado, setEstado] = useState('')
  const opcionesEstado = perfil.estado === 'activo'
    ? [{ value: 'inactivo', label: 'Inactivar perfil' }, { value: 'fallecido', label: 'Registrar fallecimiento' }]
    : [{ value: 'activo', label: 'Reactivar perfil' }, { value: 'fallecido', label: 'Registrar fallecimiento' }]
  return <Formulario titulo="Cambiar estado del expediente" campos={[]} cancelar={cancelar} accion="Confirmar cambio" enviar={async (datos) => {
    const motivo = campo(datos, 'motivo')
    if (estado === 'inactivo' && motivo.length < 3) throw new Error('Escribe un motivo para inactivar el expediente.')
    await api(`${ruta}/estado`, token, 'POST', { estado, ...(motivo ? { motivo } : {}) })
    refrescar()
    cancelar()
  }}>
    <SelectField label="Nuevo estado" name="estado" placeholder="Selecciona el cambio" required options={opcionesEstado}
      value={estado} onChange={(event) => setEstado(event.currentTarget.value)} />
    <TextareaField label="Motivo" name="motivo" maxLength={200} required={estado === 'inactivo'} />
    {(estado === 'inactivo' || estado === 'fallecido') && <p className="text-sm text-ink-2 md:col-span-2">
      Se cerrarán las tareas, alertas y visitas pendientes que correspondan. El historial seguirá disponible.
    </p>}
  </Formulario>
}

function Expediente({ id, volver, revision, refrescar, ...props }: OperacionProps & {
  id: string; volver: () => void; revision: number; refrescar: () => void
}) {
  const { base, token, cuenta } = props
  const [edicion, setEdicion] = useState<Edicion>()
  const [evaluacionesSolicitadas, solicitarEvaluacion] = useState(0)
  const seguimientoRef = useRef<HTMLDivElement>(null)
  const ruta = `${base}/envejecientes/${idRuta(id)}`
  const consulta = useDatos<Perfil>(ruta, token, revision)
  const sensible = cuenta.permisos.includes('adultos:ver-sensible')
  const riesgo = useDatos<ResumenRiesgo>(sensible ? `${ruta}/riesgo` : null, token, revision)
  const ultima = usePagina<{ fecha: string }>(cuenta.permisos.includes('visitas:ver') ? `${base}/visitas` : null,
    token, revision, { limit: 1, filters: { envejeciente_id: id, estado: 'completada' } })
  const perfil = consulta.datos
  const editar = cuenta.permisos.includes('adultos:editar')
  const gestionarEstado = cuenta.permisos.includes('adultos:desactivar')
  const cerrar = () => setEdicion(undefined)
  const guardado = () => { cerrar(); refrescar() }
  const ultimaFecha = ultima.datos?.data[0]?.fecha

  return <section className="grid gap-5">
    <Button variant="ghost" size="sm" className="justify-self-start" icon={<ArrowLeft size={18} aria-hidden />} onClick={volver}>Volver a Envejecientes</Button>
    <Estado consulta={consulta} />
    {perfil && <>
      <section className="flex flex-col items-center gap-2 text-center" aria-label="Resumen del adulto mayor">
        <img src="/figma-miembros/perfil.svg" alt="" width={80} height={80} />
        <h2 className="break-words text-2xl font-bold text-navy">{nombre(perfil)}</h2>
        {perfil.cedula && <p className="text-sm text-muted">{cedulaVisible(perfil.cedula)}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          {riesgo.datos?.nivel_vigente ? <RiesgoBadge riesgo={riesgo.datos.nivel_vigente} /> : riesgo.datos && <Badge>Sin evaluación vigente</Badge>}
          <Badge tone={perfil.estado === 'activo' ? 'success' : 'neutral'}>{ESTADO[perfil.estado]}</Badge>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <section className="grid gap-4" aria-label="Información personal">
          <h3 className="font-semibold">Información personal</h3>
          {perfil.fecha_nacimiento && <InfoRow label="Fecha de nacimiento" icon={<Cake size={18} aria-hidden />} value={fechaCorta(perfil.fecha_nacimiento)} />}
          {perfil.telefono && <InfoRow label="Teléfono" icon={<Phone size={18} aria-hidden />} value={perfil.telefono} />}
          {perfil.sexo && <InfoRow label="Sexo" icon={<VenusAndMars size={18} aria-hidden />} value={SEXOS.find((s) => s.value === perfil.sexo)?.label ?? perfil.sexo} />}
          <InfoRow label="Ubicación" icon={<MapPin size={18} aria-hidden />} value={[perfil.zona, perfil.municipio_nombre, perfil.direccion].filter(Boolean).join(' · ') || 'Sin ubicación registrada'} />
          {perfil.contacto_principal && <InfoRow label="Contacto de emergencia" icon={<Phone size={18} aria-hidden />}
            value={`${nombre(perfil.contacto_principal)} · ${perfil.contacto_principal.telefono}`} />}
          {perfil.condicion_general && <InfoRow label="Condición general" value={[
            AUTONOMIAS.find((o) => o.value === perfil.condicion_general?.autonomia)?.label,
            ...(perfil.condicion_general.condiciones ?? []).map((condicion) => CONDICIONES.find((o) => o.value === condicion)?.label ?? condicion),
            perfil.condicion_general.nota,
          ].filter(Boolean).join(' · ') || 'Sin información registrada'} />}
          {perfil.consentimiento && <InfoRow label="Consentimiento informado" value={perfil.consentimiento.otorgado_por === 'adulto'
            ? 'Otorgado por el adulto mayor'
            : `Otorgado por su representante${perfil.consentimiento.representante ? `: ${perfil.consentimiento.representante}` : ''}`} />}
        </section>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            {cuenta.permisos.includes('visitas:ver') && <Card tone="info" className="grid gap-1 text-center">
              <span className="text-xs text-ink-2">Última visita</span>
              <strong className="text-sm text-ink">{ultimaFecha ? fechaCorta(ultimaFecha) : ultima.error ? 'Sin datos' : ultima.datos ? 'Sin visitas' : 'Consultando…'}</strong>
            </Card>}
            {perfil.contactos && <Card tone="info" className="grid gap-1 text-center">
              <span className="text-xs text-ink-2">Contactos de emergencia</span>
              <strong className="text-sm text-ink">{perfil.contactos.length}</strong>
            </Card>}
          </div>
          {(editar || gestionarEstado || cuenta.permisos.includes('adultos:evaluar')) && <section className="grid gap-2" aria-label="Acciones rápidas">
            <h3 className="font-semibold">Acciones rápidas</h3>
            {editar && <>
              <Button variant="light" size="sm" aria-pressed={edicion === 'identificacion'} onClick={() => setEdicion('identificacion')}>Editar información</Button>
              <Button variant="light" size="sm" aria-pressed={edicion === 'ubicacion'} onClick={() => setEdicion('ubicacion')}>Editar ubicación y cuidado</Button>
              <Button variant="light" size="sm" aria-pressed={edicion === 'contactos'} onClick={() => setEdicion('contactos')}>Gestionar contactos</Button>
            </>}
            {perfil.estado === 'activo' && cuenta.permisos.includes('adultos:evaluar') && <Button variant="light" size="sm" icon={<ShieldCheck size={18} aria-hidden />}
              onClick={() => { solicitarEvaluacion((n) => n + 1); seguimientoRef.current?.scrollIntoView({ block: 'start' }) }}>Realizar evaluación de riesgo</Button>}
            {gestionarEstado && perfil.estado !== 'fallecido' && <Button variant="outline" size="sm" aria-pressed={edicion === 'estado'} onClick={() => setEdicion('estado')}>Cambiar estado</Button>}
          </section>}
        </div>
      </div>

      {edicion === 'identificacion' && <Identificacion valor={perfil} editando cancelar={cerrar} enviar={async (datos) => {
        await api(ruta, token, 'PATCH', datos)
        guardado()
      }} />}
      {edicion === 'ubicacion' && <Ubicacion token={token} perfil={perfil} cancelar={cerrar} enviar={async ({ provincia: _provincia, ...datos }) => {
        await api(ruta, token, 'PATCH', datos)
        guardado()
      }} />}
      {edicion === 'contactos' && <Contactos {...props} ruta={ruta} perfil={perfil} refrescar={refrescar} />}
      {edicion === 'estado' && <EstadoPerfil perfil={perfil} ruta={ruta} token={token} refrescar={refrescar} cancelar={cerrar} />}

      <div ref={seguimientoRef} className="scroll-mt-6">
        <Seguimiento key={evaluacionesSolicitadas} {...props} ruta={ruta} adultoActivo={perfil.estado === 'activo'}
          riesgo={riesgo} revision={revision} actualizar={refrescar} abrirEvaluacion={evaluacionesSolicitadas > 0} />
      </div>
    </>}
  </section>
}

export function Envejecientes(props: OperacionProps) {
  const { base, token, cuenta } = props
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' })
  const [revision, setRevision] = useState(0)
  const [estado, setEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const region = useRef<HTMLDivElement>(null)
  const listado = usePagina<Perfil>(`${base}/envejecientes`, token, revision, { filters: estado ? { estado } : undefined })
  const criterio = normaliza(busqueda.trim())
  const adultos = listado.datos?.data.filter((adulto) => !criterio || normaliza(`${nombre(adulto)} ${adulto.zona ?? ''}`).includes(criterio)) ?? []
  const refrescar = () => setRevision((n) => n + 1)
  const volver = () => setVista({ tipo: 'lista' })
  const puedeCrear = cuenta.permisos.includes('adultos:crear')

  useEffect(() => {
    region.current?.focus({ preventScroll: true })
  }, [vista])

  return <div ref={region} tabIndex={-1} className="outline-none">
    {vista.tipo === 'alta' && <Crear {...props} cerrar={volver} creado={(id) => { setVista({ tipo: 'perfil', id }); refrescar() }} />}
    {vista.tipo === 'perfil' && <Expediente key={vista.id} {...props} id={vista.id} volver={volver} revision={revision} refrescar={refrescar} />}
    {vista.tipo === 'lista' && <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink">Envejecientes</h2>
        {puedeCrear && <Button size="sm" icon={<Plus size={18} aria-hidden />} onClick={() => setVista({ tipo: 'alta' })}>Registrar adulto mayor</Button>}
      </div>
      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,2fr)_minmax(13rem,1fr)]">
        <label className="grid gap-1.5 text-sm font-semibold text-ink">
          Buscar en esta página
          <SearchInput value={busqueda} onChange={(event) => setBusqueda(event.currentTarget.value)} placeholder="Nombre o sector" />
        </label>
        <SelectField label="Estado del expediente" value={estado} options={[{ value: '', label: 'Todos los estados' },
          ...Object.entries(ESTADO).map(([value, label]) => ({ value, label }))]}
          onChange={(event) => { setEstado(event.currentTarget.value); listado.cambiar(1) }} />
      </div>
      <Estado consulta={listado} />
      {listado.datos && adultos.length === 0 && <EmptyState title={busqueda || estado ? 'Sin coincidencias' : 'Sin perfiles disponibles'}
        text={busqueda || estado ? 'Cambia la búsqueda o el estado seleccionado.' : 'Aquí aparecerán los adultos mayores a los que tienes acceso.'}
        action={busqueda || estado ? <Button variant="outline" size="sm" onClick={() => { setBusqueda(''); setEstado(''); listado.cambiar(1) }}>Limpiar filtros</Button> : undefined} />}
      {adultos.length > 0 && <ul className="grid gap-3 md:grid-cols-2" aria-label="Adultos mayores">
        {adultos.map((adulto) => <li key={adulto.envejeciente_id}>
          <button type="button" onClick={() => setVista({ tipo: 'perfil', id: adulto.envejeciente_id })}
            className="flex h-full w-full flex-col overflow-hidden rounded-sm border border-line bg-bg text-left transition-shadow hover:shadow-1">
            <div className="flex min-w-0 flex-1 items-start gap-3 p-4">
              <IconTile />
              <div className="min-w-0 space-y-1">
                <h3 className="break-words text-lg font-semibold text-ink">{nombre(adulto)}</h3>
                {adulto.zona && <p className="text-sm text-muted">{adulto.zona}</p>}
                <Badge tone={adulto.estado === 'activo' ? 'success' : 'neutral'}>{ESTADO[adulto.estado]}</Badge>
              </div>
            </div>
            <span className="flex min-h-12 items-center justify-end gap-2 border-t border-navy bg-blue-100 px-4 text-sm font-semibold text-navy">
              Ver perfil <ArrowRight size={18} aria-hidden />
            </span>
          </button>
        </li>)}
      </ul>}
      {listado.datos && <Paginador pagina={listado.pagina} total={listado.datos.meta.totalPages} cambiar={listado.cambiar} />}
    </section>}
  </div>
}
