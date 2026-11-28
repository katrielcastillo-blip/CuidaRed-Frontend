/*
 * envejecientes.tsx — Alta, expediente y contactos conectados (ID03). Lista de adultos mayores, registro en tres pasos y
 * expediente con pestañas (Resumen · Historial · Necesidades · Riesgo) y hoja «Más acciones»; cada acción de edición,
 * contactos, estado, asignaciones, evaluación, indicaciones e informe es una pantalla secundaria (volver + título).
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Avatar, Aviso, Button, ButtonLink, Checkbox, CheckboxGroup, Chip, EmptyState, Icono, SearchInput, SelectField, Sheet, StepBar,
  TextField, TextareaField, type NombreIcono,
} from '@/components/ui'
import { AUTONOMIAS, CONDICIONES, PARENTESCOS } from '@/domain/catalogos'
import { diasCalendario, edad, fechaCorta, fechaHora } from '@/domain/dates'
import { cn } from '@/lib/cn'
import { api } from '../client'
import type { ColaOperaciones } from './cola-operaciones'
import type { Municipio, Provincia } from '../api/catalogos'
import { campo, Estado, Formulario, idRuta, OpcionesRadio, Paginador, useConexionReal, useDatos, usePagina, type Campo } from './controles'
import { CabezaPersona, ESTADO_ADULTO, FilaDato, IndicadorEstado, IndicadorNivel, Panel, PestanasPerfil, TituloBloque, type EstadoAdulto } from './expediente-ui'
import { InformeMedico } from './informe-medico'
import { usePantallaSecundaria } from './marco/pantalla-secundaria'
import { Necesidades } from './necesidades'
import {
  PanelHistorial, PanelRiesgo, PantallaEvaluacion, PantallaFactor, PantallaIndicaciones, PantallaResolver, PantallaVinculos,
  type DatosVinculos, type Factor, type Indicacion, type ResumenRiesgo, type SeccionProps,
} from './seguimiento'
import type { AdultoNombre, OperacionProps } from './visitas'

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

const SEXOS = [{ value: 'F', label: 'Femenino' }, { value: 'M', label: 'Masculino' }]
const PASOS = ['Identificación', 'Ubicación y cuidado', 'Contacto y consentimiento']
const POR_QUIEN = [{ value: 'adulto', label: 'El adulto mayor' }, { value: 'representante', label: 'Su representante' }]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
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

/** Pantalla secundaria sencilla: registra volver + título en el marco y muestra su contenido. */
function Pantalla({ titulo, volver, children }: { titulo: string; volver: () => void; children: ReactNode }) {
  usePantallaSecundaria({ titulo, volver })
  return <>{children}</>
}

function Identificacion({ valor, enviar, cancelar, editando }: {
  valor?: Partial<Identidad>; enviar: (datos: Identidad) => Promise<void>; cancelar?: () => void; editando?: boolean
}) {
  const fechas = fechasPermitidas()
  return <Formulario variante="pagina" titulo={editando ? 'Editar identificación' : 'Identificación'} contexto={editando ? undefined : 'Identificación del adulto'} campos={[
    { name: 'nombres', label: 'Nombres', value: valor?.nombres, max: 60, placeholder: 'Ej.: Juan Antonio' },
    { name: 'apellidos', label: 'Apellidos', value: valor?.apellidos, max: 60, placeholder: 'Ej.: Collado Pérez' },
    { name: 'cedula', label: 'Cédula del adulto', value: valor?.cedula, inputMode: 'numeric', max: 14, placeholder: '00000000000', hint: '11 dígitos, con o sin guiones.' },
    { name: 'fecha_nacimiento', label: 'Fecha de nacimiento', value: valor?.fecha_nacimiento, type: 'date', min: fechas.min, maxNumber: fechas.max, hint: 'Debe tener entre 60 y 120 años.' },
    { name: 'sexo', label: 'Sexo', value: valor?.sexo, options: SEXOS, tarjetas: editando ? 'fila' : 'lista' },
  ]} accion={editando ? 'Guardar cambios' : 'Continuar'} cancelar={cancelar} exito="" enviar={async (datos) => {
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
  enviar: (datos: UbicacionDatos & { provincia: string }) => Promise<void>; cancelar?: () => void
}) {
  const inicial = borrador?.provincia ?? perfil?.provincia_cod ?? ''
  const [provincia, setProvincia] = useState(inicial)
  const [municipio, setMunicipio] = useState(borrador?.municipio_cod ?? perfil?.municipio_cod ?? '')
  const [condiciones, setCondiciones] = useState<string[]>(borrador?.condiciones ?? perfil?.condicion_general?.condiciones ?? [])
  const provincias = useDatos<Provincia[]>('/catalogos/provincias', token)
  const municipios = useDatos<Municipio[]>(provincia ? `/catalogos/municipios?provincia_cod=${idRuta(provincia)}&limit=100` : null, token)
  return <Formulario variante="pagina" titulo="Ubicación y cuidado" campos={[]} accion={perfil ? 'Guardar cambios' : 'Continuar'} exito=""
    disabled={!provincias.datos?.length || (!!provincia && !municipios.datos?.length)} cancelar={cancelar} enviar={(datos) => enviar({
      provincia, municipio_cod: campo(datos, 'municipio'), zona: campo(datos, 'zona'), direccion: campo(datos, 'direccion'),
      telefono: telefono(campo(datos, 'telefono')) || null, autonomia: campo(datos, 'autonomia'),
      condiciones, nota_condicion: campo(datos, 'nota_condicion') || null,
    })}>
    <h4 className="text-seccion text-ink">¿Dónde vive?</h4>
    <SelectField label="Provincia" name="provincia" placeholder={provincias.datos ? 'Selecciona una provincia' : 'Cargando provincias…'}
      value={provincia} required onChange={(event) => { setProvincia(event.currentTarget.value); setMunicipio('') }}
      options={provincias.datos?.map((p) => ({ value: p.provincia_cod, label: p.nombre })) ?? []} />
    <SelectField label="Municipio" name="municipio" placeholder={provincia ? 'Selecciona un municipio' : 'Selecciona primero la provincia'} required
      disabled={!municipios.datos?.length} value={municipio} onChange={(event) => setMunicipio(event.currentTarget.value)}
      options={municipios.datos?.map((m) => ({ value: m.municipio_cod, label: m.nombre })) ?? []} />
    {provincias.error && <Estado consulta={provincias} />}
    {provincia && municipios.error && <Estado consulta={municipios} />}
    <TextField name="zona" label="Sector o zona" defaultValue={borrador?.zona ?? perfil?.zona} maxLength={60} required placeholder="Ej.: Mirador Norte" />
    <TextField name="direccion" label="Dirección" defaultValue={borrador?.direccion ?? perfil?.direccion ?? ''} maxLength={150} placeholder="Calle, número, referencia" />
    <TextField name="telefono" label="Teléfono del adulto" type="tel" defaultValue={borrador?.telefono ?? perfil?.telefono ?? ''} maxLength={20}
      placeholder="809-000-0000" hint="Opcional. Si no tiene, lo dejas en blanco." />
    <h4 className="text-seccion text-ink">Su cuidado</h4>
    <OpcionesRadio name="autonomia" label="Autonomía" required options={AUTONOMIAS}
      defaultValue={borrador?.autonomia ?? perfil?.condicion_general?.autonomia} />
    <CheckboxGroup label="Condiciones generales" hint="Marca las que apliquen." options={CONDICIONES} value={condiciones} onChange={setCondiciones} />
    <TextareaField name="nota_condicion" label="Notas sobre la condición" maxLength={500} placeholder="Algo que el equipo deba saber (opcional)"
      hint="Máximo 500 caracteres." defaultValue={borrador?.nota_condicion ?? perfil?.condicion_general?.nota ?? ''} />
  </Formulario>
}

const camposContacto = (contacto?: Contacto): Campo[] => [
  { name: 'nombres', label: 'Nombres del contacto', value: contacto?.nombres, max: 60, placeholder: 'Ej.: Ana' },
  { name: 'apellidos', label: 'Apellidos del contacto', value: contacto?.apellidos, max: 60, placeholder: 'Ej.: Collado' },
  { name: 'parentesco', label: 'Parentesco', value: contacto?.parentesco, placeholder: 'Selecciona el parentesco',
    options: [...new Set([...PARENTESCOS, ...(contacto?.parentesco ? [contacto.parentesco] : [])])].map((value) => ({ value, label: value })) },
  { name: 'telefono', label: 'Teléfono del contacto', type: 'tel', value: contacto?.telefono, max: 20, placeholder: '809-000-0000' },
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
  usePantallaSecundaria({ titulo: 'Registrar adulto mayor', volver: paso > 1 ? () => setPaso(paso - 1) : cerrar })
  return <div className="grid max-w-form grid-cols-1 gap-5">
    <div className="grid grid-cols-1 gap-2">
      <p className="text-ayuda text-muted wrap-anywhere" aria-live="polite">Paso {paso} de 3 · {PASOS[paso - 1]}</p>
      <StepBar step={paso} total={3} />
    </div>
    {paso === 1 && <Identificacion valor={identidad} enviar={async (datos) => { setIdentidad(datos); setPaso(2) }} />}
    {paso === 2 && <Ubicacion token={token} borrador={ubicacion} enviar={async (datos) => { setUbicacion(datos); setPaso(3) }} />}
    {paso === 3 && identidad && ubicacion && <Formulario variante="pagina" titulo="Consentimiento y contacto principal" campos={camposContacto()}
      contexto={<>Contacto principal<span className="mt-1 block text-ayuda font-normal text-muted">La persona a quien llamamos primero si algo pasa.</span></>}
      accion="Registrar adulto mayor" exito="" enviar={async (datos) => {
        const { provincia: _provincia, ...cuidado } = ubicacion
        const perfil = await api<Perfil>(`${base}/envejecientes`, token, 'POST', {
          ...identidad, ...cuidado,
          consentimiento: { otorgado: datos.get('otorgado') === 'on', otorgado_por: otorgante, representante: otorgante === 'representante' ? campo(datos, 'representante') : null },
          contactos: [{ ...datosContacto(datos), es_principal: true }],
        })
        creado(perfil.envejeciente_id)
      }}>
      <h4 className="text-seccion text-ink">Consentimiento informado</h4>
      <OpcionesRadio name="otorgante" label="¿Quién otorgó el consentimiento?" required options={POR_QUIEN} value={otorgante} onChange={setOtorgante} />
      {otorgante === 'representante' && <TextField name="representante" label="Nombre del representante" required maxLength={120}
        placeholder="Ej.: Carlos Collado" hint='Aparece porque elegiste "Su representante".' />}
      <Checkbox name="otorgado" required label="Confirmo que se otorgó el consentimiento informado."
        className="rounded-xl border border-surface-2 bg-surface px-4" />
    </Formulario>}
  </div>
}

type AccionContacto = { tipo: 'nuevo' } | { tipo: 'editar' | 'principal' | 'eliminar'; contacto: Contacto }
function Contactos({ base, ruta, token, perfil, refrescar, volver }: Pick<OperacionProps, 'base' | 'token'> & {
  ruta: string; perfil: Perfil; refrescar: () => void; volver: () => void
}) {
  const [accion, setAccion] = useState<AccionContacto>()
  const contactos = perfil.contactos ?? (perfil.contacto_principal ? [perfil.contacto_principal] : [])
  const cerrar = () => setAccion(undefined)
  const guardado = () => { cerrar(); refrescar() }
  const editado = accion?.tipo === 'editar' ? accion.contacto : undefined
  usePantallaSecundaria({
    titulo: !accion ? 'Contactos de emergencia' : accion.tipo === 'nuevo' ? 'Añadir contacto' : accion.tipo === 'editar' ? 'Editar contacto'
      : accion.tipo === 'principal' ? 'Cambiar contacto principal' : 'Eliminar contacto',
    volver: accion ? cerrar : volver,
  })
  if (accion?.tipo === 'nuevo' || accion?.tipo === 'editar') {
    return <div className="grid max-w-form grid-cols-1 gap-5">
      <Formulario key={editado?.contacto_id ?? 'nuevo'} variante="pagina" titulo={editado ? 'Editar contacto' : 'Añadir contacto'} contexto={nombre(perfil)}
        accion="Guardar contacto" campos={camposContacto(editado)} cancelar={cerrar} exito="" enviar={async (datos) => {
          const contactoRuta = editado ? `${base}/contactos/${idRuta(String(editado.contacto_id))}` : `${ruta}/contactos`
          await api(contactoRuta, token, editado ? 'PATCH' : 'POST', datosContacto(datos))
          guardado()
        }} />
      {editado && !editado.es_principal && <div className="grid grid-cols-1 gap-3">
        <Button variant="outline" fullWidth onClick={() => setAccion({ tipo: 'principal', contacto: editado })}>Hacer principal</Button>
        {contactos.length > 1 && <Button variant="danger-soft" fullWidth onClick={() => setAccion({ tipo: 'eliminar', contacto: editado })}>Eliminar contacto</Button>}
      </div>}
    </div>
  }
  if (accion) {
    return <Formulario variante="pagina" titulo={accion.tipo === 'principal' ? 'Cambiar contacto principal' : 'Eliminar contacto'} contexto={nombre(accion.contacto)}
      campos={[]} cancelar={cerrar} exito="" peligro={accion.tipo === 'eliminar'}
      accion={accion.tipo === 'principal' ? 'Confirmar contacto principal' : 'Confirmar eliminación'}
      enviar={async () => {
        await api(`${base}/contactos/${idRuta(String(accion.contacto.contacto_id))}/${accion.tipo}`, token, 'POST')
        guardado()
      }}>
      <p className="text-cuerpo text-ink-2 wrap-anywhere">{accion.tipo === 'principal'
        ? `${nombre(accion.contacto)} será la primera persona de contacto en una emergencia.`
        : `Se retirará a ${nombre(accion.contacto)} de los contactos de emergencia.`}</p>
    </Formulario>
  }
  return <section className="grid max-w-form grid-cols-1 gap-4" aria-label="Contactos de emergencia">
    <p className="text-cuerpo text-muted">El contacto principal es a quien llamamos primero.</p>
    {contactos.length === 0 && <p className="text-ayuda text-muted wrap-anywhere">Aún no hay contactos de emergencia.</p>}
    {contactos.length > 0 && <Panel className="py-0">
      {contactos.map((contacto) => <div key={contacto.contacto_id} className="flex min-h-[72px] items-center gap-3 py-3">
        <button type="button" aria-label={`Editar contacto ${nombre(contacto)}`} onClick={() => setAccion({ tipo: 'editar', contacto })}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md text-left hover:bg-blue-100/40">
          <CabezaPersona nombre={nombre(contacto)} detalle={`${contacto.parentesco} · ${contacto.telefono}`}
            extra={contacto.es_principal && <span className="inline-flex items-center gap-1 text-ayuda font-normal text-ink"><Icono nombre="check_circle" tamano={16} className="text-success-700" />Principal</span>} />
        </button>
        <a href={`tel:${telefono(contacto.telefono)}`} aria-label={`Llamar a ${nombre(contacto)}`}
          className="grid size-12 flex-none place-items-center rounded-full bg-teal-100 text-success-700 hover:brightness-95">
          <Icono nombre="call" />
        </a>
      </div>)}
    </Panel>}
    {contactos.length < 5 && <Button fullWidth onClick={() => setAccion({ tipo: 'nuevo' })}>Añadir contacto</Button>}
  </section>
}

type Destino =
  | 'identificacion' | 'ubicacion' | 'contactos' | 'estado' | 'retirar' | 'asignar' | 'familiares' | 'evaluacion' | 'indicaciones' | 'informe' | 'factor'
  | { tipo: 'resolver'; factor: Factor }
type Pestana = 'resumen' | 'historial' | 'necesidades' | 'riesgo'

function EstadoPerfil({ perfil, ruta, token, refrescar, volver }: {
  perfil: Perfil; ruta: string; token: string; refrescar: () => void; volver: () => void
}) {
  const [estado, setEstado] = useState('')
  const opcionesEstado = perfil.estado === 'activo'
    ? [{ value: 'inactivo', label: 'Inactivar perfil' }, { value: 'fallecido', label: 'Registrar fallecimiento' }]
    : [{ value: 'activo', label: 'Reactivar perfil' }, { value: 'fallecido', label: 'Registrar fallecimiento' }]
  return <Pantalla titulo="Cambiar estado" volver={volver}>
    <Formulario variante="pagina" titulo="Cambiar estado del expediente" contexto={nombre(perfil)} campos={[]} cancelar={volver} accion="Confirmar cambio" exito="" enviar={async (datos) => {
      const motivo = campo(datos, 'motivo')
      if (estado === 'inactivo' && motivo.length < 3) throw new Error('Escribe un motivo para inactivar el expediente.')
      await api(`${ruta}/estado`, token, 'POST', { estado, ...(motivo ? { motivo } : {}) })
      refrescar()
      volver()
    }}>
      <p className="-mt-2 text-ayuda text-muted">Estado actual: <span className="text-ink"><IndicadorEstado estado={perfil.estado} /></span></p>
      <OpcionesRadio name="estado" label="Nuevo estado" required options={opcionesEstado} value={estado} onChange={setEstado} />
      <TextareaField label="Motivo" name="motivo" maxLength={200} required={estado === 'inactivo'} placeholder="Ej.: Se mudó con un familiar a otra provincia."
        hint="Obligatorio para inactivar. Máximo 200 caracteres." />
      {(estado === 'inactivo' || estado === 'fallecido') && <Aviso tipo="info">
        Se cerrarán las tareas, alertas y visitas pendientes que correspondan. El historial seguirá disponible.
      </Aviso>}
    </Formulario>
  </Pantalla>
}

/** Celda de la franja de indicadores del perfil: ícono, cifra y etiqueta. */
function Indicador({ icono, color, valor, etiqueta, onClick, to, nombre: nombreAccesible }: { icono: NombreIcono; color: string; valor: string; etiqueta: string; onClick?: () => void; to?: string; nombre?: string }) {
  const contenido = <>
    <Icono nombre={icono} tamano={24} className={color} />
    <span className="break-words text-ayuda font-bold text-ink sm:text-cuerpo">{valor}</span>
    <span className="break-words text-[12px] leading-4 text-muted sm:text-ayuda">{etiqueta}</span>
  </>
  const clases = 'flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2 py-3 text-left sm:px-3'
  if (to) return <Link to={to} aria-label={nombreAccesible} className={cn(clases, 'hover:bg-blue-100/40')}>{contenido}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cn(clases, 'hover:bg-blue-100/40')}>{contenido}</button>
  return <div className={clases}>{contenido}</div>
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

function Expediente({ id, volver, revision, refrescar, ...props }: OperacionProps & { cola: ColaOperaciones;
  id: string; volver: () => void; revision: number; refrescar: () => void
}) {
  const { base, token, cuenta } = props
  const [pantalla, setPantalla] = useState<Destino>()
  const [pestana, setPestana] = useState<Pestana>('resumen')
  const [hoja, setHoja] = useState(false)
  const enLinea = useConexionReal()
  const contenido = useRef<HTMLDivElement>(null)
  const primera = useRef(true)
  const ruta = `${base}/envejecientes/${idRuta(id)}`
  const consulta = useDatos<Perfil>(ruta, token, revision)
  const perfil = consulta.datos
  const permisos = cuenta.permisos
  const sensible = permisos.includes('adultos:ver-sensible')
  const activo = perfil?.estado === 'activo'
  const riesgo = useDatos<ResumenRiesgo>(sensible ? `${ruta}/riesgo` : null, token, revision)
  const visitasDisponibles = cuenta.tipo === 'organizacion' && permisos.includes('visitas:ver')
  const ultima = usePagina<{ fecha: string }>(visitasDisponibles ? `${base}/visitas` : null,
    token, revision, { limit: 1, filters: { envejeciente_id: id, estado: 'completada' } })
  const verNecesidades = permisos.includes('necesidades:ver')
  const necesidades = usePagina<unknown>(verNecesidades ? `${base}/necesidades` : null, token, revision, { limit: 1, filters: { envejeciente_id: id, activas: true } })
  // Las alertas solo existen para expedientes activos (la API no lista las de un adulto inactivo).
  const verAlertas = permisos.includes('alertas:ver') && activo
  const alertas = usePagina<unknown>(verAlertas ? `${base}/alertas` : null, token, revision, { limit: 1, filters: { envejeciente_id: id, estado: 'pendiente' } })
  const vinculos = useDatos<DatosVinculos>(`${ruta}/asignaciones`, token, revision)
  const verIndicaciones = permisos.includes('indicaciones:ver')
  const indicaciones = usePagina<Indicacion>(verIndicaciones ? `${ruta}/indicaciones` : null, token, revision, { limit: 1, filters: { estado: 'activa' } })
  const editar = permisos.includes('adultos:editar')
  const gestionarEstado = permisos.includes('adultos:desactivar')
  const evaluar = activo && permisos.includes('adultos:evaluar')
  const puedeProgramar = cuenta.tipo === 'organizacion' && activo && permisos.includes('visitas:programar') && permisos.includes('visitas:autorizar')
  const raiz = `/operacion/${idRuta(cuenta.cuenta_id)}`
  const cerrar = () => setPantalla(undefined)
  const guardado = () => { cerrar(); refrescar() }
  const abrir = (siguiente: Destino) => { setHoja(false); setPantalla(siguiente) }
  usePantallaSecundaria(pantalla ? null : { titulo: 'Adulto mayor', volver })

  useEffect(() => {
    if (primera.current) { primera.current = false; return }
    window.scrollTo({ top: 0 })
    contenido.current?.focus({ preventScroll: true })
  }, [pantalla])

  const nombreAdulto = perfil ? nombre(perfil) : ''
  const seccion: SeccionProps | undefined = perfil && { ...props, ruta, revision, actualizar: refrescar, adultoActivo: perfil.estado === 'activo' }

  if (perfil && seccion && pantalla) {
    const comun = { ...seccion, nombreAdulto, volver: cerrar }
    return <div ref={contenido} tabIndex={-1} className="min-w-0 outline-none">
      {pantalla === 'identificacion' && <Pantalla titulo="Editar datos personales" volver={cerrar}>
        <Identificacion valor={perfil} editando cancelar={cerrar} enviar={async (datos) => { await api(ruta, token, 'PATCH', datos); guardado() }} />
      </Pantalla>}
      {pantalla === 'ubicacion' && <Pantalla titulo="Editar ubicación y cuidado" volver={cerrar}>
        <Ubicacion token={token} perfil={perfil} cancelar={cerrar} enviar={async ({ provincia: _provincia, ...datos }) => { await api(ruta, token, 'PATCH', datos); guardado() }} />
      </Pantalla>}
      {pantalla === 'contactos' && <Contactos base={base} token={token} ruta={ruta} perfil={perfil} refrescar={refrescar} volver={cerrar} />}
      {pantalla === 'estado' && <EstadoPerfil perfil={perfil} ruta={ruta} token={token} refrescar={refrescar} volver={cerrar} />}
      {pantalla === 'retirar' && <Pantalla titulo="Retirar consentimiento" volver={cerrar}>
        <Formulario variante="pagina" titulo="Retirar consentimiento" contexto={nombreAdulto} accion="Confirmar retiro" peligro cancelar={cerrar} disabled={!enLinea} campos={[]} exito=""
          enviar={async (datos) => {
            const motivo = campo(datos, 'motivo')
            await api(`${ruta}/consentimiento/retirar`, token, 'POST', motivo ? { motivo } : {})
            refrescar()
            volver()
          }}>
          <Aviso tipo="advertencia">El expediente de {nombreAdulto} quedará bloqueado. Sus visitas y tareas abiertas se cancelarán y se conservará una constancia del retiro.</Aviso>
          <TextareaField name="motivo" label="Motivo del retiro (opcional)" minLength={3} maxLength={200} placeholder="Ej.: La familia decidió cambiar de organización."
            hint="Máximo 200 caracteres." />
        </Formulario>
      </Pantalla>}
      {pantalla === 'asignar' && <PantallaVinculos {...comun} familiar={false} />}
      {pantalla === 'familiares' && <PantallaVinculos {...comun} familiar />}
      {pantalla === 'evaluacion' && <PantallaEvaluacion {...comun} />}
      {pantalla === 'factor' && <PantallaFactor {...comun} />}
      {typeof pantalla === 'object' && <PantallaResolver {...comun} factor={pantalla.factor} />}
      {pantalla === 'indicaciones' && <PantallaIndicaciones {...comun} />}
      {pantalla === 'informe' && <InformeMedico base={base} token={token} cuenta={cuenta} adultoId={id} nombreAdulto={nombreAdulto} volver={cerrar} />}
    </div>
  }

  const ultimaFecha = ultima.datos?.data[0]?.fecha
  const dias = ultimaFecha ? diasCalendario(ultimaFecha) : undefined
  const abiertas = necesidades.datos?.meta.total
  const pendientes = alertas.datos?.meta.total
  const cuidadores = vinculos.datos?.cuidadores.map((p) => nombreVinculoResumen(p)) ?? []
  const voluntarios = vinculos.datos?.voluntarios.map((p) => nombreVinculoResumen(p)) ?? []
  const indicacion = indicaciones.datos?.data[0]
  const pestanas: Array<{ value: Pestana; label: string }> = [{ value: 'resumen', label: 'Resumen' }, { value: 'historial', label: 'Historial' }]
  if (verNecesidades) pestanas.push({ value: 'necesidades', label: 'Necesidades' })
  if (sensible) pestanas.push({ value: 'riesgo', label: 'Riesgo' })
  const actual = pestanas.some((p) => p.value === pestana) ? pestana : 'resumen'
  const grupos = [
    { titulo: 'Expediente', items: [
      editar && { icono: 'edit' as const, texto: 'Datos personales', ir: 'identificacion' as const },
      editar && { icono: 'location_on' as const, texto: 'Ubicación y cuidado', ir: 'ubicacion' as const },
      gestionarEstado && perfil?.estado !== 'fallecido' && { icono: 'swap_horiz' as const, texto: 'Cambiar estado', ir: 'estado' as const },
    ] },
    { titulo: 'Personas', items: [
      editar && { icono: 'contact_emergency' as const, texto: 'Contactos', ir: 'contactos' as const },
      { icono: 'volunteer_activism' as const, texto: 'Cuidador', ir: 'asignar' as const },
      permisos.includes('familiares:autorizar') && { icono: 'group' as const, texto: 'Familiares', ir: 'familiares' as const },
    ] },
    { titulo: 'Seguimiento', items: [
      evaluar && { icono: 'monitoring' as const, texto: 'Evaluar riesgo', ir: 'evaluacion' as const },
      verIndicaciones && { icono: 'medication' as const, texto: 'Indicaciones', ir: 'indicaciones' as const },
      permisos.includes('informe:exportar') && { icono: 'picture_as_pdf' as const, texto: 'Informe PDF', ir: 'informe' as const },
    ] },
  ].map((g) => ({ ...g, items: g.items.filter((i): i is Exclude<typeof i, false> => !!i) })).filter((g) => g.items.length > 0)

  return <section className="grid grid-cols-1 gap-5">
    <Estado consulta={consulta} />
    {perfil && seccion && <>
      <section className="flex items-start gap-4" aria-label="Resumen del adulto mayor">
        <span aria-hidden className="flex-none"><Avatar nombre={nombreAdulto} size={80} /></span>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1">
          <h2 className="wrap-anywhere text-seccion text-ink">{nombreAdulto}</h2>
          <p className="text-ayuda text-muted wrap-anywhere">{[perfil.fecha_nacimiento ? `${edad(perfil.fecha_nacimiento)} años` : '', [perfil.zona, perfil.municipio_nombre].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ayuda text-ink">
            {riesgo.datos?.nivel_vigente ? <IndicadorNivel nivel={riesgo.datos.nivel_vigente} /> : riesgo.datos && <span>Sin evaluación vigente</span>}
            <IndicadorEstado estado={perfil.estado} />
          </p>
        </div>
      </section>

      {(visitasDisponibles || verNecesidades || verAlertas) && <div className="flex divide-x divide-surface-2 overflow-hidden rounded-2xl border border-surface-2 bg-surface" aria-label="Indicadores del expediente" role="group">
        {visitasDisponibles && <Indicador icono="calendar_month" color="text-blue-principal" etiqueta="Última visita"
          valor={dias !== undefined ? (dias <= 0 ? 'Hoy' : `Hace ${plural(dias, 'día', 'días')}`) : ultima.error ? 'Sin datos' : ultima.datos ? 'Sin visitas' : 'Consultando…'} />}
        {verNecesidades && <Indicador icono="volunteer_activism" color="text-warning-700" etiqueta="Necesidades" onClick={() => setPestana('necesidades')}
          valor={abiertas !== undefined ? plural(abiertas, 'abierta', 'abiertas') : necesidades.error ? 'Sin datos' : 'Consultando…'} />}
        {verAlertas && <Indicador icono="notifications_active" color="text-danger" etiqueta="Alertas" nombre="Ver alertas de este adulto" to={`${raiz}/alertas?bandeja=alertas&adulto=${idRuta(id)}`}
          valor={pendientes !== undefined ? plural(pendientes, 'pendiente', 'pendientes') : alertas.error ? 'Sin datos' : 'Consultando…'} />}
      </div>}

      <div className="flex items-stretch gap-3">
        {puedeProgramar && <ButtonLink to={`${raiz}/visitas?accion=programar`} fullWidth={false} className="min-w-0 flex-1">Programar visita</ButtonLink>}
        {grupos.length > 0 && <Button variant="outline" aria-label="Más acciones" aria-haspopup="dialog" fullWidth={false}
          className={cn('flex-none px-0 size-14', !puedeProgramar && 'ms-auto')} onClick={() => setHoja(true)}>
          <Icono nombre="more_vert" tamano={24} /><span className="sr-only">Más acciones</span>
        </Button>}
      </div>

      <PestanasPerfil etiqueta="Secciones del expediente" valor={actual} alCambiar={setPestana} opciones={pestanas} />

      <div ref={contenido} tabIndex={-1} className="min-w-0 outline-none" role="tabpanel" id={`panel-${actual}`} aria-labelledby={`pestana-${actual}`}>
        {actual === 'resumen' && <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          <div className="grid grid-cols-1 gap-5">
            {perfil.contacto_principal && <section className="grid grid-cols-1 gap-3" aria-label="Contacto de emergencia">
              <TituloBloque>Contacto de emergencia</TituloBloque>
              <Panel className="py-0">
                <FilaDato icono="contact_emergency" tono="rojo" etiqueta={`${nombre(perfil.contacto_principal)} · ${perfil.contacto_principal.parentesco}`}
                  valor={perfil.contacto_principal.telefono} derecha={<a href={`tel:${telefono(perfil.contacto_principal.telefono)}`}
                    aria-label={`Llamar a ${nombre(perfil.contacto_principal)}`} className="grid size-12 flex-none place-items-center rounded-full bg-teal text-white hover:brightness-95"><Icono nombre="call" /></a>} />
              </Panel>
            </section>}
            <section className="grid grid-cols-1 gap-3" aria-label="Cuidado">
              <TituloBloque>Cuidado</TituloBloque>
              <Panel className="py-0">
                <FilaDato icono="volunteer_activism" tono="verde" etiqueta="Cuidador asignado" onClick={() => setPantalla('asignar')}
                  valor={vinculos.error ? 'Sin datos' : !vinculos.datos ? 'Consultando…' : cuidadores.join(', ') || 'Sin cuidador asignado'} />
                {voluntarios.length > 0 && <FilaDato icono="group" tono="verde" etiqueta="Voluntarios asignados" onClick={() => setPantalla('asignar')} valor={voluntarios.join(', ')} />}
                <FilaDato icono="info" tono="azul" etiqueta="Condición general" valor={perfil.condicion_general ? ([
                  AUTONOMIAS.find((o) => o.value === perfil.condicion_general?.autonomia)?.label,
                  ...(perfil.condicion_general.condiciones ?? []).map((condicion) => CONDICIONES.find((o) => o.value === condicion)?.label ?? condicion),
                  perfil.condicion_general.nota,
                ].filter(Boolean).join(' · ') || 'Sin información registrada') : 'Sin información registrada'} />
                {verIndicaciones && <FilaDato icono="medication" tono="ambar" etiqueta="Indicación médica" onClick={() => setPantalla('indicaciones')}
                  valor={indicaciones.error ? 'Sin datos' : !indicaciones.datos ? 'Consultando…' : indicacion
                    ? [indicacion.titulo, indicacion.frecuencia_horario].filter(Boolean).join(' · ') : 'Sin indicaciones activas'} />}
              </Panel>
            </section>
          </div>
          <section className="grid grid-cols-1 gap-3" aria-label="Datos personales">
            <TituloBloque>Datos personales</TituloBloque>
            <Panel className="py-0">
              {perfil.cedula && <FilaDato icono="badge" etiqueta="Cédula" valor={cedulaVisible(perfil.cedula)} />}
              {perfil.fecha_nacimiento && <FilaDato icono="calendar_month" etiqueta="Fecha de nacimiento"
                valor={[fechaCorta(perfil.fecha_nacimiento), perfil.sexo ? SEXOS.find((s) => s.value === perfil.sexo)?.label ?? perfil.sexo : ''].filter(Boolean).join(' · ')} />}
              {!perfil.fecha_nacimiento && perfil.sexo && <FilaDato icono="person" etiqueta="Sexo" valor={SEXOS.find((s) => s.value === perfil.sexo)?.label ?? perfil.sexo} />}
              {perfil.telefono && <FilaDato icono="call" etiqueta="Teléfono" valor={perfil.telefono} />}
              <FilaDato icono="location_on" etiqueta="Ubicación" valor={[perfil.zona, perfil.municipio_nombre, perfil.direccion].filter(Boolean).join(' · ') || 'Sin ubicación registrada'} />
              {perfil.consentimiento && <FilaDato icono="check_circle" tono="verde" etiqueta="Consentimiento informado" valor={perfil.consentimiento.otorgado_por === 'adulto'
                ? 'Otorgado por el adulto mayor'
                : `Otorgado por su representante${perfil.consentimiento.representante ? `: ${perfil.consentimiento.representante}` : ''}`} />}
            </Panel>
          </section>
        </div>}
        {actual === 'historial' && <PanelHistorial {...seccion} />}
        {actual === 'necesidades' && <Necesidades {...props} adultoId={id} adultoActivo={perfil.estado === 'activo'} />}
        {actual === 'riesgo' && <PanelRiesgo cuenta={cuenta} adultoActivo={perfil.estado === 'activo'} consulta={riesgo}
          evaluar={() => abrir('evaluacion')} registrarFactor={() => abrir('factor')} resolver={(factor) => abrir({ tipo: 'resolver', factor })} />}
      </div>

      <Sheet open={hoja} onClose={() => setHoja(false)} title="Más acciones">
        {grupos.map((grupo) => <section key={grupo.titulo} className="grid grid-cols-1 gap-2" aria-label={grupo.titulo}>
          <h3 className="text-ayuda font-semibold text-muted">{grupo.titulo}</h3>
          <div className="grid auto-cols-fr grid-flow-col gap-2">
            {grupo.items.map((item) => <button key={item.ir} type="button" onClick={() => {
              if (item.ir === 'evaluacion') setPestana('riesgo')
              abrir(item.ir)
            }} className="flex min-h-24 min-w-0 flex-col items-center gap-2 rounded-xl p-1 text-center hover:bg-blue-100/50">
              <span aria-hidden className="grid size-[52px] flex-none place-items-center rounded-md bg-blue-100 text-blue-principal"><Icono nombre={item.icono} tamano={26} /></span>
              <span className="text-ayuda font-semibold text-ink wrap-anywhere">{item.texto}</span>
            </button>)}
          </div>
        </section>)}
        {gestionarEstado && <Button variant="danger-soft" fullWidth disabled={!enLinea} onClick={() => abrir('retirar')}>Registrar retiro del consentimiento</Button>}
      </Sheet>
    </>}
  </section>
}

function nombreVinculoResumen(persona: { nombres: string; apellidos: string; usuario?: { nombres: string; apellidos: string } }) {
  const datos = persona.usuario ?? persona
  return `${datos.nombres} ${datos.apellidos}`
}

const etiquetaEstado = (estado: string) => (estado ? ESTADO_ADULTO[estado as EstadoAdulto] : 'Todos')

export function Envejecientes(props: OperacionProps & { cola: ColaOperaciones }) {
  const { base, token, cuenta } = props
  // El resumen y los reportes enlazan al expediente con `?adulto=<uuid>`; un valor que no es UUID se ignora.
  const [parametros, fijarParametros] = useSearchParams()
  const adultoEnlazado = parametros.get('adulto')
  const [vista, setVista] = useState<Vista>(() => adultoEnlazado && UUID.test(adultoEnlazado) ? { tipo: 'perfil', id: adultoEnlazado } : { tipo: 'lista' })
  const [revision, setRevision] = useState(0)
  const [estado, setEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [archivo, setArchivo] = useState(false)
  const region = useRef<HTMLDivElement>(null)
  const listado = usePagina<Perfil>(`${base}/envejecientes`, token, revision, { filters: estado ? { estado } : undefined })
  const criterio = normaliza(busqueda.trim())
  const adultos = listado.datos?.data.filter((adulto) => !criterio || normaliza(`${nombre(adulto)} ${adulto.zona ?? ''}`).includes(criterio)) ?? []
  const refrescar = () => setRevision((n) => n + 1)
  const volver = () => {
    setVista({ tipo: 'lista' })
    if (adultoEnlazado) fijarParametros({}, { replace: true })
  }
  const puedeCrear = cuenta.permisos.includes('adultos:crear')
  const puedeArchivar = cuenta.permisos.includes('adultos:desactivar')
  const verRetiros = archivo && puedeArchivar
  const retiros = usePagina<{ envejeciente_id: string; nombre: string; fecha: string; motivo: string | null; actor: string | null }>(
    verRetiros ? `${base}/consentimientos-retirados` : null, token, revision)
  usePantallaSecundaria(vista.tipo === 'lista' && verRetiros ? { titulo: 'Retiros de consentimiento', volver: () => setArchivo(false) } : null)

  useEffect(() => {
    region.current?.focus({ preventScroll: true })
  }, [vista])

  return <div ref={region} tabIndex={-1} className="min-w-0 outline-none">
    {vista.tipo === 'alta' && <Crear {...props} cerrar={volver} creado={(id) => { setVista({ tipo: 'perfil', id }); refrescar() }} />}
    {vista.tipo === 'perfil' && <Expediente key={vista.id} {...props} id={vista.id} volver={volver} revision={revision} refrescar={refrescar} />}
    {vista.tipo === 'lista' && verRetiros && <section className="grid max-w-form grid-cols-1 gap-4" aria-label="Retiros de consentimiento">
      <h3 className="sr-only">Retiros de consentimiento</h3>
      <p className="text-cuerpo text-muted">Personas que retiraron su consentimiento. Su expediente está bloqueado y solo queda esta constancia.</p>
      <Estado consulta={retiros} vacio={retiros.datos?.data.length === 0 ? 'Sin retiros registrados.' : undefined} />
      {!!retiros.datos?.data.length && <Panel className="py-0">
        {retiros.datos.data.map((retiro) => <article key={retiro.envejeciente_id} className="grid grid-cols-1 gap-1 py-3">
          <h4 className="text-cuerpo font-bold text-ink wrap-anywhere">{retiro.nombre}</h4>
          <p className="text-ayuda text-muted wrap-anywhere">{fechaHora(retiro.fecha)}{retiro.actor ? ` · Registrado por ${retiro.actor}` : ''}</p>
          {retiro.motivo && <p className="text-cuerpo text-ink wrap-anywhere">{retiro.motivo}</p>}
        </article>)}
      </Panel>}
      {retiros.datos && <Paginador pagina={retiros.pagina} total={retiros.datos.meta.totalPages} cambiar={retiros.cambiar} />}
    </section>}
    {vista.tipo === 'lista' && !verRetiros && <section className="grid grid-cols-1 gap-4">
      <header className="grid grid-cols-1 gap-1">
        <h2 className="text-pantalla text-ink wrap-anywhere">Adultos mayores</h2>
        {listado.datos && <p className="text-cuerpo text-muted">{plural(listado.datos.meta.total, 'expediente', 'expedientes')}</p>}
      </header>
      {puedeCrear && <Button onClick={() => setVista({ tipo: 'alta' })}>Registrar adulto mayor</Button>}
      <div className="grid grid-cols-1 gap-3 md:max-w-xl">
        <SearchInput value={busqueda} onChange={(event) => setBusqueda(event.currentTarget.value)} placeholder="Nombre o sector" aria-label="Buscar por nombre o sector en esta página" />
        {!!listado.datos && listado.datos.meta.totalPages > 1 && <p className="-mt-1 text-ayuda text-muted">La búsqueda recorre los adultos de la página actual.</p>}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Estado del expediente">
        {['', ...Object.keys(ESTADO_ADULTO)].map((valor) => <Chip key={valor || 'todos'} active={estado === valor}
          onClick={() => { setEstado(valor); listado.cambiar(1) }}>{valor ? `${etiquetaEstado(valor)}s` : 'Todos'}</Chip>)}
      </div>
      <Estado consulta={listado} />
      {listado.datos && adultos.length === 0 && <EmptyState title={busqueda || estado ? 'Sin coincidencias' : 'Sin perfiles disponibles'}
        text={busqueda || estado ? 'Cambia la búsqueda o el estado seleccionado.' : 'Aquí aparecerán los adultos mayores a los que tienes acceso.'}
        action={busqueda || estado ? <Button variant="outline" size="sm" onClick={() => { setBusqueda(''); setEstado(''); listado.cambiar(1) }}>Limpiar filtros</Button> : undefined} />}
      {adultos.length > 0 && <ul className="grid grid-cols-1 overflow-hidden rounded-2xl border border-surface-2 bg-surface md:gap-3 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:grid-cols-2 lg:grid-cols-3" aria-label="Adultos mayores">
        {adultos.map((adulto) => <li key={adulto.envejeciente_id} className="min-w-0 border-b border-surface-2 last:border-b-0 md:rounded-2xl md:border md:bg-surface md:last:border-b">
          <button type="button" onClick={() => setVista({ tipo: 'perfil', id: adulto.envejeciente_id })}
            className="flex h-full min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-blue-100/40 md:rounded-2xl">
            <span aria-hidden className="flex-none"><Avatar nombre={nombre(adulto)} size={48} /></span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-tarjeta text-ink wrap-anywhere">{nombre(adulto)}</span>
              <span className="text-ayuda text-muted wrap-anywhere"><span className="text-ink"><IndicadorEstado estado={adulto.estado} /></span>
                {[adulto.fecha_nacimiento ? `${edad(adulto.fecha_nacimiento)} años` : '', adulto.zona].filter(Boolean).map((parte) => ` · ${parte}`)}</span>
            </span>
            <Icono nombre="chevron_right" tamano={24} className="flex-none text-muted" />
          </button>
        </li>)}
      </ul>}
      {listado.datos && <Paginador pagina={listado.pagina} total={listado.datos.meta.totalPages} cambiar={listado.cambiar} />}
      {puedeArchivar && <Button variant="ghost" className="justify-self-center" onClick={() => setArchivo(true)}>Ver retiros de consentimiento</Button>}
    </section>}
  </div>
}
