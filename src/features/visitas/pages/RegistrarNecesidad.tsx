/*
 * RegistrarNecesidad.tsx — Registro de una necesidad pendiente (CU-07 · RF-03 · RF-06 · RF-10).
 * Tabla Env_Necesidad: categoría (TipoNecesidad) → necesidad del catálogo (Necesidad_Id), descripción,
 * Cantidad + Unidad_Medida, Prioridad_Id, es_recurrente e Indicacion_Id (indicación médica vigente del adulto).
 * Módulo: visitas (voluntario y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *   ?adulto=:id   fija el adulto (desde su perfil o tras registrar una visita).
 *   ?visita=:id   asocia la necesidad a la visita en la que se detectó.
 *   sin ?adulto:  lista desplegable obligatoria para elegir el adulto.
 *
 * RF-06: dos campos de texto libre (descripción con abreviaturas y cantidad); el resto con listas, píldoras e
 * interruptor. Se registra SIEMPRE como "Pendiente"; la prioridad es Alta por defecto en medicamentos (RF-04).
 * Sin conexión se guarda en el dispositivo (pendiente de sincronización). Borrador persistente.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Laugh, TriangleAlert } from 'lucide-react'
import { nombreCompleto, useSession } from '@/domain/auth'
import { DATOS_NECESIDAD_VACIOS, registrarNecesidad, UNIDADES, type DatosNecesidad } from '@/domain/api'
import { useEnLinea } from '@/domain/conectividad'
import { alcanzaAdulto, puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import type { Adulto, Necesidad, Prioridad, TipoNecesidad, Usuario } from '@/domain/types'
import { Button, ChoicePills, SelectField, SuccessOverlay, Switch, TextareaAbreviado, TextField, useToast } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { useBorrador } from '@/lib/useBorrador'
import { AdultoHeader } from '../components/AdultoHeader'
import { EstadoPunto, NoEncontrado } from '../components/Comun'
import { ESTADO_NECESIDAD, PRIORIDADES, prioridadPorDefecto, TIPOS_NECESIDAD, tipoNecesidad, useAdultosElegibles } from '../lib/dominio'

const TITULO = 'Registrar necesidad'

type Borrador = Omit<DatosNecesidad, 'visitaId'>
type Errores = Partial<Record<'adulto' | 'tipo' | 'descripcion' | 'cantidad' | 'unidad' | 'prioridad', string | undefined>>

export function RegistrarNecesidad() {
  const { user } = useSession()
  const [params] = useSearchParams()
  const adultoParam = params.get('adulto') ?? undefined
  const visitaParam = params.get('visita') ?? undefined
  const adultos = useDB((s) => s.adultos)
  const visitas = useDB((s) => s.visitas)
  const adultoFijo = useMemo(() => (adultoParam ? adultos.find((a) => a.id === adultoParam) : undefined), [adultos, adultoParam])
  // Solo se asocia la visita si existe y es del mismo adulto.
  const visitaId = useMemo(
    () => (visitaParam && visitas.some((v) => v.id === visitaParam && v.adultoId === adultoParam) ? visitaParam : undefined),
    [visitas, visitaParam, adultoParam],
  )

  if (!user) return null
  if (adultoParam && (!adultoFijo || !alcanzaAdulto(user, adultoFijo))) return <NoEncontrado titulo={TITULO} />
  const clave = `necesidad:${user.id}:${adultoParam ?? 'nueva'}`
  return <Formulario key={clave} clave={clave} user={user} adultoFijo={adultoFijo} visitaId={visitaId} />
}

function Formulario({ clave, user, adultoFijo, visitaId }: { clave: string; user: Usuario; adultoFijo?: Adulto; visitaId?: string }) {
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const elegibles = useAdultosElegibles('necesidades:registrar')
  const catalogos = useDB((s) => s.catalogos)
  const indicaciones = useDB((s) => s.indicaciones)
  const esGestion = puede(user, 'visitas:programar')

  const [d, setD, descartar] = useBorrador<Borrador>(clave, { ...DATOS_NECESIDAD_VACIOS, adultoId: adultoFijo?.id ?? '' })
  const [errores, setErrores] = useState<Errores>({})
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState<{ necesidad: Necesidad; offline: boolean } | null>(null)

  const adulto = adultoFijo ?? elegibles.find((a) => a.id === d.adultoId)
  // Prioridad efectiva: la elegida o, si no se tocó, la de la categoría (alta en medicamentos).
  const prioridad: Prioridad = d.prioridad || prioridadPorDefecto(d.tipo)

  // Necesidades del catálogo de la categoría elegida (tabla Necesidad, filtrada por TipoNecesidad).
  const delCatalogo = useMemo(() => catalogos.necesidades.filter((n) => n.tipo === d.tipo), [catalogos.necesidades, d.tipo])
  const elegidaCatalogo = delCatalogo.find((n) => n.id === d.catalogoId)

  // Indicaciones médicas vigentes del adulto: solo para quien puede verlas (información de salud restringida).
  const verIndicaciones = !!adulto && puede(user, 'indicaciones:ver', adulto)
  const vigentes = useMemo(
    () => (verIndicaciones && adulto ? indicaciones.filter((i) => i.adultoId === adulto.id && i.estado === 'vigente') : []),
    [indicaciones, adulto, verIndicaciones],
  )

  function set<K extends keyof Borrador>(campo: K, valor: Borrador[K], errorKey?: keyof Errores) {
    setD((x) => ({ ...x, [campo]: valor }))
    if (errorKey && errores[errorKey]) setErrores((x) => ({ ...x, [errorKey]: undefined }))
  }

  function elegirTipo(tipo: TipoNecesidad) {
    // Al cambiar de categoría se limpia la necesidad del catálogo (pertenece a otra categoría).
    setD((x) => ({ ...x, tipo, catalogoId: catalogos.necesidades.some((n) => n.id === x.catalogoId && n.tipo === tipo) ? x.catalogoId : '' }))
    if (errores.tipo) setErrores((x) => ({ ...x, tipo: undefined }))
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    const res = await registrarNecesidad(user, {
      ...d,
      adultoId: adulto?.id ?? '',
      prioridad,
      indicacionId: vigentes.some((i) => i.id === d.indicacionId) ? d.indicacionId : '',
      visitaId,
    })
    setEnviando(false)
    if (!res.ok) {
      if (res.errores) {
        setErrores(res.errores)
        requestAnimationFrame(() => document.querySelector('form [role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
      }
      toast(res.error, 'error')
      return
    }
    descartar()
    setExito({ necesidad: res.valor, offline: !!res.offline })
  }

  const pendiente = ESTADO_NECESIDAD.pendiente
  const Icono = d.tipo ? tipoNecesidad(d.tipo).icon : null

  return (
    <Page title={TITULO} back>
      <form className="flex flex-col gap-4" onSubmit={registrar} noValidate aria-label="Registro de necesidad">
        {adultoFijo ? (
          <AdultoHeader adulto={adultoFijo} compacto />
        ) : (
          <SelectField
            label="Adulto mayor"
            required
            placeholder="Selecciona un adulto"
            value={d.adultoId}
            onChange={(e) => set('adultoId', e.target.value, 'adulto')}
            error={errores.adulto}
            hint={elegibles.length === 0 ? 'No tienes adultos mayores asignados.' : undefined}
            options={elegibles.map((a) => ({ value: a.id, label: nombreCompleto(a) }))}
          />
        )}
        {visitaId && <p className="-mt-2 text-sm text-ink-2">Se asociará a la visita que acabas de registrar.</p>}

        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <SelectField
              label="Categoría"
              required
              placeholder="Selecciona una categoría"
              value={d.tipo}
              onChange={(e) => elegirTipo(e.target.value as TipoNecesidad)}
              error={errores.tipo}
              help="Medicamentos, alimentación, transporte, compañía u otros apoyos. Las de medicamentos generan una alerta de caso prioritario."
              options={TIPOS_NECESIDAD.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          {Icono && (
            <span className={`size-[52px] grid place-items-center flex-none rounded-sm bg-blue-100 text-blue ${errores.tipo ? 'mb-7' : ''}`} aria-hidden>
              <Icono size={26} />
            </span>
          )}
        </div>

        {d.tipo === 'medicamentos' && (
          <p className="-mt-2 flex items-center gap-2 px-3 py-1.5 rounded-sm bg-danger-100 text-sm font-semibold text-danger" role="note">
            <TriangleAlert size={18} className="flex-none" aria-hidden />
            Generará una alerta de caso prioritario.
          </p>
        )}

        {d.tipo && delCatalogo.length > 0 && (
          <SelectField
            label="Necesidad"
            value={d.catalogoId}
            onChange={(e) => set('catalogoId', e.target.value)}
            help={
              elegidaCatalogo?.descripcion
                ? `${elegidaCatalogo.nombre}: ${elegidaCatalogo.descripcion}`
                : 'Opcional. Elige la necesidad concreta del catálogo de la organización; ayuda a agruparlas en los reportes.'
            }
            options={[{ value: '', label: 'Sin especificar' }, ...delCatalogo.map((n) => ({ value: n.id, label: n.nombre }))]}
          />
        )}

        {/* Área de texto más baja para caber en un desplazamiento a 360×640 (RF-06). */}
        <div className="[&_textarea]:min-h-[88px]">
          <TextareaAbreviado
            label="Descripción"
            required
            rows={2}
            maxLength={500}
            placeholder="Ej.: necesita reposición de meds para la hta"
            hint="Admite abreviaturas (toca ? para verlas)."
            value={d.descripcion}
            onValueChange={(v) => set('descripcion', v, 'descripcion')}
            error={errores.descripcion}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Cantidad"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="Opcional"
            value={d.cantidad}
            onChange={(e) => set('cantidad', e.target.value, 'cantidad')}
            error={errores.cantidad}
          />
          <SelectField
            label="Unidad"
            value={d.unidad}
            onChange={(e) => set('unidad', e.target.value, 'unidad')}
            error={errores.unidad}
            options={[{ value: '', label: '—' }, ...UNIDADES.map((u) => ({ value: u, label: u }))]}
          />
        </div>

        <ChoicePills<Prioridad>
          label="Prioridad"
          value={prioridad}
          onChange={(v) => set('prioridad', v, 'prioridad')}
          options={PRIORIDADES.map((p) => ({ value: p.value, label: p.label }))}
          error={errores.prioridad}
          help="Alta: requiere atención en pocos días. Las necesidades de medicamentos son de prioridad alta por defecto."
        />

        <div className="px-4 rounded-sm border border-line-soft bg-surface-2/50">
          <Switch
            checked={d.recurrente}
            onChange={(v) => set('recurrente', v)}
            label={
              <span className="flex flex-col">
                <span className="font-semibold">Necesidad recurrente</span>
                <span className="text-sm text-ink-2">Se repite (p. ej., cada mes)</span>
              </span>
            }
          />
        </div>

        {vigentes.length > 0 && (
          <SelectField
            label="Indicación médica relacionada"
            value={d.indicacionId}
            onChange={(e) => set('indicacionId', e.target.value)}
            help="Opcional. Relaciona la necesidad con una indicación vigente del adulto (por ejemplo, el medicamento que hay que reponer)."
            options={[{ value: '', label: 'Ninguna' }, ...vigentes.map((i) => ({ value: i.id, label: `${i.titulo} · ${i.frecuenciaHorario}` }))]}
          />
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <span>Estado inicial:</span>
          <EstadoPunto dot={pendiente.dot}>{pendiente.label}</EstadoPunto>
        </div>

        {!enLinea && (
          <p className="text-sm text-warning-700 font-semibold" role="status">
            Sin conexión: la necesidad se guardará en el dispositivo y se enviará sola al volver la conexión.
          </p>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:[&>*]:flex-1">
          <Button type="submit" variant={esGestion ? 'primary' : 'soft'} fullWidth loading={enviando}>
            Registrar necesidad
          </Button>
          <Button variant="outline" fullWidth onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </form>

      <SuccessOverlay
        open={exito !== null}
        message="Necesidad registrada correctamente"
        icon={<Laugh size={72} strokeWidth={1.6} aria-hidden />}
        detail={exito?.offline ? 'Guardada en el dispositivo · Pendiente de sincronización' : 'Estado: Pendiente'}
        duration={exito?.offline ? 3000 : 2200}
        onDone={() => exito && navigate(`${base}/necesidades/${exito.necesidad.id}`, { replace: true })}
      />
    </Page>
  )
}
