/*
 * TareaFormPage.tsx — Crear y asignar (o editar) tareas de la agenda (Tarea_agenda), solo con "agenda:gestionar".
 * En 3 pasos que caben en un desplazamiento a 360×640 (FormPasos, con borrador local en useFormulario):
 *   1. Adulto mayor, cuidador (solo los cuidadores asignados a ese adulto en la cuenta activa), indicación médica
 *      relacionada (opcional) y título (único campo de texto libre, RF-06).
 *   2. Fecha, hora, prioridad y "requiere evidencia".
 *   3. Repetición: no se repite · diaria · semanal (días), con fecha de fin obligatoria y tope de 60 tareas. Vista
 *      previa "Se crearán N tareas: …". Al guardar se crea **una Tarea por ocurrencia** (con `repetitiva` y `serieId`).
 * Al editar se corrige una ocurrencia (o esta y las siguientes de su serie); el adulto y la repetición no cambian.
 * Acepta ?adulto= y ?fecha=. Sin conexión, guardar queda deshabilitado y se explica por qué.
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { ButtonLink, ChoicePills, FormPasos, SelectField, SuccessOverlay, Switch, TextField, useFormulario, useToast } from '@/components/ui'
import { crearTareas, DATOS_TAREA_VACIOS, fechasDeSerie, guardarTarea, MAX_OCURRENCIAS, siguientesDeSerie, validarTarea, type DatosTarea } from '@/domain/api'
import { nombreCompleto } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { fechaValida } from '@/domain/validacion'
import type { Prioridad } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { NoEncontrado } from '../components/NoEncontrado'
import { RepeticionCampos } from '../components/RepeticionCampos'
import { fechaDiaCorta, horaTarea, PRIORIDADES, tareaAbierta, useAgenda } from '../lib/agenda'

/** Valores del formulario: los datos de la tarea y, al editar una serie, si el cambio alcanza a las siguientes. */
interface Valores extends DatosTarea {
  aplicarASiguientes: boolean
}

const CAMPOS: Array<keyof Valores> = ['adultoId', 'cuidadorId', 'indicacionId', 'titulo', 'fechaProgramada', 'horaProgramada', 'prioridad', 'repeticion', 'diasSemana', 'fechaFin']

export default function TareaFormPage() {
  const { tareaId } = useParams()
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const [params] = useSearchParams()
  const { user, tareas, adultoPorId, cuidadorPorId, cuidadoresDeAdulto, indicacionPorId, vinculos, catalogos } = useAgenda()

  const existente = tareaId ? tareas.find((t) => t.id === tareaId) : undefined
  const editando = !!tareaId
  const hoy = todayISO()

  const inicial: Valores = existente
    ? {
        adultoId: existente.adultoId,
        cuidadorId: existente.cuidadorId,
        indicacionId: existente.indicacionId ?? '',
        titulo: existente.titulo,
        fechaProgramada: existente.fechaProgramada,
        horaProgramada: existente.horaProgramada,
        prioridad: existente.prioridad,
        requiereEvidencia: existente.requiereEvidencia,
        repeticion: 'ninguna',
        diasSemana: [],
        fechaFin: '',
        aplicarASiguientes: false,
      }
    : { ...DATOS_TAREA_VACIOS, fechaProgramada: hoy, aplicarASiguientes: false }

  const f = useFormulario<Valores>({
    clave: `tarea:${tareaId ?? 'nueva'}:${user.id}:${user.orgId}`,
    inicial,
    campos: CAMPOS,
    validar: (v) => validarTarea(v, undefined, { actor: user, existente }),
  })
  const v = f.valores
  const [ok, setOk] = useState<{ destino: string; mensaje: string; detalle: string } | null>(null)

  const adulto = adultoPorId.get(v.adultoId)

  const adultosActivos = useMemo(
    () =>
      [...adultoPorId.values()]
        .filter((a) => a.estado === 'activo' && puede(user, 'agenda:gestionar', a, vinculos))
        .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es')),
    [adultoPorId, user, vinculos],
  )

  // Cuidadores asignables: vínculo "cuidador_asignado" con el adulto, en la cuenta activa (+ el actual al editar).
  const cuidadoresAdulto = useMemo(() => cuidadoresDeAdulto(v.adultoId), [cuidadoresDeAdulto, v.adultoId])
  const opcionesCuidador = useMemo(() => {
    const lista = [...cuidadoresAdulto]
    const actual = existente && !lista.some((c) => c.cuidador.id === existente.cuidadorId) ? cuidadorPorId.get(existente.cuidadorId) : undefined
    if (actual) lista.push(actual)
    return lista.map((c) => ({ value: c.cuidador.id, label: `${c.nombre} · ${c.tipo}` }))
  }, [cuidadoresAdulto, cuidadorPorId, existente])
  const cuidadorElegido = cuidadorPorId.get(v.cuidadorId)

  // Indicaciones vigentes del adulto (+ la ya relacionada, aunque haya dejado de estar vigente).
  const veIndicaciones = !!adulto && puede(user, 'indicaciones:ver', adulto, vinculos)
  const opcionesIndicacion = useMemo(() => {
    if (!adulto) return []
    const lista = [...indicacionPorId.values()].filter((i) => i.adultoId === adulto.id && (i.estado === 'vigente' || i.id === v.indicacionId))
    return [
      { value: '', label: 'Sin indicación relacionada' },
      ...lista.map((i) => ({
        value: i.id,
        label: `${i.titulo} · ${catalogos.tiposIndicacion.find((t) => t.id === i.tipoIndicacionId)?.nombre ?? 'Indicación'}${i.estado !== 'vigente' ? ' (no vigente)' : ''}`,
      })),
    ]
  }, [adulto, indicacionPorId, v.indicacionId, catalogos])
  const indicacion = v.indicacionId ? indicacionPorId.get(v.indicacionId) : undefined

  /** Al elegir el adulto cambian los cuidadores y las indicaciones posibles; si solo hay un cuidador se propone. */
  const alElegirAdulto = (id: string) => {
    const posibles = cuidadoresDeAdulto(id)
    f.setValores({ adultoId: id, indicacionId: '', cuidadorId: posibles.length === 1 ? posibles[0]!.cuidador.id : '' })
    f.tocar('adultoId')
  }

  // ?adulto= y ?fecha= (desde el perfil del adulto o desde un día de la agenda) tienen prioridad sobre el borrador.
  const aplicado = useRef(false)
  const preAdulto = params.get('adulto') ?? ''
  const preFecha = params.get('fecha') ?? ''
  useEffect(() => {
    if (editando || aplicado.current) return
    aplicado.current = true
    const cambios: Partial<Valores> = {}
    if (preAdulto && adultoPorId.has(preAdulto) && v.adultoId !== preAdulto) {
      const posibles = cuidadoresDeAdulto(preAdulto)
      Object.assign(cambios, { adultoId: preAdulto, indicacionId: '', cuidadorId: posibles.length === 1 ? posibles[0]!.cuidador.id : '' })
    }
    if (preFecha && fechaValida(preFecha) && preFecha >= hoy && v.fechaProgramada !== preFecha) cambios.fechaProgramada = preFecha
    if (Object.keys(cambios).length > 0) f.setValores(cambios)
  }, [editando, preAdulto, preFecha, adultoPorId, cuidadoresDeAdulto, hoy, v.adultoId, v.fechaProgramada, f])

  const volver = existente ? `${base}/agenda/${existente.id}` : `${base}/agenda`
  const siguientes = existente ? siguientesDeSerie(tareas, existente).length - 1 : 0
  const fechas = fechasDeSerie(v)

  if (editando && (!existente || !tareaAbierta(existente))) {
    return existente ? (
      <Page title="Editar tarea" back={volver}>
        <p className="p-4 rounded-sm bg-surface-2 text-ink-2">Esta tarea ya está {existente.estado === 'completada' ? 'completada' : 'cancelada'} y no se puede editar.</p>
        <ButtonLink to={volver} variant="outline">
          Volver al detalle
        </ButtonLink>
      </Page>
    ) : (
      <NoEncontrado titulo="Editar tarea" />
    )
  }

  const guardar = (valores: Valores) => {
    const datos: DatosTarea = { ...valores }
    const nombreAdulto = adulto ? nombreCompleto(adulto) : 'Tarea'
    if (existente) {
      const r = guardarTarea(user, datos, existente.id, { aplicarASiguientes: valores.aplicarASiguientes })
      if (!r.ok) {
        toast(r.error, 'error')
        return r
      }
      setOk({
        destino: `${base}/agenda/${r.valor.id}`,
        mensaje: valores.aplicarASiguientes && siguientes > 0 ? `¡${siguientes + 1} tareas actualizadas!` : '¡Tarea actualizada!',
        detalle: `${nombreAdulto} · ${fechaDiaCorta(r.valor.fechaProgramada)} · ${horaTarea(r.valor.horaProgramada)}`,
      })
      return r
    }
    const r = crearTareas(user, datos)
    if (!r.ok) {
      toast(r.error, 'error')
      return r
    }
    const creadas = r.valor
    const primera = creadas[0]!
    setOk({
      destino: creadas.length > 1 ? `${base}/agenda${primera.fechaProgramada === hoy ? '' : `?dia=${primera.fechaProgramada}`}` : `${base}/agenda/${primera.id}`,
      mensaje: creadas.length > 1 ? `¡${creadas.length} tareas creadas!` : '¡Tarea creada correctamente!',
      detalle:
        creadas.length > 1
          ? `${nombreAdulto} · del ${fechaDiaCorta(primera.fechaProgramada)} al ${fechaDiaCorta(creadas[creadas.length - 1]!.fechaProgramada)} · ${horaTarea(primera.horaProgramada)}`
          : `${nombreAdulto} · ${fechaDiaCorta(primera.fechaProgramada)} · ${horaTarea(primera.horaProgramada)}`,
    })
    return r
  }

  const sinCuidadores = !!adulto && cuidadoresAdulto.length === 0 && !editando

  const paso1 = (
    <>
      <SelectField
        label="Adulto mayor"
        required
        placeholder="Selecciona un adulto"
        {...f.campo('adultoId')}
        onChange={(e) => alElegirAdulto(e.target.value)}
        options={adultosActivos.map((a) => ({ value: a.id, label: nombreCompleto(a) }))}
        disabled={editando}
        hint={editando ? 'El adulto de una tarea creada no se cambia: crea una nueva si es para otra persona.' : undefined}
      />

      <div className="flex flex-col gap-2">
        <SelectField
          label="Cuidador"
          required
          placeholder={v.adultoId ? 'Selecciona el cuidador' : 'Primero elige el adulto'}
          {...f.campo('cuidadorId')}
          options={opcionesCuidador}
          disabled={!v.adultoId}
          help="Solo aparecen los cuidadores asignados a este adulto en tu cuenta (vínculo «cuidador asignado»). Si falta alguien, asígnalo desde el perfil del adulto."
          hint={v.adultoId && !sinCuidadores ? 'Quien realizará la tarea.' : undefined}
        />
        {sinCuidadores && (
          <p role="status" className="flex flex-col gap-1 p-3 rounded-sm bg-warning-100 border border-warning text-sm text-ink">
            <span>
              <strong>Este adulto no tiene cuidadores asignados.</strong> Asigna primero un cuidador para poder encargarle tareas.
            </span>
            {adulto && puede(user, 'adultos:asignar', adulto, vinculos) && (
              <Link to={`${base}/adultos/${adulto.id}`} className="inline-flex items-center min-h-12 font-semibold text-navy underline underline-offset-2">
                Ir al perfil de {adulto.nombre} para asignar
              </Link>
            )}
          </p>
        )}
      </div>

      {veIndicaciones && (
        <SelectField
          label="Indicación médica relacionada"
          {...f.campo('indicacionId')}
          options={opcionesIndicacion}
          help="Opcional. Relaciona la tarea con una indicación vigente del adulto (p. ej. un medicamento) para que el cuidador vea su frecuencia u horario."
          hint={indicacion ? `Frecuencia: ${indicacion.frecuenciaHorario}` : opcionesIndicacion.length <= 1 && adulto ? 'Este adulto no tiene indicaciones vigentes.' : undefined}
          onChange={(e) => {
            const i = indicacionPorId.get(e.target.value)
            // Sugerencia: si aún no hay título, se propone uno a partir de la indicación.
            f.setValores({ indicacionId: e.target.value, ...(!v.titulo.trim() && i ? { titulo: `Cumplir: ${i.titulo}`.slice(0, 80) } : {}) })
          }}
        />
      )}

      <TextField label="Título de la tarea" required maxLength={80} placeholder="Ej.: Tomar la presión arterial" {...f.campo('titulo')} hint={`${v.titulo.length}/80`} />
    </>
  )

  const paso2 = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Fecha"
          type="date"
          required
          min={editando ? undefined : hoy}
          {...f.campo('fechaProgramada')}
          hint={editando ? undefined : 'Si se repite, es la primera.'}
        />
        <TextField label="Hora" type="time" required {...f.campo('horaProgramada')} />
      </div>

      <ChoicePills<Prioridad>
        label="Prioridad"
        required
        options={PRIORIDADES}
        {...f.valor('prioridad')}
        help="Alta: debe hacerse sin falta a la hora indicada (p. ej. un medicamento). Media: importante, admite cierto margen. Baja: puede reprogramarse."
      />

      <fieldset className="flex flex-col gap-1 p-3 rounded-sm border border-line-soft bg-surface">
        <legend className="sr-only">Opciones de la tarea</legend>
        <Switch
          id={f.idDe('requiereEvidencia')}
          label={
            <span className="flex flex-col">
              <span className="font-semibold">Requiere evidencia</span>
              <span className="text-sm text-muted">El cuidador adjunta una foto o documento y la coordinación la valida para completarla.</span>
            </span>
          }
          checked={v.requiereEvidencia}
          onChange={(x) => f.set('requiereEvidencia', x)}
        />
        {editando && siguientes > 0 && (
          <Switch
            id={f.idDe('aplicarASiguientes')}
            label={
              <span className="flex flex-col">
                <span className="font-semibold">Aplicar a las siguientes</span>
                <span className="text-sm text-muted">
                  También cambia el cuidador, el título, la hora, la prioridad y la evidencia de las {siguientes} ocurrencias siguientes.
                </span>
              </span>
            }
            checked={v.aplicarASiguientes}
            onChange={(x) => f.set('aplicarASiguientes', x)}
          />
        )}
      </fieldset>
    </>
  )

  const paso3 = (
    <RepeticionCampos
      valores={v}
      repeticion={{ ...f.valor('repeticion') }}
      diasSemana={{ ...f.valor('diasSemana') }}
      fechaFin={{ ...f.campo('fechaFin') }}
      nombreCuidador={cuidadorElegido?.nombre}
    />
  )

  const pasos = [
    { id: 'quien', titulo: 'Adulto y cuidador', campos: ['adultoId', 'cuidadorId', 'indicacionId', 'titulo'] as Array<keyof Valores & string>, contenido: paso1 },
    { id: 'cuando', titulo: 'Fecha y prioridad', campos: ['fechaProgramada', 'horaProgramada', 'prioridad'] as Array<keyof Valores & string>, contenido: paso2 },
    ...(editando
      ? []
      : [{ id: 'repeticion', titulo: 'Repetición', campos: ['repeticion', 'diasSemana', 'fechaFin'] as Array<keyof Valores & string>, contenido: paso3 }]),
  ]

  const aviso = !enLinea ? (
    <div role="status" className="flex items-start gap-3 p-3 rounded-sm bg-warning-100 border border-warning text-sm text-ink">
      <WifiOff size={20} className="flex-none mt-0.5 text-warning-700" aria-hidden />
      <p>
        <strong>Sin conexión.</strong> Guardar tareas necesita internet porque se asignan al cuidador en el servidor central. Lo que escribiste se conserva.
      </p>
    </div>
  ) : undefined

  const n = fechas.length > MAX_OCURRENCIAS ? 0 : fechas.length
  return (
    <Page title={editando ? 'Editar tarea' : 'Nueva tarea'} back={volver}>
      <FormPasos
        formulario={f}
        pasos={pasos}
        intro={
          editando
            ? 'Corrige esta tarea. El cuidador recibe un aviso con los cambios.'
            : 'Crea y asigna una tarea de cuidado. Si se repite, se crea una tarea individual por cada ocurrencia.'
        }
        alGuardar={guardar}
        textoGuardar={editando ? 'Guardar cambios' : n > 1 ? `Crear ${n} tareas` : 'Crear tarea'}
        onCancelar={() => navigate(volver)}
        guardarDeshabilitado={!enLinea}
        motivoDeshabilitado="Botón deshabilitado: necesitas conexión a internet para guardar."
        pie={aviso}
      />

      <SuccessOverlay open={ok !== null} message={ok?.mensaje ?? ''} detail={ok?.detalle} onDone={() => ok && navigate(ok.destino, { replace: true })} />
    </Page>
  )
}
