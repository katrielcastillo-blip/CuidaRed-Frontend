/*
 * Catalogos.tsx — Consulta (solo lectura) de los catálogos de la base de datos (db.catalogos, datos maestros del
 * SRS §11): Rol, TipoCuenta, Categoria_cuenta, PlanCategoria + Plan, MetodoPago, Provincia + Municipio (con
 * búsqueda), TipoNecesidad + Necesidad, Alertas, Prioridad, Riesgo + Nivel_Riesgo, Tipo_Indicacion,
 * Tipo_vinculo, Tipo_Cuidado y Parametros. Cada fila muestra su id o código, el nombre y la descripción.
 * Módulo: admin (permiso catalogos:ver · modelo de datos V3.0 · docs/MAPEO-BD.md §2).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Database } from 'lucide-react'
import { SearchInput } from '@/components/ui'
import { useDB } from '@/domain/store'
import type { Catalogos as TCatalogos } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { Nota } from '../components/Nota'
import { normalizar } from '../lib/datos'
import { formatoMonto, PERIODICIDAD, precioPlan } from '../lib/plan'

interface Columna {
  titulo: string
  clase?: string
}
interface Tabla {
  id: string
  titulo: string
  /** Tabla o tablas de la BD. */
  tablaBD: string
  columnas: Columna[]
  filas: ReactNode[][]
}

const TIPO_PARAM = { numero: 'Número', booleano: 'Sí / No', texto: 'Texto' } as const

const ID: Columna = { titulo: 'Id', clase: 'font-mono text-xs text-muted whitespace-nowrap' }
const NOMBRE: Columna = { titulo: 'Nombre', clase: 'font-semibold text-ink' }
const DESC: Columna = { titulo: 'Descripción', clase: 'text-ink-2' }

const basicas = (lista: Array<{ id: string; nombre: string; descripcion?: string }>) => lista.map((x) => [x.id, x.nombre, x.descripcion ?? '—'])

function tablas(c: TCatalogos): Tabla[] {
  const nombreTipoNec = (id: string) => c.tiposNecesidad.find((t) => t.id === id)?.nombre ?? id
  const nombreCatPlan = (id: string) => c.categoriasPlan.find((t) => t.id === id)?.nombre ?? id
  return [
    { id: 'roles', titulo: 'Roles', tablaBD: 'Rol', columnas: [ID, NOMBRE, DESC], filas: basicas(c.roles) },
    { id: 'tipos-cuenta', titulo: 'Tipos de cuenta', tablaBD: 'TipoCuenta', columnas: [ID, NOMBRE, DESC], filas: basicas(c.tiposCuenta) },
    { id: 'categorias-cuenta', titulo: 'Categorías de cuenta', tablaBD: 'Categoria_cuenta', columnas: [ID, NOMBRE, DESC], filas: basicas(c.categoriasCuenta) },
    { id: 'categorias-plan', titulo: 'Categorías de plan', tablaBD: 'PlanCategoria', columnas: [ID, NOMBRE, DESC], filas: basicas(c.categoriasPlan) },
    {
      id: 'planes',
      titulo: 'Planes',
      tablaBD: 'Plan',
      columnas: [ID, NOMBRE, { titulo: 'Categoría' }, { titulo: 'Precio', clase: 'whitespace-nowrap' }, { titulo: 'Periodicidad' }, { titulo: 'Duración' }, { titulo: 'Límites' }, { titulo: 'Estado' }],
      filas: c.planes.map((p) => [
        p.id,
        p.nombre,
        nombreCatPlan(p.categoriaId),
        p.precio === 0 ? precioPlan(p) : formatoMonto(p.precio),
        PERIODICIDAD[p.periodicidad],
        `${p.duracionDias} días`,
        `${p.limiteEnvejecientes} adultos · ${p.limiteUsuarios} usuarios`,
        p.estado === 'activo' ? 'Activo' : 'Inactivo',
      ]),
    },
    {
      id: 'metodos-pago',
      titulo: 'Métodos de pago',
      tablaBD: 'MetodoPago',
      columnas: [ID, NOMBRE, { titulo: 'Estado' }],
      filas: c.metodosPago.map((m) => [m.id, m.nombre, m.activo ? 'Activo' : 'Inactivo']),
    },
    { id: 'tipos-necesidad', titulo: 'Tipos de necesidad', tablaBD: 'TipoNecesidad', columnas: [ID, NOMBRE, DESC], filas: basicas(c.tiposNecesidad) },
    {
      id: 'necesidades',
      titulo: 'Catálogo de necesidades',
      tablaBD: 'Necesidad',
      columnas: [ID, NOMBRE, { titulo: 'Tipo' }, DESC],
      filas: c.necesidades.map((n) => [n.id, n.nombre, nombreTipoNec(n.tipo), n.descripcion ?? '—']),
    },
    { id: 'alertas', titulo: 'Tipos de alerta', tablaBD: 'Alertas', columnas: [ID, NOMBRE, DESC], filas: basicas(c.alertas) },
    { id: 'prioridades', titulo: 'Prioridades', tablaBD: 'Prioridad', columnas: [ID, NOMBRE, DESC], filas: basicas(c.prioridades) },
    { id: 'riesgos', titulo: 'Factores de riesgo', tablaBD: 'Riesgo', columnas: [ID, NOMBRE, DESC], filas: basicas(c.riesgos) },
    { id: 'niveles-riesgo', titulo: 'Niveles de riesgo', tablaBD: 'Nivel_Riesgo', columnas: [ID, NOMBRE, DESC], filas: basicas(c.nivelesRiesgo) },
    { id: 'tipos-indicacion', titulo: 'Tipos de indicación', tablaBD: 'Tipo_Indicacion', columnas: [ID, NOMBRE, DESC], filas: basicas(c.tiposIndicacion) },
    { id: 'tipos-vinculo', titulo: 'Tipos de vínculo', tablaBD: 'Tipo_vinculo', columnas: [ID, NOMBRE, DESC], filas: basicas(c.tiposVinculo) },
    { id: 'tipos-cuidado', titulo: 'Tipos de cuidado', tablaBD: 'Tipo_Cuidado', columnas: [ID, NOMBRE, DESC], filas: basicas(c.tiposCuidado) },
    {
      id: 'parametros',
      titulo: 'Parámetros',
      tablaBD: 'Parametros',
      columnas: [ID, { titulo: 'Clave', clase: 'font-mono text-xs break-all' }, NOMBRE, { titulo: 'Tipo' }, { titulo: 'Valor por defecto' }, DESC],
      filas: c.parametros.map((p) => [p.id, p.clave, p.nombre, TIPO_PARAM[p.tipo], p.valorDefecto || '—', p.descripcion]),
    },
  ]
}

export default function Catalogos() {
  const { base } = useShell()
  const catalogos = useDB((s) => s.catalogos)
  const lista = useMemo(() => tablas(catalogos), [catalogos])
  const total = lista.length + 1

  return (
    <Page title="Catálogos" back={`${base}/mas`} wide>
      <div className="flex items-start gap-3">
        <span className="grid place-items-center size-12 flex-none rounded-md bg-blue-100 border border-blue text-navy">
          <Database size={24} aria-hidden />
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="text-2xl font-bold">Catálogos de CuidaRed</h2>
          <p className="text-sm text-muted">
            {total} tablas de referencia (datos maestros). Son de solo lectura: definen las opciones de las listas de la aplicación.
          </p>
        </div>
      </div>
      <Nota>Para cambiar el valor de un parámetro en tu organización ve a Más → Configuración. Los catálogos los mantiene el equipo de CuidaRed.</Nota>

      <div className="flex flex-col gap-3">
        {lista.slice(0, 6).map((t) => (
          <Acordeon key={t.id} tabla={t} />
        ))}
        <Geografia />
        {lista.slice(6).map((t) => (
          <Acordeon key={t.id} tabla={t} />
        ))}
      </div>
    </Page>
  )
}

function Panel({ id, titulo, tablaBD, total, children }: { id: string; titulo: string; tablaBD: string; total: ReactNode; children: ReactNode }) {
  return (
    <details id={id} className="group rounded-md border border-line-soft bg-surface shadow-1 open:shadow-2">
      <summary className="flex items-center gap-3 min-h-14 px-4 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden rounded-md focus-visible:outline-[3px] focus-visible:outline-blue/40">
        <span className="flex-1 min-w-0 flex flex-col">
          <strong className="text-base text-ink">{titulo}</strong>
          <span className="text-xs text-muted">
            Tabla <span className="font-mono">{tablaBD}</span> · {total}
          </span>
        </span>
        <ChevronDown size={20} className="flex-none text-navy transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}

function Acordeon({ tabla: t }: { tabla: Tabla }) {
  return (
    <Panel id={t.id} titulo={t.titulo} tablaBD={t.tablaBD} total={`${t.filas.length} registro${t.filas.length === 1 ? '' : 's'}`}>
      <TablaSimple columnas={t.columnas} filas={t.filas} titulo={t.titulo} />
    </Panel>
  )
}

/** Tabla en escritorio; en móvil cada fila se apila como tarjeta (sin scroll horizontal de la página). */
function TablaSimple({ columnas, filas, titulo }: { columnas: Columna[]; filas: ReactNode[][]; titulo: string }) {
  return (
    <>
      <div className="relative hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line-soft">
              {columnas.map((c) => (
                <th key={c.titulo} scope="col" className="py-2 pr-3 font-bold">
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {filas.map((f, i) => (
              <tr key={i} className="align-top">
                {f.map((v, j) => (
                  <td key={j} className={`py-2 pr-3 ${columnas[j]?.clase ?? ''}`}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col divide-y divide-line-soft md:hidden">
        {filas.map((f, i) => (
          <li key={i} className="py-2.5">
            <dl className="flex flex-col gap-0.5 text-sm">
              {f.map((v, j) => (
                <div key={j} className="flex gap-2 min-w-0">
                  <dt className="w-24 flex-none text-xs font-semibold text-muted pt-0.5">{columnas[j]?.titulo}</dt>
                  <dd className={`flex-1 min-w-0 wrap-anywhere ${columnas[j]?.clase ?? ''}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Provincias y municipios (Provincia_Cod, Municipio_Cod) con búsqueda por nombre o código. */
function Geografia() {
  const provincias = useDB((s) => s.catalogos.provincias)
  const municipios = useDB((s) => s.catalogos.municipios)
  const [q, setQ] = useState('')

  const grupos = useMemo(() => {
    const n = normalizar(q)
    return provincias
      .map((p) => {
        const propios = municipios.filter((m) => m.provinciaCod === p.cod)
        const coincideProv = !n || normalizar(`${p.nombre} ${p.cod}`).includes(n)
        const filtrados = coincideProv ? propios : propios.filter((m) => normalizar(`${m.nombre} ${m.cod}`).includes(n))
        return { p, municipios: filtrados, visible: coincideProv || filtrados.length > 0 }
      })
      .filter((g) => g.visible)
  }, [provincias, municipios, q])
  const encontrados = grupos.reduce((a, g) => a + g.municipios.length, 0)

  return (
    <Panel id="geografia" titulo="Provincias y municipios" tablaBD="Provincia · Municipio" total={`${provincias.length} provincias · ${municipios.length} municipios`}>
      <div className="flex flex-col gap-3">
        <SearchInput aria-label="Buscar provincia o municipio" placeholder="Buscar provincia o municipio…" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="text-xs text-muted" aria-live="polite">
          {q ? `${grupos.length} provincia(s) · ${encontrados} municipio(s) encontrados` : 'Código de provincia P01… y de municipio P01-01…'}
        </p>
        {grupos.length === 0 ? (
          <p className="text-sm text-muted">Sin resultados.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {grupos.map(({ p, municipios: ms }) => (
              <li key={p.cod} className="flex flex-col gap-1.5 p-3 rounded-sm border border-line-soft bg-bg min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-muted">{p.cod}</span>
                  <strong className="text-sm text-ink">{p.nombre}</strong>
                </span>
                <ul className="flex flex-col gap-0.5 text-sm text-ink-2">
                  {ms.map((m) => (
                    <li key={m.cod} className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-muted">{m.cod}</span>
                      <span className="min-w-0 wrap-anywhere">{m.nombre}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
