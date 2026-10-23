/*
 * TareaFormPage.tsx — Crear o editar una tarea de la agenda (Tarea_agenda) con guardarTarea: adulto mayor
 * (Env_Id), cuidador (Cuidador_Id, con el nombre de su usuario y el tipo de cuidado), indicación médica
 * relacionada (Indicacion_Id, opcional: solo las vigentes del adulto), título (Titulo_Tarea), fecha y hora
 * programadas, prioridad (Prioridad_Id), requiere evidencia y tarea repetitiva. Acepta ?adulto=.
 * Un solo campo de texto libre (título); el resto con listas, píldoras e interruptores (RF-06). El borrador
 * se conserva si la pantalla se cierra (useBorrador). Requiere conexión.
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarPlus, Save, WifiOff } from 'lucide-react'
import { Button, ButtonLink, ChoicePills, SelectField, SuccessOverlay, Switch, TextField, useToast } from '@/components/ui'
import { DATOS_TAREA_VACIOS, guardarTarea, type DatosTarea } from '@/domain/api'
import { nombreCompleto } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { usuariosVinculados } from '@/domain/relaciones'
import type { Prioridad } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { useBorrador } from '@/lib/useBorrador'
import { NoEncontrado } from '../components/NoEncontrado'
import { horaTarea, PRIORIDADES, tareaAbierta, useAgenda } from '../lib/agenda'

type Errores = Partial<Record<keyof DatosTarea, string>>

export default function TareaFormPage() {
  const { tareaId } = useParams()
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const [params] = useSearchParams()
  const { user, tareas, adultoPorId, cuidadorPorId, indicacionPorId, vinculos, catalogos } = useAgenda()

  const existente = tareaId ? tareas.find((t) => t.id === tareaId) : undefined
  const editando = !!tareaId

  const inicial: DatosTarea = existente
    ? {
        adultoId: existente.adultoId,
        cuidadorId: existente.cuidadorId,
        indicacionId: existente.indicacionId ?? '',
        titulo: existente.titulo,
        fechaProgramada: existente.fechaProgramada,
        horaProgramada: existente.horaProgramada,
        prioridad: existente.prioridad,
        requiereEvidencia: existente.requiereEvidencia,
        repetitiva: existente.repetitiva,
      }
    : { ...DATOS_TAREA_VACIOS, fechaProgramada: todayISO() }

  const [form, setForm, descartar] = useBorrador<DatosTarea>(`tarea:${tareaId ?? 'nueva'}:${user.id}`, inicial)
  const [errores, setErrores] = useState<Errores>({})
  const [ok, setOk] = useState<{ id: string; detalle: string } | null>(null)

  // Adulto indicado en la URL (?adulto=) tiene prioridad sobre el borrador (solo al crear).
  const pre = params.get('adulto') ?? ''
  const [aplicado, setAplicado] = useState(false)
  if (!editando && !aplicado && pre && adultoPorId.has(pre)) {
    setAplicado(true)
    if (form.adultoId !== pre) setForm((f) => ({ ...f, adultoId: pre, indicacionId: '' }))
  }

  const adulto = adultoPorId.get(form.adultoId)

  const adultosActivos = useMemo(
    () =>
      [...adultoPorId.values()]
        .filter((a) => a.estado === 'activo' && puede(user, 'agenda:gestionar', a, vinculos))
        .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es')),
    [adultoPorId, user, vinculos],
  )

  // Cuidadores activos; primero los que tienen vínculo de voluntario asignado con el adulto.
  const opcionesCuidador = useMemo(() => {
    const asignados = new Set(form.adultoId ? usuariosVinculados(vinculos, form.adultoId, 'voluntario_asignado') : [])
    const lista = [...cuidadorPorId.values()].filter((c) => c.activo || c.cuidador.id === form.cuidadorId)
    lista.sort((a, b) => Number(asignados.has(b.usuarioId)) - Number(asignados.has(a.usuarioId)) || a.nombre.localeCompare(b.nombre, 'es'))
    return lista.map((c) => ({ value: c.cuidador.id, label: `${c.nombre} · ${c.tipo}${asignados.has(c.usuarioId) ? ' · asignado' : ''}` }))
  }, [cuidadorPorId, vinculos, form.adultoId, form.cuidadorId])

  // Indicaciones vigentes del adulto (+ la ya relacionada, aunque haya dejado de estar vigente).
  const veIndicaciones = !!adulto && puede(user, 'indicaciones:ver', adulto, vinculos)
  const opcionesIndicacion = useMemo(() => {
    if (!adulto) return []
    const lista = [...indicacionPorId.values()].filter((i) => i.adultoId === adulto.id && (i.estado === 'vigente' || i.id === form.indicacionId))
    return [
      { value: '', label: 'Sin indicación relacionada' },
      ...lista.map((i) => ({
        value: i.id,
        label: `${i.titulo} · ${catalogos.tiposIndicacion.find((t) => t.id === i.tipoIndicacionId)?.nombre ?? 'Indicación'}${i.estado !== 'vigente' ? ' (no vigente)' : ''}`,
      })),
    ]
  }, [adulto, indicacionPorId, form.indicacionId, catalogos])
  const indicacion = form.indicacionId ? indicacionPorId.get(form.indicacionId) : undefined

  const set = <K extends keyof DatosTarea>(k: K, v: DatosTarea[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const onAdulto = (id: string) => {
    setForm((f) => ({ ...f, adultoId: id, indicacionId: '' }))
    setErrores((e) => ({ ...e, adultoId: undefined, indicacionId: undefined }))
  }

  const onIndicacion = (id: string) => {
    const i = indicacionPorId.get(id)
    // Sugerencia: si aún no hay título, se propone uno a partir de la indicación.
    setForm((f) => ({ ...f, indicacionId: id, titulo: f.titulo.trim() || !i ? f.titulo : `Cumplir: ${i.titulo}`.slice(0, 80) }))
    setErrores((e) => ({ ...e, indicacionId: undefined, titulo: undefined }))
  }

  const volver = existente ? `${base}/agenda/${existente.id}` : `${base}/agenda`

  if (editando && (!existente || !tareaAbierta(existente))) {
    return existente ? (
      <Page title="Editar tarea" back={volver}>
        <p className="p-4 rounded-sm bg-surface-2 text-ink-2">
          Esta tarea ya está {existente.estado === 'completada' ? 'completada' : 'cancelada'} y no se puede editar.
        </p>
        <ButtonLink to={volver} variant="outline">
          Volver al detalle
        </ButtonLink>
      </Page>
    ) : (
      <NoEncontrado titulo="Editar tarea" />
    )
  }

  const enviar = (ev: FormEvent) => {
    ev.preventDefault()
    if (!enLinea) return
    // Regla de interfaz: una tarea nueva no se programa en una fecha pasada.
    if (!editando && form.fechaProgramada && form.fechaProgramada < todayISO()) {
      setErrores({ fechaProgramada: 'La fecha no puede ser anterior a hoy.' })
      toast('Revisa los campos marcados.', 'error')
      return
    }
    const r = guardarTarea(user, form, existente?.id)
    if (!r.ok) {
      setErrores((r.errores as Errores | undefined) ?? {})
      toast(r.error, 'error')
      return
    }
    descartar()
    setOk({
      id: r.valor.id,
      detalle: `${adulto ? nombreCompleto(adulto) : 'Tarea'} · ${fechaCorta(r.valor.fechaProgramada)} · ${horaTarea(r.valor.horaProgramada)}`,
    })
  }

  return (
    <Page title={editando ? 'Editar tarea' : 'Nueva tarea'} back={volver}>
      <form className="flex flex-col gap-5" onSubmit={enviar} noValidate>
        {!enLinea && (
          <div role="status" className="flex items-start gap-3 p-4 rounded-sm bg-warning-100 border border-warning text-sm text-ink">
            <WifiOff size={20} className="flex-none mt-0.5 text-warning-700" aria-hidden />
            <p>
              <strong>Sin conexión.</strong> Guardar una tarea necesita internet porque se asigna al cuidador en el servidor central. Tus datos se conservan:
              podrás guardarlos al recuperar la conexión.
            </p>
          </div>
        )}

        <SelectField
          label="Adulto mayor"
          required
          placeholder="Selecciona un adulto"
          value={form.adultoId}
          onChange={(e) => onAdulto(e.target.value)}
          options={adultosActivos.map((a) => ({ value: a.id, label: nombreCompleto(a) }))}
          error={errores.adultoId}
          disabled={editando}
          hint={editando ? 'El adulto de una tarea creada no se cambia: crea una nueva si es para otra persona.' : undefined}
        />

        <SelectField
          label="Cuidador"
          required
          placeholder="Selecciona el cuidador"
          value={form.cuidadorId}
          onChange={(e) => set('cuidadorId', e.target.value)}
          options={opcionesCuidador}
          error={errores.cuidadorId}
          help="Persona con perfil de cuidador que realizará la tarea (voluntario comunitario, cuidador remunerado o familiar cuidador). Aparecen primero los voluntarios asignados a este adulto."
          hint={opcionesCuidador.length === 0 ? 'No hay cuidadores registrados. El administrador los da de alta en el perfil de cada usuario.' : undefined}
        />

        {veIndicaciones && (
          <SelectField
            label="Indicación médica relacionada"
            value={form.indicacionId}
            onChange={(e) => onIndicacion(e.target.value)}
            options={opcionesIndicacion}
            error={errores.indicacionId}
            help="Opcional. Relaciona la tarea con una indicación vigente del adulto (p. ej. un medicamento) para que el cuidador vea su frecuencia u horario."
            hint={
              indicacion
                ? `Frecuencia: ${indicacion.frecuenciaHorario}`
                : opcionesIndicacion.length <= 1 && adulto
                  ? 'Este adulto no tiene indicaciones vigentes.'
                  : undefined
            }
          />
        )}

        <TextField
          label="Título de la tarea"
          required
          maxLength={80}
          placeholder="Ej.: Tomar la presión arterial"
          value={form.titulo}
          onChange={(e) => set('titulo', e.target.value)}
          error={errores.titulo}
          hint={`${form.titulo.length}/80`}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Fecha"
            type="date"
            required
            min={editando ? undefined : todayISO()}
            value={form.fechaProgramada}
            onChange={(e) => set('fechaProgramada', e.target.value)}
            error={errores.fechaProgramada}
          />
          <TextField
            label="Hora"
            type="time"
            required
            value={form.horaProgramada}
            onChange={(e) => set('horaProgramada', e.target.value)}
            error={errores.horaProgramada}
          />
        </div>

        <ChoicePills<Prioridad>
          label="Prioridad"
          value={form.prioridad}
          onChange={(v) => set('prioridad', v)}
          options={PRIORIDADES}
          error={errores.prioridad}
          help="Alta: debe hacerse sin falta a la hora indicada (p. ej. un medicamento). Media: importante, admite cierto margen. Baja: puede reprogramarse."
        />

        <fieldset className="flex flex-col gap-1 p-4 rounded-sm border border-line-soft bg-surface">
          <legend className="sr-only">Opciones de la tarea</legend>
          <Switch
            label={
              <span className="flex flex-col">
                <span className="font-semibold">Requiere evidencia</span>
                <span className="text-sm text-muted">El cuidador debe adjuntar una foto o documento para completarla.</span>
              </span>
            }
            checked={form.requiereEvidencia}
            onChange={(v) => set('requiereEvidencia', v)}
          />
          <Switch
            label={
              <span className="flex flex-col">
                <span className="font-semibold">Tarea repetitiva</span>
                <span className="text-sm text-muted">Al completarla se programa automáticamente la del día siguiente.</span>
              </span>
            }
            checked={form.repetitiva}
            onChange={(v) => set('repetitiva', v)}
          />
        </fieldset>

        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button type="submit" fullWidth disabled={!enLinea} icon={editando ? <Save size={22} aria-hidden /> : <CalendarPlus size={22} aria-hidden />}>
            {editando ? 'Guardar cambios' : 'Crear tarea'}
          </Button>
          <ButtonLink to={volver} variant="outline" fullWidth>
            Cancelar
          </ButtonLink>
        </div>
        {!enLinea && <p className="-mt-2 text-sm text-muted text-center">Botón deshabilitado: necesitas conexión a internet.</p>}
      </form>

      <SuccessOverlay
        open={ok !== null}
        message={editando ? '¡Tarea actualizada!' : '¡Tarea creada correctamente!'}
        detail={ok?.detalle}
        onDone={() => ok && navigate(`${base}/agenda/${ok.id}`, { replace: true })}
      />
    </Page>
  )
}
