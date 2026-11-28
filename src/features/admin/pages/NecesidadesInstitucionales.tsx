/*
 * NecesidadesInstitucionales.tsx — Necesidades de la organización (tabla Org_Necesidad · CR-186), no de un
 * envejeciente concreto: insumos para el centro, transporte para una jornada…
 *  - Selector «¿Para quién es la necesidad?» (Organización · Envejeciente, DFP5-01): Envejeciente lleva al formulario
 *    de necesidades de envejecientes; Organización registra aquí.
 *  - Lista con filtros por estado, tipo y prioridad; detalle con historial y cambio de estado (pendiente, en proceso,
 *    satisfecha o inactiva; al resolver, el motivo es obligatorio).
 *  - Requiere la funcionalidad `org_necesidad` (plan Gestión Comunitaria Avanzada): si el plan no la incluye se
 *    muestra un aviso. Registrar y actualizar exige el permiso necesidades:registrar y el rol Administrador o
 *    Coordinador; los demás roles con acceso solo consultan. Necesita conexión (no se guarda sin internet).
 * Módulo: admin (V2 §Plan · CR-186).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AvisoBorrador,
  Badge,
  Button,
  Chip,
  ChoicePills,
  EmptyState,
  IconTile,
  SelectField,
  Sheet,
  TextareaAbreviado,
  TextareaField,
  TextField,
  useFormulario,
  useToast,
} from '@/components/ui'
import { AvisoPlan, Caja } from '@/components/plan'
import { UNIDADES } from '@/domain/api'
import {
  cambiarEstadoNecesidadOrg,
  crearNecesidadOrg,
  DATOS_NECESIDAD_ORG_VACIOS,
  puedeEscribirNecesidadesOrg,
  ROLES_RESPONSABLE_ORG,
  validarNecesidadOrg,
  type DatosNecesidadOrg,
} from '@/domain/api/necesidadesOrg'
import { nombreCompleto, ROL_LABEL, useSession } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, fechaHora } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { nombreUsuario } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { EstadoNecesidad, NecesidadOrganizacion, Organizacion, Prioridad, TipoNecesidad, Usuario } from '@/domain/types'
import { useFuncionalidad } from '@/domain/usePlan'
import { ACCION_ESTADO_NECESIDAD, ESTADO_NECESIDAD, PRIORIDADES, prioridad, resuelve, TIPOS_NECESIDAD, tipoNecesidad, TRANSICIONES_NECESIDAD } from '@/features/visitas/lib/dominio'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'

const TARJETA = 'flex flex-col gap-4 p-5 rounded-md bg-surface shadow-1 min-w-0'
const ESTADOS_ORDEN: EstadoNecesidad[] = ['pendiente', 'en_proceso', 'satisfecha', 'inactiva']
const ORDEN_PRIORIDAD: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 }

export default function NecesidadesInstitucionales() {
  const { user, org } = useSession()
  const incluida = useFuncionalidad('org_necesidad')
  return (
    <Page title="Necesidades institucionales" back wide>
      {!user || !org ? null : incluida ? (
        <Contenido user={user} org={org} />
      ) : (
        <>
          <p className="text-base text-ink-2">Registra y da seguimiento a lo que necesita la organización: insumos para el centro, transporte para una jornada y otros apoyos que no son de un adulto mayor concreto.</p>
          <AvisoPlan funcionalidad="org_necesidad" />
        </>
      )}
    </Page>
  )
}

function Contenido({ user, org }: { user: Usuario; org: Organizacion }) {
  const enLinea = useEnLinea()
  const todas = useDB((s) => s.necesidadesOrg)
  const [verId, setVerId] = useState<string | null>(null)
  const cerrar = useCallback(() => setVerId(null), [])
  const escribe = puedeEscribirNecesidadesOrg(user, puede(user, 'necesidades:registrar'))
  const propias = useMemo(() => todas.filter((n) => n.orgId === org.id), [todas, org.id])
  const abierta = propias.find((n) => n.id === verId)

  return (
    <>
      {!escribe && <Caja>Solo el Administrador y el Coordinador registran y actualizan las necesidades institucionales. Aquí puedes consultarlas.</Caja>}
      {escribe && !enLinea && <Caja tono="offline">Sin conexión. Registrar necesidades institucionales y cambiar su estado necesita internet; podrás hacerlo cuando vuelva la conexión.</Caja>}
      <div className={cn('grid gap-6', escribe && 'lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start')}>
        {escribe && <RegistrarCard user={user} org={org} />}
        <Lista necesidades={propias} escribe={escribe} onVer={setVerId} />
      </div>
      {abierta && <Detalle key={abierta.id} necesidad={abierta} user={user} escribe={escribe} onClose={cerrar} />}
    </>
  )
}

/* ───────────── Registrar: selector «para quién» + formulario ───────────── */

function RegistrarCard({ user, org }: { user: Usuario; org: Organizacion }) {
  const { base } = useShell()
  const navigate = useNavigate()
  const [para, setPara] = useState<'organizacion' | 'envejeciente'>('organizacion')
  const [abierto, setAbierto] = useState(false)
  // Se vuelve a montar el formulario tras registrar: empieza vacío y con su borrador limpio.
  const [version, setVersion] = useState(0)

  const elegir = (v: 'organizacion' | 'envejeciente') => {
    if (v === 'envejeciente') return navigate(`${base}/necesidades/nueva`)
    setPara(v)
  }

  return (
    <section className={TARJETA} aria-labelledby="h-registrar" data-testid="registrar-necesidad-org">
      <h2 id="h-registrar" className="text-lg font-bold text-ink">
        Registrar necesidad
      </h2>
      <ChoicePills
        label="¿Para quién es la necesidad?"
        value={para}
        onChange={elegir}
        options={[
          { value: 'organizacion', label: 'Organización' },
          { value: 'envejeciente', label: 'Envejeciente' },
        ]}
        help="Organización: insumos, transporte u otros apoyos de la institución. Envejeciente: una necesidad de un adulto mayor concreto (abre el formulario de necesidades)."
      />
      {/* En móvil el formulario se despliega; en escritorio está siempre a la vista. */}
      <Button className="lg:hidden" variant={abierto ? 'light' : 'primary'} aria-expanded={abierto} aria-controls="form-necesidad-org" onClick={() => setAbierto((a) => !a)}>
        {abierto ? 'Ocultar formulario' : 'Mostrar formulario'}
      </Button>
      <div id="form-necesidad-org" className={cn(abierto ? 'block' : 'hidden lg:block')}>
        <FormularioOrg key={version} user={user} org={org} onRegistrado={() => {
            setVersion((v) => v + 1)
            setAbierto(false)
          }} />
      </div>
    </section>
  )
}

function FormularioOrg({ user, org, onRegistrado }: { user: Usuario; org: Organizacion; onRegistrado: () => void }) {
  const toast = useToast()
  const enLinea = useEnLinea()
  const catalogos = useDB((s) => s.catalogos)
  const usuarios = useDB((s) => s.usuarios)
  const f = useFormulario<DatosNecesidadOrg>({
    clave: `necesidad-org:${user.id}:${org.id}`,
    inicial: DATOS_NECESIDAD_ORG_VACIOS,
    campos: ['tipo', 'catalogoId', 'descripcion', 'cantidad', 'unidad', 'prioridad', 'responsableId'],
    validar: validarNecesidadOrg,
  })
  const v = f.valores

  // Necesidades del catálogo de la categoría elegida (tabla Necesidad, filtrada por TipoNecesidad).
  const delCatalogo = useMemo(() => catalogos.necesidades.filter((n) => n.tipo === v.tipo), [catalogos.necesidades, v.tipo])
  const responsables = useMemo(
    () =>
      usuarios
        .filter((u) => u.orgId === org.id && u.estado === 'activo' && ROLES_RESPONSABLE_ORG.includes(u.rol))
        .sort((a, b) => a.rol.localeCompare(b.rol) || a.nombre.localeCompare(b.nombre))
        .map((u) => ({ value: u.id, label: `${nombreCompleto(u)} · ${ROL_LABEL[u.rol]}${u.id === user.id ? ' (yo)' : ''}` })),
    [usuarios, org.id, user.id],
  )

  const registrar = f.enviar((datos) => {
    const r = crearNecesidadOrg(user, datos)
    if (!r.ok) {
      toast(r.error, 'error')
      return r
    }
    toast('Necesidad institucional registrada como «Pendiente».')
    // Se borra el borrador antes de volver a montar el formulario, para que arranque vacío.
    f.limpiarBorrador()
    onRegistrado()
    return r
  })

  return (
    <form className="flex flex-col gap-4" onSubmit={registrar} noValidate aria-label="Registro de necesidad institucional">
      <AvisoBorrador formulario={f} />
      <SelectField
        label="Categoría"
        required
        placeholder="Selecciona una categoría"
        options={TIPOS_NECESIDAD.map((t) => ({ value: t.value, label: t.label }))}
        help="Medicamentos, alimentación, transporte, compañía u otros apoyos."
        {...f.campo('tipo')}
        onChange={(e) => {
          // Al cambiar de categoría se limpia la necesidad del catálogo (pertenece a otra categoría).
          f.setValores({ tipo: e.target.value as TipoNecesidad, catalogoId: '' })
          f.tocar('tipo')
        }}
      />
      {v.tipo && delCatalogo.length > 0 && (
        <SelectField
          label="Necesidad del catálogo"
          options={[{ value: '', label: 'Sin especificar' }, ...delCatalogo.map((n) => ({ value: n.id, label: n.nombre }))]}
          help="Opcional. Elige la necesidad concreta del catálogo; ayuda a agruparlas en los reportes."
          {...f.campo('catalogoId')}
        />
      )}
      {/* Área de texto más baja para que el formulario sea corto en móvil (RF-06). */}
      <div className="[&_textarea]:min-h-[88px]">
        <TextareaAbreviado label="Descripción" required rows={2} maxLength={500} placeholder="Ej.: 2 tensiómetros digitales para las visitas de campo" {...f.abreviado('descripcion')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Cantidad" type="number" inputMode="decimal" min={1} step="any" placeholder="Opcional" {...f.campo('cantidad')} />
        <SelectField label="Unidad" placeholder="Unidad" options={UNIDADES} {...f.campo('unidad')} />
      </div>
      <ChoicePills
        label="Prioridad"
        required
        options={PRIORIDADES.map((p) => ({ value: p.value, label: p.label }))}
        help="Alta: urgente. Media: se puede planificar. Baja: cuando haya oportunidad."
        {...f.valor('prioridad')}
      />
      <SelectField
        label="Responsable"
        options={[{ value: '', label: 'Sin asignar' }, ...responsables]}
        help="Quién se encarga de conseguir el apoyo o darle seguimiento."
        {...f.campo('responsableId')}
      />
      <Button type="submit" fullWidth loading={f.enviando} disabled={!enLinea}>
        Registrar necesidad
      </Button>
      {!enLinea && <p className="-mt-2 text-sm text-muted">Necesitas conexión a internet para registrar la necesidad.</p>}
    </form>
  )
}

/* ───────────── Lista con filtros ───────────── */

function Lista({ necesidades, escribe, onVer }: { necesidades: NecesidadOrganizacion[]; escribe: boolean; onVer: (id: string) => void }) {
  const usuarios = useDB((s) => s.usuarios)
  const [estado, setEstado] = useState<EstadoNecesidad | 'todas'>('todas')
  const [tipo, setTipo] = useState<TipoNecesidad | ''>('')
  const [prio, setPrio] = useState<Prioridad | ''>('')

  const cuenta = useMemo(() => {
    const c: Record<EstadoNecesidad, number> = { pendiente: 0, en_proceso: 0, satisfecha: 0, inactiva: 0 }
    for (const n of necesidades) c[n.estado]++
    return c
  }, [necesidades])

  const visibles = useMemo(
    () =>
      necesidades
        .filter((n) => (estado === 'todas' || n.estado === estado) && (!tipo || n.tipo === tipo) && (!prio || n.prioridad === prio))
        .sort((a, b) => ESTADOS_ORDEN.indexOf(a.estado) - ESTADOS_ORDEN.indexOf(b.estado) || ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || b.creadaEn.localeCompare(a.creadaEn)),
    [necesidades, estado, tipo, prio],
  )
  const hayFiltros = estado !== 'todas' || !!tipo || !!prio
  const quitarFiltros = () => {
    setEstado('todas')
    setTipo('')
    setPrio('')
  }

  return (
    <section className="flex flex-col gap-4 min-w-0" aria-labelledby="h-lista" data-testid="lista-necesidades-org">
      <div className="flex flex-col gap-0.5">
        <h2 id="h-lista" className="section-title">
          Necesidades de la organización
        </h2>
        <span className="text-sm text-muted" aria-live="polite">
          {visibles.length} de {necesidades.length} necesidad{necesidades.length === 1 ? '' : 'es'}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-[var(--gutter)] px-[var(--gutter)] md:mx-0 md:px-0 md:flex-wrap" role="group" aria-label="Filtrar por estado">
          <Chip active={estado === 'todas'} onClick={() => setEstado('todas')}>
            Todas · {necesidades.length}
          </Chip>
          {ESTADOS_ORDEN.map((e) => (
            <Chip key={e} active={estado === e} onClick={() => setEstado(e)}>
              {ESTADO_NECESIDAD[e].label} · {cuenta[e]}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Categoría"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoNecesidad | '')}
            options={[{ value: '', label: 'Todas' }, ...TIPOS_NECESIDAD.map((t) => ({ value: t.value, label: t.label }))]}
          />
          <SelectField
            label="Prioridad"
            value={prio}
            onChange={(e) => setPrio(e.target.value as Prioridad | '')}
            options={[{ value: '', label: 'Todas' }, ...PRIORIDADES.map((p) => ({ value: p.value, label: p.label }))]}
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          title={necesidades.length === 0 ? 'Todavía no hay necesidades institucionales' : 'Ninguna necesidad coincide con los filtros'}
          text={necesidades.length === 0 ? (escribe ? 'Registra la primera con el formulario.' : undefined) : 'Prueba con otro estado, categoría o prioridad.'}
          action={
            hayFiltros ? (
              <Button variant="outline" size="sm" onClick={quitarFiltros}>
                Quitar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="@container grid grid-cols-1 gap-3 list-none m-0 p-0">
          {visibles.map((n) => (
            <TarjetaNecesidad key={n.id} necesidad={n} responsable={n.responsableId ? nombreUsuario(usuarios, n.responsableId) : 'Sin asignar'} escribe={escribe} onVer={() => onVer(n.id)} />
          ))}
        </ul>
      )}
    </section>
  )
}

function TarjetaNecesidad({ necesidad: n, responsable, escribe, onVer }: { necesidad: NecesidadOrganizacion; responsable: string; escribe: boolean; onVer: () => void }) {
  const tipo = tipoNecesidad(n.tipo)
  const estado = ESTADO_NECESIDAD[n.estado]
  const prio = prioridad(n.prioridad)
  return (
    <li className="flex flex-col gap-3 p-4 rounded-md border border-line-soft bg-bg min-w-0">
      <div className="flex items-start gap-3">
        <IconTile size={44}>
          <tipo.icon size={22} aria-hidden />
        </IconTile>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-base text-ink">{tipo.label}</strong>
            <Badge tone={estado.tone}>{estado.badge}</Badge>
            <Badge tone={prio.tone}>Prioridad {prio.label}</Badge>
          </div>
          <p className="text-sm text-ink-2 wrap-anywhere">{n.descripcion}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <Dato etiqueta="Cantidad" valor={n.cantidad ? `${n.cantidad} ${n.unidad ?? ''}`.trim() : 'No indicada'} />
        <Dato etiqueta="Registrada" valor={fechaCorta(n.creadaEn)} />
        <div className="col-span-2">
          <Dato etiqueta="Responsable" valor={responsable} />
        </div>
      </dl>
      <Button variant="outline" size="sm" fullWidth onClick={onVer} aria-label={`${escribe ? 'Ver y actualizar' : 'Ver detalle de'} la necesidad: ${n.descripcion}`}>
        {escribe ? 'Ver y actualizar' : 'Ver detalle'}
      </Button>
    </li>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{etiqueta}</dt>
      <dd className="font-semibold text-ink wrap-anywhere">{valor}</dd>
    </div>
  )
}

/* ───────────── Detalle: historial y cambio de estado ───────────── */

function Detalle({ necesidad: n, user, escribe, onClose }: { necesidad: NecesidadOrganizacion; user: Usuario; escribe: boolean; onClose: () => void }) {
  const toast = useToast()
  const enLinea = useEnLinea()
  const usuarios = useDB((s) => s.usuarios)
  const [nuevo, setNuevo] = useState<EstadoNecesidad | ''>('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string>()
  const nombreDe = (id: string | undefined) => nombreUsuario(usuarios, id)

  const tipo = tipoNecesidad(n.tipo)
  const estado = ESTADO_NECESIDAD[n.estado]
  const prio = prioridad(n.prioridad)
  const exigeMotivo = resuelve(nuevo)
  const cerrada = resuelve(n.estado)
  const historial = useMemo(() => [...n.historial].sort((a, b) => b.fecha.localeCompare(a.fecha)), [n.historial])

  const guardar = () => {
    if (!nuevo) return setError('Elige el nuevo estado.')
    if (exigeMotivo && nota.trim().length < 3) return setError('Indica el motivo de la resolución.')
    const r = cambiarEstadoNecesidadOrg(user, n.id, nuevo, nota)
    if (!r.ok) {
      setError(r.errores?.nota)
      return toast(r.error, 'error')
    }
    toast(`Necesidad marcada como «${ESTADO_NECESIDAD[nuevo].label}»`)
    setNuevo('')
    setNota('')
    setError(undefined)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Necesidad institucional"
      footer={
        <>
          <Button variant="light" onClick={onClose}>
            Cerrar
          </Button>
          {escribe && (
            <Button onClick={guardar} disabled={!nuevo || !enLinea}>
              Guardar
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 font-bold text-navy">
          <tipo.icon size={20} aria-hidden /> {tipo.label}
        </span>
        <Badge tone={estado.tone}>{estado.badge}</Badge>
        <Badge tone={prio.tone}>Prioridad {prio.label}</Badge>
      </div>
      <p className="p-3 rounded-sm bg-blue-100 text-ink wrap-anywhere">{n.descripcion}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <Dato etiqueta="Cantidad" valor={n.cantidad ? `${n.cantidad} ${n.unidad ?? ''}`.trim() : 'No indicada'} />
        <Dato etiqueta="Registrada" valor={fechaCorta(n.creadaEn)} />
        <Dato etiqueta="Responsable" valor={n.responsableId ? nombreDe(n.responsableId) : 'Sin asignar'} />
        <Dato etiqueta="Registrada por" valor={nombreDe(n.registradaPor)} />
      </dl>
      {cerrada && n.satisfechaEn && (
        <div className="flex flex-col gap-1 p-3 rounded-sm border border-line-soft text-sm">
          <strong className="text-ink">Resolución · {fechaHora(n.satisfechaEn)}</strong>
          <span className="text-ink-2 wrap-anywhere">{n.motivoResolucion?.trim() || 'Sin motivo registrado.'}</span>
        </div>
      )}

      {escribe && (
        <section className="flex flex-col gap-3" aria-labelledby="h-cambiar-estado">
          <h3 id="h-cambiar-estado" className="text-base font-bold text-ink">
            Actualizar estado
          </h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2" role="radiogroup" aria-labelledby="h-cambiar-estado">
            {TRANSICIONES_NECESIDAD[n.estado].map((e) => {
              const on = nuevo === e
              return (
                <button
                  key={e}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={cn('flex items-center justify-center gap-2 min-h-12 px-3 rounded-sm border font-semibold', on ? 'bg-navy border-navy text-white' : 'bg-bg border-line text-ink-2 hover:border-navy')}
                  onClick={() => {
                    setNuevo(e)
                    setError(undefined)
                  }}
                >
                  <span className={cn('size-2.5 rounded-full', ESTADO_NECESIDAD[e].dot, on && 'ring-2 ring-white')} aria-hidden />
                  {ACCION_ESTADO_NECESIDAD[e]}
                </button>
              )
            })}
          </div>
          <TextareaField
            label={exigeMotivo ? 'Motivo de la resolución' : 'Nota (opcional)'}
            required={exigeMotivo}
            rows={2}
            maxLength={300}
            placeholder={exigeMotivo ? 'Ej.: se recibió el equipo donado por la junta de vecinos' : 'Ej.: se está cotizando con dos proveedores'}
            help={exigeMotivo ? 'Al marcarla como satisfecha o inactiva, indica cómo se resolvió o por qué se cierra. Queda en el historial.' : undefined}
            value={nota}
            onChange={(e) => {
              setNota(e.target.value)
              if (error) setError(undefined)
            }}
            error={error}
          />
          {!enLinea && <p className="text-sm text-muted">Necesitas conexión a internet para cambiar el estado.</p>}
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="h-historial-org">
        <h3 id="h-historial-org" className="text-base font-bold text-ink">
          Historial de estados
        </h3>
        <ol className="relative m-0 p-0 list-none flex flex-col gap-4 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-line-soft">
          {historial.map((c, i) => (
            <li key={`${c.fecha}-${i}`} className="relative flex gap-3">
              <span className={cn('relative z-10 mt-1 size-5 flex-none rounded-full border-[3px] border-bg', ESTADO_NECESIDAD[c.estado].dot)} aria-hidden />
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="font-semibold text-ink">{i === historial.length - 1 && c.estado === 'pendiente' ? 'Registrada como Pendiente' : `Cambió a ${ESTADO_NECESIDAD[c.estado].label}`}</span>
                <span className="text-sm text-ink-2">
                  {nombreDe(c.usuarioId)} · {fechaHora(c.fecha)}
                </span>
                {c.nota && <span className="text-sm text-ink-2 italic wrap-anywhere">«{c.nota}»</span>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </Sheet>
  )
}
