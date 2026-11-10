/*
 * gestion-cuenta.tsx — Datos, configuración, titularidad y perfiles de cuidador conectados.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Building2, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { Button, ButtonLink, Checkbox, IconTile, SelectField, Switch, TextField } from '@/components/ui'
import { fechaCorta } from '@/domain/dates'
import { api } from '../client'
import type { CategoriaCuenta, Municipio, Provincia } from '../api/catalogos'
import type { DetalleCuenta } from '../api/cuentas'
import { guardarCuidador, transferirTitularidad, type PerfilCuidador } from '../api/miembros'
import { campo, Estado, Formulario, idRuta, Paginador, useDatos, usePagina, type Campo } from './controles'
import type { Candidato, OperacionProps } from './visitas'

type CuentaDetalle = DetalleCuenta['cuenta']
type Parametro = {
  nombre: string
  valor: string
  tipo_dato: 'booleano' | 'entero' | 'decimal' | 'texto'
  descripcion: string | null
  es_propio: boolean
  valor_general: string
}

const etiquetasParametros: Record<string, string> = {
  dias_sin_visita_alerta: 'Días sin visita para generar alerta',
  dias_escalar_necesidad: 'Días para escalar una necesidad',
  notificar_casos_prioritarios: 'Notificar casos prioritarios',
  notificar_nuevos_voluntarios: 'Avisar cuando se incorporen voluntarios',
  contacto_institucional_nombre: 'Persona de contacto',
  contacto_institucional_telefono: 'Teléfono de la persona de contacto',
}

function DatosContacto({ base, token, cuenta, datos, actualizar, cancelar }: OperacionProps & {
  datos: CuentaDetalle
  actualizar: () => void
  cancelar: () => void
}) {
  const [provincia, setProvincia] = useState(datos.municipio.provincia_cod)
  const [municipio, setMunicipio] = useState(datos.municipio.municipio_cod)
  const categorias = useDatos<CategoriaCuenta[]>(`/catalogos/categorias-cuenta?tipo=${cuenta.tipo}`, token)
  const provincias = useDatos<Provincia[]>('/catalogos/provincias', token)
  const municipios = useDatos<Municipio[]>(provincia ? `/catalogos/municipios?provincia_cod=${idRuta(provincia)}&limit=100` : null, token)
  const organizacion = cuenta.tipo === 'organizacion'
  const campos: Campo[] = [
    { name: 'nombre', label: organizacion ? 'Nombre de la organización' : 'Nombre de la cuenta', value: datos.nombre, min: 2, max: 120, autoComplete: 'organization' },
    { name: 'categoria', label: 'Categoría', value: String(datos.categoria.categoria_cuenta_id), options: categorias.datos?.map((c) => ({ value: String(c.categoria_cuenta_id), label: c.nombre })) ?? [], disabled: !categorias.datos },
    { name: 'telefono', label: organizacion ? 'Teléfono institucional' : 'Teléfono de contacto', type: 'tel', inputMode: 'tel', autoComplete: 'tel', value: datos.telefono ?? '', optional: true, max: 20 },
    { name: 'correo', label: organizacion ? 'Correo institucional' : 'Correo de contacto', type: 'email', inputMode: 'email', autoComplete: 'email', value: datos.correo ?? '', optional: true, max: 254 },
    { name: 'direccion', label: 'Dirección', autoComplete: 'street-address', value: datos.direccion ?? '', optional: true, max: 150 },
  ]

  return <Formulario titulo={organizacion ? 'Datos de contacto institucional' : 'Datos de contacto'} campos={campos}
    accion="Guardar cambios" cancelar={cancelar} exito="Datos de contacto guardados."
    submitDisabled={!categorias.datos?.length || !provincias.datos?.length || !municipio || !municipios.datos?.length}
    enviar={async (formulario) => {
      await api(base, token, 'PATCH', {
        nombre: campo(formulario, 'nombre'),
        categoria_cuenta_id: Number(campo(formulario, 'categoria')),
        municipio_cod: municipio,
        direccion: campo(formulario, 'direccion') || null,
        telefono: campo(formulario, 'telefono').replace(/[\s-]/g, '') || null,
        correo: campo(formulario, 'correo') || null,
      })
      actualizar()
    }}>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <SelectField label="Provincia" required placeholder="Selecciona una provincia" value={provincia}
        options={provincias.datos?.map((p) => ({ value: p.provincia_cod, label: p.nombre })) ?? []}
        onChange={(e) => { setProvincia(e.target.value); setMunicipio('') }} />
      <SelectField label="Municipio" required placeholder={provincia ? 'Selecciona un municipio' : 'Elige primero una provincia'}
        disabled={!provincia || !municipios.datos} value={municipio}
        options={municipios.datos?.map((m) => ({ value: m.municipio_cod, label: m.nombre })) ?? []}
        onChange={(e) => setMunicipio(e.target.value)} />
    </div>
    {categorias.datos === undefined && <Estado consulta={categorias} />}
    {provincias.datos === undefined && <Estado consulta={provincias} />}
    {provincia && municipios.datos === undefined && <Estado consulta={municipios} />}
  </Formulario>
}

function Configuracion({ base, token, actualizar }: Pick<OperacionProps, 'base' | 'token'> & { actualizar: () => void }) {
  const [revision, setRevision] = useState(0)
  const [borrador, setBorrador] = useState<Record<string, string | null>>({})
  const config = useDatos<Parametro[]>(`${base}/configuracion`, token, revision)
  const parametros = config.datos ?? []
  const grupos = [
    { titulo: 'Umbrales de alerta', icono: SlidersHorizontal, items: parametros.filter((p) => p.tipo_dato === 'entero' || p.tipo_dato === 'decimal') },
    { titulo: 'Notificaciones', icono: Bell, items: parametros.filter((p) => p.tipo_dato === 'booleano') },
    { titulo: 'Contacto adicional', icono: Building2, items: parametros.filter((p) => p.tipo_dato === 'texto') },
  ]
  const valorVisible = (p: Parametro) => borrador[p.nombre] === null ? p.valor_general : borrador[p.nombre] ?? p.valor
  const cambiar = (p: Parametro, valor: string | null) => setBorrador((actual) => {
    const nuevo = { ...actual }
    if (valor === p.valor) delete nuevo[p.nombre]
    else nuevo[p.nombre] = valor
    return nuevo
  })

  return <section aria-label="Preferencias de la cuenta" className="grid gap-4">
    <Estado consulta={config} vacio={config.datos?.length === 0 ? 'Sin parámetros disponibles.' : undefined} />
    {parametros.length > 0 && <Formulario titulo="Preferencias de la cuenta" campos={[]} accion="Guardar preferencias"
      submitDisabled={!Object.keys(borrador).length || config.error} exito="Preferencias guardadas."
      cancelar={Object.keys(borrador).length ? () => setBorrador({}) : undefined}
      enviar={async () => {
        const valores = Object.fromEntries(Object.entries(borrador).map(([nombre, valor]) => {
          const p = parametros.find((item) => item.nombre === nombre)
          return [nombre, valor !== null && (p?.tipo_dato === 'entero' || p?.tipo_dato === 'decimal') ? String(Number(valor)) : valor]
        }))
        await api(`${base}/configuracion`, token, 'PATCH', { valores })
        setBorrador({})
        setRevision((n) => n + 1)
        actualizar()
      }}>
      {grupos.filter((grupo) => grupo.items.length).map((grupo) => <section key={grupo.titulo} className="grid gap-4 rounded-md border border-line-soft bg-bg p-4">
        <h4 className="flex items-center gap-2 font-semibold text-ink"><grupo.icono size={19} aria-hidden className="text-navy" />{grupo.titulo}</h4>
        {grupo.items.map((p) => {
          const etiqueta = etiquetasParametros[p.nombre] ?? p.nombre.replaceAll('_', ' ')
          const valor = valorVisible(p)
          const restablecer = p.es_propio || (borrador[p.nombre] !== undefined && borrador[p.nombre] !== null)
          return <div key={p.nombre} className="grid gap-2 border-b border-line-soft pb-3 last:border-b-0 last:pb-0">
            {p.tipo_dato === 'booleano' ? <>
              <Switch label={etiqueta} checked={valor === 'true'} onChange={(activo) => cambiar(p, String(activo))} />
              {p.descripcion && <p className="text-sm text-ink-2">{p.descripcion}</p>}
            </> : <TextField label={etiqueta} hint={p.descripcion ?? undefined} value={valor}
              type={p.tipo_dato === 'texto' ? (p.nombre.endsWith('_telefono') ? 'tel' : 'text') : 'number'}
              inputMode={p.tipo_dato === 'entero' ? 'numeric' : p.tipo_dato === 'decimal' ? 'decimal' : undefined}
              min={p.tipo_dato === 'entero' ? 1 : p.tipo_dato === 'decimal' ? 0 : undefined}
              max={p.tipo_dato === 'entero' ? 90 : p.tipo_dato === 'decimal' ? 100000 : undefined}
              step={p.tipo_dato === 'entero' ? 1 : p.tipo_dato === 'decimal' ? 0.0001 : undefined}
              required={p.tipo_dato !== 'texto'} maxLength={p.tipo_dato === 'texto' ? 120 : undefined}
              onChange={(e) => cambiar(p, e.target.value)} />}
            {restablecer && borrador[p.nombre] !== null && <Button variant="ghost" className="justify-self-start" onClick={() => cambiar(p, p.es_propio ? null : p.valor)}>Usar valor general</Button>}
          </div>
        })}
      </section>)}
    </Formulario>}
  </section>
}

function Cuidadores({ base, token, cuenta }: OperacionProps) {
  const [id, setId] = useState('')
  const [revision, setRevision] = useState(0)
  const lista = usePagina<Candidato>(`${base}/candidatos/cuidado`, token, revision)
  const perfil = useDatos<PerfilCuidador | null>(id ? `${base}/miembros/${idRuta(id)}/cuidador` : null, token, revision)
  const tipos = useDatos<{ tipo_cuidado_id: number; nombre: string }[]>(id ? '/catalogos/tipos-cuidado' : null, token)
  const candidatos = lista.datos?.data ?? []
  return <section aria-labelledby="perfiles-cuidado" className="grid gap-3 rounded-md border border-line-soft bg-surface p-4 sm:p-5">
    <h3 id="perfiles-cuidado" className="text-lg font-semibold text-ink">Perfiles globales de cuidadores</h3>
    <p className="text-sm text-ink-2">El perfil se comparte entre las cuentas donde participa la persona.</p>
    <Estado consulta={lista} vacio={lista.datos?.data.length === 0 ? 'Cuando un cuidador acepte su invitación, podrás editar su perfil aquí.' : undefined} />
    {candidatos.length > 0 && <SelectField label="Cuidador" value={id} onChange={(e) => setId(e.target.value)}
      options={[{ value: '', label: 'Selecciona un cuidador' }, ...candidatos.map((c) => ({ value: c.membresia_id, label: c.nombre }))]} />}
    {lista.datos && <Paginador pagina={lista.pagina} total={lista.datos.meta.totalPages} cambiar={(n) => { setId(''); lista.cambiar(n) }} />}
    {id && <Estado consulta={perfil} />}
    {id && <Estado consulta={tipos} vacio={tipos.datos?.length === 0 ? 'Sin tipos de cuidado disponibles.' : undefined} />}
    {id && perfil.datos !== undefined && tipos.datos && tipos.datos.length > 0 && <Formulario key={id} titulo="Editar perfil global" accion="Guardar perfil" exito="Perfil del cuidador guardado." campos={[
      { name: 'tipo', label: 'Tipo de cuidado', options: tipos.datos.map((t) => ({ value: String(t.tipo_cuidado_id), label: t.nombre })),
        value: perfil.datos ? String(perfil.datos.tipo_cuidado_id) : '' },
      { name: 'independiente', label: 'Modalidad', options: [{ value: 'true', label: 'Independiente' }, { value: 'false', label: 'Empleador: titular de esta cuenta' }],
        value: perfil.datos ? String(perfil.datos.cuidador_independiente) : '' },
    ]} enviar={async (datos) => {
      await guardarCuidador(token, cuenta.cuenta_id, id, { tipo_cuidado_id: Number(campo(datos, 'tipo')), cuidador_independiente: campo(datos, 'independiente') === 'true' })
      setRevision((n) => n + 1)
    }} />}
  </section>
}

function Transferir({ base, token, cuenta, actualizar, cerrar }: OperacionProps & { actualizar: () => void; cerrar: () => void }) {
  const candidatos = usePagina<Candidato>(`${base}/candidatos/titularidad`, token)
  return <section className="grid gap-3">
    <Estado consulta={candidatos} vacio={candidatos.datos?.data.length === 0 ? 'No hay otro gestor activo elegible para recibir la titularidad.' : undefined} />
    {!!candidatos.datos?.data.length && <Formulario key={candidatos.pagina} titulo="Transferir titularidad" accion="Transferir cuenta" cancelar={cerrar} campos={[
      { name: 'membresia', label: 'Nuevo titular', options: candidatos.datos.data.map((m) => ({ value: m.membresia_id, label: m.nombre })) },
    ]} enviar={async (datos) => {
      await transferirTitularidad(token, cuenta.cuenta_id, campo(datos, 'membresia'))
      actualizar()
    }}>
      <Checkbox label="Confirmo que la persona seleccionada será titular de esta cuenta." required />
    </Formulario>}
    {candidatos.datos && <Paginador pagina={candidatos.pagina} total={candidatos.datos.meta.totalPages} cambiar={candidatos.cambiar} />}
  </section>
}

export function GestionCuenta(props: OperacionProps & { actualizar: () => void; vista?: 'resumen' | 'configuracion' }) {
  const { cuenta, token, base, actualizar, vista = 'resumen' } = props
  const navigate = useNavigate()
  const [revision, setRevision] = useState(0)
  const [transferir, setTransferir] = useState(false)
  const detalle = useDatos<DetalleCuenta>(base, token, revision)
  const configurar = cuenta.acceso_operativo === true && cuenta.permisos.includes('organizacion:configurar')
  const datos = detalle.datos?.cuenta
  const raiz = `/operacion/${idRuta(cuenta.cuenta_id)}`
  const refrescar = () => { setRevision((n) => n + 1); actualizar() }
  if (vista === 'configuracion' && configurar) return <section className="grid gap-4">
    <Estado consulta={detalle} />
    {datos && <DatosContacto {...props} datos={datos} actualizar={refrescar} cancelar={() => navigate(`${raiz}/cuenta`)} />}
    <Configuracion {...props} actualizar={refrescar} />
  </section>

  return <section className="grid gap-4" aria-label="Datos y gestión de cuenta">
    <Estado consulta={detalle} />
    {datos && <section className="grid gap-4 rounded-md border border-line-soft bg-surface p-4 sm:p-5" aria-labelledby="datos-cuenta">
      <div className="flex items-center gap-3">
        <IconTile size={48}><Building2 size={23} aria-hidden /></IconTile>
        <h2 id="datos-cuenta" className="text-lg font-semibold text-ink">Datos de la cuenta</h2>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="font-semibold text-ink">Categoría</dt><dd>{datos.categoria.nombre}</dd></div>
        <div><dt className="font-semibold text-ink">Municipio</dt><dd>{datos.municipio.nombre}, {datos.municipio.provincia}</dd></div>
        {datos.direccion && <div><dt className="font-semibold text-ink">Dirección</dt><dd>{datos.direccion}</dd></div>}
        {datos.telefono && <div><dt className="font-semibold text-ink">Teléfono</dt><dd>{datos.telefono}</dd></div>}
        {datos.correo && <div><dt className="font-semibold text-ink">Correo</dt><dd className="break-words">{datos.correo}</dd></div>}
        <div><dt className="font-semibold text-ink">Fecha de creación</dt><dd>{fechaCorta(datos.fecha_creacion)}</dd></div>
      </dl>
      {configurar && <ButtonLink to={`${raiz}/configuracion`} variant="outline" className="max-w-full justify-self-start py-2">
        <span className="flex items-center gap-2 text-left">
          <span>{cuenta.tipo === 'organizacion' ? 'Configurar organización' : 'Configurar cuenta'}</span>
          <ChevronRight size={18} className="shrink-0" aria-hidden />
        </span>
      </ButtonLink>}
    </section>}
    {cuenta.acceso_operativo && cuenta.permisos.includes('cuidadores:gestionar') && <Cuidadores {...props} />}
    {cuenta.acceso_operativo && cuenta.es_titular && cuenta.permisos.includes('usuarios:gestionar') && <section className="grid gap-3 rounded-md border border-line-soft bg-surface p-4 sm:p-5" aria-labelledby="titularidad">
      <h3 id="titularidad" className="text-lg font-semibold text-ink">Titularidad</h3>
      <p className="text-sm text-ink-2">Puedes entregar la titularidad a otro gestor activo de esta cuenta.</p>
      {transferir ? <Transferir {...props} cerrar={() => setTransferir(false)} /> : <Button variant="outline" className="justify-self-start" onClick={() => setTransferir(true)}>Transferir titularidad</Button>}
    </section>}
  </section>
}
