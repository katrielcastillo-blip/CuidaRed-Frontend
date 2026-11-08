/*
 * gestion-cuenta.tsx — Datos, configuración, titularidad y perfiles de cuidador conectados.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useState } from 'react'
import { Button, ButtonLink } from '@/components/ui'
import { api } from '../client'
import type { DetalleCuenta } from '../api/cuentas'
import { guardarCuidador, transferirTitularidad, type PerfilCuidador } from '../api/miembros'
import { campo, Estado, Formulario, idRuta, opciones, Paginador, useDatos, usePagina, type Campo } from './controles'
import type { Candidato, OperacionProps } from './visitas'

function Cuidadores({ base, token, cuenta }: OperacionProps) {
  const [id, setId] = useState<string>()
  const [revision, setRevision] = useState(0)
  const lista = usePagina<Candidato>(`${base}/candidatos/cuidado`, token, revision)
  const perfil = useDatos<PerfilCuidador | null>(id ? `${base}/miembros/${idRuta(id)}/cuidador` : null, token, revision)
  const tipos = useDatos<{ tipo_cuidado_id: number; nombre: string }[]>('/catalogos/tipos-cuidado', token)
  return <section className="grid gap-3">
    <h3 className="font-semibold">Perfiles globales de cuidadores</h3>
    <p>Una edición se refleja en todas las cuentas donde participa la persona.</p>
    <Estado consulta={lista} vacio={lista.datos?.data.length === 0 ? 'Sin cuidadores activos.' : undefined} />
    {lista.datos?.data.map((c) => <Button variant="outline" key={c.membresia_id} onClick={() => setId(c.membresia_id)}>{c.nombre}</Button>)}
    {lista.datos && <Paginador pagina={lista.pagina} total={lista.datos.meta.totalPages} cambiar={lista.cambiar} />}
    {id && <Estado consulta={perfil} />}
    {id && perfil.datos !== undefined && <Formulario key={id} titulo="Editar perfil global" campos={[
      { name: 'tipo', label: 'Tipo de cuidado', options: tipos.datos?.map((t) => ({ value: String(t.tipo_cuidado_id), label: t.nombre })) ?? [],
        value: perfil.datos ? String(perfil.datos.tipo_cuidado_id) : '' },
      { name: 'independiente', label: 'Modalidad', options: [{ value: 'sí', label: 'Independiente' }, { value: 'no', label: 'Empleador: titular de esta cuenta' }],
        value: perfil.datos ? perfil.datos.cuidador_independiente ? 'sí' : 'no' : '' },
    ]} disabled={!tipos.datos?.length} enviar={async (datos) => {
      await guardarCuidador(token, cuenta.cuenta_id, id, { tipo_cuidado_id: Number(campo(datos, 'tipo')), cuidador_independiente: campo(datos, 'independiente') === 'sí' })
      setRevision((n) => n + 1)
    }} />}
  </section>
}

function Transferir({ base, token, cuenta, actualizar }: OperacionProps & { actualizar: () => void }) {
  const candidatos = usePagina<Candidato>(`${base}/candidatos/titularidad`, token)
  return <section className="grid gap-3">
    <Estado consulta={candidatos} vacio={candidatos.datos?.data.length === 0 ? 'No hay otro gestor activo elegible para recibir la titularidad.' : undefined} />
    {!!candidatos.datos?.data.length && <Formulario titulo="Transferir titularidad" accion="Transferir cuenta" campos={[
      { name: 'membresia', label: 'Nuevo titular', options: candidatos.datos.data.map((m) => ({ value: m.membresia_id, label: m.nombre })) },
    ]} enviar={async (datos) => {
      await transferirTitularidad(token, cuenta.cuenta_id, campo(datos, 'membresia'))
      actualizar()
    }}>
      <label className="flex min-h-12 items-center gap-2"><input type="checkbox" required /> Confirmo el cambio de titular.</label>
    </Formulario>}
    {candidatos.datos && <Paginador pagina={candidatos.pagina} total={candidatos.datos.meta.totalPages} cambiar={candidatos.cambiar} />}
  </section>
}

export function GestionCuenta(props: OperacionProps & { actualizar: () => void }) {
  const { cuenta, token, base, actualizar } = props
  const [revision, setRevision] = useState(0)
  const detalle = useDatos<DetalleCuenta>(base, token, revision)
  const configurar = cuenta.acceso_operativo === true && cuenta.permisos.includes('organizacion:configurar')
  const config = useDatos<{ nombre: string; valor: string; tipo_dato: string; descripcion: string | null }[]>(configurar ? `${base}/configuracion` : null, token, revision)
  const datos = detalle.datos?.cuenta
  const refrescar = () => { setRevision((n) => n + 1); actualizar() }
  const campos: Campo[] = [
    { name: 'nombre', label: 'Nombre de la cuenta', value: datos?.nombre, max: 120 },
    { name: 'direccion', label: 'Dirección', value: datos?.direccion ?? '', optional: true, max: 150 },
    { name: 'telefono', label: 'Teléfono', value: datos?.telefono ?? '', optional: true, max: 20 },
    { name: 'correo', label: 'Correo', type: 'email', value: datos?.correo ?? '', optional: true, max: 254 },
  ]
  return <section className="grid gap-4">
    <h2 className="text-lg font-semibold">Datos de la cuenta</h2>
    <Estado consulta={detalle} />
    {datos && <p>{datos.nombre} · {datos.categoria.nombre} · {datos.municipio.nombre}</p>}
    {configurar && datos && <Formulario titulo="Editar datos de la cuenta" campos={campos} enviar={async (formulario) => {
      await api(base, token, 'PATCH', Object.fromEntries(campos.map(({ name }) => [name, campo(formulario, name) || null])))
      refrescar()
    }} />}
    {configurar && <Estado consulta={config} vacio={config.datos?.length === 0 ? 'Sin parámetros de configuración disponibles.' : undefined} />}
    {config.datos?.map((p) => <Formulario key={p.nombre} titulo={p.descripcion ?? p.nombre} campos={[
      { name: 'valor', label: p.nombre, value: p.valor, options: p.tipo_dato === 'booleano' ? opciones('true', 'false') : undefined },
    ]} enviar={async (formulario) => {
      await api(`${base}/configuracion`, token, 'PATCH', { valores: { [p.nombre]: campo(formulario, 'valor') } })
      refrescar()
    }} />)}
    {cuenta.acceso_operativo && cuenta.permisos.includes('usuarios:gestionar') && <ButtonLink to={`/operacion/${idRuta(cuenta.cuenta_id)}/miembros`} variant="outline">Miembros de la cuenta</ButtonLink>}
    {cuenta.acceso_operativo && cuenta.es_titular && cuenta.permisos.includes('usuarios:gestionar') && <Transferir {...props} />}
    {cuenta.acceso_operativo && cuenta.permisos.includes('cuidadores:gestionar') && <Cuidadores {...props} />}
  </section>
}
