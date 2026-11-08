/*
 * envejecientes.tsx — Alta, expediente y contactos conectados (ID03).
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { Button, SelectField, TextField } from '@/components/ui'
import { api } from '../client'
import type { Municipio, Provincia } from '../api/catalogos'
import { campo, Estado, Formulario, idRuta, opciones, Paginador, useDatos, usePagina, type Campo } from './controles'
import { Seguimiento } from './seguimiento'
import type { AdultoNombre, OperacionProps } from './visitas'

interface Contacto { contacto_id: string; nombres: string; apellidos: string; parentesco: string; telefono: string; es_principal: boolean }
interface Perfil extends AdultoNombre {
  estado: string; cedula?: string; fecha_nacimiento?: string; sexo?: string; telefono?: string | null
  municipio_cod: string; municipio_nombre: string; provincia_cod: string; zona: string; direccion?: string | null
  contacto_principal?: Contacto | null; contactos?: Contacto[]
  condicion_general?: { autonomia: string; condiciones: string[]; nota: string | null }
}

const camposPersona = (perfil?: Perfil): Campo[] => [
  { name: 'nombres', label: 'Nombres', value: perfil?.nombres, max: 60 },
  { name: 'apellidos', label: 'Apellidos', value: perfil?.apellidos, max: 60 },
  { name: 'cedula', label: 'Cédula del adulto', value: perfil?.cedula, max: 14 },
  { name: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date', value: perfil?.fecha_nacimiento },
  { name: 'sexo', label: 'Sexo', options: [{ value: 'F', label: 'Femenino' }, { value: 'M', label: 'Masculino' }], value: perfil?.sexo },
]
const camposContacto = (contacto?: Contacto): Campo[] => [
  { name: 'nombres', label: 'Nombres del contacto', value: contacto?.nombres, max: 60 },
  { name: 'apellidos', label: 'Apellidos del contacto', value: contacto?.apellidos, max: 60 },
  { name: 'parentesco', label: 'Parentesco', value: contacto?.parentesco, max: 40 },
  { name: 'telefono', label: 'Teléfono del contacto', type: 'tel', value: contacto?.telefono, max: 20 },
]
const datosCampos = (datos: FormData, campos: Campo[]) => Object.fromEntries(campos.map(({ name }) => [name, campo(datos, name)]))

function Ubicacion({ token, perfil, enviar }: { token: string; perfil?: Perfil; enviar: (datos: Record<string, string | null>) => Promise<void> }) {
  const [provincia, setProvincia] = useState(perfil?.provincia_cod ?? '')
  const provincias = useDatos<Provincia[]>('/catalogos/provincias', token)
  const municipios = useDatos<Municipio[]>(provincia ? `/catalogos/municipios?provincia_cod=${idRuta(provincia)}&limit=100` : null, token)
  const campos = [
    { name: 'zona', label: 'Sector o zona', value: perfil?.zona, max: 60 },
    { name: 'direccion', label: 'Dirección', value: perfil?.direccion ?? '', optional: true, max: 150 },
    { name: 'telefono', label: 'Teléfono del adulto', type: 'tel', value: perfil?.telefono ?? '', optional: true, max: 20 },
    { name: 'autonomia', label: 'Autonomía', options: opciones('independiente', 'parcial', 'dependiente'), value: perfil?.condicion_general?.autonomia },
  ]
  return <Formulario titulo="Ubicación y cuidado" campos={campos} accion={perfil ? 'Guardar ubicación' : 'Continuar'} enviar={(datos) =>
    enviar({ ...datosCampos(datos, campos), municipio_cod: campo(datos, 'municipio'), telefono: campo(datos, 'telefono') || null })}>
    <SelectField label="Provincia" placeholder="Selecciona" value={provincia} required onChange={(event) => setProvincia(event.currentTarget.value)}
      options={provincias.datos?.map((p) => ({ value: p.provincia_cod, label: p.nombre })) ?? []} />
    <SelectField key={provincia} label="Municipio" name="municipio" placeholder="Selecciona" required defaultValue={provincia === perfil?.provincia_cod ? perfil?.municipio_cod : ''}
      options={municipios.datos?.map((m) => ({ value: m.municipio_cod, label: m.nombre })) ?? []} />
    {provincias.error && <Estado consulta={provincias} />}
    {municipios.error && <Estado consulta={municipios} />}
  </Formulario>
}

function Crear({ base, token, creado }: Pick<OperacionProps, 'base' | 'token'> & { creado: (id: string) => void }) {
  const [identidad, setIdentidad] = useState<Record<string, string>>()
  const [ubicacion, setUbicacion] = useState<Record<string, string | null>>()
  const [representante, setRepresentante] = useState(false)
  if (!identidad) return <Formulario titulo="1 de 3 · Identificación" campos={camposPersona()} accion="Continuar" enviar={async (datos) => setIdentidad(datosCampos(datos, camposPersona()))} />
  if (!ubicacion) return <Ubicacion token={token} enviar={async (datos) => setUbicacion(datos)} />
  return <Formulario titulo="3 de 3 · Consentimiento y contacto principal" campos={camposContacto()} accion="Registrar adulto mayor" enviar={async (datos) => {
    const perfil = await api<Perfil>(`${base}/envejecientes`, token, 'POST', {
      ...identidad, ...ubicacion,
      consentimiento: { otorgado: datos.get('otorgado') === 'on', otorgado_por: representante ? 'representante' : 'adulto', representante: representante ? campo(datos, 'representante') : null },
      contactos: [{ ...datosCampos(datos, camposContacto()), es_principal: true }],
    })
    creado(perfil.envejeciente_id)
  }}>
    <SelectField label="Quién otorgó el consentimiento" value={representante ? 'representante' : 'adulto'} onChange={(event) => setRepresentante(event.currentTarget.value === 'representante')}
      options={[{ value: 'adulto', label: 'El adulto mayor' }, { value: 'representante', label: 'Su representante' }]} />
    {representante && <TextField name="representante" label="Nombre del representante" required maxLength={120} />}
    <label className="flex min-h-12 items-center gap-2 md:col-span-2">
      <input type="checkbox" name="otorgado" required /> Confirmo que se otorgó el consentimiento informado.
    </label>
  </Formulario>
}

function Contactos({ base, ruta, token, perfil, refrescar }: {
  base: string; ruta: string; token: string; perfil: Perfil; refrescar: () => void
}) {
  const [editado, setEditado] = useState<Contacto>()
  return <section className="grid gap-3">
    <h3 className="font-semibold">Contactos de emergencia</h3>
    {perfil.contactos?.map((c) => <div className="grid gap-2" key={c.contacto_id}>
      <p>{c.nombres} {c.apellidos} · {c.parentesco} · {c.telefono} {c.es_principal && '· Principal'}</p>
      <Button variant="outline" onClick={() => setEditado(c)}>Editar contacto de {c.nombres}</Button>
      {!c.es_principal && <>
        <Formulario titulo={`Contacto de ${c.nombres}`} campos={[]} accion="Hacer principal" enviar={async () => {
          await api(`${base}/contactos/${idRuta(c.contacto_id)}/principal`, token, 'POST')
          refrescar()
        }} />
        <Formulario titulo={`Quitar contacto de ${c.nombres}`} campos={[]} accion="Eliminar contacto" enviar={async () => {
          await api(`${base}/contactos/${idRuta(c.contacto_id)}/eliminar`, token, 'POST')
          setEditado(undefined)
          refrescar()
        }} />
      </>}
    </div>)}
    {(editado || (perfil.contactos?.length ?? 0) < 5) && <Formulario key={editado?.contacto_id ?? 'nuevo'} titulo={editado ? 'Editar contacto' : 'Añadir contacto'}
      campos={camposContacto(editado)} enviar={async (datos) => {
        const valores = datosCampos(datos, camposContacto())
        if (editado) await api(`${base}/contactos/${idRuta(editado.contacto_id)}`, token, 'PATCH', valores)
        else await api(`${ruta}/contactos`, token, 'POST', valores)
        setEditado(undefined)
        refrescar()
      }} />}
  </section>
}

export function Envejecientes(props: OperacionProps) {
  const { base, token, cuenta } = props
  const [id, setId] = useState<string>()
  const [creando, setCreando] = useState(false)
  const [revision, setRevision] = useState(0)
  const refrescar = () => setRevision((n) => n + 1)
  const listado = usePagina<(AdultoNombre & { estado: string })>(`${base}/envejecientes`, token, revision)
  const ruta = id ? `${base}/envejecientes/${idRuta(id)}` : null
  const consulta = useDatos<Perfil>(ruta, token, revision)
  const perfil = consulta.datos
  const editar = cuenta.permisos.includes('adultos:editar')
  return <section className="grid gap-4">
    <h2 className="text-lg font-semibold">Envejecientes</h2>
    {cuenta.permisos.includes('adultos:crear') && <Button variant="outline" onClick={() => setCreando(!creando)}>{creando ? 'Cerrar alta' : 'Registrar adulto mayor'}</Button>}
    {creando && <Crear base={base} token={token} creado={(nuevo) => { setCreando(false); setId(nuevo); refrescar() }} />}
    <Estado consulta={listado} vacio={listado.datos?.data.length === 0 ? 'Sin perfiles disponibles.' : undefined} />
    {listado.datos?.data.map((a) => <Button key={a.envejeciente_id} variant="outline" onClick={() => setId(a.envejeciente_id)}>
      {a.nombres} {a.apellidos} · {a.estado}
    </Button>)}
    {listado.datos && <Paginador pagina={listado.pagina} total={listado.datos.meta.totalPages} cambiar={listado.cambiar} />}
    {id && <Estado consulta={consulta} />}
    {perfil && ruta && <section key={perfil.envejeciente_id} className="grid gap-3">
      <h3 className="font-semibold">{perfil.nombres} {perfil.apellidos}</h3>
      <p>{perfil.estado} · {perfil.municipio_nombre} · {perfil.zona}</p>
      {perfil.cedula && <p>Cédula: {perfil.cedula}</p>}
      {perfil.condicion_general && <p>Autonomía: {perfil.condicion_general.autonomia}</p>}
      {perfil.contacto_principal && <p>Contacto principal: {perfil.contacto_principal.nombres} {perfil.contacto_principal.apellidos} · {perfil.contacto_principal.telefono}</p>}
      {editar && <>
        <Formulario titulo="Editar identificación" campos={camposPersona(perfil)} enviar={async (datos) => {
          await api(ruta, token, 'PATCH', datosCampos(datos, camposPersona(perfil)))
          refrescar()
        }} />
        <Ubicacion token={token} perfil={perfil} enviar={async (datos) => { await api(ruta, token, 'PATCH', datos); refrescar() }} />
        <Contactos base={base} ruta={ruta} token={token} perfil={perfil} refrescar={refrescar} />
      </>}
      <Seguimiento {...props} ruta={ruta} />
    </section>}
  </section>
}
